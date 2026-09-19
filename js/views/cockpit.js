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
const CK_WD = { get length(){ return 7; } };
['sun','mon','tue','wed','thu','fri','sat'].forEach((d,i)=>Object.defineProperty(CK_WD, i, { get(){ return T('wd.'+d); } }));
const CK_KIND = {
  act:    { get label(){ return T('common.activity'); }, c:'var(--ck-act)',    bg:'rgba(14,116,144,.10)' },
  update: { get label(){ return T('ck.kind.update'); }, c:'var(--ck-update)', bg:'rgba(10,92,143,.10)' },
  new:    { get label(){ return T('ck.kind.new'); }, c:'var(--ck-new)',    bg:'var(--accent-soft)' },
  close:  { get label(){ return T('ck.kind.close'); }, c:'var(--marine)',    bg:'var(--marine-soft)' }
};

function ckEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function ckAttr(s){ return ckEsc(String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")); }

function ckVN(iso){ return iso ? iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) : '—'; }
function ckDayLabel(iso){
  const diff = daysSince(iso);
  if(diff === 0) return T('common.today');
  if(diff === 1) return T('common.yesterday');
  return CK_WD[new Date(iso).getDay()];
}
function ckKindMeta(e){
  if(e.kind !== 'close') return CK_KIND[e.kind];
  return e.status === 'WON'
    ? { label:T('status.won'), c:'var(--won)', bg:'var(--won-bg)' }
    : { label:T('status.lost'),  c:'var(--lost)', bg:'var(--lost-bg)' };
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
    T('ck.range') + ' <b>' + ckVN(shiftISO(-ckDays)) + ' – ' + ckVN(todayISO()) + '</b>';
  document.getElementById('ckPeriod').innerHTML = CK_PERIODS.map(d =>
    `<button aria-pressed="${d===ckDays}" onclick="ckSetDays(${d})">${T('db.nDays',{n:d})}</button>`).join('');
}
function ckSetDays(d){ ckDays = d; renderCockpit(); }
window.ckSetDays = ckSetDays;

function ckRenderSignals(sig){
  const closed = sig.closedWon + sig.closedLost;

  const cards = [
    { id:'acts', k:T('ck.sig.acts'), v:sig.acts, c:'var(--ck-act)',
      s:T('ck.sig.actsSub') },
    { id:'closed', k:T('ck.sig.closed'), v:closed, c:'var(--marine)',
      s:T('db.nWon',{n:sig.closedWon}) + ' · ' + T('db.nLost',{n:sig.closedLost}) },
    { id:'overdue', k:T('ck.sig.overdue'), v:sig.overdue, c:'var(--overdue)',
      s:T('ck.sig.overdueSub') },
    { id:'silent', k:T('ck.sig.silent'), v:sig.silent, c:'var(--prog)',
      s:T('ck.sig.silentSub',{n:SILENT_DAYS}) }
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
      <b>${T('ck.feedEmpty')}</b>
      <p>${T('ck.feedEmptySub',{n:ckDays})}</p>
      ${wider ? `<button class="ck-chip" onclick="ckSetDays(${wider})">${T('ck.viewNDays',{n:wider})}</button>` : ''}
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
      <div class="ck-day-h"><b>${ckDayLabel(d.ts)}</b><span>${ckVN(d.ts)}</span><em>${T('ck.nEvents',{n:d.items.length})}</em></div>
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
  document.getElementById('ckUpCount').textContent = T('ck.nTasks',{n:evs.length});
  if(panel) panel.style.display = (hidden && !evs.length) ? 'none' : '';
  if(!evs.length){
    box.innerHTML = `<div class="ck-empty">
      <b>${T('ck.upEmpty')}</b>
      <p>${T('ck.upEmptySub',{n:CK_UP_DAYS})}</p></div>`;
    return;
  }
  const days = [];
  evs.forEach(e => {
    const last = days[days.length-1];
    if(last && last.ts === e.ts) last.items.push(e); else days.push({ ts:e.ts, items:[e] });
  });
  box.innerHTML = days.map(d => `<div class="ck-day ck-day-up">
      <div class="ck-day-h"><b>${ckUpLabel(d.ts)}</b><span>${ckVN(d.ts)}</span><em>${T('ck.nTasks',{n:d.items.length})}</em></div>
      <div class="ck-day-b">${d.items.map(ckEventRow).join('')}</div>
    </div>`).join('');
}

function ckUpLabel(iso){
  const d = daysSince(iso);
  if(d === -1) return T('common.tomorrow');
  if(d === -2) return T('common.dayAfterTomorrow');
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
    ? `<span class="ck-meta dot ck-approx" title="${T('ck.approxDate')}">~${ckVN(e.ts)}</span>`
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
    ${e.next ? `<span class="ck-ev-next"><b>${T('ck.next')}</b> ${ckEsc(e.next)}</span>` : ''}
  </button>`;
}

function ckRenderFeedFilters(count){
  const nccChips = NCCS.map(n =>
    `<button class="ck-chip" aria-pressed="${ckNccs.indexOf(n)>-1}" onclick="ckToggleNcc('${ckAttr(n)}')">${ckEsc(n)}</button>`).join('');
  const kinds = [['',T('ck.allTypes')],['act',T('common.activity')],['update',T('ck.kind.update')],['new',T('ck.kind.new')],['close',T('sf.closeOpp')]];
  const pics = [''].concat(Array.from(new Set(_cachedEvents(ckDays).map(e => e.pic))).sort());
  document.getElementById('ckFeedCount').textContent = T('ck.nEvents',{n:count});
  document.getElementById('ckFilters').innerHTML = nccChips +
    `<select class="ck-sel" aria-label="${T('ck.filterType')}" onchange="ckSetKind(this.value)">
      ${kinds.map(([v,l]) => `<option value="${v}"${v===ckKind?' selected':''}>${l}</option>`).join('')}
    </select>
    <select class="ck-sel" aria-label="${T('ck.filterRep')}" onchange="ckSetPic(this.value)">
      ${pics.map(p => `<option value="${ckEsc(p)}"${p===ckPic?' selected':''}>${p?ckEsc(picLabel(p)):T('ck.allReps')}</option>`).join('')}
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
  { id:'label',     get label(){ return T('common.account'); } },
  { id:'sales',     get label(){ return T('cu.col.owner'); }, cls:'hide-sm' },
  { id:'segments',  label:'Segment',         cls:'hide-md' },
  { id:'nccs',      get label(){ return T('common.supplierShort'); },             cls:'hide-md' },
  { id:'openCount', get label(){ return T('status.inProgress'); },       cls:'num' },
  { id:'kgThis',    get label(){ return T('ck.kgPotential'); },    cls:'num hide-sm' },
  { id:'lastTouch', get label(){ return T('cu.col.lastAct'); } }
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
    rows.innerHTML = `<div class="ck-empty"><b>${T('ck.custEmpty')}</b>
      <p>${T('ck.custEmptySub')}</p>
      <button class="ck-chip" onclick="ckClearFilters()">${T('ck.clearAll')}</button></div>`;
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
  if(!lastTouch) return { text:T('ck.none'), pct:0, color:'var(--line)', title:T('ck.noActYet') };
  const d = daysSince(lastTouch);
  if(d < 0) return { text:T('ck.scheduled',{d:ckVN(lastTouch)}), pct:0, color:'var(--marine-2)',
                     title:T('ck.scheduledHint') };
  if(d === 0) return { text:T('common.today'), pct:0, color:'var(--marine-2)', title:T('ck.touchedToday') };
  return {
    text: T('ck.daysAgo',{n:d}),
    pct: Math.min(Math.round(d / 60 * 100), 100),
    color: d > SILENT_DAYS ? 'var(--overdue)' : d > 14 ? 'var(--prog)' : 'var(--marine-2)',
    title: T('ck.lastTouch') + ' ' + ckVN(lastTouch)
  };
}

function ckCustRow(p, sig){
  const q = ckQuiet(p.lastTouch);
  const quiet = q.text, pct = q.pct, qc = q.color;
  const flag = sig.overdueCust.has(p.key) ? ' <span class="ck-badge warn">'+T('dash.overdueLower')+'</span>' : '';
  return `<button class="ck-row ck-grid" data-n="${ckEsc(p.label.toLowerCase())}" onclick="openCustomer('${ckAttr(p.key)}')">
    <div class="ck-row-n">${ckEsc(p.label)}${flag}<span class="sub">${T('sf.nOpps',{n:p.projects.length})} · ${T('db.nWon',{n:p.wonCount})} · ${T('db.nLost',{n:p.lostCount})}</span></div>
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
      <div class="ck-stat"><b>${p.openCount}</b><span>${T('status.inProgress')}</span></div>
      <div class="ck-stat"><b>${fmt(p.kgThis)}</b><span>${T('ck.kgPotential')}</span></div>
      <div class="ck-stat"><b>${p.wonCount}/${p.wonCount+p.lostCount}</b><span>${T('ck.wonClosed')}</span></div>
    </div>

    <div class="ck-block">
      <h4>${T('cu.col.owner')}</h4>
      <div class="ck-people">${Object.keys(salesCount).sort((a,b)=>salesCount[b]-salesCount[a]).map(k => `
        <div class="ck-person">
          <span class="avatar" style="width:26px;height:26px;font-size:10px;background:var(--marine-2)">${ckEsc(initials(picLabel(k)))}</span>
          <b>${ckEsc(picLabel(k))}</b><span>${T('sf.nOpps',{n:salesCount[k]})}</span>
        </div>`).join('') || '<div class="ck-mini-t">'+T('ck.noRep')+'</div>'}</div>
    </div>

    <div class="ck-block">
      <h4>${T('ck.segApp')}</h4>
      <div class="ck-tags">${
        Array.from(p.segments).sort().map(s => `<span class="ck-badge">${ckEsc(s)}</span>`).join('') || '—'}</div>
      <div class="ck-mini-t" style="margin-top:9px">${
        ckEsc(Array.from(new Set(p.projects.map(r => r.application).filter(Boolean))).slice(0,6).join(' · ')) || T('ck.noApp')}</div>
    </div>

    <div class="ck-block">
      <h4>${T('ck.productsOffered')} · ${p.products.length}</h4>
      ${p.products.length ? p.products.map(pr => `
        <button class="ck-prod" onclick="openDetail('${pr.id}')">
          <b>${ckEsc(pr.name)}</b><span class="kg">${fmt(pr.kgThis)} KG</span>
          <span class="m"><span class="ck-tag" style="--kc:var(--marine);--kc-bg:var(--marine-soft)"
            title="${ckEsc(pr.stage)}">${ckEsc(tv(pr.stageGroup))}</span>${ckEsc(pr.ncc)}</span>
        </button>`).join('') : '<div class="ck-mini-t">'+T('ck.noOpenOpps')+'</div>'}
    </div>

    <div class="ck-block">
      <h4>${T('ck.recent')} · ${T('ck.nEvents',{n:evs.length})}</h4>
      <div class="ck-mini">${evs.length ? evs.map(e => {
        const m = ckKindMeta(e);
        return `<div class="ck-mini-i" style="--kc:${m.c}">
          <div class="ck-mini-d">${ckVN(e.ts)} · ${m.label} · ${ckEsc(picLabel(e.pic))}</div>
          <div class="ck-mini-t">${ckEsc((e.text||'—').slice(0,140))}</div>
        </div>`;}).join('') : '<div class="ck-mini-t">'+T('ck.noActLogged')+'</div>'}</div>
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
      toast(T('ck.switchedSupplier',{s:best}));
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
