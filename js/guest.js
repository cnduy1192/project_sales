/* js/guest.js — Chế độ KHÁCH (chỉ xem) bằng KEY ID.
 * Khách đăng nhập bằng tài khoản O365 dành riêng -> nhập KEY -> chỉ xem đúng phạm vi được chia sẻ.
 * Khoá ghi 2 lớp: ẩn nút bằng CSS (body.guest-mode) + ghi đè hàm ghi thành no-op. */
(function () {
  "use strict";
  let STATE = null;              // {key, ncc, scope, codes[], expiry, note}
  let wrongs = 0, lockUntil = 0;

  const cfg = () => window.FISG_CFG || {};
  const guestEmails = () => (cfg().GUEST_EMAILS || []).map(e => String(e).toLowerCase());
  const viDay = s => s ? new Date(s).toLocaleDateString("vi-VN") : "—";
  const isGuestEmail = m => !!m && guestEmails().includes(String(m).toLowerCase());

  window.FISG_IS_GUEST = () => !!STATE;

  /* ---------- Màn nhập KEY ---------- */
  function screen() {
    let el = document.getElementById("guestGate");
    if (el) return el;
    el = document.createElement("div");
    el.id = "guestGate"; el.className = "guest-gate";
    el.innerHTML =
      '<div class="gg-card glass" role="dialog" aria-modal="true" aria-labelledby="ggT">' +
        '<div class="gg-brand"><span class="gg-logo">FI</span><span>FI SAIGON <b>JSC</b></span></div>' +
        '<h2 id="ggT">Nhập mã chia sẻ</h2>' +
        '<p class="gg-sub">Mã do nhân viên FI SAIGON cung cấp.</p>' +
        '<input id="ggKey" class="gg-key" maxlength="12" inputmode="numeric" autocomplete="off" ' +
          'spellcheck="false" aria-label="Mã chia sẻ" placeholder="––––––">' +
        '<p class="gg-msg" id="ggMsg" role="status"></p>' +
        '<button type="button" class="gg-btn" id="ggGo">Xem dự án</button>' +
        '<button type="button" class="gg-out" id="ggOut">Thoát</button>' +
      '</div>';
    document.body.appendChild(el);
    const key = el.querySelector("#ggKey");
    el.querySelector("#ggGo").onclick = submit;
    el.querySelector("#ggOut").onclick = () => location.reload();
    key.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    key.addEventListener("input", () => { key.value = key.value.replace(/[^A-Za-z0-9]/g, ""); });
    setTimeout(() => key.focus(), 80);
    return el;
  }
  const msg = (t, err) => {
    const m = document.getElementById("ggMsg");
    if (m) { m.textContent = t || ""; m.className = "gg-msg" + (err ? " err" : ""); }
  };

  async function submit() {
    const now = Date.now();
    if (now < lockUntil) {
      msg("Nhập sai nhiều lần. Thử lại sau " + Math.ceil((lockUntil - now) / 1000) + " giây.", true);
      return;
    }
    const k = (document.getElementById("ggKey").value || "").trim();
    if (!k) { msg("Nhập mã chia sẻ.", true); return; }
    const go = document.getElementById("ggGo");
    if (go) go.disabled = true;
    msg("Đang kiểm tra…");
    try {
      const ok = await openWithKey(k);
      if (!ok && go) go.disabled = false;
    } catch (e) { if (go) go.disabled = false; }
  }

  /* Mở bằng KEY — KHÔNG cần đăng nhập: lấy bản chụp từ Share Gateway (Cloudflare Worker).
     Nếu đang đăng nhập nội bộ thì vẫn cho phép tra qua SharePoint (dự phòng). */
  async function openWithKey(k) {
    const hasWorker = !!(window.FISG_CFG && FISG_CFG.SHARE_WORKER_URL);
    const loggedIn = !!(window.FISG_AUTH && FISG_AUTH.account && FISG_AUTH.account());
    if (!hasWorker && !loggedIn) {
      msg("Chưa cấu hình máy chủ chia sẻ. Báo lại FI SAIGON.", true);
      return false;
    }
    // (1) đường chính: Worker công khai
    if (hasWorker) try {
      const d = await FISG_SHARE_NET.workerGet(k);
      const meta = d.meta || {};
      STATE = {
        key: k, ncc: meta.ncc || "", scope: meta.scope || "Toàn bộ NCC",
        codes: [], expiry: d.expiry || "", note: meta.note || "", fromWorker: true,
      };
      loadSnapshot(d.data || {});
      finish();
      return true;
    } catch (e) {
      if (e.status === 410) { msg(e.message || "Mã đã hết hạn.", true); return false; }
      if (e.status && e.status !== 404) { msg(e.message || "Không tải được dữ liệu.", true); return false; }
      if (e.status !== 404 && !/HTTP|Chưa cấu hình/.test(e.message || "")) {
        msg("Không kết nối được máy chủ chia sẻ.", true); return false;
      }
      // 404 -> thử tiếp cách 2
    }
    // (2) dự phòng: đang đăng nhập nội bộ thì tra thẳng list Shares
    if (window.FISG_AUTH && FISG_AUTH.account && FISG_AUTH.account()) {
      try {
        const list = await FISG_SHARE.fetchShares();
        const s = list.find(x => x.key.toLowerCase() === k.toLowerCase());
        if (s) {
          if (!s.active) { msg("Mã này đã bị thu hồi.", true); return false; }
          if (s.expiry && s.expiry < new Date().toISOString().slice(0, 10)) {
            msg("Mã đã hết hạn ngày " + viDay(s.expiry) + ".", true); return false;
          }
          STATE = s; finish(); return true;
        }
      } catch (e) {}
    }
    wrongs++;
    if (wrongs >= 5) { lockUntil = Date.now() + 30000; wrongs = 0; msg("Sai quá 5 lần. Chờ 30 giây.", true); }
    else msg("Mã không đúng.", true);
    return false;
  }

  // nạp bản chụp vào bộ nhớ app (khách không có SharePoint)
  function loadSnapshot(data) {
    const recs = data.records || [];
    if (typeof RECORDS !== "undefined") {
      RECORDS.length = 0;
      recs.forEach(r => { r.related = r.related || []; r.comments = r.comments || []; RECORDS.push(r); });
    }
    if (typeof ACTIVITIES !== "undefined") ACTIVITIES.length = 0;
    const L = data.lists || {};
    if (typeof LISTS !== "undefined" && L.pipelines) {
      if (L.pipelines) Object.keys(L.pipelines).forEach(k => { LISTS.pipelines[k] = L.pipelines[k]; });
      if (L.groupOf) Object.assign(LISTS.groupOf, L.groupOf);
      if (L.probOf) Object.assign(LISTS.probOf, L.probOf);
    }
    const nccs = [...new Set(recs.map(r => r.ncc).filter(Boolean))];
    if (typeof nccFilter !== "undefined" && nccs.length && !nccs.includes(nccFilter)) nccFilter = nccs[0];
  }

  function finish() {
    const gate = document.getElementById("guestGate");
    if (gate) gate.remove();
    applyGuest();
  }

  /* ---------- Áp chế độ khách ---------- */
  function filterData() {
    if (!STATE) return;
    const keep = r => {
      if (STATE.scope === "Tất cả NCC") return true;
      if (r.ncc !== STATE.ncc) return false;
      if (STATE.scope === "Chọn dự án") return STATE.codes.includes(r.id);
      return true;
    };
    if (typeof RECORDS !== "undefined") {
      const kept = RECORDS.filter(keep);
      RECORDS.length = 0; kept.forEach(r => RECORDS.push(r));
    }
    if (typeof ACTIVITIES !== "undefined") ACTIVITIES.length = 0;   // khách không xem hoạt động
    if (typeof nccFilter !== "undefined" && STATE.ncc) nccFilter = STATE.ncc;
  }

  function lockWrites() {
    const deny = () => { if (window.toast) toast("Chế độ khách: chỉ xem, không chỉnh sửa."); };
    ["openForm", "saveForm", "openCloseModal", "confirmClose", "pickResult", "openProbPop",
     "setProb", "postComment", "saveDetail", "openActForm", "saveAct", "createProjectFromAct",
     "attachAct", "addRel", "rmRel", "dAddRel", "dRmRel", "setRole", "toggleAI"
    ].forEach(fn => { if (typeof window[fn] === "function") window[fn] = deny; });
    if (window.FISG_SHARE) FISG_SHARE.open = deny;
  }

  function banner() {
    if (document.getElementById("guestBar")) return;
    const what = STATE.scope === "Tất cả NCC" ? "Tất cả nhà cung cấp"
      : STATE.scope === "Chọn dự án" ? STATE.codes.length + " dự án · " + STATE.ncc
      : "Toàn bộ dự án · " + STATE.ncc;
    const b = document.createElement("div");
    b.id = "guestBar"; b.className = "guest-bar";
    b.innerHTML =
      '<span class="gb-tag">Chế độ khách · chỉ xem</span>' +
      '<span class="gb-scope">' + what + '</span>' +
      (STATE.expiry ? '<span class="gb-exp">Hết hạn ' + viDay(STATE.expiry) + "</span>" : "") +
      '<button type="button" class="gb-out" id="gbOut">Thoát</button>';
    document.body.prepend(b);
    document.getElementById("gbOut").onclick = () => location.reload();
  }

  function applyGuest() {
    document.body.classList.add("guest-mode");
    // đảm bảo có "người dùng hiện tại" (nếu vào thẳng chế độ khách mà chưa qua loginAs)
    try {
      if (typeof me === "undefined" || !me)
        me = { name: "Khách", email: "", role: "guest", pic: null, color: "#6D28D9" };
      const app = document.getElementById("app"), lg = document.getElementById("login");
      if (app) app.style.display = "block";
      if (lg) lg.style.display = "none";
    } catch (e) {}
    filterData();
    lockWrites();
    banner();
    // ẩn module nội bộ
    ["acts", "users"].forEach(v => {
      const n = document.querySelector('.nav-item[data-view="' + v + '"]');
      if (n) n.style.display = "none";
    });
    const lbl = document.getElementById("navAdminLabel");
    if (lbl) lbl.style.display = "none";
    if (typeof me !== "undefined" && me) me.role = "guest";
    if (window.go) go("funnel");
    if (window.render) render();
    if (window.renderDash) renderDash();
    if (window.toast) toast("Đang xem ở chế độ khách — chỉ xem.");
  }

  /* ---------- Nhận diện khách sau khi đăng nhập ---------- */
  async function afterLogin(email) {
    if (!isGuestEmail(email)) return false;
    const app = document.getElementById("app");
    if (app) app.style.display = "none";
    const login = document.getElementById("login");
    if (login) login.style.display = "none";
    screen();
    return true;
  }
  window.FISG_GUEST = { afterLogin, applyGuest, state: () => STATE, screen };

  /* ---------- Nút "Khách xem chia sẻ" ở màn đăng nhập ---------- */
  function addLoginButton() {
    const card = document.querySelector("#login .login-card");
    const msBtn = document.querySelector(".ms-btn");
    if (!card || !msBtn || document.getElementById("btnGuest")) return;
    const b = document.createElement("button");
    b.id = "btnGuest"; b.type = "button"; b.className = "guest-btn";
    b.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>' +
      ' Khách xem chia sẻ';
    b.onclick = () => screen();          // mở thẳng popup nhập KEY — KHÔNG đăng nhập
    msBtn.parentNode.insertBefore(b, msBtn.nextSibling);
  }

  // link dạng ...?key=123456 -> mở sẵn popup và điền mã
  function fromUrl() {
    let k = "";
    try { k = new URLSearchParams(location.search).get("key") || ""; } catch (e) {}
    if (!k) return;
    screen();
    const i = document.getElementById("ggKey");
    if (i) { i.value = k.replace(/[^A-Za-z0-9]/g, ""); setTimeout(submit, 120); }
  }

  function boot() {
    addLoginButton();
    setTimeout(addLoginButton, 400);
    fromUrl();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
