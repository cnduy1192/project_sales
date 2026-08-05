/* js/core.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== LOGIN ====== */
/* Không còn nút đăng nhập nhanh theo vai trò: mọi tài khoản đến từ Microsoft 365
   và phân quyền đọc từ list Users trên SharePoint. */
const roleRow = document.getElementById('roleRow');
function initials(n){return String(n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
function roleVI(r){return roleLabel(r);}
function loginAs(i){
  me=USERS[i];
  document.getElementById('login').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('sideUser').innerHTML=`<span class="avatar" style="background:${me.color}">${initials(me.name)}</span><span><b>${me.name}</b><small>${roleVI(me.role)}</small></span>`;
  document.getElementById('hiName').innerHTML=`Xin chào, ${me.name}<small>${roleVI(me.role)} · FI SAIGON JSC</small>`;
  const av=document.getElementById('hAvatar'); av.textContent=initials(me.name); av.style.background=me.color;
  /* Mọi thứ hỏi bảng năng lực, không so tên vai trò — xem js/lib/roles.js. */
  const c = myCap();
  document.getElementById('navAdminLabel').style.display = c.admin?'block':'none';
  document.getElementById('navUsers').style.display = c.admin?'flex':'none';
  document.getElementById('navCockpitLabel').style.display = c.cockpit?'block':'none';
  document.getElementById('navCockpit').style.display = c.cockpit?'flex':'none';
  document.getElementById('navWelcome').style.display = c.weekly?'flex':'none';
  rebuildNccTabs();
  /* Tổng quan tuần là góc nhìn của một sales; manager/admin mở tay được ở chế độ chỉ đọc. */
  LS.reset(); LS.mergeActs(); NAV.clear();
  go(c.cockpit?'cockpit':'funnel'); buildForm(); buildUsers(); renderNotifs();
  if(c.weeklyAuto) wcMaybeAutoOpen();
}

/* Tab NCC dựng lại được: lúc đăng nhập danh mục còn rỗng, dữ liệu SharePoint về sau. */
function rebuildNccTabs(){
  const box=document.getElementById('nccTabs'); if(!box)return;
  box.innerHTML=`<button class="ncc-tab ncc-tab-all${isAllNcc()?' on':''}" data-ncc="${ALL_NCC}" onclick="setNcc('${ALL_NCC}')" title="Xem dự án và hoạt động của mọi nhà cung cấp">${ALL_NCC_LABEL}</button>`
    +NCCS.map(n=>
    `<button class="ncc-tab${n===nccFilter?' on':''}" data-ncc="${n.replace(/"/g,'&quot;')}" onclick="setNcc('${n.replace(/'/g,"\\'")}')">${n}</button>`).join('');
}
window.rebuildNccTabs=rebuildNccTabs;

/* ====== NAV ====== */
const VIEWS=['cockpit','funnel','customers','acts','dash','reports','users'];
function go(v){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  VIEWS.forEach(x=>document.getElementById('view-'+x).style.display = x===v?'block':'none');
  /* Cockpit và Danh bạ khách hàng gộp cả ba NCC nên tab NCC ở header gây hiểu
     nhầm — ẩn khi vào các view này. */
  const tabs=document.getElementById('nccTabs');
  if(tabs) tabs.style.display = (v==='cockpit'||v==='customers') ? 'none' : '';
  if(v==='cockpit')renderCockpit();
  if(v==='reports')renderReports();
  if(v==='customers'&&window.renderCustomers)renderCustomers();
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
function inScope(r){return !nccFilter || isAllNcc() || r.ncc===nccFilter;}
function visible(){
  return scopeRecords(RECORDS.filter(inScope), me);
}
function visibleActs(){
  const other = (typeof OTHER_NCC !== 'undefined') ? OTHER_NCC : 'Khác';
  const base=ACTIVITIES.filter(a=>!nccFilter||isAllNcc()||a.ncc===nccFilter||a.ncc===other);
  return scopeActs(base, me, scopeRecords(RECORDS, me));
}
function setNcc(n){nccFilter=n;stageFilter=null;segDrill=null;
  if(typeof donutSegDrill!=='undefined')donutSegDrill=null;
  document.querySelectorAll('.ncc-tab').forEach(t=>t.classList.toggle('on',t.dataset.ncc===n));
  render();renderDash();renderActs();}
function canEdit(r){ return capEdit(r, me); }
function canClose(r){ return capClose(r, me); }

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

