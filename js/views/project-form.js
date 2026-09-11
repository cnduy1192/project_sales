/* ═══════════════════════════════════════════════════════════════════════
   Modal "Thêm dự án mới" — Quick Deal (Progressive Disclosure)
   - Core (bắt buộc): Sản phẩm · Ứng dụng · Segment · Stage
   - Bối cảnh (Khách hàng · NCC) kế thừa từ dòng được bấm, hiện dạng badge
   - Dự báo & chi tiết nằm trong <details> thu gọn
   - % xác suất tự map theo Stage (STAGE_PROB trong catalog.js) — không còn slider
   API công khai:
     openCreateProjectModal({ customerId, customerName, supplier, noteContent,
                              noteSource, product, sourceActivityId, createdDate, origin })
     stageToProb(stage) → số % (10, 25, …)
     collectProjectForm() → payload thô;  submitCreateProject() → lưu
   Giữ tên cũ để không vỡ các module khác: openForm, closeForm, saveForm,
   buildForm, rebuildRel, addRel, rmRel, syncProb, onFormNcc.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var ICON_CUST = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M3 21h18"/></svg>';
  var ICON_NCC = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 21V11"/></svg>';

  /* Trạng thái của 1 lần mở modal */
  var PF = {
    ctx: {},
    lockCust: false, lockNcc: false,
    touched: {},          // người dùng đã tự chọn → không ghi đè bằng gợi ý
    dupAck: null,         // id dự án trùng đã được cảnh báo
    busy: false,
    lastFocus: null
  };

  /* ───────────── Stage → % ───────────── */
  function stageToProb(stage) {
    var p = (typeof STAGE_PROB !== "undefined" && STAGE_PROB) ? STAGE_PROB[stage] : null;
    return (typeof p === "number" && isFinite(p)) ? p : 10;
  }

  function syncProb() {
    var sel = $("f-stage"); if (!sel) return 10;
    var p = stageToProb(sel.value);
    sel.dataset.prob = String(p);
    return p;
  }

  function fillStages(ncc, keep) {
    var sel = $("f-stage"); if (!sel) return;
    var stages = (typeof pipelineOf === "function") ? pipelineOf(ncc) : [];
    sel.innerHTML = stages.map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(s) + " (" + stageToProb(s) + "%)</option>";
    }).join("");
    if (keep && stages.indexOf(keep) >= 0) sel.value = keep;
    syncProb();
  }

  /* ───────────── Segment (optgroup theo nhóm ngành) ───────────── */
  function fillSegments(keep) {
    var sel = $("f-segment"); if (!sel) return;
    var tree = (typeof SEG_TREE !== "undefined") ? SEG_TREE : {};
    var html = '<option value="">Chọn segment…</option>';
    Object.keys(tree).forEach(function (g) {
      html += '<optgroup label="' + esc(g) + '">' +
        (tree[g] || []).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") +
        "</optgroup>";
    });
    sel.innerHTML = html;
    if (keep) sel.value = keep;
    if (sel.value !== keep) sel.value = "";
  }
  function groupOfSegment(seg) {
    if (typeof SEG2GROUP !== "undefined" && SEG2GROUP[seg]) return SEG2GROUP[seg];
    var tree = (typeof SEG_TREE !== "undefined") ? SEG_TREE : {};
    for (var g in tree) if ((tree[g] || []).indexOf(seg) >= 0) return g;
    return "";
  }

  /* ───────────── Người liên quan (tag input) ───────────── */
  function rebuildRel() {
    var sel = $("f-rel"); if (!sel) return;
    var mine = (typeof me !== "undefined" && me) ? (me.pic || me.name) : "";
    var pool = (typeof ALL_PICS !== "undefined" ? ALL_PICS : [])
      .filter(function (p) { return p !== mine && related.indexOf(p) < 0; });
    sel.innerHTML = '<option value="">+ Thêm người liên quan…</option>' +
      pool.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + "</option>"; }).join("");
  }
  function addRel(v) {
    var sel = $("f-rel");
    v = (typeof v === "string" && v) ? v : (sel ? sel.value : "");
    if (!v || related.indexOf(v) >= 0) return;
    related.push(v);
    var t = document.createElement("span");
    t.className = "tag"; t.dataset.v = v;
    t.innerHTML = esc(v) + ' <button type="button" aria-label="Xoá ' + esc(v) + '">×</button>';
    t.querySelector("button").addEventListener("click", function () { rmRel(v, this); });
    $("relTags").insertBefore(t, sel);
    rebuildRel(); updateMoreCount();
    if (sel) sel.focus();
  }
  function rmRel(v, btn) {
    related = related.filter(function (x) { return x !== v; });
    var tag = btn && btn.closest ? btn.closest(".tag") : null;
    if (tag) tag.remove();
    rebuildRel(); updateMoreCount();
  }
  function clearRelTags() {
    related = [];
    document.querySelectorAll("#relTags .tag").forEach(function (t) { t.remove(); });
    rebuildRel();
  }

  /* ───────────── Datalist + danh mục (gọi lại khi đồng bộ SharePoint) ───────────── */
  function fillDatalist(id, arr) {
    var dl = $(id); if (!dl) return;
    dl.innerHTML = (arr || []).map(function (v) { return '<option value="' + esc(v) + '">'; }).join("");
  }
  function buildForm() {
    if (!$("pfForm")) return;
    fillDatalist("dl-prod", LISTS.products);
    fillDatalist("dl-app", LISTS.applications);
    fillDatalist("dl-cust", LISTS.customers);
    fillSegments($("f-segment") ? $("f-segment").value : "");
    var n = $("f-ncc");
    if (n && n.tagName === "SELECT") fillNccSelect(n.value);
    fillStages(currentNcc(), $("f-stage") ? $("f-stage").value : "");
    rebuildRel();
  }

  /* ───────────── Gợi ý thông minh từ lịch sử khách ───────────── */
  function keyOf(name) { return (typeof custKey === "function") ? custKey(name) : String(name || "").trim().toUpperCase(); }
  function latestRecordOf(cust) {
    if (!cust || typeof RECORDS === "undefined") return null;
    var k = keyOf(cust);
    return RECORDS.filter(function (r) { return keyOf(r.customer) === k; })
      .sort(function (a, b) { return String(b.created || "").localeCompare(String(a.created || "")); })[0] || null;
  }
  function latestActNccOf(cust) {
    if (!cust || typeof ACTIVITIES === "undefined") return "";
    var k = keyOf(cust);
    var a = ACTIVITIES.filter(function (x) { return keyOf(x.customer) === k && x.ncc; })
      .sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })[0];
    return a ? a.ncc : "";
  }
  function guessNcc(cust) {
    if (typeof nccFilter !== "undefined" && nccFilter && !(typeof isAllNcc === "function" && isAllNcc())) return nccFilter;
    var r = latestRecordOf(cust);
    return (r && r.ncc) || latestActNccOf(cust) || (typeof formNcc === "function" ? formNcc() : "");
  }
  function applySuggestions() {
    var cust = currentCustomer();
    var hint = $("pfSegHint"); if (hint) hint.textContent = "";
    if (!PF.lockNcc && !PF.touched.ncc && $("f-ncc")) {
      var g = guessNcc(cust);
      if (g && g !== $("f-ncc").value) { fillNccSelect(g); fillStages(g, $("f-stage").value); }
    }
    if (!PF.touched.segment) {
      var r = latestRecordOf(cust);
      if (r && r.segment) {
        $("f-segment").value = r.segment;
        if ($("f-segment").value === r.segment && hint) hint.textContent = "· gợi ý từ dự án trước";
      }
    }
  }

  /* ───────────── Thanh bối cảnh (Khách hàng · NCC) ───────────── */
  function fillNccSelect(val) {
    var sel = $("f-ncc"); if (!sel) return;
    var opts = (typeof supplierOptions === "function") ? supplierOptions() : (LISTS.nccs || []);
    if (val && opts.indexOf(val) < 0) opts = [val].concat(opts);
    sel.innerHTML = opts.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
    if (val) sel.value = val;
  }
  function renderContext() {
    var c = PF.ctx, box = $("pfCtx");
    var custHtml = PF.lockCust
      ? '<span class="pf-chip" title="Kế thừa từ dòng đã chọn">' + ICON_CUST +
        '<em>Khách hàng:</em><b id="f-cust-ro">' + esc(c.customerName) + "</b></span>"
      : '<label class="pf-chip pf-chip-edit" data-f="customer">' + ICON_CUST +
        '<em>Khách hàng:</em><input id="f-cust" list="dl-cust" placeholder="Chọn / nhập khách hàng…" ' +
        'aria-required="true" aria-describedby="pfErr-customer"><datalist id="dl-cust"></datalist></label>';
    var nccHtml = PF.lockNcc
      ? '<span class="pf-chip" title="Kế thừa từ dòng đã chọn">' + ICON_NCC +
        '<em>NCC:</em><b id="f-ncc-ro">' + esc(c.supplier) + "</b></span>"
      : '<label class="pf-chip pf-chip-edit" data-f="ncc">' + ICON_NCC +
        '<em>NCC:</em><select id="f-ncc" aria-label="Nhà cung cấp"></select></label>';
    box.innerHTML = custHtml + nccHtml + '<small class="pf-err pf-err-ctx" id="pfErr-customer"></small>';

    if (!PF.lockCust) {
      fillDatalist("dl-cust", LISTS.customers);
      var ci = $("f-cust");
      ci.addEventListener("change", applySuggestions);
      ci.addEventListener("input", function () { clearErr("customer"); PF.dupAck = null; });
    }
    if (!PF.lockNcc) {
      fillNccSelect(guessNcc(c.customerName));
      $("f-ncc").addEventListener("change", onFormNcc);
    }
  }
  function currentCustomer() {
    if (PF.lockCust) return PF.ctx.customerName;
    var i = $("f-cust"); return i ? i.value.trim() : "";
  }
  function currentNcc() {
    if (PF.lockNcc) return PF.ctx.supplier;
    var s = $("f-ncc"); return s ? s.value : (typeof formNcc === "function" ? formNcc() : "");
  }
  function onFormNcc() {
    PF.touched.ncc = true; PF.dupAck = null;
    fillStages(currentNcc(), $("f-stage").value);
  }

  /* ───────────── Accordion: đếm số mục tuỳ chọn đã nhập ───────────── */
  function updateMoreCount() {
    var n = 0;
    if ($("f-closing").value) n++;
    if (+$("f-kg1").value > 0) n++;
    if (+$("f-kg2").value > 0) n++;
    if (related.length) n++;
    var b = $("pfMoreN");
    b.hidden = !n; b.textContent = n ? n + " mục đã nhập" : "";
  }

  /* ───────────── Lỗi inline ───────────── */
  function setErr(key, msg) {
    var el = $("pfErr-" + key); if (el) el.textContent = msg;
    var host = document.querySelector('#pfForm [data-f="' + key + '"]');
    if (host) host.classList.add("invalid");
    var input = host && host.querySelector("input,select");
    if (input) input.setAttribute("aria-invalid", "true");
  }
  function clearErr(key) {
    var el = $("pfErr-" + key); if (el) el.textContent = "";
    var host = document.querySelector('#pfForm [data-f="' + key + '"]');
    if (host) { host.classList.remove("invalid");
      var input = host.querySelector("input,select"); if (input) input.removeAttribute("aria-invalid"); }
  }
  function clearAllErr() { ["customer", "product", "application", "segment", "stage"].forEach(clearErr); }

  /* ───────────── Reset ───────────── */
  function resetForm() {
    ["f-prod", "f-app", "f-closing", "f-kg1", "f-kg2", "f-desc"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    clearRelTags(); clearAllErr();
    $("pfMore").open = false; updateMoreCount();
    $("pfNoteSrc").textContent = "";
    $("pfSegHint").textContent = "";
    PF.touched = {}; PF.dupAck = null; PF.busy = false;
    setBusy(false);
  }
  function setBusy(on) {
    var b = $("pfSave"); if (!b) return;
    b.disabled = !!on; b.classList.toggle("is-busy", !!on);
  }

  /* ───────────── MỞ MODAL ───────────── */
  function openCreateProjectModal(contextData) {
    var c = Object.assign({}, contextData || {});
    if (!c.customerName && c.customerId && typeof custLabel === "function") c.customerName = custLabel(c.customerId);
    c.customerName = String(c.customerName || "").trim();
    c.supplier = String(c.supplier || "").trim();
    PF.ctx = c;
    PF.lockCust = !!c.customerName;
    PF.lockNcc = !!c.supplier;
    PF.lastFocus = document.activeElement;

    srcAct = (c.sourceActivityId && typeof ACTIVITIES !== "undefined")
      ? (ACTIVITIES.find(function (a) { return a.id === c.sourceActivityId; }) || null) : null;

    resetForm();
    renderContext();
    fillDatalist("dl-prod", LISTS.products);
    fillDatalist("dl-app", LISTS.applications);
    fillSegments("");
    fillStages(currentNcc(), c.stage || "");
    rebuildRel();
    applySuggestions();

    if (c.product) $("f-prod").value = c.product;
    if (c.application) $("f-app").value = c.application;
    if (c.noteContent) {
      $("f-desc").value = c.noteContent;
      $("pfNoteSrc").textContent = c.noteSource ? "· " + c.noteSource : "· từ hoạt động";
    }
    PF.createdDate = c.createdDate || (typeof isoOf === "function" ? isoOf(TODAY) : new Date().toISOString().slice(0, 10));

    if (typeof NAV !== "undefined") { NAV.enter(c.origin); NAV.renderBack("f-back"); }
    $("ov").classList.add("open");

    requestAnimationFrame(function () {
      var target = !PF.lockCust ? $("f-cust") : (!$("f-prod").value ? $("f-prod") : $("f-app"));
      if (target) target.focus();
    });
  }

  function closeForm() {
    var done = function () {
      $("ov").classList.remove("open");
      if (PF.lastFocus && document.contains(PF.lastFocus) && PF.lastFocus.focus) try { PF.lastFocus.focus(); } catch (e) {}
    };
    if (typeof NAV !== "undefined") NAV.back(done); else done();
  }

  /* openForm(origin) cũ = mở không có bối cảnh (nút "Thêm dự án" trên Funnel) */
  function openForm(origin) { window.openCreateProjectModal({ origin: origin }); }

  /* ───────────── THU THẬP + VALIDATE ───────────── */
  function collectProjectForm() {
    var v = function (id) { var el = $(id); return el ? String(el.value || "").trim() : ""; };
    var num = function (id) { var n = parseFloat(v(id)); return isFinite(n) && n > 0 ? n : 0; };
    var segment = v("f-segment"), stage = v("f-stage");
    return {
      customerId: PF.ctx.customerId || keyOf(currentCustomer()),
      customer: currentCustomer(),
      ncc: currentNcc(),
      product: v("f-prod"),
      application: v("f-app"),
      segment: segment,
      group: groupOfSegment(segment),
      stage: stage,
      prob: stageToProb(stage),
      created: PF.createdDate,
      closing: v("f-closing"),
      kgThis: num("f-kg1"),
      kgNext: num("f-kg2"),
      related: related.slice(),
      desc: v("f-desc")
    };
  }

  function validateProjectForm(p) {
    var errs = {};
    if (!p.customer) errs.customer = "Chọn hoặc nhập khách hàng.";
    else if (!p.ncc) errs.customer = "Chọn nhà cung cấp.";
    if (!p.product) errs.product = "Nhập sản phẩm.";
    if (!p.application) errs.application = "Nhập ứng dụng.";
    if (!p.segment) errs.segment = "Chọn segment.";
    if (!p.stage) errs.stage = "Chọn giai đoạn.";
    return errs;
  }

  function findDuplicate(p) {
    if (typeof RECORDS === "undefined") return null;
    var k = keyOf(p.customer), prod = p.product.toLowerCase();
    return RECORDS.find(function (r) {
      return r.status === "IN PROGRESS" && keyOf(r.customer) === k && r.ncc === p.ncc &&
        String(r.product || "").toLowerCase() === prod;
    }) || null;
  }

  /* Payload tương thích model RECORDS / FISG_STORE.createProject */
  function toRecord(p) {
    var mine = (typeof me !== "undefined" && me) ? (me.pic || me.name) : "";
    var rec = {
      id: "PL-" + Date.now().toString(36).toUpperCase(),
      ncc: p.ncc, group: p.group, segment: p.segment,
      application: p.application, product: p.product, customer: p.customer,
      created: p.created, closing: p.closing, stage: p.stage,
      status: "IN PROGRESS", boptype: "NEW BUSINESS",
      prob: p.prob / 100, kgThis: p.kgThis, kgNext: p.kgNext, desc: p.desc,
      pic: mine, related: p.related, comments: []
    };
    var fromAct = srcAct && PF.ctx.noteContent && rec.desc === String(PF.ctx.noteContent).trim();
    if (rec.desc && !fromAct) rec.comments.push({ by: mine, at: (typeof nowStr === "function" ? nowStr() : ""), text: rec.desc });
    return rec;
  }

  /* ───────────── LƯU ───────────── */
  function submitCreateProject(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (PF.busy) return;
    clearAllErr();

    var p = collectProjectForm();
    var errs = validateProjectForm(p);
    var keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var first = { customer: PF.lockCust ? "f-ncc" : "f-cust", product: "f-prod", application: "f-app",
                    segment: "f-segment", stage: "f-stage" }[keys[0]];
      if ($(first)) $(first).focus();
      return;
    }

    var dup = findDuplicate(p);
    if (dup && PF.dupAck !== dup.id) {
      PF.dupAck = dup.id;
      setErr("product", "Khách này đã có dự án đang chạy với sản phẩm này (" + dup.id + " · " + dup.stage +
        "). Bấm Lưu lần nữa nếu vẫn muốn tạo mới.");
      $("f-prod").focus();
      return;
    }

    PF.busy = true; setBusy(true);
    var rec = toRecord(p);

    [["customers", p.customer], ["products", p.product], ["applications", p.application]].forEach(function (x) {
      if (LISTS[x[0]] && LISTS[x[0]].indexOf(x[1]) < 0) LISTS[x[0]].push(x[1]);
    });

    RECORDS.unshift(rec);
    if (srcAct) {
      srcAct.projectId = rec.id;
      rec.comments.unshift({ by: srcAct.pic, at: srcAct.date,
        text: "[Nguồn gốc — " + srcAct.type + "] " + srcAct.note + (srcAct.next ? " → " + srcAct.next : "") });
      srcAct = null;
      if (typeof renderActs === "function") renderActs();
    }

    closeForm();
    resetForm();
    if (typeof render === "function") render();
    if (typeof cockpitRefresh === "function") cockpitRefresh();
    if (typeof renderCustomers === "function") try { renderCustomers(); } catch (err) {}
    if (typeof notify === "function") notify(rec, "đã tạo dự án mới <b>" + esc(rec.customer) + " · " + esc(rec.product) + "</b>");
    if (typeof toast === "function") toast("Đã tạo dự án " + rec.customer + " · " + rec.product + " (" + rec.stage + ") — đang lưu lên SharePoint…");
    if (typeof pushProject === "function") pushProject(rec);
    return rec;
  }

  /* ───────────── Sự kiện ───────────── */
  function focusables() {
    return [].slice.call($("pfForm").querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null; });
  }
  function bind() {
    var form = $("pfForm"); if (!form || form.dataset.pfReady) return;
    form.dataset.pfReady = "1";

    form.addEventListener("submit", function (e) { e.preventDefault(); window.submitCreateProject(e); });

    $("f-stage").addEventListener("change", function () { PF.touched.stage = true; syncProb(); clearErr("stage"); });
    $("f-segment").addEventListener("change", function () {
      PF.touched.segment = true; clearErr("segment"); $("pfSegHint").textContent = "";
    });
    $("f-prod").addEventListener("input", function () { clearErr("product"); PF.dupAck = null; });
    $("f-app").addEventListener("input", function () { clearErr("application"); });
    $("f-rel").addEventListener("change", function () { addRel(this.value); });
    ["f-closing", "f-kg1", "f-kg2"].forEach(function (id) {
      $(id).addEventListener("input", updateMoreCount);
      $(id).addEventListener("change", updateMoreCount);
    });

    form.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); window.submitCreateProject(); return; }
      if (e.key === "Escape") {
        if (document.querySelector(".dp-cal")) return;   // đang mở lịch → để datepicker đóng trước
        e.preventDefault(); closeForm(); return;
      }
      if (e.key === "Tab") {                              // giữ focus trong modal
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  /* ───────────── Export ───────────── */
  window.openCreateProjectModal = openCreateProjectModal;
  window.closeCreateProjectModal = closeForm;
  window.stageToProb = stageToProb;
  window.collectProjectForm = collectProjectForm;
  window.submitCreateProject = submitCreateProject;
  /* tên cũ — core.js, store.js, extras.js, ui-kit.js, guest.js vẫn gọi */
  window.openForm = openForm;
  window.closeForm = closeForm;
  window.saveForm = submitCreateProject;
  window.buildForm = buildForm;
  window.rebuildRel = rebuildRel;
  window.addRel = addRel;
  window.rmRel = rmRel;
  window.syncProb = syncProb;
  window.onFormNcc = onFormNcc;
})();
