let rpSel = null;
let rpDraft = null;
let rpFilterPic = '';
let rpEditing = null; // id báo cáo đã gửi đang được sửa
let rpWeek = '';      // bộ lọc tuần (theo weekLabel)
let rpQuery = '';     // ô tìm kiếm danh sách báo cáo
let rpLastList = [];  // danh sách đã lọc quyền — để ô tìm kiếm vẽ lại bảng mà không mất focus
let rpProdCache = null;

const RP_COLORS = ['#01426A','#0E7490','#B45309','#6D28D9','#0D9488','#DB2777','#157F3C'];
// Màu cố định theo loại hoạt động / nhóm giai đoạn — dùng chung cho thanh stacked bar và tag trong bảng.
const RP_TYPE_COLORS = { Call:'#2E7DAE', Visit:'#0D9488', Email:'#6D28D9', Exhibition:'#B45309' };
const RP_STAGE_ORDER = ['Tiếp cận','Thử mẫu','Đàm phán','Hoãn','Khác'];
const RP_STAGE_COLORS = { 'Tiếp cận':'#9CC3DD', 'Thử mẫu':'#2E7DAE', 'Đàm phán':'#01426A', 'Hoãn':'#B8BFCC', 'Khác':'#8A90A4' };

const RP_ICONS = {
  chart:  '<path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V7"/><path d="M17 16v-3"/>',
  list:   '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>',
  doc:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  swap:   '<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/>'
};

function rpIsLead(){ return !!(me && cap(me.role).scope === 'all'); }

// Chỉ tác giả (và có quyền soạn báo cáo) mới được sửa báo cáo đã gửi.
function rpIsAuthor(r){
  return !!(r && me && rpCanCompose() && picKey(r.pic) === picKey(me.pic || me.name || ''));
}

function rpCanCompose(){ return !!(me && capReport(me.role) && me.pic); }

// ignorePic = true → bỏ qua bộ lọc sales (dùng để dựng danh sách sales trong dropdown).
function rpSentReports(ignorePic){
  const useSp = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite()
             && typeof REPORTS !== 'undefined';
  const all = useSp ? REPORTS.slice() : (window.LS ? LS.allReports() : []);
  const byPic = r => ignorePic || !rpFilterPic || picKey(r.pic) === picKey(rpFilterPic);
  if(rpIsLead()) return all.filter(byPic);
  // Team Leader: đọc báo cáo của mình + của các sale trong team.
  if(me && typeof isTeamLead === 'function' && isTeamLead(me))
    return all.filter(r => picKey(r.pic) === picKey(me.pic || me.name || '')
                        || (typeof teamMemberPic === 'function' && teamMemberPic(r.pic, me)))
              .filter(byPic);
  return all.filter(r => picKey(r.pic) === picKey((me && me.pic) || ''));
}

function rpCanComment(r){
  if(!me || !r) return false;
  if(cap(me.role).scope === 'all') return true;
  if(typeof isTeamLead === 'function' && isTeamLead(me)
     && typeof teamMemberPic === 'function' && teamMemberPic(r.pic, me)) return true;
  return picKey(r.pic) === picKey(me.pic || '');
}

function renderReports(){
  rpProdCache = null;
  const list = rpSentReports();
  rpRenderTools();
  rpRenderList(list);
  rpRenderPanel(list);

  const grid = document.querySelector('#view-reports .rp-grid');
  const open = !!(rpSel && (rpSel === 'draft' ? rpDraft : list.some(x => x.id === rpSel)));
  if(grid) grid.classList.toggle('has-open', open);
  if(window.markReportsSeen) markReportsSeen();
}
window.renderReports = renderReports;

/* ---------- helpers dùng chung ---------- */

function rpEmpty(icon, title, hint, action){
  return `<div class="rp-empty">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RP_ICONS[icon] || RP_ICONS.list}</svg>
    <b>${title}</b>${hint ? `<p>${hint}</p>` : ''}${action || ''}
  </div>`;
}

function rpAvatar(pic, label){
  const u = (typeof USERS !== 'undefined' && USERS && USERS.find)
    ? USERS.find(x => picKey(x.pic || x.name || '') === picKey(pic || '')) : null;
  const seed = Array.from(String(pic || label || '')).reduce((s,c) => s + c.charCodeAt(0), 0);
  const col = (u && u.color) || RP_COLORS[seed % RP_COLORS.length];
  const name = label || pic || '?';
  const ini = typeof initials === 'function' ? initials(name) : String(name).slice(0,2).toUpperCase();
  return `<span class="avatar rp-av" style="background:${col}" aria-hidden="true">${ckEsc(ini)}</span>`;
}

function rpShortDate(iso){ return iso ? iso.slice(8,10) + '/' + iso.slice(5,7) : '—'; }

