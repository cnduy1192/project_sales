/* js/i18n.js — Song ngữ EN/VI ở tầng hiển thị (classic script, scope toàn cục).
 * VI là ngôn ngữ nguồn trong code; EN là ngôn ngữ hiển thị mặc định — mỗi lần tải
 * trang đều bắt đầu ở EN, người dùng có thể gạt sang VI trong phiên làm việc.
 * Loại trừ #aiMsgs (báo cáo tuần & output chatbot là NỘI DUNG, giữ tiếng Việt).
 */
(function () {
  /* EN is the primary display language: no stored preference is read at boot. */
  let LANG = 'en';
  try { localStorage.removeItem('fisg_lang'); } catch (e) {}

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
    "Sản phẩm": "Product", "Ứng dụng của khách hàng": "Customer application",
    "Nhà cung cấp": "Supplier", "Nhóm ngành": "Segment group",
    "Giai đoạn (BOP Stage)": "Stage (BOP Stage)", "Tiến độ dự án": "Project progress",
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
    // chia sẻ cho khách
    "Chia sẻ": "Share", "Chia sẻ dự án cho khách": "Share projects with a guest",
    "Khách xem chia sẻ": "Guest access", "Nhập mã chia sẻ": "Enter share code",
    "Mã do nhân viên FI SAIGON cung cấp.": "Ask your FI SAIGON contact for the code.",
    "Xem dự án": "View projects", "Thoát": "Exit",
    "Chế độ khách · chỉ xem": "Guest mode · view only",
    "Đã tạo mã chia sẻ": "Share code created", "Sao chép mã": "Copy code",
    "Đã sao chép": "Copied", "Tạo mã chia sẻ": "Create share code",
    "Tạo mã khác": "Generate another", "KEY ID cho khách": "Guest KEY ID",
    "Phạm vi": "Scope", "Nhà cung cấp": "Supplier", "Hết hạn": "Expires",
    "Chia sẻ cho (ghi chú)": "Shared with (note)", "Chọn dự án": "Select projects",
    "Chọn tất cả": "Select all", "Bỏ chọn": "Clear selection",
    "Mã chia sẻ cho khách": "Guest share codes", "Thu hồi": "Revoke",
    "Đã thu hồi": "Revoked", "Đang hiệu lực": "Active",
    "Toàn bộ dự án của 1 nhà cung cấp": "All projects of one supplier",
    "Chọn từng dự án": "Pick individual projects",
    "Toàn bộ dự án của tất cả nhà cung cấp": "All projects of all suppliers",
    "Mã không đúng.": "Invalid code.", "Mã này đã bị thu hồi.": "This code has been revoked.",
    "Chế độ khách: chỉ xem, không chỉnh sửa.": "Guest mode: view only, no editing.",
    // nhãn của ui-kit (menu hồ sơ, nút xoá tìm kiếm, lên đầu trang)
    "Đăng xuất": "Sign out", "Tài khoản": "Account", "Lên đầu trang": "Back to top",
    "Xoá nội dung tìm": "Clear search", "Lọc nhanh funnel": "Quick filter",
    "Tìm khách hàng, sản phẩm, phân khúc, sales, giai đoạn":
      "Search customer, product, segment, sales, stage",
    "Xin chào": "Hello", "Còn lại trong 2026": "Remaining in 2026",
    "2027 trở đi": "2027 onward", "KG tiềm năng 2026": "Potential KG 2026",
    "cần xử lý": "needs action", "ngày đóng đã qua": "closing date passed",
    "click segment để xem lịch sử dự án": "click a segment to see project history",
    "Không có dự án đang chạy nào ở đúng tiến độ": "No in-progress projects on track",
    "Nhập lý do": "Enter reason", "Không có kết quả": "No results",
    // từ vựng cố định (trạng thái / nhóm chuẩn)
    // donut phân khúc / timeline dạng cây / sidebar
    "Tỷ trọng phân khúc": "Segment share",
    "click một lát để xem lịch sử dự án": "click a slice to see project history",
    "click một lát để mở segment bên trong": "click a slice to open the segments inside",
    "NHÓM NGÀNH": "SEGMENT GROUP", "Chưa có ngày đóng": "No closing date",
    "Xoá tra cứu": "Clear lookup",
    "Viết trao đổi… (Enter để gửi)": "Write a message… (Enter to send)",
    "Gửi": "Send",
    "Thu gọn thanh điều hướng": "Collapse navigation",
    "Mở rộng thanh điều hướng": "Expand navigation",
    "Ngôn ngữ hiển thị": "Display language",
    "Chưa có dữ liệu theo bộ lọc này.": "No data for this filter.",
    "Chưa có dự án được tạo theo bộ lọc này.": "No projects created under this filter.",
    "Không thể hiển thị biểu đồ. Vui lòng thử lại.": "Chart unavailable. Please try again.",
    "Không có dự án nào (trong phạm vi quyền xem của bạn).": "No projects within your access scope.",
    "Đang chạy": "In Progress", "Thắng": "Won", "Thua": "Lost",
    "Đã đóng": "Closed", "ĐÃ ĐÓNG": "CLOSED", "Đóng": "Closed",
    "thắng · thua": "won · lost", "theo mốc thời gian": "by due date",
    "Tiếp cận": "Approach", "Thử mẫu": "Sampling", "Đàm phán": "Negotiation", "Hoãn": "On hold",
    "ĐANG CHẠY": "IN PROGRESS", "THẮNG": "WON", "THUA": "LOST",
  };

  // ---- luật regex cho chuỗi có nội suy số (áp khi không khớp nguyên câu) ----
  const RULES = [
    [/(\d+)\s*tin nhắn/g, "$1 messages"],
    [/(\d+)\s*đang chạy/g, "$1 in progress"], [/(\d+)\s*thắng/g, "$1 won"], [/(\d+)\s*thua/g, "$1 lost"],
    [/dự án mới/g, "new projects"], [/dự án khác/g, "more projects"],
    [/(\d+)\s*dự án/g, "$1 projects"], [/dự án/g, "project"],
    [/Tháng /g, "Month "], [/% thắng/g, "% win"], [/Tiến độ dự án/g, "project progress"],
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
    root.querySelectorAll && root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
      if (el.closest(EXCLUDE)) return;
      ['placeholder', 'title', 'aria-label'].forEach(attr => {
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
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
      ['placeholder', 'title', 'aria-label'].forEach(attr => {
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
    LANG = (l === 'vi' ? 'vi' : 'en');
    document.documentElement.lang = LANG;
    if (LANG === 'en') { translateTree(document.body); startObserver(); }
    else { if (observer) { observer.disconnect(); observer = null; } restoreVI(); }
    syncSwitch();
  }
  window.setLang = setLang;
  window.t = translateStr;   // tiện dùng trong view sau này nếu cần

  function syncSwitch() {
    const sw = document.getElementById('langSwitch');
    if (!sw) return;
    sw.classList.toggle('is-vi', LANG === 'vi');
    sw.querySelectorAll('.ls-opt').forEach(b => {
      const on = b.dataset.l === LANG;
      b.setAttribute('aria-pressed', String(on));
      b.tabIndex = on ? -1 : 0;
    });
  }

  /* Segmented switch: both languages stay visible, the thumb marks the active one. */
  function injectToggle() {
    const header = document.querySelector('.gheader') || document.body;
    if (document.getElementById('langSwitch')) return;
    const sw = document.createElement('div');
    sw.id = 'langSwitch'; sw.className = 'lang-switch';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'Ngôn ngữ hiển thị');
    sw.innerHTML =
      '<svg class="ls-globe" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/></svg>' +
      '<span class="ls-thumb" aria-hidden="true"></span>' +
      '<button class="ls-opt" type="button" data-l="en">EN</button>' +
      '<button class="ls-opt" type="button" data-l="vi">VI</button>';
    sw.querySelectorAll('.ls-opt').forEach(b => {
      b.addEventListener('click', () => setLang(b.dataset.l));
    });
    const bell = header.querySelector('.icon-btn');
    const anchor = bell && bell.parentElement && bell.parentElement.parentElement === header ? bell.parentElement : null;
    if (anchor) header.insertBefore(sw, anchor); else header.appendChild(sw);
    syncSwitch();
  }

  function boot() {
    document.documentElement.lang = LANG;
    injectToggle();
    if (LANG === 'en') { translateTree(document.body); startObserver(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
