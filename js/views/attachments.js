/* js/views/attachments.js — khu "Tệp đính kèm" dùng chung cho hoạt động & báo cáo.
 *
 * FISG_ATTACH.mount(hostId, {type, id, ctx, canUpload, onChange}):
 *   type   : 'activity' | 'report'
 *   id     : spId hoạt động / mã báo cáo
 *   ctx    : { pic, date, customer }  (customer rỗng cho báo cáo)
 *   canUpload : có được tải lên không (theo quyền của màn gọi)
 * Tự dựng danh sách file + ô chọn file; upload/xoá qua FISG_STORE.
 * Toàn bộ logic ghi nằm ở store.js; file này chỉ lo giao diện. */
(function () {
  "use strict";
  var REG = {};
  function key(t, id) { return String(t) + ":" + String(id); }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  /* Người tải HOẶC quản lý/admin mới xoá được. */
  function canDel(a) {
    if (typeof me === "undefined" || !me) return false;
    if (myCap().admin || cap(me.role).scope === "all") return true;
    return typeof isMine === "function" && isMine(a.by, me);
  }

  function render(k) {
    var r = REG[k]; if (!r) return;
    var host = document.getElementById(r.hostId); if (!host) return;
    var files = (window.FISG_STORE && FISG_STORE.attachmentsOf) ? FISG_STORE.attachmentsOf(r.type, r.id) : [];
    var canWrite = !!(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite());

    var rows = files.length ? files.map(function (a) {
      var del = (canDel(a) && canWrite)
        ? '<button class="att-del" title="Xoá tệp" aria-label="Xoá tệp" onclick="FISG_ATTACH.del(\'' + k + '\',\'' + ckAttr(a.spId) + '\')">×</button>' : "";
      return '<div class="att-item">'
        + '<a class="att-link" href="' + ckEsc(a.webUrl || "#") + '" target="_blank" rel="noopener">'
        + '<span class="att-ext">' + ckEsc((a.fileType || "?").toUpperCase()) + '</span>'
        + '<span class="att-nm">' + ckEsc(a.fileName) + '</span></a>'
        + '<span class="att-meta">' + fmtSize(a.size) + ' · ' + ckEsc((window.picLabel ? picLabel(a.by) : a.by) || a.by || "—") + '</span>'
        + del + '</div>';
    }).join("") : '<div class="att-empty">Chưa có tệp đính kèm.</div>';

    var uploader = "";
    if (r.canUpload && canWrite)
      uploader = '<label class="att-add"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" onchange="FISG_ATTACH.pick(this,\'' + k + '\')">'
        + '<span>+ Đính kèm tệp</span></label><span class="att-hint">Tối đa 15MB · pdf, word, excel, ppt, ảnh, zip</span>';
    else if (r.canUpload)
      uploader = '<div class="att-note">Đăng nhập Microsoft 365 để đính kèm tệp.</div>';

    host.innerHTML = '<div class="att-h">Tệp đính kèm' + (files.length ? ' <span>' + files.length + '</span>' : '') + '</div>'
      + '<div class="att-list">' + rows + '</div>'
      + '<div class="att-foot">' + uploader + '</div>'
      + '<div class="att-status" id="' + r.hostId + '-st"></div>';
  }

  function mount(hostId, opts) {
    var k = key(opts.type, opts.id);
    REG[k] = { hostId: hostId, type: opts.type, id: opts.id, ctx: opts.ctx || {},
               canUpload: !!opts.canUpload, onChange: opts.onChange };
    render(k);
    return k;
  }

  function pick(input, k) {
    var r = REG[k]; if (!r) return;
    var file = input.files && input.files[0]; if (!file) return;
    var st = document.getElementById(r.hostId + "-st");
    function say(cls, msg) { if (st) { st.className = "att-status" + (cls ? " " + cls : ""); st.textContent = msg; } }
    var bad = FISG_STORE.attValidate(file);
    if (bad) { say("err", "Không đính kèm được: " + bad); input.value = ""; return; }
    say("", "Đang tải " + file.name + "…"); input.disabled = true;
    FISG_STORE.uploadAttachment(r.type, r.id, r.ctx, file).then(function () {
      render(k); say("ok", "Đã đính kèm " + file.name + ".");
      if (r.onChange) try { r.onChange(); } catch (e) {}
    }).catch(function (e) {
      say("err", "Không tải được: " + (e && (e.message || e)));
    }).then(function () { input.value = ""; input.disabled = false; });
  }

  function del(k, spId) {
    var r = REG[k]; if (!r) return;
    var att = FISG_STORE.attachmentsOf(r.type, r.id).filter(function (x) { return String(x.spId) === String(spId); })[0];
    if (!att) return;
    if (typeof confirm === "function" && !confirm('Xoá tệp "' + att.fileName + '"? Không hoàn tác.')) return;
    FISG_STORE.deleteAttachment(att).then(function () {
      render(k); if (r.onChange) try { r.onChange(); } catch (e) {}
      if (window.toast) toast("Đã xoá tệp.");
    }).catch(function (e) {
      if (window.toast) toast("Không xoá được: " + (e && (e.message || e)));
    });
  }

  window.FISG_ATTACH = { mount: mount, render: render, pick: pick, del: del, key: key };
})();
