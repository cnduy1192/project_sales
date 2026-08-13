(function () {
  "use strict";
  var REG = {};

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(String(name || "")); return m ? m[1].toUpperCase() : "?"; }

  function canDel(a) {
    if (typeof me === "undefined" || !me) return false;
    if (myCap().admin || cap(me.role).scope === "all") return true;
    return typeof isMine === "function" && isMine(a.by, me);
  }

  function render(host) {
    var r = REG[host]; if (!r) return;
    var el = document.getElementById(host); if (!el) return;
    var canWrite = !!(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite());
    var saved = (r.id && window.FISG_STORE && FISG_STORE.attachmentsOf) ? FISG_STORE.attachmentsOf(r.type, r.id) : [];

    var savedHtml = saved.map(function (a) {
      var del = (canDel(a) && canWrite)
        ? '<button class="att-del" title="Xoá tệp" aria-label="Xoá tệp" onclick="FISG_ATTACH.del(\'' + host + '\',\'' + ckAttr(a.spId) + '\')">×</button>' : "";
      return '<div class="att-item"><a class="att-link" href="' + ckEsc(a.webUrl || "#") + '" target="_blank" rel="noopener">'
        + '<span class="att-ext">' + ckEsc((a.fileType || "?").toUpperCase()) + '</span>'
        + '<span class="att-nm">' + ckEsc(a.fileName) + '</span></a>'
        + '<span class="att-meta">' + fmtSize(a.size) + ' · ' + ckEsc((window.picLabel ? picLabel(a.by) : a.by) || a.by || "—") + '</span>'
        + del + '</div>';
    }).join("");

    var pendHtml = (r.pending || []).map(function (f, i) {
      return '<div class="att-item att-pend"><span class="att-link">'
        + '<span class="att-ext">' + ckEsc(extOf(f.name)) + '</span>'
        + '<span class="att-nm">' + ckEsc(f.name) + '</span></span>'
        + '<span class="att-meta">' + fmtSize(f.size) + ' · <b>chờ tải khi lưu</b></span>'
        + '<button class="att-del" title="Bỏ tệp" aria-label="Bỏ tệp" onclick="FISG_ATTACH.unpick(\'' + host + '\',' + i + ')">×</button></div>';
    }).join("");

    var count = saved.length + (r.pending || []).length;
    var body = (savedHtml + pendHtml) || '<div class="att-empty">Chưa có tệp đính kèm.</div>';

    var uploader = "";
    if (r.canUpload)
      uploader = '<label class="att-add"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" onchange="FISG_ATTACH.pick(this,\'' + host + '\')">'
        + '<span>+ Đính kèm tệp</span></label><span class="att-hint">Tối đa 15MB · pdf, word, excel, ppt, ảnh, zip</span>';

    el.innerHTML = '<div class="att-h">Tệp đính kèm' + (count ? ' <span>' + count + '</span>' : '') + '</div>'
      + '<div class="att-list">' + body + '</div>'
      + '<div class="att-foot">' + uploader + '</div>'
      + '<div class="att-status" id="' + host + '-st"></div>';
  }

  function mount(hostId, opts) {
    REG[hostId] = { type: opts.type, id: opts.id || "", ctx: opts.ctx || {},
                    canUpload: !!opts.canUpload, onChange: opts.onChange, pending: [] };
    render(hostId);
    return hostId;
  }

  function say(host, cls, msg) {
    var st = document.getElementById(host + "-st");
    if (st) { st.className = "att-status" + (cls ? " " + cls : ""); st.textContent = msg; }
  }

  function pick(input, host) {
    var r = REG[host]; if (!r) return;
    var file = input.files && input.files[0]; input.value = "";
    if (!file) return;
    var bad = (window.FISG_STORE && FISG_STORE.attValidate) ? FISG_STORE.attValidate(file) : "";
    if (bad) { say(host, "err", "Không đính kèm được: " + bad); return; }

    if (!r.id) { r.pending.push(file); render(host); say(host, "", "Sẽ tải lên khi bạn bấm Lưu."); return; }

    say(host, "", "Đang tải " + file.name + "…");
    FISG_STORE.uploadAttachment(r.type, r.id, r.ctx, file).then(function () {
      render(host); say(host, "ok", "Đã đính kèm " + file.name + ".");
      if (r.onChange) try { r.onChange(); } catch (e) {}
    }).catch(function (e) { say(host, "err", "Không tải được: " + (e && (e.message || e))); });
  }

  function unpick(host, i) {
    var r = REG[host]; if (!r) return;
    r.pending.splice(i, 1); render(host);
  }

  function del(host, spId) {
    var r = REG[host]; if (!r) return;
    var att = FISG_STORE.attachmentsOf(r.type, r.id).filter(function (x) { return String(x.spId) === String(spId); })[0];
    if (!att) return;
    if (typeof confirm === "function" && !confirm('Xoá tệp "' + att.fileName + '"? Không hoàn tác.')) return;
    FISG_STORE.deleteAttachment(att).then(function () {
      render(host); if (r.onChange) try { r.onChange(); } catch (e) {}
      if (window.toast) toast("Đã xoá tệp.");
    }).catch(function (e) { if (window.toast) toast("Không xoá được: " + (e && (e.message || e))); });
  }

  function flush(host, info) {
    var r = REG[host];
    if (!r || !r.pending || !r.pending.length) return Promise.resolve(0);
    var id = (info && info.id) || r.id;
    var ctx = (info && info.ctx) || r.ctx;
    if (!id) return Promise.resolve(0);
    r.id = id; if (info && info.ctx) r.ctx = info.ctx;
    var files = r.pending.slice(); r.pending = [];
    var done = 0, errs = [];
    return files.reduce(function (chain, f) {
      return chain.then(function () {
        return FISG_STORE.uploadAttachment(r.type, id, ctx, f)
          .then(function () { done++; })
          .catch(function (e) { errs.push(f.name + ": " + (e && (e.message || e))); });
      });
    }, Promise.resolve()).then(function () {
      try { render(host); } catch (e) {}
      if (errs.length && window.toast)
        toast("Có " + errs.length + " tệp chưa tải được: " + errs[0]);
      else if (done && window.toast) toast("Đã đính kèm " + done + " tệp.");
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

  function uploadFiles(type, id, ctx, files) {
    if (!files || !files.length || !id) return Promise.resolve(0);
    var done = 0, errs = [];
    return files.reduce(function (chain, f) {
      return chain.then(function () {
        return FISG_STORE.uploadAttachment(type, id, ctx, f)
          .then(function () { done++; })
          .catch(function (e) { errs.push(f.name + ": " + (e && (e.message || e))); });
      });
    }, Promise.resolve()).then(function () {
      if (errs.length && window.toast) toast("Có " + errs.length + " tệp chưa tải được: " + errs[0]);
      else if (done && window.toast) toast("Đã đính kèm " + done + " tệp.");
      return done;
    });
  }

  window.FISG_ATTACH = { mount: mount, render: render, pick: pick, unpick: unpick,
                         del: del, flush: flush, hasPending: hasPending,
                         takePending: takePending, uploadFiles: uploadFiles };
})();
