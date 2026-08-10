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
    /* Bảng chào tuần: "Hoàn thành" là NÚT (hành động), "Đã làm" là NHÃN
       (trạng thái) — dịch khác nhau cho khỏi lẫn. */
    "Hoàn thành": "Mark done", "Hoàn tác": "Undo", "Đã làm": "Done",
    "Đã làm trong tuần": "Done this week",
    "Đang làm hôm nay": "Doing today",
    "Chưa đánh dấu — đã qua ngày": "Not marked — date passed",
    "Đã lên kế hoạch — còn lại trong tuần": "Planned — rest of week",
    "Cập nhật hoạt động": "Update activities",
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
    // hoạt động / kế hoạch làm việc
    "Kế hoạch làm việc": "Work plan", "Tạo hoạt động": "Create activity",
    "Nhập hoặc chọn khách hàng…": "Type or pick a customer…",
    "Ghi kế hoạch tuần": "Log in weekly plan", "Ghi hoạt động khách hàng": "Log customer activity",
    "Ghi hoạt động": "Log activity", "Loại hoạt động": "Activity type",
    "Khác": "Other", "Ngày": "Date",
    "Mức độ quan tâm": "Interest level", "Mức độ tiềm năng": "Potential level",
    "Mục tiêu": "Purpose / Objective", "Nội dung trao đổi": "Discussion content",
    "Hành động": "Action", "Bước tiếp theo": "Next step",
    "Gắn vào dự án đang chạy": "Attach to active project",
    "Lưu kế hoạch": "Save plan", "Lưu hoạt động": "Save activity",
    "Chi tiết hoạt động": "Activity details", "Lưu thay đổi": "Save changes",
    "Xoá hoạt động": "Delete activity",
    "Chọn hoặc nhập mới…": "Pick or type a new one…",
    "Hôm nay": "Today", "Mở lịch chọn ngày": "Open date picker",
    "Tháng trước": "Previous month", "Tháng sau": "Next month",
    "Bạn đang quản lý khách hàng này.": "You manage this customer.",
    "Khách hàng đang được quản lý bởi": "Managed by",
    "Khách hàng chưa có người tiếp quản.": "No sales owns this customer yet.",
    "Bạn vẫn có thể ghi tương tác.": "You can still log interactions.",
    "Lưu": "Save", "trong folder dự án.": "in the project folder.",
    "Báo cáo tuần cho manager": "Weekly report for manager",
    "Tất cả báo cáo": "All reports", "Gửi cho quản lý": "Send to manager",
    "Bỏ bản nháp": "Discard draft", "Soạn báo cáo tuần": "Compose weekly report",
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
    "Tạo dự án": "Create project",
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

    /* ---- Bổ sung sau đợt dò bằng tests/i18n-scan.js ----
       DICT được kiểm TRƯỚC RULES, nên mọi câu dưới đây vừa để dịch, vừa để chặn
       RULES cắt lẻ giữa câu ("Dự án đã đóng" từng ra "Dự án đã closed"). */
    // Tổng quan
    "Tổng quan": "Overview", "Điều hành": "Management",
    "Hoạt động trong kỳ": "Activities this period",
    "Dự án đã đóng": "Closed projects", "Dự án quá hạn": "Overdue projects",
    "Khách hàng chưa tương tác": "Customers with no contact",
    "Cuộc gọi, ghé thăm, email và cập nhật tiến độ trong kỳ đang xem":
      "Calls, visits, emails and progress updates in the selected period",
    "Đang chạy nhưng đã qua ngày đóng dự kiến · tính đến hôm nay":
      "In progress but past the expected closing date · as of today",
    "Có dự án đang chạy, hơn 30 ngày không ai chạm · tính đến hôm nay":
      "Has an in-progress project, untouched for over 30 days · as of today",
    "Tín hiệu cần chú ý": "Signals to watch", "Kỳ đang xem:": "Period:",
    "Dòng thời gian": "Timeline", "Sắp tới": "Upcoming",
    "Hoạt động sales đã lên lịch, chưa diễn ra": "Scheduled sales activities, not yet done",
    "Chưa có việc nào được lên lịch": "Nothing scheduled yet",
    "Kỳ này chưa có hoạt động nào": "No activity in this period",
    "Chọn cửa sổ thời gian": "Select time window",
    "Lọc theo loại sự kiện": "Filter by event type", "Lọc theo sales": "Filter by sales",
    "Tất cả loại": "All types", "Tất cả sales": "All sales",
    "Hoạt động gần nhất": "Last activity", "Hoạt động gần nhất ↓": "Last activity ↓",
    "Hoạt động gần nhất nằm ở tương lai — đã đặt lịch": "Last activity is in the future — scheduled",
    "Vừa chạm hôm nay": "Contacted today", "Chưa ghi nhận hoạt động nào": "No activity recorded",
    "Chưa có": "None yet", "Hôm nay": "Today", "Hôm qua": "Yesterday",
    "Ngày mai": "Tomorrow", "Ngày kia": "Day after tomorrow",
    "Xem dự án và hoạt động của mọi nhà cung cấp": "See projects and activities from every supplier",
    "Sản phẩm đang chào": "Products offered", "Xem toàn bộ lịch sử": "See full history",
    // Kế hoạch tuần
    "Kế hoạch tuần": "Weekly plan", "Đầu tuần": "Start of week", "Giữa tuần": "Mid-week",
    "Cuối tuần": "End of week", "Bám việc đã lên lịch": "Stay on scheduled work",
    "Lên kế hoạch cho tuần": "Plan the week", "Chốt lại tuần": "Wrap up the week",
    "Cập nhật hoạt động": "Update activities", "Đang làm hôm nay": "Doing today",
    "Chưa đánh dấu — đã qua ngày": "Not marked — date passed",
    "Đã lên kế hoạch — còn lại trong tuần": "Planned — rest of week",
    "Đã làm trong tuần": "Done this week", "Hoạt động đã làm": "Activities done",
    "Thay đổi dự án": "Project changes", "Ghi hoạt động mới": "Log a new activity",
    "Không có việc nào bị bỏ quên.": "Nothing has been forgotten.",
    "Hôm nay chưa có việc nào trên lịch.": "Nothing on the calendar for today.",
    "Chưa đặt lịch việc nào cho những ngày còn lại.": "Nothing scheduled for the remaining days.",
    "Chưa có việc nào được đánh dấu hoàn thành.": "Nothing marked complete yet.",
    "Chưa có hoạt động nào được đánh dấu hoàn thành trong tuần.":
      "No activity marked complete this week.",
    "Tuần này chưa ghi nhận hoạt động nào": "No activity recorded this week",
    "bấm \"Hoàn thành\" để báo cáo cuối tuần tính đúng":
      "click \"Mark done\" so the weekly report adds up",
    "Bấm \"Hoàn thành\" khi xong việc để báo cáo cuối tuần tính đúng.":
      "Click \"Mark done\" when finished so the weekly report adds up.",
    "Để sau": "Later", "Vào Sales Funnel": "Go to Sales Funnel", "Mở Sales Funnel": "Open Sales Funnel",
    "Gửi cho quản lý": "Send to manager", "Đóng màn hình tổng quan tuần": "Close the weekly overview",
    "Bảy ngày trong tuần": "Seven days of the week", "Tuần": "Week",
    "Kế hoạch": "Planned", "Chưa đánh dấu": "Not marked",
    "Đang xem thử chế độ giữa tuần. Bấm để xem chế độ tiếp theo.":
      "Previewing mid-week mode. Click to see the next mode.",
    "xem thử": "preview", "Việc đáng làm nhất": "Most worth doing",
    // Báo cáo
    "Báo cáo": "Reports", "Soạn báo cáo tuần": "Write weekly report",
    "Chưa có báo cáo nào": "No reports yet",
    "Báo cáo do sales gửi sẽ hiện ở đây.": "Reports sent by sales will appear here.",
    "Soạn báo cáo tuần để gửi cho quản lý.": "Write a weekly report to send to your manager.",
    "Chọn một báo cáo để đọc": "Pick a report to read",
    "Bấm một dòng bên trái để xem chi tiết tuần làm việc của sales.":
      "Click a row on the left to see that sales rep's week in detail.",
    "Báo cáo là ảnh chụp số liệu tại thời điểm gửi.": "A report is a snapshot taken when it was sent.",
    "Nhận xét của bạn": "Your comments",
    "Nhận xét gửi kèm số liệu ở trên. Số liệu được chốt tại thời điểm gửi.":
      "Your comments go with the figures above. Figures are fixed at send time.",
    "Bản nháp · số liệu chốt khi bấm gửi": "Draft · figures fixed on send",
    "Bỏ bản nháp": "Discard draft", "chưa gửi": "not sent",
    "Không có dự án nào đổi trạng thái tuần này": "No project changed status this week",
    // Quản trị người dùng
    "Thêm người dùng": "Add user", "Tên đầy đủ (O365)": "Full name (O365)",
    "Tên PIC như trong dữ liệu": "PIC name as written in the data",
    "Chỉ điền khi cột PIC trong list Projects ghi tên tắt.":
      "Fill in only when the PIC column in Projects holds a short name.",
    "Một người có nhiều tên thì ngăn bằng dấu phẩy":
      "Separate multiple names for one person with commas",
    "đều sẽ hiện thành tên đầy đủ ở mọi màn hình.": "will all display as the full name everywhere.",
    "Tên này sẽ hiện khắp phần mềm.": "This name appears throughout the app.",
    "Lưu lên SharePoint": "Save to SharePoint", "Chưa đọc được list": "Could not read list",
    "Sửa": "Edit", "Cập nhật": "Update", "Sales phụ trách": "Sales owner",
    "Tra O365": "Look up in O365",
    // Chung
    "Thêm nhà cung cấp": "Add supplier", "Mở dự án": "Open project",
    "Quay lại Sales Funnel": "Back to Sales Funnel",
    "Quay lại Hoạt động khách hàng": "Back to Customer Activities",
    "Quay lại Kế hoạch tuần": "Back to Weekly plan", "Quay lại Tổng quan": "Back to Overview",
    "Ghi hoạt động khách hàng": "Log a customer activity",
    "Hoạt động": "Activity", "Dự án mới": "New project", "Đóng dự án": "Close project",
    "Sản phẩm": "Product", "Ứng dụng": "Application", "Giai đoạn": "Stage",
    "Khách hàng": "Customer", "KHÁCH HÀNG": "CUSTOMER", "Tiềm năng": "Potential",
    "Tiềm năng:": "Potential:", "Tiếp theo:": "Next:", "Đang chạy:": "In progress:",
    "Thắng:": "Won:", "Tổng:": "Total:", "KG/năm": "KG/year", "KG tiềm năng": "Potential KG",
    "Trạng thái project": "Project status", "Thắng / đã đóng": "Won / closed",
    "Segment & ứng dụng": "Segment & application", "Sản lượng theo mặt hàng": "Volume by product",
    "Dự án đang chạy theo giai đoạn": "In-progress projects by stage",
    "Hoạt động theo loại": "Activities by type", "Tỷ trọng Segment": "Segment share",
    "toàn bộ pipeline": "whole pipeline", "di chuột để xem chi tiết": "hover for details",
    "Không có mục nào.": "Nothing here.", "Đang tải…": "Loading…", "Đang chuẩn bị…": "Preparing…",
    "Chưa có mã chia sẻ nào.": "No share codes yet.",
    "Mã 6 chữ số, hoặc tự đặt 4–12 ký tự (chữ và số).":
      "A 6-digit code, or set your own 4–12 characters (letters and digits).",
    "Xoá nội dung tìm": "Clear search box", "Chọn năm": "Select year",
    "Thứ Hai": "Monday", "Thứ Ba": "Tuesday", "Thứ Tư": "Wednesday", "Thứ Năm": "Thursday",
    "Thứ Sáu": "Friday", "Thứ Bảy": "Saturday", "Chủ Nhật": "Sunday",
    "— ví dụ": "— example", "bạn": "you", "Khác": "Other",
    "Sản phẩm đang chào": "Products offered",
    "Xem toàn bộ lịch sử dự án": "See the full project history",
    // Màn hình Khách hàng của tôi
    "Khách hàng của tôi": "My Customers", "Phụ trách": "Owner",
    "Nhà cung cấp": "Supplier", "Dự án": "Projects",
    "Tìm khách hàng": "Search customers", "chưa có dự án": "no project yet",
    "Chưa có hoạt động": "No activity yet", "đang chạy": "in progress",
    "Kế hoạch chưa đánh dấu": "Planned, not marked",
    // Báo cáo: luồng trao đổi
    "Trao đổi": "Discussion", "Gửi phản hồi": "Send reply",
    "Chưa có phản hồi nào.": "No replies yet.", "Quản lý": "Manager",
    "Trả lời quản lý…": "Reply to manager…", "Nhập nội dung phản hồi.": "Enter a reply.",
    "Thêm khách hàng": "Add customer", "Xem & sửa thông tin khách hàng": "View & edit customer",
    "Tên hiển thị": "Display name", "Tên pháp nhân": "Legal name",
    "Người phụ trách": "Owner", "Trạng thái": "Status",
    "Tạo khách hàng": "Create customer", "Lưu thay đổi": "Save changes",
    "Dự án của khách hàng": "Customer projects", "Hoạt động gần đây": "Recent activity",
    "Chưa có dự án nào.": "No projects yet.", "Chưa có hoạt động nào.": "No activity yet.",
    "Bạn chỉ xem được khách hàng này. Chỉ người phụ trách hoặc quản trị mới sửa được.":
      "You can only view this customer. Only the owner or an admin can edit.",
    // Tệp đính kèm
    "Tệp đính kèm": "Attachments", "Chưa có tệp đính kèm.": "No attachments yet.",
    "+ Đính kèm tệp": "+ Attach file", "Xoá tệp": "Delete file",
    "Tối đa 15MB · pdf, word, excel, ppt, ảnh, zip": "Up to 15MB · pdf, word, excel, ppt, images, zip",
    "Đăng nhập Microsoft 365 để đính kèm tệp.": "Sign in with Microsoft 365 to attach files.",
    "Đã xoá tệp.": "File deleted.",
    "Nhập nhà cung cấp từ Excel": "Import suppliers from Excel",
    "File một cột tên NCC. App tự đối chiếu list Suppliers: tên mới thì tạo, tên đã có thì bỏ qua. Chạy lại vẫn an toàn.":
      "A one-column file of supplier names. The app matches against the Suppliers list: new names are created, existing ones skipped. Safe to re-run.",
    "Cột nhận diện: Title / Supplier / Nhà cung cấp (hoặc cột đầu tiên).":
      "Recognised column: Title / Supplier (or the first column).",
    "Nhập / cập nhật khách hàng từ Excel": "Import / update customers from Excel",
    "Chọn file Excel…": "Choose an Excel file…",
    "Xem trước": "Preview", "Cập nhật lên SharePoint": "Update to SharePoint",
    "File gồm cả khách cũ lẫn mới. App tự đối chiếu: khách đã có thì cập nhật Người phụ trách + Tên pháp nhân, khách mới thì tạo. Chạy lại vẫn an toàn.":
      "The file may contain both existing and new customers. The app matches automatically: existing customers get their Owner + LegalName updated, new ones created. Safe to re-run.",
    "Cột nhận diện: Title · Owner (Người phụ trách) · LegalName (Tên pháp nhân) · Segment · Region · CustomerStatus. Sheet phụ (Cần rà, Còn trống) tự bỏ qua.":
      "Recognised columns: Title · Owner · LegalName · Segment · Region · CustomerStatus. Helper sheets are skipped.",
    "Danh bạ khách hàng đang trống": "The customer directory is empty",
    "Không có khách hàng khớp bộ lọc": "No customers match the filter",
    "Thử bỏ bớt bộ lọc hoặc ô tìm kiếm.": "Try removing a filter or the search box.",
    "Xem lịch sử khách hàng": "View customer history",
    "+ Dự án": "+ Project", "Ghi hoạt động": "Log activity",
    "Trạng thái dự án": "Project status",
    "Đang xem thử chế độ giữa tuần. Bấm để xem chế độ tiếp theo.":
      "Previewing mid-week mode. Click for the next mode.",
    "Chưa có list Users trên SharePoint — thay đổi ở đây sẽ mất khi tải lại trang. Tạo list rồi đăng nhập lại để lưu được.":
      "No Users list on SharePoint — changes here are lost on reload. Create the list and sign in again to save.",
    /* Câu trên bị <b> cắt làm đôi nên text node chỉ còn phần đuôi — liệt kê cả
       phần đuôi, vì bộ dịch làm việc trên từng text node chứ không trên câu. */
    "trên SharePoint — thay đổi ở đây sẽ mất khi tải lại trang. Tạo list rồi đăng nhập lại để lưu được.":
      "on SharePoint — changes here are lost on reload. Create the list and sign in again to save.",
    "Đang chạy": "In Progress", "Thắng": "Won", "Thua": "Lost",
    "Đã đóng": "Closed", "ĐÃ ĐÓNG": "CLOSED",
    "thắng · thua": "won · lost", "theo mốc thời gian": "by due date",
    "Tiếp cận": "Approach", "Thử mẫu": "Sampling", "Đàm phán": "Negotiation", "Hoãn": "On hold",
    "ĐANG CHẠY": "IN PROGRESS", "THẮNG": "WON", "THUA": "LOST",
  };

  // ---- luật regex cho chuỗi có nội suy số (áp khi không khớp nguyên câu) ----
  /* Luật regex cho chuỗi có nội suy (số, ngày, tên người) — CHỈ áp khi không
     khớp nguyên câu trong DICT.

     Thứ tự quan trọng: mẫu DÀI đứng trước mẫu ngắn. Trước đây [/đóng/g] và
     [/dự án/g] nằm gần cuối nhưng vẫn cắt giữa những câu chưa có trong DICT, đẻ
     ra "Dự án đã closed" và "Tổng 1 projects". Cách chữa gốc là thêm câu vào
     DICT; các luật dưới đây chỉ dành cho chuỗi KHÔNG THỂ liệt kê hết. */
  const RULES = [
    // câu có ngày tháng
    [/Thứ Hai, ngày /g, "Monday, "], [/Thứ Ba, ngày /g, "Tuesday, "],
    [/Thứ Tư, ngày /g, "Wednesday, "], [/Thứ Năm, ngày /g, "Thursday, "],
    [/Thứ Sáu, ngày /g, "Friday, "], [/Thứ Bảy, ngày /g, "Saturday, "],
    [/Chủ Nhật, ngày /g, "Sunday, "],
    [/Không có việc ngày /g, "No tasks on "], [/(\d+)\s*việc ngày /g, "$1 task(s) on "],
    [/Đã lên lịch /g, "Scheduled "], [/đóng (\d)/g, "closes $1"],
    [/tuần (\d)/g, "week of $1"],
    // câu có tên người
    [/Xin chào, /g, "Hello, "], [/^Chào /, "Hi "], [/Vai trò của /g, "Role of "],
    [/Người nhận: /g, "Recipient: "], [/theo tên O365/g, "from O365 name"],
    // câu có số
    [/(\d+)\s*tin nhắn/g, "$1 messages"], [/(\d+)\s*sự kiện/g, "$1 events"],
    [/(\d+)\s*khách hàng/g, "$1 customers"], [/Chạm /g, "Touched "],
    [/(\d+)\s*phản hồi/g, "$1 replies"], [/Phản hồi cho /g, "Reply to "],
    [/(\d+)\s*việc/g, "$1 tasks"], [/(\d+)\s*ngày/g, "$1 days"],
    [/(\d+)\s*đã làm/g, "$1 done"], [/(\d+)\s*chưa đánh dấu/g, "$1 not marked"],
    [/(\d+)\s*đang chạy/g, "$1 in progress"], [/(\d+)\s*thắng/g, "$1 won"], [/(\d+)\s*thua/g, "$1 lost"],
    [/(\d+)\s*nhóm ngành/g, "$1 segment groups"],
    [/thay đổi dự án/gi, "project changes"],
    [/dự án mới/gi, "new project"], [/dự án khác/g, "more projects"],
    [/(\d+)\s*dự án/g, "$1 projects"],
    [/Tổng (\d)/g, "Total $1"], [/— tổng /g, "— total "],
    [/Gần đây · /g, "Recent · "], [/Bản nháp — /g, "Draft — "],
    [/Đang xem thử chế độ /g, "Previewing "], [/Bấm để chuyển chế độ xem thử\./g, "Click to switch preview mode."],
    [/Đóng trong quý này/g, "Closing this quarter"], [/Quý sau/g, "Next quarter"],
    [/Còn lại trong (\d{4})/g, "Rest of $1"], [/(\d{4}) trở đi/g, "$1 onward"],
    [/Quá hạn — cần xử lý/g, "Overdue — needs action"],
    [/Sản phẩm đang chào/g, "Products offered"], [/Xem toàn bộ lịch sử/g, "See full history"],
    [/· tổng /g, "· total "], [/\+ thắng/g, "+ won"],
    // chế độ của bảng chào tuần — hay nằm lẫn trong câu hướng dẫn
    [/Đầu tuần/g, "Start of week"], [/Giữa tuần/g, "Mid-week"], [/Cuối tuần/g, "End of week"],
    [/Bám việc đã lên lịch/g, "Stay on scheduled work"],
    [/Lên kế hoạch cho tuần/g, "Plan the week"], [/Chốt lại tuần/g, "Wrap up the week"],
    [/Khác/g, "Other"],
    // nhóm giai đoạn — xuất hiện lẫn trong câu tóm tắt
    [/Thử mẫu/g, "Sampling"], [/Tiếp cận/g, "Approach"],
    [/Đàm phán/g, "Negotiation"], [/Hoãn/g, "On hold"],
    // aria-label ô lịch / thẻ trạng thái (chỉ trình đọc màn hình thấy)
    [/Bấm để xem & sửa/g, "Click to view & edit"],
    [/bấm để thêm việc/g, "click to add a task"],
    [/bấm để mở/g, "click to open"], [/bấm để/g, "click to"],
    [/Đang chạy:/g, "In progress:"], [/Chưa đánh dấu:/g, "Not marked:"],
    [/Đã làm:/g, "Done:"], [/Kế hoạch:/g, "Planned:"], [/quá hạn/g, "overdue"],
    // từ lẻ, để CUỐI vì chúng cắt được giữa câu
    [/Tháng /g, "Month "], [/% thắng/g, "% win"], [/Tiến độ dự án/g, "project progress"],
    [/Dự án đang chạy/g, "In-progress projects"], [/[Dd]ự án/g, "project"],
    [/[Hh]oạt động/g, "activity"], [/nhóm ngành/g, "segment groups"],
    [/tiềm năng/g, "potential"], [/đóng/g, "closed"], [/thắng/g, "win"],
  ];

  /* Chuỗi viết trong HTML thường xuống dòng và thụt lề, nên khoá tra phải gom
     mọi khoảng trắng lại thành một dấu cách. Không có bước này thì câu nhiều
     dòng không bao giờ khớp DICT dù đã liệt kê đúng. */
  const DICT_FLAT = {};
  Object.keys(DICT).forEach(k => { DICT_FLAT[k.replace(/\s+/g, ' ').trim()] = DICT[k]; });

  function translateStr(s) {
    if (DICT[s] !== undefined) return DICT[s];
    const flat = String(s).replace(/\s+/g, ' ').trim();
    if (DICT_FLAT[flat] !== undefined) return DICT_FLAT[flat];
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
    /* placeholder / title / aria-label.

       PHẢI tính cả CHÍNH root, không chỉ con cháu. MutationObserver đưa vào đây
       đúng phần tử vừa được thêm; khi một `box.innerHTML = '<select aria-label=…>'`
       chạy thì phần tử được thêm CHÍNH LÀ cái mang aria-label, mà
       querySelectorAll không bao giờ trả về chính nó. Đó là lý do hàng loạt
       title/aria-label dựng bằng JS không bao giờ được dịch. */
    const els = [];
    if (root.nodeType === 1 && root.hasAttribute &&
        (root.hasAttribute('placeholder') || root.hasAttribute('title') || root.hasAttribute('aria-label')))
      els.push(root);
    if (root.querySelectorAll)
      root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => els.push(el));
    els.forEach(el => {
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
      /* Nhãn đặt lại bằng setAttribute trên phần tử CÓ SẴN không sinh mutation
         childList nào — nút "Quay lại …" đổi nhãn theo nơi xuất phát là ví dụ.
         Không theo dõi attributes thì những nhãn đó vĩnh viễn ở tiếng Việt. */
      for (const m of muts) if (m.type === 'attributes' && m.target) translateTree(m.target);
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
  function connect() {
    if (!observer) return;
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: false,
      attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'],
    });
  }

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
