const ROLES = ROLE_ORDER.map(function(id){
  return { id:id, label:ROLE_DEF[id].label, hint:ROLE_DEF[id].hint };
});
const ROLE_COLOR = { sales:'#0D9488', rnd:'#B45309', manager:'#0E7490',
                     director:'#6D28D9', superadmin:'#1E3A8A', salesupport:'#0E9F6E' };

let admBusy = false;
function admEsc(s){ return ckEsc(s); }
function admCanWrite(){
  return !!(window.FISG_STORE && FISG_STORE.canWriteUsers && FISG_STORE.canWriteUsers());
}
function admListName(){
  return (window.FISG_STORE && FISG_STORE.usersListName) ? FISG_STORE.usersListName() : 'Users';
}

function buildUsers(){
  const tools = document.getElementById('admTools');
  if(tools){
    tools.innerHTML = myCap().admin
      ? `<button class="btn-primary" onclick="openUserForm()">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
           ${T('adm.addUser')}</button>`
      : '';
  }

  const note = document.getElementById('admNote');
  if(note){
    note.innerHTML = admCanWrite()
      ? ''
      : `<div class="ck-badge warn" style="margin-bottom:14px">
           ${T('adm.noList',{l:admEsc(admListName())})}
         </div>`;
  }

  const box = document.getElementById('userRows');
  if(!box) return;
  if(!USERS.length){
    box.innerHTML = `<div class="ck-empty">
      <b>${T('adm.empty')}</b>
      <p>${T('adm.emptyHint')}</p>
      ${myCap().admin ? '<button class="ck-chip" onclick="openUserForm()">'+T('adm.addUser')+'</button>' : ''}
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
        <span class="adm-nm">${admEsc(u.name || '—')}${self ? '<span class="adm-self">'+T('adm.you')+'</span>' : ''}
          <small>${admPicLine(u)}</small></span>
      </div>
      <div class="adm-mail">${admEsc(u.email)}</div>
      <div>${canEdit
        ? `<select class="ck-sel" aria-label="${T('adm.roleOf',{u:admEsc(u.name||u.email)})}"
             onchange="setRole(${idx}, this.value)">
             ${ROLES.map(r => `<option value="${r.id}"${r.id===u.role?' selected':''}>${r.label}</option>`).join('')}
           </select>`
        : `<span class="pill ${u.role==='superadmin'||u.role==='director'?'p-oa':u.role==='manager'?'p-sbg':'p-st'}">${roleVI(u.role)}</span>`}</div>
      <div class="adm-act">${canEdit ? `
        <button class="wc-btn" onclick="openUserForm(${idx})">${T('common.edit')}</button>
        ${self ? '' : `<button class="wc-btn danger" onclick="removeUser(${idx})">${T('common.delete')}</button>`}` : '—'}</div>
    </div>`;
  }).join('');

  if(window.FISG_CUSTOMER_IMPORT) try { FISG_CUSTOMER_IMPORT.render(); } catch(e){}
  if(window.FISG_SUPPLIER_IMPORT) try { FISG_SUPPLIER_IMPORT.render(); } catch(e){}
}
window.buildUsers = buildUsers;

function admPicLine(u){
  const al = splitAliases(u.picRaw).filter(function(x){
    return !u.fullName || picKey(x) !== picKey(u.fullName); });
  if(al.length && u.fullName)
    return T('adm.picAlias', { a: al.map(function(x){ return '"' + admEsc(x) + '"'; }).join(' · '), f: admEsc(u.fullName) });
  if(u.picRaw) return 'PIC: ' + admEsc(u.picRaw);
  if(u.fullName) return 'PIC: ' + admEsc(u.fullName) + ' ' + T('adm.byO365');
  return T('adm.picFromO365');
}

async function setRole(idx, role){
  const u = USERS[idx]; if(!u || admBusy) return;
  const self = me && (u.email||'').toLowerCase() === (me.email||'').toLowerCase();

  if(self && !cap(role).admin
     && !confirm(T('adm.confirmDemote',{r:roleVI(role)}))){
    buildUsers(); return;
  }
  const old = u.role;
  u.role = role;
  u.color = ROLE_COLOR[role] || u.color;
  await admPersist(u, T('adm.msg.roleChanged',{u:u.name||u.email,r:roleVI(role)}),
    function(){ u.role = old; });
  buildUsers();
}
window.setRole = setRole;

