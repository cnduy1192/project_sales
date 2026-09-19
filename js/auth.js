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
    if (!a || !account) throw new Error(T("err.notSignedIn"));
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
      if (window.toast) toast(T("auth.msg.noMsal"));
      return;
    }
    if (location.protocol === "file:") {
      if (window.toast) toast(T("auth.msg.needHttp"));
      return;
    }
    try {
      const r = await a.loginPopup({ scopes: CFG.scopes });
      account = r.account; a.setActiveAccount(account);
      await enter(account);
    } catch (e) {
      const msg = e.message || String(e);
      if (/redirect_uri|AADSTS50011/i.test(msg))
        toast(T("auth.msg.redirect", { uri: CFG.redirectUri }));
      else if (window.toast) toast(T("auth.msg.failed") + " " + msg);
    }
  }

  function resumeDone() {
    if (window.FISG_RESUME) FISG_RESUME.done();
    else document.documentElement.classList.remove("fisg-resuming");
  }

  async function enter(acc) {
    const email = (acc.username || "").toLowerCase();

    const guests = (CFG.GUEST_EMAILS || []).map(e => String(e).toLowerCase());
    if (guests.includes(email) && window.FISG_GUEST) {
      let idx = USERS.findIndex(u => (u.email || "").toLowerCase() === email);
      if (idx < 0) {
        USERS.push({ name: acc.name || T("auth.guest"), email: acc.username, role: "guest", pic: null, color: "#6D28D9" });
        idx = USERS.length - 1;
      }
      loginAs(idx); resumeDone();
      if (window.FISG_STORE) await FISG_STORE.syncFromGraph();
      await FISG_GUEST.afterLogin(email);
      return;
    }

    if (!window.FISG_STORE) { resumeDone(); toast(T("auth.msg.noStore")); return; }
    const p = await FISG_STORE.profileFor(email, acc.name || acc.username);
    if (!p.user) {
      resumeDone();
      toast(T("auth.msg.notInUsers", { user: acc.username }));
      return;
    }
    loginAs(p.index); resumeDone();
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
    handleRedirect().then(acc => {
      if (!acc) { resumeDone(); return; }          // không có phiên → hiện màn hình đăng nhập
      enter(acc).catch(e => {
        resumeDone();
        if (window.toast) toast(T("auth.msg.resumeFailed", { e: e.message || e }));
      });
    }, () => resumeDone());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
