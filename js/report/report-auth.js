/* report-auth.js — MSAL độc lập cho trang report.html.
   Dùng lại FISG_CFG (js/sp-config.js). Cung cấp window.FISG_AUTH để js/graph.js chạy.
   Không đụng js/auth.js / js/config.js của app chính. */
(function () {
  "use strict";
  const CFG = window.FISG_CFG || {};
  let app = null, account = null, initPromise = null;

  function build() {
    if (app) return app;
    if (!window.msal || !CFG.clientId) return null;
    app = new msal.PublicClientApplication({
      auth: {
        clientId: CFG.clientId,
        authority: "https://login.microsoftonline.com/" + CFG.tenantId,
        redirectUri: CFG.redirectUri,
      },
      // Cùng cacheLocation + origin với app chính ⇒ đăng nhập một lần dùng chung.
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

  async function getToken(scopes) {
    const a = await ready();
    if (!a || !account) throw new Error("chưa đăng nhập Microsoft");
    try {
      const r = await a.acquireTokenSilent({ scopes: scopes || CFG.scopes, account });
      return r.accessToken;
    } catch (e) {
      const r = await a.acquireTokenPopup({ scopes: scopes || CFG.scopes });
      account = r.account; a.setActiveAccount(account);
      return r.accessToken;
    }
  }

  async function signIn() {
    let a = await ready();
    for (let i = 0; !a && i < 15; i++) { await new Promise(r => setTimeout(r, 200)); a = await ready(); }
    if (!a) { fail("Chưa tải được MSAL. Tải lại trang (F5) hoặc kiểm tra mạng/chặn CDN."); return; }
    if (location.protocol === "file:") {
      fail("Đăng nhập Microsoft cần chạy qua http(s), không mở trực tiếp file."); return;
    }
    try {
      const r = await a.loginPopup({ scopes: CFG.scopes });
      account = r.account; a.setActiveAccount(account);
      if (window.REPORT_ON_AUTH) window.REPORT_ON_AUTH(account);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/redirect_uri|AADSTS50011/i.test(msg))
        fail("Redirect URI chưa khớp. Thêm '" + CFG.redirectUri + "' (loại SPA) vào App Registration → Authentication.");
      else fail("Đăng nhập lỗi: " + msg);
    }
  }

  async function signOut() {
    const a = await ready();
    try { localStorage.removeItem("fisg_report_last"); } catch (e) {}
    if (a) {
      const acc = account || (a.getAllAccounts() || [])[0];
      await a.logoutPopup({ account: acc }).catch(() => location.reload());
    } else location.reload();
  }

  function fail(msg) {
    const el = document.getElementById("rpxSigninHint");
    if (el) el.textContent = msg;
    if (window.REPORT_SHOW_SIGNIN) window.REPORT_SHOW_SIGNIN();
  }

  window.FISG_AUTH = {
    signIn, signOut, getToken,
    account: () => account,
    init: build,
  };

  async function boot() {
    const a = await ready();
    if (!a) { fail("Chưa tải được MSAL."); return; }
    try {
      const r = await a.handleRedirectPromise();
      if (r && r.account) account = r.account;
      else { const all = a.getAllAccounts(); if (all.length) account = all[0]; }
    } catch (e) {}
    if (account) {
      a.setActiveAccount(account);
      if (window.REPORT_ON_AUTH) window.REPORT_ON_AUTH(account);
    } else if (window.REPORT_SHOW_SIGNIN) {
      window.REPORT_SHOW_SIGNIN();
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
