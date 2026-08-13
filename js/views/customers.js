let cuFilterOwner = '';
let cuQuery = '';

function cuCanSeeAll(){ return !!(me && (typeof canViewAll==='function' ? canViewAll(me) : cap(me.role).scope === 'all')); }

function cuStats(){
  const key = (typeof custOwnerKey === 'function') ? custOwnerKey
            : (s => String(s||'').trim().toUpperCase());
  const m = {};
  const slot = k => (m[k] = m[k] || { open:0, total:0, lastTouch:null, nccs:new Set() });
  (typeof RECORDS !== 'undefined' ? RECORDS : []).forEach(r => {
    const s = slot(key(r.customer));
    s.total++; if(r.status === 'IN PROGRESS') s.open++;
    if(r.ncc) s.nccs.add(r.ncc);
    const d = normDate(r.created);
    if(d && (!s.lastTouch || d > s.lastTouch)) s.lastTouch = d;
  });
  (typeof ACTIVITIES !== 'undefined' ? ACTIVITIES : []).forEach(a => {
    const s = slot(key(a.customer));
    const d = normDate(a.date);
    if(d && d <= todayISO() && (!s.lastTouch || d > s.lastTouch)) s.lastTouch = d;
    if(a.ncc) s.nccs.add(a.ncc);
  });
  return { m, key };
}

function cuMine(c){
  return typeof ownsCustomer === 'function' && ownsCustomer(c.name || c, me);
}

function cuUnowned(c){ return !String(c.owner||'').trim(); }

