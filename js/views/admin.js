/* js/views/admin.js — Người dùng & phân quyền.
   Đây là nơi duy nhất người quản trị chạm vào phân quyền, nên mọi thay đổi phải
   đi thẳng lên list Users trên SharePoint. Không ghi được thì phải nói ra chứ
   không âm thầm sửa trong bộ nhớ rồi mất khi tải lại. */

/* Danh sách vai trò lấy thẳng từ bảng năng lực — thêm vai trò chỉ sửa roles.js. */
const ROLES = ROLE_ORDER.map(function(id){
  return { id:id, label:ROLE_DEF[id].label, hint:ROLE_DEF[id].hint };
});
const ROLE_COLOR = { sales:'#0D9488', rnd:'#B45309', manager:'#0E7490',
                     director:'#6D28D9', superadmin:'#1E3A8A' };

let admBusy = false;
function admEsc(s){ return ckEsc(s); }
function admCanWrite(){
  return !!(window.FISG_STORE && FISG_STORE.canWriteUsers && FISG_STORE.canWriteUsers());
}
function admListName(){
  return (window.FISG_STORE && FISG_STORE.usersListName) ? FISG_STORE.usersListName() : 'Users';
}

/* ====== BẢNG ====== */
function buildUsers(){
  const tools = document.getElementById('admTools');
  if(tools){
    tools.innerHTML = myCap().admin
      ? `<button class="btn-primary" onclick="openUserForm()">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
           Thêm người dùng</button>`
      : '';
  }

  const note = document.getElementById('admNote');
  if(note){
    note.innerHTML = admCanWrite()
      ? ''
      : `<div class="ck-badge warn" style="margin-bottom:14px">
           Chưa đọc được list <b>${admEsc(admListName())}</b> trên SharePoint — thay đổi ở đây
           sẽ mất khi tải lại trang. Tạo list rồi đăng nhập lại để lưu được.
         </div>`;
  }

  const box = document.getElementById('userRows');
  if(!box) return;
  if(!USERS.length){
    box.innerHTML = `<div class="ck-empty">
      <b>Chưa có người dùng nào</b>
      <p>Thêm người đầu tiên để phân quyền cho đội.</p>
      ${myCap().admin ? '<button class="ck-chip" onclick="openUserForm()">Thêm người dùng</button>' : ''}
    </div>`;
    return;
  }

  const canEdit = myCap().admin;
  const order = {}; ROLE_ORDER.slice().reverse().forEach(function(id,i){ order[id]=i; });
  const list = USERS.slice().sort((a,b) =>
    ((order[a.role]===undefined?9:order[a.role]) - (order[b.role]===undefined?9:order[b.role]))
    || String(a.name||'').localeCompare(String(b.name||''),'vi'));

  box.innerHTML = list.map(u => {
    const self = me && (u.email||'').toLowerCase() === (me.email||'').toLowerCase();
    const idx = USERS.indexOf(u);
    return `<div class="adm-row">
      <div class="adm-who">
        <span class="avatar" style="background:${ROLE_COLOR[u.role]||'#8A90A4'}">${admEsc(initials(u.name||u.email))}</span>
        <span class="adm-nm">${admEsc(u.name || '—')}${self ? '<span class="adm-self">bạn</span>' : ''}
          <small>${admPicLine(u)}</small></span>
      </div>
      <div class="adm-mail">${admEsc(u.email)}</div>
      <div>${canEdit
        ? `<select class="ck-sel" aria-label="Vai trò của ${admEsc(u.name||u.email)}"
             onchange="setRole(${idx}, this.value)">
             ${ROLES.map(r => `<option value="${r.id}"${r.id===u.role?' selected':''}>${r.label}</option>`).join('')}
           </select>`
        : `<span class="pill ${u.role==='superadmin'||u.role==='director'?'p-oa':u.role==='manager'?'p-sbg':'p-st'}">${roleVI(u.role)}</span>`}</div>
      <div class="adm-act">${canEdit ? `
        <button class="wc-btn" onclick="openUserForm(${idx})">Sửa</button>
        ${self ? '' : `<button class="wc-btn danger" onclick="removeUser(${idx})">Xoá</button>`}` : '—'}</div>
    </div>`;
  }).join('');
}
window.buildUsers = buildUsers;

