var ROLE_DEF = {
  sales: {
    label:'Sales', scope:'own-pic',
    edit:true,  close:true,  del:true,  admin:false, cockpit:false, weekly:true, weeklyAuto:true, report:true,
    hint:'Chỉ thấy dự án và hoạt động của mình'
  },
  salesupport: {
    label:'Sale Support', scope:'support',
    edit:true,  close:true,  del:false, admin:false, cockpit:false, weekly:true,  weeklyAuto:false, report:true,
    hint:'Hỗ trợ các sales được chỉ định: thấy và sửa dự án/hoạt động/khách của họ, nhưng KHÔNG xoá'
  },
  rnd: {

    label:'R&D', scope:'own-rnd', viewAll:true,
    edit:true,  close:false, del:true,  admin:false, cockpit:false, weekly:true, weeklyAuto:true, report:true,
    hint:'Thấy toàn bộ khách hàng và dự án; ghi được hoạt động với mọi khách; chỉ sửa dự án mình phụ trách R&D, không đóng dự án'
  },
  manager: {
    label:'Manager', scope:'all',
    edit:true,  close:true,  del:true,  admin:false, cockpit:true,  weekly:true,  weeklyAuto:false, report:true,
    hint:'Thấy toàn đội, đóng được dự án, có Kế hoạch tuần; TỰ SOẠN báo cáo tuần của mình và ĐỌC báo cáo của đội; không sửa phân quyền'
  },
  director: {
    label:'Director', scope:'all',
    edit:false, close:false, del:false, admin:false, cockpit:true,  weekly:false, weeklyAuto:false, report:false,
    hint:'Thấy toàn đội ở chế độ chỉ đọc; không nhập liệu, không đóng dự án'
  },
  superadmin: {
    label:'Super Admin', scope:'all',

    edit:true,  close:true,  del:true,  admin:true,  cockpit:true,  weekly:true, weeklyAuto:false, report:false,
    hint:'Toàn quyền, xem được mọi màn hình'
  }
};

var ROLE_FALLBACK = {
  label:'Chưa phân quyền', scope:'own-pic',
  edit:false, close:false, del:false, admin:false, cockpit:false, weekly:false, weeklyAuto:false, report:false,
  hint:'Vai trò không hợp lệ — liên hệ quản trị'
};

var ROLE_ORDER = ['sales','salesupport','rnd','manager','director','superadmin'];

function cap(role){ return ROLE_DEF[role] || ROLE_FALLBACK; }
function myCap(){ return cap(typeof me !== 'undefined' && me ? me.role : null); }

function canViewAll(u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return false;
  var c = cap(u.role);
  return c.scope === 'all' || !!c.viewAll;
}
function roleLabel(role){ return cap(role).label; }
function isKnownRole(role){ return Object.prototype.hasOwnProperty.call(ROLE_DEF, role); }

function capReport(role){ return !!cap(role).report; }

function roleFromText(s){
  var t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  if(!t) return '';
  if(isKnownRole(t)) return t;
  var ALIAS = {
    'sale':'sales', 'nhân viên':'sales', 'nhan vien':'sales', 'nhân viên kinh doanh':'sales',
    'sale support':'salesupport', 'sales support':'salesupport', 'hỗ trợ':'salesupport',
    'ho tro':'salesupport', 'hỗ trợ sales':'salesupport', 'trợ lý sales':'salesupport',
    'r&d':'rnd', 'rd':'rnd', 'nghiên cứu':'rnd', 'nghien cuu':'rnd',
    'quản lý':'manager', 'quan ly':'manager', 'trưởng phòng':'manager', 'truong phong':'manager',
    'giám đốc':'director', 'giam doc':'director',
    'super admin':'superadmin', 'quản trị':'superadmin', 'quan tri':'superadmin', 'admin':'superadmin'
  };
  if(ALIAS[t]) return ALIAS[t];

  for(var k in ROLE_DEF){ if(ROLE_DEF[k].label.toLowerCase() === t) return k; }
  return '';
}

