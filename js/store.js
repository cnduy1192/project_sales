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
    Users: { Email: "Email", PICName: "Tên PIC", Role: "Vai trò", FullName: "Tên đầy đủ" },
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
  const ROLE_COLOR = { superadmin: "#1E3A8A", director: "#6D28D9", manager: "#0E7490",
                       rnd: "#B45309", sales: "#0D9488", guest: "#6D28D9" };
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
          /* Cột "R&D phụ trách" đã có sẵn trên SharePoint nhưng chưa bao giờ
             được đọc. Vai trò R&D giới hạn phạm vi theo cột này. */
          rnd: txt(f.RnDOwnerName) || txt(gp(f, "RnDOwner")),
          /* Trước đây luôn để rỗng, nên "người liên quan" không bao giờ tồn tại —
             mà quyền xem của Sales lại dựa vào đúng cột này. */
          related: nameList(f.RelatedPeople != null ? f.RelatedPeople : gp(f, "RelatedPeople")),
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
      console.info("[store] đã tải " + RECORDS.length + " dự án · " + ACTIVITIES.length
        + " hoạt động · " + LISTS.nccs.length + " NCC · " + LISTS.customers.length + " khách hàng.");
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
                        findDuplicateCustomers, buildLists,
                        saveUser, deleteUser, lookupUser, canWriteUsers,
                        applyPicAliases, picAliasMap,
                        findSeedActivities, deleteSeedActivities,
                        usersListName: USERS_LIST };
})();
