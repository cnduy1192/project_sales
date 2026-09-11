// ===== Khách hàng: phân loại (Tier) =====
// Tier là THUỘC TÍNH RIÊNG của khách (cột "Phân loại" trên SharePoint) — không bao giờ
// suy từ tên người phụ trách.
let cuFilterOwner = '';
let cuQuery = '';
let cuFilterTier = 'all';   // 'all' | 'Strategic' | 'Key Account' | 'Prospect'

const CU_TIERS = [
  { id:'Strategic',   label:'Strategic',   icon:'⭐', cls:'badge-tier-strategic', hint:'Khách hàng chiến lược, trọng yếu' },
  { id:'Key Account', label:'Key Account', icon:'🏢', cls:'badge-tier-key',       hint:'Khách lớn / chính thức, đang kinh doanh thường xuyên' },
  { id:'Prospect',    label:'Prospect',    icon:'🎯', cls:'badge-tier-prospect',  hint:'Khách tiềm năng, chưa phát sinh đơn hàng' },
];
window.CU_TIERS = CU_TIERS;

// Chuẩn hoá giá trị nhập tay (SharePoint / Excel): chấp nhận tiếng Việt, không dấu, viết tắt.
function cuNormTier(v){
  const s = String(v == null ? '' : v).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if(!s) return '';
  if(/strateg|chien luoc|trong yeu/.test(s)) return 'Strategic';
  if(/^ka$|key|chinh thuc|^active$|dang ban/.test(s)) return 'Key Account';
  if(/prospect|tiem nang|^lead$/.test(s)) return 'Prospect';
  return '';
}
// Tier chính thức lấy từ cột Tier. Khi cột trống: tạm tính theo "Trạng thái" cũ
// (Active → Key Account, Prospect → Prospect), còn lại coi là Prospect — và đánh dấu inferred.
function cuTierInfo(c){
  const t = cuNormTier(c && c.tier);
  if(t) return { tier:t, inferred:false };
  return { tier: cuNormTier(c && c.status) || 'Prospect', inferred:true };
}
function cuTierOf(c){ return cuTierInfo(c).tier; }
function cuTierDef(t){ return CU_TIERS.find(x => x.id === t) || CU_TIERS[2]; }
window.cuTierOf = cuTierOf;

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
// Team Leader thấy (chỉ đọc) khách của các sale trong team.
function cuTeamSees(c){
  return typeof teamSeesCustomer === 'function' && teamSeesCustomer(c.name || c, me);
}
function cuUnowned(c){ return !String(c.owner||'').trim(); }