// Khoá sắp xếp tuần từ nhãn "dd/mm – dd/mm/yyyy" → "yyyymmdd" của ngày cuối tuần.
function rpWeekKey(label){
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(label || '');
  return m ? m[3] + m[2] + m[1] : '';
}

function rpType(t){ return typeof actType === 'function' ? actType(t) : (t || 'Call'); }

function rpTypeTag(type){
  const k = String(type || '').toLowerCase().replace(/[^a-z]/g, '');
  return `<span class="rp-tag t-${ckEsc(k || 'other')}">${ckEsc(type || '—')}</span>`;
}

function rpChangeTag(c){
  if(c.kind === 'new') return `<span class="rp-tag t-new">${T('rp.chg.new')}</span>`;
  if(c.kind === 'close'){
    const won = c.status === 'WON';
    return `<span class="rp-tag ${won ? 't-won' : 't-lost'}">${ckEsc(tv(c.status || (won ? 'WON' : 'LOST')))}</span>`;
  }
  return `<span class="rp-tag t-update">${T('rp.chg.update')}</span>`;
}

// Tên sản phẩm đang có trong hệ thống — để nhận diện sản phẩm được nhắc trong ghi chú.
function rpProductNames(){
  if(rpProdCache) return rpProdCache;
  const set = new Set();
  (typeof RECORDS !== 'undefined' && RECORDS ? RECORDS : []).forEach(r => {
    const p = String(r.product || '').trim();
    if(p.length >= 3 && p !== '—') set.add(p);
  });
  rpProdCache = Array.from(set).sort((a,b) => b.length - a.length);
  return rpProdCache;
}

// Mã sản phẩm dạng chữ + số (Ps421, PS-445…). Bỏ qua mốc thời gian như T10, Q3, W38.
const RP_CODE_RE = /\b[A-Za-z]{1,4}-?\d{2,5}[A-Za-z]{0,2}\b/g;
function rpProducts(text, known){
  const out = [], seen = [];
  const norm = s => String(s).toLowerCase().replace(/[\s-]/g, '');
  const add = p => {
    const k = norm(p);
    if(!k || seen.some(x => x.indexOf(k) >= 0 || k.indexOf(x) >= 0)) return;
    seen.push(k); out.push(p);
  };
  if(known && known !== '—') add(String(known).trim());
  const s = String(text || '');
  if(s){
    const low = s.toLowerCase();
    rpProductNames().forEach(p => { if(low.indexOf(p.toLowerCase()) >= 0) add(p); });
    (s.match(RP_CODE_RE) || []).forEach(m => {
      if(/^[TQW]\d{1,2}$/i.test(m) || /^[A-Za-z]{1,4}-?(19|20)\d{2}$/.test(m)) return;
      add(m);
    });
  }
  return out.slice(0, 4);
}
function rpChips(list){
  return list.length ? `<span class="rp-chips">${list.map(p => `<span class="rp-chip">${ckEsc(p)}</span>`).join('')}</span>` : '';
}

/* ---------- Danh sách báo cáo (data table) ---------- */

function rpRenderTools(){
  const box = document.getElementById('rpTools');
  box.innerHTML = rpCanCompose()
    ? `<button class="btn-primary" onclick="openReportComposer()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        ${T('wc.composeReport')}</button>`
    : '';
}
function rpSetPic(v){ rpFilterPic = v; rpSel = null; renderReports(); }
window.rpSetPic = rpSetPic;
function rpSetWeek(v){ rpWeek = v; renderReports(); }
window.rpSetWeek = rpSetWeek;
function rpSetQuery(v){ rpQuery = v; rpRenderTable(); }
window.rpSetQuery = rpSetQuery;
function rpClearFilters(){
  rpWeek = ''; rpQuery = ''; rpFilterPic = '';
  renderReports();
}
window.rpClearFilters = rpClearFilters;

