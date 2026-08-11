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
/* del: có được XOÁ bản ghi không (khác edit). Sale Support sửa được nhưng KHÔNG
   xoá được, nên tách riêng cờ này. */
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
    /* viewAll: R&D XEM được toàn bộ khách hàng, dự án và funnel như quản lý, và
       tạo được hoạt động với bất kỳ khách nào. Nhưng scope vẫn 'own-rnd' nên quyền
       SỬA/XOÁ dự án chỉ giới hạn ở dự án mình phụ trách R&D — thấy rộng, sửa hẹp.
       Kế hoạch tuần và báo cáo cũng bám cột R&D, không biến R&D thành "quản lý". */
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
    /* Super Admin thấy MỌI menu — kể cả Kế hoạch tuần, để kiểm tra được màn hình
       của sales. Nhưng popup không tự bật mỗi sáng: đó là nhịp làm việc của
       sales, không phải của quản trị. Không tự soạn báo cáo (đọc của đội). */
    edit:true,  close:true,  del:true,  admin:true,  cockpit:true,  weekly:true, weeklyAuto:false, report:false,
    hint:'Toàn quyền, xem được mọi màn hình'
  }
};

/* Vai trò không nhận ra: coi như chưa được cấp quyền gì. Thà một người mới thấy
   trống và đi hỏi, còn hơn âm thầm đọc được dữ liệu cả công ty. */
var ROLE_FALLBACK = {
  label:'Chưa phân quyền', scope:'own-pic',
  edit:false, close:false, del:false, admin:false, cockpit:false, weekly:false, weeklyAuto:false, report:false,
  hint:'Vai trò không hợp lệ — liên hệ quản trị'
};

var ROLE_ORDER = ['sales','salesupport','rnd','manager','director','superadmin'];

function cap(role){ return ROLE_DEF[role] || ROLE_FALLBACK; }
function myCap(){ return cap(typeof me !== 'undefined' && me ? me.role : null); }
/* XEM được toàn bộ dữ liệu không — tách khỏi scope. scope 'all' (quản lý/giám
   đốc/admin) đương nhiên xem hết. Cờ viewAll cấp riêng quyền XEM cho vai trò có
   scope hẹp (R&D) mà không nới quyền SỬA của họ. */
function canViewAll(u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return false;
  var c = cap(u.role);
  return c.scope === 'all' || !!c.viewAll;
}
function roleLabel(role){ return cap(role).label; }
function isKnownRole(role){ return Object.prototype.hasOwnProperty.call(ROLE_DEF, role); }

/* Vai trò này CÓ tự soạn báo cáo tuần không. Đây là quyền DƯƠNG (chỉ người thực
   thi trực tiếp: sales, R&D, sale support). Quản lý/giám đốc/super admin ĐỌC báo
   cáo của đội, không tự soạn. Dùng quyền dương thay vì "ai không phải quản lý"
   để vai trò lạ/chưa nhận ra cũng KHÔNG lọt vào luồng soạn báo cáo. */
function capReport(role){ return !!cap(role).report; }

/* Chuẩn hoá chuỗi vai trò đọc từ SharePoint về đúng khoá ROLE_DEF. Cột Role có
   thể ghi id ('manager'), hoặc nhãn ('Manager', 'Sale Support', 'Super Admin'),
   hoặc tiếng Việt ('Quản lý', 'Giám đốc', 'Hỗ trợ'). Không nhận ra → '' để phía
   gọi tự quyết mặc định. */
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
  /* thử khớp theo nhãn đã khai trong ROLE_DEF */
  for(var k in ROLE_DEF){ if(ROLE_DEF[k].label.toLowerCase() === t) return k; }
  return '';
}

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

/* Danh sách sales mà một Sale Support được chỉ định hỗ trợ. */
function supportsList(u){ return (u && u.supports && u.supports.length) ? u.supports : []; }

/* Một GIÁ TRỊ TÊN có thuộc phạm vi của u không:
     · luôn: là một trong các tên của chính u
     · nếu là Sale Support: HOẶC là một trong các sales u được chỉ định hỗ trợ */
function coversPic(value, u){
  if(isMine(value, u)) return true;
  if(u && cap(u.role).scope === 'support' && value){
    var k = picKey(value);
    return supportsList(u).some(function(s){ return picKey(s) === k; });
  }
  return false;
}
/* Chủ sở hữu khách hàng có nằm trong phạm vi của u không. Sale Support: chủ là
   một trong các sales được hỗ trợ cũng tính. */
function ownsCustomer(customer, u){
  if(!customer || !u) return false;
  if(typeof customerOwnerOf !== 'function') return false;
  return coversPic(customerOwnerOf(customer), u);
}

/* Bản ghi này có thuộc về người dùng u không, theo phạm vi của vai trò.
   Ba đường CỘNG THÊM (HOẶC), không đường nào gỡ quyền đường nào:
     · là PIC dự án (hoặc sales mình hỗ trợ)    · là người liên quan
     · là chủ sở hữu khách hàng (danh bạ Customers)
   R&D vẫn giới hạn theo cột RnDOwner như cũ. */
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
  /* Người liên quan được thêm vào hoạt động cũng "sở hữu" hoạt động đó: nó hiện
     trong kế hoạch tuần và báo cáo của họ. */
  if((a.related || []).some(function(x){ return coversPic(x, u); })) return true;
  if(ownsCustomer(a.customer, u)) return true;
  /* R&D không phải người ghi hoạt động, nhưng hoạt động thuộc dự án họ phụ
     trách thì vẫn phải thấy — nếu không, dự án hiện ra mà lịch sử trống. */
  return !!(a.projectId && projectIds && projectIds[a.projectId]);
}

/* Lọc theo phạm vi. Trả về mảng mới, không đụng mảng gốc. */
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

/* ---------- QUYỀN SỬA ---------- */
function capEdit(r, u){
  u = u || (typeof me !== 'undefined' ? me : null);
  if(!u) return false;
  var c = cap(u.role);
  if(!c.edit) return false;
  if(c.admin || c.scope === 'all') return true;
  if(c.scope === 'support') return ownsRecord(r, u);   // support không cần có PIC
  return !!u.pic && ownsRecord(r, u);
}
/* ---------- QUYỀN XOÁ ----------
   Tách khỏi sửa: Sale Support toàn quyền sửa nhưng KHÔNG được xoá (del=false). */
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
