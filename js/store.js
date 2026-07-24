/* js/store.js — LỚP DỮ LIỆU (đường ranh cô lập app khỏi SharePoint).
 * Tự DÒ internal name thật của cột (SharePoint hay mã hoá tên cột tiếng Việt),
 * map về shape record của app, tráo vào RECORDS/ACTIVITIES rồi re-render.
 * Không đăng nhập / lỗi -> giữ dữ liệu demo. View KHÔNG cần biết dữ liệu đến từ đâu. */
(function () {
  const CFG = window.FISG_CFG;

  // nhãn hiển thị VN của từng cột (khớp FISG_SharePoint_ColumnNames.md) — dùng để dò khi internal name bị mã hoá
  const LABELS = {
    Projects: {
      Supplier: "NCC", Customer: "Khách hàng", SegmentGroup: "Nhóm ngành", Segment: "Segment",
      Application: "Ứng dụng", Products: "Nguyên liệu", ProjectType: "Loại dự án",
      Stage: "Giai đoạn", Status: "Trạng thái", Result: "Kết quả", WinProbability: "Xác suất thắng %",
      PotentialKgThisYear: "KG năm nay", PotentialKgNextYear: "KG năm sau",
      PIC: "Sale phụ trách (PIC)", RnDOwner: "R&D phụ trách", RelatedPeople: "Người liên quan",
      CreationDate: "Ngày tạo", ClosingDate: "Ngày dự kiến chốt", LastUpdateDate: "Ngày cập nhật gần nhất",
    },
    Activities: {
      Customer: "Khách hàng", PIC: "Sale phụ trách", Supplier: "NCC quan tâm",
      Product: "Nguyên liệu quan tâm", ActivityType: "Loại hoạt động", ActivityDate: "Ngày",
      Content: "Nội dung", NextStep: "Kết quả / Next step", PotentialLevel: "Mức độ tiềm năng",
      RelatedProject: "Dự án liên quan",
    },
  };

  // tạo hàm lấy field theo tên logic, tự khớp internal name thật
  function makeGetter(listName, cols) {
    const internals = new Set(Object.keys(cols));
    const byDisplay = {};
    Object.keys(cols).forEach(k => { if (!(cols[k] in byDisplay)) byDisplay[cols[k]] = k; });
    const labels = LABELS[listName] || {};
    const resolved = {};
    function actual(key) {
      if (resolved[key] !== undefined) return resolved[key];
      let a = null;
      if (internals.has(key)) a = key;
      else if (labels[key] && byDisplay[labels[key]]) a = byDisplay[labels[key]];
      else if (byDisplay[key]) a = byDisplay[key];
      resolved[key] = a;
      return a;
    }
    return function get(f, key) {
      const a = actual(key);
      if (!a) return undefined;
      let v = f[a];
      if (v === undefined) v = f[a + "LookupId"];
      return v;
    };
  }

  function txt(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
    if (typeof v === "object")
      return v.LookupValue || v.Label || v.displayName || v.Title || v.Value || "";
    return String(v);
  }

  // Graph thường chỉ trả "<Cột>LookupId" (ID), không kèm tên -> cần bảng tra ID→Title
  function lookupVal(f, base, map) {
    const direct = f[base];
    if (direct != null && direct !== "") {
      const s = txt(direct);
      if (s) return s;
    }
    let id = f[base + "LookupId"];
    if (id == null) return "";
    if (!Array.isArray(id)) id = [id];
    return id.map(x => (map && map[String(x)]) || "").filter(Boolean).join(", ");
  }

  async function idTitleMap(listName) {
    try {
      const items = await FISG_GRAPH.listItems(listName);
      const m = {};
      items.forEach(it => { m[String(it.id)] = txt((it.fields || {}).Title); });
      return m;
    } catch (e) { return {}; }
  }

  function statusOf(status, result) {
    const st = txt(status).toLowerCase(), res = txt(result).toUpperCase();
    if (res === "WON") return "WON";
    if (res === "LOST") return "LOST";
    if (st === "closed") return "LOST";
    return "IN PROGRESS";
  }

  async function syncFromGraph() {
    if (!(CFG && CFG.USE_GRAPH && window.FISG_AUTH && FISG_AUTH.account() && window.FISG_GRAPH))
      return false;
    try {
      if (window.toast) toast("Đang tải dữ liệu từ SharePoint…");
      const [pCols, aCols, projs, acts, supMap, cusMap, prodMap, ups] = await Promise.all([
        FISG_GRAPH.columns("Projects"), FISG_GRAPH.columns("Activities"),
        FISG_GRAPH.listItems("Projects"), FISG_GRAPH.listItems("Activities"),
        idTitleMap("Suppliers"), idTitleMap("Customers"), idTitleMap("Products"),
        FISG_GRAPH.listItems("ProjectUpdates").catch(() => []),
      ]);
      const gp = makeGetter("Projects", pCols), ga = makeGetter("Activities", aCols);
      // tên internal thật (đề phòng cột bị mã hoá) -> dùng cho lookupVal
      const nameOf = (getter, f, key) => key;   // cột đang đúng tên Anh; getter dùng cho field thường

      // gom ProjectUpdates theo dự án -> tab "Trao đổi"
      const upsBy = {};
      (ups || []).forEach(it => {
        const f = it.fields || {};
        const pid = String(f.ProjectLookupId || "");
        if (!pid) return;
        (upsBy[pid] = upsBy[pid] || []).push({
          by: txt(f.PICName) || "—",
          at: txt(f.UpdateDate).slice(0, 10),
          text: txt(f.Content),
        });
      });

      const recs = projs.map((it, i) => {
        const f = it.fields || {};
        const title = txt(f.Title);
        const code = (title.match(/^(P-\d+)/) || [])[1] || ("P-" + (it.id || i));
        return {
          ncc: lookupVal(f, "Supplier", supMap),
          customer: lookupVal(f, "Customer", cusMap),
          product: lookupVal(f, "Products", prodMap),
          application: txt(gp(f, "Application")),
          segment: txt(gp(f, "Segment")), group: txt(gp(f, "SegmentGroup")),
          stage: txt(gp(f, "Stage")),
          status: statusOf(gp(f, "Status"), gp(f, "Result")),
          boptype: txt(gp(f, "ProjectType")),
          prob: (Number(gp(f, "WinProbability")) || 0) / 100,
          kgThis: Number(gp(f, "PotentialKgThisYear")) || 0,
          kgNext: Number(gp(f, "PotentialKgNextYear")) || 0,
          pic: txt(f.PICName) || txt(gp(f, "PIC")),
          related: [],
          created: txt(gp(f, "CreationDate")).slice(0, 10),
          closing: txt(gp(f, "ClosingDate")).slice(0, 10),
          desc: title, id: code, spId: it.id,
          comments: upsBy[String(it.id)] || [],
        };
      });
      const byItemId = {};
      recs.forEach(r => { byItemId[String(r.spId)] = r.id; });

      const A = acts.map((it, i) => {
        const f = it.fields || {};
        return {
          customer: lookupVal(f, "Customer", cusMap),
          pic: txt(f.PICName) || txt(ga(f, "PIC")),
          ncc: lookupVal(f, "Supplier", supMap),
          product: lookupVal(f, "Product", prodMap),
          type: txt(ga(f, "ActivityType")) || "Khác",
          date: txt(ga(f, "ActivityDate")).slice(0, 10),
          note: txt(ga(f, "Content")), next: txt(ga(f, "NextStep")),
          potential: txt(ga(f, "PotentialLevel")),
          projectId: byItemId[String(f.RelatedProjectLookupId || "")] || "",
          id: "A-" + (it.id || i),
        };
      });

      if (!recs.length) { if (window.toast) toast("SharePoint trả 0 dự án — vẫn dùng dữ liệu demo."); return false; }

      RECORDS.length = 0; recs.forEach(r => RECORDS.push(r));
      ACTIVITIES.length = 0; A.forEach(a => ACTIVITIES.push(a));

      // NCC đang lọc phải khớp dữ liệu thật, nếu không funnel sẽ trống
      const nccs = [...new Set(RECORDS.map(r => r.ncc).filter(Boolean))];
      if (nccs.length && typeof nccFilter !== "undefined" && !nccs.includes(nccFilter)) {
        nccFilter = nccs[0];
        document.querySelectorAll(".ncc-tab").forEach(t =>
          t.classList.toggle("on", t.dataset.ncc === nccFilter));
      }
      if (window.render) render();
      if (window.renderDash) renderDash();
      if (window.renderActs) renderActs();

      const blank = RECORDS.filter(r => !r.ncc).length;
      if (window.toast)
        toast("Đã tải " + RECORDS.length + " dự án · " + ACTIVITIES.length + " hoạt động."
              + (blank ? " (" + blank + " dự án thiếu NCC)" : ""));
      return true;
    } catch (e) {
      if (window.toast) toast("Không tải được SharePoint — dùng dữ liệu demo. (" + (e.message || e) + ")");
      return false;
    }
  }

  // Chẩn đoán: gõ FISG_STORE.debug() trong Console để xem cột thật & 1 bản ghi mẫu
  async function debug() {
    const cols = await FISG_GRAPH.columns("Projects");
    console.log("=== Cột list Projects (internal | hiển thị) ===");
    Object.keys(cols).forEach(k => console.log("  " + k + "  |  " + cols[k]));
    const items = await FISG_GRAPH.listItems("Projects");
    console.log("Số item:", items.length);
    if (items.length) console.log("fields item đầu:", items[0].fields);
    return { cols, sample: items[0] && items[0].fields, count: items.length };
  }

  window.FISG_STORE = { syncFromGraph, debug };
})();
