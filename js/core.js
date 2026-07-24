/* js/core.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== LOGIN ====== */
const roleRow = document.getElementById('roleRow');
function initials(n){return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
USERS.forEach((u,i)=>{
  const b=document.createElement('button'); b.className='role-btn';
  const badge = u.role==='superadmin' ? '<span class="badge-admin">SUPER ADMIN</span>' : u.role==='manager' ? '<span class="badge-mgr">MANAGER</span>' : '';
  b.innerHTML=`<span class="avatar" style="background:${u.color}">${initials(u.name)}</span><span><b>${u.name}</b><small>${u.email}</small></span>${badge}`;
  b.onclick=()=>loginAs(i); roleRow.appendChild(b);
});
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
  document.getElementById('nccTabs').innerHTML=NCCS.map(n=>
    `<button class="ncc-tab${n===nccFilter?' on':''}" data-ncc="${n}" onclick="setNcc('${n}')">${n}</button>`).join('');
  go('funnel'); buildForm(); buildUsers(); renderNotifs(); initAI();
}

/* ====== NAV ====== */
function go(v){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  ['funnel','acts','dash','users'].forEach(x=>document.getElementById('view-'+x).style.display = x===v?'block':'none');
  if(v==='funnel')render(); if(v==='dash')renderDash(); if(v==='acts')renderActs();
}

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
const MAJORS=[
  {id:'run', title:'ĐANG CHẠY', color:'#1E3A8A', subs:[
    {id:'overdue', title:'Quá hạn — cần xử lý', color:'var(--overdue)'},
    {id:'thisq', title:'Đóng trong quý này (Q3/2026)', color:'var(--prog)'},
    {id:'nextq', title:'Quý sau (Q4/2026)', color:'#B45309'},
    {id:'thisyear', title:'Còn lại trong 2026', color:'var(--sbg)'},
    {id:'later', title:'2027 trở đi', color:'var(--text-3)'},
  ]},
  {id:'closed', title:'ĐÃ ĐÓNG', color:'#565668', subs:[
    {id:'closed-won', title:'Thắng', color:'var(--won)'},
    {id:'closed-lost', title:'Thua', color:'var(--lost)'},
  ]},
];

