/* js/config.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */

let USERS = [
  {name:'Duy Che Ngoc', email:'duy.chengoc@fisaigon.vn', role:'superadmin', pic:null, color:'#1E3A8A'},
  {name:'Manager Demo', email:'manager@fisaigon.vn', role:'manager', pic:null, color:'#0E7490'},
  {name:'Thu', email:'thu@fisaigon.vn', role:'sales', pic:'Thu', color:'#0D9488'},
  {name:'Tam', email:'tam@fisaigon.vn', role:'sales', pic:'Tam', color:'#C2620A'},
];
const ALL_PICS = LISTS.pics;

const PIPELINES = LISTS.pipelines, SEG_TREE = LISTS.segTree, SEG_GROUPS = Object.keys(SEG_TREE);
const SEG2GROUP = {}; SEG_GROUPS.forEach(g=>SEG_TREE[g].forEach(s=>SEG2GROUP[s]=g));
const NCCS = LISTS.nccs;
function activeStages(){return nccFilter?(PIPELINES[nccFilter]||[]):PIPELINES[NCCS[0]];}
const STAGE_GROUP = LISTS.groupOf;
const STAGE_PROB = LISTS.probOf;
const PROB_OPTS = [10,25,50,75,90,100];
const GRP_CLS = {'Tiếp cận':'p-sbg','Thử mẫu':'p-bas','Đàm phán':'p-oa','Hoãn':'p-prog'};
function stageCls(s){return GRP_CLS[STAGE_GROUP[s]]||'p-st';}
const STATUS_CLS = {'WON':'p-won','IN PROGRESS':'p-prog','LOST':'p-lost'};
const STATUS_VI = {'WON':'Thắng','IN PROGRESS':'Đang chạy','LOST':'Thua'};
const SEG_COLORS = ['#0B4F9E','#00838F','#F59E0B','#7C3AED','#0D9488','#DB2777','#B45309','#1D4ED8','#059669','#DC2626','#0E7490','#9333EA','#CA8A04'];
const GROUP_COLORS = {'BAKERY':'#B45309','SAVOURY':'#0B4F9E','SWEET':'#DB2777'};

let me=null, filter='ALL', related=[], collapsed={'sub-closed-lost':true}, NOTIFS=[], curRec=null, dRelated=[], probRecId=null, closeRecId=null, closeResult=null, INSIGHT=null, LC_DATA=[], stageFilter=null, nccFilter='Roquette', segDrill=null, actFilter='ALL', srcAct=null;
const TODAY = new Date('2026-07-07');