function rpRenderList(list){
  const box = document.getElementById('rpList');
  rpLastList = list;

  if(!list.length && !rpDraft && !rpFilterPic){
    box.innerHTML = rpEmpty('doc', T('rp.empty'),
      rpCanCompose() ? T('rp.emptyCompose') : T('rp.emptyLead'),
      rpCanCompose() ? `<button class="rp-btn" onclick="openReportComposer()">${T('wc.composeReport')}</button>` : '');
    return;
  }

  const weeks = Array.from(new Set(list.map(r => r.weekLabel).filter(Boolean)))
    .sort((a,b) => rpWeekKey(b).localeCompare(rpWeekKey(a)));
  if(rpWeek && weeks.indexOf(rpWeek) < 0) rpWeek = '';

  const pics = Array.from(new Set(rpSentReports(true).map(r => picKey(r.pic)))).sort();
  const showPic = pics.length > 1;

  box.innerHTML = `
    <div class="rp-toolbar">
      <label class="rp-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${RP_ICONS.search}</svg>
        <span class="rp-sr">${T('rp.searchAria')}</span>
        <input type="search" id="rpSearch" value="${ckEsc(rpQuery)}" placeholder="${T('rp.searchPh')}" oninput="rpSetQuery(this.value)" autocomplete="off">
      </label>
      <select class="rp-sel" aria-label="${T('rp.filterWeek')}" onchange="rpSetWeek(this.value)">
        <option value="">${T('rp.allWeeks')}</option>
        ${weeks.map(w => `<option value="${ckEsc(w)}"${w === rpWeek ? ' selected' : ''}>${ckEsc(w)}</option>`).join('')}
      </select>
      ${showPic ? `<select class="rp-sel" aria-label="${T('ck.filterRep')}" onchange="rpSetPic(this.value)">
        <option value="">${T('ck.allReps')}</option>
        ${pics.map(p => `<option value="${ckEsc(p)}"${picKey(rpFilterPic) === p ? ' selected' : ''}>${ckEsc(picLabel(p))}</option>`).join('')}
      </select>` : ''}
      <span class="rp-tb-count" id="rpCount" aria-live="polite"></span>
    </div>
    <div id="rpTable"></div>`;
  rpRenderTable();
}

function rpMatches(r, q){
  if(!q) return true;
  const hay = [r.picLabel, r.pic, r.weekLabel, r.note]
    .concat((r.doneActs || []).map(a => a.custLabel + ' ' + (a.note || '')))
    .concat((r.projectChanges || []).map(c => c.custLabel + ' ' + (c.product || '')))
    .join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.indexOf(t) >= 0);
}

