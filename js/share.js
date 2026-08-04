/* js/share.js — Chia sẻ dự án cho khách bằng KEY ID (phía nhân viên).
 * Lưu bản ghi vào list SharePoint `Shares`. Không dùng cho chế độ khách (xem guest.js). */
(function () {
  "use strict";
  const LIST = () => (window.FISG_CFG && FISG_CFG.SHARES_LIST) || "Shares";

  function live() {
    return window.FISG_GRAPH && window.FISG_AUTH && FISG_AUTH.account();
  }
  const pad2 = n => String(n).padStart(2, "0");
  const isoDay = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const viDay = s => s ? new Date(s).toLocaleDateString("vi-VN") : "—";

  /* ---------- Nguồn sổ mã: ưu tiên Worker (không cần list SharePoint) ---------- */
  async function fetchShares() {
    try {
      const w = await workerList();
      if (w) return w;
    } catch (e) { console.warn("[share] worker /list:", e.message); }
    return fetchSharesFromSP();
  }

  async function workerList() {
    const base = workerUrl();
    if (!base || !writeKey()) return null;
    const r = await fetch(base + "/list", { headers: { "X-Write-Key": writeKey() } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
    return (d.shares || []).map(s => {
      const m = s.meta || {};
      return {
        spId: null, key: String(s.key || ""), ncc: m.ncc || "",
        scope: m.scope || "Toàn bộ NCC", codes: [],
        expiry: s.expiry || "", active: !s.expired, note: m.note || "",
        count: s.count || 0, fromWorker: true,
      };
    });
  }

  /* ---------- Dự phòng: list SharePoint (nếu có) ---------- */
  async function fetchSharesFromSP() {
    if (!live()) return [];
    let items = [];
    try { items = await FISG_GRAPH.listItems(LIST()); }
    catch (e) { return []; }        // chưa có list Shares -> coi như sổ rỗng, KHÔNG báo lỗi
    const supMap = {};
    try {
      (await FISG_GRAPH.listItems("Suppliers")).forEach(s => {
        supMap[String(s.id)] = (s.fields || {}).Title;
      });
    } catch (e) {}
    return items.map(it => {
      const f = it.fields || {};
      return {
        spId: it.id, key: String(f.Title || ""),
        ncc: f.Supplier || supMap[String(f.SupplierLookupId || "")] || "",
        scope: f.ShareScope || "Toàn bộ NCC",
        codes: (f.ProjectCodes || "").split(",").map(s => s.trim()).filter(Boolean),
        expiry: (f.ExpiryDate || "").slice(0, 10),
        active: f.IsActive !== false,
        note: f.GuestNote || "",
      };
    });
  }

  async function createShare(data) {
    const sup = data.ncc
      ? (await FISG_GRAPH.listItems("Suppliers")).find(s => (s.fields || {}).Title === data.ncc)
      : null;
    const fields = {
      Title: data.key,
      ShareScope: data.scope,
      ProjectCodes: (data.codes || []).join(","),
      ExpiryDate: data.expiry ? data.expiry + "T00:00:00Z" : null,
      IsActive: true,
      GuestNote: data.note || "",
    };
    if (sup) fields.SupplierLookupId = sup.id;
    Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k]; });
    return FISG_GRAPH.createItem(LIST(), fields);
  }

  async function revoke(spId, key) {
    if (key) await workerDelete(key);                       // xoá dữ liệu khách đang xem
    if (spId && live()) {
      try { await FISG_GRAPH.updateItem(LIST(), spId, { IsActive: false }); } catch (e) {}
    }
    return true;
  }

  /* ---------- Cloudflare Worker: khách xem KHÔNG cần đăng nhập ---------- */
  const workerUrl = () => String((window.FISG_CFG && FISG_CFG.SHARE_WORKER_URL) || "").replace(/\/+$/, "");
  const WKEY = "fisg_share_write_key";
  const writeKey = () => { try { return localStorage.getItem(WKEY) || ""; } catch (e) { return ""; } };
  function setWriteKey(v) { try { localStorage.setItem(WKEY, v || ""); } catch (e) {} }

  // Bản chụp: dữ liệu đủ để app hiển thị mà không cần SharePoint
  function buildSnapshot(scope, ncc, codes) {
    const recs = (typeof RECORDS !== "undefined" ? RECORDS : []).filter(r => {
      if (scope === "Tất cả NCC") return true;
      if (r.ncc !== ncc) return false;
      if (scope === "Chọn dự án") return codes.includes(r.id);
      return true;
    });
    const L = (typeof LISTS !== "undefined" && LISTS) || {};
    return {
      records: JSON.parse(JSON.stringify(recs)),
      lists: {
        nccs: L.nccs || [], pipelines: L.pipelines || {}, groupOf: L.groupOf || {},
        probOf: L.probOf || {}, segTree: L.segTree || {}, segments: L.segments || [],
      },
    };
  }

  async function workerPut(key, payload, expiry, meta) {
    const base = workerUrl();
    if (!base) throw new Error("Chưa cấu hình SHARE_WORKER_URL trong js/sp-config.js");
    if (!writeKey()) throw new Error("NO_WRITE_KEY");
    const r = await fetch(base + "/s/" + encodeURIComponent(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Write-Key": writeKey() },
      body: JSON.stringify({ meta, expiry, data: payload }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ("Worker HTTP " + r.status));
    return d;
  }
  async function workerDelete(key) {
    const base = workerUrl();
    if (!base || !writeKey()) return;
    await fetch(base + "/s/" + encodeURIComponent(key),
      { method: "DELETE", headers: { "X-Write-Key": writeKey() } });
  }
  async function workerGet(key) {
    const base = workerUrl();
    if (!base) throw new Error("Chưa cấu hình đường dẫn chia sẻ.");
    const r = await fetch(base + "/s/" + encodeURIComponent(key));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
    return d;
  }

  // hỏi mã ghi (1 lần/máy), theo đúng kiểu cấu hình gateway AI sẵn có
  async function ensureWriteKey() {
    if (writeKey()) return true;
    const v = window.prompt(
      "Nhập mã ghi của Share Gateway (WRITE_KEY đã đặt trong Cloudflare Worker).\n" +
      "Chỉ cần nhập một lần trên máy này.");
    if (!v) return false;
    setWriteKey(v.trim());
    return true;
  }

  async function genKey() {
    let existing = [];
    try { existing = (await fetchShares()).map(s => s.key); } catch (e) {}
    for (let i = 0; i < 50; i++) {
      const k = String(Math.floor(100000 + Math.random() * 900000));
      if (!existing.includes(k)) return k;
    }
    return String(Date.now()).slice(-6);
  }

  /* ---------- Modal chia sẻ ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function ensureModal() {
    if (document.getElementById("shareOv")) return;
    const ov = document.createElement("div");
    ov.id = "shareOv"; ov.className = "share-ov";
    ov.innerHTML =
      '<div class="share-modal glass" role="dialog" aria-modal="true" aria-labelledby="shTitle">' +
        '<div class="share-head"><h3 id="shTitle">Chia sẻ dự án cho khách</h3>' +
          '<button class="share-close" id="shX" type="button" aria-label="Đóng">×</button></div>' +
        '<div class="share-body" id="shBody"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    document.getElementById("shX").onclick = close;
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && ov.classList.contains("open")) close();
    });
  }
  function close() {
    const ov = document.getElementById("shareOv");
    if (ov) ov.classList.remove("open");
  }

  async function open() {
    // Chia sẻ chạy qua Share Gateway (Worker), không phụ thuộc SharePoint.
    if (!workerUrl() && !live()) {
      if (window.toast) toast("Chưa cấu hình SHARE_WORKER_URL trong js/sp-config.js.");
      return;
    }
    if (!(typeof RECORDS !== "undefined" && RECORDS.length)) {
      if (window.toast) toast("Chưa có dữ liệu dự án để chia sẻ.");
      return;
    }
    ensureModal();
    const ov = document.getElementById("shareOv");
    const body = document.getElementById("shBody");
    ov.classList.add("open");
    body.innerHTML = '<div class="share-loading">Đang chuẩn bị…</div>';

    const key = await genKey();
    const nccs = (typeof NCCS !== "undefined" ? NCCS : []).slice();
    /* Link chia sẻ luôn theo một NCC cụ thể — "Tất cả" không phải phạm vi hợp lệ. */
    const cur = (typeof formNcc === "function" && formNcc())
      || (typeof nccFilter !== "undefined" && nccFilter) || nccs[0] || "";
    const exp = new Date(); exp.setDate(exp.getDate() + 30);

    body.innerHTML =
      '<div class="share-grid">' +
        '<label class="sh-f"><span>Phạm vi</span>' +
          '<select id="shScope">' +
            '<option value="Toàn bộ NCC">Toàn bộ dự án của 1 nhà cung cấp</option>' +
            '<option value="Chọn dự án">Chọn từng dự án</option>' +
            '<option value="Tất cả NCC">Toàn bộ dự án của tất cả nhà cung cấp</option>' +
          '</select></label>' +
        '<label class="sh-f" id="shNccF"><span>Nhà cung cấp</span>' +
          '<select id="shNcc">' + nccs.map(n =>
            `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("") + '</select></label>' +
        '<label class="sh-f"><span>Hết hạn</span>' +
          `<input type="date" id="shExp" value="${isoDay(exp)}"></label>` +
        '<label class="sh-f"><span>Chia sẻ cho (ghi chú)</span>' +
          '<input id="shNote" placeholder="Tên khách hoặc công ty"></label>' +
      '</div>' +
      '<div class="sh-picker" id="shPicker" hidden>' +
        '<div class="sh-picker-head"><b>Chọn dự án</b>' +
          '<span><button type="button" class="sh-mini" id="shAll">Chọn tất cả</button>' +
          '<button type="button" class="sh-mini" id="shNone">Bỏ chọn</button></span></div>' +
        '<div class="sh-picker-list" id="shList"></div></div>' +
      '<div class="sh-key-row">' +
        '<label class="sh-f sh-keyf"><span>KEY ID cho khách</span>' +
          `<input id="shKey" value="${key}" maxlength="12" autocomplete="off" spellcheck="false"></label>` +
        '<button type="button" class="sh-mini" id="shGen">Tạo mã khác</button>' +
      '</div>' +
      '<p class="sh-hint" id="shMsg">Mã 6 chữ số, hoặc tự đặt 4–12 ký tự (chữ và số).</p>' +
      '<div class="sh-actions">' +
        '<button type="button" class="sh-btn ghost" id="shCancel">Huỷ</button>' +
        '<button type="button" class="sh-btn primary" id="shSave">Tạo mã chia sẻ</button>' +
      '</div>';

    const $ = id => document.getElementById(id);
    const renderPicker = () => {
      const ncc = $("shNcc").value;
      const rows = (typeof RECORDS !== "undefined" ? RECORDS : []).filter(r => r.ncc === ncc);
      $("shList").innerHTML = rows.length
        ? rows.map(r => `<label class="sh-item"><input type="checkbox" value="${esc(r.id)}">` +
            `<span><b>${esc(r.customer)}</b><small>${esc(r.id)} · ${esc(r.stage || "")}</small></span></label>`).join("")
        : '<div class="sh-empty">Không có dự án nào của nhà cung cấp này.</div>';
    };
    const syncScope = () => {
      const s = $("shScope").value;
      $("shNccF").style.display = (s === "Tất cả NCC") ? "none" : "";
      const pick = s === "Chọn dự án";
      $("shPicker").hidden = !pick;
      if (pick) renderPicker();
    };
    $("shScope").onchange = syncScope;
    $("shNcc").onchange = () => { if (!$("shPicker").hidden) renderPicker(); };
    $("shAll").onclick = () => $("shList").querySelectorAll("input").forEach(c => c.checked = true);
    $("shNone").onclick = () => $("shList").querySelectorAll("input").forEach(c => c.checked = false);
    $("shGen").onclick = async () => { $("shKey").value = await genKey(); };
    $("shCancel").onclick = close;
    syncScope();

    $("shSave").onclick = async () => {
      const k = $("shKey").value.trim();
      const msg = $("shMsg");
      if (!/^[A-Za-z0-9]{4,12}$/.test(k)) {
        msg.textContent = "KEY phải gồm 4–12 ký tự chữ hoặc số."; msg.className = "sh-hint err"; return;
      }
      const scope = $("shScope").value;
      const codes = scope === "Chọn dự án"
        ? [...$("shList").querySelectorAll("input:checked")].map(c => c.value) : [];
      if (scope === "Chọn dự án" && !codes.length) {
        msg.textContent = "Chọn ít nhất một dự án."; msg.className = "sh-hint err"; return;
      }
      const ncc = scope === "Tất cả NCC" ? "" : $("shNcc").value;
      const expiry = $("shExp").value;
      if (!workerUrl()) {
        msg.innerHTML = 'Chưa cấu hình <b>SHARE_WORKER_URL</b> trong <code>js/sp-config.js</code>. ' +
                        'Deploy Share Gateway theo <code>FISG_Share_Worker.js</code> rồi dán URL vào đó.';
        msg.className = "sh-hint err"; return;
      }
      $("shSave").disabled = true; msg.textContent = "Đang lưu…"; msg.className = "sh-hint";
      try {
        let all = [];
        try { all = await fetchShares(); } catch (e) { all = []; }
        if (all.some(s => s.key === k && s.active)) {
          msg.textContent = "KEY này đang được dùng. Chọn mã khác."; msg.className = "sh-hint err";
          $("shSave").disabled = false; return;
        }
        // 1) đẩy bản chụp lên Worker -> khách xem KHÔNG cần đăng nhập
        if (!(await ensureWriteKey())) {
          msg.textContent = "Cần mã ghi để tạo link cho khách."; msg.className = "sh-hint err";
          $("shSave").disabled = false; return;
        }
        msg.textContent = "Đang đẩy dữ liệu cho khách…";
        await workerPut(k, buildSnapshot(scope, ncc, codes), expiry,
          { scope, ncc, note: $("shNote").value.trim(), count: codes.length });
        // 2) (tuỳ chọn) ghi thêm vào list SharePoint nếu có — Worker đã tự giữ sổ quản lý
        if (live()) {
          try {
            await createShare({ key: k, ncc, scope, codes, expiry, note: $("shNote").value.trim() });
          } catch (e) { console.warn("[share] bỏ qua list Shares:", e.message); }
        }
        showResult(k, scope, ncc, expiry, codes.length);
      } catch (e) {
        const m = (e.message === "NO_WRITE_KEY")
          ? "Chưa có mã ghi Worker." : "Lưu lỗi: " + (e.message || e);
        msg.textContent = m; msg.className = "sh-hint err";
        $("shSave").disabled = false;
      }
    };
  }

  function showResult(key, scope, ncc, exp, n) {
    const what = scope === "Tất cả NCC" ? "tất cả nhà cung cấp"
      : scope === "Chọn dự án" ? `${n} dự án của ${ncc}` : `toàn bộ dự án của ${ncc}`;
    const link = location.origin + location.pathname + "?key=" + encodeURIComponent(key);
    document.getElementById("shBody").innerHTML =
      '<div class="sh-done">' +
        '<div class="sh-done-ico" aria-hidden="true">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
        '</div>' +
        '<p class="sh-done-t">Đã tạo mã chia sẻ</p>' +
        `<div class="sh-key" id="shKeyOut">${esc(key)}</div>` +
        '<div class="sh-copy-row">' +
          '<button type="button" class="sh-btn primary" id="shCopy">Sao chép mã</button>' +
          '<button type="button" class="sh-btn ghost" id="shCopyLink">Sao chép link</button>' +
        '</div>' +
        `<p class="sh-done-d">Khách xem được <b>${esc(what)}</b>, hết hạn <b>${viDay(exp)}</b>.<br>` +
        'Khách <b>không cần đăng nhập</b> — mở link rồi nhập mã, hoặc bấm “Khách xem chia sẻ”.</p>' +
        '<button type="button" class="sh-btn ghost" id="shDone">Đóng</button>' +
      '</div>';
    document.getElementById("shDone").onclick = close;
    const copyTo = (btnId, text, label) => {
      const t = document.getElementById(btnId);
      if (!t) return;
      t.onclick = () => {
        const done = () => { t.textContent = "Đã sao chép"; setTimeout(() => t.textContent = label, 1800); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
      };
    };
    copyTo("shCopy", key, "Sao chép mã");
    copyTo("shCopyLink", link, "Sao chép link");
  }

  window.FISG_SHARE_NET = { workerGet, workerPut, workerDelete, buildSnapshot, setWriteKey };

  /* ---------- Bảng quản lý share (màn Quản trị) ---------- */
  async function renderManager() {
    const host = document.getElementById("view-users");
    if (!host) return;
    let box = document.getElementById("shareMgr");
    if (!box) {
      box = document.createElement("div");
      box.id = "shareMgr"; box.className = "card glass share-mgr";
      box.innerHTML = '<h4>Mã chia sẻ cho khách</h4><div id="shareMgrBody">Đang tải…</div>';
      host.appendChild(box);
    }
    const body = document.getElementById("shareMgrBody");
    try {
      const list = await fetchShares();
      if (!list.length) { body.innerHTML = '<div class="sh-empty">Chưa có mã chia sẻ nào.</div>'; return; }
      const today = isoDay(new Date());
      body.innerHTML =
        '<table class="sh-table"><thead><tr><th>KEY</th><th>Phạm vi</th><th>Chia sẻ cho</th><th>Hết hạn</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
        list.map(s => {
          const expired = s.expiry && s.expiry < today;
          const st = !s.active ? '<span class="pill p-lost">Đã thu hồi</span>'
            : expired ? '<span class="pill p-prog">Hết hạn</span>'
            : '<span class="pill p-won">Đang hiệu lực</span>';
          const n = s.count || s.codes.length;
          const scope = s.scope === "Tất cả NCC" ? "Tất cả NCC"
            : s.scope === "Chọn dự án" ? `${n} dự án · ${esc(s.ncc)}` : `Toàn bộ ${esc(s.ncc)}`;
          return `<tr><td><b>${esc(s.key)}</b></td><td>${scope}</td><td>${esc(s.note) || "—"}</td>` +
            `<td>${viDay(s.expiry)}</td><td>${st}</td><td>` +
            (s.active ? `<button class="sh-mini danger" data-revoke="${s.spId || ""}" data-key="${esc(s.key)}">Thu hồi</button>` : "") +
            '</td></tr>';
        }).join("") + "</tbody></table>";
      body.querySelectorAll("[data-revoke]").forEach(b => {
        b.onclick = async () => {
          b.disabled = true;
          try { await revoke(b.dataset.revoke, b.dataset.key); await renderManager(); if (window.toast) toast("Đã thu hồi mã."); }
          catch (e) { b.disabled = false; if (window.toast) toast("Thu hồi lỗi: " + e.message); }
        };
      });
    } catch (e) {
      body.innerHTML = '<div class="sh-empty">Chưa đọc được danh sách mã. Kiểm tra <b>SHARE_WORKER_URL</b> trong <code>js/sp-config.js</code> và mã ghi Worker.</div>';
    }
  }

  /* ---------- Nút Chia sẻ trên thanh công cụ ---------- */
  function addButton() {
    const bar = document.querySelector("#view-funnel .topbar");
    if (!bar || document.getElementById("btnShare")) return;
    const b = document.createElement("button");
    b.id = "btnShare"; b.type = "button"; b.className = "btn-share";
    b.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg> Chia sẻ';
    b.onclick = open;
    bar.appendChild(b);
  }

  window.FISG_SHARE = { open, close, fetchShares, createShare, revoke, genKey, renderManager, addButton };

  function boot() {
    const wrapFn = (name, fn) => {
      const o = window[name];
      if (typeof o !== "function") return;
      window[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) {} return r; };
    };
    wrapFn("loginAs", () => { setTimeout(addButton, 60); });
    wrapFn("go", () => {
      addButton();
      const v = document.getElementById("view-users");
      if (v && v.style.display !== "none") renderManager();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
