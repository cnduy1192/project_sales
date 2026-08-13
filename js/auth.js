(function () {
  const CFG = window.FISG_CFG;
  let app = null, account = null, initPromise = null;

  function build() {
    if (app) return app;
    if (!window.msal || !CFG) return null;
    app = new msal.PublicClientApplication({
      auth: {
        clientId: CFG.clientId,
        authority: "https://login.microsoftonline.com/" + CFG.tenantId,
        redirectUri: CFG.redirectUri,
      },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });
    return app;
  }

  async function ready() {
    const a = build();
    if (!a) return null;
    if (!initPromise) initPromise = a.initialize();
    await initPromise;
    return a;
  }
  function init() { return build(); }

  async function getToken(scopes) {
    const a = await ready();
    if (!a || !account) throw new Error("chưa đăng nhập Microsoft");
    try {
      const r = await a.acquireTokenSilent({ scopes: scopes || CFG.scopes, account });
      return r.accessToken;
    } catch (e) {
      const r = await a.acquireTokenPopup({ scopes: scopes || CFG.scopes });
      account = r.account; return r.accessToken;
    }
  }

  async function signIn() {
    let a = await ready();

    for (let i = 0; !a && i < 15; i++) { await new Promise(r => setTimeout(r, 200)); a = await ready(); }
    if (!a) {
      if (window.toast) toast("Chưa tải được MSAL. Tải lại trang (F5); nếu vẫn lỗi, kiểm tra mạng/chặn CDN.");
      return;
    }
    if (location.protocol === "file:") {
      if (window.toast) toast("Đăng nhập Microsoft cần chạy qua http(s) (GitHub Pages/localhost), không mở file trực tiếp.");
      return;
    }
    try {
      const r = await a.loginPopup({ scopes: CFG.scopes });
      account = r.account; a.setActiveAccount(account);
      await enter(account);
    } catch (e) {
      const msg = e.message || String(e);
      if (/redirect_uri|AADSTS50011/i.test(msg))
        toast("Redirect URI chưa khớp. Thêm '" + CFG.redirectUri + "' vào App Registration → Authentication (SPA).");
      else if (window.toast) toast("Đăng nhập lỗi: " + msg);
    }
  }

  async function enter(acc) {
    const email = (acc.username || "").toLowerCase();

    const guests = (CFG.GUEST_EMAILS || []).map(e => String(e).toLowerCase());
    if (guests.includes(email) && window.FISG_GUEST) {
      let idx = USERS.findIndex(u => (u.email || "").toLowerCase() === email);
      if (idx < 0) {
        USERS.push({ name: acc.name || "Khách", email: acc.username, role: "guest", pic: null, color: "#6D28D9" });
        idx = USERS.length - 1;
      }
      loginAs(idx);
      if (window.FISG_STORE) await FISG_STORE.syncFromGraph();
      await FISG_GUEST.afterLogin(email);
      return;
    }

    if (!window.FISG_STORE) { toast("Thiếu js/store.js — không tải được dữ liệu."); return; }
    const p = await FISG_STORE.profileFor(email, acc.name || acc.username);
    if (!p.user) {
      toast("Tài khoản " + acc.username + " chưa có trong list Users trên SharePoint. "
            + "Nhờ quản trị thêm dòng: Email · Tên PIC · Vai trò.");
      return;
    }
    loginAs(p.index);
    await FISG_STORE.syncFromGraph();
  }

  async function handleRedirect() {
    const a = await ready(); if (!a) return null;
    try {
      const r = await a.handleRedirectPromise();
      if (r && r.account) account = r.account;
      else { const all = a.getAllAccounts(); if (all.length) account = all[0]; }
    } catch (e) {}
    return account;
  }

  window.FISG_AUTH = { init, signIn, getToken, account: () => account };

  function boot() {
    const btn = document.querySelector(".ms-btn");
    if (btn) btn.onclick = signIn;
    handleRedirect().then(acc => { if (acc) enter(acc); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
