/* js/lib/roles.js — vai trò và năng lực.

   Trước đây quyền hạn nằm rải rác dưới dạng so sánh chuỗi ở 13 chỗ, và hai chỗ
   quan trọng nhất viết theo kiểu phủ định (`role !== 'sales'`) — nghĩa là mỗi
   khi thêm một vai trò mới, vai trò đó lập tức thấy toàn bộ dữ liệu công ty mà
   không ai cố ý cấp. File này gom lại một chỗ, và mặc định của vai trò lạ là
   CHẶT NHẤT chứ không phải rộng nhất.

   Hàm thuần, không đụng DOM. */

/* scope: 'own-pic'  chỉ dự án mình là PIC (hoặc có tên trong người liên quan)
          'own-rnd'  chỉ dự án mình phụ trách R&D
          'all'      toàn bộ dữ liệu trong tầm nhìn của NCC đang chọn */
var ROLE_DEF = {
  sales: {
    label:'Sales', scope:'own-pic',
    edit:true,  close:true,  admin:false, cockpit:false, weekly:true, weeklyAuto:true,
    hint:'Chỉ thấy dự án và hoạt động của mình'
  },
  rnd: {
    label:'R&D', scope:'own-rnd',
    edit:true,  close:false, admin:false, cockpit:false, weekly:true, weeklyAuto:true,
    hint:'Chỉ thấy dự án mình phụ trách R&D; ghi được hoạt động, không đóng dự án'
  },
  manager: {
    label:'Manager', scope:'all',
    edit:true,  close:true,  admin:false, cockpit:true,  weekly:false, weeklyAuto:false,
    hint:'Thấy toàn đội, đóng được dự án, không sửa phân quyền'
  },
  director: {
    label:'Director', scope:'all',
    edit:false, close:false, admin:false, cockpit:true,  weekly:false, weeklyAuto:false,
    hint:'Thấy toàn đội ở chế độ chỉ đọc; không nhập liệu, không đóng dự án'
  },
  superadmin: {
    label:'Super Admin', scope:'all',
    /* Super Admin thấy MỌI menu — kể cả Kế hoạch tuần, để kiểm tra được màn hình
       của sales. Nhưng popup không tự bật mỗi sáng: đó là nhịp làm việc của
       sales, không phải của quản trị. */
    edit:true,  close:true,  admin:true,  cockpit:true,  weekly:true, weeklyAuto:false,
    hint:'Toàn quyền, xem được mọi màn hình'
  }
};

/* Vai trò không nhận ra: coi như chưa được cấp quyền gì. Thà một người mới thấy
   trống và đi hỏi, còn hơn âm thầm đọc được dữ liệu cả công ty. */
var ROLE_FALLBACK = {
  label:'Chưa phân quyền', scope:'own-pic',
  edit:false, close:false, admin:false, cockpit:false, weekly:false, weeklyAuto:false,
  hint:'Vai trò không hợp lệ — liên hệ quản trị'
};

var ROLE_ORDER = ['sales','rnd','manager','director','superadmin'];

function cap(role){ return ROLE_DEF[role] || ROLE_FALLBACK; }
function myCap(){ return cap(typeof me !== 'undefined' && me ? me.role : null); }
function roleLabel(role){ return cap(role).label; }
function isKnownRole(role){ return Object.prototype.hasOwnProperty.call(ROLE_DEF, role); }

/* ---------- TÊN GỌI ----------
   Một người có thể xuất hiện trong dữ liệu dưới nhiều tên: cột PIC của dự án
   này ghi "Ngoc", dự án kia ghi "Bich Ngoc", O365 gọi là "Phạm Bích Ngọc".
   Nên phép so tên phải so với CẢ TẬP, không phải một chuỗi. */
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
/* Giá trị trong dữ liệu có trùng với BẤT KỲ tên nào của người này không. */
function isMine(value, u){
  if(!value || !u) return false;
  var k = picKey(value);
  return nameSetOf(u).some(function(n){ return picKey(n) === k; });
}

/* Bản ghi này có thuộc về người dùng u không, theo phạm vi của vai trò. */
function ownsRecord(r, u){
  if(!r || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(c.scope === 'own-rnd') return isMine(r.rnd, u);
  return isMine(r.pic, u)
      || (r.related || []).some(function(x){ return isMine(x, u); });
}
function ownsActivity(a, u, projectIds){
  if(!a || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(isMine(a.pic, u)) return true;
  /* R&D không phải người ghi hoạt động, nhưng hoạt động thuộc dự án họ phụ
     trách thì vẫn phải thấy — nếu không, dự án hiện ra mà lịch sử trống. */
  return !!(a.projectId && projectIds && projectIds[a.projectId]);
}

/* Lọc theo phạm vi. Trả về mảng mới, không đụng mảng gốc. */
function scopeRecords(list, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return [];
  if(cap(u.role).scope === 'all') return list.slice();
  return list.filter(function(r){ return ownsRecord(r, u); });
}
function scopeActs(list, u, records){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return [];
  if(cap(u.role).scope === 'all') return list.slice();
  var ids = {};
  (records || []).forEach(function(r){ ids[r.id] = 1; });
  return list.filter(function(a){ return ownsActivity(a, u, ids); });
}

/* ---------- QUYỀN SỬA ---------- */
function capEdit(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return false;
  var c = cap(u.role);
  if(!c.edit) return false;
  if(c.admin) return true;
  return !!u.pic && ownsRecord(r, u);
}
function capClose(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u || !r || r.status !== 'IN PROGRESS') return false;
  var c = cap(u.role);
  if(!c.close) return false;
  if(c.scope === 'all') return true;
  return !!u.pic && isMine(r.pic, u);
}

window.cap = cap; window.myCap = myCap; window.roleLabel = roleLabel;
window.splitAliases = splitAliases; window.nameSetOf = nameSetOf; window.isMine = isMine;
window.ownsRecord = ownsRecord; window.scopeRecords = scopeRecords; window.scopeActs = scopeActs;
window.capEdit = capEdit; window.capClose = capClose; window.isKnownRole = isKnownRole;
