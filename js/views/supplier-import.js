/* js/views/supplier-import.js — nhập TÊN nhà cung cấp vào list Suppliers.
 *
 * Chỉ Super Admin. Chọn file Excel (một cột tên NCC) → xem trước → cập nhật:
 * tên chưa có thì tạo, tên đã có thì bỏ qua. Chạy lại an toàn. Toàn bộ logic ghi
 * nằm ở store.js (bulkUpsertSuppliers); file này chỉ lo đọc Excel và giao diện. */
(function () {
  "use strict";
  let names = null, fileName = "";

  /* Lấy tên NCC từ workbook: ưu tiên cột tiêu đề Title/Supplier/Nhà cung cấp;
     không có tiêu đề rõ thì lấy cột đầu tiên. Bỏ dòng trống và tiêu đề. */
  function parseWorkbook(wb) {
    const out = [];
    (wb.SheetNames || []).forEach(sn => {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: "" });
      if (!grid.length) return;
      const head = grid[0].map(h => String(h == null ? "" : h).trim().toLowerCase());
      let col = head.findIndex(h => h === "title" || h === "supplier" || h === "nhà cung cấp"
        || h === "ncc" || h === "tên" || h.indexOf("supplier") >= 0);
      const hasHeader = col >= 0;
      if (col < 0) col = 0;
      for (let i = hasHeader ? 1 : 0; i < grid.length; i++) {
        const v = String((grid[i] || [])[col] == null ? "" : grid[i][col]).trim();
        if (v) out.push(v);
      }
    });
    /* bỏ trùng trong file, giữ thứ tự */
    const seen = {}, uniq = [];
    out.forEach(n => { const k = n.toUpperCase(); if (!seen[k]) { seen[k] = 1; uniq.push(n); } });
    return uniq;
  }

  function onFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === "undefined") { setStatus("Chưa tải được thư viện đọc Excel.", "err"); return; }
    fileName = f.name; setStatus("Đang đọc " + f.name + "…");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        names = parseWorkbook(XLSX.read(new Uint8Array(e.target.result), { type: "array" }));
        if (!names.length) { setStatus("Không tìm thấy tên nhà cung cấp nào trong file.", "err"); setActions(false); return; }
        setStatus("Đã đọc " + names.length + " nhà cung cấp từ " + f.name + ". Bấm “Xem trước”.");
        setActions(true, false);
      } catch (err) { setStatus("Không đọc được file: " + (err.message || err), "err"); }
    };
    reader.onerror = () => setStatus("Không đọc được file.", "err");
    reader.readAsArrayBuffer(f);
  }

  async function preview() {
    if (!names) return;
    setStatus("Đang đối chiếu với list Suppliers…");
    try {
      const r = await FISG_STORE.previewSupplierUpsert(names);
      setStatus(`Đối chiếu xong: <b>${r.create}</b> tạo mới · ${r.skip} đã có (bỏ qua). Bấm “Cập nhật lên SharePoint”.`, "ok");
      setActions(true, true);
    } catch (e) { setStatus("Không đối chiếu được: " + (e.message || e), "err"); }
  }

  async function run() {
    if (!names) return;
    if (typeof confirm === "function"
        && !confirm("Cập nhật " + names.length + " nhà cung cấp lên list Suppliers?\n\nTên đã có sẽ bỏ qua, tên mới sẽ được tạo. Chạy lại vẫn an toàn.")) return;
    setActions(false);
    const bar = document.getElementById("siBar"), fill = document.getElementById("siBarFill");
    if (bar) bar.style.display = "block";
    try {
      const rep = await FISG_STORE.bulkUpsertSuppliers(names, (done, total) => {
        setStatus(`Đang ghi… ${done}/${total}`);
        if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 100) + "%";
      });
      let msg = `Xong: <b>${rep.created}</b> tạo mới · ${rep.skipped} bỏ qua`;
      if (rep.failed) msg += ` · <b style="color:var(--overdue)">${rep.failed} lỗi</b>`;
      setStatus(msg, rep.failed ? "err" : "ok");
      if (rep.failed) {
        const box = document.getElementById("siErrors");
        if (box) { box.style.display = "block"; box.innerHTML = "<b>Dòng chưa ghi được:</b><br>" + rep.errors.slice(0, 40).map(x => "• " + esc(x)).join("<br>"); }
      }
      setActions(true, true);
    } catch (e) {
      setStatus("Dừng giữa chừng: " + (e.message || e), "err"); setActions(true, true);
    } finally { if (bar) setTimeout(() => { bar.style.display = "none"; }, 1200); }
  }

  function esc(s) { return (window.ckEsc ? ckEsc(s) : String(s == null ? "" : s)); }
  function setStatus(html, kind) { const el = document.getElementById("siStatus"); if (el) { el.className = "ci-status" + (kind ? " ci-" + kind : ""); el.innerHTML = html; } }
  function setActions(hasFile, previewed) {
    const p = document.getElementById("siPreview"), r = document.getElementById("siRun");
    if (p) p.disabled = !hasFile; if (r) r.disabled = !previewed;
  }

  function render() {
    const host = document.getElementById("siBox");
    if (!host) return;
    if (!(window.myCap && myCap().admin)) { host.innerHTML = ""; return; }   // chỉ Super Admin
    host.innerHTML = `
      <div class="ci-card glass">
        <div class="ci-head"><div>
          <b>Nhập nhà cung cấp từ Excel</b>
          <p>File một cột tên NCC. App tự đối chiếu list Suppliers: tên mới thì tạo, tên đã có thì bỏ qua. Chạy lại vẫn an toàn.</p>
        </div></div>
        <div class="ci-row">
          <label class="ci-file"><input type="file" accept=".xlsx,.xls" onchange="FISG_SUPPLIER_IMPORT.onFile(this)"><span>Chọn file Excel…</span></label>
          <button class="btn-ghost" id="siPreview" disabled onclick="FISG_SUPPLIER_IMPORT.preview()">Xem trước</button>
          <button class="btn-primary" id="siRun" disabled onclick="FISG_SUPPLIER_IMPORT.run()">Cập nhật lên SharePoint</button>
        </div>
        <div class="ci-bar" id="siBar" style="display:none"><div id="siBarFill"></div></div>
        <div class="ci-status" id="siStatus">Cột nhận diện: Title / Supplier / Nhà cung cấp (hoặc cột đầu tiên).</div>
        <div class="ci-errors" id="siErrors" style="display:none"></div>
      </div>`;
  }

  window.FISG_SUPPLIER_IMPORT = { render: render, onFile: onFile, preview: preview, run: run };
})();
