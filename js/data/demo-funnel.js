/* ============================================================
   Dữ liệu DEMO cho Sales Funnel (Salesforce view) — Phase 1
   Cho phép xem salesfunnel.html mà KHÔNG cần đăng nhập M365.
   CHỈ nạp trong salesfunnel-demo.html (bản training, window.FISG_DEMO_AUTO = true).
   salesfunnel.html (dữ liệu thật) không còn nạp file này.
   Tất cả record có spId:null → chỉnh sửa chỉ ở trình duyệt, không ghi SharePoint.
   ============================================================ */
(function () {
  "use strict";

  var USERS_DEMO = [
    { name: "Duy Chế (Demo)", pic: "Duy", email: "demo@fisaigon.vn", role: "superadmin", color: "#1E3A8A" },
    { name: "Nguyễn Anh Thu", pic: "Thu", email: "thu@fisaigon.vn", role: "sales", color: "#0E7490" },
    { name: "Trần Bích Ngọc", pic: "Ngọc", email: "ngoc@fisaigon.vn", role: "sales", color: "#B45309" },
    { name: "Lê Minh Hùng", pic: "Hùng", email: "hung@fisaigon.vn", role: "sales", color: "#6D28D9" },
    { name: "Phạm Thị Lan", pic: "Lan", email: "lan@fisaigon.vn", role: "salesupport", color: "#0E9F6E" },
    { name: "Võ R&D", pic: "Khoa", email: "khoa@fisaigon.vn", role: "rnd", color: "#DB2777" }
  ];

  // probOf theo giai đoạn (khớp catalog) để prob nhất quán
  var PROB = { "SHARED BUSINESS GOAL": 10, "BUILDING A SOLUTION": 25, "SOLUTION TESTING": 50, "OFFER & AGREEMENT": 75,
    "LEAD": 10, "SAMPLE SENT": 25, "TESTING": 40, "TEST PASSED": 60, "QUOTED / PO": 80, "POSTPONED": 15 };

  // [ncc, customer, product, application, group, segment, stage, status, kgThis, kgNext, pic, created, closing, related, note]
  var D = [
    ["Roquette", "Bibica", "NUTRIOSE FB06", "Bánh quy giàu chất xơ", "BAKERY", "CONFECTIONARY", "SOLUTION TESTING", "IN PROGRESS", 120000, 180000, "Thu", "2026-02-11", "2026-09-28", ["Khoa", "Lan"], "Khách chạy thử line bánh quy, phản hồi tốt về độ giòn."],
    ["Roquette", "Mondelez Kinh Đô", "KLEPTOSE Linecaps", "Kẹo không đường", "SWEET", "SWEET FOOD", "BUILDING A SOLUTION", "IN PROGRESS", 90000, 140000, "Ngọc", "2026-03-04", "2026-11-20", ["Khoa"], "Đang xây dựng công thức thay thế đường."],
    ["Roquette", "Vinamilk", "NUTRIOSE FM06", "Sữa chua uống bổ sung xơ", "SWEET", "DAIRY", "OFFER & AGREEMENT", "IN PROGRESS", 260000, 320000, "Thu", "2025-11-20", "2026-09-10", ["Khoa", "Hùng"], "Đã gửi báo giá 3 mức sản lượng, chờ khách chốt PO."],
    ["Roquette", "Nutifood", "MICROLYS", "Sữa bột trẻ em", "SWEET", "DAIRY", "SHARED BUSINESS GOAL", "IN PROGRESS", 70000, 110000, "Hùng", "2026-06-18", "2027-02-10", [], "Tiếp cận R&D, thống nhất mục tiêu dự án cho 2027."],
    ["Roquette", "TH True Milk", "LYCASIN", "Kẹo mềm bổ sung", "SWEET", "SWEET FOOD", "SOLUTION TESTING", "IN PROGRESS", 55000, 80000, "Ngọc", "2026-04-22", "2026-07-15", ["Khoa"], "Test cảm quan lần 2 — bị chậm do khách đổi nhân sự."],
    ["Roquette", "Orion Vina", "StarDri 5", "Snack phủ gia vị", "BAKERY", "SNACK", "WON", "WON", 150000, 200000, "Thu", "2025-09-10", "2026-06-30", ["Lan"], "Đã ký hợp đồng cung ứng năm 2026."],
    ["Roquette", "URC Vietnam", "NUTRIOSE FB06", "Bánh cracker", "BAKERY", "BAKERY", "BUILDING A SOLUTION", "IN PROGRESS", 65000, 95000, "Lan", "2026-05-30", "2026-12-15", ["Khoa"], "Support cho Thu — khách quan tâm giảm đường + tăng xơ."],

    ["IFF", "Acecook Vietnam", "GRINDSTED Carrageenan", "Gói súp mì ăn liền", "SAVOURY", "NOODLES", "TESTING", "IN PROGRESS", 210000, 260000, "Hùng", "2026-01-15", "2026-09-25", ["Khoa"], "Đang test độ ổn định gel trong gói súp."],
    ["IFF", "Masan Consumer", "LITESSE Ultra", "Nước tương giảm đường", "SAVOURY", "SAUCE & SEASONING", "SAMPLE SENT", "IN PROGRESS", 95000, 150000, "Ngọc", "2026-06-02", "2026-11-05", [], "Đã gửi mẫu 500g, chờ khách đánh giá."],
    ["IFF", "Vinacafé Biên Hòa", "CREMODAN SE", "Cà phê hòa tan 3in1", "SWEET", "BEVERAGE", "TEST PASSED", "IN PROGRESS", 130000, 170000, "Thu", "2025-12-08", "2026-09-18", ["Khoa", "Lan"], "Khách xác nhận đạt sau test, chuẩn bị bước báo giá."],
    ["IFF", "Tân Hiệp Phát", "POWDERPURE", "Trà thảo mộc đóng chai", "SWEET", "BEVERAGE", "LEAD", "IN PROGRESS", 40000, 70000, "Hùng", "2026-07-10", "2027-03-01", [], "Lead mới từ hội chợ Food Ingredients."],
    ["IFF", "Cholimex Foods", "GRINDSTED Pectin", "Tương ớt", "SAVOURY", "SAUCE & SEASONING", "QUOTED / PO", "IN PROGRESS", 180000, 220000, "Ngọc", "2025-10-30", "2026-08-05", ["Khoa"], "Đã chào giá, đang đàm phán điều khoản — hơi trễ hạn."],
    ["IFF", "Interfood (Wonderfarm)", "CREMODAN Ice", "Trà bí đao", "SWEET", "BEVERAGE", "TESTING", "IN PROGRESS", 60000, 90000, "Thu", "2026-05-14", "2026-10-12", [], "Test ổn định huyền phù."],
    ["IFF", "Vissan", "GRINDSTED Carrageenan", "Xúc xích tiệt trùng", "SAVOURY", "MEAT", "LOST", "LOST", 100000, 0, "Hùng", "2025-08-20", "2026-05-20", ["Khoa"], "Khách chọn nhà cung cấp khác do giá thấp hơn."],

    ["Kimica", "Dutch Lady (FrieslandCampina)", "KIMICA Algin", "Sữa tiệt trùng có hạt", "SWEET", "DAIRY", "SAMPLE SENT", "IN PROGRESS", 85000, 120000, "Lan", "2026-06-25", "2026-11-28", ["Khoa"], "Support Ngọc — gửi mẫu alginate độ nhớt cao."],
    ["Kimica", "Cầu Tre", "Sodium Alginate", "Chả giò đông lạnh", "SAVOURY", "SEAFOOD", "TESTING", "IN PROGRESS", 45000, 70000, "Ngọc", "2026-04-08", "2026-09-30", [], "Test khả năng kết dính nhân."],
    ["Kimica", "Vinasoy", "KIMICA Algin", "Sữa đậu nành", "SAVOURY", "VEGAN", "POSTPONED", "IN PROGRESS", 50000, 80000, "Hùng", "2026-02-28", "2026-12-20", [], "Khách hoãn do thay đổi kế hoạch sản phẩm 2026."],
    ["Kimica", "Bel Vietnam", "Sodium Alginate", "Phô mai chế biến", "SWEET", "DAIRY", "TEST PASSED", "IN PROGRESS", 75000, 100000, "Thu", "2025-12-15", "2026-09-15", ["Khoa"], "Đạt yêu cầu kỹ thuật, chờ duyệt ngân sách."],

    // Cùng khách hàng, nhiều project / nhiều NCC — để minh hoạ gộp dòng khách hàng
    ["IFF", "Vinamilk", "CREMODAN SE", "Kem ăn", "SWEET", "DAIRY", "SAMPLE SENT", "IN PROGRESS", 95000, 130000, "Thu", "2026-05-01", "2026-10-20", ["Khoa"], "Vinamilk quan tâm chất ổn định cho kem."],
    ["Roquette", "Acecook Vietnam", "NUTRIOSE FB06", "Mì giảm béo bổ sung xơ", "SAVOURY", "NOODLES", "SHARED BUSINESS GOAL", "IN PROGRESS", 60000, 90000, "Hùng", "2026-07-01", "2027-01-15", [], "Acecook thử hướng mì bổ sung chất xơ."]
  ];

  var RISKS = {
    "FI-0001": "Đối thủ chào CMC giá thấp hơn",
    "FI-0003": "Khách yêu cầu giảm 5% giá để chốt PO cuối năm",
    "FI-0005": "Ngân sách R&D 2027 của khách chưa duyệt",
    "FI-0008": "Thời gian test kéo dài, rủi ro trễ mùa vụ sản xuất",
    "FI-0012": "Điều khoản thanh toán 60 ngày chưa được duyệt",
    "FI-0016": "Đối thủ Danisco chào giá thấp hơn ~8%. Lead time Kimica 45 ngày — cần đặt hàng trước khi khách chốt PO.",
    "FI-0018": "Khách đang so sánh với alginate Trung Quốc giá rẻ"
  };

  function build() {
    var recs = D.map(function (a, i) {
      var stage = a[6], status = a[7];
      var prob = status === "WON" ? 1 : status === "LOST" ? 0 : (PROB[stage] || 10) / 100;
      var cmts = a[14] ? [{ by: a[10], at: a[11].split("-").reverse().join("/") + " 09:15", text: a[14] }] : [];
      if (status === "WON") cmts.push({ by: a[10], at: "30/06/2026 16:40", text: "[Đóng dự án — Thắng] Đã ký hợp đồng cung ứng." });
      if (status === "LOST") cmts.push({ by: a[10], at: "20/05/2026 11:20", text: "[Đóng dự án — Thua] Khách chọn NCC khác do giá." });
      return {
        id: "FI-" + String(i + 1).padStart(4, "0"), spId: null, ncc: a[0], customer: a[1], product: a[2], application: a[3],
        group: a[4], segment: a[5], stage: stage, status: status, boptype: "NEW BUSINESS",
        prob: prob, kgThis: a[8], kgNext: a[9], pic: a[10], rnd: "Khoa", related: a[13] || [],
        created: a[11], closing: a[12], desc: a[1] + " · " + a[2], comments: cmts,
        risk: RISKS["FI-" + String(i + 1).padStart(4, "0")] || "",
        amount: Math.round((a[8] || 0) * 25000 / 1000) * 1000   // giá trị ước tính mẫu (VND)

      };
    });

    var acts = [
      { id: "A-1", spId: null, ncc: "Roquette", customer: "Vinamilk", pic: "Thu", type: "Visit", date: "2026-08-12", note: "Thăm nhà máy, trao đổi sản lượng dự kiến Q4.", next: "Gửi báo giá 3 mức", potential: "High", related: ["Khoa"], projectId: "FI-0003" },
      { id: "A-2", spId: null, ncc: "Roquette", customer: "Bibica", pic: "Thu", type: "Call", date: "2026-08-05", note: "Gọi xác nhận kết quả test line bánh quy.", next: "Hẹn test lần 3", potential: "Medium", related: [], projectId: "FI-0001" },
      { id: "A-3", spId: null, ncc: "IFF", customer: "Acecook Vietnam", pic: "Hùng", type: "Email", date: "2026-08-01", note: "Gửi tài liệu kỹ thuật carrageenan cho gói súp.", next: "Chờ phản hồi test", potential: "High", related: ["Khoa"], projectId: "FI-0008" },
      { id: "A-4", spId: null, ncc: "IFF", customer: "Vinacafé Biên Hòa", pic: "Thu", type: "Visit", date: "2026-07-28", note: "Họp chốt kết quả test, khách xác nhận đạt.", next: "Chuẩn bị báo giá", potential: "High", related: ["Lan"], projectId: "FI-0010" },

      // FI-0016 — Cầu Tre · Sodium Alginate: nhật ký đủ dày để xem Record Page
      { id: "A-5", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Visit", date: "2026-08-19", note: "Làm việc tại nhà máy Củ Chi, gửi mẫu Sodium Alginate 500 G kèm TDS/COA cho phòng R&D. Chốt tiêu chí đánh giá: độ kết dính nhân và thất thoát sau cấp đông.", next: "Theo dõi lịch test của QA", potential: "High", related: ["Khoa"], projectId: "FI-0016" },
      { id: "A-6", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Call", date: "2026-08-28", note: "Gọi theo dõi sau khi gửi mẫu. QA xác nhận đã nhận hàng, đang xếp lịch test tuần 36.", next: "Chờ kết quả test", potential: "High", related: [], projectId: "FI-0016" },
      { id: "A-7", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Email", date: "2026-09-02", note: "Khách phản hồi kết quả test: độ kết dính nhân chả giò đạt yêu cầu, thất thoát sau cấp đông giảm rõ. Cầu Tre đề nghị gửi thêm 2 KG để chạy thử trên line 3.", next: "Gửi 2 KG mẫu chạy line 3", potential: "High", related: ["Khoa"], projectId: "FI-0016" },

      { id: "A-8", spId: null, ncc: "Kimica", customer: "Bel Vietnam", pic: "Thu", type: "Email", date: "2026-08-22", note: "Gửi hồ sơ kỹ thuật alginate cho bộ phận mua hàng, khách xác nhận đạt yêu cầu kỹ thuật.", next: "Chờ duyệt ngân sách", potential: "Medium", related: ["Khoa"], projectId: "FI-0018" },
      { id: "A-9", spId: null, ncc: "IFF", customer: "Cholimex Foods", pic: "Ngọc", type: "Call", date: "2026-08-14", note: "Đàm phán lại giá tương ớt, khách xin giữ mức giá đến hết Q4.", next: "Trình duyệt giá nội bộ", potential: "High", related: [], projectId: "FI-0012" },

      // Phase 3 — hoạt động kỹ thuật Sales & R&D, gắn cả dự án Sales lẫn đề tài R&D
      { id: "A-10", spId: null, ncc: "IFF", customer: "Acecook Vietnam", pic: "Khoa", type: "LAB_TRIAL", date: "2026-09-16", note: "Chạy mẫu gói súp tại lab khách với carrageenan 0,5% — gel ổn định sau hoàn nguyên.", next: "Gửi báo cáo cảm quan cho Hùng", potential: "High", related: ["Hùng"], projectId: "FI-0008", rdProjectId: "RD-2026-003" },
      { id: "A-11", spId: null, ncc: "Roquette", customer: "Bibica", pic: "Thu", type: "JOINT_VISIT", date: "2026-09-10", note: "Thu & Khoa làm việc với QA Bibica, chốt lịch chạy pilot line bánh quy.", next: "Chạy pilot tuần 40", potential: "High", related: ["Khoa"], projectId: "FI-0001", rdProjectId: "RD-2026-001" }
    ];

    RECORDS.length = 0; recs.forEach(function (r) { RECORDS.push(r); });

    // Task mẫu cho vài dự án (để minh hoạ khung "Cập nhật task")
    var TASKS = {
      "FI-0001": [
        { id: "T-1", title: "Chốt kết quả test line bánh quy với R&D khách", due: "2026-09-05", who: "Thu", note: "", status: "DONE", by: "Thu", at: "28/08/2026 10:20" },
        { id: "T-2", title: "Gửi báo giá NUTRIOSE FB06 cho bộ phận mua", due: "2026-09-12", who: "Thu", note: "Báo giá 3 mức sản lượng — tham khảo hồ sơ Vinamilk.", status: "OPEN", by: "Thu", at: "01/09/2026 09:05" }
      ],
      "FI-0003": [
        { id: "T-3", title: "Chuẩn bị hồ sơ kỹ thuật cho buổi visit Q4", due: "2026-08-11", who: "Khoa", note: "", status: "DONE", by: "Khoa", at: "08/08/2026 14:00" }
      ],
      "FI-0012": [
        { id: "T-4", title: "Đàm phán điều khoản thanh toán 60 ngày", due: "2026-08-01", who: "Ngọc", note: "Khách chưa phản hồi — cần đẩy lại.", status: "OPEN", by: "Ngọc", at: "25/07/2026 11:30" }
      ],
      // FI-0016 — đủ 4 trạng thái badge: trễ hạn, sắp tới, sắp tới, đã xong
      "FI-0016": [
        { id: "T-5", title: "Xin C/O & C/Q lô mẫu từ Kimica", due: "2026-09-05", who: "Lan", note: "Khách yêu cầu bộ chứng từ đầy đủ trước khi chạy thử line 3.", status: "OPEN", by: "Ngọc", at: "29/08/2026 08:40" },
        { id: "T-6", title: "Chốt lịch chạy thử line 3 với QA Cầu Tre", due: "2026-09-12", who: "Ngọc", note: "", status: "OPEN", by: "Ngọc", at: "02/09/2026 15:10" },
        { id: "T-7", title: "Gửi báo giá 45.000 KG cho phòng mua hàng", due: "2026-09-15", who: "Ngọc", note: "Bám theo đơn giá 9.783 đ/KG, xin duyệt chiết khấu sản lượng.", status: "OPEN", by: "Ngọc", at: "03/09/2026 09:25" },
        { id: "T-8", title: "Gửi mẫu 500 G kèm TDS/COA", due: "2026-08-19", who: "Ngọc", note: "", status: "DONE", by: "Ngọc", at: "12/08/2026 10:05" }
      ],
      "FI-0018": [
        { id: "T-9", title: "Theo dõi tiến độ duyệt ngân sách của Bel", due: "2026-09-20", who: "Thu", note: "", status: "OPEN", by: "Thu", at: "22/08/2026 14:30" }
      ]
    };
    recs.forEach(function (r) { if (TASKS[r.id]) r.tasks = TASKS[r.id]; });

    ACTIVITIES.length = 0; acts.forEach(function (a) { ACTIVITIES.push(a); });

    /* ── R&D (Phase 1 + 2) — 7 đề tài mẫu (mã RD-{năm}-{số thứ tự 3 chữ số}), phủ đủ 7 stage của CATALOG.rdPipelines ──
       ON_DEMAND: originProjectId trỏ vào cơ hội Sales trong D (customer/ncc/product/application/segment khớp record gốc).
       INTERNAL : tự nghiên cứu, chưa có khách → originProjectId null, customer "".
       stage COMPLETED ↔ status DONE (có completedDate); SUSPENDED ↔ CANCELLED; còn lại IN_PROGRESS. */
    var rd = [
      { id: "RD-2026-001", code: "RD-2026-001", spId: "demo-rd-1", batches: [
          { id: "B1", no: 1, date: "2026-03-18", ratio: "20% thay bột mì", temp: "180 °C", time: "12 phút", result: "PASS", note: "Giòn đạt, xơ 4,8 g/100 g — chưa đủ claim.", by: "Khoa" },
          { id: "B2", no: 2, date: "2026-04-09", ratio: "30% thay bột mì", temp: "180 °C", time: "12 phút", result: "FAIL", note: "Đạt 6,2 g xơ nhưng bề mặt sẫm màu.", by: "Khoa" },
          { id: "B3", no: 3, date: "2026-05-06", ratio: "30% + giảm đường khử 15%", temp: "175 °C", time: "13 phút", result: "PASS", note: "Màu đạt, độ giòn tương đương mẫu chuẩn (−4%).", by: "Khoa" }
        ], type: "ON_DEMAND", originProjectId: "FI-0001",
        title: "Bánh quy giàu xơ Bibica — thay 30% bột mì bằng NUTRIOSE",
        customer: "Bibica", ncc: "Roquette", product: "NUTRIOSE FB06", application: "Bánh quy giàu chất xơ", segment: "CONFECTIONARY",
        pic: "Khoa", collaborators: ["Thu"], stage: "PILOT_TRIAL", status: "IN_PROGRESS",
        created: "2026-02-20", targetDate: "2026-10-15", completedDate: null,
        benchmarkCriteria: "Độ giòn không kém mẫu đối chứng hiện hành (Texture Analyzer, ±10%); đạt claim giàu xơ ≥ 6 g/100 g; không sẫm màu sau nướng; hạn dùng 9 tháng.",
        desc: "Lab đạt ở tỉ lệ thay thế 30%. Đang chạy thử line bánh quy tại nhà máy Bibica cùng Sales (Thu)." },
      { id: "RD-2026-002", code: "RD-2026-002", spId: "demo-rd-2", batches: [
          { id: "B1", no: 1, date: "2026-08-20", ratio: "KLEPTOSE 40% · maltitol 60%", temp: "145 °C", time: "8 phút", result: "FAIL", note: "Kết tinh bề mặt sau 2 tuần.", by: "Khoa" },
          { id: "B2", no: 2, date: "2026-09-10", ratio: "KLEPTOSE 55% · maltitol 45%", temp: "142 °C", time: "9 phút", result: "PENDING", note: "Đang theo dõi độ ổn định 30 °C / 75% RH.", by: "Khoa" }
        ], type: "ON_DEMAND", originProjectId: "FI-0002",
        title: "Kẹo không đường Kinh Đô — nền KLEPTOSE",
        customer: "Mondelez Kinh Đô", ncc: "Roquette", product: "KLEPTOSE Linecaps", application: "Kẹo không đường", segment: "SWEET FOOD",
        pic: "Khoa", collaborators: ["Ngọc"], stage: "FORMULATION", status: "IN_PROGRESS",
        created: "2026-03-12", targetDate: "2026-11-10", completedDate: null,
        benchmarkCriteria: "Thay 100% sucrose; độ ngọt cảm quan ≥ 90% mẫu chuẩn; không kết tinh lại sau 3 tháng ở 30 °C / 75% RH.",
        desc: "Đang thử 3 công thức với tỉ lệ polyol khác nhau để cân bằng độ ngọt và độ dẻo." },
      { id: "RD-2026-003", code: "RD-2026-003", spId: "demo-rd-3", log: [{ at: "2026-09-22 15:00", by: "Khoa", kind: "stage", from: "FORMULATION", to: "LAB_TEST" }], batches: [
          { id: "B1", no: 1, date: "2026-08-02", ratio: "Carrageenan 0,3%", temp: "95 °C", time: "3 phút", result: "FAIL", note: "Tách nước nhẹ sau 24 giờ.", by: "Khoa" },
          { id: "B2", no: 2, date: "2026-08-16", ratio: "Carrageenan 0,5%", temp: "95 °C", time: "3 phút", result: "PASS", note: "Độ nhớt 1.050 cP, không tách nước.", by: "Khoa" }
        ], type: "ON_DEMAND", originProjectId: "FI-0008",
        title: "Ổn định gel gói súp Acecook bằng Carrageenan",
        customer: "Acecook Vietnam", ncc: "IFF", product: "GRINDSTED Carrageenan", application: "Gói súp mì ăn liền", segment: "NOODLES",
        pic: "Khoa", collaborators: ["Hùng"], stage: "LAB_TEST", status: "IN_PROGRESS",
        created: "2026-01-22", targetDate: "2026-10-05", completedDate: null,
        benchmarkCriteria: "Gel ổn định sau hoàn nguyên 3 phút ở 95 °C; không tách nước sau 24 giờ; độ nhớt 800–1.200 cP.",
        desc: "Đang test độ ổn định gel và cảm quan gói súp ở 2 mức liều 0,3% và 0,5%." },
      { id: "RD-2026-004", code: "RD-2026-004", spId: "demo-rd-4", log: [{ at: "2026-09-18 10:20", by: "Hùng", kind: "created", to: "Khoa" }], type: "ON_DEMAND", originProjectId: "FI-0020",
        title: "Mì bổ sung xơ Acecook — khảo sát ban đầu",
        customer: "Acecook Vietnam", ncc: "Roquette", product: "NUTRIOSE FB06", application: "Mì giảm béo bổ sung xơ", segment: "NOODLES",
        pic: "Khoa", collaborators: ["Hùng"], stage: "BRIEF", status: "IN_PROGRESS",
        created: "2026-09-18", targetDate: "2027-01-10", completedDate: null,
        benchmarkCriteria: "Giữ độ dai sợi sau chiên và sau nấu 3 phút tương đương mẫu hiện hành; bổ sung ≥ 3 g xơ/khẩu phần.",
        desc: "Sales (Hùng) vừa chuyển yêu cầu; chờ khách gửi mẫu mì đối chứng và thông số line." },
      { id: "RD-2026-005", code: "RD-2026-005", spId: "demo-rd-5", type: "INTERNAL", originProjectId: null,
        title: "Chả chay plant-based từ đạm đậu nành",
        customer: "", ncc: "IFF", product: "SUPRO Soy Protein", application: "Chả chay (plant-based meat analogue)", segment: "VEGAN",
        pic: "Khoa", collaborators: ["Lan"], stage: "SAMPLE_SENT", status: "IN_PROGRESS",
        created: "2026-04-15", targetDate: "2026-10-30", completedDate: null,
        benchmarkCriteria: "Kết cấu thớ và độ dai tương đương chả heo (±10%); protein ≥ 15%; không còn mùi đậu sau hấp.",
        desc: "Đã gửi mẫu cho team Sales dùng làm demo tại các buổi thăm khách nhóm VEGAN / PROCESSED FOOD." },
      { id: "RD-2026-006", code: "RD-2026-006", spId: "demo-rd-6", batches: [
          { id: "B1", no: 1, date: "2026-05-12", ratio: "Giảm 30% đường + NUTRIOSE 3%", temp: "85 °C", time: "15 giây (thanh trùng)", result: "PASS", note: "Tam giác n=30: không khác biệt (p=0,41).", by: "Khoa" }
        ], type: "INTERNAL", originProjectId: null,
        title: "Trà sữa giảm 30% đường",
        customer: "", ncc: "Roquette", product: "NUTRIOSE FM06", application: "Trà sữa pha sẵn giảm đường", segment: "BEVERAGE",
        pic: "Khoa", collaborators: ["Thu", "Ngọc"], stage: "COMPLETED", status: "DONE",
        created: "2026-03-02", targetDate: "2026-08-31", completedDate: "2026-08-28",
        benchmarkCriteria: "Giảm ≥ 30% đường tổng; độ ngọt không khác biệt có ý nghĩa so với mẫu gốc (phép thử tam giác, n = 30); cảm giác đầy miệng ≥ 7/9.",
        desc: "Hoàn tất và đã chuyển giao công thức cho Sales để chào nhóm khách BEVERAGE." },
      { id: "RD-2026-007", code: "RD-2026-007", spId: "demo-rd-7", log: [{ at: "2026-06-20 16:10", by: "Khoa", kind: "stage", from: "LAB_TEST", to: "SUSPENDED" }], type: "INTERNAL", originProjectId: null,
        title: "Sữa hạt đạm đậu Hà Lan tiệt trùng UHT",
        customer: "", ncc: "Roquette", product: "NUTRALYS Pea Protein", application: "Sữa hạt UHT", segment: "DAIRY",
        pic: "Khoa", collaborators: [], stage: "SUSPENDED", status: "CANCELLED",
        created: "2026-03-10", targetDate: "2026-07-31", completedDate: null,
        benchmarkCriteria: "Không kết tủa sau UHT và sau 6 tháng bảo quản ở nhiệt độ thường; độ nhớt < 30 cP.",
        desc: "Tạm dừng: kết tủa sau UHT ở mọi công thức thử; chờ grade đạm mới từ NCC rồi đánh giá lại." }
    ];
    if (typeof RD_PROJECTS !== "undefined") { RD_PROJECTS.length = 0; rd.forEach(function (x) { RD_PROJECTS.push(x); }); }
    /* Phase 4: "máy chủ" giả lập cho FISG_STORE.fetch/create/updateRdProject ở chế độ demo (không gọi Graph) */
    window.DEMO_RD_LIST = JSON.parse(JSON.stringify(rd));

    USERS.length = 0; USERS_DEMO.forEach(function (u) { USERS.push(u); });
    if (window.rebuildDerived) try { rebuildDerived(); } catch (e) {}
  }

  function load() {
    if (typeof me !== "undefined" && me && document.getElementById("sfApp") &&
        document.getElementById("sfApp").style.display === "flex") return; // đã đăng nhập thật
    build();
    document.body.classList.add("sf-demo");
    if (window.loginAs) loginAs(0);
    // Chỉ báo môi trường demo giờ là tag "Demo training" trung tính cạnh logo
    // (styled trong funnel-sf.css) — không còn huy hiệu vàng nổi trên header.
    var lg = document.getElementById("sfLogin"); if (lg) lg.style.display = "none";
    if (window.toast) toast(T("demo.toast", { n: RECORDS.length }));
  }

  window.FISG_DEMO = { load: load, build: build };

  // Tự nạp nếu mở salesfunnel.html?demo=1
  function boot() {
    var demo = false;
    try { demo = /(?:^|[?&])demo=1(?:&|$)/.test(location.search); } catch (e) {}
    if (demo || window.FISG_DEMO_AUTO) setTimeout(load, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