function cuRows(){
  const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
  const q = cuQuery.trim().toLowerCase();
  const seeAll = cuCanSeeAll();
  return dir.filter(c => {
    if(q){
      const hay = (c.name + ' ' + (c.legal||'') + ' ' + (c.owner||'')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
      if(seeAll && cuFilterOwner && picKey(c.owner) !== picKey(cuFilterOwner)) return false;
      return true;
    }
    if(!seeAll) return cuMine(c);
    if(cuFilterOwner) return picKey(c.owner) === picKey(cuFilterOwner);
    return true;
  }).sort((a,b) => custLabel(a.name).localeCompare(custLabel(b.name), 'vi'));
}

function renderCustomers(){
  const rows = cuRows();
  cuRenderTools(rows.length);
  cuRenderRows();
}
window.renderCustomers = renderCustomers;

function cuRenderRows(){
  const box = document.getElementById('cuRows');
  if(!box) return;
  const { m, key } = cuStats();
  const rows = cuRows();
  const cnt = document.querySelector('#cuTools .cu-count');
  if(cnt) cnt.textContent = rows.length + ' khách hàng';

  if(!rows.length){
    const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
    box.innerHTML = `<div class="cu-empty">
      <b>${dir.length ? 'Không có khách hàng khớp bộ lọc' : 'Danh bạ khách hàng đang trống'}</b>
      <p>${dir.length
        ? 'Thử bỏ bớt bộ lọc hoặc ô tìm kiếm.'
        : 'Nhập list Customers trên SharePoint (kèm cột Người phụ trách) để danh bạ hiện ở đây. Xem docs/SharePoint_Setup.md.'}</p>
    </div>`;
    return;
  }

  const seeAll = cuCanSeeAll();
  box.innerHTML = rows.map(c => {
    const s = m[key(c.name)] || { open:0, total:0, lastTouch:null, nccs:new Set() };

    const touch = s.lastTouch ? cuTouch(s.lastTouch) : { text:'', cls:'' };
    const legal = c.legal && custOwnerKey(c.legal) !== custOwnerKey(c.name)
      ? `<span class="cu-legal">${ckEsc(c.legal)}</span>` : '';
    const mine = seeAll || cuMine(c);
    const free = cuUnowned(c);

    const canAct = mine || free;

    let ownerCell;
    if(seeAll) ownerCell = picLabel(c.owner) ? ckEsc(picLabel(c.owner)) : '<span class="cu-dash">—</span>';
    else if(mine) ownerCell = '<span class="cu-dash">—</span>';
    else if(free) ownerCell = '<span class="cu-tag cu-tag-free">Chưa ai quản lý</span>';
    else ownerCell = `<span class="cu-tag"><span>Phụ trách:</span> ${ckEsc(picLabel(c.owner)||'—')}</span>`;

    const actCell = canAct
      ? `<button class="cu-btn" onclick="cuNewProject('${ckAttr(c.name)}')">+ Dự án</button>
         <button class="cu-btn ghost" onclick="cuNewAct('${ckAttr(c.name)}')">Ghi hoạt động</button>`
      : `<span class="cu-foreign">Khách của sales khác</span>`;

    return `<div class="cu-row">
      <button class="cu-name" onclick="cuOpenEdit('${ckAttr(c.name)}')" title="Xem & sửa thông tin khách hàng">
        <b>${ckEsc(custLabel(c.name))}</b>${legal}
      </button>
      <div class="cu-owner">${ownerCell}</div>
      <div class="cu-num">${s.open
        ? `<span class="cu-pill"><b>${s.open}</b><em>đang chạy</em></span>`
        : '<span class="cu-zero">0</span>'}</div>
      <div class="cu-touch ${touch.cls}">${touch.text
        ? `<span class="cu-chip">${touch.text}</span>`
        : '<span class="cu-dash">—</span>'}</div>
      <div class="cu-act">${actCell}</div>
    </div>`;
  }).join('');
}
window.cuRenderRows = cuRenderRows;

function cuCanEdit(entry){
  if(!me) return false;
  if(myCap().admin) return true;
  return typeof ownsCustomer === 'function' && ownsCustomer(entry && entry.name ? entry.name : entry, me);
}

function cuCanDelete(entry){
  if(!me || !entry) return false;
  if(!cap(me.role).del) return false;
  return cuCanEdit(entry);
}

function cuTouch(iso){
  const d = daysSince(iso);
  if(d <= 7)  return { text:ckVN(iso), cls:'cu-quiet-ok' };
  if(d <= 30) return { text:d + ' ngày trước', cls:'cu-quiet-mid' };
  return { text:d + ' ngày trước', cls:'cu-quiet-old' };
}

function cuRenderTools(count){
  const box = document.getElementById('cuTools');
  if(!box) return;
  let ownerSel = '';
  if(cuCanSeeAll()){
    const owners = Array.from(new Set(
      (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : [])
        .map(c => c.owner).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'vi'));
    ownerSel = `<select class="cu-sel" aria-label="Lọc theo sales" onchange="cuSetOwner(this.value)">
      <option value="">Tất cả sales</option>
      ${owners.map(o => `<option value="${ckEsc(o)}"${picKey(cuFilterOwner)===picKey(o)?' selected':''}>${ckEsc(picLabel(o))}</option>`).join('')}
    </select>`;
  }
  const addBtn = (window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite())
    ? `<button class="btn-primary cu-add" onclick="cuOpenEdit()">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
         Thêm khách hàng</button>` : '';
  box.innerHTML = `${addBtn}${ownerSel}
    <div class="cu-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="text" placeholder="Tìm khách hàng" value="${ckEsc(cuQuery)}" oninput="cuSetQuery(this.value)" aria-label="Tìm khách hàng">
    </div>
    <span class="cu-count">${count} khách hàng</span>`;
}

function cuSetOwner(v){ cuFilterOwner = v; renderCustomers(); }
function cuSetQuery(v){
  cuQuery = v;

  cuRenderRows();
}
window.cuSetOwner = cuSetOwner; window.cuSetQuery = cuSetQuery;

let cuEditName = null;

function cuFind(name){
  const key = (typeof custOwnerKey === 'function') ? custOwnerKey
            : (s => String(s||'').trim().toUpperCase());
  const k = key(name);
  return (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []).find(c => key(c.name) === k) || null;
}

function cuDefaultOwner(){
  if(!me) return '';
  const c = (typeof cap==='function') ? cap(me.role) : {};
  const sup = (typeof supportsList==='function') ? supportsList(me) : [];
  if(c.scope === 'support' && sup.length === 1) return sup[0];
  return me.pic || me.name || '';
}
window.cuDefaultOwner = cuDefaultOwner;

function cuReadOwner(){
  const el = document.getElementById('cuf-owner');
  if(!el) return '';
  if(el.tagName === 'SELECT' || el.tagName === 'INPUT') return (el.value||'').trim();
  return (el.dataset && el.dataset.val) || '';
}

function cuOpenEdit(name){
  const entry = name ? cuFind(name) : null;
  const isNew = !entry;
  cuEditName = entry ? entry.name : null;
  const canEdit = isNew ? true : cuCanEdit(entry);

  let ov = document.getElementById('cuEditOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cuEditOv'; ov.className = 'cu-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) cuCloseEdit(); });
  }

  const related = '';

  const canDel = !isNew && cuCanDelete(entry);
  const v = entry || { name:'', legal:'', owner:cuDefaultOwner(), segment:'', region:'', status:'' };
  const ownerName = (typeof picLabel==='function'
    ? (picLabel(v.owner) || picLabel(me&&(me.pic||me.name)))
    : (v.owner || (me&&(me.pic||me.name)))) || '—';

  const supports = (typeof supportsList==='function' && me) ? supportsList(me) : [];
  const isSupport = !!(me && typeof cap==='function' && cap(me.role).scope === 'support');
  const pk = (typeof picKey==='function') ? picKey : (s=>String(s||'').trim().toLowerCase());
  const optionsFor = (arr) => ['<option value="">— Chưa giao —</option>'].concat(
    (arr||[]).map(p=>`<option value="${ckEsc(p)}"${pk(p)===pk(v.owner)?' selected':''}>${ckEsc(picLabel?picLabel(p):p)}</option>`)).join('');

  let ownerField;
  if(myCap().admin && canEdit){
    ownerField = `<select id="cuf-owner" class="cu-owner-sel">${optionsFor((typeof LISTS!=='undefined'?LISTS.pics:[]))}</select>`;
  } else if(isNew && isSupport && canEdit && supports.length > 1){
    ownerField = `<select id="cuf-owner" class="cu-owner-sel">${supports.map(p=>`<option value="${ckEsc(p)}"${pk(p)===pk(v.owner)?' selected':''}>${ckEsc(picLabel?picLabel(p):p)}</option>`).join('')}</select>`;
  } else {
    ownerField = `<div class="cu-static" id="cuf-owner" data-val="${ckEsc(v.owner||(me&&(me.pic||me.name))||'')}">
         <span class="cu-avatar">${ckEsc((ownerName||'?').slice(0,2).toUpperCase())}</span>${ckEsc(ownerName)}</div>`;
  }

  const dis = canEdit ? '' : 'disabled';
  ov.innerHTML = `<div class="cu-modal glass" role="dialog" aria-modal="true">
    <div class="cu-modal-h">
      <h3>${isNew ? 'Thêm khách hàng' : ckEsc(custLabel(v.name))}</h3>
      <button class="x-close" onclick="cuCloseEdit()" aria-label="Đóng">×</button>
    </div>
    <div class="cu-modal-b">
      <div class="cu-form">
        ${!canEdit ? '<div class="cu-readonly">Bạn chỉ xem được khách hàng này. Chỉ người phụ trách hoặc quản trị mới sửa được.</div>' : ''}
        <label><span class="cu-cap">Tên hiển thị <span class="req">*</span></span>
          <input id="cuf-title" value="${ckEsc(v.name||'')}" placeholder="VD: Acecook" ${dis}></label>
        <label><span class="cu-cap">Tên pháp nhân</span>
          <input id="cuf-legal" value="${ckEsc(v.legal||'')}" placeholder="Tên đầy đủ trên giấy phép" ${dis}></label>
        <label><span class="cu-cap">Người phụ trách</span> ${ownerField}</label>
        <div class="cu-form-3">
          <label><span class="cu-cap">Segment</span> <input id="cuf-seg" value="${ckEsc(v.segment||'')}" ${dis}></label>
          <label><span class="cu-cap">Region</span> <input id="cuf-region" value="${ckEsc(v.region||'')}" ${dis}></label>
          <label><span class="cu-cap">Trạng thái</span> <input id="cuf-status" value="${ckEsc(v.status||'')}" placeholder="Active / Prospect" ${dis}></label>
        </div>
        ${canEdit ? `<div class="cu-form-act">
          ${canDel ? `<button class="btn-danger cu-del" id="cuf-del" onclick="cuDeleteCustomer()">Xoá khách hàng</button>` : ''}
          <span class="cu-act-gap"></span>
          <button class="btn-ghost" onclick="cuCloseEdit()">Huỷ</button>
          <button class="btn-primary" id="cuf-save" onclick="cuSaveCustomer()">${isNew?'Tạo khách hàng':'Lưu thay đổi'}</button>
        </div>` : ''}
      </div>
      ${related}
    </div>
  </div>`;
  ov.classList.add('open');
  const first = document.getElementById(canEdit ? 'cuf-title' : 'cuf-legal');
  if(first) setTimeout(()=>first.focus(), 30);
}
window.cuOpenEdit = cuOpenEdit;

function cuCloseEdit(){
  const ov = document.getElementById('cuEditOv');
  if(ov) ov.classList.remove('open');
  cuEditName = null;
}
window.cuCloseEdit = cuCloseEdit;

function cuSaveCustomer(){
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const title = g('cuf-title');
  if(!title){ if(window.toast) toast('Nhập tên khách hàng.'); return; }
  const entry = cuEditName ? cuFind(cuEditName) : null;
  const owner = myCap().admin ? cuReadOwner()
    : (entry ? (entry.owner || '') : (cuReadOwner() || cuDefaultOwner()));
  const row = { spId: entry ? entry.spId : null, title: title, legal: g('cuf-legal'),
                owner: owner, segment: g('cuf-seg'), region: g('cuf-region'), status: g('cuf-status') };
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    if(window.toast) toast('Chưa đăng nhập Microsoft 365 — không lưu được.');
    return;
  }
  const btn = document.getElementById('cuf-save'); if(btn){ btn.disabled = true; btn.textContent = 'Đang lưu…'; }
  FISG_STORE.saveCustomer(row).then(()=>{
    if(window.toast) toast(entry ? 'Đã lưu khách hàng.' : 'Đã thêm khách hàng ' + custLabel(title) + '.');
    cuCloseEdit(); renderCustomers();
  }).catch(e=>{
    console.warn('[customers] lưu hỏng:', e && (e.message||e));
    if(window.toast) toast('KHÔNG lưu được lên SharePoint: ' + (e.message||e));
    if(btn){ btn.disabled = false; btn.textContent = entry ? 'Lưu thay đổi' : 'Tạo khách hàng'; }
  });
}
window.cuSaveCustomer = cuSaveCustomer;

