/* i18n self-heal: if an older cached HTML page loads this file without the i18n engine
   (e.g. right after a deploy, while GitHub Pages still serves the old page for ~10 min),
   pull in the dictionary + engine synchronously so scripts calling T()/tv() never crash. */
(function () {
  if (window.I18N || typeof document === "undefined" || document.readyState !== "loading") return;
  var base = (document.currentScript && document.currentScript.src || "").replace(/js\/sp-config\.js.*$/, "");
  document.write('<script src="' + base + 'js/i18n-dict.js?v=3"><\/script><script src="' + base + 'js/i18n.js?v=3"><\/script>');
})();
if (!window.T) {                     /* last-resort fallback: never let a missing engine block sign-in */
  window.t = window.T = function (k) { return k; };
  window.tv = function (v) { return v; };
}
if (!window.I18N) {
  window.I18N = { t: window.T, tv: window.tv, lang: function () { return "vi"; },
    locale: function () { return "vi-VN"; }, decSep: function () { return ","; },
    apply: function () {}, onChange: function () {}, setLang: function () {},
    missing: function () { return []; }, audit: function () { return []; }, mountSwitch: function () {} };
}
window.FISG_CFG = {
  clientId:    "24925102-5177-4ab4-b223-7b1b65b4c85f",
  tenantId:    "b525a15d-6dc6-4d98-9e0f-851477df4a68",

  redirectUri: (typeof location !== "undefined"
      ? location.origin + location.pathname.replace(/[^/]*$/, "")
      : "https://cnduy1192.github.io/project_sales/"),
  siteHost:    "fisaigonvn.sharepoint.com",
  sitePath:    "/sites/SalesProjectTracker",
  scopes:      ["User.Read", "Sites.ReadWrite.All", "People.Read"],
  lists: ["Suppliers","Products","Customers","Pipelines","Activities",
          "Projects","ProjectUpdates","Samples","MarketPotentials","MarketTrends","Users"],

  USERS_LIST: "Users",

  USE_GRAPH: true,
  ADMIN_EMAIL: "duy.chengoc@fisaigon.vn",

  RELATED_GROUP_ID: "a2d4f1d9-966d-4b53-be28-ffc36bcf3996",

  GUEST_EMAILS: [],
  SHARES_LIST: "Shares",

  SHARE_WORKER_URL: "https://guest-project.cheduy1192.workers.dev/",
};