// Mọi bộ lọc TRỪ tier — dùng để đếm badge trên tab.
function cuBaseRows(){
  const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
  const q = cuQuery.trim().toLowerCase();
  const seeAll = cuCanSeeAll();
  const byPerson = c => !cuFilterOwner || picKey(c.owner) === picKey(cuFilterOwner);
  return dir.filter(c => {
    if(q){
      const hay = (c.name + ' ' + (c.legal||'') + ' ' + (c.owner||'')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
      return seeAll ? byPerson(c) : true;
    }
    if(!seeAll) return cuMine(c) || cuTeamSees(c);
    return byPerson(c);
  });
}

function cuRows(base){
  const rows = (base || cuBaseRows())
    .filter(c => cuFilterTier === 'all' || cuTierOf(c) === cuFilterTier);
  const rank = { 'Strategic':0, 'Key Account':1, 'Prospect':2 };
  return rows.sort((a,b) => (cuFilterTier === 'all' ? rank[cuTierOf(a)] - rank[cuTierOf(b)] : 0)
    || custLabel(a.name).localeCompare(custLabel(b.name), 'vi'));
}

function cuTierCounts(base){
  const n = { all: base.length };
  CU_TIERS.forEach(t => { n[t.id] = 0; });
  base.forEach(c => { n[cuTierOf(c)]++; });
  return n;
}
window.cuTierCounts = cuTierCounts;

function renderCustomers(){
  cuRenderTools();
  cuRenderTabs();
  cuRenderRows();
}
window.renderCustomers = renderCustomers;

// ----- Segmented tabs phân loại -----
function cuRenderTabs(base){
  const box = document.getElementById('cuTierTabs');
  if(!box) return;
  const n = cuTierCounts(base || cuBaseRows());
  const hadFocus = box.contains(document.activeElement);
  const tabs = [{ id:'all', label:'Tất cả', icon:'', hint:'Mọi phân loại' }].concat(CU_TIERS);
  box.innerHTML = tabs.map(t => {
    const on = cuFilterTier === t.id;
    return `<button type="button" role="tab" class="tier-tab${on ? ' active' : ''}" data-tier="${ckEsc(t.id)}"
      aria-selected="${on}" tabindex="${on ? 0 : -1}" title="${ckEsc(t.hint)}" onclick="cuSetTier('${ckAttr(t.id)}')">
      ${t.icon ? `<span class="tier-ic" aria-hidden="true">${t.icon}</span>` : ''}<span class="tier-lbl">${ckEsc(t.label)}</span>
      <span class="tier-count" aria-label="${n[t.id]} khách hàng">${n[t.id]}</span></button>`;
  }).join('');
  if(!box.dataset.kb){
    box.dataset.kb = '1';
    box.addEventListener('keydown', e => {
      if(['ArrowLeft','ArrowRight','Home','End'].indexOf(e.key) < 0) return;
      const btns = Array.from(box.querySelectorAll('.tier-tab'));
      let i = btns.findIndex(b => b.classList.contains('active'));
      if(e.key === 'ArrowRight') i = (i + 1) % btns.length;
      else if(e.key === 'ArrowLeft') i = (i - 1 + btns.length) % btns.length;
      else if(e.key === 'Home') i = 0; else i = btns.length - 1;
      e.preventDefault();
      cuSetTier(btns[i].dataset.tier);
    });
  }
  const act = box.querySelector('.tier-tab.active');
  if(act && hadFocus) act.focus();   // giữ focus bàn phím sau khi vẽ lại
  if(act && act.scrollIntoView && box.scrollWidth > box.clientWidth)
    act.scrollIntoView({ block:'nearest', inline:'nearest' });
}

function cuSetTier(t){
  cuFilterTier = (t === 'all' || CU_TIERS.some(x => x.id === t)) ? t : 'all';
  cuRenderTabs();
  cuRenderRows();
}
window.cuSetTier = cuSetTier;

// ----- Mảnh giao diện của 1 dòng -----
function cuBadge(c){
  const info = cuTierInfo(c), d = cuTierDef(info.tier);
  const tip = info.inferred ? d.hint + ' · Chưa phân loại chính thức (đang tạm tính)' : d.hint;
  return `<span class="badge-tier ${d.cls}${info.inferred ? ' is-inferred' : ''}" title="${ckEsc(tip)}">${ckEsc(d.label)}</span>`;
}
function cuInitials(p){
  const w = String(picLabel(p) || p || '?').trim().split(/\s+/).filter(Boolean);
  if(!w.length) return '?';
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : w[0].slice(0, 2)).toUpperCase();
}
function cuPeopleCell(c){
  if(!String(c.owner || '').trim()) return '<span class="cu-tag cu-tag-free">Chưa ai quản lý</span>';
  const self = !!(me && typeof isMine === 'function' && isMine(c.owner, me));
  const name = picLabel(c.owner) || c.owner;
  return `<span class="cu-chip-p${self ? ' is-me' : ''}" title="${ckEsc(name)}">
    <i aria-hidden="true">${ckEsc(cuInitials(c.owner))}</i><span class="nm">${ckEsc(self ? 'Bạn' : name)}</span></span>`;
}

