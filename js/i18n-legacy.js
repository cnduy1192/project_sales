/* ==========================================================================
 * i18n LEGACY SAFETY NET (exact-phrase fallback) — loaded after js/i18n.js
 * --------------------------------------------------------------------------
 * The app is now key-based (data-i18n + t()). This layer only catches
 * Vietnamese UI text that is not bound to a key yet (EN mode only):
 *   - exact whole-string matches from the old phrase dictionary
 *   - never touches [data-i18n*] elements, user content ([data-noi18n]),
 *     inputs, or partial phrases (the old regex RULES were removed because
 *     they rewrote customer notes and names).
 * Set window.I18N_LEGACY_OFF = true before load to disable it.
 * Use I18N.audit() to list remaining unbound text and move it into
 * js/i18n-dict.js, then this file can be deleted.
 * ========================================================================== */
(function () {
  if (window.I18N_LEGACY_OFF) return;
  const DICT = {

    "Đăng nhập bằng tài khoản công ty": "Sign in with your company account",
    "Đăng nhập bằng Microsoft 365": "Sign in with Microsoft 365",
    "Demo — đăng nhập nhanh theo vai trò": "Demo — quick sign-in by role",
    "Làm việc": "Work", "Hoạt động khách hàng": "Customer Activities",
    "Quản trị": "Administration", "Người dùng & phân quyền": "Users & Permissions",
    "Thông báo": "Notifications", "Xuất Excel": "Export Excel",
    "Thêm dự án": "Add Project", "Phân bố giai đoạn": "Stage Distribution",
    "Bỏ lọc giai đoạn": "Clear stage filter", "Tất cả": "All",

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

    "Thêm dự án mới": "Add new project", "Khách hàng": "Customer",
    "Khách hàng:": "Customer:", "NCC:": "Supplier:", "Nhóm ngành / Segment": "Industry / Segment",
    "Giai đoạn (Stage)": "Stage", "Bổ sung dự báo & Chi tiết": "Forecast & details", "(Tùy chọn)": "(Optional)",
    "Ghi chú ban đầu": "Initial note", "Chọn segment…": "Choose segment…", "để lưu": "to save",
    "· gợi ý từ dự án trước": "· suggested from past project", "Chọn / nhập khách hàng…": "Pick / type customer…",
    "Nhập tên sản phẩm / hoạt chất...": "Product / active ingredient...", "Nhập ứng dụng...": "Application...",
    "Bối cảnh, nhu cầu của khách... (không bắt buộc)": "Context, customer needs... (optional)",
    "Sản phẩm": "Product", "Ứng dụng của khách hàng": "Customer application",
    "Nhà cung cấp": "Supplier", "Nhóm ngành": "Segment group",
    "Giai đoạn (BOP Stage)": "Stage (BOP Stage)", "Tiến độ dự án": "Project progress",
    "Loại cơ hội": "Opportunity type", "Ngày tạo": "Creation date",
    "Ngày đóng dự kiến": "Expected closing date",
    "Tiềm năng năm nay (KG)": "Potential this year (KG)",
    "Tiềm năng năm sau (KG)": "Potential next year (KG)",
    "Người liên quan đến dự án": "People related to project",
    "Cập nhật tình hình": "Status update", "Huỷ": "Cancel", "Lưu dự án": "Save project",

    "Thông tin & tiến độ": "Info & progress", "Sản phẩm": "Product", "Ứng dụng": "Application",
    "Giai đoạn": "Stage", "KG năm nay": "KG this year", "KG năm sau": "KG next year",
    "Hoạt động khách hàng liên quan": "Related customer activities",
    "Người tham gia": "Participants", "Trao đổi trong dự án": "Project discussion",
    "Đóng dự án": "Close project", "Đóng": "Close",
    "Lưu thay đổi & thông báo": "Save changes & notify",
    "WON — chốt được đơn": "WON — deal closed", "LOST — dừng theo đuổi": "LOST — stop pursuing",
    "Lý do / ghi chú": "Reason / notes", "Xác nhận đóng & thông báo": "Confirm close & notify",

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

    "Kế hoạch tuần": "Weekly plan", "Đầu tuần": "Start of week", "Giữa tuần": "Mid-week",
    "Cuối tuần": "End of week", "Bám việc đã lên lịch": "Stay on scheduled work",
    "Lên kế hoạch cho tuần": "Plan the week", "Chốt lại tuần": "Wrap up the week",
    "Cập nhật hoạt động": "Update activities", "Đang làm hôm nay": "Doing today",
    "Chưa đánh dấu — đã qua ngày": "Not marked — date passed",
    "Đã lên kế hoạch — còn lại trong tuần": "Planned — rest of week",
    "Đã làm trong tuần": "Done this week", "Hoạt động đã làm": "Activities done",
    "Thay đổi dự án": "Project changes", "Ghi hoạt động mới": "Log a new activity",
    "Phân loại hoạt động": "Activity breakdown", "Chưa hoàn thành": "Not completed",
    "Kế hoạch chưa hoàn thành": "Unfinished plans", "Nội dung báo cáo": "Report content",
    "— Chưa giao —": "— Unassigned —",
    "Sale, Khách hàng": "Sales, Customer", "Gần nhất trước": "Newest first", "Xa nhất trước": "Oldest first",
    "Tuần kế tiếp": "Next week",
    "Nội dung báo cáo tuần…": "Weekly report content…", "Tên khách hàng…": "Customer name…",
    "Cập nhật tình hình…": "Status update…", "Lý do đóng dự án…": "Reason for closing…",
    "Mục tiêu buổi làm việc…": "Meeting objective…", "Bước tiếp theo…": "Next step…",
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

    "Khách hàng của tôi": "My Customers", "Phụ trách": "Owner", "Phụ trách:": "Owner:",
    "Nhà cung cấp": "Supplier", "Dự án": "Projects",
    "Tìm khách hàng": "Search customers", "chưa có dự án": "no project yet",
    "Chưa có hoạt động": "No activity yet", "đang chạy": "in progress",
    "Kế hoạch chưa đánh dấu": "Planned, not marked",
    "Chưa ai quản lý": "Unassigned", "Khách của sales khác": "Another sales' customer",
    "Xoá khách hàng": "Delete customer", "Đang xoá…": "Deleting…",

    "Xem báo cáo đội": "View team reports",
    "Quản lý chỉ đọc báo cáo của đội, không soạn báo cáo.": "Managers only read team reports, they do not write them.",

    "Trao đổi": "Discussion", "Gửi phản hồi": "Send reply",
    "Chưa có phản hồi nào.": "No replies yet.", "Quản lý": "Manager",
    "Trả lời quản lý…": "Reply to manager…", "Nhập nội dung phản hồi.": "Enter a reply.",

    "Báo cáo cho": "Reports to", "Hỗ trợ các sales": "Supports sales",
    "Tìm sales…": "Search sales…",
    "— Tất cả quản lý —": "— All managers —",
    "Chưa có sales nào trong dữ liệu.": "No sales in the data yet.",
    "Line báo cáo: gửi báo cáo tuần tới người này. Để trống = gửi tất cả quản lý.":
      "Reporting line: weekly reports go to this person. Empty = all managers.",
    "Sale Support thấy và sửa được dữ liệu của những sales này (không xoá). Một người hỗ trợ được nhiều sales.":
      "Sale Support can view and edit these sales' data (no delete). One support can cover many sales.",
    "Hỗ trợ các sales được chỉ định: thấy và sửa dự án/hoạt động/khách của họ, nhưng KHÔNG xoá":
      "Supports assigned sales: view and edit their projects/activities/customers, but NO delete",
    "Quay lại Người dùng & phân quyền": "Back to Users & Permissions",
    "Khách hàng này do sales khác quản lý — bạn không tạo hoạt động ở đây. Hãy chọn khách của mình hoặc khách chưa ai quản lý.":
      "This customer is managed by another sales — you cannot log activity here. Pick your own customer or an unmanaged one.",
    "Thêm khách hàng": "Add customer", "Xem & sửa thông tin khách hàng": "View & edit customer",
    "Tên hiển thị": "Display name", "Tên pháp nhân": "Legal name",
    "Người phụ trách": "Owner", "Trạng thái": "Status",
    "Tạo khách hàng": "Create customer", "Lưu thay đổi": "Save changes",
    "Dự án của khách hàng": "Customer projects", "Hoạt động gần đây": "Recent activity",
    "Chưa có dự án nào.": "No projects yet.", "Chưa có hoạt động nào.": "No activity yet.",
    "Bạn chỉ xem được khách hàng này. Chỉ người phụ trách hoặc quản trị mới sửa được.":
      "You can only view this customer. Only the owner or an admin can edit.",

    "Tệp đính kèm": "Attachments", "Chưa có tệp đính kèm.": "No attachments yet.",
    "+ Đính kèm tệp": "+ Attach file", "Xoá tệp": "Delete file", "Bỏ tệp": "Remove file",
    "chờ tải khi lưu": "will upload on save",
    "Sẽ tải lên khi bạn bấm Lưu.": "Will upload when you click Save.",
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

    "trên SharePoint — thay đổi ở đây sẽ mất khi tải lại trang. Tạo list rồi đăng nhập lại để lưu được.":
      "on SharePoint — changes here are lost on reload. Create the list and sign in again to save.",
    "Đang chạy": "In Progress", "Thắng": "Won", "Thua": "Lost",
    "Đã đóng": "Closed", "ĐÃ ĐÓNG": "CLOSED",
    "thắng · thua": "won · lost", "theo mốc thời gian": "by due date",
    "Tiếp cận": "Approach", "Thử mẫu": "Sampling", "Đàm phán": "Negotiation", "Hoãn": "On hold",
    "ĐANG CHẠY": "IN PROGRESS", "THẮNG": "WON", "THUA": "LOST",
  };

  const FLAT = {};
  Object.keys(DICT).forEach(k => { FLAT[k.replace(/\s+/g, ' ').trim()] = DICT[k]; });
  function lookup(s) {
    if (DICT[s] !== undefined) return DICT[s];
    const f = String(s).replace(/\s+/g, ' ').trim();
    return FLAT[f];
  }

  const SKIP = '[data-i18n],[data-i18n-html],[data-noi18n],#aiMsgs,script,style,textarea,[contenteditable]';
  let LANG = 'vi', observer = null, busy = false;

  function translateTree(root) {
    if (LANG !== 'en' || !root) return;
    busy = true;
    if (root.nodeType === 3) root = root.parentElement || root;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      const raw = n.nodeValue, s = raw.trim();
      if (!s) continue;
      const en = lookup(s);
      if (en !== undefined && en !== s) { if (n.__vi === undefined) n.__vi = raw; n.nodeValue = raw.replace(s, en); }
    }
    const els = [];
    if (root.nodeType === 1 && root.matches('[placeholder],[title],[aria-label]')) els.push(root);
    if (root.querySelectorAll) root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => els.push(el));
    els.forEach(el => {
      if (el.closest('[data-noi18n]')) return;
      ['placeholder', 'title', 'aria-label'].forEach(a => {
        if (el.hasAttribute('data-i18n-' + a)) return;
        const v = el.getAttribute(a); if (!v) return;
        const en = lookup(v.trim());
        if (en !== undefined && en !== v.trim()) { if (el['__vi_' + a] === undefined) el['__vi_' + a] = v; el.setAttribute(a, en); }
      });
    });
    busy = false;
  }

  function restoreVI() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.__vi !== undefined) { n.nodeValue = n.__vi; n.__vi = undefined; }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
      ['placeholder', 'title', 'aria-label'].forEach(a => {
        if (el['__vi_' + a] !== undefined) { el.setAttribute(a, el['__vi_' + a]); el['__vi_' + a] = undefined; }
      });
    });
  }

  function connect() {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }
  function start() {
    if (observer) return;
    observer = new MutationObserver(muts => {
      if (LANG !== 'en' || busy) return;
      observer.disconnect();
      muts.forEach(m => {
        if (m.type === 'attributes') translateTree(m.target);
        m.addedNodes && m.addedNodes.forEach(nd => translateTree(nd.nodeType === 1 ? nd : nd.parentElement));
      });
      connect();
    });
    connect();
  }

  window.I18N_LEGACY = {
    lookup: lookup,
    sync: function (lang) {
      LANG = lang;
      if (!document.body) return;
      if (LANG === 'en') { translateTree(document.body); start(); }
      else { if (observer) { observer.disconnect(); observer = null; } restoreVI(); }
    }
  };
  if (window.I18N && document.body) window.I18N_LEGACY.sync(window.I18N.lang());
})();
