/* js/auth.js — Đăng nhập Microsoft 365 bằng MSAL (browser SPA, classic script).
 * Nối vào nút .ms-btn có sẵn ở màn đăng nhập. Sau khi đăng nhập -> gọi store tải Graph. */
(function () {
  const CFG = window.FISG_CFG;
  let app = null, account = null;

  function init() {
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

  async function getToken(scopes) {
    const a = init();
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
    let a = init();
    // MSAL tải async từ CDN — nếu click sớm, chờ tối đa 3s rồi thử lại
    for (let i = 0; !a && i < 15; i++) { await new Promise(r => setTimeout(r, 200)); a = init(); }
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

  // đưa tài khoản MS vào luồng đăng nhập sẵn có (tái dùng loginAs của core.js)
  async function enter(acc) {
    const email = (acc.username || "").toLowerCase();
    let idx = USERS.findIndex(u => (u.email || "").toLowerCase() === email);
    if (idx < 0) {
      const isAdmin = email === (CFG.ADMIN_EMAIL || "").toLowerCase();
      USERS.push({ name: acc.name || acc.username, email: acc.username,
                   role: isAdmin ? "superadmin" : "manager", pic: null, color: "#1E3A8A" });
      idx = USERS.length - 1;
      if (window.buildUsers) buildUsers();
    }
    loginAs(idx);                       // dựng toàn bộ UI như đăng nhập demo
    if (window.FISG_STORE) await FISG_STORE.syncFromGraph();   // thay dữ liệu demo bằng SharePoint
  }

  async function handleRedirect() {
    const a = init(); if (!a) return null;
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
    if (btn) btn.onclick = signIn;             // ghi đè toast demo bằng đăng nhập thật
    handleRedirect().then(acc => { if (acc) enter(acc); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
