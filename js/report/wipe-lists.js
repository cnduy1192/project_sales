/* wipe-lists.js — CÔNG CỤ CHẠY MỘT LẦN: xoá TOÀN BỘ item trong 2 list SharePoint
   (mặc định: Projects và ProjectUpdates). Chỉ Super Admin / ADMIN_EMAIL chạy được.
   Bắt buộc: Đếm trước → gõ đúng "XOA HET" → xác nhận → mới xoá. KHÔNG hoàn tác. */
(function () {
  "use strict";
  const CFG = window.FISG_CFG || {};
  const CONFIRM_PHRASE = "XOA HET";
  let CACHE = null; // { lists:[{name, items:[ids]}] }

  function txt(v) {
    if (v == null) return "";
    if (typeof v === "object") return v.Title || v.Value || "";
    return String(v);
  }
  function internalOf(cols, display) { for (const k in cols) if (cols[k] === display) return k; return null; }
  function log(msg, cls) {
    const box = document.getElementById("wpLog");
    const p = document.createElement("div");
    p.className = "wp-line" + (cls ? " " + cls : "");
    p.textContent = msg; box.appendChild(p); box.scrollTop = box.scrollHeight;
  }
  function clearLog() { document.getElementById("wpLog").innerHTML = ""; }
  function targets() {
    return [
      document.getElementById("wpList1").value.trim(),
      document.getElementById("wpList2").value.trim(),
    ].filter(Boolean);
  }
  function refreshDeleteBtn() {
    const typed = document.getElementById("wpConfirm").value.trim();
    document.getElementById("wpDelete").disabled = !(CACHE && typed === CONFIRM_PHRASE);
  }
  function setBusy(b) {
    ["wpCount", "wpDelete", "wpList1", "wpList2", "wpConfirm"].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = b;
    });
    if (!b) refreshDeleteBtn();
  }

  /* ---------- Đăng nhập + phân quyền ---------- */
  window.REPORT_SHOW_SIGNIN = function () { show("wpSignin"); };
  window.REPORT_ON_AUTH = async function (account) {
    show("wpLoading");
    try {
      const [cols, items] = await Promise.all([
        FISG_GRAPH.columns("Users"), FISG_GRAPH.listItems("Users"),
      ]);
      const gEmail = internalOf(cols, "Email"), gRole = internalOf(cols, "Vai trò");
      const mail = String(account.username || "").toLowerCase();
      const row = items.find(it => {
        const f = it.fields || {};
        return (txt(gEmail && f[gEmail]) || txt(f.Title)).toLowerCase() === mail;
      });
      const role = row ? String(txt(gRole && (row.fields || {})[gRole]) || "").toLowerCase() : "";
      const isAdmin = mail === String(CFG.ADMIN_EMAIL || "").toLowerCase()
                   || /superadmin|admin|quản trị|quan tri/.test(role);
      if (!isAdmin) {
        document.getElementById("wpDenyMsg").textContent =
          "Tài khoản " + account.username + " (" + (role || "?") + ") không đủ quyền. "
          + "Chỉ Super Admin mới chạy được công cụ này.";
        show("wpDenied"); return;
      }
      document.getElementById("wpWho").textContent = account.username;
      show("wpTool");
    } catch (e) {
      document.getElementById("wpDenyMsg").textContent = "Lỗi tải Users: " + ((e && e.message) || e);
      show("wpDenied");
    }
  };
  const PANES = ["wpLoading", "wpSignin", "wpDenied", "wpTool"];
  function show(p) { PANES.forEach(x => { const el = document.getElementById(x); if (el) el.hidden = x !== p; }); }

  /* ---------- Đếm (dry-run) ---------- */
  async function count() {
    clearLog(); CACHE = null; refreshDeleteBtn(); setBusy(true);
    const names = targets();
    if (!names.length) { log("Chưa nhập tên list.", "warn"); setBusy(false); return; }
    const lists = [];
    try {
      for (const name of names) {
        log("Đang đếm list “" + name + "”…");
        const items = await FISG_GRAPH.listItems(name);
        const ids = (items || []).map(it => it.id);
        lists.push({ name, items: ids });
        log("  • " + name + ": " + ids.length + " item", "head");
      }
      CACHE = { lists };
      const total = lists.reduce((s, l) => s + l.items.length, 0);
      log("Tổng cộng " + total + " item sẽ bị xoá ở " + lists.length + " list.", "head");
      log('Muốn xoá: gõ đúng "' + CONFIRM_PHRASE + '" vào ô xác nhận rồi bấm “Xoá tất cả”.', "warn");
    } catch (e) {
      log("LỖI đếm: " + ((e && e.message) || e) + " — kiểm tra lại TÊN LIST.", "err");
      CACHE = null;
    }
    setBusy(false);
  }

  /* ---------- Xoá ---------- */
  async function wipe() {
    if (!CACHE) { log("Chưa đếm — bấm “Đếm” trước.", "warn"); return; }
    if (document.getElementById("wpConfirm").value.trim() !== CONFIRM_PHRASE) return;
    const total = CACHE.lists.reduce((s, l) => s + l.items.length, 0);
    if (!confirm("XOÁ VĨNH VIỄN " + total + " item ở list: "
      + CACHE.lists.map(l => l.name).join(", ") + " ?\n\nKhông thể hoàn tác.")) return;
    setBusy(true);
    let ok = 0, fail = 0, done = 0;
    log("──── BẮT ĐẦU XOÁ ────", "head");
    for (const l of CACHE.lists) {
      log("Xoá list “" + l.name + "” (" + l.items.length + " item)…");
      for (const id of l.items) {
        try { await FISG_GRAPH.deleteItem(l.name, id); ok++; }
        catch (e) { fail++; log("  ✗ #" + id + ": " + ((e && e.message) || e), "err"); }
        done++;
        if (done % 25 === 0 || done === total) log("  … " + done + "/" + total + " (lỗi " + fail + ")");
      }
    }
    log("HOÀN TẤT. Đã xoá " + ok + " · lỗi " + fail + ".", fail ? "warn" : "head");
    CACHE = null;
    document.getElementById("wpConfirm").value = "";
    setBusy(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = document.getElementById("wpSignIn");
    if (s) s.onclick = () => FISG_AUTH.signIn();
    const so = document.getElementById("wpSignOut");
    if (so) so.onclick = () => FISG_AUTH.signOut();
    document.getElementById("wpCount").onclick = count;
    document.getElementById("wpDelete").onclick = wipe;
    document.getElementById("wpConfirm").addEventListener("input", refreshDeleteBtn);
    // Đổi tên list ⇒ phải đếm lại
    ["wpList1", "wpList2"].forEach(id =>
      document.getElementById(id).addEventListener("input", () => { CACHE = null; refreshDeleteBtn(); }));
  });
})();
