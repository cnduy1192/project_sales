/* ═══════════════════════════════════════════════════════════════════════
   RND — lõi liên kết hai chiều Sales ⇄ R&D (Phase 3) · js/lib/rnd-core.js
   Nạp ở index.html, salesfunnel.html, salesfunnel-demo.html (sau store.js, trước các view).

   1. Lưu trữ đề tài: SharePoint (list RD_Projects qua FISG_STORE.createRdProject / updateRdProject) → nếu chưa có list
      thì lưu cục bộ (localStorage, như Phase 2) → bản demo chỉ giữ trong bộ nhớ.
   2. Liên kết dự án Sales: tra đề tài theo originProjectId, widget tiến độ R&D, icon trên danh sách,
      popup "Yêu cầu R&D hỗ trợ" (tạo đề tài + chia sẻ quyền theo dõi cho chuyên viên R&D).
   3. Đồng bộ timeline: đổi stage / ghi mẻ thử / hoàn tất → ghi dòng nhật ký vào dự án Sales
      (comments + list ProjectUpdates). Hoàn tất: "R&D đã hoàn thành thử nghiệm và bàn giao kết quả."
   4. Thông báo: đề bài mới cho chuyên viên R&D, đổi stage cho Sales phụ trách / người liên quan.
   Chuỗi nhật ký ghi lên SharePoint luôn bằng tiếng Việt (quy ước audit trail của dự án).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ───────────── helpers ───────────── */
  function tr(k, p) { return typeof T === "function" ? T(k, p) : k; }
  function vi(k, p) {                                   // nhãn tiếng Việt cố định cho nhật ký
    var d = window.I18N_DICT && I18N_DICT.vi, s = (d && d[k]) || k;
    return String(s).replace(/\{(\w+)\}/g, function (_, x) { return p && p[x] != null ? p[x] : ""; });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function jsq(s) { return esc("'" + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"); }
  function today() {
    if (typeof todayISO === "function") return todayISO();
    var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function nowStamp() { var d = new Date(); return today() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function nowVN() { var d = new Date(); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function meNow() { return (typeof me !== "undefined" && me) ? me : null; }
  function who() { var u = meNow(); return u ? (u.pic || u.name || "") : ""; }
  function isDemo() { return !!window.FISG_DEMO_AUTO; }
  function list() { return typeof RD_PROJECTS !== "undefined" ? RD_PROJECTS : []; }
  function toastMsg(m) { if (window.toast) toast(m); }
  function spLive() { return !!(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite()) && !isDemo(); }
  function mine(v) { var u = meNow(); return !!(u && v && typeof isMine === "function" && isMine(v, u)); }
  function pl(p) {
    if (!p) return "";
    var k = String(p).trim().toLowerCase();
    var u = (typeof USERS !== "undefined" ? USERS : []).filter(function (x) {
      return String(x.pic || "").toLowerCase() === k || String(x.name || "").toLowerCase() === k;
    })[0];
    return u ? (u.pic || u.name) : p;
  }

  /* ───────────── danh mục stage ───────────── */
  function stages() {
    var s = (typeof LISTS !== "undefined" && LISTS.rdPipelines && LISTS.rdPipelines.length) ? LISTS.rdPipelines
      : (typeof CATALOG !== "undefined" ? CATALOG.rdPipelines : []);
    return s || [];
  }
  function prob(s) {
    var m = (typeof LISTS !== "undefined" && LISTS.rdStageProb) || (typeof CATALOG !== "undefined" && CATALOG.rdStageProb) || {};
    return m[s] != null ? m[s] : 0;
  }
  function stageLabel(s) { return tr("rd.pipeline." + s); }
  function statusOfStage(s) { return s === "COMPLETED" ? "DONE" : s === "SUSPENDED" ? "CANCELLED" : "IN_PROGRESS"; }

  /* ═══════════ 1. LƯU TRỮ ═══════════ */
  function hasStore() { return !!(window.FISG_STORE && FISG_STORE.createRdProject); }
  function mode() {
    if (isDemo()) return "demo";
    if (hasStore() && FISG_STORE.rdState() === "ok" && spLive()) return "sharepoint";
    return "local";
  }
  var LOCAL = {
    key: function () { var u = meNow(); return "fisg_rnd_v1_" + ((u && u.email) || "anon"); },
    read: function () {
      try { var o = JSON.parse(localStorage.getItem(this.key()) || "null"); return (o && o.recs && typeof o.recs === "object") ? o : { v: 1, recs: {} }; }
      catch (e) { return { v: 1, recs: {} }; }
    },
    write: function (o) { try { localStorage.setItem(this.key(), JSON.stringify(o)); return true; } catch (e) { return false; } },
    put: function (rec) { var o = this.read(); o.recs[rec.code] = rec; return this.write(o); },
    drop: function (code) { var o = this.read(); delete o.recs[code]; return this.write(o); }
  };
  var mergedFor = null;
  /* Chế độ cục bộ: áp các đề tài đã lưu trên trình duyệt lên RD_PROJECTS (1 lần / người dùng) */
  function ensureReady() {
    var u = meNow(); if (!u) return;
    var k = u.email || u.name || "anon";
    if (mergedFor === k) return;
    mergedFor = k;
    if (mode() !== "local") return;
    var o = LOCAL.read(), arr = list();
    Object.keys(o.recs).forEach(function (code) {
      var r = o.recs[code]; if (!r || !r.code) return;
      var i = -1; arr.forEach(function (x, j) { if (x.code === code) i = j; });
      if (i >= 0) arr[i] = r; else arr.push(r);
    });
  }

  /* Ghi 1 đề tài. Promise<rec>.
     - Chưa có spId → FISG_STORE.createRdProject (mã RD-{YEAR}-{INDEX} do store cấp theo SharePoint).
     - Có spId + fields → FISG_STORE.updateRdProject(spId, chỉ các trường đó); batches / log trả về đã gộp.
     - Demo: store thao tác trên DEMO_RD_LIST (nếu trang có store.js), không thì chỉ giữ trong bộ nhớ.
     - Cục bộ (chưa có list): localStorage như Phase 2.
     Lỗi → rec._syncErr = thông điệp (UI hiện nút "Thử lại"), Promise bị reject. */
  function persist(rec, fields, opts) {
    var m = mode();
    if (m === "local") return LOCAL.put(rec) ? Promise.resolve(rec) : Promise.reject(new Error(tr("rdw.err.persist")));
    if (m === "demo" && !hasStore()) return Promise.resolve(rec);
    var p;
    if (!rec.spId) {
      p = FISG_STORE.createRdProject(stripLocal(rec)).then(function (res) {
        rec.spId = res.spId;
        if (res.code && res.code !== rec.code) { rec.code = res.code; rec.id = res.code; }
      });
    } else {
      var keys = fields && fields.length ? fields : Object.keys(stripLocal(rec));
      var patch = {};
      keys.forEach(function (k) { if (k in rec) patch[k] = rec[k]; });
      p = FISG_STORE.updateRdProject(rec.spId, patch, opts).then(function (res) {
        if (res && res.batches) rec.batches = res.batches;
        if (res && res.log) rec.log = res.log;
      });
    }
    return p.then(function () { delete rec._syncErr; return rec; }, function (e) {
      rec._syncErr = (e && e.message) || String(e);
      if (e && e.rdKind === "auth") authHint();
      throw e;
    });
  }
  function stripLocal(rec) {
    var o = {}; Object.keys(rec).forEach(function (k) { if (k.charAt(0) !== "_") o[k] = rec[k]; });
    delete o.id; delete o.spId; delete o.updatedAt;
    return o;
  }
  /* Phiên M365 hết hạn: nhắc đăng nhập lại (1 lần / 60 giây) */
  var _authHintAt = 0;
  function authHint() {
    if (Date.now() - _authHintAt < 60000) return;
    _authHintAt = Date.now();
    setTimeout(function () { toastMsg(tr("rds.err.auth")); }, 400);
  }

  /* List RD_Projects vừa tải xong → chuyển đề tài lưu cục bộ (Phase 2) lên SharePoint 1 lần */
  function onLoaded() {
    mergedFor = null;
    if (mode() !== "sharepoint") return;
    var o = LOCAL.read(), recs = Object.keys(o.recs).map(function (k) { return o.recs[k]; }).filter(function (r) { return r && !r.spId; });
    if (!recs.length) { refreshViews(); return; }
    var ok = 0;
    recs.reduce(function (p, r) {
      return p.then(function () {
        var old = r.code;
        return FISG_STORE.createRdProject(stripLocal(r)).then(function (res) {
          r.spId = res.spId; if (res.code) { r.code = res.code; r.id = res.code; }
          list().push(r); LOCAL.drop(old); ok++;
        }).catch(function (e) { console.warn("[R&D Store] chưa chuyển được " + old + " lên SharePoint:", e.message || e); });
      });
    }, Promise.resolve()).then(function () {
      if (ok) toastMsg(tr("rnd.msg.migrated", { n: ok }));
      refreshViews();
    });
  }
  function refreshViews() {
    var v = document.getElementById("view-rnd");
    if (v && v.style.display !== "none" && window.RND_WORKSPACE) RND_WORKSPACE.render();
    if (window.refreshNotifs) try { refreshNotifs(); } catch (e) {}
  }

  /* ═══════════ 2. LIÊN KẾT DỰ ÁN SALES ═══════════ */
  function byCode(code) { var a = list(); for (var i = 0; i < a.length; i++) if (a[i].code === code) return a[i]; return null; }
  function recOf(pid) {
    if (!pid || typeof RECORDS === "undefined") return null;
    for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === pid) return RECORDS[i];
    return null;
  }
  var ORDER = { IN_PROGRESS: 0, DONE: 1, CANCELLED: 2 };
  function ofProject(pid) {
    ensureReady();
    return list().filter(function (r) { return pid && r.originProjectId === pid; })
      .sort(function (a, b) { return (ORDER[a.status] || 0) - (ORDER[b.status] || 0) || String(b.created || "").localeCompare(String(a.created || "")); });
  }
  function primaryOf(pid) { return ofProject(pid)[0] || null; }
  /* Ai xem được đề tài: xem-tất-cả (R&D, Manager…), PIC / phối hợp, hoặc xem được dự án Sales gốc */
  /* Quyền: js/lib/roles.js (rdCanView / rdCanRequest) — phần dưới chỉ là dự phòng khi thiếu roles.js */
  function canSee(rd) {
    if (typeof rdCanView === "function") return rdCanView(rd, meNow());
    var u = meNow(); if (!u || u.role === "guest" || !rd) return false;
    if (typeof canViewAll === "function" && canViewAll(u)) return true;
    if (mine(rd.pic) || (rd.collaborators || []).some(mine)) return true;
    var src = recOf(rd.originProjectId);
    return !!(src && typeof scopeRecords === "function" && scopeRecords([src], u).length);
  }
  function visible() { ensureReady(); return list().filter(canSee); }
  /* Badge R&D cho 1 hoạt động: đề tài gắn trực tiếp, hoặc đề tài đang chạy của dự án Sales */
  function actBadgeHTML(a, full) {
    if (!a) return "";
    var rd = a.rdProjectId ? byCode(a.rdProjectId) : (a.projectId ? primaryOf(a.projectId) : null);
    if (!rd || !canSee(rd)) return "";
    var tip = rd.code + " · " + rd.title + " — " + stageText(rd);
    return '<a class="al-rd rnd-t-' + tone(rd.stage) + '" href="index.html?open=rnd&amp;rd=' + encodeURIComponent(rd.code) + '"' +
      ' onclick="event.stopPropagation();return RND.openTopic(' + jsq(rd.code) + ')" title="' + esc(tip) + '">' + FLASK +
      "<span>" + esc(rd.code) + " · " + esc(full ? stageLabel(rd.stage) : (rd.stage === "COMPLETED" ? "✓" : prob(rd.stage) + "%")) + "</span></a>";
  }
  function rndUsers() {
    return (typeof USERS !== "undefined" ? USERS : []).filter(function (x) { return x.role === "rnd" && x.pic; }).map(function (x) { return x.pic; });
  }
  function canRequest(rec) {
    if (typeof rdCanRequest === "function") return rdCanRequest(rec, meNow());
    var u = meNow(); if (!u || u.role === "guest" || !rec) return false;
    var c = typeof cap === "function" ? cap(u.role) : { edit: false };
    if (!c.edit) return false;
    if (c.scope === "all" || u.role === "rnd") return true;
    return typeof capEdit === "function" ? capEdit(rec, u) : true;
  }
  function nextCode() {
    var y = String(new Date().getFullYear()), n = 0;
    list().forEach(function (r) { var m = /^RD-(\d{4})-(\d+)$/.exec(String(r.code || "")); if (m && m[1] === y) n = Math.max(n, +m[2]); });
    return "RD-" + y + "-" + String(n + 1).padStart(3, "0");
  }

  var FLASK = '<svg class="rnd-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 006.3 21h11.4a2 2 0 001.7-2.8L14 9.5V3"/><path d="M7.5 14h9"/></svg>';
  var EXT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>';
  function tone(s) { return s === "COMPLETED" ? "done" : s === "SUSPENDED" ? "susp" : "run"; }
  function stageText(rd) { return tr("rnd.badge", { s: stageLabel(rd.stage), p: prob(rd.stage) }); }

  /* Icon nhỏ cạnh mã dự án trên danh sách Funnel — tooltip = stage R&D hiện tại */
  function iconHTML(pid) {
    var rd = primaryOf(pid); if (!rd) return "";
    var n = ofProject(pid).length;
    var tip = rd.code + " · " + stageText(rd) + (rd.pic ? " · " + pl(rd.pic) : "") + (n > 1 ? " (+" + (n - 1) + ")" : "");
    return '<span class="rnd-flag rnd-t-' + tone(rd.stage) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '" role="img">' + FLASK + "</span>";
  }

  /* Widget tiến độ R&D trong màn hình dự án (drawer index.html · Record Page salesfunnel.html) */
  function widgetHTML(rec) {
    if (!rec) return "";
    var tops = ofProject(rec.id), can = canRequest(rec) && rec.status === "IN PROGRESS";
    var head = '<div class="rnd-w-h">' + FLASK + "<b>" + esc(tr("rnd.w.title")) + "</b>" + (tops.length > 1 ? '<span class="rnd-w-n">' + tops.length + "</span>" : "") + "</div>";
    if (!tops.length) {
      return '<div class="rnd-w is-empty">' + head +
        '<p class="rnd-w-empty">' + esc(tr("rnd.w.none")) + "</p>" +
        (can ? '<button type="button" class="rnd-btn" onclick="RND.openRequest(' + jsq(rec.id) + ')">' + FLASK + "<span>" + esc(tr("rd.requestSupport")) + "</span></button>" : "") +
        "</div>";
    }
    var main = tops[0], p = prob(main.stage);
    var others = tops.slice(1).map(function (r) {
      return '<li><button type="button" class="rnd-w-o" onclick="RND.openTopic(' + jsq(r.code) + ')"><b>' + esc(r.code) + "</b> " + esc(r.title) +
        ' <span class="rnd-w-os rnd-t-' + tone(r.stage) + '">' + esc(stageLabel(r.stage)) + "</span></button></li>";
    }).join("");
    var allClosed = tops.every(function (r) { return r.status !== "IN_PROGRESS"; });
    return '<div class="rnd-w">' + head +
      '<div class="rnd-w-main rnd-t-' + tone(main.stage) + '">' +
        '<div class="rnd-w-badge">' + FLASK + "<span>" + esc(tr("rnd.w.badge", { s: stageLabel(main.stage), p: p })) + "</span></div>" +
        '<div class="rnd-w-t"><b>' + esc(main.code) + "</b> · " + esc(main.title) + "</div>" +
        '<div class="rnd-w-bar"><i style="width:' + p + '%"></i></div>' +
        '<div class="rnd-w-meta">' + esc(tr("rnd.w.owner")) + ": <b>" + esc(pl(main.pic) || "—") + "</b>" +
          (main.targetDate ? " · " + esc(tr("rdw.fld.target")) + ": " + esc(main.targetDate.split("-").reverse().join("/")) : "") +
          ((main.batches || []).length ? " · " + esc(tr("rdw.b2sum", { n: main.batches.length, p: main.batches.filter(function (b) { return b.result === "PASS"; }).length })) : "") + "</div>" +
        '<button type="button" class="rnd-link" onclick="RND.openTopic(' + jsq(main.code) + ')">' + esc(tr("rnd.w.open")) + " " + EXT + "</button>" +
      "</div>" +
      (others ? '<ul class="rnd-w-others">' + others + "</ul>" : "") +
      (allClosed && can ? '<button type="button" class="rnd-link rnd-w-again" onclick="RND.openRequest(' + jsq(rec.id) + ')">+ ' + esc(tr("rnd.w.again")) + "</button>" : "") +
      "</div>";
  }

  /* Mở đề tài: index.html → view R&D; trang khác → deeplink sang index.html */
  function openTopic(code) {
    var dov = document.getElementById("dov");
    if (window.RND_WORKSPACE && document.getElementById("view-rnd") && typeof go === "function") {
      if (dov && dov.classList.contains("open")) { dov.classList.remove("open"); if (window.NAV && NAV.popRaw) NAV.popRaw(); }
      if (typeof closeActivityModal === "function") try { closeActivityModal(true); } catch (e) {}
      go("rnd"); RND_WORKSPACE.focus(code);
      return false;
    }
    location.href = "index.html?open=rnd&rd=" + encodeURIComponent(code);
    return false;
  }

  /* ───────────── Popup "Yêu cầu R&D hỗ trợ" ───────────── */
  var REQ = { pid: "", onDone: null, ret: null };
  function ensureReqModal() {
    var ov = document.getElementById("rndReqOv"); if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "rndReqOv"; ov.className = "overlay rnd-ov"; ov.setAttribute("aria-hidden", "true");
    ov.innerHTML = '<div class="modal rnd-modal" role="dialog" aria-modal="true" aria-labelledby="rndReqT" tabindex="-1" id="rndReqBox"></div>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closeRequest(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("open")) { e.stopPropagation(); closeRequest(); } }, true);
    return ov;
  }
  function openRequest(pid, opts) {
    var rec = recOf(pid); if (!rec || !canRequest(rec)) { toastMsg(tr("rnd.msg.noPerm")); return; }
    REQ = { pid: pid, onDone: opts && opts.onDone, ret: document.activeElement };
    var ov = ensureReqModal(), box = document.getElementById("rndReqBox");
    var users = rndUsers(), u = meNow();
    var def = u && u.role === "rnd" ? u.pic : (rec.rnd && users.indexOf(rec.rnd) >= 0 ? rec.rnd : (users[0] || ""));
    var badges = [[tr("rdw.fld.customer"), rec.customer], [tr("rdw.fld.ncc"), rec.ncc], [tr("rdw.fld.product"), rec.product],
      [tr("rdw.fld.application"), rec.application], [tr("rdw.fld.segment"), rec.segment]]
      .map(function (x) { return '<span class="rnd-badge"><small>' + esc(x[0]) + "</small>" + esc(x[1] || "—") + "</span>"; }).join("");
    box.innerHTML =
      '<div class="modal-head"><div><h3 id="rndReqT">' + FLASK + " " + esc(tr("rd.requestSupport")) + "</h3>" +
        '<div class="mh-sub"><span class="rnd-mute">' + esc(tr("rnd.req.sub", { id: rec.id, c: nextCode() })) + "</span></div></div>" +
        '<button type="button" class="rnd-x" onclick="RND.closeRequest()" aria-label="' + esc(tr("common.close")) + '">✕</button></div>' +
      '<div class="rnd-mbody">' +
        '<div class="rnd-inh"><span class="rnd-mute">' + esc(tr("rdw.inherited")) + "</span><div>" + badges + "</div></div>" +
        '<div class="rnd-f"><label for="rndReqPic">' + esc(tr("rnd.req.pic")) + (users.length ? ' <i class="req">*</i>' : "") + "</label>" +
          '<select id="rndReqPic" class="rnd-in">' + (users.length ? "" : '<option value="">' + esc(tr("rdw.m.picNone")) + "</option>") +
            users.map(function (p) { return '<option value="' + esc(p) + '"' + (p === def ? " selected" : "") + ">" + esc(pl(p)) + "</option>"; }).join("") +
          "</select>" + (users.length ? "" : '<p class="rnd-hint">' + esc(tr("rnd.req.noRnd")) + "</p>") + "</div>" +
        '<div class="rnd-f"><label for="rndReqTarget">' + esc(tr("rdw.fld.target")) + '</label><input id="rndReqTarget" type="date" class="rnd-in" min="' + today() + '"></div>' +
        '<div class="rnd-f is-wide"><label for="rndReqTitle">' + esc(tr("rnd.req.brief")) + ' <i class="req">*</i></label>' +
          '<input id="rndReqTitle" class="rnd-in" maxlength="160" value="' + esc((rec.application || rec.product || "") + (rec.customer ? " — " + rec.customer : "")) + '"></div>' +
        '<div class="rnd-f is-wide"><label for="rndReqDesc">' + esc(tr("rnd.req.desc")) + '</label><textarea id="rndReqDesc" class="rnd-ta" rows="2" placeholder="' + esc(tr("rnd.req.descPh")) + '"></textarea></div>' +
        '<div class="rnd-f is-wide"><label for="rndReqBench">' + esc(tr("rd.benchmark")) + '</label><textarea id="rndReqBench" class="rnd-ta" rows="3" placeholder="' + esc(tr("rdw.benchPh")) + '"></textarea></div>' +
        '<p class="rnd-hint is-wide">' + esc(tr("rnd.req.share")) + "</p>" +
      "</div>" +
      '<div class="modal-foot"><span class="rnd-err" id="rndReqErr" role="alert"></span>' +
        '<button type="button" class="btn-ghost" onclick="RND.closeRequest()">' + esc(tr("common.cancel")) + "</button>" +
        '<button type="button" class="btn-primary" id="rndReqGo" onclick="RND.submitRequest()">' + esc(tr("rnd.req.send")) + "</button></div>";
    ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    setTimeout(function () { var t = document.getElementById("rndReqTitle"); if (t) { t.focus(); t.select(); } }, 30);
  }
  function closeRequest() {
    var ov = document.getElementById("rndReqOv"); if (!ov) return;
    ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    if (REQ.ret && REQ.ret.focus && document.contains(REQ.ret)) try { REQ.ret.focus(); } catch (e) {}
  }
  function v(id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; }
  function submitRequest() {
    var rec = recOf(REQ.pid), err = document.getElementById("rndReqErr");
    var title = v("rndReqTitle"), pic = v("rndReqPic");
    if (!rec) return;
    if (!title || (rndUsers().length && !pic)) { if (err) err.textContent = tr("rdw.m.required"); return; }
    var btn = document.getElementById("rndReqGo"); if (btn) btn.disabled = true;
    create({
      type: "ON_DEMAND", origin: rec, title: title, pic: pic, targetDate: v("rndReqTarget") || null,
      benchmarkCriteria: v("rndReqBench"), desc: v("rndReqDesc")
    }).then(function (rd) {
      closeRequest();
      toastMsg(tr("rnd.msg.requested", { c: rd.code, p: pl(rd.pic) || "R&D" }));
      if (REQ.onDone) try { REQ.onDone(rd); } catch (e) {}
      afterProjectChange(rec);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      if (err) err.textContent = tr("rnd.msg.saveFailed") + " " + (e && (e.message || e));
    });
  }

  /* Tạo đề tài (từ popup Sales hoặc modal của R&D Workspace). Promise<rd> */
  function create(o) {
    ensureReady();
    var src = o.origin || null;
    var rd = {
      id: "", code: nextCode(), spId: null, title: o.title, type: o.type || (src ? "ON_DEMAND" : "INTERNAL"),
      originProjectId: src ? src.id : null,
      customer: src ? (src.customer || "") : (o.customer || ""), ncc: src ? (src.ncc || "") : (o.ncc || ""),
      product: src ? (src.product || "") : (o.product || ""), application: src ? (src.application || "") : (o.application || ""),
      segment: src ? (src.segment || "") : (o.segment || ""),
      pic: o.pic || "", collaborators: [], stage: "BRIEF", status: "IN_PROGRESS",
      created: today(), targetDate: o.targetDate || null, completedDate: null,
      benchmarkCriteria: o.benchmarkCriteria || "", desc: o.desc || "", batches: [],
      log: [{ at: nowStamp(), by: who(), kind: "created", to: o.pic || "" }], updatedAt: today(), updatedBy: who()
    };
    rd.id = rd.code;
    if (src && src.pic) rd.collaborators.push(src.pic);
    var u = meNow();
    if (src && u && u.pic && u.role !== "rnd" && u.pic !== rd.pic && rd.collaborators.indexOf(u.pic) < 0) rd.collaborators.push(u.pic);
    list().push(rd);
    return persist(rd).then(function (saved) {
      if (src) linkProject(src, saved);
      return saved;
    }, function (e) {
      var i = list().indexOf(rd); if (i >= 0) list().splice(i, 1);
      throw e;
    });
  }

  /* Chia sẻ quyền theo dõi: chuyên viên R&D vào "Người liên quan" + "R&D phụ trách" của dự án Sales */
  function linkProject(src, rd) {
    var changed = {};
    src.related = src.related || [];
    if (rd.pic && src.related.indexOf(rd.pic) < 0 && rd.pic !== src.pic) { src.related.push(rd.pic); changed.RelatedPeople = src.related.join("; "); }
    if (rd.pic && !src.rnd) { src.rnd = rd.pic; changed.RnDOwner = rd.pic; }
    projectNote(src, "[R&D " + rd.code + "] " + vi("rnd.log.requested", { p: pl(rd.pic) || "R&D", t: rd.title }));
    if (spLive() && src.spId) {
      /* Ghi từng cột riêng: cột RelatedPeople kiểu Person (chưa sửa) không được chặn cột còn lại */
      Object.keys(changed).forEach(function (k) {
        var patch = {}; patch[k] = changed[k];
        FISG_STORE.updateProject(src.spId, patch).catch(function (e) { console.warn("[rnd] chưa ghi được " + k + " của " + src.id + ":", e.message || e); });
      });
    }
  }

  /* Ghi 1 dòng vào timeline dự án Sales (bộ nhớ + ProjectUpdates) */
  function projectNote(src, text) {
    if (!src || !text) return;
    src.comments = src.comments || [];
    src.comments.push({ by: who() || "R&D", at: nowVN(), text: text });
    if (spLive() && src.spId) FISG_STORE.addProjectUpdate(src.spId, text, who(), today()).catch(function () {});
  }
  function afterProjectChange(src) {
    if (typeof window.render === "function") try { window.render(); } catch (e) {}
    if (window.SF && SF.refreshRecord) try { SF.refreshRecord(src.id); } catch (e) {}
    if (typeof dRenderRnd === "function") try { dRenderRnd(); } catch (e) {}
    if (typeof dRenderComments === "function" && typeof curRec !== "undefined" && curRec && curRec.id === src.id) try { dRenderComments(); } catch (e) {}
  }

  /* ═══════════ 3. ĐỒNG BỘ TIMELINE ═══════════ */
  function onStageSaved(rd, from, to) {
    var src = rd.type === "ON_DEMAND" ? recOf(rd.originProjectId) : null;
    if (!src || from === to) return;
    var text = to === "COMPLETED"
      ? "[R&D " + rd.code + "] " + vi("rnd.log.completed")
      : "[R&D " + rd.code + "] " + vi("rnd.log.stage", { a: vi("rd.pipeline." + from), b: vi("rd.pipeline." + to) });
    projectNote(src, text);
    afterProjectChange(src);
  }
  function onBatchLogged(rd, b) {
    var src = rd.type === "ON_DEMAND" ? recOf(rd.originProjectId) : null;
    if (!src) return;
    var parts = [b.ratio, b.temp, b.time].filter(Boolean).join(" · ");
    projectNote(src, "[R&D " + rd.code + "] " + vi("rnd.log.batch", { n: b.no, x: parts || "—", r: vi("rdw.res." + (b.result || "PENDING")) }) + (b.note ? " — " + b.note : ""));
    afterProjectChange(src);
  }

  /* ═══════════ 4. THÔNG BÁO ═══════════ */
  function daysAgo(at) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(at || "")); if (!m) return 999;
    return (Date.now() - new Date(+m[1], +m[2] - 1, +m[3]).getTime()) / 864e5;
  }
  function notifCandidates() {
    var u = meNow(); if (!u || u.role === "guest") return [];
    ensureReady();
    var out = [];
    list().forEach(function (rd) {
      var src = recOf(rd.originProjectId);
      var sales = src && (mine(src.pic) || (src.related || []).some(mine));
      var follows = sales || (rd.collaborators || []).some(mine);
      (rd.log || []).forEach(function (e) {
        if (!e || mine(e.by) || daysAgo(e.at) > 30) return;
        if (e.kind === "created" && mine(rd.pic))
          out.push({ key: "RD:N:" + rd.code, who: e.by, at: String(e.at).slice(0, 10), rd: rd.code,
            action: tr("rnd.notif.assigned", { c: rd.code, t: esc(rd.title) }) });
        else if (e.kind === "stage" && follows && !mine(rd.pic))
          out.push({ key: "RD:S:" + rd.code + ":" + e.at + ":" + e.to, who: e.by, at: String(e.at).slice(0, 10), rd: rd.code,
            action: e.to === "COMPLETED" ? tr("rnd.notif.done", { c: rd.code, t: esc(rd.title) })
              : tr("rnd.notif.stage", { c: rd.code, s: stageLabel(e.to) }) });
      });
    });
    return out;
  }

  window.RND = {
    /* dữ liệu */
    mode: mode, ensureReady: ensureReady, persist: persist, onLoaded: onLoaded, byCode: byCode,
    ofProject: ofProject, primaryOf: primaryOf, canSee: canSee, visible: visible, actBadgeHTML: actBadgeHTML, nextCode: nextCode, create: create, rndUsers: rndUsers,
    stages: stages, prob: prob, stageLabel: stageLabel, statusOfStage: statusOfStage, pl: pl,
    /* liên kết */
    iconHTML: iconHTML, widgetHTML: widgetHTML, openTopic: openTopic, canRequest: canRequest,
    openRequest: openRequest, closeRequest: closeRequest, submitRequest: submitRequest,
    /* đồng bộ */
    onStageSaved: onStageSaved, onBatchLogged: onBatchLogged, projectNote: projectNote,
    notifCandidates: notifCandidates
  };
})();
