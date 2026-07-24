/* js/i18n.js — Song ngữ VI/EN ở tầng hiển thị (classic script, scope toàn cục).
 * VI là ngôn ngữ nguồn trong code; khi bật EN thì dịch DOM theo từ điển + luật regex.
 * Loại trừ #aiMsgs (báo cáo tuần & output chatbot là NỘI DUNG, giữ tiếng Việt).
 * Nút chuyển VN|EN tự chèn vào header; lựa chọn lưu localStorage.
 */
(function () {
  let LANG = 'vi';
  try { LANG = localStorage.getItem('fisg_lang') || 'vi'; } catch (e) {}

  // ---- từ điển VI -> EN (chrome tĩnh + nhãn động + từ vựng cố định) ----
  const DICT = {
    // đăng nhập / nav
    "Đăng nhập bằng tài khoản công ty": "Sign in with your company account",
    "Đăng nhập bằng Microsoft 365": "Sign in with Microsoft 365",
    "Demo — đăng nhập nhanh theo vai trò": "Demo — quick sign-in by role",
    "Làm việc": "Work", "Hoạt động khách hàng": "Customer Activities",
    "Quản trị": "Administration", "Người dùng & phân quyền": "Users & Permissions",
    "Thông báo": "Notifications", "Xuất Excel": "Export Excel",
    "Thêm dự án": "Add Project", "Phân bố giai đoạn": "Stage Distribution",
    "Bỏ lọc giai đoạn": "Clear stage filter", "Tất cả": "All",
    "Ghi hoạt động": "Log Activity", "Đã gắn dự án": "Linked to project",
    "Chưa có dự án": "No project yet", "Tra cứu chi tiết & lịch sử": "Detail & History Lookup",
    "Khách hàng · Segment · Sales": "Customer · Segment · Sales",
    "Chọn một khách hàng, phân khúc hoặc sales để xem toàn bộ lịch sử dự án theo timeline.":
      "Select a customer, segment or sales to see the full project history timeline.",
    "Dự án tạo mới theo tháng": "New projects by month",
    "di chuột lên điểm để xem chi tiết": "hover a point for details",
    "Tỷ trọng trạng thái": "Status breakdown", "click để lọc funnel": "click to filter funnel",
    "Phân khúc thị trường": "Market segments",
    "click một nhóm để xem 13 segment bên trong": "click a group to see the 13 segments inside",
    "Hiệu suất theo Sales": "Performance by Sales", "click để xem chi tiết": "click for details",
    "Sắp đến hạn đóng": "Closing soon", "click để mở dự án": "click to open project",
    "Funnel theo giai đoạn (đang chạy)": "Funnel by stage (in progress)",
    "Top sản phẩm theo tiềm năng KG": "Top products by potential KG",
    "Nhân viên": "Staff", "Vai trò": "Role", "Thao tác": "Actions",
    // form dự án
    "Thêm dự án mới": "Add new project", "Khách hàng": "Customer",
    "Sản phẩm Roquette": "Roquette Product", "Ứng dụng của khách hàng": "Customer application",
    "Nhà cung cấp": "Supplier", "Nhóm ngành": "Segment group",
    "Giai đoạn (BOP Stage)": "Stage (BOP Stage)", "% dự án": "Project %",
    "Loại cơ hội": "Opportunity type", "Ngày tạo": "Creation date",
    "Ngày đóng dự kiến": "Expected closing date",
    "Tiềm năng năm nay (KG)": "Potential this year (KG)",
    "Tiềm năng năm sau (KG)": "Potential next year (KG)",
    "Người liên quan đến dự án": "People related to project",
    "Cập nhật tình hình": "Status update", "Huỷ": "Cancel", "Lưu dự án": "Save project",
    // chi tiết
    "Thông tin & tiến độ": "Info & progress", "Sản phẩm": "Product", "Ứng dụng": "Application",
    "Giai đoạn": "Stage", "KG năm nay": "KG this year", "KG năm sau": "KG next year",
    "Hoạt động khách hàng liên quan": "Related customer activities",
    "Người tham gia": "Participants", "Trao đổi trong dự án": "Project discussion",
    "Đóng dự án": "Close project", "Đóng": "Close",
    "Lưu thay đổi & thông báo": "Save changes & notify",
    "WON — chốt được đơn": "WON — deal closed", "LOST — dừng theo đuổi": "LOST — stop pursuing",
    "Lý do / ghi chú": "Reason / notes", "Xác nhận đóng & thông báo": "Confirm close & notify",
    // hoạt động
    "Ghi hoạt động khách hàng": "Log customer activity", "Loại hoạt động": "Activity type",
    "Khác": "Other", "Ngày": "Date", "Mức độ tiềm năng": "Potential level",
    "Nội dung trao đổi": "Discussion content", "Bước tiếp theo": "Next step",
    "Gắn vào dự án đang chạy": "Attach to active project", "Lưu hoạt động": "Save activity",
    "Lưu": "Save", "trong folder dự án.": "in the project folder.",
    "Báo cáo tuần cho manager": "Weekly report for manager",
    "Tổng hợp theo % tiến độ": "Summary by progress %",
    // nhãn động
    "(chưa có người liên quan)": "(no related people)", "(không có nội dung)": "(no content)",
    "KHÁCH HÀNG": "CUSTOMER", "SẢN PHẨM": "PRODUCT",
    "Chưa có hoạt động nào gắn vào dự án này.": "No activities linked to this project.",
    "Chưa có thông báo nào.": "No notifications.",
    "Cần internet để tải biểu đồ (Chart.js CDN).": "Internet required to load charts (Chart.js CDN).",
    "Không có dự án sắp đến hạn.": "No projects closing soon.",
    "Không tìm thấy kết quả": "No results found",
    "+ Ghi hoạt động cho dự án này": "+ Log activity for this project",
    "+ Thêm người liên quan…": "+ Add related person…",
    "+ Thêm người tham gia…": "+ Add participant…", "+ Tạo dự án": "+ Create project",
    "Chưa có hoạt động nào": "No activities yet", "Không có dự án nào": "No projects",
    "— Chưa gắn dự án nào —": "— No project attached —",
    "↑ Nâng lên Manager": "↑ Promote to Manager", "↓ Hạ xuống Sales": "↓ Demote to Sales",
    "Chưa có trao đổi nào.": "No discussion yet.",
    "Chế độ cục bộ — chưa cấu hình gateway": "Local mode — gateway not configured",
    "Chọn kết quả Thắng hoặc Thua.": "Choose Won or Lost result.",
    "Gemini qua Cloudflare — đã kết nối": "Gemini via Cloudflare — connected",
    "Chế độ cục bộ — chưa cấu hình gateway": "Local mode — gateway not configured",
    "Ghi hoạt động cho dự án": "Log activity for project",
    "Nhập tên khách hàng.": "Enter customer name.",
    "Quá hạn": "Overdue", "Quá hạn — cần xử lý": "Overdue — needs action",
    "Quý sau (Q4/2026)": "Next quarter (Q4/2026)", "Thu gọn / mở rộng": "Collapse / expand",
    "Tổng dự án": "Total projects", "Tỷ lệ thắng": "Win rate",
    "Vui lòng nhập lý do đóng dự án.": "Please enter the reason for closing.",
    "Chưa có URL → chatbot chạy chế độ phân tích cục bộ trên dữ liệu pipeline. Deploy Worker theo file":
      "No URL → chatbot runs local analysis mode on pipeline data. Deploy the Worker per the file",
    "Xin chào": "Hello", "Còn lại trong 2026": "Remaining in 2026",
    "2027 trở đi": "2027 onward", "KG tiềm năng 2026": "Potential KG 2026",
    "cần xử lý": "needs action", "ngày đóng đã qua": "closing date passed",
    "click segment để xem lịch sử dự án": "click a segment to see project history",
    "Không có dự án đang chạy nào ở đúng tiến độ": "No in-progress projects on track",
    "Nhập lý do": "Enter reason", "Không có kết quả": "No results",
    // từ vựng cố định (trạng thái / nhóm chuẩn)
    "Đang chạy": "In Progress", "Thắng": "Won", "Thua": "Lost",
    "Tiếp cận": "Approach", "Thử mẫu": "Sampling", "Đàm phán": "Negotiation", "Hoãn": "On hold",
    "ĐANG CHẠY": "IN PROGRESS", "THẮNG": "WON", "THUA": "LOST",
  };

  // ---- luật regex cho chuỗi có nội suy số (áp khi không khớp nguyên câu) ----
  const RULES = [
    [/dự án mới/g, "new projects"], [/dự án khác/g, "more projects"],
    [/(\d+)\s*dự án/g, "$1 projects"], [/dự án/g, "project"],
    [/Tháng /g, "Month "], [/% thắng/g, "% win"], [/% dự án/g, "project %"],
    [/nhóm ngành/g, "segment groups"], [/tiềm năng/g, "potential"],
    [/đóng/g, "closed"], [/thắng/g, "win"],
  ];

  function translateStr(s) {
    if (DICT[s] !== undefined) return DICT[s];
    let out = s, changed = false;
    for (const [re, rep] of RULES) { const n = out.replace(re, rep); if (n !== out) { out = n; changed = true; } }
    return changed ? out : s;
  }

  const EXCLUDE = '#aiMsgs, [data-noi18n], script, style';
  let observer = null, busy = false;

  function translateTree(root) {
    if (LANG !== 'en') return;
    busy = true;
    // text nodes
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const p = node.parentElement;
      if (!p || p.closest(EXCLUDE)) continue;
      const raw = node.nodeValue, t = raw.trim();
      if (!t) continue;
      const en = translateStr(t);
      if (en !== t) {
        if (node.__vi === undefined) node.__vi = raw;
        node.nodeValue = raw.replace(t, en);
      }
    }
    // placeholder / title attributes
    root.querySelectorAll && root.querySelectorAll('[placeholder],[title]').forEach(el => {
      if (el.closest(EXCLUDE)) return;
      ['placeholder', 'title'].forEach(attr => {
        const v = el.getAttribute(attr); if (!v) return;
        const en = translateStr(v.trim());
        if (en !== v.trim()) { if (el['__vi_' + attr] === undefined) el['__vi_' + attr] = v; el.setAttribute(attr, en); }
      });
    });
    busy = false;
  }

  function restoreVI() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    for (const node of nodes) if (node.__vi !== undefined) { node.nodeValue = node.__vi; node.__vi = undefined; }
    document.querySelectorAll('[placeholder],[title]').forEach(el => {
      ['placeholder', 'title'].forEach(attr => {
        if (el['__vi_' + attr] !== undefined) { el.setAttribute(attr, el['__vi_' + attr]); el['__vi_' + attr] = undefined; }
      });
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(muts => {
      if (LANG !== 'en' || busy) return;
      observer.disconnect();
      for (const m of muts) m.addedNodes.forEach(nd => {
        if (nd.nodeType === 1) translateTree(nd);
        else if (nd.nodeType === 3 && nd.parentElement && !nd.parentElement.closest(EXCLUDE)) {
          const t = nd.nodeValue.trim(), en = t && translateStr(t);
          if (en && en !== t) { if (nd.__vi === undefined) nd.__vi = nd.nodeValue; nd.nodeValue = nd.nodeValue.replace(t, en); }
        }
      });
      connect();
    });
    connect();
  }
  function connect() { if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: false }); }

  function setLang(l) {
    LANG = l; try { localStorage.setItem('fisg_lang', l); } catch (e) {}
    document.documentElement.lang = (l === 'en' ? 'en' : 'vi');
    if (l === 'en') { translateTree(document.body); startObserver(); }
    else { if (observer) { observer.disconnect(); observer = null; } restoreVI(); }
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = (l === 'en' ? 'EN' : 'VN');
  }
  window.setLang = setLang;
  window.t = translateStr;   // tiện dùng trong view sau này nếu cần

  function injectToggle() {
    const header = document.querySelector('.gheader') || document.body;
    if (document.getElementById('langToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'langToggle'; btn.type = 'button';
    btn.title = 'Chuyển ngôn ngữ / Switch language';
    btn.style.cssText = 'margin-left:10px;padding:5px 10px;border:1px solid var(--line,#E4E6EC);border-radius:8px;background:var(--surface,#fff);font-weight:700;cursor:pointer;font-size:12px;color:var(--ink,#16181D)';
    btn.textContent = (LANG === 'en' ? 'EN' : 'VN');
    btn.onclick = () => setLang(LANG === 'en' ? 'vi' : 'en');
    header.appendChild(btn);
  }

  function boot() {
    injectToggle();
    if (LANG === 'en') { translateTree(document.body); startObserver(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