function cuRenderRows(){
  const box = document.getElementById('cuRows');
  if(!box) return;
  const { m, key } = cuStats();
  const base = cuBaseRows();
  const rows = cuRows(base);
  const cnt = document.querySelector('#cuTools .cu-count');
  if(cnt) cnt.textContent = rows.length + ' khách hàng';

  if(!rows.length){
    const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
    const tierEmpty = base.length && cuFilterTier !== 'all';
    const td = cuTierDef(cuFilterTier);
    box.innerHTML = `<div class="cu-empty">
      <b>${tierEmpty ? 'Chưa có khách hàng nhóm ' + ckEsc(td.label)
        : dir.length ? 'Không có khách hàng khớp bộ lọc' : 'Danh bạ khách hàng đang trống'}</b>
      <p>${tierEmpty ? ckEsc(td.hint) + '. Mở một khách hàng và chọn “Phân loại” để đưa vào nhóm này.'
        : dir.length ? 'Thử bỏ bớt bộ lọc hoặc ô tìm kiếm.'
        : 'Nhập list Customers trên SharePoint (kèm cột Người phụ trách) để danh bạ hiện ở đây. Xem docs/SharePoint_Setup.md.'}</p>
      ${tierEmpty ? `<button class="btn-ghost cu-empty-btn" onclick="cuSetTier('all')">Xem tất cả khách hàng</button>` : ''}
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
    const canAct = mine || cuUnowned(c);

    const actCell = canAct
      ? `<button class="cu-btn" onclick="cuNewProject('${ckAttr(c.name)}')">+ Dự án</button>
         <button class="cu-btn ghost" onclick="cuNewAct('${ckAttr(c.name)}')">Ghi hoạt động</button>`
      : `<span class="cu-foreign">Khách của sales khác</span>`;

    return `<div class="cu-row" data-tier="${ckEsc(cuTierOf(c))}">
      <button class="cu-name" onclick="cuOpenEdit('${ckAttr(c.name)}')" title="Xem & sửa thông tin khách hàng">
        <span class="cu-name-line"><b>${ckEsc(custLabel(c.name))}</b>${cuBadge(c)}</span>${legal}
      </button>
      <div class="cu-owner">${cuPeopleCell(c)}</div>
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
  // Chỉ Manager / Director / Super Admin được xoá khách hàng (theo vai trò).
  return typeof capDeleteCustomer === 'function' && capDeleteCustomer(me);
}

function cuTouch(iso){
  const d = daysSince(iso);
  if(d <= 7)  return { text:ckVN(iso), cls:'cu-quiet-ok' };
  if(d <= 30) return { text:d + ' ngày trước', cls:'cu-quiet-mid' };
  return { text:d + ' ngày trước', cls:'cu-quiet-old' };
}

function cuRenderTools(){
  const box = document.getElementById('cuTools');
  if(!box) return;
  const dir = (typeof CUSTOMER_DIR !== 'undefined' ? CUSTOMER_DIR : []);
  let ownerSel = '';
  if(cuCanSeeAll()){
    const owners = Array.from(new Set(dir.map(c => c.owner).filter(Boolean)))
      .sort((a,b) => String(picLabel(a)).localeCompare(String(picLabel(b)), 'vi'));
    ownerSel = `<select class="cu-sel" aria-label="Lọc theo sales" onchange="cuSetOwner(this.value)">
      <option value="">Tất cả sales</option>
      ${owners.map(o => `<option value="${ckEsc(o)}"${picKey(cuFilterOwner)===picKey(o)?' selected':''}>${ckEsc(picLabel(o))}</option>`).join('')}
    </select>`;
  }
  const head = document.getElementById('cuHeadAct');
  const addBtn = (window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite())
    ? `<button class="btn-primary cu-add" onclick="cuOpenEdit()">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
         Thêm khách hàng</button>` : '';
  if(head) head.innerHTML = addBtn;
  const untiered = myCap().admin ? dir.filter(c => cuTierInfo(c).inferred).length : 0;
  box.innerHTML = `${head ? '' : addBtn}
    <div class="cu-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" placeholder="Tìm khách hàng, sales…" value="${ckEsc(cuQuery)}" oninput="cuSetQuery(this.value)" aria-label="Tìm khách hàng">
    </div>
    ${ownerSel}
    <span class="cu-tools-gap"></span>
    ${untiered ? `<span class="cu-untiered" title="Các khách này chưa có cột Phân loại — đang tạm tính theo Trạng thái (hoặc Prospect).">${untiered} khách chưa phân loại</span>` : ''}
    <span class="cu-count">0 khách hàng</span>`;
}

function cuSetOwner(v){ cuFilterOwner = v; cuRenderTabs(); cuRenderRows(); }
function cuSetQuery(v){
  cuQuery = v;
  // Không vẽ lại thanh công cụ để ô tìm kiếm giữ nguyên focus.
  cuRenderTabs();
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
  const v = entry || { name:'', legal:'', owner:cuDefaultOwner(), tier:'Prospect' };
  const tierNow = cuTierInfo(v);
  // Khách cũ chưa phân loại: không tự chọn sẵn để tránh lưu nhầm giá trị tạm tính.
  const tierSel = (isNew || !tierNow.inferred) ? tierNow.tier : '';

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
          <input id="cuf-title" value="${ckEsc(v.name||'')}" placeholder="Tên khách hàng…" ${dis}></label>
        <label><span class="cu-cap">Tên đầy đủ</span>
          <input id="cuf-legal" value="${ckEsc(v.legal||'')}" placeholder="Tên đầy đủ trên giấy phép" ${dis}></label>
        <div class="cu-field">
          <span class="cu-cap">Phân loại khách hàng</span>
          <div class="cu-tier-pick" role="radiogroup" aria-label="Phân loại khách hàng">
            ${CU_TIERS.map(t => `<label class="cu-tier-opt ${t.cls}">
              <input type="radio" name="cuf-tier" value="${ckEsc(t.id)}"${tierSel === t.id ? ' checked' : ''} ${dis}>
              <span class="cu-tier-opt-t"><span aria-hidden="true">${t.icon}</span> ${ckEsc(t.label)}</span></label>`).join('')}
          </div>
        </div>
        <label><span class="cu-cap">Sales phụ trách</span> ${ownerField}</label>
        ${(canEdit || canDel) ? `<div class="cu-form-act">
          ${canDel ? `<button class="btn-danger cu-del" id="cuf-del" onclick="cuDeleteCustomer()">Xoá khách hàng</button>` : ''}
          <span class="cu-act-gap"></span>
          <button class="btn-ghost" onclick="cuCloseEdit()">${canEdit ? 'Huỷ' : 'Đóng'}</button>
          ${canEdit ? `<button class="btn-primary" id="cuf-save" onclick="cuSaveCustomer()">${isNew?'Tạo khách hàng':'Lưu thay đổi'}</button>` : ''}
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
                owner: owner };
  const tierEl = document.querySelector('input[name="cuf-tier"]:checked');
  row.tier = tierEl ? tierEl.value : (entry ? (entry.tier || '') : 'Prospect');
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    if(window.toast) toast('Chưa đăng nhập Microsoft 365 — không lưu được.');
    return;
  }
  const btn = document.getElementById('cuf-save'); if(btn){ btn.disabled = true; btn.textContent = 'Đang lưu…'; }
  FISG_STORE.saveCustomer(row).then(()=>{
    const miss = (FISG_STORE.customerMissingCols ? FISG_STORE.customerMissingCols() : []);
    if(miss.length && window.toast)
      toast('Đã lưu, NHƯNG list Customers chưa có cột: ' + miss.join(', ') + ' — phân loại chưa được ghi. Nhờ quản trị thêm cột trên SharePoint.');
    else if(window.toast) toast(entry ? 'Đã lưu khách hàng.' : 'Đã thêm khách hàng ' + custLabel(title) + '.');
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
  if(!window.openCreateProjectModal) return;
  // NCC chỉ khoá khi đang lọc đúng 1 nhà cung cấp; ngược lại modal tự gợi ý từ lịch sử khách
  const ncc = (typeof isAllNcc === 'function' && !isAllNcc() && nccFilter) ? nccFilter : '';
  openCreateProjectModal({ customerId: custKey(name), customerName: custLabel(name), supplier: ncc });
}
window.cuNewProject = cuNewProject;

function cuNewAct(name){
  if(!window.openActForm) return;
  openActForm({ customer: custLabel(name), title: 'Ghi hoạt động cho ' + custLabel(name) });
}
window.cuNewAct = cuNewAct;
