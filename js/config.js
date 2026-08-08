/* js/config.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */

/* Không còn tài khoản demo. Danh sách này do store.js đổ vào từ list Users trên
   SharePoint sau khi đăng nhập Microsoft 365. */
let USERS = [];

/* Các hằng dưới đây giữ THAM CHIẾU tới mảng/object bên trong LISTS. store.js sửa
   nội dung tại chỗ nên tham chiếu luôn đúng — trừ SEG_GROUPS và SEG2GROUP vốn là
   giá trị dẫn xuất, phải tính lại bằng rebuildDerived() sau mỗi lần tải. */
const ALL_PICS = LISTS.pics;
const PIPELINES = LISTS.pipelines, SEG_TREE = LISTS.segTree;
let SEG_GROUPS = [];
const SEG2GROUP = {};
const NCCS = LISTS.nccs;

/* Danh sách NCC có thể lặp: SharePoint trả trùng tên, hoặc người dùng đã thêm thủ
 * công một NCC khác hoa/thường hay dư khoảng trắng. NCCS trỏ thẳng vào LISTS.nccs
 * nên phải sửa TẠI CHỖ, không gán lại mảng mới. */
function dedupeNccs(){
  if(!Array.isArray(LISTS.nccs)) return 0;
  const seen = new Set(), clean = [];
  LISTS.nccs.forEach(n => {
    const name = String(n == null ? '' : n).trim(), k = name.toLowerCase();
    if(!name || seen.has(k)) return;
    seen.add(k); clean.push(name);
  });
  const removed = LISTS.nccs.length - clean.length;
  if(removed || clean.some((n,i) => n !== LISTS.nccs[i])){
    LISTS.nccs.length = 0;
    clean.forEach(n => LISTS.nccs.push(n));
  }
  return removed;
}
window.dedupeNccs = dedupeNccs;

function rebuildDerived(){
  dedupeNccs();
  SEG_GROUPS = Object.keys(SEG_TREE);
  Object.keys(SEG2GROUP).forEach(k => delete SEG2GROUP[k]);
  SEG_GROUPS.forEach(g => (SEG_TREE[g]||[]).forEach(s => SEG2GROUP[s] = g));
  /* NCC đang lọc phải nằm trong danh sách thật, nếu không mọi bảng đều trống.
     Trừ chế độ "Tất cả" — đó là trạng thái BỎ lọc, không phải một NCC.
     Lúc mới nạp (nccFilter='') mặc định về "Tất cả", không khoá vào NCC đầu tiên. */
  if(NCCS.length && nccFilter !== ALL_NCC && NCCS.indexOf(nccFilter) < 0){
    if(!nccFilter){ nccFilter = ALL_NCC; }
    else {
      const same = NCCS.filter(n => n.toLowerCase() === String(nccFilter).trim().toLowerCase())[0];
      nccFilter = same || ALL_NCC;
    }
  }
  return { groups: SEG_GROUPS.length, nccs: NCCS.length };
}
window.rebuildDerived = rebuildDerived;
/* "Tất cả" KHÔNG phải một nhà cung cấp — nó là trạng thái bỏ lọc. Dùng mã riêng
   '*' thay vì chuỗi rỗng để phân biệt với nccFilter='' lúc trang mới nạp (lúc đó
   rebuildDerived còn phải tự chọn NCC đầu tiên). */
const ALL_NCC = '*';
const ALL_NCC_LABEL = 'Tất cả';
function isAllNcc(){ return nccFilter === ALL_NCC; }
/* Mọi FORM đều phải ghi một NCC cụ thể — không ai lưu được dự án "Tất cả". */
function formNcc(){ return (!nccFilter || isAllNcc()) ? (NCCS[0] || '') : nccFilter; }

/* Ở chế độ Tất cả, trục giai đoạn chuyển sang NHÓM giai đoạn: Roquette gọi
   "SOLUTION TESTING" còn IFF gọi "TESTING", xếp cạnh nhau thành hai cột rời thì
   không so sánh được. Nhóm giai đoạn sinh ra đúng để làm việc này. */
function stageGroups(){
  const out = [], seen = {};
  NCCS.forEach(n => (PIPELINES[n]||[]).forEach(s => {
    const g = STAGE_GROUP[s] || s;
    if(!seen[g]){ seen[g] = 1; out.push(g); }
  }));
  return out;
}
function activeStages(){
  if(isAllNcc()) return stageGroups();
  return (nccFilter && PIPELINES[nccFilter]) || PIPELINES[NCCS[0]] || [];
}
/* So một dự án với một ô trên trục giai đoạn — theo nhóm khi đang xem Tất cả. */
function atStage(r, s){
  if(!s) return true;
  return isAllNcc() ? (STAGE_GROUP[r.stage] || r.stage) === s : r.stage === s;
}
const STAGE_GROUP = LISTS.groupOf;
const STAGE_PROB = LISTS.probOf;
const PROB_OPTS = [10,25,50,75,90,100];
const GRP_CLS = {'Tiếp cận':'p-sbg','Thử mẫu':'p-bas','Đàm phán':'p-oa','Hoãn':'p-prog'};
function stageCls(s){return GRP_CLS[STAGE_GROUP[s]]||'p-st';}
const STATUS_CLS = {'WON':'p-won','IN PROGRESS':'p-prog','LOST':'p-lost'};
const STATUS_VI = {'WON':'Thắng','IN PROGRESS':'Đang chạy','LOST':'Thua'};
const SEG_COLORS = ['#0B4F9E','#00838F','#F59E0B','#7C3AED','#0D9488','#DB2777','#B45309','#1D4ED8','#059669','#DC2626','#0E7490','#9333EA','#CA8A04'];
const GROUP_COLORS = {'BAKERY':'#B45309','SAVOURY':'#0B4F9E','SWEET':'#DB2777'};

let me=null, filter='ALL', related=[], collapsed={'sub-closed-lost':true}, NOTIFS=[], curRec=null, dRelated=[], probRecId=null, closeRecId=null, closeResult=null, INSIGHT=null, LC_DATA=[], stageFilter=null, nccFilter='', segDrill=null, actFilter='ALL', srcAct=null;
/* Ngày làm việc hiện tại, đọc từ đồng hồ máy rồi cắt về nửa đêm giờ địa phương
   để mọi phép so sánh ngày đều ổn định suốt phiên làm việc. */
const TODAY = (function(){ var d = new Date(); d.setHours(0,0,0,0); return d; })();

/* Tính ngay khi nạp xong file, đừng đợi tới lúc tải SharePoint — nếu không thì ô
   "Nhóm ngành" trong form rỗng dù cây segment đã có sẵn trong cấu hình.
   Phải đặt CUỐI FILE: rebuildDerived() đọc nccFilter, mà nccFilter khai bằng let
   ở trên — gọi sớm hơn sẽ rơi vào vùng chết và làm hỏng cả file. */
rebuildDerived();

