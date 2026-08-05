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
  const box = document.getElementById('cuRows');
  if(!box) return;
  const { m, key } = cuStats();
  const rows = cuRows();

  cuRenderTools(rows.length);

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
    const touch = s.lastTouch ? cuTouch(s.lastTouch) : { text:'Chưa có hoạt động', cls:'cu-quiet-none' };
    const legal = c.legal && custOwnerKey(c.legal) !== custOwnerKey(c.name)
      ? `<span class="cu-legal">${ckEsc(c.legal)}</span>` : '';
    const ncc = [...s.nccs].slice(0,3).map(n => `<span class="cu-ncc">${ckEsc(n)}</span>`).join('');
    return `<div class="cu-row">
      <button class="cu-name" onclick="cuOpen('${ckAttr(c.name)}')" title="Xem lịch sử khách hàng">
        <b>${ckEsc(custLabel(c.name))}</b>${legal}
      </button>
      <div class="cu-owner">${cuCanSeeAll() ? ckEsc(picLabel(c.owner) || '—') : ''}</div>
      <div class="cu-meta">${ncc || '<span class="cu-none">chưa có dự án</span>'}</div>
      <div class="cu-num"><b>${s.open}</b><span>đang chạy</span></div>
      <div class="cu-touch ${touch.cls}">${touch.text}</div>
      <div class="cu-act">
        <button class="cu-btn" onclick="cuNewProject('${ckAttr(c.name)}')">+ Dự án</button>
        <button class="cu-btn ghost" onclick="cuNewAct('${ckAttr(c.name)}')">Ghi hoạt động</button>
      </div>
    </div>`;
  }).join('');
}
window.renderCustomers = renderCustomers;

function cuTouch(iso){
  const d = daysSince(iso);
  if(d <= 7)  return { text:'Chạm ' + ckVN(iso), cls:'cu-quiet-ok' };
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
  box.innerHTML = `${ownerSel}
    <div class="cu-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="text" placeholder="Tìm khách hàng" value="${ckEsc(cuQuery)}" oninput="cuSetQuery(this.value)" aria-label="Tìm khách hàng">
    </div>
    <span class="cu-count">${count} khách hàng</span>`;
}

function cuSetOwner(v){ cuFilterOwner = v; renderCustomers(); }
function cuSetQuery(v){
  cuQuery = v;
  const box = document.getElementById('cuRows');
  /* Chỉ vẽ lại danh sách, giữ nguyên ô tìm để con trỏ không nhảy. */
  const { m, key } = cuStats();
  renderCustomers();
  const inp = document.querySelector('#cuTools input'); if(inp){ inp.focus(); inp.value = v; }
}
window.cuSetOwner = cuSetOwner; window.cuSetQuery = cuSetQuery;

/* Mở lịch sử khách hàng dùng lại ngăn kéo sẵn có ở Cockpit. */
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
