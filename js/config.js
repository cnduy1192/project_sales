let USERS = [];

const ALL_PICS = LISTS.pics;
const PIPELINES = LISTS.pipelines, SEG_TREE = LISTS.segTree;
let SEG_GROUPS = [];
const SEG2GROUP = {};
const NCCS = LISTS.nccs;

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

const ALL_NCC = '*';
const ALL_NCC_LABEL = 'Tất cả';
function isAllNcc(){ return nccFilter === ALL_NCC; }

function formNcc(){ return (!nccFilter || isAllNcc()) ? (NCCS[0] || '') : nccFilter; }

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

function supplierOptions(){
  var out = [], seen = {};
  function add(n){ var k = String(n == null ? '' : n).trim(); if(!k) return;
    var u = k.toUpperCase(); if(!seen[u]){ seen[u] = 1; out.push(k); } }
  (NCCS || []).forEach(add);
  var mainCount = out.length;
  (typeof SUPPLIERS !== 'undefined' ? SUPPLIERS : []).forEach(add);
  var rest = out.slice(mainCount).sort(function(a,b){ return a.localeCompare(b,'vi'); });
  return out.slice(0, mainCount).concat(rest);
}

var DEFAULT_PIPELINE = ['LEAD','SAMPLE SENT','TESTING','TEST PASSED','QUOTED / PO'];
function pipelineOf(ncc){
  return (ncc && PIPELINES[ncc] && PIPELINES[ncc].length) ? PIPELINES[ncc] : DEFAULT_PIPELINE;
}
window.supplierOptions = supplierOptions; window.pipelineOf = pipelineOf;

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

const TODAY = (function(){ var d = new Date(); d.setHours(0,0,0,0); return d; })();

rebuildDerived();

