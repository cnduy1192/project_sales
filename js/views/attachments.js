/* ═══════════════════════════════════════════════════════════════════════
   FISG_ATTACH — khối "Tệp đính kèm" dùng chung (Báo cáo · Hoạt động · Dự án)
   - Chọn nhiều tệp một lần hoặc kéo thả vào khung.
   - Tuỳ chọn phân loại tài liệu (opts.categories) — dùng cho Dự án.
   - Tuỳ chọn danh sách chỉ-xem (opts.extra) — vd. tệp từ Hoạt động liên quan.
   - Bản demo (window.FISG_DEMO_AUTO): giả lập upload, tệp chỉ giữ trong phiên trình duyệt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var REG = {};
  var CATS = ["QUOTE", "SPEC", "TEST", "CONTRACT", "OTHER"];
  var EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "zip"];
  var ACCEPT = "." + EXT.join(",.");
  var MAX = 15 * 1024 * 1024;

  /* ── helpers (tự chứa — salesfunnel.html không nạp cockpit.js) ── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function jsq(s) { return esc("'" + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"); }
  function tr(k, p) { return typeof T === "function" ? T(k, p) : k; }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; }
  function extCls(ext) {
    ext = String(ext || "").toLowerCase();
    if (ext === "pdf") return "x-pdf";
    if (/^docx?$/.test(ext)) return "x-doc";
    if (/^xlsx?$/.test(ext)) return "x-xls";
    if (/^pptx?$/.test(ext)) return "x-ppt";
    if (/^(jpe?g|png)$/.test(ext)) return "x-img";
    return "x-oth";
  }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function todayISO_() {
    if (typeof todayISO === "function") return todayISO();
    var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function whoAmI() { return (typeof me !== "undefined" && me) ? (me.pic || me.name || "") : ""; }
  function catOf(a) { return CATS.indexOf(a && a.category) >= 0 ? a.category : "OTHER"; }
  function catLabel(c) { return tr("att.cat." + (CATS.indexOf(c) >= 0 ? c : "OTHER")); }

  function localValidate(file) {
    if (!file) return tr("att.err.noFile");
    if (file.size > MAX) return tr("att.err.tooBig", { n: Math.round(file.size / 1048576) });
    if (EXT.indexOf(extOf(file.name)) < 0) return tr("att.err.type");
    return "";
  }

  /* ── Kho giả lập cho bản demo đào tạo ── */
  var DEMO_LIST = [], demoSeq = 0;
  function demoFolder(type, id, ctx) {
    ctx = ctx || {};
    if (type === "project")
      return ["FISG_Projects", ctx.ncc || "Khác", ctx.customer || "Khách hàng", ctx.code || id].join("/");
    return ["FISG_Attachments", ctx.pic || "Chung", String(ctx.date || todayISO_()).slice(0, 10),
            type === "report" ? "Báo cáo" : (ctx.customer || "Khách hàng")].join("/");
  }
  var DEMO = {
    demo: true,
    canWrite: function () { return true; },
    attValidate: localValidate,
    attFolderOf: demoFolder,
    attachmentsOf: function (type, id) {
      var k = String(type) + ":" + String(id);
      return DEMO_LIST.filter(function (a) { return a.parentType + ":" + a.parentId === k; })
        .sort(function (a, b) { return (b.at || "").localeCompare(a.at || "") || b.seq - a.seq; });
    },
    uploadAttachment: function (type, id, ctx, file, meta) {
      return new Promise(function (res, rej) {
        var bad = localValidate(file); if (bad) { rej(new Error(bad)); return; }
        setTimeout(function () {
          var url = ""; try { url = URL.createObjectURL(file); } catch (e) {}
          var spId = "demo-" + (++demoSeq);
          DEMO_LIST.push({ spId: spId, seq: demoSeq, parentType: String(type), parentId: String(id),
            fileName: file.name, fileType: extOf(file.name), size: file.size, webUrl: url,
            folderPath: demoFolder(type, id, ctx), by: whoAmI(), at: todayISO_(),
            category: meta && meta.category || "" });
          res(spId);
        }, 220);
      });
    },
    deleteAttachment: function (att) {
      var i = DEMO_LIST.findIndex(function (a) { return a.spId === att.spId; });
      if (i >= 0) { try { URL.revokeObjectURL(DEMO_LIST[i].webUrl); } catch (e) {} DEMO_LIST.splice(i, 1); }
      return Promise.resolve(true);
    },
    setAttachmentCategory: function (att, cat) {
      var hit = DEMO_LIST.find(function (a) { return a.spId === att.spId; });
      if (hit) hit.category = cat;
      return Promise.resolve(true);
    }
  };

  function isDemo() { return !!window.FISG_DEMO_AUTO; }
  function S() {
    if (isDemo()) return DEMO;
    return (window.FISG_STORE && FISG_STORE.uploadAttachment) ? FISG_STORE : null;
  }
  function available() { var s = S(); return !!(s && s.canWrite && s.canWrite()); }
  function validate(file) { var s = S(); return (s && s.attValidate) ? s.attValidate(file) : localValidate(file); }
  function list(type, id) { var s = S(); return (id && s && s.attachmentsOf) ? s.attachmentsOf(type, id) : []; }

  function canDel(a) {
    if (typeof me === "undefined" || !me) return false;
    if (typeof myCap === "function" && (myCap().admin || (typeof cap === "function" && cap(me.role).scope === "all"))) return true;
    if (typeof isMine === "function") return isMine(a.by, me);
    return !!a.by && a.by === whoAmI();
  }

  /* Thư mục chứa tệp trên SharePoint — suy từ đường dẫn tệp (bỏ qua link Office Online) */
  function folderUrlOf(items) {
    for (var i = 0; i < items.length; i++) {
      var u = String(items[i].webUrl || "");
      if (!/^https?:/i.test(u) || /_layouts\//i.test(u) || u.indexOf("?") >= 0) continue;
      var j = u.lastIndexOf("/"); if (j > 8) return u.slice(0, j);
    }
    return "";
  }

  /* ── Render ── */
  function itemHTML(host, r, a, opts) {
    var ext = a.fileType || extOf(a.fileName);
    var owner = (window.picLabel ? picLabel(a.by) : a.by) || a.by || "—";
    var meta = [fmtSize(a.size), esc(owner), dmy(a.at)].filter(Boolean).join(" · ");
    if (opts.src) meta = esc(opts.src) + " · " + meta;
    var writable = !opts.readOnly && canDel(a) && available();
    var cat = "";
    if (r.categories && !opts.readOnly) {
      cat = writable
        ? '<select class="att-chip att-chip-sel" aria-label="' + esc(tr("att.catLabel")) + '" onchange="FISG_ATTACH.recat(' + jsq(host) + ',' + jsq(a.spId) + ',this)">' +
            CATS.map(function (c) { return '<option value="' + c + '"' + (c === catOf(a) ? " selected" : "") + ">" + esc(catLabel(c)) + "</option>"; }).join("") +
          "</select>"
        : "";
    }
    var del = writable
      ? '<button type="button" class="att-del" title="' + esc(tr("att.delete")) + '" aria-label="' + esc(tr("att.delete")) + '" onclick="FISG_ATTACH.del(' + jsq(host) + ',' + jsq(a.spId) + ')">×</button>' : "";
    return '<div class="att-item' + (opts.readOnly ? " att-ro" : "") + '">' +
      '<a class="att-link" href="' + esc(a.webUrl || "#") + '" target="_blank" rel="noopener" title="' + esc(a.fileName) + (a.folderPath ? "\n" + esc(a.folderPath) : "") + '">' +
        '<span class="att-ext ' + extCls(ext) + '">' + esc((ext || "?").toUpperCase().slice(0, 4)) + "</span>" +
        '<span class="att-txt"><span class="att-nm">' + esc(a.fileName) + '</span><span class="att-meta">' + meta + "</span></span></a>" +
      cat + del + "</div>";
  }

  function pendingHTML(host, r) {
    return (r.pending || []).map(function (f, i) {
      var ext = extOf(f.name);
      return '<div class="att-item att-pend"><span class="att-link">' +
        '<span class="att-ext ' + extCls(ext) + '">' + esc((ext || "?").toUpperCase().slice(0, 4)) + "</span>" +
        '<span class="att-txt"><span class="att-nm">' + esc(f.name) + '</span><span class="att-meta">' + fmtSize(f.size) +
        (r.categories ? " · " + esc(catLabel(f.__cat)) : "") + " · <b>" + tr("att.pendingUpload") + "</b></span></span></span>" +
        '<button type="button" class="att-del" title="' + esc(tr("att.remove")) + '" aria-label="' + esc(tr("att.remove")) + '" onclick="FISG_ATTACH.unpick(' + jsq(host) + ',' + i + ')">×</button></div>';
    }).join("");
  }

  function render(host) {
    var r = REG[host]; if (!r) return;
    var el = document.getElementById(host); if (!el) return;
    var saved = list(r.type, r.id);
    var extra = [];
    if (r.extra) try { extra = r.extra() || []; } catch (e) { extra = []; }

    var savedHtml;
    if (r.categories && saved.length) {
      savedHtml = CATS.map(function (c) {
        var its = saved.filter(function (a) { return catOf(a) === c; });
        if (!its.length) return "";
        return '<div class="att-grp"><div class="att-grp-h">' + esc(catLabel(c)) + " <span>" + its.length + "</span></div>" +
          its.map(function (a) { return itemHTML(host, r, a, {}); }).join("") + "</div>";
      }).join("");
    } else {
      savedHtml = saved.map(function (a) { return itemHTML(host, r, a, {}); }).join("");
    }
    var pendHtml = pendingHTML(host, r);
    var extraHtml = extra.length
      ? '<div class="att-grp att-grp-ro"><div class="att-grp-h">' + esc(tr("att.fromActivities")) + " <span>" + extra.length + "</span></div>" +
        extra.map(function (a) { return itemHTML(host, r, a, { readOnly: true, src: a.src }); }).join("") + "</div>"
      : "";

    var count = saved.length + (r.pending || []).length;
    var body = (savedHtml + pendHtml + extraHtml) || '<div class="att-empty">' + tr("att.none") + "</div>";
    var folder = r.showFolder ? folderUrlOf(saved) : "";

    var uploader = "";
    if (r.canUpload) {
      var catSel = r.categories
        ? '<label class="att-catpick"><span>' + tr("att.catLabel") + '</span><select onchange="FISG_ATTACH.setCat(' + jsq(host) + ',this.value)">' +
            CATS.map(function (c) { return '<option value="' + c + '"' + (c === r.cat ? " selected" : "") + ">" + esc(catLabel(c)) + "</option>"; }).join("") +
          "</select></label>"
        : "";
      uploader = catSel +
        '<label class="att-add"><input type="file" multiple accept="' + ACCEPT + '" onchange="FISG_ATTACH.pick(this,' + jsq(host) + ')">' +
        '<span>+ ' + tr("att.add") + "</span></label>" +
        '<span class="att-hint">' + tr("att.dropHint") + " · " + tr("att.hint") + "</span>";
    }

    el.classList.add("att-box");
    el.classList.toggle("att-can-drop", !!r.canUpload);
    el.innerHTML = '<div class="att-h"><span class="att-h-t">' + (r.title || tr("att.title")) + "</span>" +
        (count ? ' <span class="att-n">' + count + "</span>" : "") +
        (folder ? '<a class="att-folder" href="' + esc(folder) + '" target="_blank" rel="noopener">' + tr("att.openFolder") + " ↗</a>" : "") +
      "</div>" +
      '<div class="att-list">' + body + "</div>" +
      (uploader ? '<div class="att-foot">' + uploader + "</div>" : "") +
      '<div class="att-status" id="' + esc(host) + '-st" role="status" aria-live="polite"></div>' +
      (r.canUpload ? '<div class="att-drop-ov" aria-hidden="true">' + tr("att.dropHere") + "</div>" : "");
    bindDrop(el, host);
  }

  function bindDrop(el, host) {
    if (el.__attDnd) return;
    el.__attDnd = true;
    var depth = 0;
    var has = function (e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") >= 0; };
    var ok = function () { var r = REG[host]; return !!(r && r.canUpload); };
    el.addEventListener("dragenter", function (e) {
      if (!ok() || !has(e)) return; e.preventDefault(); depth++; el.classList.add("att-over");
    });
    el.addEventListener("dragover", function (e) {
      if (!ok() || !has(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy";
    });
    el.addEventListener("dragleave", function () {
      if (!ok()) return; depth = Math.max(0, depth - 1); if (!depth) el.classList.remove("att-over");
    });
    el.addEventListener("drop", function (e) {
      if (!ok() || !has(e)) return;
      e.preventDefault(); depth = 0; el.classList.remove("att-over");
      addFiles(host, e.dataTransfer.files);
    });
  }

  /* opts: { type, id, ctx, canUpload, onChange, categories, extra, title, showFolder, onUploaded, onDeleted, onPending } */
  function mount(hostId, opts) {
    var prev = REG[hostId];
    REG[hostId] = {
      type: opts.type, id: opts.id || "", ctx: opts.ctx || {},
      canUpload: !!opts.canUpload && (opts.id ? available() : true),
      onChange: opts.onChange, onUploaded: opts.onUploaded, onDeleted: opts.onDeleted, onPending: opts.onPending,
      categories: !!opts.categories, extra: opts.extra, title: opts.title, showFolder: !!opts.showFolder,
      cat: (prev && prev.cat && opts.categories) ? prev.cat : "OTHER",
      pending: [], busy: false, lastSay: prev && prev.lastSay
    };
    render(hostId);
    /* buildRecord() dựng lại cả Record Page → giữ thông báo vừa hiện (vd. "Đã đính kèm 3 tệp") */
    var ls = REG[hostId].lastSay;
    if (ls && Date.now() - ls.t < 5000) say(hostId, ls.cls, ls.msg);
    return hostId;
  }

  function say(host, cls, msg) {
    if (REG[host]) REG[host].lastSay = { cls: cls, msg: msg, t: Date.now() };
    var st = document.getElementById(host + "-st");
    if (st) { st.className = "att-status" + (cls ? " " + cls : ""); st.textContent = msg; }
  }

  function setCat(host, v) { var r = REG[host]; if (r) r.cat = CATS.indexOf(v) >= 0 ? v : "OTHER"; }

  function pick(input, host) {
    var files = input.files ? [].slice.call(input.files) : [];
    input.value = "";
    addFiles(host, files);
  }

  /* Tách tệp hợp lệ / không hợp lệ, gắn loại tài liệu đang chọn */
  function screen(r, files) {
    var good = [], bad = [];
    [].slice.call(files || []).forEach(function (f) {
      var why = validate(f);
      if (why) bad.push(f.name + ": " + why);
      else { if (r && r.categories && !f.__cat) try { f.__cat = r.cat; } catch (e) {} good.push(f); }
    });
    return { good: good, bad: bad };
  }

  function addFiles(host, files) {
    var r = REG[host]; if (!r || !r.canUpload) return;
    var sc = screen(r, files);
    if (!sc.good.length) { if (sc.bad.length) say(host, "err", tr("att.cannotAttach") + " " + sc.bad.join(" · ")); return; }

    if (!r.id) {
      sc.good.forEach(function (f) { r.pending.push(f); });
      render(host);
      say(host, sc.bad.length ? "err" : "", sc.bad.length ? tr("att.cannotAttach") + " " + sc.bad.join(" · ") : tr("att.willUpload"));
      if (r.onPending) try { r.onPending(r.pending.length); } catch (e) {}
      return;
    }
    if (r.busy) { say(host, "err", tr("att.busy")); return; }
    r.busy = true;
    var s = S(), okNames = [], errs = sc.bad.slice(), total = sc.good.length, i = 0;
    sc.good.reduce(function (chain, f) {
      return chain.then(function () {
        i++;
        say(host, "", total > 1 ? tr("att.uploadingN", { i: i, n: total, f: f.name }) : tr("att.uploading", { f: f.name }));
        return s.uploadAttachment(r.type, r.id, r.ctx, f, { category: f.__cat || "" })
          .then(function () { okNames.push(f.name); })
          .catch(function (e) { errs.push(f.name + ": " + (e && (e.message || e))); });
      });
    }, Promise.resolve()).then(function () {
      r.busy = false;
      render(host);
      if (errs.length) say(host, "err", (okNames.length ? tr("att.nAttached", { n: okNames.length }) + " " : "") +
        tr("att.someFailed", { n: errs.length, e: errs.join(" · ") }));
      else say(host, "ok", okNames.length === 1 ? tr("att.attached", { f: okNames[0] }) : tr("att.nAttached", { n: okNames.length }));
      if (okNames.length && r.onUploaded) try { r.onUploaded(okNames); } catch (e) {}
      if (okNames.length && r.onChange) try { r.onChange(); } catch (e) {}
    });
  }

  function unpick(host, i) {
    var r = REG[host]; if (!r) return;
    r.pending.splice(i, 1); render(host);
    if (r.onPending) try { r.onPending(r.pending.length); } catch (e) {}
  }

  function findSaved(r, spId) {
    return list(r.type, r.id).filter(function (x) { return String(x.spId) === String(spId); })[0];
  }

  function del(host, spId) {
    var r = REG[host]; if (!r) return;
    var att = findSaved(r, spId);
    if (!att) return;
    if (typeof confirm === "function" && !confirm(tr("att.confirmDel", { f: att.fileName }))) return;
    S().deleteAttachment(att).then(function () {
      render(host);
      if (r.onDeleted) try { r.onDeleted(att.fileName); } catch (e) {}
      if (r.onChange) try { r.onChange(); } catch (e) {}
      if (window.toast) toast(tr("att.deleted"));
    }).catch(function (e) { if (window.toast) toast(tr("att.delFail") + " " + (e && (e.message || e))); });
  }

  function recat(host, spId, sel) {
    var r = REG[host]; if (!r) return;
    var att = findSaved(r, spId); if (!att) return;
    var s = S(); if (!s || !s.setAttachmentCategory) return;
    var prev = att.category || "";
    sel.disabled = true;
    s.setAttachmentCategory(att, sel.value).then(function () {
      render(host); say(host, "ok", tr("att.catSaved", { c: catLabel(sel.value) }));
    }).catch(function (e) {
      att.category = prev; render(host);
      say(host, "err", tr("att.catFail") + " " + (e && (e.message || e)));
    });
  }

  function flush(host, info) {
    var r = REG[host];
    if (!r || !r.pending || !r.pending.length) return Promise.resolve(0);
    var id = (info && info.id) || r.id;
    var ctx = (info && info.ctx) || r.ctx;
    if (!id) return Promise.resolve(0);
    r.id = id; if (info && info.ctx) r.ctx = info.ctx;
    var files = r.pending.slice(); r.pending = [];
    return uploadFiles(r.type, id, ctx, files).then(function (done) {
      try { render(host); } catch (e) {}
      if (r.onChange) try { r.onChange(); } catch (e) {}
      return done;
    });
  }

  function hasPending(host) { var r = REG[host]; return !!(r && r.pending && r.pending.length); }

  function takePending(host) {
    var r = REG[host]; if (!r) return [];
    var files = r.pending || []; r.pending = []; try { render(host); } catch (e) {}
    return files;
  }

  /* Tải lần lượt; opts.onDone(tênTệpThànhCông[]) — dùng để ghi nhật ký dự án */
  function uploadFiles(type, id, ctx, files, opts) {
    if (!files || !files.length || !id) return Promise.resolve(0);
    var s = S(); if (!s) return Promise.resolve(0);
    var ok = [], errs = [];
    return files.reduce(function (chain, f) {
      return chain.then(function () {
        return s.uploadAttachment(type, id, ctx, f, { category: f.__cat || "" })
          .then(function () { ok.push(f.name); })
          .catch(function (e) { errs.push(f.name + ": " + (e && (e.message || e))); });
      });
    }, Promise.resolve()).then(function () {
      if (errs.length && window.toast) toast(tr("att.someFailed", { n: errs.length, e: errs[0] }));
      else if (ok.length && window.toast) toast(tr("att.nAttached", { n: ok.length }));
      if (ok.length && opts && opts.onDone) try { opts.onDone(ok); } catch (e) {}
      return ok.length;
    });
  }

  /* ── Dự án: khoá tham chiếu + bối cảnh thư mục ── */
  function projectKey(rec) {
    if (!rec) return "";
    if (isDemo()) return String(rec.id || "");
    return rec.spId ? String(rec.spId) : "";
  }
  function projectCtx(rec, spId) {
    rec = rec || {};
    var sp = spId || rec.spId;
    var code = /^(FI|P)-\d+$/.test(String(rec.id || "")) ? rec.id : (sp ? "ID-" + sp : String(rec.id || ""));
    return { ncc: rec.ncc || "", customer: rec.customer || "", code: code, pic: rec.pic || "" };
  }

  window.FISG_ATTACH = {
    mount: mount, render: render, pick: pick, unpick: unpick, del: del, recat: recat, setCat: setCat,
    addFiles: addFiles, flush: flush, hasPending: hasPending, takePending: takePending, uploadFiles: uploadFiles,
    validate: validate, list: list, available: available, isDemo: isDemo,
    projectKey: projectKey, projectCtx: projectCtx,
    CATS: CATS, ACCEPT: ACCEPT, catLabel: catLabel, fmtSize: fmtSize, extOf: extOf, extCls: extCls
  };
})();