function cuDeleteCustomer(){
  const entry = cuEditName ? cuFind(cuEditName) : null;
  if(!entry){ if(window.toast) toast('Không tìm thấy khách hàng.'); return; }
  if(!cuCanDelete(entry)){ if(window.toast) toast('Bạn không có quyền xoá khách hàng này.'); return; }
  const label = custLabel(entry.name);
  const key = (typeof custOwnerKey === 'function') ? custOwnerKey
            : (s => String(s||'').trim().toUpperCase());
  const k = key(entry.name);
  const used = (typeof RECORDS !== 'undefined' ? RECORDS : []).filter(r => key(r.customer) === k).length
             + (typeof ACTIVITIES !== 'undefined' ? ACTIVITIES : []).filter(a => key(a.customer) === k).length;
  const warn = used
    ? `Khách "${label}" đang gắn với ${used} dự án/hoạt động. Xoá khỏi danh bạ sẽ KHÔNG xoá các bản ghi đó, nhưng khách sẽ biến mất khỏi danh sách. Tiếp tục?`
    : `Xoá khách hàng "${label}" khỏi danh bạ?`;
  if(!confirm(warn)) return;
  if(!window.FISG_STORE || !FISG_STORE.deleteCustomer || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    if(window.toast) toast('Chưa đăng nhập Microsoft 365 — không xoá được.');
    return;
  }
  const btn = document.getElementById('cuf-del'); if(btn){ btn.disabled = true; btn.textContent = 'Đang xoá…'; }
  FISG_STORE.deleteCustomer(entry).then(()=>{
    if(window.toast) toast('Đã xoá khách hàng ' + label + '.');
    cuCloseEdit(); renderCustomers();
  }).catch(e=>{
    console.warn('[customers] xoá hỏng:', e && (e.message||e));
    if(window.toast) toast('KHÔNG xoá được trên SharePoint: ' + (e.message||e));
    if(btn){ btn.disabled = false; btn.textContent = 'Xoá khách hàng'; }
  });
}
window.cuDeleteCustomer = cuDeleteCustomer;

function cuOpen(name){
  const k = (typeof custKey === 'function') ? custKey(name) : name;
  if(window.openCustomer) openCustomer(k);
}
window.cuOpen = cuOpen;

function cuNewProject(name){
  if(!window.openForm) return;
  openForm();
  const f = document.getElementById('f-cust'); if(f) f.value = custLabel(name);
  if(window.toast) toast('Đang tạo dự án cho ' + custLabel(name) + '. Điền phần còn lại rồi lưu.');
}
window.cuNewProject = cuNewProject;

function cuNewAct(name){
  if(!window.openActForm) return;
  openActForm({ customer: custLabel(name), title: 'Ghi hoạt động cho ' + custLabel(name) });
}
window.cuNewAct = cuNewAct;
