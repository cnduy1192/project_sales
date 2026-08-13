function custKey(s){ return String(s==null?'':s).trim().toUpperCase(); }
function picKey(s){ return String(s==null?'':s).trim().toUpperCase(); }

let _labels = null;

function _buildLabels(){
  const tallyC = {}, tallyP = {};

  const bump = (map, raw) => {
    const k = custKey(raw); if(!k) return;
    const disp = String(raw).trim();
    (map[k] = map[k] || {})[disp] = (map[k][disp] || 0) + 1;
  };
  RECORDS.forEach(r => { bump(tallyC, r.customer); bump(tallyP, r.pic); });
  ACTIVITIES.forEach(a => { bump(tallyC, a.customer); bump(tallyP, a.pic); });

  const pick = map => {
    const out = {};
    Object.keys(map).forEach(k => {
      out[k] = Object.keys(map[k]).sort((a,b) => map[k][b]-map[k][a] || (a<b?-1:1))[0];
    });
    return out;
  };
  _labels = { cust: pick(tallyC), pic: pick(tallyP) };
}

function resetPicLabels(){ _labels = null; }
window.resetPicLabels = resetPicLabels;
function custLabel(k){ if(!_labels) _buildLabels(); const key=custKey(k); return _labels.cust[key] || key; }
function picLabel(k){ if(!_labels) _buildLabels(); const key=picKey(k); return _labels.pic[key] || key; }

