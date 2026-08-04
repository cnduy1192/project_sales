/* js/store.js — LỚP DỮ LIỆU (đường ranh cô lập app khỏi SharePoint).
 * Tự DÒ internal name thật của cột (SharePoint hay mã hoá tên cột tiếng Việt),
 * map về shape record của app, tráo vào RECORDS/ACTIVITIES rồi re-render.
 * Không đăng nhập -> app rỗng (đã bỏ toàn bộ dữ liệu demo).
 * Dựng luôn cả danh mục (NCC, segment, pipeline, sales) và list Users phân quyền.
 * View KHÔNG cần biết dữ liệu đến từ đâu. */
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
    // Pipelines: mỗi dòng = một giai đoạn của một NCC.
    Pipelines: {
      Supplier: "NCC", Stage: "Giai đoạn", StageOrder: "Thứ tự",
      StageGroup: "Nhóm giai đoạn", WinProbability: "Xác suất thắng %",
    },
    // Users: phân quyền. Title = email đăng nhập.
    Users: { Email: "Email", PICName: "Tên PIC", Role: "Vai trò" },
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

  /* ---------- DANH MỤC ----------
     Phần lớn danh mục suy thẳng từ Projects/Activities đã map đúng, nên không phụ
     thuộc vào việc đoán tên cột của các list phụ. Chỉ pipeline (thứ tự giai đoạn,
     nhóm, % mặc định) mới bắt buộc đọc list Pipelines. */
  function uniqSorted(arr) {
    return [...new Set(arr.map(v => String(v == null ? "" : v).trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi"));
  }
  function replaceInPlace(target, values) { target.length = 0; values.forEach(v => target.push(v)); }
  function clearObj(o) { Object.keys(o).forEach(k => delete o[k]); }

  async function loadPipelines() {
    try {
      const [cols, items] = await Promise.all([
        FISG_GRAPH.columns("Pipelines"), FISG_GRAPH.listItems("Pipelines"),
      ]);
      const g = makeGetter("Pipelines", cols);
      const rows = items.map(it => {
        const f = it.fields || {};
        return {
          ncc: txt(g(f, "Supplier")) || txt(f.SupplierLookupId ? "" : ""),
          stage: txt(g(f, "Stage")) || txt(f.Title),
          order: Number(g(f, "StageOrder")) || 0,
          group: txt(g(f, "StageGroup")),
          prob: Number(g(f, "WinProbability")),
        };
      }).filter(r => r.stage);
      return rows;
    } catch (e) {
      console.warn("[store] không đọc được list Pipelines:", e.message || e);
      return null;
    }
  }

  async function buildLists(recs, acts) {
    /* Về cấu hình gốc trước, rồi mới chồng dữ liệu thật lên — nếu không, tải
       hai lần sẽ nhân đôi các mục bổ sung. */
    if (window.resetCatalog) resetCatalog();
    /* NCC: giữ danh sách cấu hình, thêm nhà cung cấp mới thấy trong dữ liệu. */
    uniqSorted(recs.map(r => r.ncc)).forEach(n => {
      if (LISTS.nccs.indexOf(n) < 0) LISTS.nccs.push(n);
    });
    replaceInPlace(LISTS.customers, uniqSorted(recs.map(r => r.customer).concat(acts.map(a => a.customer))));
    replaceInPlace(LISTS.products, uniqSorted(recs.map(r => r.product).concat(acts.map(a => a.product))));
    replaceInPlace(LISTS.applications, uniqSorted(recs.map(r => r.application)));
    replaceInPlace(LISTS.pics, uniqSorted(recs.map(r => r.pic).concat(acts.map(a => a.pic))));
    replaceInPlace(LISTS.segments, uniqSorted(recs.map(r => r.segment)));

    /* Nhóm ngành và segment: cấu hình là nền, dữ liệu thật chỉ BỔ SUNG cái mới. */
    recs.forEach(r => {
      const grp = String(r.group || "").trim() || "Khác";
      const seg = String(r.segment || "").trim();
      if (!seg) return;
      (LISTS.segTree[grp] = LISTS.segTree[grp] || []);
      if (LISTS.segTree[grp].indexOf(seg) < 0) LISTS.segTree[grp].push(seg);
      if (LISTS.segments.indexOf(seg) < 0) LISTS.segments.push(seg);
    });
    Object.keys(LISTS.segTree).forEach(k => LISTS.segTree[k].sort((a, b) => a.localeCompare(b, "vi")));

    /* Quy trình bán hàng: list Pipelines (nếu có) THAY THẾ cấu hình; không có
       thì giữ nguyên cấu hình trong js/data/catalog.js. Cả hai trường hợp đều
       thêm nốt giai đoạn lạ xuất hiện trong dữ liệu, để không dự án nào biến mất. */
    const pipe = await loadPipelines();
    if (pipe && pipe.length) {
      clearObj(LISTS.pipelines);
      const byNcc = {};
      pipe.forEach(p => { (byNcc[p.ncc] = byNcc[p.ncc] || []).push(p); });
      Object.keys(byNcc).forEach(n => {
        byNcc[n].sort((a, b) => a.order - b.order);
        LISTS.pipelines[n] = byNcc[n].map(p => p.stage);
      });
      pipe.forEach(p => {
        if (p.group) LISTS.groupOf[p.stage] = p.group;
        if (!isNaN(p.prob)) LISTS.probOf[p.stage] = p.prob;
      });
    }
    const unknown = [];
    recs.forEach(r => {
      if (!r.ncc || !r.stage) return;
      const arr = (LISTS.pipelines[r.ncc] = LISTS.pipelines[r.ncc] || []);
      if (arr.indexOf(r.stage) < 0) { arr.push(r.stage); unknown.push(r.ncc + " · " + r.stage); }
    });
    if (unknown.length)
      console.warn("[store] giai đoạn có trong dữ liệu nhưng không có trong cấu hình:",
                   [...new Set(unknown)]);

    /* resetCatalog() trả LISTS về tên gốc "Kimica-Navido"; đổi lại ngay tại đây
       thay vì trông chờ hook chạy sau syncFromGraph. */
    if (window.FISG_RENAME_NCC) FISG_RENAME_NCC();
    if (window.rebuildDerived) rebuildDerived();
    return { pipelineFromList: !!(pipe && pipe.length), unknownStages: [...new Set(unknown)] };
  }

  /* ---------- NGƯỜI DÙNG & PHÂN QUYỀN ----------
     Nguồn sự thật là list Users trên SharePoint. Nếu list chưa tồn tại, KHÔNG
     khoá cửa: quay về quy tắc cũ (ADMIN_EMAIL = superadmin, còn lại manager) và
     báo rõ để người quản trị tạo list. */
  const ROLE_COLOR = { superadmin: "#1E3A8A", manager: "#0E7490", sales: "#0D9488", guest: "#6D28D9" };
  let usersLoaded = false;

  async function loadUsers() {
    if (usersLoaded) return true;
    const listName = (CFG && CFG.USERS_LIST) || "Users";
    try {
      const [cols, items] = await Promise.all([
        FISG_GRAPH.columns(listName), FISG_GRAPH.listItems(listName),
      ]);
      const g = makeGetter("Users", cols);
      const rows = items.map(it => {
        const f = it.fields || {};
        const email = (txt(g(f, "Email")) || txt(f.Title)).toLowerCase();
        const role = (txt(g(f, "Role")) || "sales").toLowerCase();
        return {
          email: email,
          name: txt(g(f, "PICName")) || email,
          pic: txt(g(f, "PICName")) || null,
          role: ["sales", "manager", "superadmin"].indexOf(role) >= 0 ? role : "sales",
          color: ROLE_COLOR[role] || "#0D9488",
        };
      }).filter(u => u.email);
      if (!rows.length) throw new Error("list " + listName + " rỗng");
      USERS.length = 0; rows.forEach(u => USERS.push(u));
      usersLoaded = true;
      if (window.buildUsers) buildUsers();
      return true;
    } catch (e) {
      console.warn("[store] không đọc được list " + listName + ":", e.message || e);
      return false;
    }
  }

  /* Hồ sơ của người vừa đăng nhập.
     PIC = TÊN HIỂN THỊ O365 của chính người đó — vì cột PIC trong Projects là
     trường Person, SharePoint trả về đúng tên đầy đủ ấy. Cột PICName trong list
     Users chỉ là ĐƯỜNG LUI: điền khi tên O365 khác với giá trị PIC trong dữ liệu
     (đổi tên, tên viết tắt cũ…). Bỏ trống là chuyện bình thường.
     Vai trò thì ngược lại: chỉ list Users mới quyết định được. */
  async function profileFor(email, displayName) {
    const ok = await loadUsers();
    const mail = String(email || "").toLowerCase();
    const full = String(displayName || "").trim();
    let u = USERS.filter(x => (x.email || "").toLowerCase() === mail)[0];
    if (u) {
      if (full) u.name = full;              // tên hiển thị luôn lấy từ O365
      if (!u.pic && full) u.pic = full;     // không khai PICName → dùng tên O365
      if (window.buildUsers) buildUsers();
      return { user: u, fromList: ok, index: USERS.indexOf(u) };
    }
    if (ok) return { user: null, fromList: true, index: -1 };
    /* Chưa có list Users — dùng quy tắc dự phòng để không khoá cửa. */
    const isAdmin = mail === String((CFG && CFG.ADMIN_EMAIL) || "").toLowerCase();
    u = { name: full || email, email: email, pic: full || null,
          role: isAdmin ? "superadmin" : "manager", color: isAdmin ? "#1E3A8A" : "#0E7490" };
    USERS.push(u);
    if (window.buildUsers) buildUsers();
    return { user: u, fromList: false, index: USERS.length - 1 };
  }

  /* Sai lệch giữa tên O365 và cột PIC trong dữ liệu là kiểu hỏng ÂM THẦM: app
     chạy bình thường nhưng người đó không thấy dự án nào của mình. Phải nói ra. */
  function picMatchReport(pic) {
    const want = String(pic || "").trim();
    const all = [...new Set([].concat(
      RECORDS.map(r => r.pic), ACTIVITIES.map(a => a.pic)
    ).map(v => String(v || "").trim()).filter(Boolean))];
    if (!want) return { ok: false, reason: "empty", all: all };
    const hit = all.filter(v => v.toLowerCase() === want.toLowerCase());
    if (hit.length) return { ok: true, matched: hit[0], all: all };
    /* Gợi ý tên gần đúng: trùng ít nhất một từ. */
    const words = want.toLowerCase().split(/\s+/).filter(x => x.length > 1);
    const near = all.filter(v => {
      const lv = v.toLowerCase();
      return words.some(x => lv.indexOf(x) >= 0);
    }).slice(0, 6);
    return { ok: false, reason: "nomatch", near: near, all: all };
  }
  window.picMatchReport = picMatchReport;

  /* ---------- DÒ KHÁCH HÀNG TRÙNG TÊN ----------
     Không tự gộp — chỉ liệt kê để dọn trên SharePoint. Bỏ hậu tố pháp nhân,
     bỏ dấu tiếng Việt, rồi gom các tên rút về cùng một gốc. */
  const CO_SUFFIX = /\b(CO\.?,?\s*LTD|CO\.?LTD|LTD|JSC|CTY|CONG TY|COMPANY|CORP|CORPORATION|GROUP|VIETNAM|VIET NAM|VN|MTV|TNHH|CP)\b/g;
  function slug(name) {
    return String(name || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
      .toUpperCase().replace(/[^A-Z0-9\s]/g, " ")
      .replace(CO_SUFFIX, " ").replace(/\s+/g, " ").trim();
  }
  function findDuplicateCustomers() {
    const names = [...new Set([].concat(
      RECORDS.map(r => r.customer), ACTIVITIES.map(a => a.customer)
    ).map(v => String(v || "").trim()).filter(Boolean))];
    const groups = {};
    names.forEach(n => {
      const k = slug(n); if (!k) return;
      (groups[k] = groups[k] || []).push(n);
    });
    const dups = Object.keys(groups).filter(k => groups[k].length > 1)
      .map(k => ({ key: k, names: groups[k].sort() }))
      .sort((a, b) => b.names.length - a.names.length || a.key.localeCompare(b.key));
    console.log("=== Khách hàng nghi trùng tên: " + dups.length + " nhóm / " + names.length + " tên ===");
    dups.forEach(d => console.log("  " + d.names.join("   ≡   ")));
    if (!dups.length) console.log("  (không có nhóm nào)");
    console.log("Sửa trên SharePoint list Customers, rồi trỏ lại lookup của Projects/Activities.");
    return dups;
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

      if (!recs.length) {
        if (window.toast) toast("SharePoint trả về 0 dự án. Kiểm tra list Projects và quyền truy cập.");
        return false;
      }

      RECORDS.length = 0; recs.forEach(r => RECORDS.push(r));
      ACTIVITIES.length = 0; A.forEach(a => ACTIVITIES.push(a));

      // Danh mục (NCC, segment, pipeline, sales…) cũng dựng từ dữ liệu thật.
      const meta = await buildLists(RECORDS, ACTIVITIES);

      // Việc sales tự nhập lúc offline phải được nối lại sau khi thay mảng.
      if (window.LS && LS.mergeActs) LS.mergeActs();
      if (typeof invalidateCockpit === "function") invalidateCockpit();

      document.querySelectorAll(".ncc-tab").forEach(t =>
        t.classList.toggle("on", t.dataset.ncc === nccFilter));
      if (window.rebuildNccTabs) rebuildNccTabs();
      if (window.render) render();
      if (window.renderDash) renderDash();
      if (window.renderActs) renderActs();
      if (window.renderCockpit && document.getElementById("view-cockpit")) renderCockpit();
      if (window.welcomeRefresh) welcomeRefresh();
      if (window.buildForm) buildForm();

      /* Đối chiếu tên O365 với cột PIC trong dữ liệu — báo ngay nếu lệch. */
      if (typeof me !== "undefined" && me && me.pic) {
        const m = picMatchReport(me.pic);
        if (!m.ok && window.toast) {
          setTimeout(() => toast(
            'Tên O365 của bạn ("' + me.pic + '") không khớp giá trị PIC nào trong dữ liệu'
            + (m.near && m.near.length ? '. Gần nhất: ' + m.near.join(', ') : '')
            + '. Điền cột PICName trong list Users để chỉ đúng tên trong dữ liệu.'), 3200);
          console.warn("[store] PIC không khớp:", me.pic, "| các PIC có trong dữ liệu:", m.all);
        }
      }

      const blank = RECORDS.filter(r => !r.ncc).length;
      if (window.toast)
        toast("Đã tải " + RECORDS.length + " dự án · " + ACTIVITIES.length + " hoạt động · "
              + LISTS.nccs.length + " NCC · " + LISTS.customers.length + " khách hàng."
              + (blank ? " (" + blank + " dự án thiếu NCC)" : "")
              + (meta.unknownStages && meta.unknownStages.length
                   ? " Có giai đoạn chưa khai trong cấu hình: " + meta.unknownStages.join(", ") + "."
                   : ""));
      return true;
    } catch (e) {
      if (window.toast) toast("Không tải được dữ liệu SharePoint: " + (e.message || e));
      console.error("[store] syncFromGraph", e);
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

  window.FISG_STORE = { syncFromGraph, debug, loadUsers, profileFor, picMatchReport,
                        findDuplicateCustomers, buildLists };
})();
