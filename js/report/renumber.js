/* renumber.js — CÔNG CỤ CHẠY MỘT LẦN: đánh số lại mã báo cáo (Title) trên list
   Reports thành R-0001, R-0002… theo thứ tự ngày gửi, và cập nhật lại "Mã báo cáo"
   trong ReportComments cho khớp. Chỉ Super Admin / ADMIN_EMAIL chạy được.
   Luôn "Phân tích (thử)" trước; chỉ ghi khi bấm "Áp dụng". */
(function () {
  "use strict";
  const CFG = window.FISG_CFG || {};
  let PLAN = null; // { reports:[...], comments:[...] }

  function txt(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
    if (typeof v === "object") return v.LookupValue || v.Label || v.Title || v.Value || "";
    return String(v);
  }
  function internalOf(cols, display) {
    for (const k in cols) if (cols[k] === display) return k;
    return null;
  }
  function pad4(n) { return "R-" + String(n).padStart(4, "0"); }
  function log(msg, cls) {
    const box = document.getElementById("rnLog");
    const p = document.createElement("div");
    p.className = "rn-line" + (cls ? " " + cls : "");
    p.textContent = msg;
    box.appendChild(p); box.scrollTop = box.scrollHeight;
  }
  function clearLog() { document.getElementById("rnLog").innerHTML = ""; }
  function setBusy(b) {
    document.getElementById("rnDry").disabled = b;
    document.getElementById("rnApply").disabled = b || !PLAN;
  }

  /* ---------- Đăng nhập + phân quyền ---------- */
  window.REPORT_SHOW_SIGNIN = function () { show("rnSignin"); };
  window.REPORT_ON_AUTH = async function (account) {
    show("rnLoading");
    try {
      const [cols, items] = await Promise.all([
        FISG_GRAPH.columns("Users"), FISG_GRAPH.listItems("Users"),
      ]);
      const gEmail = internalOf(cols, "Email"), gRole = internalOf(cols, "Vai trò");
      const mail = String(account.username || "").toLowerCase();
      const row = items.find(it => {
        const f = it.fields || {};
        const e = (txt(gEmail && f[gEmail]) || txt(f.Title)).toLowerCase();
        return e === mail;
      });
      const role = row ? String(txt(gRole && (row.fields || {})[gRole]) || "").toLowerCase() : "";
      const isAdmin = mail === String(CFG.ADMIN_EMAIL || "").toLowerCase()
                   || /superadmin|admin|quản trị|quan tri/.test(role);
      if (!isAdmin) {
        document.getElementById("rnDenyMsg").textContent =
          "Tài khoản " + account.username + " (" + (role || "?") + ") không đủ quyền. "
          + "Chỉ Super Admin mới chạy được công cụ này.";
        show("rnDenied"); return;
      }
      document.getElementById("rnWho").textContent = account.username;
      show("rnTool");
    } catch (e) {
      document.getElementById("rnDenyMsg").textContent = "Lỗi tải Users: " + ((e && e.message) || e);
      show("rnDenied");
    }
  };

  const PANES = ["rnLoading", "rnSignin", "rnDenied", "rnTool"];
  function show(p) { PANES.forEach(x => { const el = document.getElementById(x); if (el) el.hidden = x !== p; }); }

  /* ---------- Phân tích (dry-run) ---------- */
  async function dryRun() {
    clearLog(); PLAN = null; setBusy(true);
    try {
      log("Đang đọc list Reports…");
      const [rCols, rItems] = await Promise.all([
        FISG_GRAPH.columns("Reports"), FISG_GRAPH.listItems("Reports"),
      ]);
      const rDate = internalOf(rCols, "Ngày gửi");
      const rPic = internalOf(rCols, "Người gửi");

      const reports = rItems.map(it => {
        const f = it.fields || {};
        return { id: it.id, oldTitle: txt(f.Title),
                 date: (txt(rDate && f[rDate]) || "").slice(0, 10),
                 pic: txt(rPic && f[rPic]) };
      });
      // Sắp xếp theo ngày gửi tăng dần; hoà thì theo id.
      reports.sort((a, b) =>
        (a.date || "").localeCompare(b.date || "") || (+a.id) - (+b.id));
      reports.forEach((r, i) => { r.newTitle = pad4(i + 1); });

      log("Đang đọc list ReportComments…");
      let cItems = [], cCols = {};
      try {
        [cCols, cItems] = await Promise.all([
          FISG_GRAPH.columns("ReportComments"), FISG_GRAPH.listItems("ReportComments"),
        ]);
      } catch (e) { log("(Không đọc được ReportComments — bỏ qua)", "warn"); }
      const cCode = internalOf(cCols, "Mã báo cáo");
      const cDate = internalOf(cCols, "Ngày");

      const byOld = {};
      reports.forEach(r => { (byOld[r.oldTitle] = byOld[r.oldTitle] || []).push(r); });

      const comments = cItems.map(it => {
        const f = it.fields || {};
        const oldCode = txt(cCode && f[cCode]) || txt(f.Title);
        const cd = (txt(cDate && f[cDate]) || "").slice(0, 10);
        const cands = byOld[oldCode] || [];
        let target = null, guessed = false, orphan = false;
        if (cands.length === 1) target = cands[0];
        else if (cands.length > 1) {
          guessed = true;
          const le = cands.filter(r => (r.date || "") <= cd)
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
          target = le.length ? le[le.length - 1]
            : cands.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
        } else orphan = true;
        return { id: it.id, oldCode, newCode: target ? target.newTitle : null, guessed, orphan };
      });

      PLAN = {
        internal: { cCode: cCode, cTitle: "Title" },
        reports: reports.filter(r => r.newTitle !== r.oldTitle),
        reportsAll: reports,
        comments: comments.filter(c => c.newCode && c.newCode !== c.oldCode),
        guessed: comments.filter(c => c.guessed),
        orphans: comments.filter(c => c.orphan),
      };

      log("──── KẾ HOẠCH ────", "head");
      log("Tổng báo cáo: " + reports.length + " · sẽ đổi Title: " + PLAN.reports.length);
      reports.slice(0, 200).forEach(r =>
        log("  #" + r.id + "  " + (r.oldTitle || "(trống)") + " → " + r.newTitle
            + "  · " + (r.date || "?") + " · " + (r.pic || ""),
            r.newTitle !== r.oldTitle ? "" : "dim"));
      log("Tổng phản hồi: " + comments.length + " · sẽ cập nhật mã: " + PLAN.comments.length
          + " · đoán theo ngày: " + PLAN.guessed.length + " · mồ côi: " + PLAN.orphans.length,
          PLAN.guessed.length || PLAN.orphans.length ? "warn" : "");
      if (PLAN.guessed.length)
        log("  ⚠ " + PLAN.guessed.length + " phản hồi có mã cũ TRÙNG nhiều báo cáo — đã đoán theo ngày, nên kiểm tra tay.", "warn");
      if (PLAN.orphans.length)
        log("  ⚠ " + PLAN.orphans.length + " phản hồi không khớp báo cáo nào — giữ nguyên.", "warn");
      log("Xong phân tích. Bấm “Áp dụng” để ghi thay đổi.", "head");
    } catch (e) {
      log("LỖI phân tích: " + ((e && e.message) || e), "err");
      PLAN = null;
    }
    setBusy(false);
  }

  /* ---------- Áp dụng ---------- */
  async function apply() {
    if (!PLAN) { log("Chưa có kế hoạch — bấm Phân tích trước.", "warn"); return; }
    if (!confirm("Ghi thay đổi lên SharePoint?\n\n"
      + PLAN.reports.length + " Title báo cáo + " + PLAN.comments.length
      + " mã phản hồi sẽ được cập nhật. Không thể hoàn tác tự động.")) return;
    setBusy(true);
    let ok = 0, fail = 0;
    log("──── ÁP DỤNG ────", "head");
    for (const r of PLAN.reports) {
      try { await FISG_GRAPH.updateItem("Reports", r.id, { Title: r.newTitle }); ok++;
        log("  ✓ Report #" + r.id + " → " + r.newTitle);
      } catch (e) { fail++; log("  ✗ Report #" + r.id + ": " + ((e && e.message) || e), "err"); }
    }
    for (const c of PLAN.comments) {
      const fields = { Title: c.newCode };
      if (PLAN.internal.cCode) fields[PLAN.internal.cCode] = c.newCode;
      try { await FISG_GRAPH.updateItem("ReportComments", c.id, fields); ok++;
        log("  ✓ Comment #" + c.id + " → " + c.newCode + (c.guessed ? " (đoán)" : ""));
      } catch (e) { fail++; log("  ✗ Comment #" + c.id + ": " + ((e && e.message) || e), "err"); }
    }
    log("HOÀN TẤT. Thành công " + ok + " · lỗi " + fail + ".", fail ? "warn" : "head");
    log("Tải lại report.html để kiểm tra. Công cụ này chỉ nên chạy một lần.", "head");
    PLAN = null; setBusy(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = document.getElementById("rnSignIn");
    if (s) s.onclick = () => FISG_AUTH.signIn();
    document.getElementById("rnDry").onclick = dryRun;
    document.getElementById("rnApply").onclick = apply;
    const so = document.getElementById("rnSignOut");
    if (so) so.onclick = () => FISG_AUTH.signOut();
  });
})();
