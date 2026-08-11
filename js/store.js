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
      /* Ngày sales bấm "Hoàn thành". Rỗng = chưa xong. Chọn kiểu Date thay vì
         Yes/No vì nó trả lời được cả câu "xong lúc nào", thứ báo cáo tuần cần. */
      CompletedDate: "Ngày hoàn thành",
    },
    // Pipelines: mỗi dòng = một giai đoạn của một NCC.
    Pipelines: {
      Supplier: "NCC", Stage: "Giai đoạn", StageOrder: "Thứ tự",
      StageGroup: "Nhóm giai đoạn", WinProbability: "Xác suất thắng %",
    },
    // ProjectUpdates: nhật ký thay đổi của từng dự án -> tab "Trao đổi".
    ProjectUpdates: {
      Project: "Dự án", PICName: "Người cập nhật", UpdateDate: "Ngày cập nhật", Content: "Nội dung",
    },
    // Users: phân quyền. Title = email đăng nhập.
    Users: { Email: "Email", PICName: "Tên PIC", Role: "Vai trò", FullName: "Tên đầy đủ",
             /* ReportsTo = line báo cáo (gửi báo cáo tuần cho ai). Supports = với
                vai trò Sale Support, danh sách sales được hỗ trợ (ngăn dấu phẩy). */
             ReportsTo: "Báo cáo cho", Supports: "Hỗ trợ sales" },
    /* Customers: danh bạ khách hàng. Title = tên gọn (đã bỏ tiền tố pháp nhân);
       Owner = sales phụ trách khách này; LegalName = tên pháp nhân đầy đủ. */
    Customers: { Owner: "Người phụ trách", LegalName: "Tên pháp nhân",
                 Segment: "Segment", Region: "Region", CustomerStatus: "Trạng thái" },
    /* Reports: báo cáo tuần sales gửi cho quản lý. Title = mã báo cáo. */
    Reports: {
      PICName: "Người gửi", WeekLabel: "Tuần", ReportDate: "Ngày gửi",
      Content: "Nhận xét", StatsJson: "Số liệu", Recipients: "Người nhận",
    },
    /* ReportComments: phản hồi hai chiều trên một báo cáo. */
    ReportComments: {
      ReportCode: "Mã báo cáo", PICName: "Người viết", AuthorRole: "Vai trò",
      CommentDate: "Ngày", Content: "Nội dung",
    },
    /* Attachments: tệp đính kèm cho hoạt động / báo cáo. File thật trong Document
       Library; list này giữ metadata + liên kết. */
    Attachments: {
      ParentType: "Loại", ParentId: "Mã tham chiếu", FileName: "Tên tệp",
      FileType: "Định dạng", Size: "Kích thước", WebUrl: "Đường dẫn",
      DriveItemId: "DriveItemId", FolderPath: "Thư mục",
      PICName: "Người tải", UploadDate: "Ngày tải",
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
    function get(f, key) {
      const a = actual(key);
      if (!a) return undefined;
      let v = f[a];
      if (v === undefined) v = f[a + "LookupId"];
      return v;
    }
    /* Ghi thì cần TÊN CỘT THẬT, không phải giá trị: SharePoint mã hoá tên cột
       tiếng Việt thành kiểu OData__x004e_CC, đoán bừa là ghi trượt im lặng. */
    get.internal = actual;
    return get;
  }

  function txt(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
    if (typeof v === "object")
      return v.LookupValue || v.Label || v.displayName || v.Title || v.Value || "";
    return String(v);
  }

  /* Cột "Người liên quan" có thể là Person nhiều giá trị (mảng object), mảng
     chuỗi, hay ô text ngăn cách bằng dấu phẩy/chấm phẩy. Nhận cả ba. */
  function nameList(v) {
    if (v == null || v === "") return [];
    const arr = Array.isArray(v) ? v : String(txt(v)).split(/[,;|]/);
    const seen = {}, out = [];
    arr.map(x => txt(x).trim()).forEach(n => {
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); }
    });
    return out;
  }

  /* Graph thường chỉ trả "<Cột>LookupId" (ID), không kèm tên -> cần bảng tra ID→Title.

     LƯU Ý ĐẮT GIÁ: base phải là TÊN CỘT THẬT, không phải khoá logic. Bản trước
     gọi lookupVal(f, "Customer", …) trong khi cột trên SharePoint có internal
     name khác (SharePoint sinh Customer0, hoặc mã hoá tên tiếng Việt), nên
     f.CustomerLookupId không tồn tại và mọi khách hàng đọc về đều RỖNG — dù
     trên SharePoint nhìn vẫn thấy đủ. Phía ghi thì dò tên đúng, nên dữ liệu lên
     được mà đọc về lại mất. Dùng lookupOf() bên dưới thay vì gọi thẳng. */
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

  /* Tra theo KHOÁ LOGIC, tự resolve sang tên cột thật bằng chính bộ dò của
     getter. Thiếu getter thì lùi về tên logic — vẫn đúng khi cột trùng tên. */
  function lookupOf(get, f, key, map) {
    const base = (get && get.internal && get.internal(key)) || key;
    return lookupVal(f, base, map);
  }
  /* Field thường (không phải lookup) cũng vậy: đọc qua getter, đừng gõ f.Xxx. */
  function txtOf(get, f, key) { return txt(get ? get(f, key) : f[key]); }

  async function idTitleMap(listName) {
    try {
      const items = await FISG_GRAPH.listItems(listName);
      const m = {};
      items.forEach(it => { m[String(it.id)] = txt((it.fields || {}).Title); });
      return m;
    } catch (e) { return {}; }
  }

  /* Danh bạ khách hàng: Title (tên gọn) + Owner (chủ sở hữu) + LegalName (tên
     pháp nhân). Trả về mảng {name, owner, legal, spId} và dựng luôn hai bảng tra
     theo custOwnerKey. custOwnerKey khớp cả tên trên list lẫn tên trong dự án dù
     một bên còn tiền tố "Công ty…", nên phân quyền và danh bạ ăn khớp nhau. */
  async function loadCustomerDirectory() {
    const key = (typeof custOwnerKey === "function")
      ? custOwnerKey : function (s) { return String(s == null ? "" : s).trim().toUpperCase(); };
    let items = [];
    try {
      const [cols, its] = await Promise.all([
        FISG_GRAPH.columns("Customers"), FISG_GRAPH.listItems("Customers"),
      ]);
      const g = makeGetter("Customers", cols);
      items = (its || []).map(it => {
        const f = it.fields || {};
        return {
          name: txt(f.Title),
          owner: txtOf(g, f, "Owner"),
          legal: txtOf(g, f, "LegalName"),
          segment: txtOf(g, f, "Segment"),
          region: txtOf(g, f, "Region"),
          status: txtOf(g, f, "CustomerStatus"),
          spId: it.id,
        };
      }).filter(c => c.name);
    } catch (e) {
      console.warn("[store] không đọc được list Customers:", e.message || e);
      items = [];
    }
    CUSTOMER_DIR.length = 0;
    Object.keys(CUSTOMER_OWNER).forEach(k => delete CUSTOMER_OWNER[k]);
    Object.keys(CUSTOMER_LEGAL).forEach(k => delete CUSTOMER_LEGAL[k]);
    /* GỘP TRÙNG: list Customers có thể có nhiều dòng cùng một khách (nhập trùng,
       tên thương hiệu + tên pháp nhân…). Nếu để nguyên thì datalist khi tạo mới
       hiện 2 giá trị giống hệt. Gộp theo tên đã chuẩn hoá, ưu tiên bản đã có
       người phụ trách, điền nốt các trường còn thiếu. */
    const seen = {};   // key chuẩn hoá -> vị trí trong CUSTOMER_DIR
    items.forEach(c => {
      const k = key(c.name);
      if (k && seen[k] !== undefined) {
        const ex = CUSTOMER_DIR[seen[k]];
        if (!ex.owner && c.owner) ex.owner = c.owner;
        if (!ex.legal && c.legal) ex.legal = c.legal;
        if (!ex.segment && c.segment) ex.segment = c.segment;
        if (!ex.region && c.region) ex.region = c.region;
        if (!ex.status && c.status) ex.status = c.status;
      } else {
        if (k) seen[k] = CUSTOMER_DIR.length;
        CUSTOMER_DIR.push(c);
      }
      if (k && c.owner && !CUSTOMER_OWNER[k]) CUSTOMER_OWNER[k] = c.owner;
      if (k && c.legal && !CUSTOMER_LEGAL[k]) CUSTOMER_LEGAL[k] = c.legal;
    });
    return CUSTOMER_DIR.length;
  }

  /* Chủ sở hữu của một khách hàng theo tên. Không có trong danh bạ → '' (khách
     chưa gán chủ giữ nguyên phân quyền theo PIC dự án). Toàn cục để roles.js
     dùng mà không phải phụ thuộc vào store. */
  function customerOwnerOf(name) {
    if (!name) return "";
    const key = (typeof custOwnerKey === "function")
      ? custOwnerKey : function (s) { return String(s || "").trim().toUpperCase(); };
    return CUSTOMER_OWNER[key(name)] || "";
  }
  window.customerOwnerOf = customerOwnerOf;
  function customerLegalOf(name) {
    if (!name) return "";
    const key = (typeof custOwnerKey === "function")
      ? custOwnerKey : function (s) { return String(s || "").trim().toUpperCase(); };
    return CUSTOMER_LEGAL[key(name)] || "";
  }
  window.customerLegalOf = customerLegalOf;

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
    /* In THẲNG từng dòng. Console gói mảng dài thành "Array(15)" phải bấm mới
       mở, mà cảnh báo phải đọc được ngay mới có tác dụng. */
    const uniqUnknown = [...new Set(unknown)];
    if (uniqUnknown.length) {
      console.warn("[store] " + uniqUnknown.length + " giai đoạn có trong dữ liệu nhưng "
        + "không có trong cấu hình — đã thêm vào cuối pipeline để không dự án nào biến mất:");
      uniqUnknown.forEach(x => console.warn("   " + x));
      console.warn("   Sửa ở list Pipelines trên SharePoint, hoặc js/data/catalog.js.");
    }

    /* resetCatalog() trả LISTS về tên gốc "Kimica-Navido"; đổi lại ngay tại đây
       thay vì trông chờ hook chạy sau syncFromGraph. */
    if (window.FISG_RENAME_NCC) FISG_RENAME_NCC();
    if (window.rebuildDerived) rebuildDerived();
    return { pipelineFromList: !!(pipe && pipe.length), unknownStages: uniqUnknown };
  }

  /* ---------- NGƯỜI DÙNG & PHÂN QUYỀN ----------
     Nguồn sự thật là list Users trên SharePoint. Nếu list chưa tồn tại, KHÔNG
     khoá cửa: quay về quy tắc cũ (ADMIN_EMAIL = superadmin, còn lại manager) và
     báo rõ để người quản trị tạo list. */
  const ROLE_COLOR = { superadmin: "#1E3A8A", director: "#6D28D9", manager: "#0E7490",
                       rnd: "#B45309", sales: "#0D9488", salesupport: "#0E9F6E", guest: "#6D28D9" };
  function isKnownRoleSafe(r) {
    return (typeof isKnownRole === "function") ? isKnownRole(r)
      : ["sales", "rnd", "manager", "director", "superadmin"].indexOf(r) >= 0;
  }
  let usersLoaded = false, usersWritable = false, userCols = null;
  const USERS_LIST = () => (CFG && CFG.USERS_LIST) || "Users";

  /* Tên cột THẬT để ghi. SharePoint hay mã hoá internal name của cột tiếng Việt,
     nên phải dò ngược từ displayName giống lúc đọc. */
  function userField(logical) {
    if (!userCols) return logical;
    if (userCols[logical] !== undefined) return logical;
    const label = (LABELS.Users || {})[logical];
    const hit = Object.keys(userCols).filter(k => userCols[k] === label || userCols[k] === logical)[0];
    return hit || logical;
  }
  function canWriteUsers() {
    return !!(usersWritable && window.FISG_GRAPH && window.FISG_AUTH && FISG_AUTH.account());
  }

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
        /* PICName có thể chứa NHIỀU tên, ngăn bởi dấu phẩy: dữ liệu cũ ghi cùng
           một người khi thì "Ngoc", khi thì "Bich Ngoc". */
        const picRaw = txt(g(f, "PICName")) || null;
        const full = txt(g(f, "FullName")) || null;
        const first = (typeof splitAliases === "function" ? splitAliases(picRaw) : [])[0] || null;
        return {
          spId: it.id,
          email: email,
          /* picRaw = đúng giá trị PICName đang lưu trên SharePoint. pic = giá trị
             ĐANG DÙNG, sẽ bị applyPicAliases đổi sang tên đầy đủ. Tách hai thứ ra
             để lúc ghi lại không đè mất bảng ánh xạ. */
          picRaw: picRaw,
          fullName: full,
          name: full || first || email,
          /* pic = tên ĐANG DÙNG (một chuỗi), không phải cả danh sách tên tắt. */
          pic: full || first || null,
          role: isKnownRoleSafe(role) ? role : "sales",
          color: ROLE_COLOR[role] || "#0D9488",
          reportsTo: txt(g(f, "ReportsTo")) || null,
          supports: (typeof splitAliases === "function" ? splitAliases(txt(g(f, "Supports"))) : []),
        };
      }).filter(u => u.email);
      if (!rows.length) throw new Error("list " + listName + " rỗng");
      USERS.length = 0; rows.forEach(u => USERS.push(u));
      usersLoaded = true; usersWritable = true; userCols = cols;
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
      /* Lần đầu người này đăng nhập: lưu lại tên O365 để bảng ánh xạ dùng được
         cho cả những người chưa bao giờ đăng nhập. Ghi hỏng thì bỏ qua. */
      if (full && !u.fullName) {
        u.fullName = full;
        if (canWriteUsers()) saveUser(u).catch(e =>
          console.warn("[store] không lưu được FullName:", e.message || e));
      }
      if (window.buildUsers) buildUsers();
      return { user: u, fromList: ok, index: USERS.indexOf(u) };
    }
    if (ok) return { user: null, fromList: true, index: -1 };
    /* Chưa có list Users — dùng quy tắc dự phòng để không khoá cửa. */
    const isAdmin = mail === String((CFG && CFG.ADMIN_EMAIL) || "").toLowerCase();
    u = { name: full || email, email: email, pic: full || null,
          picRaw: null, fullName: full || null,
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

  /* ---------- GHI NGƯỢC LIST USERS ----------
     Màn "Người dùng & phân quyền" là nơi duy nhất người quản trị chạm vào phân
     quyền; mọi thay đổi ở đó phải đi thẳng lên SharePoint, không dừng ở bộ nhớ. */
  function userFields(u) {
    const f = {};
    f.Title = u.email;
    const fe = userField("Email"), fp = userField("PICName"),
          fr = userField("Role"), fn = userField("FullName");
    if (fe !== "Title") f[fe] = u.email;
    /* Ghi picRaw, KHÔNG ghi u.pic — u.pic đã bị đổi sang tên đầy đủ, ghi nó lên
       sẽ xoá mất chính bảng ánh xạ đang dùng. */
    f[fp] = u.picRaw || "";
    f[fr] = u.role;
    f[fn] = u.fullName || "";
    /* Line báo cáo + danh sách sales hỗ trợ — chỉ ghi khi list CÓ cột (tránh
       Graph từ chối cả request vì một field lạ). */
    if (userCols && userCols[userField("ReportsTo")]) f[userField("ReportsTo")] = u.reportsTo || "";
    if (userCols && userCols[userField("Supports")])
      f[userField("Supports")] = (u.supports || []).join(", ");
    return f;
  }

  async function saveUser(u) {
    if (!canWriteUsers()) throw new Error("chưa đọc được list " + USERS_LIST() + " nên không ghi được");
    const fields = userFields(u);
    if (u.spId) {
      await FISG_GRAPH.updateItem(USERS_LIST(), u.spId, fields);
    } else {
      const created = await FISG_GRAPH.createItem(USERS_LIST(), fields);
      if (created && created.id) u.spId = created.id;
    }
    return u;
  }

  async function deleteUser(u) {
    if (!canWriteUsers()) throw new Error("chưa đọc được list " + USERS_LIST() + " nên không xoá được");
    if (u.spId) await FISG_GRAPH.deleteItem(USERS_LIST(), u.spId);
    const i = USERS.indexOf(u);
    if (i >= 0) USERS.splice(i, 1);
  }

  /* Tra tên hiển thị O365 từ email — đây chính là giá trị PIC mà cột Person
     trong list Projects trả về, nên điền sẵn vào PICName là khớp luôn. */
  async function lookupUser(email) {
    if (!(window.FISG_GRAPH && window.FISG_AUTH && FISG_AUTH.account())) return null;
    return FISG_GRAPH.lookupPerson(email);
  }

  /* ---------- ĐỔI TÊN PIC THEO LIST USERS ----------
     Dữ liệu cũ ghi tên tắt ("Bich Ngoc"); list Users biết tên đầy đủ tương ứng
     ("Phạm Bích Ngọc"). Thay khi hiển thị, KHÔNG ghi ngược lên SharePoint.

     Chạy được nhiều lần mà không hỏng: sau lượt đầu, khoá tên tắt không còn
     khớp gì nữa. Nhờ vậy ui-kit.js lấy được danh bạ O365 muộn hơn vẫn gọi lại
     được để lấp nốt những tên còn thiếu. */
  function picAliasMap(extra) {
    const m = {};
    USERS.forEach(u => {
      const to = u.fullName;
      if (!to) return;
      const list = (typeof splitAliases === "function") ? splitAliases(u.picRaw) : [];
      list.forEach(from => { if (picKey(from) !== picKey(to)) m[picKey(from)] = to; });
    });
    if (extra) Object.keys(extra).forEach(k => {
      if (extra[k] && picKey(k) !== picKey(extra[k])) m[picKey(k)] = extra[k];
    });
    return m;
  }

  function applyPicAliases(extra) {
    const map = picAliasMap(extra);
    const n = Object.keys(map).length;
    if (!n) return { changed: 0, map: map };
    const F = v => (v && map[picKey(v)]) || v;
    let changed = 0;
    const bump = (obj, key) => {
      const next = F(obj[key]);
      if (next !== obj[key]) { obj[key] = next; changed++; }
    };
    RECORDS.forEach(r => { bump(r, "pic"); bump(r, "rnd"); });
    ACTIVITIES.forEach(a => { bump(a, "pic"); });
    USERS.forEach(u => { if (u.pic) bump(u, "pic"); });
    if (typeof me !== "undefined" && me && me.pic) bump(me, "pic");
    if (changed) {
      if (typeof resetPicLabels === "function") resetPicLabels();
      if (typeof invalidateCockpit === "function") invalidateCockpit();
    }
    return { changed: changed, map: map };
  }

  /* ---------- DỌN BẢN GHI MẪU ----------
     Dữ liệu mẫu từng được nạp lên list Activities lúc thử nghiệm. App không còn
     nhúng dữ liệu nào, nên muốn bỏ chúng phải xoá trên SharePoint.
     Liệt kê trước, xoá sau — và chỉ xoá đúng id bạn chỉ định. */
  const SEED_NOTES = [
    "Trao đổi qua Zalo về mẫu đang thử",
    "Giới thiệu sản phẩm mới tại seminar ngành",
    "Khách tham dự hội thảo ứng dụng",
    "Gọi xác nhận nhu cầu sản lượng năm nay",
    "Khách quan tâm giải pháp thay thế CMC",
    "Gửi mẫu 200g tuần sau",
  ];
  function findSeedActivities() {
    const hits = ACTIVITIES.filter(a =>
      SEED_NOTES.some(n => String(a.note || "").trim() === n));
    console.log("=== Hoạt động trùng nội dung dữ liệu mẫu: " + hits.length + " ===");
    hits.forEach(a => console.log("  " + a.id + "  " + normDate(a.date) + "  "
      + (a.pic || "—") + "  ·  " + (a.customer || "—") + "  ·  " + a.note));
    if (!hits.length) console.log("  (không có)");
    else console.log("Xoá tất cả: FISG_STORE.deleteSeedActivities()");
    return hits;
  }

  /* Xoá thật trên SharePoint. Chỉ superadmin, và phải xác nhận. */
  async function deleteSeedActivities(list) {
    const hits = list || findSeedActivities();
    if (!hits.length) return 0;
    if (typeof me !== "undefined" && me && !cap(me.role).admin) {
      console.warn("[store] chỉ Super Admin mới xoá được.");
      return 0;
    }
    if (typeof confirm === "function"
        && !confirm("Xoá vĩnh viễn " + hits.length + " hoạt động khỏi list Activities trên SharePoint?\n\n"
                    + "Không hoàn tác được."))
      return 0;
    let n = 0;
    for (const a of hits) {
      if (!a.spId) continue;
      try {
        await FISG_GRAPH.deleteItem("Activities", a.spId);
        const i = ACTIVITIES.indexOf(a); if (i >= 0) ACTIVITIES.splice(i, 1);
        n++;
      } catch (e) { console.warn("[store] không xoá được " + a.id + ":", e.message || e); }
    }
    if (typeof invalidateCockpit === "function") invalidateCockpit();
    if (window.renderActs) try { renderActs(); } catch (e) {}
    if (window.renderCockpit) try { renderCockpit(); } catch (e) {}
    if (window.toast) toast("Đã xoá " + n + " hoạt động khỏi SharePoint.");
    return n;
  }

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

  /* ==================== GHI LÊN SHAREPOINT ====================
     Cho tới bản này app chỉ ĐỌC: mọi hoạt động sales nhập chỉ nằm trong
     localStorage của chính trình duyệt đó, nên manager không bao giờ thấy; dự án
     tạo/sửa trong app thì mất hẳn khi tải lại trang. Khối dưới đây là đường ghi.

     Ba nguyên tắc:
       1. Không đoán tên cột. Dùng đúng bộ dò tên như phía đọc (get.internal).
          Cột không tồn tại thì BỎ QUA field đó và cảnh báo, không ném lỗi —
          thiếu một cột phụ không đáng làm hỏng cả thao tác lưu.
       2. Ghi hỏng thì nói thẳng. Không nuốt lỗi, không giả vờ đã lưu.
       3. Việc nhập vẫn còn trong localStorage cho tới khi lên được SharePoint,
          và tự thử lại ở lần đồng bộ sau. */

  const _schema = {};
  async function schemaOf(list) {
    if (_schema[list]) return _schema[list];
    const cols = await FISG_GRAPH.columns(list);
    const get = makeGetter(list, cols);
    get.cols = cols;
    _schema[list] = get;
    return get;
  }

  /* Bảng tra Tên → id của các list danh mục (Customers, Products, Suppliers). */
  /* Sơ đồ cột đọc một lần rồi nhớ suốt phiên. Thêm cột trên SharePoint giữa
     chừng thì app chưa thấy — gọi FISG_STORE.forgetSchema() (hoặc F5). */
  function forgetSchema() {
    Object.keys(_schema).forEach(k => delete _schema[k]);
    Object.keys(_lk).forEach(k => delete _lk[k]);
    console.info("[store] đã quên sơ đồ cột — lần ghi tới sẽ đọc lại từ SharePoint.");
    return true;
  }

  const _lk = {};
  function lkKey(v) { return String(v == null ? "" : v).trim().toLowerCase(); }
  async function lookupTable(list) {
    if (_lk[list]) return _lk[list];
    const items = await FISG_GRAPH.listItems(list);
    const m = {};
    items.forEach(it => {
      const t = lkKey(txt((it.fields || {}).Title));
      if (t && !m[t]) m[t] = it.id;
    });
    _lk[list] = m;
    return m;
  }
  /* create=true: khách hàng / nguyên liệu mới sales gõ tay thì tạo luôn dòng
     danh mục. Nhà cung cấp thì KHÔNG — danh sách NCC là cố định, và "Khác"
     không phải một NCC nên không được sinh ra dòng rác.

     opts.owner: khi tạo MỘT khách hàng mới, gán luôn chủ sở hữu (sales đang
     đăng nhập) và ghi tên gọn vào Title, tên gốc vào LegalName — để khách vừa
     nhập tuân đúng quy ước của danh bạ, không phải dọn tay sau. */
  async function lookupId(list, title, create, opts) {
    const name = String(title == null ? "" : title).trim();
    if (!name) return null;
    const m = await lookupTable(list);
    const k = lkKey(name);
    if (m[k]) return m[k];
    if (!create) return null;

    const fields = { Title: name };
    if (list === "Customers") {
      const clean = (typeof cleanCustomerName === "function") ? cleanCustomerName(name) : name;
      fields.Title = clean;
      try {
        const g = await schemaOf("Customers");
        if (clean !== name) put(fields, g, "LegalName", name);
        if (opts && opts.owner) put(fields, g, "Owner", opts.owner);
      } catch (e) { /* thiếu cột thì vẫn tạo được dòng, chỉ không có chủ */ }
    }
    const it = await FISG_GRAPH.createItem(list, fields);
    m[k] = it.id;
    if (list === "Customers") {
      const key = (typeof custOwnerKey === "function") ? custOwnerKey : lkKey;
      const c = { name: fields.Title, owner: (opts && opts.owner) || "", legal: name, spId: it.id };
      CUSTOMER_DIR.push(c);
      const ck = key(c.name);
      if (ck && c.owner) CUSTOMER_OWNER[ck] = c.owner;
      if (ck && name !== c.name) CUSTOMER_LEGAL[ck] = name;
    }
    return it.id;
  }

  /* ==================== NHẬP / CẬP NHẬT HÀNG LOẠT KHÁCH HÀNG ====================
     Nhận danh sách dòng đã parse từ Excel (mỗi dòng {title, owner, legal, segment,
     region, status}), đối chiếu với list Customers ĐANG CÓ rồi UPSERT:
       · khách đã có (khớp theo tên gọn của Title HOẶC LegalName) → CẬP NHẬT
       · khách chưa có → TẠO MỚI

     Ba cam kết "không sót data":
       1. Mỗi dòng có Title đều cho ra đúng một update hoặc một create — hoặc một
          lỗi ĐƯỢC BÁO, không bao giờ âm thầm bỏ.
       2. KHÔNG xoá dữ liệu đang có: Owner/LegalName ghi đè (đó là mục đích cập
          nhật), còn Segment/Region/CustomerStatus chỉ điền khi ô đang trống.
       3. Chạy lại nhiều lần vẫn đúng: lần hai khách cũ đã khớp nên chỉ cập nhật,
          không nhân bản. */
  function planCustomerUpsert(rows, index) {
    const key = (typeof custOwnerKey === "function") ? custOwnerKey
      : function (s) { return String(s || "").trim().toUpperCase(); };
    const clean = (typeof cleanCustomerName === "function") ? cleanCustomerName
      : function (s) { return String(s || "").trim(); };
    const plan = [];
    (rows || []).forEach(r => {
      const rawTitle = String(r.title || "").trim() || clean(r.legal || "");
      if (!rawTitle) { plan.push({ row: r, action: "skip", why: "thiếu tên" }); return; }
      const kTitle = key(rawTitle);
      const kLegal = r.legal ? key(r.legal) : "";
      const hit = index[kTitle] || (kLegal && index[kLegal]) || null;
      if (hit) plan.push({ row: r, action: "update", spId: hit.spId, existing: hit.fields, k: kTitle });
      else plan.push({ row: r, action: "create", title: clean(rawTitle), k: kTitle });
    });
    return plan;
  }

  async function customerIndex() {
    const key = (typeof custOwnerKey === "function") ? custOwnerKey
      : function (s) { return String(s || "").trim().toUpperCase(); };
    const [cols, items] = await Promise.all([
      FISG_GRAPH.columns("Customers"), FISG_GRAPH.listItems("Customers"),
    ]);
    const g = makeGetter("Customers", cols);
    const idx = {};
    items.forEach(it => {
      const f = it.fields || {};
      const entry = { spId: it.id, fields: f };
      const kt = key(txt(f.Title));
      if (kt && !idx[kt]) idx[kt] = entry;
      const kl = key(txtOf(g, f, "LegalName"));
      if (kl && !idx[kl]) idx[kl] = entry;
    });
    return { idx, get: g };
  }

  /* onProgress(done, total, phase). Trả về báo cáo {updated, created, skipped,
     failed, errors[]}. Ghi TUẦN TỰ theo lô nhỏ để không vượt giới hạn tốc độ
     Graph; api() đã tự retry khi 429. */
  async function bulkUpsertCustomers(rows, onProgress) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const { idx, get } = await customerIndex();
    if (!get.internal("Owner"))
      throw new Error('list Customers thiếu cột "Người phụ trách" (Owner). Xem docs/SharePoint_Setup.md mục 3f.');

    const plan = planCustomerUpsert(rows, idx);
    const total = plan.length;
    const rep = { updated: 0, created: 0, skipped: 0, failed: 0, errors: [] };
    let done = 0;

    const has = k => !!get.internal(k);
    function fillFields(f, r, existing) {
      /* Owner + LegalName: authoritative → ghi đè khi có giá trị mới. */
      if (r.owner) put(f, get, "Owner", r.owner);
      if (r.legal) put(f, get, "LegalName", r.legal);
      /* Segment/Region/CustomerStatus: chỉ điền khi ô đang trống, giữ dữ liệu cũ. */
      [["segment", "Segment"], ["region", "Region"], ["status", "CustomerStatus"]].forEach(([rk, ck]) => {
        if (!r[rk] || !has(ck)) return;
        const cur = existing ? txt(existing[get.internal(ck)]) : "";
        if (!cur) put(f, get, ck, r[rk]);
      });
    }

    async function one(step) {
      try {
        if (step.action === "skip") { rep.skipped++; return; }
        if (step.action === "update") {
          const f = {};
          fillFields(f, step.row, step.existing);
          if (Object.keys(f).length) await FISG_GRAPH.updateItem("Customers", step.spId, f);
          rep.updated++;
        } else {
          const f = { Title: step.title };
          fillFields(f, step.row, null);
          const it = await FISG_GRAPH.createItem("Customers", f);
          idx[step.k] = { spId: it.id, fields: f };   // để dòng trùng sau không tạo lại
        rep.created++;
        }
      } catch (e) {
        rep.failed++;
        rep.errors.push((step.row.title || step.title || "?") + ": " + (e.message || e));
      } finally {
        done++;
        if (onProgress) try { onProgress(done, total); } catch (e) {}
      }
    }

    /* Lô 4 request song song — đủ nhanh mà không dồn Graph. */
    const BATCH = 4;
    for (let i = 0; i < plan.length; i += BATCH) {
      await Promise.all(plan.slice(i, i + BATCH).map(one));
    }
    /* Nạp lại danh bạ trong bộ nhớ để app thấy ngay. */
    try { await loadCustomerDirectory(); } catch (e) {}
    if (window.renderCustomers) try { renderCustomers(); } catch (e) {}
    return rep;
  }

  /* ==================== NHẬP NHÀ CUNG CẤP ====================
     Chỉ thêm TÊN nhà cung cấp vào list Suppliers: có rồi thì bỏ qua, chưa có thì
     tạo. Không đụng dữ liệu khác. Đối chiếu theo tên chuẩn hoá (bỏ khoảng trắng
     thừa + hoa hết) nên "IFF" và " iff " coi là một, không tạo trùng. */
  function supKey(s){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); }

  async function supplierIndex() {
    const items = await FISG_GRAPH.listItems("Suppliers");
    const idx = {};
    items.forEach(it => {
      const k = supKey(txt((it.fields || {}).Title));
      if (k && !idx[k]) idx[k] = it.id;
    });
    return idx;
  }

  async function previewSupplierUpsert(names) {
    const idx = await supplierIndex();
    const seen = {};
    let create = 0, skip = 0;
    (names || []).forEach(n => {
      const k = supKey(n);
      if (!k) { skip++; return; }
      if (idx[k] || seen[k]) { skip++; return; }
      seen[k] = 1; create++;
    });
    return { create, skip, total: (names || []).length };
  }

  async function bulkUpsertSuppliers(names, onProgress) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const idx = await supplierIndex();
    const list = [], seen = {};
    (names || []).forEach(n => {
      const k = supKey(n);
      if (!k || idx[k] || seen[k]) return;         // rỗng / đã có / trùng trong file
      seen[k] = 1; list.push(String(n).replace(/\s+/g, " ").trim());
    });
    const rep = { created: 0, skipped: (names || []).length - list.length, failed: 0, errors: [] };
    let done = 0;
    const BATCH = 4;
    async function one(name) {
      try {
        const it = await FISG_GRAPH.createItem("Suppliers", { Title: name });
        idx[supKey(name)] = it.id;
        rep.created++;
      } catch (e) {
        rep.failed++; rep.errors.push(name + ": " + (e.message || e));
      } finally {
        done++; if (onProgress) try { onProgress(done, list.length); } catch (e) {}
      }
    }
    for (let i = 0; i < list.length; i += BATCH)
      await Promise.all(list.slice(i, i + BATCH).map(one));
    return rep;
  }

  /* Đếm trước khi ghi (dry-run): bao nhiêu update / create / skip. */
  async function previewCustomerUpsert(rows) {
    const { idx } = await customerIndex();
    const plan = planCustomerUpsert(rows, idx);
    const r = { update: 0, create: 0, skip: 0, total: plan.length };
    plan.forEach(p => { r[p.action]++; });
    return r;
  }

  /* ==================== BÁO CÁO TUẦN + PHẢN HỒI ====================
     Reports = báo cáo đã gửi; ReportComments = luồng trao đổi. Cả hai đọc/ghi
     qua Graph như mọi list khác (tự dò internal name). Bản nháp CHƯA gửi vẫn ở
     localStorage — chỉ khi bấm gửi mới có dòng trên SharePoint. */
  async function loadReports() {
    if (!canWrite()) return 0;
    let reps = [], cmts = [], gr, gc;
    try {
      const [rCols, rItems] = await Promise.all([
        FISG_GRAPH.columns("Reports"), FISG_GRAPH.listItems("Reports"),
      ]);
      gr = makeGetter("Reports", rCols);
      reps = rItems;
    } catch (e) {
      console.warn("[store] không đọc được list Reports:", e.message || e);
      REPORTS.length = 0;
      return 0;
    }
    try {
      const [cCols, cItems] = await Promise.all([
        FISG_GRAPH.columns("ReportComments"), FISG_GRAPH.listItems("ReportComments"),
      ]);
      gc = makeGetter("ReportComments", cCols);
      cmts = cItems;
    } catch (e) { cmts = []; }

    /* gom phản hồi theo mã báo cáo (Title của Reports). */
    const byCode = {};
    (cmts || []).forEach(it => {
      const f = it.fields || {};
      const code = txtOf(gc, f, "ReportCode") || txt(f.Title);
      if (!code) return;
      (byCode[code] = byCode[code] || []).push({
        by: txt(f.PICName) || txtOf(gc, f, "PICName"),
        role: txtOf(gc, f, "AuthorRole"),
        at: (txtOf(gc, f, "CommentDate") || "").slice(0, 10),
        text: txtOf(gc, f, "Content"),
        spId: it.id,
      });
    });
    Object.keys(byCode).forEach(k => byCode[k].sort((a, b) => (a.at || "").localeCompare(b.at || "")));

    REPORTS.length = 0;
    (reps || []).forEach(it => {
      const f = it.fields || {};
      const code = txt(f.Title);
      let snap = {};
      try { snap = JSON.parse(txtOf(gr, f, "StatsJson") || "{}"); } catch (e) { snap = {}; }
      const pic = txt(f.PICName) || txtOf(gr, f, "PICName");
      REPORTS.push({
        id: code, spId: it.id, pic: pic,
        picLabel: (typeof picLabel === "function") ? picLabel(pic) : pic,
        weekLabel: txtOf(gr, f, "WeekLabel") || (snap.weekLabel || ""),
        createdAt: (txtOf(gr, f, "ReportDate") || "").slice(0, 10) || snap.createdAt || "",
        note: txtOf(gr, f, "Content"),
        stats: snap.stats || { done: 0, missed: 0, changes: 0, overdue: 0 },
        doneActs: snap.doneActs || [], missedActs: snap.missedActs || [],
        projectChanges: snap.projectChanges || [],
        to: (txtOf(gr, f, "Recipients") || "").split(/[,;]/).map(x => x.trim()).filter(Boolean),
        comments: byCode[code] || [],
      });
    });
    REPORTS.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return REPORTS.length;
  }

  /* Ghi một báo cáo lên list Reports. report là object buildReport() sinh ra +
     {note, to}. Trả về mã báo cáo (Title). */
  async function sendReportToSP(report) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const get = await schemaOf("Reports");
    const code = report.id || ("R-" + Date.now().toString(36).toUpperCase());
    const snap = {
      weekLabel: report.weekLabel, createdAt: report.createdAt || todayISO(),
      stats: report.stats, doneActs: report.doneActs || [],
      missedActs: report.missedActs || [], projectChanges: report.projectChanges || [],
    };
    const f = { Title: code };
    const miss = [];
    const set = (k, v) => { if (v != null && v !== "" && !put(f, get, k, v)) miss.push(k); };
    f.PICName = report.pic || "";
    set("WeekLabel", report.weekLabel);
    set("ReportDate", spDate(report.createdAt || todayISO()));
    set("Content", report.note || "");
    set("StatsJson", JSON.stringify(snap));
    set("Recipients", (report.to || []).join(", "));
    warnMissing("Reports", miss);
    await FISG_GRAPH.createItem("Reports", f);
    try { await loadReports(); } catch (e) {}
    return code;
  }

  /* Thêm một phản hồi vào một báo cáo. */
  async function addReportComment(reportCode, text, by, role) {
    if (!canWrite() || !reportCode || !text) return false;
    const get = await schemaOf("ReportComments");
    const f = { Title: String(reportCode) };
    const miss = [];
    if (!put(f, get, "ReportCode", reportCode)) miss.push("ReportCode");
    f.PICName = by || "";
    if (role && !put(f, get, "AuthorRole", role)) miss.push("AuthorRole");
    if (!put(f, get, "CommentDate", spDate(todayISO()))) miss.push("CommentDate");
    if (!put(f, get, "Content", text)) miss.push("Content");
    warnMissing("ReportComments", miss);
    await FISG_GRAPH.createItem("ReportComments", f);
    try { await loadReports(); } catch (e) {}
    return true;
  }

  /* ==================== TỆP ĐÍNH KÈM ====================
     File thật nằm trong Document Library theo cây thư mục cố định; list
     Attachments giữ metadata để liệt kê đúng theo hoạt động/báo cáo và xoá đúng
     file. Không có scope mới — Sites.ReadWrite.All đủ. */
  const ATT_MAX = 15 * 1024 * 1024;                       // 15MB
  const ATT_ROOT = "FISG_Attachments";                    // folder tổng
  const ATT_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
                   "jpg", "jpeg", "png", "zip"];
  function attExt(name) { const m = /\.([a-z0-9]+)$/i.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; }
  function attKey(t, id) { return String(t) + ":" + String(id); }

  async function loadAttachments() {
    if (!canWrite()) return 0;
    let items = [], g;
    try {
      const [cols, its] = await Promise.all([
        FISG_GRAPH.columns("Attachments"), FISG_GRAPH.listItems("Attachments"),
      ]);
      g = makeGetter("Attachments", cols);
      items = its || [];
    } catch (e) {
      console.warn("[store] không đọc được list Attachments:", e.message || e);
      ATTACHMENTS.length = 0;
      return 0;
    }
    ATTACHMENTS.length = 0;
    items.forEach(it => {
      const f = it.fields || {};
      ATTACHMENTS.push({
        id: txt(f.Title), spId: it.id,
        parentType: txtOf(g, f, "ParentType"),
        parentId: txtOf(g, f, "ParentId"),
        fileName: txtOf(g, f, "FileName") || txt(f.Title),
        fileType: txtOf(g, f, "FileType"),
        size: Number(txtOf(g, f, "Size")) || 0,
        webUrl: txtOf(g, f, "WebUrl"),
        driveItemId: txtOf(g, f, "DriveItemId"),
        folderPath: txtOf(g, f, "FolderPath"),
        by: txt(f.PICName) || txtOf(g, f, "PICName"),
        at: (txtOf(g, f, "UploadDate") || "").slice(0, 10),
      });
    });
    return ATTACHMENTS.length;
  }

  function attachmentsOf(type, id) {
    const k = attKey(type, id);
    return ATTACHMENTS.filter(a => attKey(a.parentType, a.parentId) === k)
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }

  /* Kiểm tra file trước khi tải — trả về chuỗi lỗi hoặc "" nếu hợp lệ. */
  function attValidate(file) {
    if (!file) return "chưa chọn tệp";
    if (file.size > ATT_MAX) return "tệp quá 15MB (" + Math.round(file.size / 1048576) + "MB)";
    if (ATT_EXT.indexOf(attExt(file.name)) < 0)
      return "định dạng không hỗ trợ (chỉ pdf, word, excel, powerpoint, ảnh, zip)";
    return "";
  }

  /* Tải một tệp lên và ghi metadata.
       ctx = { pic, date, customer }  (customer rỗng cho báo cáo → folder "Báo cáo") */
  async function uploadAttachment(parentType, parentId, ctx, file) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const bad = attValidate(file);
    if (bad) throw new Error(bad);

    const pic = FISG_GRAPH.cleanSeg((ctx && ctx.pic) || "Chung");
    const day = String((ctx && ctx.date) || todayISO()).slice(0, 10);
    const leaf = parentType === "report" ? "Báo cáo"
      : FISG_GRAPH.cleanSeg((ctx && ctx.customer) || "Khách hàng");
    const folderPath = [ATT_ROOT, pic, day, leaf].join("/");

    /* tên tệp thêm giờ để không đè nhau */
    const ext = attExt(file.name);
    const base = String(file.name).replace(/\.[a-z0-9]+$/i, "");
    const stamped = base + "-" + new Date().toTimeString().slice(0, 8).replace(/:/g, "") + (ext ? "." + ext : "");

    await FISG_GRAPH.ensureFolder(folderPath);
    const item = await FISG_GRAPH.uploadFile(folderPath, stamped, file);

    const get = await schemaOf("Attachments");
    const f = { Title: item.name || stamped };
    const miss = [];
    const set = (k, v) => { if (v != null && v !== "" && !put(f, get, k, v)) miss.push(k); };
    set("ParentType", parentType);
    set("ParentId", String(parentId));
    set("FileName", item.name || stamped);
    set("FileType", ext);
    set("Size", file.size);
    set("WebUrl", item.webUrl || "");
    set("DriveItemId", item.id || "");
    set("FolderPath", folderPath);
    f.PICName = (typeof me !== "undefined" && me && (me.pic || me.name)) || "";
    set("UploadDate", spDate(todayISO()));
    warnMissing("Attachments", miss);

    let spId = null;
    try {
      const created = await FISG_GRAPH.createItem("Attachments", f);
      spId = created.id;
    } catch (e) {
      /* Ghi metadata hỏng thì gỡ luôn file vừa tải để không rác kho. */
      if (item.id) try { await FISG_GRAPH.deleteDriveItem(item.id); } catch (x) {}
      throw e;
    }
    await loadAttachments();
    return spId;
  }

  async function deleteAttachment(att) {
    if (!canWrite() || !att) return false;
    if (att.driveItemId) {
      try { await FISG_GRAPH.deleteDriveItem(att.driveItemId); }
      catch (e) { console.warn("[store] không xoá được file trên Drive:", e.message || e); }
    }
    if (att.spId) await FISG_GRAPH.deleteItem("Attachments", att.spId);
    const i = ATTACHMENTS.findIndex(a => a.spId === att.spId);
    if (i >= 0) ATTACHMENTS.splice(i, 1);
    return true;
  }

  /* Tạo mới HOẶC sửa một khách hàng trong danh bạ. row:
       { spId?, title, legal, owner, segment, region, status }
     spId rỗng → tạo mới; có spId → cập nhật đúng dòng đó.
     Title ghi tên gọn; các cột khác chỉ ghi khi list CÓ cột tương ứng.
     Trả về spId. Cập nhật luôn danh bạ trong bộ nhớ để app thấy ngay. */
  async function saveCustomer(row) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const get = await schemaOf("Customers");
    const clean = (typeof cleanCustomerName === "function") ? cleanCustomerName
      : function (s) { return String(s || "").trim(); };
    const title = clean(String(row.title || "").trim() || row.legal || "");
    if (!title) throw new Error("thiếu tên khách hàng");

    const f = {};
    /* Đổi tên: chỉ ghi Title khi khác, để không đụng dòng vô ích. */
    const isNew = !row.spId;
    if (isNew) f.Title = title;
    else {
      /* khi sửa, cho phép đổi tên gọn */
      if (row.title != null) f.Title = title;
    }
    if (row.owner != null) put(f, get, "Owner", row.owner);
    if (row.legal != null) put(f, get, "LegalName", row.legal);
    [["segment", "Segment"], ["region", "Region"], ["status", "CustomerStatus"]].forEach(([rk, ck]) => {
      if (row[rk] != null && get.internal(ck)) put(f, get, ck, row[rk]);
    });

    let spId = row.spId;
    if (isNew) {
      const it = await FISG_GRAPH.createItem("Customers", f);
      spId = it.id;
    } else {
      if (Object.keys(f).length) await FISG_GRAPH.updateItem("Customers", spId, f);
    }
    try { await loadCustomerDirectory(); } catch (e) {}
    if (window.renderCustomers) try { renderCustomers(); } catch (e) {}
    if (typeof invalidateCockpit === "function") invalidateCockpit();
    return spId;
  }

  /* Xoá một khách hàng khỏi danh bạ (list Customers). Nhận spId hoặc object có
     .spId. Chỉ xoá đúng dòng danh bạ — KHÔNG đụng dự án/hoạt động đã gắn tên
     khách (những bản ghi đó vẫn còn, tránh mất dữ liệu ngoài ý muốn). Quyền do
     lớp UI kiểm (cờ del + ownsCustomer); ở đây chỉ thực thi. */
  async function deleteCustomer(target) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const spId = (target && typeof target === "object") ? target.spId : target;
    if (!spId) throw new Error("thiếu mã dòng khách hàng");
    await FISG_GRAPH.deleteItem("Customers", spId);
    const i = CUSTOMER_DIR.findIndex(c => c.spId === spId);
    if (i >= 0) {
      const k = (typeof custOwnerKey === "function")
        ? custOwnerKey(CUSTOMER_DIR[i].name)
        : String(CUSTOMER_DIR[i].name || "").trim().toUpperCase();
      CUSTOMER_DIR.splice(i, 1);
      if (k && !CUSTOMER_DIR.some(c => (typeof custOwnerKey === "function"
            ? custOwnerKey(c.name) : String(c.name||"").trim().toUpperCase()) === k)) {
        delete CUSTOMER_OWNER[k]; delete CUSTOMER_LEGAL[k];
      }
    }
    if (window.renderCustomers) try { renderCustomers(); } catch (e) {}
    if (typeof invalidateCockpit === "function") invalidateCockpit();
    return true;
  }

  /* Gán / đổi chủ sở hữu một khách hàng. Dùng khi sales tạo KH mới, hoặc admin
     phân công lại. Ghi thẳng lên list Customers để mọi máy cùng thấy. */
  async function setCustomerOwner(name, owner) {
    if (!canWrite() || !name) return "nocol";
    const spId = await lookupId("Customers", name, true, { owner: owner });
    const g = await schemaOf("Customers");
    if (!g.internal("Owner")) {
      console.warn("[store] list Customers chưa có cột \"Người phụ trách\" (Owner).");
      return "nocol";
    }
    const f = {};
    put(f, g, "Owner", owner || "");
    await FISG_GRAPH.updateItem("Customers", spId, f);
    const key = (typeof custOwnerKey === "function") ? custOwnerKey : lkKey;
    const ck = key(name);
    if (ck) { if (owner) CUSTOMER_OWNER[ck] = owner; else delete CUSTOMER_OWNER[ck]; }
    const hit = CUSTOMER_DIR.find(c => key(c.name) === ck);
    if (hit) hit.owner = owner || "";
    return "saved";
  }

  /* Đặt một field vào payload theo TÊN CỘT THẬT. Trả về false nếu list không có
     cột đó — người gọi quyết định có cảnh báo hay không. */
  function put(out, get, key, value, opts) {
    const name = get.internal(key);
    if (!name) return false;
    out[(opts && opts.lookup) ? name + "LookupId" : name] = value;
    return true;
  }
  /* Tên người phụ trách. Phía đọc lấy f.PICName trước rồi mới tới cột PIC, nên
     phía ghi cũng phải theo thứ tự đó — và chỉ ghi khi cột THẬT SỰ tồn tại:
     Graph từ chối nguyên request nếu payload có một field lạ, nghĩa là ghi bừa
     một cột không có sẽ làm hỏng cả thao tác lưu chứ không chỉ mất một ô. */
  function putPic(f, get, value) {
    if (!value) return true;
    if (get.cols && get.cols.PICName) { f.PICName = value; return true; }
    if (put(f, get, "PIC", value)) return true;
    console.warn("[store] không có cột nào để ghi tên người phụ trách "
      + "(cần cột text tên PICName, hoặc cột \"Sale phụ trách\" dạng text).");
    return false;
  }

  function warnMissing(list, keys) {
    if (keys.length)
      console.warn("[store] list " + list + " không có cột: " + keys.join(", ")
        + " — đã bỏ qua khi ghi. Kiểm tra docs/SharePoint_Setup.md.");
  }
  /* SharePoint nhận ISO đầy đủ; ngày trần "2026-08-04" cũng được nhưng một số
     tenant trả về lệch múi giờ, nên gắn giữa trưa UTC cho chắc. */
  function spDate(iso) {
    const d = String(iso || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T12:00:00Z" : null;
  }

  function canWrite() {
    return !!(CFG && CFG.USE_GRAPH && window.FISG_AUTH && FISG_AUTH.account() && window.FISG_GRAPH);
  }

  /* ---------- HOẠT ĐỘNG ---------- */
  async function createActivity(a) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const get = await schemaOf("Activities");
    const miss = [], f = {};
    const set = (k, v, o) => { if (v != null && v !== "" && !put(f, get, k, v, o)) miss.push(k); };

    const other = typeof OTHER_NCC !== "undefined" ? OTHER_NCC : "Khác";
    const [cusId, prodId, supId, projSpId] = await Promise.all([
      lookupId("Customers", a.customer, true, { owner: a.pic || "" }),
      a.product ? lookupId("Products", a.product, true) : null,
      a.ncc && a.ncc !== other ? lookupId("Suppliers", a.ncc, false) : null,
      Promise.resolve(spIdOfProject(a.projectId)),
    ]);
    if (a.ncc && a.ncc !== other && !supId)
      console.warn("[store] không tìm thấy NCC \"" + a.ncc + "\" trong list Suppliers.");

    f.Title = (a.customer || "Hoạt động") + " · " + (a.type || "") ;
    if (cusId) set("Customer", cusId, { lookup: true });
    if (prodId) set("Product", prodId, { lookup: true });
    if (supId) set("Supplier", supId, { lookup: true });
    if (projSpId) set("RelatedProject", projSpId, { lookup: true });
    putPic(f, get, a.pic);
    set("ActivityType", a.type);
    set("ActivityDate", spDate(a.date));
    set("Content", a.note);
    set("NextStep", a.next);
    set("PotentialLevel", a.potential);
    if (a.doneAt) set("CompletedDate", spDate(a.doneAt));
    warnMissing("Activities", miss);

    const it = await FISG_GRAPH.createItem("Activities", f);
    return it.id;
  }
  /* Gắn một hoạt động đã có vào dự án (hoặc sửa vài field lẻ). patch dùng khoá
     logic như phía đọc, vd {RelatedProject: 42}. */
  async function updateActivity(spId, patch) {
    if (!canWrite() || !spId) return false;
    const get = await schemaOf("Activities");
    const miss = [], f = {};
    Object.keys(patch).forEach(k => {
      if (patch[k] === undefined) return;
      const lookup = k === "RelatedProject" || k === "Customer" || k === "Supplier" || k === "Product";
      if (!put(f, get, k, patch[k], { lookup })) miss.push(k);
    });
    warnMissing("Activities", miss);
    if (!Object.keys(f).length) return false;
    await FISG_GRAPH.updateItem("Activities", spId, f);
    return true;
  }

  /* Xoá HẲN một hoạt động khỏi SharePoint. Trước đây thiếu hàm này nên nút xoá
     chỉ bỏ khỏi bộ nhớ — tải lại trang là syncFromGraph đọc lại từ list và hoạt
     động "sống lại". a có thể là object {spId} hoặc thẳng spId. */
  async function deleteActivity(a) {
    const spId = a && typeof a === "object" ? a.spId : a;
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    if (!spId) return false;                       // bản ghi nội bộ chưa lên SP
    await FISG_GRAPH.deleteItem("Activities", spId);
    /* Bỏ luôn khỏi mảng trong bộ nhớ và cờ localStorage để không quay lại. */
    const idx = ACTIVITIES.findIndex(x => x === a || x.spId === spId || x.id === (a && a.id));
    if (idx >= 0) ACTIVITIES.splice(idx, 1);
    if (window.LS && LS.dropAct && a && a.id) LS.dropAct(a.id);
    if (typeof invalidateCockpit === "function") invalidateCockpit();
    return true;
  }

  /* Đánh dấu hoàn thành / gỡ đánh dấu, ghi thẳng lên SharePoint để mọi máy và
     quản lý cùng thấy một sự thật. iso = null nghĩa là gỡ.

     Trả về:
       'saved'   ghi được
       'nocol'   list chưa có cột — người gọi giữ cờ trong máy và nói rõ
       (ném lỗi) mạng/quyền hỏng */
  async function setActivityDone(spId, iso) {
    if (!canWrite()) return "nocol";
    const get = await schemaOf("Activities");
    if (!get.internal("CompletedDate")) {
      console.warn("[store] list Activities chưa có cột \"Ngày hoàn thành\" (CompletedDate) — "
        + "trạng thái hoàn thành đang chỉ lưu trong trình duyệt này. "
        + "Xem docs/SharePoint_Setup.md mục 3e.");
      return "nocol";
    }
    if (!spId) return "nocol";
    const f = {};
    put(f, get, "CompletedDate", iso ? spDate(iso) : null);
    await FISG_GRAPH.updateItem("Activities", spId, f);
    return "saved";
  }

  function spIdOfProject(projectId) {
    if (!projectId) return null;
    const r = RECORDS.find(x => x.id === projectId);
    return r && r.spId ? r.spId : null;
  }

  /* ---------- DỰ ÁN ---------- */
  async function createProject(r) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const get = await schemaOf("Projects");
    const miss = [], f = {};
    const set = (k, v, o) => { if (v != null && v !== "" && !put(f, get, k, v, o)) miss.push(k); };

    const [cusId, prodId, supId] = await Promise.all([
      lookupId("Customers", r.customer, true, { owner: r.pic || "" }),
      lookupId("Products", r.product, true),
      lookupId("Suppliers", r.ncc, false),
    ]);
    f.Title = r.desc || (r.customer + " · " + r.product);
    if (cusId) set("Customer", cusId, { lookup: true });
    if (prodId) set("Products", prodId, { lookup: true });
    if (supId) set("Supplier", supId, { lookup: true });
    set("Application", r.application);
    set("Segment", r.segment);
    set("SegmentGroup", r.group);
    set("Stage", r.stage);
    set("Status", r.status === "IN PROGRESS" ? "Open" : "Closed");
    set("WinProbability", Math.round((r.prob || 0) * 100));
    set("PotentialKgThisYear", r.kgThis || 0);
    set("PotentialKgNextYear", r.kgNext || 0);
    putPic(f, get, r.pic);
    set("CreationDate", spDate(r.created));
    set("ClosingDate", spDate(r.closing));
    warnMissing("Projects", miss);

    /* "Người liên quan" có thể là cột Person — ghi chuỗi vào đó sẽ bị từ chối.
       Thử kèm, hỏng thì ghi lại không có nó rồi báo, chứ không mất cả dự án. */
    const rel = (r.related || []).join("; ");
    if (rel && get.internal("RelatedPeople")) {
      try {
        const f2 = Object.assign({}, f);
        f2[get.internal("RelatedPeople")] = rel;
        const it = await FISG_GRAPH.createItem("Projects", f2);
        return it.id;
      } catch (e) {
        console.warn("[store] không ghi được \"Người liên quan\" (có thể là cột Person, "
          + "app chỉ ghi được cột text nhiều dòng). Dự án vẫn được tạo, thiếu cột này.", e.message || e);
      }
    }
    const it = await FISG_GRAPH.createItem("Projects", f);
    return it.id;
  }

  /* patch: các khoá logic đã đổi, vd {Stage:'TESTING', WinProbability:60}. */
  async function updateProject(spId, patch) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    if (!spId) throw new Error("dự án này chưa có trên SharePoint");
    const get = await schemaOf("Projects");
    const miss = [], f = {};
    Object.keys(patch).forEach(k => {
      if (patch[k] === undefined) return;
      if (!put(f, get, k, patch[k])) miss.push(k);
    });
    warnMissing("Projects", miss);
    if (!Object.keys(f).length) return false;
    await FISG_GRAPH.updateItem("Projects", spId, f);
    return true;
  }

  /* ---------- NHẬT KÝ CẬP NHẬT ---------- */
  async function addProjectUpdate(projSpId, text, by, iso) {
    if (!canWrite() || !projSpId || !text) return false;
    try {
      const get = await schemaOf("ProjectUpdates");
      const f = { Title: String(text).slice(0, 250) };
      const miss = [];
      if (!put(f, get, "Project", projSpId, { lookup: true })) miss.push("Project");
      putPic(f, get, by);
      if (!put(f, get, "UpdateDate", spDate(iso || todayISO()))) miss.push("UpdateDate");
      if (!put(f, get, "Content", text)) miss.push("Content");
      warnMissing("ProjectUpdates", miss);
      await FISG_GRAPH.createItem("ProjectUpdates", f);
      return true;
    } catch (e) {
      /* Nhật ký hỏng không được kéo theo thao tác chính — dự án đã lưu rồi. */
      console.warn("[store] không ghi được ProjectUpdates:", e.message || e);
      return false;
    }
  }

  /* ---------- THỬ LẠI VIỆC CÒN KẸT ----------
     Chạy sau mỗi lần đồng bộ. Hoạt động nhập lúc mất mạng, hoặc lúc cột còn sai,
     sẽ tự lên SharePoint ở lần đăng nhập sau mà không cần ai nhớ. */
  async function pushPendingActs() {
    if (!canWrite() || !window.LS || !LS.pendingActs) return 0;
    const list = LS.pendingActs();
    if (!list.length) return 0;
    let n = 0;
    for (const a of list) {
      try {
        /* Cờ hoàn thành đánh dấu lúc còn offline cũng phải theo lên cùng. */
        if (!a.doneAt && LS.doneAt) a.doneAt = LS.doneAt(a) || "";
        const spId = await createActivity(a);
        LS.markSent(a.id, spId);
        const live = ACTIVITIES.find(x => x.id === a.id);
        if (live) { live.spId = spId; live.id = "A-" + spId; }
        LS.dropAct(a.id, "A-" + spId);
        n++;
      } catch (e) {
        console.warn("[store] hoạt động " + a.id + " vẫn chưa lên được SharePoint: "
          + (e.message || e));
        break;   // hỏng một cái thường là hỏng cả chùm; đừng nã thêm request
      }
    }
    if (n) console.info("[store] đã đẩy " + n + " hoạt động còn kẹt lên SharePoint.");
    return n;
  }

  /* Cờ hoàn thành đánh dấu trước khi list có cột "Ngày hoàn thành" đang nằm kẹt
     trong máy từng người. Lần đồng bộ nào cũng thử đẩy nốt, để không ai phải đi
     bấm lại thủ công sau khi thêm cột. */
  async function pushPendingDone() {
    if (!canWrite() || !window.LS || !LS.load) return 0;
    const flags = LS.load().done || {};
    const ids = Object.keys(flags);
    if (!ids.length) return 0;
    const get = await schemaOf("Activities");
    if (!get.internal("CompletedDate")) return 0;
    let n = 0;
    for (const id of ids) {
      const a = ACTIVITIES.find(x => x.id === id);
      if (!a || !a.spId || a.doneAt) continue;      // chưa lên SharePoint, hoặc đã có rồi
      try {
        await setActivityDone(a.spId, flags[id]);
        a.doneAt = flags[id];
        n++;
      } catch (e) {
        console.warn("[store] chưa đẩy được trạng thái hoàn thành của " + id + ":", e.message || e);
        break;
      }
    }
    if (n) console.info("[store] đã đồng bộ " + n + " trạng thái hoàn thành lên SharePoint.");
    return n;
  }

  async function syncFromGraph() {
    if (!(CFG && CFG.USE_GRAPH && window.FISG_AUTH && FISG_AUTH.account() && window.FISG_GRAPH))
      return false;
    try {
      /* Không báo tiến trình: đồng bộ là việc của máy, người dùng không cần biết. */
      const [pCols, aCols, projs, acts, supMap, cusMap, prodMap, ups] = await Promise.all([
        FISG_GRAPH.columns("Projects"), FISG_GRAPH.columns("Activities"),
        FISG_GRAPH.listItems("Projects"), FISG_GRAPH.listItems("Activities"),
        idTitleMap("Suppliers"), idTitleMap("Customers"), idTitleMap("Products"),
        FISG_GRAPH.listItems("ProjectUpdates").catch(() => []),
      ]);
      const gp = makeGetter("Projects", pCols), ga = makeGetter("Activities", aCols);
      // tên internal thật (đề phòng cột bị mã hoá) -> dùng cho lookupVal
      const nameOf = (getter, f, key) => key;   // cột đang đúng tên Anh; getter dùng cho field thường

      /* Toàn bộ nhà cung cấp từ list Suppliers -> SUPPLIERS, cho các ô chọn NCC
         trong form. "Kimica-Navido" hiển thị "Kimica" cho khớp phần còn lại. */
      SUPPLIERS.length = 0;
      Array.from(new Set(Object.values(supMap).map(t => txt(t).trim()).filter(Boolean)))
        .forEach(t => SUPPLIERS.push(t === "Kimica-Navido" ? "Kimica" : t));

      // gom ProjectUpdates theo dự án -> tab "Trao đổi"
      const gu = ups && ups.length ? makeGetter("ProjectUpdates", await FISG_GRAPH.columns("ProjectUpdates").catch(() => ({}))) : null;
      const upsBy = {};
      (ups || []).forEach(it => {
        const f = it.fields || {};
        const pcol = (gu && gu.internal("Project")) || "Project";
        const pid = String(f[pcol + "LookupId"] || f.ProjectLookupId || "");
        if (!pid) return;
        (upsBy[pid] = upsBy[pid] || []).push({
          by: txt(f.PICName) || txtOf(gu, f, "PIC") || "—",
          at: (txt(f.UpdateDate) || txtOf(gu, f, "UpdateDate")).slice(0, 10),
          text: txt(f.Content) || txtOf(gu, f, "Content"),
        });
      });

      const recs = projs.map((it, i) => {
        const f = it.fields || {};
        const title = txt(f.Title);
        const code = (title.match(/^(P-\d+)/) || [])[1] || ("P-" + (it.id || i));
        return {
          ncc: lookupOf(gp, f, "Supplier", supMap),
          customer: lookupOf(gp, f, "Customer", cusMap),
          product: lookupOf(gp, f, "Products", prodMap),
          application: txt(gp(f, "Application")),
          segment: txt(gp(f, "Segment")), group: txt(gp(f, "SegmentGroup")),
          stage: txt(gp(f, "Stage")),
          status: statusOf(gp(f, "Status"), gp(f, "Result")),
          boptype: txt(gp(f, "ProjectType")),
          prob: (Number(gp(f, "WinProbability")) || 0) / 100,
          kgThis: Number(gp(f, "PotentialKgThisYear")) || 0,
          kgNext: Number(gp(f, "PotentialKgNextYear")) || 0,
          pic: txt(f.PICName) || txtOf(gp, f, "PIC"),
          /* Cột "R&D phụ trách" đã có sẵn trên SharePoint nhưng chưa bao giờ
             được đọc. Vai trò R&D giới hạn phạm vi theo cột này. */
          rnd: txt(f.RnDOwnerName) || txtOf(gp, f, "RnDOwner"),
          /* Trước đây luôn để rỗng, nên "người liên quan" không bao giờ tồn tại —
             mà quyền xem của Sales lại dựa vào đúng cột này. */
          related: nameList(f.RelatedPeople != null ? f.RelatedPeople : gp(f, "RelatedPeople")),
          /* Ghi chú: RelatedPeople đọc trực tiếp trước rồi mới qua getter, vì cột
             Person trả về mảng object mà getter cũng lấy đúng khoá đó. */
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
          customer: lookupOf(ga, f, "Customer", cusMap),
          pic: txt(f.PICName) || txtOf(ga, f, "PIC"),
          ncc: lookupOf(ga, f, "Supplier", supMap),
          product: lookupOf(ga, f, "Product", prodMap),
          type: txt(ga(f, "ActivityType")) || "Khác",
          date: txt(ga(f, "ActivityDate")).slice(0, 10),
          note: txt(ga(f, "Content")), next: txt(ga(f, "NextStep")),
          potential: txt(ga(f, "PotentialLevel")),
          doneAt: txt(ga(f, "CompletedDate")).slice(0, 10),
          projectId: byItemId[String(
            (ga.internal("RelatedProject") ? f[ga.internal("RelatedProject") + "LookupId"] : null)
            || f.RelatedProjectLookupId || "")] || "",
          id: "A-" + (it.id || i), spId: it.id,
        };
      });

      if (!recs.length) {
        if (window.toast) toast("SharePoint trả về 0 dự án. Kiểm tra list Projects và quyền truy cập.");
        return false;
      }

      RECORDS.length = 0; recs.forEach(r => RECORDS.push(r));
      ACTIVITIES.length = 0; A.forEach(a => ACTIVITIES.push(a));

      /* Đổi tên PIC TRƯỚC khi dựng danh mục — nếu không, LISTS.pics và Cockpit
         giữ tên tắt trong khi bảng dự án đã hiện tên đầy đủ, hai chỗ lệch nhau. */
      const alias = applyPicAliases();
      if (alias.changed)
        console.info("[store] đổi " + alias.changed + " tên PIC theo list Users:", alias.map);

      // Danh mục (NCC, segment, pipeline, sales…) cũng dựng từ dữ liệu thật.
      const meta = await buildLists(RECORDS, ACTIVITIES);

      /* Danh bạ khách hàng + bảng chủ sở hữu. Đọc SAU buildLists nhưng TRƯỚC khi
         render, vì phân quyền của mọi view dưới đây tra CUSTOMER_OWNER. */
      const nCust = await loadCustomerDirectory();
      /* Báo cáo + phản hồi: đọc để chuông thông báo và mục Báo cáo có dữ liệu
         ngay khi đăng nhập. Hỏng thì bỏ qua, không chặn phần còn lại. */
      try { await loadReports(); } catch (e) { console.warn("[store] loadReports", e); }
      try { await loadAttachments(); } catch (e) { console.warn("[store] loadAttachments", e); }

      // Việc sales tự nhập lúc offline phải được nối lại sau khi thay mảng.
      if (window.LS && LS.mergeActs) LS.mergeActs();
      /* …rồi thử đẩy nốt lên SharePoint. Không await: người dùng không phải đợi
         việc dọn dẹp, và hỏng thì cũng chỉ ghi Console. */
      pushPendingActs()
        .then(() => pushPendingDone())
        .catch(e => console.warn("[store] đẩy phần còn kẹt", e));
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

      /* Tải xong thì im lặng. Các cảnh báo dưới đây chỉ ra Console — chúng dành
         cho người đi sửa cấu hình, không phải cho sales đang làm việc. */
      if (typeof me !== "undefined" && me && me.pic) {
        const m = picMatchReport(me.pic);
        if (!m.ok)
          console.warn("[store] tên O365 \"" + me.pic + "\" không khớp PIC nào trong dữ liệu."
            + (m.near && m.near.length ? " Gần nhất: " + m.near.join(", ") + "." : "")
            + " Sửa PICName ở màn Người dùng & phân quyền.");
      }
      const blank = RECORDS.filter(r => !r.ncc).length;
      if (blank) console.warn("[store] " + blank + " dự án thiếu NCC.");
      /* Cột lookup dò trượt là lỗi ÂM THẦM: SharePoint nhìn vẫn đủ, app thì
         rỗng. Nói ngay, kèm tên cột đã dò được, để khỏi phải đoán. */
      lookupHealth("Activities", ga, ACTIVITIES, "customer", "Customer");
      lookupHealth("Activities", ga, ACTIVITIES, "ncc", "Supplier");
      lookupHealth("Projects", gp, RECORDS, "customer", "Customer");
      console.info("[store] đã tải " + RECORDS.length + " dự án · " + ACTIVITIES.length
        + " hoạt động · " + LISTS.nccs.length + " NCC · " + LISTS.customers.length + " khách hàng"
        + " · " + nCust + " KH trong danh bạ (" + Object.keys(CUSTOMER_OWNER).length + " có chủ).");
      if (window.renderCustomers && document.getElementById("view-customers")) {
        try { renderCustomers(); } catch (e) {}
      }
      if (window.refreshNotifs) try { refreshNotifs(); } catch (e) {}
      if (window.renderReports && document.getElementById("view-reports")) {
        try { renderReports(); } catch (e) {}
      }
      return true;
    } catch (e) {
      if (window.toast) toast("Không tải được dữ liệu SharePoint: " + (e.message || e));
      console.error("[store] syncFromGraph", e);
      return false;
    }
  }

  /* Cảnh báo khi một trường lookup đọc về rỗng bất thường.

     Phải phân biệt hai chuyện, nếu không báo động giả sẽ nhanh chóng bị bỏ qua:
       · KHÔNG DÒ RA CỘT  → luôn là lỗi cấu hình, báo ngay.
       · Dò ra cột nhưng dữ liệu rỗng → thường là dữ liệu rỗng thật. NCC chẳng
         hạn: hoạt động gắn "Khác" cố ý để trống. Chỉ báo khi TOÀN BỘ rỗng và có
         đủ nhiều bản ghi để kết luận. */
  function lookupHealth(list, get, rows, field, key) {
    if (!rows.length) return;
    const col = (get && get.internal && get.internal(key)) || null;
    const hint = " Chạy FISG_STORE.debug('" + list + "') để xem tên cột thật.";
    if (!col) {
      console.warn("[store] list " + list + " không tìm thấy cột \"" + key
        + "\" — mọi bản ghi sẽ trống ở trường này." + hint);
      return;
    }
    const empty = rows.filter(r => !r[field]).length;
    if (empty === rows.length && rows.length >= 10)
      console.warn("[store] cả " + rows.length + " bản ghi " + list + " đều trống \"" + key
        + "\" dù đã dò ra cột " + col + " — kiểm tra xem cột này có dữ liệu không." + hint);
  }

  // Chẩn đoán: gõ FISG_STORE.debug() trong Console để xem cột thật & 1 bản ghi mẫu
  /* Cột hệ thống SharePoint tự sinh — không liên quan tới nghiệp vụ, in ra chỉ
     làm ngập màn hình đúng lúc đang cần đọc. */
  const SYS_COLS = /^(ID|ContentType|Modified|Created|Author|Editor|_UIVersionString|Attachments|Edit|LinkTitleNoMenu|LinkTitle|DocIcon|ItemChildCount|FolderChildCount|_Compliance\w*|_ColorTag|AppAuthor|AppEditor|ComplianceAssetId|_Level|_IsRecord|_ModerationStatus|Order|GUID|FileLeafRef|FileDirRef|FSObjType|SortBehavior|PermMask|MetaInfo|_HasCopyDestinations|_CopySource|owshiddenversion|WorkflowVersion|_UIVersion|InstanceID|WorkflowInstanceID|ServerUrl|EncodedAbsUrl|BaseName|ContentTypeId|_EditMenuTableStart\w*|_EditMenuTableEnd|ServerRedirected\w*)$/;

  async function debug(list) {
    const L = list || "Projects";
    const cols = await FISG_GRAPH.columns(L);
    const own = Object.keys(cols).filter(k => !SYS_COLS.test(k));

    /* Quan trọng nhất KHÔNG phải danh sách cột, mà là bảng dò: khoá logic của
       app đang trỏ vào cột nào. Trượt một dòng ở đây là mất cả một trường. */
    const get = makeGetter(L, cols);
    const keys = Object.keys(LABELS[L] || {});
    if (keys.length) {
      console.log("=== " + L + ": app đang dò khoá nào vào cột nào ===");
      keys.forEach(k => {
        const c = get.internal(k);
        console.log("  " + (c ? "OK  " : "MẤT ") + k.padEnd(22) + " → " + (c || "KHÔNG TÌM THẤY"));
      });
      const miss = keys.filter(k => !get.internal(k));
      if (miss.length)
        console.warn("  Thiếu " + miss.length + " cột: " + miss.join(", ")
          + ". Tạo cột với đúng tên hiển thị trong bảng dưới, hoặc báo tôi để sửa ánh xạ.");
    }

    console.log("=== Cột nghiệp vụ của list " + L + " (internal | hiển thị) ===");
    own.forEach(k => console.log("  " + k + "  |  " + cols[k]));
    console.log("(bỏ qua " + (Object.keys(cols).length - own.length) + " cột hệ thống)");

    const items = await FISG_GRAPH.listItems(L);
    console.log("Số item:", items.length);
    if (items.length) console.log("fields item đầu:", items[0].fields);
    return { cols, own, sample: items[0] && items[0].fields, count: items.length };
  }

  window.FISG_STORE = { syncFromGraph, debug, loadUsers, profileFor, picMatchReport,
                        findDuplicateCustomers, buildLists,
                        saveUser, deleteUser, lookupUser, canWriteUsers,
                        applyPicAliases, picAliasMap,
                        findSeedActivities, deleteSeedActivities,
                        loadCustomerDirectory, customerOwnerOf, customerLegalOf, setCustomerOwner,
                        bulkUpsertCustomers, previewCustomerUpsert, planCustomerUpsert, saveCustomer, deleteCustomer,
                        bulkUpsertSuppliers, previewSupplierUpsert,
                        loadReports, sendReportToSP, addReportComment,
                        loadAttachments, attachmentsOf, uploadAttachment, deleteAttachment, attValidate,
                        createActivity, updateActivity, deleteActivity, setActivityDone,
                        createProject, updateProject, addProjectUpdate,
                        pushPendingActs, pushPendingDone, canWrite, forgetSchema,
                        usersListName: USERS_LIST };
})();
