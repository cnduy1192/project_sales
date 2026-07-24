/* js/graph.js — Microsoft Graph REST client tối giản (classic script).
 * Đọc/ghi SharePoint List. Tự retry khi 429. Ghi lookup/person bằng hậu tố ...LookupId. */
(function () {
  const CFG = window.FISG_CFG;
  const BASE = "https://graph.microsoft.com/v1.0";
  let siteId = null;

  async function api(path, opts) {
    const token = await FISG_AUTH.getToken(CFG.scopes);
    const url = path.startsWith("http") ? path : BASE + path;
    const res = await fetch(url, Object.assign({}, opts, {
      headers: Object.assign(
        { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        opts && opts.headers),
    }));
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
      await new Promise(r => setTimeout(r, wait));
      return api(path, opts);
    }
    if (!res.ok) throw new Error("Graph " + res.status + ": " + (await res.text()).slice(0, 300));
    return res.status === 204 ? null : res.json();
  }

  async function getSiteId() {
    if (siteId) return siteId;
    const d = await api("/sites/" + CFG.siteHost + ":" + CFG.sitePath);
    siteId = d.id;
    return siteId;
  }

  // đọc toàn bộ item 1 list (tự phân trang), kèm $expand=fields
  async function listItems(listName, selectExpand) {
    const sid = await getSiteId();
    let next = "/sites/" + sid + "/lists/" + encodeURIComponent(listName) +
               "/items?$top=500&$expand=fields" + (selectExpand ? "(" + selectExpand + ")" : "");
    let out = [];
    while (next) {
      const d = await api(next);
      out = out.concat(d.value || []);
      next = d["@odata.nextLink"] || null;
    }
    return out;
  }

  // {internal: display} của 1 list (cache) — để map khi internal name bị SharePoint mã hoá
  const colCache = {};
  async function columns(listName) {
    if (colCache[listName]) return colCache[listName];
    const sid = await getSiteId();
    const d = await api("/sites/" + sid + "/lists/" + encodeURIComponent(listName) + "/columns?$top=200");
    const map = {};
    (d.value || []).forEach(c => { map[c.name] = c.displayName || ""; });
    colCache[listName] = map;
    return map;
  }

  async function createItem(listName, fields) {
    const sid = await getSiteId();
    return api("/sites/" + sid + "/lists/" + encodeURIComponent(listName) + "/items",
      { method: "POST", body: JSON.stringify({ fields }) });
  }
  async function updateItem(listName, itemId, fields) {
    const sid = await getSiteId();
    return api("/sites/" + sid + "/lists/" + encodeURIComponent(listName) + "/items/" + itemId + "/fields",
      { method: "PATCH", body: JSON.stringify(fields) });
  }

  window.FISG_GRAPH = { api, getSiteId, listItems, createItem, updateItem, columns };
})();
