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
    edit:true,  close:true,  admin:false, cockpit:false, weekly:true,
    hint:'Chỉ thấy dự án và hoạt động của mình'
  },
  rnd: {
    label:'R&D', scope:'own-rnd',
    edit:true,  close:false, admin:false, cockpit:false, weekly:true,
    hint:'Chỉ thấy dự án mình phụ trách R&D; ghi được hoạt động, không đóng dự án'
  },
  manager: {
    label:'Manager', scope:'all',
    edit:true,  close:true,  admin:false, cockpit:true,  weekly:false,
    hint:'Thấy toàn đội, đóng được dự án, không sửa phân quyền'
  },
  director: {
    label:'Director', scope:'all',
    edit:false, close:false, admin:false, cockpit:true,  weekly:false,
    hint:'Thấy toàn đội ở chế độ chỉ đọc; không nhập liệu, không đóng dự án'
  },
  superadmin: {
    label:'Super Admin', scope:'all',
    edit:true,  close:true,  admin:true,  cockpit:true,  weekly:false,
    hint:'Toàn quyền, gồm cả màn hình phân quyền'
  }
};

/* Vai trò không nhận ra: coi như chưa được cấp quyền gì. Thà một người mới thấy
   trống và đi hỏi, còn hơn âm thầm đọc được dữ liệu cả công ty. */
var ROLE_FALLBACK = {
  label:'Chưa phân quyền', scope:'own-pic',
  edit:false, close:false, admin:false, cockpit:false, weekly:false,
  hint:'Vai trò không hợp lệ — liên hệ quản trị'
};

var ROLE_ORDER = ['sales','rnd','manager','director','superadmin'];

function cap(role){ return ROLE_DEF[role] || ROLE_FALLBACK; }
function myCap(){ return cap(typeof me !== 'undefined' && me ? me.role : null); }
function roleLabel(role){ return cap(role).label; }
function isKnownRole(role){ return Object.prototype.hasOwnProperty.call(ROLE_DEF, role); }

/* ---------- QUYỀN XEM ---------- */
function sameName(a, b){
  if(!a || !b) return false;
  return picKey(a) === picKey(b);
}

/* Bản ghi này có thuộc về người dùng u không, theo phạm vi của vai trò. */
function ownsRecord(r, u){
  if(!r || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(c.scope === 'own-rnd') return sameName(r.rnd, u.pic);
  return sameName(r.pic, u.pic)
      || (r.related || []).some(function(x){ return sameName(x, u.pic); });
}
function ownsActivity(a, u, projectIds){
  if(!a || !u) return false;
  var c = cap(u.role);
  if(c.scope === 'all') return true;
  if(sameName(a.pic, u.pic)) return true;
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
  return !!u.pic && sameName(r.pic, u.pic);
}

window.cap = cap; window.myCap = myCap; window.roleLabel = roleLabel;
window.ownsRecord = ownsRecord; window.scopeRecords = scopeRecords; window.scopeActs = scopeActs;
window.capEdit = capEdit; window.capClose = capClose; window.isKnownRole = isKnownRole;
