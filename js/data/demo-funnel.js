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
    "P-1000": "Đối thủ chào CMC giá thấp hơn",
    "P-1002": "Khách yêu cầu giảm 5% giá để chốt PO cuối năm",
    "P-1004": "Ngân sách R&D 2027 của khách chưa duyệt",
    "P-1007": "Thời gian test kéo dài, rủi ro trễ mùa vụ sản xuất",
    "P-1011": "Điều khoản thanh toán 60 ngày chưa được duyệt",
    "P-1015": "Đối thủ Danisco chào giá thấp hơn ~8%. Lead time Kimica 45 ngày — cần đặt hàng trước khi khách chốt PO.",
    "P-1017": "Khách đang so sánh với alginate Trung Quốc giá rẻ"
  };

  function build() {
    var recs = D.map(function (a, i) {
      var stage = a[6], status = a[7];
      var prob = status === "WON" ? 1 : status === "LOST" ? 0 : (PROB[stage] || 10) / 100;
      var cmts = a[14] ? [{ by: a[10], at: a[11].split("-").reverse().join("/") + " 09:15", text: a[14] }] : [];
      if (status === "WON") cmts.push({ by: a[10], at: "30/06/2026 16:40", text: "[Đóng dự án — Thắng] Đã ký hợp đồng cung ứng." });
      if (status === "LOST") cmts.push({ by: a[10], at: "20/05/2026 11:20", text: "[Đóng dự án — Thua] Khách chọn NCC khác do giá." });
      return {
        id: "P-" + (1000 + i), spId: null, ncc: a[0], customer: a[1], product: a[2], application: a[3],
        group: a[4], segment: a[5], stage: stage, status: status, boptype: "NEW BUSINESS",
        prob: prob, kgThis: a[8], kgNext: a[9], pic: a[10], rnd: "Khoa", related: a[13] || [],
        created: a[11], closing: a[12], desc: a[1] + " · " + a[2], comments: cmts,
        risk: RISKS["P-" + (1000 + i)] || "",
        amount: Math.round((a[8] || 0) * 25000 / 1000) * 1000   // giá trị ước tính mẫu (VND)

      };
    });

    var acts = [
      { id: "A-1", spId: null, ncc: "Roquette", customer: "Vinamilk", pic: "Thu", type: "Visit", date: "2026-08-12", note: "Thăm nhà máy, trao đổi sản lượng dự kiến Q4.", next: "Gửi báo giá 3 mức", potential: "High", related: ["Khoa"], projectId: "P-1002" },
      { id: "A-2", spId: null, ncc: "Roquette", customer: "Bibica", pic: "Thu", type: "Call", date: "2026-08-05", note: "Gọi xác nhận kết quả test line bánh quy.", next: "Hẹn test lần 3", potential: "Medium", related: [], projectId: "P-1000" },
      { id: "A-3", spId: null, ncc: "IFF", customer: "Acecook Vietnam", pic: "Hùng", type: "Email", date: "2026-08-01", note: "Gửi tài liệu kỹ thuật carrageenan cho gói súp.", next: "Chờ phản hồi test", potential: "High", related: ["Khoa"], projectId: "P-1007" },
      { id: "A-4", spId: null, ncc: "IFF", customer: "Vinacafé Biên Hòa", pic: "Thu", type: "Visit", date: "2026-07-28", note: "Họp chốt kết quả test, khách xác nhận đạt.", next: "Chuẩn bị báo giá", potential: "High", related: ["Lan"], projectId: "P-1009" },

      // P-1015 — Cầu Tre · Sodium Alginate: nhật ký đủ dày để xem Record Page
      { id: "A-5", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Visit", date: "2026-08-19", note: "Làm việc tại nhà máy Củ Chi, gửi mẫu Sodium Alginate 500 G kèm TDS/COA cho phòng R&D. Chốt tiêu chí đánh giá: độ kết dính nhân và thất thoát sau cấp đông.", next: "Theo dõi lịch test của QA", potential: "High", related: ["Khoa"], projectId: "P-1015" },
      { id: "A-6", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Call", date: "2026-08-28", note: "Gọi theo dõi sau khi gửi mẫu. QA xác nhận đã nhận hàng, đang xếp lịch test tuần 36.", next: "Chờ kết quả test", potential: "High", related: [], projectId: "P-1015" },
      { id: "A-7", spId: null, ncc: "Kimica", customer: "Cầu Tre", pic: "Ngọc", type: "Email", date: "2026-09-02", note: "Khách phản hồi kết quả test: độ kết dính nhân chả giò đạt yêu cầu, thất thoát sau cấp đông giảm rõ. Cầu Tre đề nghị gửi thêm 2 KG để chạy thử trên line 3.", next: "Gửi 2 KG mẫu chạy line 3", potential: "High", related: ["Khoa"], projectId: "P-1015" },

      { id: "A-8", spId: null, ncc: "Kimica", customer: "Bel Vietnam", pic: "Thu", type: "Email", date: "2026-08-22", note: "Gửi hồ sơ kỹ thuật alginate cho bộ phận mua hàng, khách xác nhận đạt yêu cầu kỹ thuật.", next: "Chờ duyệt ngân sách", potential: "Medium", related: ["Khoa"], projectId: "P-1017" },
      { id: "A-9", spId: null, ncc: "IFF", customer: "Cholimex Foods", pic: "Ngọc", type: "Call", date: "2026-08-14", note: "Đàm phán lại giá tương ớt, khách xin giữ mức giá đến hết Q4.", next: "Trình duyệt giá nội bộ", potential: "High", related: [], projectId: "P-1011" }
    ];

    RECORDS.length = 0; recs.forEach(function (r) { RECORDS.push(r); });

    // Task mẫu cho vài dự án (để minh hoạ khung "Cập nhật task")
    var TASKS = {
      "P-1000": [
        { id: "T-1", title: "Chốt kết quả test line bánh quy với R&D khách", due: "2026-09-05", who: "Thu", note: "", status: "DONE", by: "Thu", at: "28/08/2026 10:20" },
        { id: "T-2", title: "Gửi báo giá NUTRIOSE FB06 cho bộ phận mua", due: "2026-09-12", who: "Thu", note: "Báo giá 3 mức sản lượng — tham khảo hồ sơ Vinamilk.", status: "OPEN", by: "Thu", at: "01/09/2026 09:05" }
      ],
      "P-1002": [
        { id: "T-3", title: "Chuẩn bị hồ sơ kỹ thuật cho buổi visit Q4", due: "2026-08-11", who: "Khoa", note: "", status: "DONE", by: "Khoa", at: "08/08/2026 14:00" }
      ],
      "P-1011": [
        { id: "T-4", title: "Đàm phán điều khoản thanh toán 60 ngày", due: "2026-08-01", who: "Ngọc", note: "Khách chưa phản hồi — cần đẩy lại.", status: "OPEN", by: "Ngọc", at: "25/07/2026 11:30" }
      ],
      // P-1015 — đủ 4 trạng thái badge: trễ hạn, sắp tới, sắp tới, đã xong
      "P-1015": [
        { id: "T-5", title: "Xin C/O & C/Q lô mẫu từ Kimica", due: "2026-09-05", who: "Lan", note: "Khách yêu cầu bộ chứng từ đầy đủ trước khi chạy thử line 3.", status: "OPEN", by: "Ngọc", at: "29/08/2026 08:40" },
        { id: "T-6", title: "Chốt lịch chạy thử line 3 với QA Cầu Tre", due: "2026-09-12", who: "Ngọc", note: "", status: "OPEN", by: "Ngọc", at: "02/09/2026 15:10" },
        { id: "T-7", title: "Gửi báo giá 45.000 KG cho phòng mua hàng", due: "2026-09-15", who: "Ngọc", note: "Bám theo đơn giá 9.783 đ/KG, xin duyệt chiết khấu sản lượng.", status: "OPEN", by: "Ngọc", at: "03/09/2026 09:25" },
        { id: "T-8", title: "Gửi mẫu 500 G kèm TDS/COA", due: "2026-08-19", who: "Ngọc", note: "", status: "DONE", by: "Ngọc", at: "12/08/2026 10:05" }
      ],
      "P-1017": [
        { id: "T-9", title: "Theo dõi tiến độ duyệt ngân sách của Bel", due: "2026-09-20", who: "Thu", note: "", status: "OPEN", by: "Thu", at: "22/08/2026 14:30" }
      ]
    };
    recs.forEach(function (r) { if (TASKS[r.id]) r.tasks = TASKS[r.id]; });

    ACTIVITIES.length = 0; acts.forEach(function (a) { ACTIVITIES.push(a); });
    USERS.length = 0; USERS_DEMO.forEach(function (u) { USERS.push(u); });
    if (window.rebuildDerived) try { rebuildDerived(); } catch (e) {}
  }

  function load() {
    if (typeof me !== "undefined" && me && document.getElementById("sfApp") &&
        document.getElementById("sfApp").style.display === "flex") return; // đã đăng nhập thật
    build();
    document.body.classList.add("sf-demo");
    if (window.loginAs) loginAs(0);
    // huy hiệu demo
    var lg = document.getElementById("sfLogin"); if (lg) lg.style.display = "none";
    if (!document.getElementById("sfDemoBadge")) {
      var b = document.createElement("div");
      b.id = "sfDemoBadge"; b.className = "sf-demo-badge";
      b.setAttribute("data-i18n", "demo.badge"); b.textContent = T("demo.badge");
      var top = document.querySelector(".sf-top"); if (top) top.appendChild(b);
    }
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