function isoOf(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  return isNaN(dt) ? null
    : dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function todayISO(){ return isoOf(TODAY); }
function shiftISO(n){ const d = new Date(TODAY.getTime()); d.setDate(d.getDate()+n); return isoOf(d); }
function daysSince(iso){ return iso ? Math.round((TODAY - new Date(iso)) / 86400000) : Infinity; }

function normDate(v){
  if(!v) return null;
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[3]+'-'+m[2]+'-'+m[1] : null;
}

function closeStamp(r){
  const explicit = normDate(r.closedAt);
  if(explicit) return { ts: explicit, inferred:false };
  const ups = r.updates || [];
  if(ups.length){ const t = normDate(ups[ups.length-1].at); if(t) return { ts:t, inferred:true }; }
  const c = normDate(r.closing);
  return c ? { ts:c, inferred:true } : null;
}

function cockpitScope(){
  if(typeof scopeRecords !== 'function')
    return { records: RECORDS.slice(), acts: ACTIVITIES.slice() };
  const records = scopeRecords(RECORDS, typeof me !== 'undefined' ? me : null);
  return { records, acts: scopeActs(ACTIVITIES, typeof me !== 'undefined' ? me : null, records) };
}

const EVENT_KINDS = ['act','update','new','close'];

function _rawEvents(days){
  const from = shiftISO(-Math.abs(days)), to = todayISO();
  const inWin = t => !!t && t >= from && t <= to;
  const { records, acts } = cockpitScope();
  const byId = {}; records.forEach(r => byId[r.id] = r);
  const out = [];

  acts.forEach(a => {
    const ts = normDate(a.date);
    if(!inWin(ts)) return;
    const proj = a.projectId ? byId[a.projectId] : null;
    out.push({
      ts, kind:'act', ncc:a.ncc, custKey:custKey(a.customer), custLabel:custLabel(a.customer),
      pic:picKey(a.pic), picLabel:picLabel(a.pic),
      segment: proj ? proj.segment : null, product: a.product || (proj ? proj.product : null),
      projectId: a.projectId || null, actType: a.type, potential: a.potential,
      text: a.note || '', next: a.next || '', status:null, inferred:false
    });
  });

  records.forEach(r => {
    const base = {
      ncc:r.ncc, custKey:custKey(r.customer), custLabel:custLabel(r.customer),
      pic:picKey(r.pic), picLabel:picLabel(r.pic),
      segment:r.segment, product:r.product, projectId:r.id, inferred:false
    };
    (r.updates||[]).forEach(u => {
      const ts = normDate(u.at);
      if(inWin(ts)) out.push(Object.assign({}, base, { ts, kind:'update', text:u.text||'', status:null }));
    });
    const created = normDate(r.created);
    if(inWin(created)) out.push(Object.assign({}, base, { ts:created, kind:'new', text:r.desc||'', status:null }));
    if(r.status !== 'IN PROGRESS'){
      const c = closeStamp(r);
      if(c && inWin(c.ts)){
        const last = (r.comments||[]).slice(-1)[0];
        out.push(Object.assign({}, base, {
          ts:c.ts, kind:'close', status:r.status, inferred:c.inferred,
          text: last ? last.text : (r.desc||'')
        }));
      }
    }
  });

  const rank = { close:0, new:1, act:2, update:3 };
  out.sort((a,b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : rank[a.kind] - rank[b.kind]));
  return out;
}

function filterEvents(list, opts){
  const o = opts || {};
  return list.filter(e =>
    (!o.nccs   || !o.nccs.length   || o.nccs.indexOf(e.ncc) > -1) &&
    (!o.kinds  || !o.kinds.length  || o.kinds.indexOf(e.kind) > -1) &&
    (!o.pic    || e.pic === picKey(o.pic)) &&
    (!o.custKey|| e.custKey === custKey(o.custKey))
  );
}
function buildEvents(days, opts){ return filterEvents(_cachedEvents(days), opts); }

function buildUpcoming(days, opts){
  const from = todayISO(), to = shiftISO(Math.abs(days || 7));
  const { records, acts } = cockpitScope();
  const byId = {}; records.forEach(r => byId[r.id] = r);
  const out = [];
  acts.forEach(a => {
    const ts = normDate(a.date);
    if(!ts || ts <= from || ts > to) return;
    const proj = a.projectId ? byId[a.projectId] : null;
    out.push({
      ts, kind:'act', ncc:a.ncc, custKey:custKey(a.customer), custLabel:custLabel(a.customer),
      pic:picKey(a.pic), picLabel:picLabel(a.pic),
      segment: proj ? proj.segment : null, product: a.product || (proj ? proj.product : null),
      projectId: a.projectId || null, actType: a.type, potential: a.potential,
      text: a.note || '', next: a.next || '', status:null, inferred:false, upcoming:true
    });
  });
  out.sort((a,b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  return filterEvents(out, opts);
}

function _rawCustomerIndex(){
  const { records, acts } = cockpitScope();
  const idx = new Map();
  const slot = raw => {
    const k = custKey(raw);
    if(!idx.has(k)) idx.set(k, {
      key:k, label:custLabel(k), sales:new Set(), segments:new Set(), nccs:new Set(),
      products:[], projects:[], openCount:0, wonCount:0, lostCount:0, kgThis:0, lastTouch:null
    });
    return idx.get(k);
  };
  const touch = (p, iso) => { if(iso && (!p.lastTouch || iso > p.lastTouch)) p.lastTouch = iso; };

  records.forEach(r => {
    const p = slot(r.customer);
    p.projects.push(r);
    if(r.pic) p.sales.add(picKey(r.pic));
    (r.related||[]).forEach(x => x && p.sales.add(picKey(x)));
    if(r.segment) p.segments.add(r.segment);
    if(r.ncc) p.nccs.add(r.ncc);
    if(r.status === 'IN PROGRESS'){
      p.openCount++; p.kgThis += (r.kgThis || 0);
      p.products.push({ name:r.product, stageGroup:STAGE_GROUP[r.stage] || '—', stage:r.stage, ncc:r.ncc, kgThis:r.kgThis||0, id:r.id });
    }
    else if(r.status === 'WON') p.wonCount++;
    else if(r.status === 'LOST') p.lostCount++;
    (r.updates||[]).forEach(u => touch(p, normDate(u.at)));
  });

  acts.forEach(a => {
    const p = slot(a.customer);
    if(a.pic) p.sales.add(picKey(a.pic));
    if(a.ncc) p.nccs.add(a.ncc);
    touch(p, normDate(a.date));
  });

  idx.forEach(p => p.products.sort((x,y) => y.kgThis - x.kgThis));
  return idx;
}

function buildCustomerIndex(opts){
  const idx = _cachedIndex();
  const o = opts || {};
  if(!o.nccs || !o.nccs.length) return idx;
  const out = new Map();
  idx.forEach((p,k) => { if(o.nccs.some(n => p.nccs.has(n))) out.set(k,p); });
  return out;
}

const SILENT_DAYS = 30;

function buildSignals(days){
  const evs = _cachedEvents(days);
  const { records } = cockpitScope();
  const to = todayISO();
  let won = 0, lost = 0, acts = 0;
  evs.forEach(e => {
    if(e.kind === 'act' || e.kind === 'update') acts++;
    else if(e.kind === 'close'){ if(e.status === 'WON') won++; else lost++; }
  });
  const overdue = records.filter(r => r.status === 'IN PROGRESS' && r.closing && normDate(r.closing) < to);
  const overdueCust = new Set(overdue.map(r => custKey(r.customer)));
  const silent = [];
  _cachedIndex().forEach(p => { if(p.openCount > 0 && daysSince(p.lastTouch) > SILENT_DAYS) silent.push(p.key); });
  return {
    acts, closedWon:won, closedLost:lost,
    overdue: overdue.length, overdueIds: new Set(overdue.map(r => r.id)), overdueCust,
    silent: silent.length, silentCust: new Set(silent)
  };
}

let _evCache = {}, _idxCache = null;
function _cachedEvents(days){
  const k = String(Math.abs(days||7));
  if(!_evCache[k]) _evCache[k] = _rawEvents(Number(k));
  return _evCache[k];
}
function _cachedIndex(){
  if(!_idxCache) _idxCache = _rawCustomerIndex();
  return _idxCache;
}
function invalidateCockpit(){ _evCache = {}; _idxCache = null; _labels = null; }
window.invalidateCockpit = invalidateCockpit;

function cockpitAssert(){
  const out = [];
  const keys = new Set();
  RECORDS.forEach(r => keys.add(custKey(r.customer)));
  ACTIVITIES.forEach(a => keys.add(custKey(a.customer)));
  const raw = new Set([].concat(RECORDS.map(r => r.customer), ACTIVITIES.map(a => a.customer)));
  out.push(['gộp tên khách hàng', raw.size + ' chuỗi → ' + keys.size + ' khoá', keys.size < raw.size]);

  const from = shiftISO(-7), to = todayISO();
  const ev = buildEvents(7);
  out.push(['sự kiện trong cửa sổ 7 ngày', ev.length + ' sự kiện, ' + from + ' → ' + to,
    ev.every(e => e.ts >= from && e.ts <= to)]);

  let open = 0; _cachedIndex().forEach(p => open += p.openCount);
  const expect = cockpitScope().records.filter(r => r.status === 'IN PROGRESS').length;
  out.push(['tổng dự án đang chạy', open + ' / ' + expect, open === expect]);

  let scoped = true;
  if(typeof me !== 'undefined' && me && cap(me.role).scope === 'own-pic'){
    const mine = picKey(me.pic);
    const own = ACTIVITIES.filter(a => picKey(a.pic) === mine).map(a => custKey(a.customer));
    const viaAct = new Set(own);
    _cachedIndex().forEach(p => {
      const viaProj = p.projects.some(r => picKey(r.pic) === mine || (r.related||[]).some(x => picKey(x) === mine));
      if(!viaProj && !viaAct.has(p.key)) scoped = false;
    });
  }
  out.push(['phạm vi quyền của sales', (me && me.role) || '—', scoped]);

  out.forEach(([name, detail, ok]) => console.log((ok ? '✓' : '✗') + ' ' + name + ' — ' + detail));
  return out.every(r => r[2]);
}
window.cockpitAssert = cockpitAssert;
