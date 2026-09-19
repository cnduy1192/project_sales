(function () {
  "use strict";
  let names = null, fileName = "";

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

    const seen = {}, uniq = [];
    out.forEach(n => { const k = n.toUpperCase(); if (!seen[k]) { seen[k] = 1; uniq.push(n); } });
    return uniq;
  }

  function onFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === "undefined") { setStatus(T("imp.noXlsx"), "err"); return; }
    fileName = f.name; setStatus(T("imp.reading", { f: f.name }));
    const reader = new FileReader();
    reader.onload = e => {
      try {
        names = parseWorkbook(XLSX.read(new Uint8Array(e.target.result), { type: "array" }));
        if (!names.length) { setStatus(T("imp.sup.noRows"), "err"); setActions(false); return; }
        setStatus(T("imp.sup.read", { n: names.length, f: f.name }));
        setActions(true, false);
      } catch (err) { setStatus(T("imp.readFail") + " " + (err.message || err), "err"); }
    };
    reader.onerror = () => setStatus(T("imp.readFailShort"), "err");
    reader.readAsArrayBuffer(f);
  }

  async function preview() {
    if (!names) return;
    setStatus(T("imp.sup.reconciling"));
    try {
      const r = await FISG_STORE.previewSupplierUpsert(names);
      setStatus(T("imp.sup.reconciled", { c: r.create, s: r.skip }), "ok");
      setActions(true, true);
    } catch (e) { setStatus(T("imp.reconcileFail") + " " + (e.message || e), "err"); }
  }

  async function run() {
    if (!names) return;
    if (typeof confirm === "function"
        && !confirm(T("imp.sup.confirm", { n: names.length }))) return;
    setActions(false);
    const bar = document.getElementById("siBar"), fill = document.getElementById("siBarFill");
    if (bar) bar.style.display = "block";
    try {
      const rep = await FISG_STORE.bulkUpsertSuppliers(names, (done, total) => {
        setStatus(T("imp.writing", { a: done, b: total }));
        if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 100) + "%";
      });
      let msg = T("imp.sup.done", { c: rep.created, s: rep.skipped });
      if (rep.failed) msg += ` · <b style="color:var(--overdue)">${T("imp.nFailed", { n: rep.failed })}</b>`;
      setStatus(msg, rep.failed ? "err" : "ok");
      if (rep.failed) {
        const box = document.getElementById("siErrors");
        if (box) { box.style.display = "block"; box.innerHTML = "<b>" + T("imp.failedRows") + "</b><br>" + rep.errors.slice(0, 40).map(x => "• " + esc(x)).join("<br>"); }
      }
      setActions(true, true);
    } catch (e) {
      setStatus(T("imp.stopped") + " " + (e.message || e), "err"); setActions(true, true);
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
    if (!(window.myCap && myCap().admin)) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <div class="ci-card glass">
        <div class="ci-head"><div>
          <b>${T("imp.sup.title")}</b>
          <p>${T("imp.sup.desc")}</p>
        </div></div>
        <div class="ci-row">
          <label class="ci-file"><input type="file" accept=".xlsx,.xls" onchange="FISG_SUPPLIER_IMPORT.onFile(this)"><span>${T("imp.pickFile")}</span></label>
          <button class="btn-ghost" id="siPreview" disabled onclick="FISG_SUPPLIER_IMPORT.preview()">${T("imp.preview")}</button>
          <button class="btn-primary" id="siRun" disabled onclick="FISG_SUPPLIER_IMPORT.run()">${T("imp.update")}</button>
        </div>
        <div class="ci-bar" id="siBar" style="display:none"><div id="siBarFill"></div></div>
        <div class="ci-status" id="siStatus">${T("imp.sup.cols")}</div>
        <div class="ci-errors" id="siErrors" style="display:none"></div>
      </div>`;
  }

  window.FISG_SUPPLIER_IMPORT = { render: render, onFile: onFile, preview: preview, run: run };
})();