async function admPersist(u, okMsg, rollback){
  if(!admCanWrite()){
    toast(T('adm.msg.sessionOnly',{l:admListName()}));
    return false;
  }
  admBusy = true;
  try{
    await FISG_STORE.saveUser(u);
    toast(okMsg);
    return true;
  }catch(e){
    if(rollback) rollback();
    toast(T('sf.msg.saveFailed') + ' ' + (e.message || e));
    return false;
  }finally{
    admBusy = false;
  }
}

async function removeUser(idx){
  const u = USERS[idx]; if(!u) return;
  if(!confirm(T('adm.confirmRemove',{u:u.name || u.email}))) return;
  if(!admCanWrite()){ toast(T('adm.msg.cannotDelete',{l:admListName()})); return; }
  admBusy = true;
  try{
    await FISG_STORE.deleteUser(u);
    toast(T('adm.msg.removed',{u:u.name || u.email}));
  }catch(e){
    toast(T('att.delFail') + ' ' + (e.message || e));
  }finally{
    admBusy = false; buildUsers();
  }
}
window.removeUser = removeUser;

let admEditIdx = -1;

function openUserForm(idx){
  admEditIdx = (typeof idx === 'number') ? idx : -1;
  const u = admEditIdx >= 0 ? USERS[admEditIdx] : null;
  NAV.enter(); NAV.renderBack('u-back');

  document.getElementById('u-title').textContent = u ? T('adm.editUser') : T('adm.addUser');
  const mail = document.getElementById('u-mail');
  mail.value = u ? (u.email || '') : '';
  mail.disabled = !!u;
  document.getElementById('u-name').value = u ? (u.fullName || u.name || '') : '';
  document.getElementById('u-pic').value  = u ? (u.picRaw || '') : '';
  document.getElementById('u-role').innerHTML =
    ROLES.map(r => `<option value="${r.id}"${u && u.role===r.id?' selected':''}>${r.label}</option>`).join('');

  const leads = USERS.filter(x => cap(x.role).scope === 'all' || cap(x.role).lead);
  const rsel = document.getElementById('u-reports');
  if(rsel){
    rsel.innerHTML = '<option value="">— '+T('adm.allManagers')+' —</option>' +
      leads.map(l => `<option value="${admEsc(l.pic||l.name)}"${u && sameName(u.reportsTo, l.pic||l.name)?' selected':''}>${admEsc(l.name||l.pic)}</option>`).join('');
  }

  const sq = document.getElementById('u-spsearch'); if(sq) sq.value = '';
  admBuildSupports(u ? (u.supports||[]) : []);

  admRoleHint();
  document.getElementById('u-found').innerHTML = '';
  document.getElementById('uov').classList.add('open');
  document.getElementById(u ? 'u-pic' : 'u-mail').focus();
}

function admBuildSupports(picked){
  const box = document.getElementById('u-supports'); if(!box) return;
  const set = {}; const names = [];
  USERS.filter(x => x.role==='sales').forEach(x => { const n=x.pic||x.name; if(n){ set[picKey(n)]=1; names.push(n); } });
  (typeof LISTS!=='undefined'?LISTS.pics:[]).forEach(n => { if(n && !set[picKey(n)]){ set[picKey(n)]=1; names.push(n); } });
  names.sort((a,b)=>a.localeCompare(b,'vi'));
  const on = {}; (picked||[]).forEach(p => on[picKey(p)] = 1);

  box.innerHTML = names.map(n => {
    const sel = !!on[picKey(n)];
    return `<label class="u-sprow${sel?' on':''}" data-name="${admEsc(n)}">
      <input type="checkbox" value="${admEsc(n)}"${sel?' checked':''}
             onchange="this.closest('.u-sprow').classList.toggle('on',this.checked)">
      <span class="u-spname">${admEsc(n)}</span>
      <span class="u-spcheck" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
      </span></label>`;
  }).join('') || '<div class="u-spempty">'+T('adm.noReps')+'</div>';
}
window.openUserForm = openUserForm;