/* Dòng phụ dưới tên: nói rõ đang đổi tên nào thành tên nào. */
function admPicLine(u){
  if(u.picRaw && u.fullName && picKey(u.picRaw) !== picKey(u.fullName))
    return 'Dữ liệu ghi "' + admEsc(u.picRaw) + '" → hiển thị "' + admEsc(u.fullName) + '"';
  if(u.picRaw) return 'PIC: ' + admEsc(u.picRaw);
  if(u.fullName) return 'PIC: ' + admEsc(u.fullName) + ' (theo tên O365)';
  return 'PIC lấy theo tên O365 khi đăng nhập';
}

/* ====== ĐỔI VAI TRÒ NGAY TRÊN BẢNG ====== */
async function setRole(idx, role){
  const u = USERS[idx]; if(!u || admBusy) return;
  const self = me && (u.email||'').toLowerCase() === (me.email||'').toLowerCase();
  /* Tự hạ quyền chính mình là đường một chiều: mất luôn màn hình này. */
  if(self && !cap(role).admin
     && !confirm('Bạn đang tự hạ quyền của mình xuống ' + roleVI(role)
                 + '. Sau khi lưu bạn sẽ không vào được màn hình phân quyền nữa. Tiếp tục?')){
    buildUsers(); return;
  }
  const old = u.role;
  u.role = role;
  u.color = ROLE_COLOR[role] || u.color;
  await admPersist(u, 'Đã đổi vai trò của ' + (u.name||u.email) + ' thành ' + roleVI(role) + '.',
    function(){ u.role = old; });
  buildUsers();
}
window.setRole = setRole;

/* Ghi lên SharePoint; hỏng thì hoàn tác trong bộ nhớ để màn hình không nói dối. */
async function admPersist(u, okMsg, rollback){
  if(!admCanWrite()){
    toast('Chưa nối được list ' + admListName() + ' — thay đổi chỉ nằm trong phiên này.');
    return false;
  }
  admBusy = true;
  try{
    await FISG_STORE.saveUser(u);
    toast(okMsg);
    return true;
  }catch(e){
    if(rollback) rollback();
    toast('Không lưu được lên SharePoint: ' + (e.message || e));
    return false;
  }finally{
    admBusy = false;
  }
}

/* ====== XOÁ ====== */
async function removeUser(idx){
  const u = USERS[idx]; if(!u) return;
  if(!confirm('Xoá ' + (u.name || u.email) + ' khỏi danh sách phân quyền?\n\n'
              + 'Người này sẽ không đăng nhập được nữa. Dự án và hoạt động của họ vẫn giữ nguyên.')) return;
  if(!admCanWrite()){ toast('Chưa nối được list ' + admListName() + ' — không xoá được.'); return; }
  admBusy = true;
  try{
    await FISG_STORE.deleteUser(u);
    toast('Đã xoá ' + (u.name || u.email) + '.');
  }catch(e){
    toast('Không xoá được: ' + (e.message || e));
  }finally{
    admBusy = false; buildUsers();
  }
}
window.removeUser = removeUser;

/* ====== FORM THÊM / SỬA ====== */
let admEditIdx = -1;

function openUserForm(idx){
  admEditIdx = (typeof idx === 'number') ? idx : -1;
  const u = admEditIdx >= 0 ? USERS[admEditIdx] : null;
  NAV.enter(); NAV.renderBack('u-back');

  document.getElementById('u-title').textContent = u ? 'Sửa người dùng' : 'Thêm người dùng';
  const mail = document.getElementById('u-mail');
  mail.value = u ? (u.email || '') : '';
  mail.disabled = !!u;                 // email là khoá đối chiếu, không sửa
  document.getElementById('u-name').value = u ? (u.fullName || u.name || '') : '';
  document.getElementById('u-pic').value  = u ? (u.picRaw || '') : '';
  document.getElementById('u-role').innerHTML =
    ROLES.map(r => `<option value="${r.id}"${u && u.role===r.id?' selected':''}>${r.label}</option>`).join('');
  admRoleHint();
  document.getElementById('u-found').innerHTML = '';
  document.getElementById('uov').classList.add('open');
  document.getElementById(u ? 'u-pic' : 'u-mail').focus();
}
window.openUserForm = openUserForm;

