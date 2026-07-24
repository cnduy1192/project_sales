/* js/store.js — LỚP DỮ LIỆU (đường ranh cô lập app khỏi SharePoint).
 * Khi đã đăng nhập Microsoft & USE_GRAPH: tải item từ list, ánh xạ về shape record của app,
 * tráo vào RECORDS/ACTIVITIES rồi re-render. Lỗi/không đăng nhập -> giữ dữ liệu demo.
 * View KHÔNG cần biết dữ liệu đến từ đâu — chỉ store.js đụng tới Graph. */
(function () {
  const CFG = window.FISG_CFG;

  function useGraph() {
    return CFG && CFG.USE_GRAPH && window.FISG_AUTH && FISG_AUTH.account() && window.FISG_GRAPH;
  }

  // đọc giá trị lookup dù Graph trả về string hay object
  function lk(f, name) {
    const v = f[name];
    if (v == null) return f[name + "Value"] || "";
    if (typeof v === "object") return v.LookupValue || v.Label || v.displayName || "";
    return v;
  }
  function person(f, name) {
    const v = f[name];
    if (!v) return "";
    if (Array.isArray(v)) return v.map(x => x.displayName || x.LookupValue || x).join(", ");
    if (typeof v === "object") return v.displayName || v.LookupValue || "";
    return v;
  }
  function statusOf(f) {
    const st = (f.Status || "").toLowerCase(), res = (f.Result || "").toUpperCase();
    if (st === "closed" && res === "WON") return "WON";
    if (st === "closed" && res === "LOST") return "LOST";
    return "IN PROGRESS";
  }

  function mapProject(it, i) {
    const f = it.fields || {};
    return {
      ncc: lk(f, "Supplier"), customer: lk(f, "Customer"),
      product: lk(f, "Products") || lk(f, "Product"),
      application: f.Application || "", segment: f.Segment || "",
      group: f.SegmentGroup || "", stage: f.Stage || "",
      status: statusOf(f), boptype: f.ProjectType || "",
      prob: (Number(f.WinProbability) || 0) / 100,
      kgThis: Number(f.PotentialKgThisYear) || 0,
      kgNext: Number(f.PotentialKgNextYear) || 0,
      pic: person(f, "PIC") || f.PICName || "",          // Person -> tên; trống thì lấy text PICName
      related: person(f, "RelatedPeople") ? person(f, "RelatedPeople").split(", ") : [],
      created: (f.CreationDate || "").slice(0, 10),
      closing: (f.ClosingDate || "").slice(0, 10),
      desc: f.ProjectCode || f.Title || "",
      id: f.ProjectCode || ("P-" + (it.id || i)),
      comments: [], related: (person(f, "RelatedPeople") || "").split(", ").filter(Boolean),
    };
  }
  function mapActivity(it, i) {
    const f = it.fields || {};
    return {
      customer: lk(f, "Customer"), pic: person(f, "PIC") || f.PICName || "",
      ncc: lk(f, "Supplier"), product: lk(f, "Product"),
      type: f.ActivityType || "Khác", date: (f.ActivityDate || "").slice(0, 10),
      note: f.Content || "", next: f.NextStep || "", potential: f.PotentialLevel || "",
      projectId: lk(f, "RelatedProject") || "", id: "A-" + (it.id || i),
    };
  }

  async function syncFromGraph() {
    if (!useGraph()) return false;
    try {
      if (window.toast) toast("Đang tải dữ liệu từ SharePoint…");
      const [projs, acts] = await Promise.all([
        FISG_GRAPH.listItems("Projects"),
        FISG_GRAPH.listItems("Activities"),
      ]);
      const recs = projs.map(mapProject);
      recs.forEach(r => { r.related = r.related || []; r.comments = r.comments || []; });
      RECORDS.length = 0; recs.forEach(r => RECORDS.push(r));
      const A = acts.map(mapActivity);
      ACTIVITIES.length = 0; A.forEach(a => ACTIVITIES.push(a));

      if (window.render) render();
      if (window.renderDash) renderDash();
      if (window.renderActs) renderActs();
      if (window.toast) toast("Đã tải " + RECORDS.length + " dự án · " + ACTIVITIES.length + " hoạt động từ SharePoint.");
      return true;
    } catch (e) {
      if (window.toast) toast("Không tải được SharePoint — dùng dữ liệu demo. (" + (e.message || e) + ")");
      return false;
    }
  }

  window.FISG_STORE = { syncFromGraph, mapProject, mapActivity };
})();
