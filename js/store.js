(function () {
  const CFG = window.FISG_CFG;

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

      RelatedPeople: "Người liên quan",

      SupplierList: "Các NCC quan tâm",

      CompletedDate: "Ngày hoàn thành",
    },

    Pipelines: {
      Supplier: "NCC", Stage: "Giai đoạn", StageOrder: "Thứ tự",
      StageGroup: "Nhóm giai đoạn", WinProbability: "Xác suất thắng %",
    },

    ProjectUpdates: {
      Project: "Dự án", PICName: "Người cập nhật", UpdateDate: "Ngày cập nhật", Content: "Nội dung",
    },

    Users: { Email: "Email", PICName: "Tên PIC", Role: "Vai trò", FullName: "Tên đầy đủ",

             ReportsTo: "Báo cáo cho", Supports: "Hỗ trợ sales" },

    Customers: { Owner: "Người phụ trách", LegalName: "Tên pháp nhân",
                 Segment: "Segment", Region: "Region", CustomerStatus: "Trạng thái" },

    Reports: {
      PICName: "Người gửi", WeekLabel: "Tuần", ReportDate: "Ngày gửi",
      Content: "Nhận xét", StatsJson: "Số liệu", Recipients: "Người nhận",
    },

    ReportComments: {
      ReportCode: "Mã báo cáo", PICName: "Người viết", AuthorRole: "Vai trò",
      CommentDate: "Ngày", Content: "Nội dung",
    },

    Attachments: {
      ParentType: "Loại", ParentId: "Mã tham chiếu", FileName: "Tên tệp",
      FileType: "Định dạng", Size: "Kích thước", WebUrl: "Đường dẫn",
      DriveItemId: "DriveItemId", FolderPath: "Thư mục",
      PICName: "Người tải", UploadDate: "Ngày tải",
    },
  };

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

  function nameList(v) {
    if (v == null || v === "") return [];
    const arr = Array.isArray(v) ? v : String(txt(v)).split(/[,;|]/);
    const seen = {}, out = [];
    arr.map(x => txt(x).trim()).forEach(n => {
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); }
    });
    return out;
  }

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

  function lookupOf(get, f, key, map) {
    const base = (get && get.internal && get.internal(key)) || key;
    return lookupVal(f, base, map);
  }

  function txtOf(get, f, key) { return txt(get ? get(f, key) : f[key]); }

  async function idTitleMap(listName) {
    try {
      const items = await FISG_GRAPH.listItems(listName);
      const m = {};
      items.forEach(it => { m[String(it.id)] = txt((it.fields || {}).Title); });
      return m;
    } catch (e) { return {}; }
  }

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

    const seen = {};
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

    if (window.resetCatalog) resetCatalog();

    uniqSorted(recs.map(r => r.ncc)).forEach(n => {
      if (LISTS.nccs.indexOf(n) < 0) LISTS.nccs.push(n);
    });
    replaceInPlace(LISTS.customers, uniqSorted(recs.map(r => r.customer).concat(acts.map(a => a.customer))));
    replaceInPlace(LISTS.products, uniqSorted(recs.map(r => r.product).concat(acts.map(a => a.product))));
    replaceInPlace(LISTS.applications, uniqSorted(recs.map(r => r.application)));
    replaceInPlace(LISTS.pics, uniqSorted(recs.map(r => r.pic).concat(acts.map(a => a.pic))));
    replaceInPlace(LISTS.segments, uniqSorted(recs.map(r => r.segment)));

    recs.forEach(r => {
      const grp = String(r.group || "").trim() || "Khác";
      const seg = String(r.segment || "").trim();
      if (!seg) return;
      (LISTS.segTree[grp] = LISTS.segTree[grp] || []);
      if (LISTS.segTree[grp].indexOf(seg) < 0) LISTS.segTree[grp].push(seg);
      if (LISTS.segments.indexOf(seg) < 0) LISTS.segments.push(seg);
    });
    Object.keys(LISTS.segTree).forEach(k => LISTS.segTree[k].sort((a, b) => a.localeCompare(b, "vi")));

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

    const uniqUnknown = [...new Set(unknown)];
    if (uniqUnknown.length) {
      console.warn("[store] " + uniqUnknown.length + " giai đoạn có trong dữ liệu nhưng "
        + "không có trong cấu hình — đã thêm vào cuối pipeline để không dự án nào biến mất:");
      uniqUnknown.forEach(x => console.warn("   " + x));
      console.warn("   Sửa ở list Pipelines trên SharePoint, hoặc js/data/catalog.js.");
    }

    if (window.FISG_RENAME_NCC) FISG_RENAME_NCC();
    if (window.rebuildDerived) rebuildDerived();
    return { pipelineFromList: !!(pipe && pipe.length), unknownStages: uniqUnknown };
  }

  const ROLE_COLOR = { superadmin: "#1E3A8A", director: "#6D28D9", manager: "#0E7490",
                       rnd: "#B45309", sales: "#0D9488", salesupport: "#0E9F6E", guest: "#6D28D9" };
  function isKnownRoleSafe(r) {
    return (typeof isKnownRole === "function") ? isKnownRole(r)
      : ["sales", "rnd", "manager", "director", "superadmin"].indexOf(r) >= 0;
  }
  let usersLoaded = false, usersWritable = false, userCols = null;
  const USERS_LIST = () => (CFG && CFG.USERS_LIST) || "Users";

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

        const roleRaw = txt(g(f, "Role"));
        const role = (typeof roleFromText === "function" ? roleFromText(roleRaw) : "")
          || (roleRaw || "sales").toLowerCase();

        const picRaw = txt(g(f, "PICName")) || null;
        const full = txt(g(f, "FullName")) || null;
        const first = (typeof splitAliases === "function" ? splitAliases(picRaw) : [])[0] || null;
        return {
          spId: it.id,
          email: email,

          picRaw: picRaw,
          fullName: full,
          name: full || first || email,

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

  async function profileFor(email, displayName) {
    const ok = await loadUsers();
    const mail = String(email || "").toLowerCase();
    const full = String(displayName || "").trim();
    let u = USERS.filter(x => (x.email || "").toLowerCase() === mail)[0];
    if (u) {
      if (full) u.name = full;
      if (!u.pic && full) u.pic = full;

      if (full && !u.fullName) {
        u.fullName = full;
        if (canWriteUsers()) saveUser(u).catch(e =>
          console.warn("[store] không lưu được FullName:", e.message || e));
      }
      if (window.buildUsers) buildUsers();
      return { user: u, fromList: ok, index: USERS.indexOf(u) };
    }
    if (ok) return { user: null, fromList: true, index: -1 };

    const isAdmin = mail === String((CFG && CFG.ADMIN_EMAIL) || "").toLowerCase();
    u = { name: full || email, email: email, pic: full || null,
          picRaw: null, fullName: full || null,
          role: isAdmin ? "superadmin" : "manager", color: isAdmin ? "#1E3A8A" : "#0E7490" };
    USERS.push(u);
    if (window.buildUsers) buildUsers();
    return { user: u, fromList: false, index: USERS.length - 1 };
  }

  function picMatchReport(pic) {
    const want = String(pic || "").trim();
    const all = [...new Set([].concat(
      RECORDS.map(r => r.pic), ACTIVITIES.map(a => a.pic)
    ).map(v => String(v || "").trim()).filter(Boolean))];
    if (!want) return { ok: false, reason: "empty", all: all };
    const hit = all.filter(v => v.toLowerCase() === want.toLowerCase());
    if (hit.length) return { ok: true, matched: hit[0], all: all };

    const words = want.toLowerCase().split(/\s+/).filter(x => x.length > 1);
    const near = all.filter(v => {
      const lv = v.toLowerCase();
      return words.some(x => lv.indexOf(x) >= 0);
    }).slice(0, 6);
    return { ok: false, reason: "nomatch", near: near, all: all };
  }
  window.picMatchReport = picMatchReport;

  function userFields(u) {
    const f = {};
    f.Title = u.email;
    const fe = userField("Email"), fp = userField("PICName"),
          fr = userField("Role"), fn = userField("FullName");
    if (fe !== "Title") f[fe] = u.email;

    f[fp] = u.picRaw || "";
    f[fr] = u.role;
    f[fn] = u.fullName || "";

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

  async function lookupUser(email) {
    if (!(window.FISG_GRAPH && window.FISG_AUTH && FISG_AUTH.account())) return null;
    return FISG_GRAPH.lookupPerson(email);
  }

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

  const _schema = {};
  async function schemaOf(list) {
    if (_schema[list]) return _schema[list];
    const cols = await FISG_GRAPH.columns(list);
    const get = makeGetter(list, cols);
    get.cols = cols;
    _schema[list] = get;
    return get;
  }

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
      } catch (e) {  }
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

      if (r.owner) put(f, get, "Owner", r.owner);
      if (r.legal) put(f, get, "LegalName", r.legal);

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
          idx[step.k] = { spId: it.id, fields: f };
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

    const BATCH = 4;
    for (let i = 0; i < plan.length; i += BATCH) {
      await Promise.all(plan.slice(i, i + BATCH).map(one));
    }

    try { await loadCustomerDirectory(); } catch (e) {}
    if (window.renderCustomers) try { renderCustomers(); } catch (e) {}
    return rep;
  }

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
      if (!k || idx[k] || seen[k]) return;
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

  async function previewCustomerUpsert(rows) {
    const { idx } = await customerIndex();
    const plan = planCustomerUpsert(rows, idx);
    const r = { update: 0, create: 0, skip: 0, total: plan.length };
    plan.forEach(p => { r[p.action]++; });
    return r;
  }

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
        id: String(it.id), code: code, spId: it.id, pic: pic,
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
    const it = await FISG_GRAPH.createItem("Reports", f);
    try { await loadReports(); } catch (e) {}
    return String(it.id);
  }

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

  const ATT_MAX = 15 * 1024 * 1024;
  const ATT_ROOT = "FISG_Attachments";
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

  function attValidate(file) {
    if (!file) return "chưa chọn tệp";
    if (file.size > ATT_MAX) return "tệp quá 15MB (" + Math.round(file.size / 1048576) + "MB)";
    if (ATT_EXT.indexOf(attExt(file.name)) < 0)
      return "định dạng không hỗ trợ (chỉ pdf, word, excel, powerpoint, ảnh, zip)";
    return "";
  }

  async function uploadAttachment(parentType, parentId, ctx, file) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const bad = attValidate(file);
    if (bad) throw new Error(bad);

    const pic = FISG_GRAPH.cleanSeg((ctx && ctx.pic) || "Chung");
    const day = String((ctx && ctx.date) || todayISO()).slice(0, 10);
    const leaf = parentType === "report" ? "Báo cáo"
      : FISG_GRAPH.cleanSeg((ctx && ctx.customer) || "Khách hàng");
    const folderPath = [ATT_ROOT, pic, day, leaf].join("/");

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

  async function saveCustomer(row) {
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    const get = await schemaOf("Customers");
    const clean = (typeof cleanCustomerName === "function") ? cleanCustomerName
      : function (s) { return String(s || "").trim(); };
    const title = clean(String(row.title || "").trim() || row.legal || "");
    if (!title) throw new Error("thiếu tên khách hàng");

    const f = {};

    const isNew = !row.spId;
    if (isNew) f.Title = title;
    else {

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

  function put(out, get, key, value, opts) {
    const name = get.internal(key);
    if (!name) return false;
    out[(opts && opts.lookup) ? name + "LookupId" : name] = value;
    return true;
  }

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

  function spDate(iso) {
    const d = String(iso || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T12:00:00Z" : null;
  }

  function canWrite() {
    return !!(CFG && CFG.USE_GRAPH && window.FISG_AUTH && FISG_AUTH.account() && window.FISG_GRAPH);
  }

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

    if (a.related && a.related.length) set("RelatedPeople", a.related.join("; "));
    if (a.nccs && a.nccs.length) set("SupplierList", a.nccs.join("; "));
    warnMissing("Activities", miss);

    const it = await FISG_GRAPH.createItem("Activities", f);
    return it.id;
  }

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

  async function deleteActivity(a) {
    const spId = a && typeof a === "object" ? a.spId : a;
    if (!canWrite()) throw new Error("chưa đăng nhập Microsoft 365");
    if (!spId) return false;
    await FISG_GRAPH.deleteItem("Activities", spId);

    const idx = ACTIVITIES.findIndex(x => x === a || x.spId === spId || x.id === (a && a.id));
    if (idx >= 0) ACTIVITIES.splice(idx, 1);
    if (window.LS && LS.dropAct && a && a.id) LS.dropAct(a.id);
    if (typeof invalidateCockpit === "function") invalidateCockpit();
    return true;
  }

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

      console.warn("[store] không ghi được ProjectUpdates:", e.message || e);
      return false;
    }
  }

  async function pushPendingActs() {
    if (!canWrite() || !window.LS || !LS.pendingActs) return 0;
    const list = LS.pendingActs();
    if (!list.length) return 0;
    let n = 0;
    for (const a of list) {
      try {

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
        break;
      }
    }
    if (n) console.info("[store] đã đẩy " + n + " hoạt động còn kẹt lên SharePoint.");
    return n;
  }

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
      if (!a || !a.spId || a.doneAt) continue;
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

      const [pCols, aCols, projs, acts, supMap, cusMap, prodMap, ups] = await Promise.all([
        FISG_GRAPH.columns("Projects"), FISG_GRAPH.columns("Activities"),
        FISG_GRAPH.listItems("Projects"), FISG_GRAPH.listItems("Activities"),
        idTitleMap("Suppliers"), idTitleMap("Customers"), idTitleMap("Products"),
        FISG_GRAPH.listItems("ProjectUpdates").catch(() => []),
      ]);
      const gp = makeGetter("Projects", pCols), ga = makeGetter("Activities", aCols);

      const nameOf = (getter, f, key) => key;

      SUPPLIERS.length = 0;
      Array.from(new Set(Object.values(supMap).map(t => txt(t).trim()).filter(Boolean)))
        .forEach(t => SUPPLIERS.push(t === "Kimica-Navido" ? "Kimica" : t));

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

          rnd: txt(f.RnDOwnerName) || txtOf(gp, f, "RnDOwner"),

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
        const supPrimary = lookupOf(ga, f, "Supplier", supMap);

        let nccList = nameList(f.SupplierList != null ? f.SupplierList : ga(f, "SupplierList"));
        if (supPrimary && nccList.map(x => x.toLowerCase()).indexOf(supPrimary.toLowerCase()) < 0)
          nccList = [supPrimary].concat(nccList);
        if (!nccList.length && supPrimary) nccList = [supPrimary];
        return {
          customer: lookupOf(ga, f, "Customer", cusMap),
          pic: txt(f.PICName) || txtOf(ga, f, "PIC"),
          ncc: supPrimary || nccList[0] || "",
          nccs: nccList,
          product: lookupOf(ga, f, "Product", prodMap),
          type: txt(ga(f, "ActivityType")) || "Khác",
          date: txt(ga(f, "ActivityDate")).slice(0, 10),
          note: txt(ga(f, "Content")), next: txt(ga(f, "NextStep")),
          potential: txt(ga(f, "PotentialLevel")),
          related: nameList(f.RelatedPeople != null ? f.RelatedPeople : ga(f, "RelatedPeople")),
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

      const alias = applyPicAliases();
      if (alias.changed)
        console.info("[store] đổi " + alias.changed + " tên PIC theo list Users:", alias.map);

      const meta = await buildLists(RECORDS, ACTIVITIES);

      const nCust = await loadCustomerDirectory();

      try { await loadReports(); } catch (e) { console.warn("[store] loadReports", e); }
      try { await loadAttachments(); } catch (e) { console.warn("[store] loadAttachments", e); }

      if (window.LS && LS.mergeActs) LS.mergeActs();

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

      if (typeof me !== "undefined" && me && me.pic) {
        const m = picMatchReport(me.pic);
        if (!m.ok)
          console.warn("[store] tên O365 \"" + me.pic + "\" không khớp PIC nào trong dữ liệu."
            + (m.near && m.near.length ? " Gần nhất: " + m.near.join(", ") + "." : "")
            + " Sửa PICName ở màn Người dùng & phân quyền.");
      }
      const blank = RECORDS.filter(r => !r.ncc).length;
      if (blank) console.warn("[store] " + blank + " dự án thiếu NCC.");

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

  const SYS_COLS = /^(ID|ContentType|Modified|Created|Author|Editor|_UIVersionString|Attachments|Edit|LinkTitleNoMenu|LinkTitle|DocIcon|ItemChildCount|FolderChildCount|_Compliance\w*|_ColorTag|AppAuthor|AppEditor|ComplianceAssetId|_Level|_IsRecord|_ModerationStatus|Order|GUID|FileLeafRef|FileDirRef|FSObjType|SortBehavior|PermMask|MetaInfo|_HasCopyDestinations|_CopySource|owshiddenversion|WorkflowVersion|_UIVersion|InstanceID|WorkflowInstanceID|ServerUrl|EncodedAbsUrl|BaseName|ContentTypeId|_EditMenuTableStart\w*|_EditMenuTableEnd|ServerRedirected\w*)$/;

  async function debug(list) {
    const L = list || "Projects";
    const cols = await FISG_GRAPH.columns(L);
    const own = Object.keys(cols).filter(k => !SYS_COLS.test(k));

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