function closeUserForm(){
  NAV.back(function(){ document.getElementById('uov').classList.remove('open'); });
}
window.closeUserForm = closeUserForm;

function admRoleHint(){

  const r = document.getElementById('u-role').value;
  const sf = document.getElementById('u-supportsF');
  if(sf) sf.style.display = (r === 'salesupport') ? '' : 'none';
}
window.admRoleHint = admRoleHint;

function admFilterSupports(q){
  const s = (q||'').trim().toLowerCase();
  document.querySelectorAll('#u-supports .u-sprow').forEach(function(row){
    row.style.display = (!s || row.dataset.name.toLowerCase().indexOf(s) >= 0) ? '' : 'none';
  });
}
window.admFilterSupports = admFilterSupports;

async function lookupUserEmail(){
  const mail = document.getElementById('u-mail').value.trim();
  const box = document.getElementById('u-found');
  if(!mail){ box.innerHTML = '<span class="u-warn">'+T('adm.enterEmailFirst')+'</span>'; return; }
  box.innerHTML = '<span class="u-wait">'+T('adm.searching')+'</span>';
  let p = null;
  try{ p = await FISG_STORE.lookupUser(mail); }catch(e){}
  if(!p){
    box.innerHTML = `<span class="u-warn">${T('adm.notFoundO365',{m:admEsc(mail)})}</span>`;
    return;
  }
  document.getElementById('u-name').value = p.name;
  const m = (typeof picMatchReport === 'function') ? picMatchReport(p.name) : { ok:true };
  box.innerHTML = `<span class="u-ok">${T('adm.found',{n:admEsc(p.name)})}${p.title ? ' · ' + admEsc(p.title) : ''}.</span>`
    + (m.ok
        ? '<span class="u-ok">'+T('adm.picMatches')+'</span>'
        : `<span class="u-warn">${T('adm.noPicMatch',{n:admEsc(p.name)})}${m.near && m.near.length ? '. ' + T('adm.nearest',{x:admEsc(m.near.join(', '))}) : ''}. ${T('adm.fillPic')}</span>`);
}
window.lookupUserEmail = lookupUserEmail;

async function saveUserForm(){
  const g = function(id){ return document.getElementById(id).value.trim(); };
  const mail = g('u-mail').toLowerCase();
  if(!mail || mail.indexOf('@') < 0){ toast(T('adm.msg.invalidEmail')); return; }

  const dup = USERS.filter(function(x,i){
    return i !== admEditIdx && (x.email||'').toLowerCase() === mail; })[0];
  if(dup){ toast(T('adm.msg.dupEmail')); return; }

  const role = g('u-role');
  const reportsTo = g('u-reports') || null;

  const supports = role === 'salesupport'
    ? [...document.querySelectorAll('#u-supports input:checked')].map(x => x.value.trim()).filter(Boolean)
    : [];
  let u = admEditIdx >= 0 ? USERS[admEditIdx] : null;
  const before = u ? { name:u.name, pic:u.pic, picRaw:u.picRaw, fullName:u.fullName, role:u.role,
                       reportsTo:u.reportsTo, supports:u.supports } : null;
  const isNew = !u;
  const full = g('u-name'), picRaw = g('u-pic');
  if(isNew){
    u = { email: mail, name: full || mail, fullName: full || null,
          picRaw: picRaw || null, pic: picRaw || full || null,
          role: role, color: ROLE_COLOR[role] || '#0D9488',
          reportsTo: reportsTo, supports: supports };
    USERS.push(u);
  } else {
    u.fullName = full || null;
    u.picRaw   = picRaw || null;
    u.name     = full || u.email;
    u.pic      = picRaw || full || null;
    u.role     = role;
    u.color    = ROLE_COLOR[role] || u.color;
    u.reportsTo = reportsTo;
    u.supports = supports;
  }

  const ok = await admPersist(u, (isNew ? T('adm.msg.added',{u:u.name || u.email}) : T('adm.msg.updated',{u:u.name || u.email})),
    function(){
      if(before) Object.assign(u, before);
      else { const i = USERS.indexOf(u); if(i >= 0) USERS.splice(i,1); }
    });

  if(ok || !admCanWrite()) closeUserForm();
  buildUsers();
}
window.saveUserForm = saveUserForm;
