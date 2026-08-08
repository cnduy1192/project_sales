/* js/views/customers.js — màn hình "Khách hàng của tôi" (classic script).
 *
 * Danh bạ khách hàng đọc từ list Customers (CUSTOMER_DIR), lọc theo CHỦ SỞ HỮU:
 *   · sales           → chỉ khách của mình
 *   · manager/director/admin → cả đội, lọc thêm theo từng sales
 *
 * Đây là điểm khác biệt so với Cockpit/Funnel: khách CHƯA CÓ dự án nào vẫn hiện,
 * vì nguồn là danh bạ chứ không phải suy từ dự án. */

let cuFilterOwner = '';   // manager lọc theo một sales; rỗng = cả đội
let cuQuery = '';

function cuCanSeeAll(){ return !!(me && cap(me.role).scope === 'all'); }

/* Gom số liệu nhanh cho mỗi khách: dự án đang chạy, hoạt động gần nhất. Join
   theo custOwnerKey nên khớp dù tên trong dự án còn tiền tố "Công ty…". */
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

/* Danh sách khách trong phạm vi quyền, đã lọc theo sales chọn + ô tìm. */
function cuRows(){
  const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
  const q = cuQuery.trim().toLowerCase();
  return dir.filter(c => {
    if(!cuCanSeeAll()){
      if(!ownsCustomer(c.name, me)) return false;          // sales: chỉ của mình
    } else if(cuFilterOwner){
      if(picKey(c.owner) !== picKey(cuFilterOwner)) return false;
    }
    if(q){
      const hay = (c.name + ' ' + (c.legal||'') + ' ' + (c.owner||'')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  }).sort((a,b) => custLabel(a.name).localeCompare(custLabel(b.name), 'vi'));
}

function renderCustomers(){
  const rows = cuRows();
  cuRenderTools(rows.length);   /* rebuilds the toolbar (search box included) */
  cuRenderRows();
}
window.renderCustomers = renderCustomers;

/* Chỉ vẽ lại danh sách + cập nhật số đếm, KHÔNG đụng vào ô tìm — nhờ vậy con trỏ
   không bị nhảy khi đang gõ. Dùng cho mỗi lần gõ vào ô tìm khách hàng. */
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

  box.innerHTML = rows.map(c => {
    const s = m[key(c.name)] || { open:0, total:0, lastTouch:null, nccs:new Set() };
    /* Chưa có hoạt động / dự án thì để TRỐNG, không hiện nhãn giữ chỗ. */
    const touch = s.lastTouch ? cuTouch(s.lastTouch) : { text:'', cls:'' };
    const legal = c.legal && custOwnerKey(c.legal) !== custOwnerKey(c.name)
      ? `<span class="cu-legal">${ckEsc(c.legal)}</span>` : '';
    return `<div class="cu-row">
      <button class="cu-name" onclick="cuOpenEdit('${ckAttr(c.name)}')" title="Xem & sửa thông tin khách hàng">
        <b>${ckEsc(custLabel(c.name))}</b>${legal}
      </button>
      <div class="cu-owner">${cuCanSeeAll() && picLabel(c.owner) ? ckEsc(picLabel(c.owner)) : '<span class="cu-dash">—</span>'}</div>
      <div class="cu-num">${s.open
        ? `<span class="cu-pill"><b>${s.open}</b><em>đang chạy</em></span>`
        : '<span class="cu-zero">0</span>'}</div>
      <div class="cu-touch ${touch.cls}">${touch.text
        ? `<span class="cu-chip">${touch.text}</span>`
        : '<span class="cu-dash">—</span>'}</div>
      <div class="cu-act">
        <button class="cu-btn" onclick="cuNewProject('${ckAttr(c.name)}')">+ Dự án</button>
        <button class="cu-btn ghost" onclick="cuNewAct('${ckAttr(c.name)}')">Ghi hoạt động</button>
      </div>
    </div>`;
  }).join('');
}
window.cuRenderRows = cuRenderRows;

/* Ai được sửa một khách hàng: admin toàn quyền; sales chỉ khách của chính mình. */
function cuCanEdit(entry){
  if(!me) return false;
  if(myCap().admin) return true;
  return typeof ownsCustomer === 'function' && ownsCustomer(entry && entry.name ? entry.name : entry, me);
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
  /* Chỉ vẽ lại danh sách + số đếm; ô tìm giữ nguyên node nên con trỏ không nhảy. */
  cuRenderRows();
}
window.cuSetOwner = cuSetOwner; window.cuSetQuery = cuSetQuery;

/* ====== XEM & SỬA THÔNG TIN KHÁCH HÀNG ======
   name rỗng → tạo mới. Có name → mở khách đang có: hiện thông tin liên quan
   (dự án, hoạt động — trong phạm vi quyền) + form sửa. Không có quyền sửa thì
   các ô khoá lại, chỉ xem. */
let cuEditName = null;

function cuFind(name){
  const key = (typeof custOwnerKey === 'function') ? custOwnerKey
            : (s => String(s||'').trim().toUpperCase());
  const k = key(name);
  return (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []).find(c => key(c.name) === k) || null;
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

  /* Bỏ panel "Dự án / Hoạt động của khách hàng" bên phải — modal chỉ còn form. */
  const related = '';

  const v = entry || { name:'', legal:'', owner:(me&&(me.pic||me.name))||'', segment:'', region:'', status:'' };
  /* Ô chủ sở hữu: admin chọn tự do; sales khoá về chính mình. */
  const ownerField = myCap().admin
    ? `<input id="cuf-owner" list="cuf-pics" value="${ckEsc(v.owner||'')}" ${canEdit?'':'disabled'}>
       <datalist id="cuf-pics">${(typeof LISTS!=='undefined'?LISTS.pics:[]).map(p=>`<option value="${ckEsc(p)}">`).join('')}</datalist>`
    : `<input id="cuf-owner" value="${ckEsc(v.owner||(me&&(me.pic||me.name))||'')}" disabled>`;

  const dis = canEdit ? '' : 'disabled';
  ov.innerHTML = `<div class="cu-modal glass" role="dialog" aria-modal="true">
    <div class="cu-modal-h">
      <h3>${isNew ? 'Thêm khách hàng' : ckEsc(custLabel(v.name))}</h3>
      <button class="x-close" onclick="cuCloseEdit()" aria-label="Đóng">×</button>
    </div>
    <div class="cu-modal-b">
      <div class="cu-form">
        ${!canEdit ? '<div class="cu-readonly">Bạn chỉ xem được khách hàng này. Chỉ người phụ trách hoặc quản trị mới sửa được.</div>' : ''}
        <label>Tên hiển thị <span class="req">*</span>
          <input id="cuf-title" value="${ckEsc(v.name||'')}" placeholder="VD: Acecook" ${dis}></label>
        <label>Tên pháp nhân
          <input id="cuf-legal" value="${ckEsc(v.legal||'')}" placeholder="Tên đầy đủ trên giấy phép" ${dis}></label>
        <label>Người phụ trách ${ownerField}</label>
        <div class="cu-form-3">
          <label>Segment <input id="cuf-seg" value="${ckEsc(v.segment||'')}" ${dis}></label>
          <label>Region <input id="cuf-region" value="${ckEsc(v.region||'')}" ${dis}></label>
          <label>Trạng thái <input id="cuf-status" value="${ckEsc(v.status||'')}" placeholder="Active / Prospect" ${dis}></label>
        </div>
        ${canEdit ? `<div class="cu-form-act">
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
  const owner = myCap().admin ? g('cuf-owner') : ((me&&(me.pic||me.name))||'');
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

/* Nút "Xem lịch sử" dùng lại ngăn kéo Cockpit. */
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
