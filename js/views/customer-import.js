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
      else if (m.tier === undefined && (s === "tier" || s === "phân loại" || s === "phân hạng")) m.tier = i;
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
          status: cell(r, map.status), tier: cell(r, map.tier), _sheet: name,
        });
      }
    });
    return out;
  }

  function onFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === "undefined") {
      setStatus(T('imp.noXlsx'), "err");
      return;
    }
    fileName = f.name;
    setStatus(T("imp.reading", { f: f.name }));
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        rows = parseWorkbook(wb);
        if (!rows.length) {
          setStatus(T("imp.cust.noRows"), "err");
          setActions(false);
          return;
        }
        setStatus(T("imp.cust.read", { n: rows.length, f: f.name }));
        setActions(true, false);
      } catch (err) {
        setStatus(T("imp.readFail") + " " + (err.message || err), "err");
      }
    };
    reader.onerror = () => setStatus(T("imp.readFailShort"), "err");
    reader.readAsArrayBuffer(f);
  }

  async function preview() {
    if (!rows) return;
    setStatus(T("imp.cust.reconciling"));
    try {
      const r = await FISG_STORE.previewCustomerUpsert(rows);
      setStatus(T("imp.cust.reconciled", { f: fileName, u: r.update, c: r.create }) + (r.skip ? " · " + T("imp.skippedNoName", { n: r.skip }) : "") + ". " + T("imp.clickUpdate"), "ok");
      setActions(true, true);
    } catch (e) {
      setStatus(T("imp.reconcileFail") + " " + (e.message || e), "err");
    }
  }

  async function run() {
    if (!rows) return;
    if (typeof confirm === "function"
        && !confirm(T("imp.cust.confirm", { n: rows.length }))) return;
    setActions(false);
    const bar = document.getElementById("ciBar");
    const barFill = document.getElementById("ciBarFill");
    if (bar) bar.style.display = "block";
    try {
      const rep = await FISG_STORE.bulkUpsertCustomers(rows, (done, total) => {
        setStatus(T("imp.writing", { a: done, b: total }));
        if (barFill) barFill.style.width = Math.round(done / total * 100) + "%";
      });
      let msg = T("imp.cust.done", { u: rep.updated, c: rep.created });
      if (rep.skipped) msg += " · " + T("imp.nSkipped", { n: rep.skipped });
      if (rep.failed) msg += ` · <b style="color:var(--overdue)">${T("imp.nFailed", { n: rep.failed })}</b>`;
      setStatus(msg, rep.failed ? "err" : "ok");
      if (rep.failed) {
        const box = document.getElementById("ciErrors");
        if (box) {
          box.style.display = "block";
          box.innerHTML = "<b>" + T("imp.cust.failedRows") + "</b><br>"
            + rep.errors.slice(0, 40).map(x => "• " + esc(x)).join("<br>");
        }
      }
      setActions(true, true);
    } catch (e) {
      setStatus(T("imp.stopped") + " " + (e.message || e), "err");
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
            <b>${T("imp.cust.title")}</b>
            <p>${T("imp.cust.desc")}</p>
          </div>
        </div>
        <div class="ci-row">
          <label class="ci-file">
            <input type="file" accept=".xlsx,.xls" onchange="FISG_CUSTOMER_IMPORT.onFile(this)">
            <span>${T("imp.pickFile")}</span>
          </label>
          <button class="btn-ghost" id="ciPreview" disabled onclick="FISG_CUSTOMER_IMPORT.preview()">${T("imp.preview")}</button>
          <button class="btn-primary" id="ciRun" disabled onclick="FISG_CUSTOMER_IMPORT.run()">${T("imp.update")}</button>
        </div>
        <div class="ci-bar" id="ciBar" style="display:none"><div id="ciBarFill"></div></div>
        <div class="ci-status" id="ciStatus">${T("imp.cust.cols")}</div>
        <div class="ci-errors" id="ciErrors" style="display:none"></div>
      </div>`;
  }

  window.FISG_CUSTOMER_IMPORT = { render: render, onFile: onFile, preview: preview, run: run };
})();
