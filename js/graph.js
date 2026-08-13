(function () {
  const CFG = window.FISG_CFG;
  const BASE = "https://graph.microsoft.com/v1.0";
  let siteId = null;

  async function api(path, opts, scopes) {
    const token = await FISG_AUTH.getToken(scopes || CFG.scopes);
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

  async function deleteItem(listName, itemId) {
    const sid = await getSiteId();
    return api("/sites/" + sid + "/lists/" + encodeURIComponent(listName) + "/items/" + itemId,
      { method: "DELETE" });
  }

  async function lookupPerson(email) {
    const mail = String(email || "").trim();
    if (!mail) return null;
    try {
      const u = await api("/users/" + encodeURIComponent(mail)
        + "?$select=displayName,mail,userPrincipalName,jobTitle", null, ["User.ReadBasic.All"]);
      return u && u.displayName
        ? { name: u.displayName, mail: (u.mail || u.userPrincipalName || mail).toLowerCase(),
            title: u.jobTitle || "" }
        : null;
    } catch (e) { return null; }
  }

  async function driveId() {
    if (driveId._v) return driveId._v;
    const sid = await getSiteId();
    const d = await api("/sites/" + sid + "/drive");
    driveId._v = d.id;
    return d.id;
  }

  function cleanSeg(s) {
    return String(s == null ? "" : s)
      .replace(/[\\/:*?"<>|#%]+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^\.+|\.+$/g, "").slice(0, 120) || "_";
  }
  function encPath(path) {
    return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  }

  async function ensureFolder(path) {
    const drv = await driveId();
    const segs = String(path || "").split("/").map(cleanSeg).filter(Boolean);
    let parent = "root";
    for (const seg of segs) {
      try {
        const body = { name: seg, folder: {}, "@microsoft.graph.conflictBehavior": "fail" };
        const created = await api("/drives/" + drv + "/items/" + parent + "/children",
          { method: "POST", body: JSON.stringify(body) });
        parent = created.id;
      } catch (e) {

        const found = await api("/drives/" + drv + "/items/" + parent
          + "/children?$filter=" + encodeURIComponent("name eq '" + seg.replace(/'/g, "''") + "'")
          + "&$select=id,name").catch(() => null);
        const hit = found && found.value && found.value[0];
        if (!hit) throw e;
        parent = hit.id;
      }
    }
    return parent;
  }

  async function uploadFile(folderPath, fileName, blob) {
    const drv = await driveId();
    const name = cleanSeg(fileName);
    const full = encPath(folderPath) + "/" + encodeURIComponent(name);
    const size = blob.size != null ? blob.size : (blob.byteLength || 0);

    if (size <= 4 * 1024 * 1024) {
      const token = await FISG_AUTH.getToken(CFG.scopes);
      const res = await fetch(BASE + "/drives/" + drv + "/root:/" + full + ":/content",
        { method: "PUT", headers: { Authorization: "Bearer " + token }, body: blob });
      if (!res.ok) throw new Error("Upload " + res.status + ": " + (await res.text()).slice(0, 200));
      return res.json();
    }

    const sess = await api("/drives/" + drv + "/root:/" + full + ":/createUploadSession",
      { method: "POST", body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) });
    const url = sess.uploadUrl;
    const CHUNK = 3200000;
    let start = 0, last = null;
    while (start < size) {
      const end = Math.min(start + CHUNK, size);
      const slice = blob.slice(start, end);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Length": String(end - start),
                   "Content-Range": "bytes " + start + "-" + (end - 1) + "/" + size },
        body: slice,
      });
      if (!res.ok && res.status !== 202)
        throw new Error("Upload " + res.status + ": " + (await res.text()).slice(0, 200));
      if (res.status !== 202) last = await res.json();
      start = end;
    }
    return last || {};
  }

  async function deleteDriveItem(itemId) {
    const drv = await driveId();
    return api("/drives/" + drv + "/items/" + itemId, { method: "DELETE" });
  }

  window.FISG_GRAPH = { api, getSiteId, listItems, createItem, updateItem, deleteItem,
                        columns, lookupPerson,
                        ensureFolder, uploadFile, deleteDriveItem, cleanSeg };
})();
