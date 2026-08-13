(function () {
  "use strict";

  let rows = null;
  let fileName = "";

  function headerMap(headerRow) {
    const m = {};
    headerRow.forEach((h, i) => {
      const s = String(h == null ? "" : h).trim().toLowerCase();
      if (!s) return;
      if (m.title === undefined && (s === "title" || s.indexOf("title") === 0
          || s === "tên khách hàng" || s === "tên" || s.indexOf("tên gọn") === 0)) m.title = i;

      else if (m.owner === undefined && (s === "owner" || s.indexOf("người phụ trách") >= 0
          || s.indexOf("chủ sở hữu") >= 0)) m.owner = i;
      else if (m.legal === undefined && (s === "legalname" || s.indexOf("pháp nhân") >= 0)) m.legal = i;
      else if (m.segment === undefined && s === "segment") m.segment = i;
      else if (m.region === undefined && s === "region") m.region = i;
      else if (m.status === undefined && (s.indexOf("customerstatus") >= 0
          || s === "trạng thái" || s === "status")) m.status = i;
    });
    return m;
  }

  function parseWorkbook(wb) {
    const out = [];
    (wb.SheetNames || []).forEach(name => {
      const ws = wb.Sheets[name];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
      if (!grid.length) return;
      const map = headerMap(grid[0]);

      if (map.title === undefined || (map.owner === undefined && map.legal === undefined)) return;
      const cell = (r, i) => i === undefined ? "" : String(r[i] == null ? "" : r[i]).trim();
      for (let i = 1; i < grid.length; i++) {
        const r = grid[i];
        const title = cell(r, map.title);
        const legal = cell(r, map.legal);
        if (!title && !legal) continue;
        out.push({
          title: title, owner: cell(r, map.owner), legal: legal,
          segment: cell(r, map.segment), region: cell(r, map.region),
          status: cell(r, map.status), _sheet: name,
        });
      }
    });
    return out;
  }

  function onFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === "undefined") {
      setStatus('Chưa tải được thư viện đọc Excel. Kiểm tra mạng rồi thử lại.', "err");
      return;
    }
    fileName = f.name;
    setStatus("Đang đọc " + f.name + "…");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        rows = parseWorkbook(wb);
        if (!rows.length) {
          setStatus("Không tìm thấy dòng khách hàng nào (cần cột Title + Owner/LegalName).", "err");
          setActions(false);
          return;
        }
        setStatus("Đã đọc " + rows.length + " dòng từ " + f.name + ". Bấm “Xem trước” để đối chiếu.");
        setActions(true, false);
      } catch (err) {
        setStatus("Không đọc được file: " + (err.message || err), "err");
      }
    };
    reader.onerror = () => setStatus("Không đọc được file.", "err");
    reader.readAsArrayBuffer(f);
  }

  async function preview() {
    if (!rows) return;
    setStatus("Đang đối chiếu với list Customers trên SharePoint…");
    try {
      const r = await FISG_STORE.previewCustomerUpsert(rows);
      setStatus(`Đối chiếu xong ${fileName}: `
        + `<b>${r.update}</b> cập nhật · <b>${r.create}</b> tạo mới`
        + (r.skip ? ` · ${r.skip} bỏ qua (thiếu tên)` : "")
        + `. Bấm “Cập nhật lên SharePoint” để ghi.`, "ok");
      setActions(true, true);
    } catch (e) {
      setStatus("Không đối chiếu được: " + (e.message || e), "err");
    }
  }

  async function run() {
    if (!rows) return;
    if (typeof confirm === "function"
        && !confirm("Cập nhật " + rows.length + " dòng lên list Customers?\n\n"
          + "Khách đã có sẽ được cập nhật, khách mới sẽ được tạo. "
          + "Chạy lại nhiều lần vẫn an toàn.")) return;
    setActions(false);
    const bar = document.getElementById("ciBar");
    const barFill = document.getElementById("ciBarFill");
    if (bar) bar.style.display = "block";
    try {
      const rep = await FISG_STORE.bulkUpsertCustomers(rows, (done, total) => {
        setStatus(`Đang ghi… ${done}/${total}`);
        if (barFill) barFill.style.width = Math.round(done / total * 100) + "%";
      });
      let msg = `Xong: <b>${rep.updated}</b> cập nhật · <b>${rep.created}</b> tạo mới`;
      if (rep.skipped) msg += ` · ${rep.skipped} bỏ qua`;
      if (rep.failed) msg += ` · <b style="color:var(--overdue)">${rep.failed} lỗi</b>`;
      setStatus(msg, rep.failed ? "err" : "ok");
      if (rep.failed) {
        const box = document.getElementById("ciErrors");
        if (box) {
          box.style.display = "block";
          box.innerHTML = "<b>Dòng chưa ghi được (thử lại lần nữa thường là xong):</b><br>"
            + rep.errors.slice(0, 40).map(x => "• " + esc(x)).join("<br>");
        }
      }
      setActions(true, true);
    } catch (e) {
      setStatus("Dừng giữa chừng: " + (e.message || e), "err");
      setActions(true, true);
    } finally {
      if (bar) setTimeout(() => { bar.style.display = "none"; }, 1200);
    }
  }

  function esc(s) { return (window.ckEsc ? ckEsc(s) : String(s == null ? "" : s)); }
  function setStatus(html, kind) {
    const el = document.getElementById("ciStatus");
    if (!el) return;
    el.className = "ci-status" + (kind ? " ci-" + kind : "");
    el.innerHTML = html;
  }
  function setActions(hasFile, previewed) {
    const p = document.getElementById("ciPreview"), r = document.getElementById("ciRun");
    if (p) p.disabled = !hasFile;
    if (r) r.disabled = !previewed;
  }

  function render() {
    const host = document.getElementById("ciBox");
    if (!host) return;
    if (!(window.myCap && myCap().admin)) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <div class="ci-card glass">
        <div class="ci-head">
          <div>
            <b>Nhập / cập nhật khách hàng từ Excel</b>
            <p>File gồm cả khách cũ lẫn mới. App tự đối chiếu: khách đã có thì cập nhật
               Người phụ trách + Tên pháp nhân, khách mới thì tạo. Chạy lại vẫn an toàn.</p>
          </div>
        </div>
        <div class="ci-row">
          <label class="ci-file">
            <input type="file" accept=".xlsx,.xls" onchange="FISG_CUSTOMER_IMPORT.onFile(this)">
            <span>Chọn file Excel…</span>
          </label>
          <button class="btn-ghost" id="ciPreview" disabled onclick="FISG_CUSTOMER_IMPORT.preview()">Xem trước</button>
          <button class="btn-primary" id="ciRun" disabled onclick="FISG_CUSTOMER_IMPORT.run()">Cập nhật lên SharePoint</button>
        </div>
        <div class="ci-bar" id="ciBar" style="display:none"><div id="ciBarFill"></div></div>
        <div class="ci-status" id="ciStatus">Cột nhận diện: Title · Owner (Người phụ trách) · LegalName (Tên pháp nhân) · Segment · Region · CustomerStatus. Sheet phụ (Cần rà, Còn trống) tự bỏ qua.</div>
        <div class="ci-errors" id="ciErrors" style="display:none"></div>
      </div>`;
  }

  window.FISG_CUSTOMER_IMPORT = { render: render, onFile: onFile, preview: preview, run: run };
})();
