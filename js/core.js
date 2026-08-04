/* js/core.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== LOGIN ====== */
/* Không còn nút đăng nhập nhanh theo vai trò: mọi tài khoản đến từ Microsoft 365
   và phân quyền đọc từ list Users trên SharePoint. */
const roleRow = document.getElementById('roleRow');
function initials(n){return String(n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
function roleVI(r){return r==='superadmin'?'Super Admin':r==='manager'?'Manager':'Sales'}
function loginAs(i){
  me=USERS[i];
  document.getElementById('login').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('sideUser').innerHTML=`<span class="avatar" style="background:${me.color}">${initials(me.name)}</span><span><b>${me.name}</b><small>${roleVI(me.role)}</small></span>`;
  document.getElementById('hiName').innerHTML=`Xin chào, ${me.name}<small>${roleVI(me.role)} · FI SAIGON JSC</small>`;
  const av=document.getElementById('hAvatar'); av.textContent=initials(me.name); av.style.background=me.color;
  const isAdmin = me.role==='superadmin';
  document.getElementById('navAdminLabel').style.display = isAdmin?'block':'none';
  document.getElementById('navUsers').style.display = isAdmin?'flex':'none';
  /* Tổng quan điều hành là góc nhìn toàn đội — sales không có việc gì ở đó. */
  const isLead = me.role==='manager' || isAdmin;
  document.getElementById('navCockpitLabel').style.display = isLead?'block':'none';
  document.getElementById('navCockpit').style.display = isLead?'flex':'none';
  rebuildNccTabs();
  /* Tổng quan tuần là góc nhìn của một sales; manager/admin mở tay được ở chế độ chỉ đọc. */
  LS.reset(); LS.mergeActs(); NAV.clear();
  go(isLead?'cockpit':'funnel'); buildForm(); buildUsers(); renderNotifs();
  if(me.role==='sales') wcMaybeAutoOpen();
}

/* Tab NCC dựng lại được: lúc đăng nhập danh mục còn rỗng, dữ liệu SharePoint về sau. */
function rebuildNccTabs(){
  const box=document.getElementById('nccTabs'); if(!box)return;
  box.innerHTML=NCCS.map(n=>
    `<button class="ncc-tab${n===nccFilter?' on':''}" data-ncc="${n.replace(/"/g,'&quot;')}" onclick="setNcc('${n.replace(/'/g,"\\'")}')">${n}</button>`).join('');
}
window.rebuildNccTabs=rebuildNccTabs;

/* ====== NAV ====== */
const VIEWS=['cockpit','funnel','acts','dash','reports','users'];
function go(v){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  VIEWS.forEach(x=>document.getElementById('view-'+x).style.display = x===v?'block':'none');
  /* Cockpit gộp cả ba NCC nên tab NCC ở header sẽ gây hiểu nhầm — ẩn khi vào view này. */
  const tabs=document.getElementById('nccTabs');
  if(tabs) tabs.style.display = v==='cockpit' ? 'none' : '';
  if(v==='cockpit')renderCockpit();
  if(v==='reports')renderReports();
  if(v==='funnel')render(); if(v==='dash')renderDash(); if(v==='acts')renderActs();
}

/* ====== SIDEBAR EXPAND / COLLAPSE ====== */
function toggleSidebar(force){
  const shell=document.querySelector('.shell'); if(!shell)return;
  const min = typeof force==='boolean' ? force : !shell.classList.contains('side-min');
  shell.classList.toggle('side-min',min);
  const btn=document.getElementById('sideToggle');
  if(btn){
    btn.setAttribute('aria-expanded',String(!min));
    btn.setAttribute('aria-label',min?'Mở rộng thanh điều hướng':'Thu gọn thanh điều hướng');
  }
  try{localStorage.setItem('fisg_side',min?'min':'full');}catch(e){}
  /* Chart.js canvases must re-measure once the grid column finishes animating. */
  setTimeout(()=>{
    if(typeof CHARTS==='undefined')return;
    Object.keys(CHARTS).forEach(k=>{try{CHARTS[k].resize();}catch(e){}});
  },400);
}
window.toggleSidebar=toggleSidebar;
(function(){
  let saved=null; try{saved=localStorage.getItem('fisg_side');}catch(e){}
  if(saved!=='min')return;
  const apply=()=>toggleSidebar(true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply); else apply();
})();

/* ====== VISIBILITY ====== */
function inScope(r){return !nccFilter || r.ncc===nccFilter;}
function visible(){
  const base=RECORDS.filter(inScope);
  if(me.role!=='sales') return base;
  return base.filter(r=> r.pic===me.pic || r.related.includes(me.pic));
}
function visibleActs(){
  const base=ACTIVITIES.filter(a=>!nccFilter||a.ncc===nccFilter);
  if(me.role!=='sales') return base;
  return base.filter(a=>a.pic===me.pic);
}
function setNcc(n){nccFilter=n;stageFilter=null;segDrill=null;
  if(typeof donutSegDrill!=='undefined')donutSegDrill=null;
  document.querySelectorAll('.ncc-tab').forEach(t=>t.classList.toggle('on',t.dataset.ncc===n));
  render();renderDash();renderActs();}
function canEdit(r){return me.role==='superadmin' || (me.pic && (r.pic===me.pic || r.related.includes(me.pic)));}
function canClose(r){return r.status==='IN PROGRESS' && (me.role==='superadmin' || me.role==='manager' || (me.pic && r.pic===me.pic));}

/* ====== TIMELINE SUB-GROUPS (theo Closing Date) ====== */
function grp(r){
  if(r.status!=='IN PROGRESS') return r.status==='WON' ? 'closed-won':'closed-lost';
  if(!r.closing) return 'later';
  const d=new Date(r.closing);
  if(d<TODAY) return 'overdue';
  const q=Math.floor(TODAY.getMonth()/3), y=TODAY.getFullYear();
  const rq=Math.floor(d.getMonth()/3), ry=d.getFullYear();
  if(ry===y&&rq===q) return 'thisq';
  if((ry===y&&rq===q+1)||(q===3&&ry===y+1&&rq===0)) return 'nextq';
  if(ry===y) return 'thisyear';
  return 'later';
}
/* Nhãn quý/năm suy từ TODAY — trước đây ghi cứng Q3/2026 nên sang quý là sai. */
const _Q = Math.floor(TODAY.getMonth()/3)+1, _Y = TODAY.getFullYear();
const _NQ = _Q===4 ? {q:1,y:_Y+1} : {q:_Q+1,y:_Y};
const MAJORS=[
  {id:'run', title:'ĐANG CHẠY', color:'#1E3A8A', subs:[
    {id:'overdue', title:'Quá hạn — cần xử lý', color:'var(--overdue)'},
    {id:'thisq', title:'Đóng trong quý này (Q'+_Q+'/'+_Y+')', color:'var(--prog)'},
    {id:'nextq', title:'Quý sau (Q'+_NQ.q+'/'+_NQ.y+')', color:'#B45309'},
    {id:'thisyear', title:'Còn lại trong '+_Y, color:'var(--sbg)'},
    {id:'later', title:(_Y+1)+' trở đi', color:'var(--text-3)'},
  ]},
  {id:'closed', title:'ĐÃ ĐÓNG', color:'#565668', subs:[
    {id:'closed-won', title:'Thắng', color:'var(--won)'},
    {id:'closed-lost', title:'Thua', color:'var(--lost)'},
  ]},
];

