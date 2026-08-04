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

function rebuildDerived(){
  SEG_GROUPS = Object.keys(SEG_TREE);
  Object.keys(SEG2GROUP).forEach(k => delete SEG2GROUP[k]);
  SEG_GROUPS.forEach(g => (SEG_TREE[g]||[]).forEach(s => SEG2GROUP[s] = g));
  /* NCC đang lọc phải nằm trong danh sách thật, nếu không mọi bảng đều trống. */
  if(NCCS.length && NCCS.indexOf(nccFilter) < 0) nccFilter = NCCS[0];
  return { groups: SEG_GROUPS.length, nccs: NCCS.length };
}
window.rebuildDerived = rebuildDerived;
function activeStages(){return (nccFilter && PIPELINES[nccFilter]) || PIPELINES[NCCS[0]] || [];}
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

