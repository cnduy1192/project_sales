let ckDays = 7;
let ckNccs = [];
let ckKind = '';
let ckPic = '';
let ckSignal = null;
let ckQuery = '';
let ckSort = { by:'lastTouch', dir:-1 };
let ckCust = null;
let ckLastFocus = null;

const CK_PERIODS = [7, 14, 30];
const CK_WD = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const CK_KIND = {
  act:    { label:'Hoạt động', c:'var(--ck-act)',    bg:'rgba(14,116,144,.10)' },
  update: { label:'Cập nhật',  c:'var(--ck-update)', bg:'rgba(10,92,143,.10)' },
  new:    { label:'Dự án mới', c:'var(--ck-new)',    bg:'var(--accent-soft)' },
  close:  { label:'Đóng',      c:'var(--marine)',    bg:'var(--marine-soft)' }
};

function ckEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function ckAttr(s){ return ckEsc(String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")); }

function ckVN(iso){ return iso ? iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) : '—'; }
function ckDayLabel(iso){
  const diff = daysSince(iso);
  if(diff === 0) return 'Hôm nay';
  if(diff === 1) return 'Hôm qua';
  return CK_WD[new Date(iso).getDay()];
}
function ckKindMeta(e){
  if(e.kind !== 'close') return CK_KIND[e.kind];
  return e.status === 'WON'
    ? { label:'Thắng', c:'var(--won)', bg:'var(--won-bg)' }
    : { label:'Thua',  c:'var(--lost)', bg:'var(--lost-bg)' };
}

function renderCockpit(){
  const sig = buildSignals(ckDays);
  ckRenderHead();
  ckRenderSignals(sig);
  ckRenderFeed(sig);
  ckRenderUpcoming();
  ckRenderTable(sig);
}
window.renderCockpit = renderCockpit;

function cockpitRefresh(){
  if(typeof invalidateCockpit === 'function') invalidateCockpit();
  const sec = document.getElementById('view-cockpit');
  if(sec && sec.style.display !== 'none') renderCockpit();
}
window.cockpitRefresh = cockpitRefresh;

function ckRenderHead(){
  document.getElementById('ckRange').innerHTML =
    'Kỳ đang xem: <b>' + ckVN(shiftISO(-ckDays)) + ' – ' + ckVN(todayISO()) + '</b>';
  document.getElementById('ckPeriod').innerHTML = CK_PERIODS.map(d =>
    `<button aria-pressed="${d===ckDays}" onclick="ckSetDays(${d})">${d} ngày</button>`).join('');
}
function ckSetDays(d){ ckDays = d; renderCockpit(); }
window.ckSetDays = ckSetDays;

function ckRenderSignals(sig){
  const closed = sig.closedWon + sig.closedLost;

  const cards = [
    { id:'acts', k:'Hoạt động trong kỳ', v:sig.acts, c:'var(--ck-act)',
      s:'Cuộc gọi, ghé thăm, email và cập nhật tiến độ trong kỳ đang xem' },
    { id:'closed', k:'Dự án đã đóng', v:closed, c:'var(--marine)',
      s:sig.closedWon + ' thắng · ' + sig.closedLost + ' thua' },
    { id:'overdue', k:'Dự án quá hạn', v:sig.overdue, c:'var(--overdue)',
      s:'Đang chạy nhưng đã qua ngày đóng dự kiến · tính đến hôm nay' },
    { id:'silent', k:'Khách hàng chưa tương tác', v:sig.silent, c:'var(--prog)',
      s:'Có dự án đang chạy, hơn ' + SILENT_DAYS + ' ngày không ai chạm · tính đến hôm nay' }
  ];
  document.getElementById('ckSignals').innerHTML = cards.map(c => `
    <button class="ck-sig" style="--sig:${c.c}" aria-pressed="${ckSignal===c.id}"
            title="${ckEsc(c.s)}" onclick="ckToggleSignal('${c.id}')">
      <span class="ck-sig-k">${c.k}</span>
      <span class="ck-sig-v">${c.v}</span>
    </button>`).join('');
}
function ckToggleSignal(id){ ckSignal = (ckSignal === id) ? null : id; renderCockpit(); }
window.ckToggleSignal = ckToggleSignal;

function ckFeedOpts(){
  const o = { nccs: ckNccs.length ? ckNccs : null, pic: ckPic || null, kinds: null };
  if(ckKind) o.kinds = [ckKind];
  if(ckSignal === 'acts')   o.kinds = ['act','update'];
  if(ckSignal === 'closed') o.kinds = ['close'];
  return o;
}

function ckCustGate(sig){
  if(ckSignal === 'overdue') return k => sig.overdueCust.has(k);
  if(ckSignal === 'silent')  return k => sig.silentCust.has(k);
  return null;
}

function ckRenderFeed(sig){
  const gate = ckCustGate(sig);
  let evs = buildEvents(ckDays, ckFeedOpts());
  if(gate) evs = evs.filter(e => gate(e.custKey));

  ckRenderFeedFilters(evs.length);
  const box = document.getElementById('ckFeed');

  if(!evs.length){
    const wider = CK_PERIODS.find(d => d > ckDays);
    box.innerHTML = `<div class="ck-empty">
      <b>Kỳ này chưa có hoạt động nào</b>
      <p>Không có bản ghi nào khớp bộ lọc trong ${ckDays} ngày qua.</p>
      ${wider ? `<button class="ck-chip" onclick="ckSetDays(${wider})">Xem ${wider} ngày</button>` : ''}
    </div>`;
    return;
  }

  const days = [];
  evs.forEach(e => {
    const last = days[days.length-1];
    if(last && last.ts === e.ts) last.items.push(e); else days.push({ ts:e.ts, items:[e] });
  });

  let seen = 0;
  const fade = i => 'rgba(1,66,106,' + (0.50 - 0.38 * Math.min(i / Math.max(evs.length-1,1), 1)).toFixed(3) + ')';

  box.innerHTML = days.map(d => {
    const start = seen; seen += d.items.length;
    return `<div class="ck-day">
      <div class="ck-day-h"><b>${ckDayLabel(d.ts)}</b><span>${ckVN(d.ts)}</span><em>${d.items.length} sự kiện</em></div>
      <div class="ck-day-b" style="--f0:${fade(start)};--f1:${fade(seen)}">
        ${d.items.map(ckEventRow).join('')}
      </div>
    </div>`;
  }).join('');
}

const CK_UP_DAYS = 7;
function ckRenderUpcoming(){
  const box = document.getElementById('ckUp');
  const panel = document.getElementById('ckUpPanel');
  if(!box) return;

  const o = ckFeedOpts();
  const hidden = o.kinds && o.kinds.length && o.kinds.indexOf('act') < 0;
  const evs = hidden ? [] : buildUpcoming(CK_UP_DAYS, { nccs:o.nccs, pic:o.pic });
  document.getElementById('ckUpCount').textContent = evs.length + ' việc';
  if(panel) panel.style.display = (hidden && !evs.length) ? 'none' : '';
  if(!evs.length){
    box.innerHTML = `<div class="ck-empty">
      <b>Chưa có việc nào được lên lịch</b>
      <p>Hoạt động sales đặt cho ${CK_UP_DAYS} ngày tới sẽ hiện ở đây.</p></div>`;
    return;
  }
  const days = [];
  evs.forEach(e => {
    const last = days[days.length-1];
    if(last && last.ts === e.ts) last.items.push(e); else days.push({ ts:e.ts, items:[e] });
  });
  box.innerHTML = days.map(d => `<div class="ck-day ck-day-up">
      <div class="ck-day-h"><b>${ckUpLabel(d.ts)}</b><span>${ckVN(d.ts)}</span><em>${d.items.length} việc</em></div>
      <div class="ck-day-b">${d.items.map(ckEventRow).join('')}</div>
    </div>`).join('');
}

function ckUpLabel(iso){
  const d = daysSince(iso);
  if(d === -1) return 'Ngày mai';
  if(d === -2) return 'Ngày kia';
  return ckDayLabel(iso);
}

function ckEventRow(e){
  const m = ckKindMeta(e);
  const open = e.projectId
    ? `onclick="openDetail('${e.projectId}')"`
    : `onclick="openCustomer('${ckAttr(e.custKey)}')"`;
  const type = e.kind === 'act' && e.actType ? ' · ' + ckEsc(e.actType) : '';
  const stage = e.segment ? `<span class="ck-meta dot">${ckEsc(e.segment)}</span>` : '';
  const when = e.inferred
    ? `<span class="ck-meta dot ck-approx" title="Ngày ước tính từ lần cập nhật cuối — bản ghi cũ không lưu ngày đóng">~${ckVN(e.ts)}</span>`
    : '';
  return `<button class="ck-ev${e.upcoming?' ck-ev-up':''}" style="--kc:${m.c};--kc-bg:${m.bg}" ${open}>
    <span class="ck-ev-t">
      <span class="ck-ev-pic">${ckEsc(picLabel(e.pic))}</span>
      <span class="ck-ev-arrow">→</span>
      <span class="ck-ev-cust">${ckEsc(e.custLabel)}</span>
      <span class="ck-tag">${m.label}${type}</span>
      <span class="ck-meta dot">${ckEsc(e.ncc)}</span>
      ${stage}${when}
    </span>
    ${e.text ? `<span class="ck-ev-note">${ckEsc(e.text.slice(0,160))}${e.text.length>160?'…':''}</span>` : ''}
    ${e.next ? `<span class="ck-ev-next"><b>Tiếp theo:</b> ${ckEsc(e.next)}</span>` : ''}
  </button>`;
}

function ckRenderFeedFilters(count){
  const nccChips = NCCS.map(n =>
    `<button class="ck-chip" aria-pressed="${ckNccs.indexOf(n)>-1}" onclick="ckToggleNcc('${ckAttr(n)}')">${ckEsc(n)}</button>`).join('');
  const kinds = [['','Tất cả loại'],['act','Hoạt động'],['update','Cập nhật'],['new','Dự án mới'],['close','Đóng dự án']];
  const pics = [''].concat(Array.from(new Set(_cachedEvents(ckDays).map(e => e.pic))).sort());
  document.getElementById('ckFeedCount').textContent = count + ' sự kiện';
  document.getElementById('ckFilters').innerHTML = nccChips +
    `<select class="ck-sel" aria-label="Lọc theo loại sự kiện" onchange="ckSetKind(this.value)">
      ${kinds.map(([v,l]) => `<option value="${v}"${v===ckKind?' selected':''}>${l}</option>`).join('')}
    </select>
    <select class="ck-sel" aria-label="Lọc theo sales" onchange="ckSetPic(this.value)">
      ${pics.map(p => `<option value="${ckEsc(p)}"${p===ckPic?' selected':''}>${p?ckEsc(picLabel(p)):'Tất cả sales'}</option>`).join('')}
    </select>`;
}
function ckToggleNcc(n){
  const i = ckNccs.indexOf(n);
  if(i > -1) ckNccs.splice(i,1); else ckNccs.push(n);
  renderCockpit();
}
function ckSetKind(v){ ckKind = v; if(ckSignal==='acts'||ckSignal==='closed') ckSignal=null; renderCockpit(); }
function ckSetPic(v){ ckPic = v; renderCockpit(); }
window.ckToggleNcc = ckToggleNcc; window.ckSetKind = ckSetKind; window.ckSetPic = ckSetPic;

const CK_COLS = [
  { id:'label',     label:'Khách hàng' },
  { id:'sales',     label:'Sales phụ trách', cls:'hide-sm' },
  { id:'segments',  label:'Segment',         cls:'hide-md' },
  { id:'nccs',      label:'NCC',             cls:'hide-md' },
  { id:'openCount', label:'Đang chạy',       cls:'num' },
  { id:'kgThis',    label:'KG tiềm năng',    cls:'num hide-sm' },
  { id:'lastTouch', label:'Hoạt động gần nhất' }
];

function ckSortValue(p, by){
  if(by === 'label') return p.label.toLowerCase();
  if(by === 'sales') return p.sales.size;
  if(by === 'segments') return p.segments.size;
  if(by === 'nccs') return p.nccs.size;
  if(by === 'lastTouch') return p.lastTouch || '';
  return p[by] || 0;
}

function ckRenderTable(sig){
  const gate = ckCustGate(sig);
  const idx = buildCustomerIndex({ nccs: ckNccs.length ? ckNccs : null });
  let list = [];
  idx.forEach(p => { if(!gate || gate(p.key)) list.push(p); });

  list.sort((a,b) => {
    const x = ckSortValue(a, ckSort.by), y = ckSortValue(b, ckSort.by);
    if(x === y) return a.label < b.label ? -1 : 1;
    return (x < y ? -1 : 1) * ckSort.dir;
  });

  document.getElementById('ckCustCount').textContent = list.length;
  document.getElementById('ckThead').innerHTML = CK_COLS.map(c =>
    `<div class="${c.cls||''}"><button class="${ckSort.by===c.id?'sorted':''}" onclick="ckSetSort('${c.id}')">
      ${c.label}${ckSort.by===c.id ? (ckSort.dir>0?' ↑':' ↓') : ''}</button></div>`).join('');

  const rows = document.getElementById('ckRows');
  if(!list.length){
    rows.innerHTML = `<div class="ck-empty"><b>Không có khách hàng nào khớp bộ lọc</b>
      <p>Đang lọc theo nhà cung cấp, tín hiệu hoặc từ khoá tìm kiếm.</p>
      <button class="ck-chip" onclick="ckClearFilters()">Xoá toàn bộ bộ lọc</button></div>`;
    return;
  }
  rows.innerHTML = list.map(p => ckCustRow(p, sig)).join('');
  ckApplyQuery();
}

function ckSetOf(set, labelFn){
  const arr = Array.from(set).filter(Boolean).map(labelFn || (x => x)).sort();
  if(!arr.length) return '—';
  return arr.length <= 2 ? ckEsc(arr.join(', '))
    : ckEsc(arr.slice(0,2).join(', ')) + ' <span class="ck-more">+' + (arr.length-2) + '</span>';
}

function ckQuiet(lastTouch){
  if(!lastTouch) return { text:'Chưa có', pct:0, color:'var(--line)', title:'Chưa ghi nhận hoạt động nào' };
  const d = daysSince(lastTouch);
  if(d < 0) return { text:'Đã lên lịch ' + ckVN(lastTouch), pct:0, color:'var(--marine-2)',
                     title:'Hoạt động gần nhất nằm ở tương lai — đã đặt lịch' };
  if(d === 0) return { text:'Hôm nay', pct:0, color:'var(--marine-2)', title:'Vừa chạm hôm nay' };
  return {
    text: d + ' ngày trước',
    pct: Math.min(Math.round(d / 60 * 100), 100),
    color: d > SILENT_DAYS ? 'var(--overdue)' : d > 14 ? 'var(--prog)' : 'var(--marine-2)',
    title: 'Lần chạm gần nhất: ' + ckVN(lastTouch)
  };
}

function ckCustRow(p, sig){
  const q = ckQuiet(p.lastTouch);
  const quiet = q.text, pct = q.pct, qc = q.color;
  const flag = sig.overdueCust.has(p.key) ? ' <span class="ck-badge warn">quá hạn</span>' : '';
  return `<button class="ck-row ck-grid" data-n="${ckEsc(p.label.toLowerCase())}" onclick="openCustomer('${ckAttr(p.key)}')">
    <div class="ck-row-n">${ckEsc(p.label)}${flag}<span class="sub">${p.projects.length} dự án · ${p.wonCount} thắng · ${p.lostCount} thua</span></div>
    <div class="cell hide-sm">${ckSetOf(p.sales, picLabel)}</div>
    <div class="cell hide-md">${ckSetOf(p.segments)}</div>
    <div class="cell hide-md">${ckSetOf(p.nccs)}</div>
    <div class="num">${p.openCount}</div>
    <div class="num hide-sm">${fmt(p.kgThis)}</div>
    <div class="ck-quiet" title="${ckEsc(q.title)}">
      <span class="ck-quiet-t">${quiet}</span>
      <span class="ck-quiet-b" style="--qc:${qc}"><i style="width:${pct}%"></i></span>
    </div>
  </button>`;
}

function ckClearFilters(){
  ckNccs = []; ckKind = ''; ckPic = ''; ckSignal = null; ckQuery = '';
  const q = document.getElementById('ckQ'); if(q) q.value = '';
  renderCockpit();
}
window.ckClearFilters = ckClearFilters;

function ckSetSort(by){
  if(ckSort.by === by) ckSort.dir = -ckSort.dir;
  else ckSort = { by, dir: by === 'label' ? 1 : -1 };
  renderCockpit();
}
window.ckSetSort = ckSetSort;

function ckSetQuery(v){ ckQuery = String(v||'').trim().toLowerCase(); ckApplyQuery(); }
function ckApplyQuery(){
  const rows = document.querySelectorAll('#ckRows .ck-row');
  let shown = 0;
  rows.forEach(r => {
    const hit = !ckQuery || r.dataset.n.indexOf(ckQuery) > -1;
    r.hidden = !hit; if(hit) shown++;
  });
  document.getElementById('ckCustCount').textContent = shown;
}
window.ckSetQuery = ckSetQuery;

function openCustomer(key){
  const p = _cachedIndex().get(custKey(key));
  if(!p) return;
  ckCust = p.key;
  ckLastFocus = document.activeElement;

  document.getElementById('ckDrawerTitle').textContent = p.label;
  document.getElementById('ckDrawerSub').innerHTML =
    Array.from(p.nccs).map(n => `<span class="ck-badge">${ckEsc(n)}</span>`).join('') +
    Array.from(p.segments).slice(0,3).map(s => `<span class="ck-badge">${ckEsc(s)}</span>`).join('');

  const evs = buildEvents(3650, { custKey: p.key }).slice(0, 20);
  const salesCount = {};
  p.projects.forEach(r => { const k = picKey(r.pic); if(k) salesCount[k] = (salesCount[k]||0)+1; });
  Array.from(p.sales).forEach(k => { if(!salesCount[k]) salesCount[k] = 0; });

  document.getElementById('ckDrawerBody').innerHTML = `
    <div class="ck-stats">
      <div class="ck-stat"><b>${p.openCount}</b><span>Đang chạy</span></div>
      <div class="ck-stat"><b>${fmt(p.kgThis)}</b><span>KG tiềm năng</span></div>
      <div class="ck-stat"><b>${p.wonCount}/${p.wonCount+p.lostCount}</b><span>Thắng / đã đóng</span></div>
    </div>

    <div class="ck-block">
      <h4>Sales phụ trách</h4>
      <div class="ck-people">${Object.keys(salesCount).sort((a,b)=>salesCount[b]-salesCount[a]).map(k => `
        <div class="ck-person">
          <span class="avatar" style="width:26px;height:26px;font-size:10px;background:var(--marine-2)">${ckEsc(initials(picLabel(k)))}</span>
          <b>${ckEsc(picLabel(k))}</b><span>${salesCount[k]} dự án</span>
        </div>`).join('') || '<div class="ck-mini-t">Chưa gán sales.</div>'}</div>
    </div>

    <div class="ck-block">
      <h4>Segment &amp; ứng dụng</h4>
      <div class="ck-tags">${
        Array.from(p.segments).sort().map(s => `<span class="ck-badge">${ckEsc(s)}</span>`).join('') || '—'}</div>
      <div class="ck-mini-t" style="margin-top:9px">${
        ckEsc(Array.from(new Set(p.projects.map(r => r.application).filter(Boolean))).slice(0,6).join(' · ')) || 'Chưa ghi ứng dụng.'}</div>
    </div>

    <div class="ck-block">
      <h4>Sản phẩm đang chào · ${p.products.length}</h4>
      ${p.products.length ? p.products.map(pr => `
        <button class="ck-prod" onclick="openDetail('${pr.id}')">
          <b>${ckEsc(pr.name)}</b><span class="kg">${fmt(pr.kgThis)} KG</span>
          <span class="m"><span class="ck-tag" style="--kc:var(--marine);--kc-bg:var(--marine-soft)"
            title="${ckEsc(pr.stage)}">${ckEsc(pr.stageGroup)}</span>${ckEsc(pr.ncc)}</span>
        </button>`).join('') : '<div class="ck-mini-t">Không có dự án nào đang chạy.</div>'}
    </div>

    <div class="ck-block">
      <h4>Gần đây · ${evs.length} sự kiện</h4>
      <div class="ck-mini">${evs.length ? evs.map(e => {
        const m = ckKindMeta(e);
        return `<div class="ck-mini-i" style="--kc:${m.c}">
          <div class="ck-mini-d">${ckVN(e.ts)} · ${m.label} · ${ckEsc(picLabel(e.pic))}</div>
          <div class="ck-mini-t">${ckEsc((e.text||'—').slice(0,140))}</div>
        </div>`;}).join('') : '<div class="ck-mini-t">Chưa có hoạt động nào được ghi nhận.</div>'}</div>
    </div>`;

  document.getElementById('ckDrawerBd').classList.add('open');
  const dr = document.getElementById('ckDrawer');
  dr.classList.add('open');
  dr.focus();
}
window.openCustomer = openCustomer;

function closeCustomer(){
  document.getElementById('ckDrawerBd').classList.remove('open');
  document.getElementById('ckDrawer').classList.remove('open');
  ckCust = null;
  if(ckLastFocus && document.contains(ckLastFocus)) ckLastFocus.focus();
  ckLastFocus = null;
}
window.closeCustomer = closeCustomer;

function ckOpenHistory(){
  const p = _cachedIndex().get(ckCust);
  if(!p) return;
  const byNcc = {};
  p.projects.forEach(r => byNcc[r.ncc] = (byNcc[r.ncc]||0)+1);
  const best = Object.keys(byNcc).sort((a,b) => byNcc[b]-byNcc[a])[0];
  const label = p.label;
  closeCustomer();
  if(best && best !== nccFilter){
    setNcc(best);
    if(Object.keys(byNcc).length > 1)
      toast('Đã chuyển sang ' + best + ' — lịch sử chi tiết xem theo từng nhà cung cấp.');
  }
  showInsight('kh', label);
}
window.ckOpenHistory = ckOpenHistory;

document.addEventListener('keydown', e => {
  const dr = document.getElementById('ckDrawer');
  if(!dr || !dr.classList.contains('open')) return;
  if(e.key === 'Escape'){ e.preventDefault(); closeCustomer(); return; }
  if(e.key !== 'Tab') return;
  const f = dr.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(!f.length) return;
  const first = f[0], last = f[f.length-1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
