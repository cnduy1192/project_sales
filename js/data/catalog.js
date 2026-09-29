var CATALOG = {

  nccs: ["Roquette", "IFF", "Kimica"],

  pipelines: {
    "Roquette":      ["SHARED BUSINESS GOAL", "BUILDING A SOLUTION", "SOLUTION TESTING", "OFFER & AGREEMENT"],
    "IFF":           ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO"],
    "Kimica": ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO", "POSTPONED"]
  },

  groupOf: {
    "SHARED BUSINESS GOAL": "Tiếp cận",
    "LEAD":                 "Tiếp cận",
    "BUILDING A SOLUTION":  "Thử mẫu",
    "SOLUTION TESTING":     "Thử mẫu",
    "SAMPLE SENT":          "Thử mẫu",
    "TESTING":              "Thử mẫu",
    "TEST PASSED":          "Thử mẫu",
    "OFFER & AGREEMENT":    "Đàm phán",
    "QUOTED / PO":          "Đàm phán",
    "POSTPONED":            "Hoãn"
  },

  probOf: {
    "SHARED BUSINESS GOAL": 10,
    "BUILDING A SOLUTION":  25,
    "SOLUTION TESTING":     50,
    "OFFER & AGREEMENT":    75,
    "LEAD":                 10,
    "SAMPLE SENT":          25,
    "TESTING":              40,
    "TEST PASSED":          60,
    "QUOTED / PO":          80,
    "POSTPONED":            15
  },

  segTree: {
    "BAKERY":  ["BAKERY", "CONFECTIONARY", "SNACK"],
    "SAVOURY": ["FAT & OIL", "MEAT", "NOODLES", "PROCESSED FOOD", "SAUCE & SEASONING", "SEAFOOD", "VEGAN"],
    "SWEET":   ["BEVERAGE", "DAIRY", "SWEET FOOD"]
  },

  segments: ["BAKERY", "BEVERAGE", "CONFECTIONARY", "DAIRY", "FAT & OIL", "MEAT",
             "NOODLES", "PROCESSED FOOD", "SAUCE & SEASONING", "SEAFOOD", "SNACK",
             "SWEET FOOD", "VEGAN"]
};

/* ═══════════════ R&D (Phase 1 — schema & catalog) ═══════════════
   Pipeline R&D tách biệt hoàn toàn với pipeline Sales (pipelines/probOf ở trên):
   mã stage dùng dấu gạch dưới (SAMPLE_SENT) nên không trùng khoá "SAMPLE SENT"
   của IFF/Kimica → funnel-sf.js / cockpit.js không bị ảnh hưởng.
   Mã stage/type/status là giá trị LƯU TRỮ (tiếng Anh, không dịch);
   nhãn hiển thị lấy qua T("rd.pipeline.<CODE>") / T("rd.type.<CODE>") / T("rd.status.<CODE>"). */
CATALOG.rdPipelines = [
  "BRIEF",            // Tiếp nhận đề bài / Yêu cầu
  "FORMULATION",      // Lên công thức Lab (Recipe)
  "LAB_TEST",         // Thử nghiệm Lab & Cảm quan
  "SAMPLE_SENT",      // Gửi mẫu đối chứng cho Sales/Khách
  "PILOT_TRIAL",      // Chạy thử line nhà máy (Pilot)
  "COMPLETED",        // Hoàn tất thành công (Chuyển giao)
  "SUSPENDED"         // Tạm hoãn / Không khả thi
];
CATALOG.rdStageProb = {
  "BRIEF": 10,
  "FORMULATION": 30,
  "LAB_TEST": 50,
  "SAMPLE_SENT": 70,
  "PILOT_TRIAL": 85,
  "COMPLETED": 100,
  "SUSPENDED": 0
};
CATALOG.rdTypes  = ["ON_DEMAND", "INTERNAL"];              // theo yêu cầu Sales · tự nghiên cứu
CATALOG.rdStatus = ["IN_PROGRESS", "DONE", "CANCELLED"];

var RD_TYPES  = CATALOG.rdTypes;
var RD_STATUS = CATALOG.rdStatus;

var OTHER_NCC = 'Khác';

var LISTS = {
  nccs:      CATALOG.nccs.slice(),
  pipelines: JSON.parse(JSON.stringify(CATALOG.pipelines)),
  groupOf:   Object.assign({}, CATALOG.groupOf),
  probOf:    Object.assign({}, CATALOG.probOf),
  segTree:   JSON.parse(JSON.stringify(CATALOG.segTree)),
  segments:  CATALOG.segments.slice(),
  // NCC có pipeline riêng (từ list Pipelines trên SharePoint, fallback catalog).
  // NCC không nằm trong đây → dùng pipeline của Roquette.
  pipelineKeys: Object.keys(CATALOG.pipelines),

  // R&D — bản runtime (Phase 2 có thể nạp đè từ SharePoint như pipelines Sales)
  rdPipelines:  CATALOG.rdPipelines.slice(),
  rdStageProb:  Object.assign({}, CATALOG.rdStageProb),

  customers:    [],
  products:     [],
  applications: [],
  pics:         []
};

function resetCatalog() {
  LISTS.nccs.length = 0;      CATALOG.nccs.forEach(function (n) { LISTS.nccs.push(n); });
  LISTS.segments.length = 0;  CATALOG.segments.forEach(function (s) { LISTS.segments.push(s); });
  [["pipelines", "segTree"], ["groupOf", "probOf"]];
  ["pipelines", "segTree"].forEach(function (k) {
    Object.keys(LISTS[k]).forEach(function (x) { delete LISTS[k][x]; });
    Object.keys(CATALOG[k]).forEach(function (x) { LISTS[k][x] = CATALOG[k][x].slice(); });
  });
  ["groupOf", "probOf"].forEach(function (k) {
    Object.keys(LISTS[k]).forEach(function (x) { delete LISTS[k][x]; });
    Object.assign(LISTS[k], CATALOG[k]);
  });
  LISTS.pipelineKeys = Object.keys(CATALOG.pipelines);
  LISTS.rdPipelines.length = 0; CATALOG.rdPipelines.forEach(function (s) { LISTS.rdPipelines.push(s); });
  Object.keys(LISTS.rdStageProb).forEach(function (x) { delete LISTS.rdStageProb[x]; });
  Object.assign(LISTS.rdStageProb, CATALOG.rdStageProb);
}
window.resetCatalog = resetCatalog;

var RECORDS = [];
var ACTIVITIES = [];

var SUPPLIERS = [];

var CUSTOMER_DIR = [];
var CUSTOMER_OWNER = {};
var CUSTOMER_LEGAL = {};

var REPORTS = [];

var ATTACHMENTS = [];

/* Dự án R&D. Schema mỗi phần tử:
   { id, code, title, type (RD_TYPES), originProjectId (FI-xxxx | null — chỉ ON_DEMAND),
     customer, ncc, product, application, segment, pic (R&D phụ trách), collaborators [PIC],
     stage (CATALOG.rdPipelines), status (RD_STATUS), created, targetDate, completedDate (ISO | null),
     benchmarkCriteria, desc,
     // Phase 2 (R&D Workspace):
     spId (ID SharePoint, null khi chưa đồng bộ), batches [{ id, no, date, ratio, temp, time, result: PASS|FAIL|PENDING, note, by, at }],
     log [{ at, by, kind: "created"|"stage", from, to }], updatedAt, updatedBy }
   code: RD-{năm}-{số thứ tự 3 chữ số}, vd. RD-2026-001 (id = code).
   INTERNAL: originProjectId = null, customer = "". */
var RD_PROJECTS = [];