function closeUserForm(){
  NAV.back(function(){ document.getElementById('uov').classList.remove('open'); });
}
window.closeUserForm = closeUserForm;

function admRoleHint(){
  const r = document.getElementById('u-role').value;
  const hit = ROLES.filter(function(x){ return x.id === r; })[0];
  document.getElementById('u-roleHint').textContent = hit ? hit.hint : '';
}
window.admRoleHint = admRoleHint;

/* Tra O365 theo email. Tên hiển thị lấy về CHÍNH LÀ giá trị mà cột PIC (kiểu
   Person) trong list Projects trả về — nên điền thẳng vào PICName là khớp. */
async function lookupUserEmail(){
  const mail = document.getElementById('u-mail').value.trim();
  const box = document.getElementById('u-found');
  if(!mail){ box.innerHTML = '<span class="u-warn">Nhập email trước đã.</span>'; return; }
  box.innerHTML = '<span class="u-wait">Đang tìm trên Microsoft 365…</span>';
  let p = null;
  try{ p = await FISG_STORE.lookupUser(mail); }catch(e){}
  if(!p){
    box.innerHTML = `<span class="u-warn">Không tìm thấy <b>${admEsc(mail)}</b> trên O365.
      Vẫn thêm được, nhưng hãy tự điền tên PIC cho khớp cột PIC trong dữ liệu.</span>`;
    return;
  }
  document.getElementById('u-name').value = p.name;
  const m = (typeof picMatchReport === 'function') ? picMatchReport(p.name) : { ok:true };
  box.innerHTML = `<span class="u-ok">Tìm thấy <b>${admEsc(p.name)}</b>${p.title ? ' · ' + admEsc(p.title) : ''}.</span>`
    + (m.ok
        ? '<span class="u-ok">Tên này khớp cột PIC trong dữ liệu — để trống ô PIC bên dưới.</span>'
        : `<span class="u-warn">Chưa có dự án nào ghi PIC là "${admEsc(p.name)}"${
            m.near && m.near.length ? '. Gần nhất: <b>' + admEsc(m.near.join(', ')) + '</b>' : ''
          }. Điền tên như nó nằm trong dữ liệu vào ô PIC bên dưới — app sẽ tự đổi sang tên đầy đủ khi hiển thị.</span>`);
}
window.lookupUserEmail = lookupUserEmail;

async function saveUserForm(){
  const g = function(id){ return document.getElementById(id).value.trim(); };
  const mail = g('u-mail').toLowerCase();
  if(!mail || mail.indexOf('@') < 0){ toast('Nhập email Microsoft 365 hợp lệ.'); return; }

  const dup = USERS.filter(function(x,i){
    return i !== admEditIdx && (x.email||'').toLowerCase() === mail; })[0];
  if(dup){ toast('Email này đã có trong danh sách.'); return; }

  const role = g('u-role');
  let u = admEditIdx >= 0 ? USERS[admEditIdx] : null;
  const before = u ? { name:u.name, pic:u.pic, picRaw:u.picRaw, fullName:u.fullName, role:u.role } : null;
  const isNew = !u;
  const full = g('u-name'), picRaw = g('u-pic');
  if(isNew){
    u = { email: mail, name: full || mail, fullName: full || null,
          picRaw: picRaw || null, pic: picRaw || full || null,
          role: role, color: ROLE_COLOR[role] || '#0D9488' };
    USERS.push(u);
  } else {
    u.fullName = full || null;
    u.picRaw   = picRaw || null;
    u.name     = full || u.email;
    u.pic      = picRaw || full || null;
    u.role     = role;
    u.color    = ROLE_COLOR[role] || u.color;
  }

  const ok = await admPersist(u, (isNew ? 'Đã thêm ' : 'Đã cập nhật ') + (u.name || u.email) + '.',
    function(){
      if(before) Object.assign(u, before);
      else { const i = USERS.indexOf(u); if(i >= 0) USERS.splice(i,1); }
    });

  if(ok || !admCanWrite()) closeUserForm();
  buildUsers();
}
window.saveUserForm = saveUserForm;
