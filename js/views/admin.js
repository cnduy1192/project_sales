/* js/views/admin.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== USERS & ROLE MANAGEMENT ====== */
function setRole(email,role){
  const u=USERS.find(x=>x.email===email); if(!u)return;
  u.role=role; buildUsers();
  toast(`Đã đổi vai trò của ${u.name} thành ${roleVI(role)}.`);
}
function buildUsers(){
  document.getElementById('userRows').innerHTML = USERS.map(u=>{
    let act='—';
    if(u.role==='sales') act=`<button class="mini-btn up" onclick="setRole('${u.email}','manager')">↑ Nâng lên Manager</button>`;
    else if(u.role==='manager') act=`<button class="mini-btn down" onclick="setRole('${u.email}','sales')">↓ Hạ xuống Sales</button>`;
    return `<div class="row" style="grid-template-columns:2fr 2fr 1fr 1.2fr;cursor:default;padding-left:18px">
      <div class="r-pic"><span class="avatar" style="background:${u.color}">${initials(u.name)}</span><b>${u.name}</b></div>
      <div style="color:var(--text-2)">${u.email}</div>
      <div><span class="pill ${u.role==='superadmin'?'p-oa':u.role==='manager'?'p-sbg':'p-st'}">${roleVI(u.role)}</span></div>
      <div class="role-actions">${act}</div>
    </div>`}).join('');
}