function splitAliases(s){
  return String(s == null ? '' : s).split(/[,;|]/)
    .map(function(x){ return x.trim(); }).filter(Boolean);
}
function nameSetOf(u){
  if(!u) return [];
  var out = [];
  [u.pic, u.fullName, u.name].forEach(function(v){ if(v) out.push(v); });
  splitAliases(u.picRaw).forEach(function(v){ out.push(v); });
  var seen = {}, uniq = [];
  out.forEach(function(v){ var k = picKey(v); if(k && !seen[k]){ seen[k] = 1; uniq.push(v); } });
  return uniq;
}
function sameName(a, b){
  if(!a || !b) return false;
  return picKey(a) === picKey(b);
}

function isMine(value, u){
  if(!value || !u) return false;
  var k = picKey(value);
  return nameSetOf(u).some(function(n){ return picKey(n) === k; });
}

function supportsList(u){ return (u && u.supports && u.supports.length) ? u.supports : []; }

function coversPic(value, u){
  if(isMine(value, u)) return true;
  if(u && cap(u.role).scope === 'support' && value){
    var k = picKey(value);
    return supportsList(u).some(function(s){ return picKey(s) === k; });
  }
  return false;
}

function ownsCustomer(customer, u){
  if(!customer || !u) return false;
  if(typeof customerOwnerOf !== 'function') return false;
  return coversPic(customerOwnerOf(customer), u);
}

function ownsRecord(r, u){
  if(!r || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(c.scope === 'own-rnd') return isMine(r.rnd, u) || ownsCustomer(r.customer, u);
  return coversPic(r.pic, u)
      || (r.related || []).some(function(x){ return coversPic(x, u); })
      || ownsCustomer(r.customer, u);
}
function ownsActivity(a, u, projectIds){
  if(!a || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(coversPic(a.pic, u)) return true;

  if((a.related || []).some(function(x){ return coversPic(x, u); })) return true;
  if(ownsCustomer(a.customer, u)) return true;

  return !!(a.projectId && projectIds && projectIds[a.projectId]);
}

function scopeRecords(list, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return [];
  if(canViewAll(u)) return list.slice();
  return list.filter(function(r){ return ownsRecord(r, u); });
}
function scopeActs(list, u, records){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return [];
  if(canViewAll(u)) return list.slice();
  var ids = {};
  (records || []).forEach(function(r){ ids[r.id] = 1; });
  return list.filter(function(a){ return ownsActivity(a, u, ids); });
}

function capEdit(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return false;
  var c = cap(u.role);
  if(!c.edit) return false;
  if(c.admin || c.scope === 'all') return true;
  if(c.scope === 'support') return ownsRecord(r, u);
  return !!u.pic && ownsRecord(r, u);
}

function capDelete(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u || !cap(u.role).del) return false;
  return capEdit(r, u);
}
function capClose(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u || !r || r.status !== 'IN PROGRESS') return false;
  var c = cap(u.role);
  if(!c.close) return false;
  if(c.scope === 'all') return true;
  return !!u.pic && isMine(r.pic, u);
}

window.cap = cap; window.myCap = myCap; window.roleLabel = roleLabel; window.canViewAll = canViewAll;
window.splitAliases = splitAliases; window.nameSetOf = nameSetOf; window.isMine = isMine;
window.ownsRecord = ownsRecord; window.ownsActivity = ownsActivity; window.ownsCustomer = ownsCustomer;
window.coversPic = coversPic; window.supportsList = supportsList;
window.scopeRecords = scopeRecords; window.scopeActs = scopeActs;
window.capEdit = capEdit; window.capClose = capClose; window.capDelete = capDelete; window.isKnownRole = isKnownRole;
window.capReport = capReport; window.roleFromText = roleFromText;