function rpRenderTable(){
  const box = document.getElementById('rpTable');
  if(!box) return;
  const q = rpQuery.trim();
  const rows = rpLastList.filter(r => (!rpWeek || r.weekLabel === rpWeek) && rpMatches(r, q));
  const cnt = document.getElementById('rpCount');
  if(cnt) cnt.textContent = T('rp.count', { n: rows.length });

  const view = T('rp.view');
  const draftRow = rpDraft ? `
    <tr class="is-draft" onclick="rpSelect('draft')">
      <td><div class="rp-who">${rpAvatar(rpDraft.pic, rpDraft.picLabel)}<b>${ckEsc(rpDraft.picLabel)}</b><span class="rp-pill draft">${T('rp.draft')}</span></div></td>
      <td class="rp-mono" data-label="${T('rp.col.week')}">${ckEsc(rpDraft.weekLabel)}</td>
      <td class="rp-mono rp-muted" data-label="${T('rp.col.submitted')}">${T('rp.unsent')}</td>
      <td class="num" data-label="${T('rp.col.acts')}">${rpDraft.stats.done}</td>
      <td class="num" data-label="${T('rp.col.changes')}">${rpDraft.stats.changes}</td>
      <td class="act"><button class="rp-btn" onclick="event.stopPropagation();rpSelect('draft')">${view}</button></td>
    </tr>` : '';

  if(!rows.length && !rpDraft){
    box.innerHTML = rpEmpty('search', T('rp.noMatch'), T('rp.noMatchHint'),
      `<button class="rp-btn" onclick="rpClearFilters()">${T('rp.clearFilters')}</button>`);
    return;
  }

  box.innerHTML = `<div class="rp-scroll"><table class="rp-table rp-reports">
    <thead><tr>
      <th scope="col">${T('rp.col.rep')}</th>
      <th scope="col">${T('rp.col.week')}</th>
      <th scope="col">${T('rp.col.submitted')}</th>
      <th scope="col" class="num">${T('rp.col.acts')}</th>
      <th scope="col" class="num">${T('rp.col.changes')}</th>
      <th scope="col" class="act"><span class="rp-sr">${T('rp.col.action')}</span></th>
    </tr></thead>
    <tbody>${draftRow}${rows.map(r => {
      const nc = (r.comments || []).length;
      const s = r.stats || {};
      return `<tr onclick="rpSelect('${ckAttr(r.id)}')">
        <td><div class="rp-who">${rpAvatar(r.pic, r.picLabel)}<b>${ckEsc(r.picLabel || r.pic || '—')}</b>${nc
          ? `<span class="rp-pill" title="${T('rp.nReplies',{n:nc})}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>${nc}</span>` : ''}</div></td>
        <td class="rp-mono" data-label="${T('rp.col.week')}">${ckEsc(r.weekLabel || '—')}</td>
        <td class="rp-mono" data-label="${T('rp.col.submitted')}">${ckVN(r.createdAt)}${r.editedAt ? ` <span class="rp-muted">· ${T('rp.edited')}</span>` : ''}</td>
        <td class="num" data-label="${T('rp.col.acts')}"><b>${s.done || 0}</b>${s.missed ? `<span class="rp-miss">${T('rp.nMissed',{n:s.missed})}</span>` : ''}</td>
        <td class="num" data-label="${T('rp.col.changes')}"><b>${s.changes || 0}</b></td>
        <td class="act"><button class="rp-btn" onclick="event.stopPropagation();rpSelect('${ckAttr(r.id)}')">${view}</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function rpDraftDirty(){
  if(!rpDraft) return false;
  const el = document.getElementById('rpNote');
  return !!(el && el.value.trim());
}
function rpSelect(id){
  if(rpSel === 'draft' && id !== 'draft' && rpDraftDirty()
     && !confirm(T('rp.confirmLeave'))) return;
  if(id !== 'draft' && rpSel === 'draft') rpDraft = null;
  rpSel = id;
  renderReports();
  const top = document.getElementById('view-reports');
  if(id && top && top.scrollIntoView) top.scrollIntoView({ block:'start' });
}
window.rpSelect = rpSelect;

function openReportComposer(){

  if(!rpCanCompose()){
    toast(me && cap(me.role).scope === 'all'
      ? T('rp.msg.leadReadOnly')
      : T('rp.msg.salesOnly'));
    go('reports'); renderReports(); return;
  }
  rpDraft = buildReport(me.pic, todayISO());
  rpSel = 'draft';
  go('reports');
  renderReports();
  const t = document.getElementById('rpNote'); if(t) t.focus();
}
window.openReportComposer = openReportComposer;

/* ---------- Chi tiết báo cáo ---------- */

function rpStack(items, unit){
  const total = items.reduce((s,i) => s + i.value, 0);
  const pct = v => Math.round(100 * v / total);
  const aria = items.map(i => `${i.label}: ${i.value} (${pct(i.value)}%)`).join(', ');
  return `<div class="rp-stack" role="img" aria-label="${ckEsc(T('rp.totalUnit',{n:total,u:unit}) + '. ' + aria)}">
      ${items.map(i => `<span style="flex:${i.value} 1 0;background:${i.color}" title="${ckEsc(i.label)} · ${i.value} (${pct(i.value)}%)"></span>`).join('')}
    </div>
    <ul class="rp-leg">${items.map(i => `<li><i style="background:${i.color}"></i><span>${ckEsc(i.label)}</span><b>${i.value}</b><small>${pct(i.value)}%</small></li>`).join('')}</ul>`;
}

function rpAnalytics(r){
  // Loại hoạt động: đếm theo cùng nhãn với tag trong bảng (actType).
  const byType = {};
  (r.doneActs || []).forEach(a => { const t = rpType(a.type); byType[t] = (byType[t] || 0) + 1; });
  const acts = Object.keys(byType).sort((a,b) => byType[b] - byType[a]).map((k,i) =>
    ({ label:k, value:byType[k], color: RP_TYPE_COLORS[k] || RP_COLORS[(i + 3) % RP_COLORS.length] }));

  let stages = [];
  try{
    const data = reportCharts(r, r.pic);
    const m = {}; data.openByStage.forEach(x => { m[x.label] = x.value; });
    stages = Object.keys(m)
      .sort((a,b) => (RP_STAGE_ORDER.indexOf(a) + 1 || 99) - (RP_STAGE_ORDER.indexOf(b) + 1 || 99))
      .map(k => ({ label: tv(k), value: m[k], color: RP_STAGE_COLORS[k] || '#8A90A4' }));
  }catch(e){ console.warn('[reports] openByStage:', e && (e.message || e)); }

  const card = (title, items, unit, emptyTitle, emptyHint) => {
    const total = items.reduce((s,i) => s + i.value, 0);
    return `<div class="rp-card">
      <div class="rp-card-h"><h4>${title}</h4>${total ? `<span>${T('rp.totalUnit',{n:total,u:unit})}</span>` : ''}</div>
      ${total ? rpStack(items, unit) : rpEmpty('chart', emptyTitle, emptyHint)}
    </div>`;
  };
  return `<div class="rp-analytics">
    ${card(T('rp.actMix'), acts, T('rp.actsLower'), T('rp.noDoneActs'), T('rp.emptyActsHint'))}
    ${card(T('rp.openByStage'), stages, T('db.oppsLower'), T('ck.noOpenOpps'), T('rp.emptyStageHint'))}
  </div>`;
}

function rpSection(title, count, body, extra){
  return `<section class="rp-sec">
    <header class="rp-sec-h"><h4>${title}</h4><span class="rp-count">${count}</span>${extra || ''}</header>
    ${body}
  </section>`;
}

/* ---------- Deep-link sang trang Hoạt động (view 'acts') ----------
   Ứng dụng là SPA (một trang index.html), trang Hoạt động mở bằng go('acts').
   Dùng <a href> thật để chuột giữa / Ctrl-⌘ / "Mở trong tab mới" giữ nguyên
   màn hình báo cáo quản lý đang xem; click thường điều hướng ngay trong trang,
   lọc theo khách hàng và mở đúng hoạt động (nếu có activity_id).            */
function rpActUrl(o){
  var p = new URLSearchParams();
  p.set('open', 'acts');
  if(o.client){ p.set('client_id', o.client); p.set('q', o.client); }
  if(o.sales) p.set('sales_id', o.sales);
  if(o.actId) p.set('activity_id', o.actId);
  if(o.date)  p.set('date', o.date);
  return 'index.html?' + p.toString();
}
function rpGoActivity(e, client, actId){
  // Chuột giữa / phím bổ trợ → để trình duyệt tự mở tab mới bằng href sẵn có.
  if(e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return true;
  if(e && e.preventDefault) e.preventDefault();
  try{
    if(window.go) go('acts');
    if(typeof setActSearch === 'function') setActSearch(client || '');
    if(actId && typeof openActEdit === 'function') openActEdit(actId);
  }catch(err){ console.warn('[reports] mở hoạt động lỗi:', err && (err.message || err)); }
  return false;
}
window.rpGoActivity = rpGoActivity;

// Ô Khách hàng dạng liên kết: màu chủ đạo, gạch chân khi hover, kèm icon ↗ hiện khi hover.
function rpAccountCell(o){
  var label = o.label || '—';
  var url   = rpActUrl(o);
  return `<a class="rp-acc-link" href="${ckEsc(url)}"
      onclick="return rpGoActivity(event, '${ckAttr(o.client || '')}', '${ckAttr(o.actId || '')}')"
      title="${T('rp.openInActs',{c:label})}">
      <span class="rp-acc-n">${ckEsc(label)}</span>
      <svg class="rp-acc-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>
    </a>`;
}
function rpRowAttrs(o){
  return `class="rp-linkrow" data-sales-id="${ckEsc(o.sales || '')}" data-client-id="${ckEsc(o.client || '')}"`
    + ` data-activity-id="${ckEsc(o.actId || '')}" data-date="${ckEsc(o.date || '')}"`;
}

function rpActTable(items, emptyTitle, emptyHint, pic){
  if(!items.length) return `<div class="rp-frame">${rpEmpty('list', emptyTitle, emptyHint)}</div>`;
  return `<div class="rp-frame"><table class="rp-table rp-log">
    <colgroup><col class="c-date"><col class="c-acc"><col class="c-type"><col></colgroup>
    <thead><tr>
      <th scope="col">${T('common.date')}</th><th scope="col">${T('common.account')}</th>
      <th scope="col">${T('rp.x.type')}</th><th scope="col">${T('rp.col.summary')}</th>
    </tr></thead>
    <tbody>${items.map(a => {
      const client = a.custLabel || a.customer || '';
      const link = { label: client || '—', client: client, sales: pic || '', actId: a.id || '', date: a.date || '' };
      return `<tr ${rpRowAttrs(link)}>
      <td class="rp-mono rp-date" title="${ckVN(a.date)}">${rpShortDate(a.date)}</td>
      <td class="rp-acc">${rpAccountCell(link)}</td>
      <td class="rp-type">${rpTypeTag(rpType(a.type))}</td>
      <td class="rp-sumcell"><span class="rp-note-t">${ckEsc(a.note || '—')}</span>${a.next
        ? `<span class="rp-next">${T('act.nextStep')}: ${ckEsc(a.next)}</span>` : ''}${rpChips(rpProducts((a.note || '') + ' ' + (a.next || '')))}</td>
    </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function rpChangeTable(items, pic){
  if(!items.length) return `<div class="rp-frame">${rpEmpty('swap', T('rp.emptyChanges'), T('rp.emptyChangesHint'))}</div>`;
  return `<div class="rp-frame"><table class="rp-table rp-log">
    <colgroup><col class="c-date"><col class="c-acc"><col class="c-type"><col></colgroup>
    <thead><tr>
      <th scope="col">${T('common.date')}</th><th scope="col">${T('common.account')}</th>
      <th scope="col">${T('rp.x.type')}</th><th scope="col">${T('rp.col.summary')}</th>
    </tr></thead>
    <tbody>${items.map(c => {
      const client = c.custLabel || c.customer || '';
      const link = { label: client || '—', client: client, sales: pic || '', actId: '', date: c.ts || '' };
      return `<tr ${rpRowAttrs(link)}>
      <td class="rp-mono rp-date" title="${ckVN(c.ts)}">${rpShortDate(c.ts)}</td>
      <td class="rp-acc">${rpAccountCell(link)}</td>
      <td class="rp-type">${rpChangeTag(c)}</td>
      <td class="rp-sumcell"><span class="rp-note-t">${c.text ? ckEsc(c.text.slice(0,160)) + (c.text.length > 160 ? '…' : '') : '<span class="rp-muted">—</span>'}</span>${rpChips(rpProducts(c.text, c.product))}</td>
    </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function rpRenderPanel(list){
  const box = document.getElementById('rpPanel');
  const draft = rpSel === 'draft';
  const r = draft ? rpDraft : list.filter(x => x.id === rpSel)[0];
  const editing = !draft && !!r && rpEditing === r.id && rpIsAuthor(r);

  if(!r){
    box.innerHTML = rpEmpty('doc', T('rp.pick'), rpCanCompose() ? T('rp.pickCompose') : T('rp.pickLead'));
    return;
  }

  const s = r.stats || {};
  const kpi = (v, label, tone) =>
    `<div class="rp-kpi${v && tone ? ' ' + tone : ''}"><b>${v || 0}</b><span>${label}</span></div>`;
  const changes = r.projectChanges || [];
  const shown = changes.slice(0, 15);

  box.innerHTML = `
    <div class="rp-head">
      <div class="rp-head-l">
        <button class="rp-back" onclick="rpSelect(null)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${T('rp.all')}</button>
        <div class="rp-title">
          ${rpAvatar(r.pic, r.picLabel)}
          <h3>${ckEsc(r.picLabel || r.pic || '—')}</h3>
          ${draft ? `<span class="rp-pill draft">${T('rp.draft')}</span>` : ''}
        </div>
        <div class="rp-meta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
          <span>${ckEsc(r.weekLabel || '—')}</span><span class="sep">·</span>
          <span>${draft ? T('rp.draftMeta')
            : T('rp.sentOn',{d:ckVN(r.createdAt)}) + (r.editedAt ? ' · ' + T('rp.edited') + ' ' + ckVN(r.editedAt) : '')}</span>
        </div>
      </div>
      <div class="rp-head-r">
        <button class="rp-btn" onclick="rpExportExcel('${draft ? 'draft' : ckAttr(r.id)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
          ${T('common.exportExcel')}</button>
      </div>
    </div>

    <div class="rp-kpis">
      ${kpi(s.done, T('wc.done'))}
      ${kpi(s.missed, T('rp.notDone'), 'is-warn')}
      ${kpi(s.changes, T('wc.sec.oppChanges'))}
      ${kpi(s.overdue, T('db.kpi.overdue'), 'is-alert')}
    </div>

    ${rpAnalytics(r)}

    ${rpSection(T('rp.doneActs'), (r.doneActs || []).length,
      rpActTable(r.doneActs || [], T('rp.noDoneActs'), T('rp.emptyActsHint'), r.pic))}

    ${(r.missedActs || []).length ? rpSection(T('rp.missedPlans'), r.missedActs.length,
      rpActTable(r.missedActs, T('rp.emptyMissed'), '', r.pic)) : ''}

    ${rpSection(T('wc.sec.oppChanges'), changes.length, rpChangeTable(shown, r.pic),
      changes.length > shown.length ? `<em>${T('rp.showingOf',{n:shown.length,t:changes.length})}</em>` : '')}

    <div class="rp-field">
      <label for="rpNote">${T('rp.content')}</label>
      ${(draft || editing)
        ? `<textarea id="rpNote" placeholder="${T('rp.contentPh')}">${editing ? ckEsc(r.note || '') : ''}</textarea>`
        : `<div class="rp-note-body">${ckEsc(r.note || T('rp.noContent'))}</div>`}
    </div>

    <div class="att-box" id="rp-attach"></div>
    ${draft ? `<div class="rp-send">
      <button class="btn-primary" onclick="sendReport()">${T('common.send')}</button>
      <button class="btn-ghost" onclick="rpDiscard()">${T('common.cancel')}</button>
    </div>`
    : editing ? `<div class="rp-send">
      <button class="btn-primary" onclick="rpSaveReport('${ckAttr(r.id)}')">${T('common.saveChanges')}</button>
      <button class="btn-ghost" onclick="rpCancelEdit()">${T('common.cancel')}</button>
    </div>`
    : rpThreadHtml(r) + (rpIsAuthor(r) ? `<div class="rp-editbar">
      <button class="rp-btn" onclick="rpEditReport('${ckAttr(r.id)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        ${T('rp.edit')}</button>
    </div>` : '')}`;

  if(window.FISG_ATTACH && document.getElementById('rp-attach')){
    FISG_ATTACH.mount('rp-attach', { type:'report',
      id: draft ? '' : r.id,
      ctx:{ pic:r.pic || (me&&(me.pic||me.name)), date:r.createdAt || todayISO() },
      canUpload: (draft || editing) ? true : rpCanComment(r) });
  }
}

function rpThreadHtml(r){
  const cmts = r.comments || [];
  const thread = cmts.length
    ? cmts.map(c => {
        const mine = me && picKey(c.by) === picKey(me.pic || me.name);
        const lead = c.role && cap(c.role).scope === 'all';
        return `<div class="rp-cmt${mine?' me':''}">
          <div class="rp-cmt-h"><b>${ckEsc(picLabel(c.by) || c.by || '—')}</b>
            ${lead ? '<span class="rp-cmt-tag">'+T('rp.manager')+'</span>' : ''}
            <span>${ckVN(c.at)}</span></div>
          <div class="rp-cmt-b">${ckEsc(c.text || '')}</div>
        </div>`;
      }).join('')
    : '<div class="rp-thread-empty">'+T('rp.noReplies')+'</div>';

  const canComment = rpCanComment(r);
  const box = canComment
    ? `<div class="rp-cmt-form">
         <textarea id="rpCmt" placeholder="${cap(me.role).scope==='all'
            ? T('rp.replyTo',{p:ckEsc(r.picLabel)}) : T('rp.replyMgr')}" rows="2"></textarea>
         <button class="btn-primary" onclick="rpPostComment('${ckAttr(r.id)}')">${T('rp.sendReply')}</button>
       </div>`
    : '';

  return `<div class="rp-thread">
    <header class="rp-sec-h"><h4>${T('rp.discussion')}</h4><span class="rp-count">${cmts.length}</span></header>
    <div class="rp-thread-list">${thread}</div>
    ${box}
  </div>`;
}

function rpPostComment(code){
  const el = document.getElementById('rpCmt');
  const text = el ? el.value.trim() : '';
  if(!text){ toast(T('rp.msg.enterReply')); return; }
  const r = rpSentReports().find(x => x.id === code);
  if(!r || !rpCanComment(r)){ toast(T('rp.msg.noReplyPerm')); return; }
  if(!(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite())){
    toast(T('rp.msg.replyNoSignIn')); return;
  }
  const btn = el && el.parentElement.querySelector('button');
  if(btn){ btn.disabled = true; btn.textContent = T('common.sending'); }

  const by = (me && (me.pic || me.name)) || '';
  const linkCode = r.code || r.id;
  r.comments = (r.comments || []).concat([{ by:by, role:me.role, at:todayISO(), text:text }]);
  renderReports();
  FISG_STORE.addReportComment(linkCode, text, by, me.role).then(()=>{
    if(window.refreshNotifs) refreshNotifs();
    renderReports();
    toast(T('rp.msg.replySent'));
  }).catch(e=>{
    console.warn('[reports] gửi phản hồi hỏng:', e && (e.message||e));
    toast(T('rp.msg.replyFailed',{e:e.message||e}));
    renderReports();
  });
}
window.rpPostComment = rpPostComment;

function sendReport(){
  if(!rpDraft) return;
  const note = (document.getElementById('rpNote')||{}).value || '';
  rpDraft.note = note.trim();
  rpDraft.to = (window.reportRecipients ? reportRecipients(me) : managerNames());
  if(!rpDraft.id) rpDraft.id = 'R-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random()*46656).toString(36).toUpperCase();
  rpDraft.createdAt = rpDraft.createdAt || todayISO();

  const draft = rpDraft;

  const pend = window.FISG_ATTACH ? FISG_ATTACH.takePending('rp-attach') : [];
  if(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite()){
    const btn = document.querySelector('.rp-send .btn-primary');
    if(btn){ btn.disabled = true; btn.textContent = T('common.sending'); }
    FISG_STORE.sendReportToSP(draft).then(newId=>{
      if(pend.length && window.FISG_ATTACH)
        FISG_ATTACH.uploadFiles('report', newId, { pic:draft.pic, date:draft.createdAt }, pend)
          .then(function(){ if(window.loadAttachments) return FISG_STORE.loadAttachments(); })
          .then(function(){ renderReports(); });
      rpDraft = null; rpSel = newId;
      if(window.refreshNotifs) refreshNotifs();
      renderReports();
      toast(T('rp.msg.sent',{w:draft.weekLabel}));
    }).catch(e=>{
      console.warn('[reports] gửi báo cáo hỏng:', e && (e.message||e));
      toast(T('rp.msg.sendFailed',{e:e.message||e}));
      if(btn){ btn.disabled = false; btn.textContent = T('rp.sendToMgr'); }
    });
    return;
  }

  const saved = LS.addReport(draft);
  notifyPlain(T('notif.reportSent',{w:saved.weekLabel}), saved.to);
  rpDraft = null; rpSel = saved.id;
  renderReports();
  toast(T('rp.msg.savedLocal'));
}
window.sendReport = sendReport;

function rpExportExcel(code){
  const r = code === 'draft' ? rpDraft : rpSentReports().find(x => x.id === code);
  if(!r){ if(window.toast) toast(T('rp.msg.notFoundExport')); return; }
  if(typeof XLSX === 'undefined'){ if(window.toast) toast(T('rp.msg.xlsxLoading')); return; }
  const vn = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString(I18N.locale()) : (iso || ''); };
  const s = r.stats || {};
  const rows = [];
  const push = (...c) => rows.push(c);

  push(T('rp.x.title'), r.weekLabel || '');
  push(T('rp.x.author'), r.picLabel || r.pic || '');
  push(T('rp.x.sentDate'), vn(r.createdAt));
  push();
  push(T('wc.done'), s.done || 0, T('rp.notDone'), s.missed || 0, T('wc.sec.oppChanges'), s.changes || 0, T('db.kpi.overdue'), s.overdue || 0);
  push();

  push(T('rp.x.doneActs'));
  push(T('common.date'), T('common.account'), T('rp.x.type'), T('rp.x.note'), T('act.nextStep'));
  (r.doneActs || []).forEach(a => push(vn(a.date), a.custLabel || a.customer || '', a.type || '', a.note || '', a.next || ''));
  push();

  push(T('rp.x.missed'));
  push(T('common.date'), T('common.account'), T('rp.x.note'));
  (r.missedActs || []).forEach(a => push(vn(a.date), a.custLabel || a.customer || '', a.note || ''));
  push();

  push(T('rp.x.changes'));
  push(T('common.date'), T('common.account'), T('common.product'), T('rp.x.note'));
  (r.projectChanges || []).forEach(c => push(vn(c.ts), c.custLabel || '', c.product || '', c.text || ''));
  push();

  push(T('rp.x.content'));
  push(r.note || T('rp.noContent'));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 13 }, { wch: 30 }, { wch: 14 }, { wch: 44 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, T('rp.x.sheet'));
  const safe = String(r.picLabel || r.pic || 'bao-cao').replace(/[^\p{L}\p{N}]+/gu, '_');
  const wk = String(r.weekLabel || '').replace(/[^\p{L}\p{N}]+/gu, '_');
  XLSX.writeFile(wb, 'BaoCao_' + safe + '_' + wk + '.xlsx');
}
window.rpExportExcel = rpExportExcel;

function rpDiscard(){
  if(rpDraftDirty() && !confirm(T('rp.confirmDiscard'))) return;
  rpDraft = null; rpSel = null; renderReports();
}
window.rpDiscard = rpDiscard;

// --- Sửa báo cáo đã gửi (chỉ nội dung + đính kèm) ---
function rpEditReport(id){
  const r = rpSentReports().find(x => x.id === id);
  if(!r){ toast(T('rp.msg.notFound')); return; }
  if(!rpIsAuthor(r)){ toast(T('rp.msg.authorOnly')); return; }
  rpEditing = id; rpSel = id;
  renderReports();
}
window.rpEditReport = rpEditReport;

function rpCancelEdit(){ rpEditing = null; renderReports(); }
window.rpCancelEdit = rpCancelEdit;

function rpSaveReport(id){
  const r = rpSentReports().find(x => x.id === id);
  if(!r){ toast(T('rp.msg.notFound')); return; }
  const note = ((document.getElementById('rpNote')||{}).value || '').trim();

  if(window.FISG_STORE && FISG_STORE.updateReport && FISG_STORE.canWrite && FISG_STORE.canWrite()){
    const btn = document.querySelector('.rp-send .btn-primary');
    if(btn){ btn.disabled = true; btn.textContent = T('common.saving'); }
    FISG_STORE.updateReport(r, note).then(function(){
      rpEditing = null;
      if(window.FISG_STORE.loadReports) FISG_STORE.loadReports().then(renderReports).catch(renderReports);
      else renderReports();
      toast(T('rp.msg.updated',{w:r.weekLabel}));
    }).catch(function(e){
      console.warn('[reports] sửa báo cáo hỏng:', e && (e.message||e));
      toast(T('rp.msg.saveFailed',{e:e && (e.message||e)}));
      if(btn){ btn.disabled = false; btn.textContent = T('common.saveChanges'); }
    });
    return;
  }

  // Ngoại tuyến: lưu trên máy nếu có LS.
  r.note = note; r.editedAt = todayISO();
  if(window.LS && LS.updateReport) LS.updateReport(r);
  rpEditing = null; renderReports();
  toast(T('rp.msg.editLocal'));
}
window.rpSaveReport = rpSaveReport;
