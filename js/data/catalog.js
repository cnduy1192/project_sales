var CATALOG = {

  nccs: ["Roquette", "IFF", "Kimica-Navido"],

  pipelines: {
    "Roquette":      ["SHARED BUSINESS GOAL", "BUILDING A SOLUTION", "SOLUTION TESTING", "OFFER & AGREEMENT"],
    "IFF":           ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO"],
    "Kimica-Navido": ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO", "POSTPONED"]
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

var OTHER_NCC = 'Khác';

var LISTS = {
  nccs:      CATALOG.nccs.slice(),
  pipelines: JSON.parse(JSON.stringify(CATALOG.pipelines)),
  groupOf:   Object.assign({}, CATALOG.groupOf),
  probOf:    Object.assign({}, CATALOG.probOf),
  segTree:   JSON.parse(JSON.stringify(CATALOG.segTree)),
  segments:  CATALOG.segments.slice(),

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
