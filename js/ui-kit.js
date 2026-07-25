/* js/ui-kit.js — lớp giao diện bổ sung, nạp CUỐI CÙNG (classic script).
 * 1) Đổi tên NCC "Kimica-Navido" -> "Kimica"      5) Nút xoá nhanh trong ô tìm kiếm
 * 2) Menu hồ sơ + Đăng xuất ở header             6) Nút lên đầu trang
 * 3) Định danh màu 3 NCC (tab + rail từng dòng)  7) Bỏ chú thích hướng dẫn
 * 4) Dải trạng thái Đang chạy / Đã đóng + mốc thời gian
 */
(function () {
  "use strict";

  /* ---------- 1. Đổi tên NCC ---------- */
  const OLD_NCC = "Kimica-Navido", NEW_NCC = "Kimica";
  function renameNcc() {
    // LƯU Ý: RECORDS/LISTS/me khai báo bằng const/let -> KHÔNG nằm trên window, phải gọi trực tiếp
    try {
      if (typeof LISTS !== "undefined" && LISTS) {
        if (Array.isArray(LISTS.nccs))
          LISTS.nccs.forEach((n, i) => { if (n === OLD_NCC) LISTS.nccs[i] = NEW_NCC; });
        if (LISTS.pipelines && LISTS.pipelines[OLD_NCC]) {
          LISTS.pipelines[NEW_NCC] = LISTS.pipelines[OLD_NCC];
          delete LISTS.pipelines[OLD_NCC];
        }
        if (LISTS.groupOf) Object.keys(LISTS.groupOf).forEach(k => {});
      }
      if (typeof RECORDS !== "undefined")
        RECORDS.forEach(r => { if (r.ncc === OLD_NCC) r.ncc = NEW_NCC; });
      if (typeof ACTIVITIES !== "undefined")
        ACTIVITIES.forEach(a => { if (a.ncc === OLD_NCC) a.ncc = NEW_NCC; });
      if (typeof nccFilter !== "undefined" && nccFilter === OLD_NCC) nccFilter = NEW_NCC;
      // tab đã render trước đó -> đổi nhãn hiển thị
      document.querySelectorAll('.ncc-tab[data-ncc="' + OLD_NCC + '"]').forEach(t => {
        t.dataset.ncc = NEW_NCC;
        t.textContent = NEW_NCC;
        t.setAttribute("onclick", "setNcc('" + NEW_NCC + "')");
      });
    } catch (e) {}
  }

  /* ---------- 3. Bảng màu định danh NCC ---------- */
  const NCC_COLOR = { "Roquette": "#1E3A8A", "IFF": "#0D9488", "Kimica": "#7C3AED" };
  const FALLBACK = ["#B45309", "#0B4F9E", "#DB2777"];
  function colorOf(ncc, i) { return NCC_COLOR[ncc] || FALLBACK[(i || 0) % FALLBACK.length]; }
  function tint(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  function paintTabs() {
    document.querySelectorAll(".ncc-tab").forEach((t, i) => {
      const c = colorOf(t.dataset.ncc, i);
      t.style.setProperty("--ncc", c);
      t.style.setProperty("--ncc-soft", tint(c, .10));
      t.style.setProperty("--ncc-border", tint(c, .35));
    });
  }
  function paintRows() {
    const byId = {};
    const recs = (typeof RECORDS !== "undefined" && RECORDS) || [];
    recs.forEach(r => { byId[r.id] = r; });
    document.querySelectorAll(".row[onclick]").forEach(el => {
      const m = (el.getAttribute("onclick") || "").match(/openDetail\('([^']+)'\)/);
      const rec = m && byId[m[1]];
      if (rec) el.style.setProperty("--row-ncc", colorOf(rec.ncc));
    });
  }

  /* ---------- 4. Dải trạng thái + đếm theo mốc thời gian ---------- */
  const SUB_COLOR = {
    overdue: "#DC2626", thisq: "#B45309", nextq: "#B45309",
    thisyear: "#1E3A8A", later: "#697082",
    "closed-won": "#157F3C", "closed-lost": "#B91C46",
  };
  function paintStatus() {
    document.querySelectorAll(".major").forEach(mEl => {
      const head = mEl.querySelector(".major-head");
      if (!head) return;
      const title = (head.querySelector(".m-title") || {}).textContent || "";
      const closed = /ĐÃ ĐÓNG|CLOSED/i.test(title);
      const c = closed ? "#565668" : "#1E3A8A";
      head.style.setProperty("--major", c);
      head.style.setProperty("--major-soft", tint(c, .09));
    });
    document.querySelectorAll(".sub").forEach(sEl => {
      const head = sEl.querySelector(".sub-head");
      if (!head) return;
      // suy ra mốc từ hàm collapse: collapsed['sub-<id>']
      const m = (head.getAttribute("onclick") || "").match(/collapsed\['sub-([^']+)'\]/);
      const id = m && m[1];
      if (!id) return;
      head.dataset.sub = id;
      const c = SUB_COLOR[id] || "#697082";
      head.style.setProperty("--sub", c);
      head.style.setProperty("--sub-soft", tint(c, .12));
      head.style.setProperty("--sub-border", tint(c, .3));
      // gắn số lượng cạnh tiêu đề (một lần)
      const t = head.querySelector(".s-title");
      if (t && !t.querySelector(".sub-count")) {
        const n = sEl.querySelectorAll(".row").length;
        if (n) {
          const b = document.createElement("span");
          b.className = "sub-count"; b.textContent = n;
          t.appendChild(b);
        }
      }
    });
  }

  /* ---------- 2. Menu hồ sơ + Đăng xuất ---------- */
  function signOut() {
    try { localStorage.removeItem("fisg_lang"); } catch (e) {}
    const done = () => location.reload();
    try {
      const a = window.FISG_AUTH && FISG_AUTH.init && FISG_AUTH.init();
      const acc = window.FISG_AUTH && FISG_AUTH.account && FISG_AUTH.account();
      if (a && acc && a.logoutPopup) { a.logoutPopup({ account: acc }).then(done, done); return; }
    } catch (e) {}
    done();
  }

  function buildProfile() {
    const header = document.querySelector(".gheader");
    const av = document.getElementById("hAvatar");
    if (!header || !av || document.querySelector(".profile-wrap")) return;
    const me0 = (typeof me !== "undefined" && me) || {};
    const wrap = document.createElement("div");
    wrap.className = "profile-wrap";
    const btn = document.createElement("button");
    btn.className = "profile-btn"; btn.type = "button";
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Tài khoản");
    av.parentNode.insertBefore(wrap, av);
    btn.appendChild(av);                       // dùng lại avatar sẵn có
    btn.insertAdjacentHTML("beforeend",
      '<svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>');
    const menu = document.createElement("div");
    menu.className = "profile-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML =
      '<div class="profile-id">' +
        '<span class="avatar" id="pmAv" style="width:36px;height:36px;font-size:12px"></span>' +
        '<span><b id="pmName"></b><small id="pmMail"></small>' +
        '<span class="profile-role" id="pmRole"></span></span>' +
      '</div><hr>' +
      '<button class="profile-act" id="pmOut" role="menuitem" type="button">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h5"/></svg>' +
        'Đăng xuất</button>';
    wrap.appendChild(btn); wrap.appendChild(menu);

    const fill = () => {
      const m = (typeof me !== "undefined" && me) || me0;
      const nm = m.name || "—";
      menu.querySelector("#pmName").textContent = nm;
      menu.querySelector("#pmMail").textContent = m.email || "";
      menu.querySelector("#pmRole").textContent =
        window.roleVI ? roleVI(m.role) : (m.role || "");
      const pa = menu.querySelector("#pmAv");
      pa.textContent = window.initials ? initials(nm) : nm.slice(0, 2).toUpperCase();
      pa.style.background = m.color || "#1E3A8A";
    };
    btn.onclick = e => {
      e.stopPropagation();
      const open = wrap.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) fill();
    };
    menu.querySelector("#pmOut").onclick = signOut;
    document.addEventListener("click", e => {
      if (!wrap.contains(e.target)) { wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
    fill();
  }

  /* ---------- 5. Nút xoá nhanh trong ô tìm kiếm ---------- */
  function addClears() {
    const targets = [
      { sel: "#q", box: ".gsearch", after: () => window.render && render() },
      { sel: "#insQ", box: ".ins-wrap", after: () => window.insSuggest && insSuggest() },
      { sel: "#f-cust" }, { sel: "#f-prod" }, { sel: "#f-app" }, { sel: "#a-cust" },
    ];
    targets.forEach(t => {
      const input = document.querySelector(t.sel);
      if (!input || input.dataset.clearReady) return;
      input.dataset.clearReady = "1";
      const box = (t.box && input.closest(t.box)) || input.parentElement;
      if (!box) return;
      box.classList.add("has-clear");
      if (getComputedStyle(box).position === "static") box.style.position = "relative";
      const x = document.createElement("button");
      x.className = "clear-x"; x.type = "button"; x.setAttribute("aria-label", "Xoá nội dung tìm");
      x.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        input.value = ""; box.classList.remove("filled");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (t.after) t.after();
        input.focus();
      };
      box.appendChild(x);
      const sync = () => box.classList.toggle("filled", !!input.value);
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
      sync();
    });
  }

  /* ---------- 6. Nút lên đầu trang ---------- */
  function scroller() {
    const main = document.querySelector(".main");
    if (main && main.scrollHeight > main.clientHeight + 40) return main;
    return document.scrollingElement || document.documentElement;
  }
  function backToTop() {
    if (document.getElementById("toTop")) return;
    const b = document.createElement("button");
    b.id = "toTop"; b.type = "button"; b.title = "Lên đầu trang";
    b.setAttribute("aria-label", "Lên đầu trang");
    b.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(b);
    let smooth = true;
    try { smooth = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
    b.onclick = () => {
      const el = scroller();
      el.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    };
    const onScroll = () => {
      const el = scroller();
      const y = Math.max(el.scrollTop || 0, window.scrollY || 0);
      b.classList.toggle("show", y > 260);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const main = document.querySelector(".main");
    if (main) main.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 7. Bỏ chú thích hướng dẫn ---------- */
  const HINTS = [
    "di chuột lên điểm để xem chi tiết", "click để lọc funnel",
    "click một nhóm để xem 13 segment bên trong", "click để xem chi tiết",
    "click để mở dự án", "click segment để xem lịch sử dự án",
    "Chọn một khách hàng, phân khúc hoặc sales để xem toàn bộ lịch sử dự án theo timeline.",
  ];
  function stripHints() {
    document.querySelectorAll(".card small, .cardhead small, small, .ins-wrap p").forEach(el => {
      const t = (el.textContent || "").trim();
      if (!HINTS.some(h => t === h || t.startsWith(h))) return;
      if (el.id) el.style.display = "none";      // có id -> code khác còn dùng, chỉ ẩn
      else el.remove();
    });
    // #segHint bị code dashboard gán textContent -> ẩn, KHÔNG xoá (xoá sẽ gây lỗi null)
    const seg = document.getElementById("segHint");
    if (seg) seg.style.display = "none";
    const ins = document.getElementById("insQ");
    if (ins) ins.placeholder = "Tìm khách hàng, sản phẩm, phân khúc, sales, giai đoạn";
    const q = document.getElementById("q");
    if (q) q.placeholder = "Lọc nhanh funnel";
  }

  /* ---------- gắn vào vòng đời app ---------- */
  function afterRender() { paintRows(); paintStatus(); }
  function wrap(name, fn) {
    const orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function () {
      const out = orig.apply(this, arguments);
      try { fn(); } catch (e) {}
      return out;
    };
  }

  function safe(fn) { try { fn(); } catch (e) { console.warn("[ui-kit]", e && e.message); } }

  function boot() {
    safe(renameNcc);
    safe(stripHints);
    safe(backToTop);
    wrap("render", afterRender);
    wrap("renderActs", () => { paintRows(); addClears(); });
    wrap("renderDash", () => { stripHints(); paintRows(); });
    wrap("setNcc", () => { paintTabs(); paintRows(); });
    wrap("loginAs", () => {
      safe(renameNcc); safe(paintTabs); safe(buildProfile);
      safe(addClears); safe(stripHints); safe(afterRender);
    });
    wrap("openForm", addClears);
    wrap("openActForm", addClears);
    // dữ liệu SharePoint tải sau -> đổi tên + tô lại
    if (window.FISG_STORE && FISG_STORE.syncFromGraph) {
      const s = FISG_STORE.syncFromGraph;
      FISG_STORE.syncFromGraph = async function () {
        const ok = await s.apply(this, arguments);
        renameNcc();
        if (window.render) render();
        paintTabs(); afterRender();
        return ok;
      };
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
