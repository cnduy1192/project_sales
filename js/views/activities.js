/* ==========================================================================
 * Hoạt động khách hàng — danh sách nhóm theo tuần (ISO week)
 * --------------------------------------------------------------------------
 *  renderActs()                 → gom bộ lọc (tab · tìm kiếm · Sales) rồi vẽ
 *  renderActivityList(data)     → vẽ bảng 6 cột, chia block theo tuần
 *  groupActivitiesByWeek(rows)  → [{key, year, week, start, end, rel, items}]
 *  isoWeekOf(date)              → {year, week, key} theo ISO-8601
 *  openActDrawer(id)            → Drawer xem trọn biên bản; "Chỉnh sửa" mở form cũ
 * Cột "Dự án liên kết": ĐÃ gắn → chip ↗ Tên dự án · Stage (deeplink salesfunnel.html);
 *                       CHƯA gắn → nút viền "+ Tạo dự án" (modal tạo nhanh).
 * ========================================================================== */

var actSearch = '';        // chuỗi tìm (đã bỏ dấu, lowercase)
var actSearchRaw = '';     // chuỗi người dùng gõ (để hiển thị lại)
var actSort = 'desc';      // 'desc' = mới nhất trước
var actPic = '';           // lọc theo Sales ('' = tất cả)
var actLimit = 150;        // số dòng vẽ lần đầu, "Hiển thị thêm" tăng dần
var actCollapsed = {};     // tuần đang thu gọn { '2026-W37': true }
var actView = [];          // danh sách id theo đúng thứ tự đang hiển thị (drawer ‹ ›)
var actDrawerId = null;
var actDrawerReturn = null;
const ACT_PAGE = 150;

function actEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function actFold(s){
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
function actPad(n){ return String(n).padStart(2, '0'); }

/* 'YYYY-MM-DD' → Date (giờ địa phương, không lệch múi giờ). Sai định dạng → null */
function actParseDate(v){
  if(!v) return null;
  if(v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if(m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function actFmtDate(d, withYear){
  if(!d) return '';
  return actPad(d.getDate()) + '/' + actPad(d.getMonth() + 1) + (withYear === false ? '' : '/' + d.getFullYear());
}

/* ---------- ISO-8601 week ---------- */
function isoWeekOf(date){
  const d = actParseDate(date); if(!d) return null;
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;               // Thứ Hai = 1 … Chủ nhật = 7
  t.setUTCDate(t.getUTCDate() + 4 - dow);        // Thứ Năm cùng tuần quyết định năm ISO
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year: year, week: week, key: year + '-W' + actPad(week) };
}
function actWeekStart(d){
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() || 7) - 1));
  return s;
}
window.isoWeekOf = isoWeekOf;

/* Gom theo tuần, giữ nguyên thứ tự của mảng vào (đã sắp xếp). Không có ngày → nhóm cuối. */
function groupActivitiesByWeek(rows){
  const thisStart = actWeekStart(TODAY);
  const groups = [], byKey = {};
  let noDate = null;
  rows.forEach(a => {
    const d = actParseDate(a.date);
    if(!d){
      if(!noDate) noDate = { key: 'nodate', rel: null, items: [] };
      noDate.items.push(a); return;
    }
    const w = isoWeekOf(d);
    let g = byKey[w.key];
    if(!g){
      const start = actWeekStart(d), end = new Date(start); end.setDate(end.getDate() + 6);
      const diff = Math.round((start - thisStart) / (7 * 86400000));
      g = byKey[w.key] = { key: w.key, year: w.year, week: w.week, start: start, end: end,
        rel: diff === 0 ? 'this' : diff === -1 ? 'last' : diff === 1 ? 'next' : null, items: [] };
      groups.push(g);
    }
    g.items.push(a);
  });
  if(noDate) groups.push(noDate);
  return groups;
}
window.groupActivitiesByWeek = groupActivitiesByWeek;

/* ---------- Chuẩn hoá dữ liệu hiển thị ---------- */
const ACT_JUNK = /^[\s\-–—_.·•,;:/\\|()*~]*$/;
function actClean(v){
  const s = String(v == null ? '' : v).trim();
  if(!s || ACT_JUNK.test(s)) return '';
  if(/^\(?\s*(không có nội dung|no content|n\/?a|null|undefined)\s*\)?$/i.test(s)) return '';
  return s;
}

const POT_MAP = { Hot:'High', Warm:'Medium', Cold:'Low' };
function potLabel(v){ return POT_MAP[v] || v || ''; }
window.potLabel = potLabel;
/* Mức độ quan tâm: 'high' | 'medium' | 'low' | '' (giá trị cũ Hot/Warm/Cold vẫn đọc được) */
function actInterest(v){
  const k = String(potLabel(v) || '').trim().toLowerCase();
  if(k === 'high' || k === 'cao') return 'high';
  if(k === 'medium' || k === 'trung bình' || k === 'trung binh') return 'medium';
  if(k === 'low' || k === 'thấp' || k === 'thap') return 'low';
  return '';
}
function actInterestBadge(v){
  const k = actInterest(v); if(!k) return '';
  return '<span class="al-int al-int-' + k + '"><i aria-hidden="true"></i>' + T('act.int.' + k) + '</span>';
}

const ACT_TYPE_MAP = { Seminar:'Exhibition', 'Khác':'Call' };
function actType(v){ return ACT_TYPE_MAP[v] || v || 'Call'; }
const ACT_TYPE_ICON = {
  Call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
  Visit: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  Meeting: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.7-3 3.1-5 6-5s5.3 2 6 5M16 5.2a3 3 0 010 5.6M18 14.3c1.5.7 2.6 2.2 3 4.7"/>',
  Email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  Exhibition: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 9h4M7 12h7"/>',
  Note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'
};
function actTypeLabel(t){
  return ({ Call: T('act.t.call'), Visit: T('act.t.visit'), Meeting: T('act.t.meeting'),
            Email: 'Email', Exhibition: T('act.t.exhibition'), Note: T('act.t.note') })[t] || tv(t);
}
function actTypeBadge(raw){
  const t = actType(raw);
  const ico = ACT_TYPE_ICON[t] || ACT_TYPE_ICON.Note;
  return '<span class="al-type al-type-' + actEsc(String(t).toLowerCase()) + '">'
    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ico + '</svg>'
    + actEsc(actTypeLabel(t)) + '</span>';
}

function actUser(pic){ return (typeof USERS !== 'undefined' ? USERS : []).find(x => x.pic === pic) || null; }
function actPicName(pic){
  if(!pic) return '';
  const u = actUser(pic);
  const lbl = typeof picLabel === 'function' ? picLabel(pic) : '';
  return (u && u.name) || lbl || pic;
}
function actInitials(name){
  const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if(w.length >= 2) return (w[0][0] + w[w.length - 1][0]).toUpperCase();
  return String(name || '?').slice(0, 2).toUpperCase();
}
function actAvatar(pic, size){
  const u = actUser(pic), nm = actPicName(pic);
  return '<span class="avatar al-av" aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px;background:'
    + ((u && u.color) || '#8A90A4') + '">' + actEsc(actInitials(nm)) + '</span>';
}
function actNccList(a){
  const list = (a.nccs && a.nccs.length) ? a.nccs : (a.ncc ? [a.ncc] : []);
  return list.map(n => String(n || '').trim()).filter(Boolean);
}

/* Dự án của hoạt động + quyền xem */
function actProjectOf(a){
  const prAll = a.projectId ? RECORDS.find(r => r.id === a.projectId) : null;
  if(!prAll) return { pr: null, locked: false };
  const canSee = typeof ownsRecord !== 'function' || !me
    || (typeof canViewAll === 'function' && canViewAll(me)) || ownsRecord(prAll, me)
    || (typeof teamSeesRecord === 'function' && teamSeesRecord(prAll, me));
  return canSee ? { pr: prAll, locked: false } : { pr: null, locked: true };
}
function actProjectName(pr){
  if(pr.title) return pr.title;
  return (!pr.product || pr.product === '—') ? pr.customer : pr.product;
}
function actProjectStage(pr){
  if(pr.status === 'WON' || pr.status === 'LOST') return tv(pr.status);
  return tv(pr.stage) || '';
}
function actOppUrl(id){
  return typeof salesFunnelUrl === 'function'
    ? salesFunnelUrl({ open: id, ncc: '', q: '', status: '' })
    : 'salesfunnel.html?open=' + encodeURIComponent(id) + '&from=index';
}
function actCanCreateOpp(){
  if(!me || me.role === 'guest') return false;
  return typeof cap !== 'function' || !!cap(me.role).edit;
}

/* Ô "Dự án liên kết / Thao tác" — một trạng thái, một hành động */
function actOppCell(a){
  const p = actProjectOf(a);
  if(p.pr){
    const pr = p.pr, name = actProjectName(pr), stage = actProjectStage(pr);
    const st = pr.status === 'WON' ? 'won' : pr.status === 'LOST' ? 'lost' : 'run';
    return '<a class="al-opp al-opp-' + st + '" href="' + actEsc(actOppUrl(pr.id)) + '" '
      + 'onclick="return actOpenOpp(event,\'' + actEsc(pr.id) + '\')" '
      + 'title="' + actEsc(T('act.openOpp') + ': ' + pr.customer + ' · ' + name + (stage ? ' — ' + stage : '')) + '">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'
      + '<span class="al-opp-t"><span class="al-opp-n">' + actEsc(name) + '</span>'
      + (stage ? '<span class="al-opp-s">' + actEsc(stage) + '</span>' : '') + '</span></a>';
  }
  if(p.locked)
    return '<span class="al-opp al-opp-locked" title="' + actEsc(T('act.otherOppHint')) + '">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>'
      + '<span class="al-opp-t"><span class="al-opp-n">' + actEsc(T('act.otherOpp')) + '</span></span></span>';
  if(actCanCreateOpp())
    return '<button type="button" class="al-new" onclick="event.stopPropagation();createProjectFromAct(\'' + actEsc(a.id) + '\')">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
      + actEsc(T('act.createOpp')) + '</button>';
  return '<span class="al-none">' + actEsc(T('act.noOppLinked')) + '</span>';
}

function actOpenOpp(e, id){
  if(e) e.stopPropagation();
  if(me && me.role === 'guest'){
    if(e) e.preventDefault();
    if(typeof openDetail === 'function') openDetail(id);
    return false;
  }
  return true;   // để thẻ <a> điều hướng (Ctrl/⌘ + click → tab mới)
}
window.actOpenOpp = actOpenOpp;

/* ---------- Bộ lọc ---------- */
function setAF(f){ actFilter = f; actLimit = ACT_PAGE; renderActs(); }
function setActSearch(v){
  actSearchRaw = String(v || '');
  actSearch = actFold(actSearchRaw);
  const inp = document.getElementById('actSearch');
  if(inp && inp.value !== actSearchRaw) inp.value = actSearchRaw;
  actLimit = ACT_PAGE; renderActs();
}
function setActSort(dir){ actSort = dir === 'asc' ? 'asc' : 'desc'; renderActs(); }
function toggleActSort(){ setActSort(actSort === 'desc' ? 'asc' : 'desc'); }
function setActPic(p){ actPic = p || ''; actLimit = ACT_PAGE; renderActs(); }
function actClearFilters(){
  actFilter = 'ALL'; actPic = ''; setActSearch('');
}
function actShowMore(){ actLimit += ACT_PAGE; renderActs(); }
function actToggleWeek(key){ actCollapsed[key] = !actCollapsed[key]; renderActs(); }
Object.assign(window, { setAF, setActSearch, setActSort, toggleActSort, setActPic, actClearFilters, actShowMore, actToggleWeek });

function actsOfProject(id){
  return scopeActs(ACTIVITIES.filter(a => a.projectId === id), me, scopeRecords(RECORDS, me));
}

function actHaystack(a){
  const p = a.projectId ? RECORDS.find(r => r.id === a.projectId) : null;
  return actFold([a.customer, actNccList(a).join(' '), a.pic, actPicName(a.pic), a.note, a.next,
    p ? (p.product + ' ' + (p.title || '')) : ''].join(' '));
}

function actSyncToolbar(base, afterSearch){
  // Tabs + số đếm (đếm theo tìm kiếm & Sales đang chọn, không theo chính tab)
  const n = { ALL: afterSearch.length, FREE: 0, LINKED: 0 };
  afterSearch.forEach(a => { if(a.projectId) n.LINKED++; else n.FREE++; });
  document.querySelectorAll('#actTabs [data-af]').forEach(b => {
    const on = b.dataset.af === actFilter;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    const c = b.querySelector('.al-tab-n'); if(c) c.textContent = n[b.dataset.af];
  });

  // Dropdown Sales — chỉ hiện khi phạm vi xem có từ 2 Sales trở lên
  const sel = document.getElementById('actPic'), wrap = document.getElementById('actPicWrap');
  if(sel){
    const cnt = {};
    base.forEach(a => { if(a.pic) cnt[a.pic] = (cnt[a.pic] || 0) + 1; });
    const pics = Object.keys(cnt).sort((x, y) => actPicName(x).localeCompare(actPicName(y), I18N.locale()));
    if(actPic && !cnt[actPic]) actPic = '';
    if(wrap) wrap.hidden = pics.length < 2 && !actPic;
    sel.innerHTML = '<option value="">' + actEsc(T('act.allSales')) + '</option>'
      + pics.map(p => '<option value="' + actEsc(p) + '"' + (p === actPic ? ' selected' : '') + '>'
        + actEsc(actPicName(p)) + ' (' + cnt[p] + ')</option>').join('');
    sel.value = actPic;
    sel.classList.toggle('is-set', !!actPic);
  }
  const inp = document.getElementById('actSearch');
  if(inp && document.activeElement !== inp && inp.value !== actSearchRaw) inp.value = actSearchRaw;

  // Header cột thời gian: chiều sắp xếp
  const sb = document.getElementById('actSortBtn');
  if(sb){
    const lbl = actSort === 'desc' ? T('act.newestFirst') : T('act.oldestFirst');
    sb.setAttribute('aria-sort', actSort === 'desc' ? 'descending' : 'ascending');
    sb.title = T('act.sortToggle', { d: lbl });
    sb.classList.toggle('asc', actSort === 'asc');
    const st = sb.querySelector('.al-sort-state'); if(st) st.textContent = lbl;
  }
}

function renderActs(){
  const box = document.getElementById('actRows'); if(!box) return;
  const base = visibleActs();
  let rows = actPic ? base.filter(a => a.pic === actPic) : base;
  if(actSearch){
    const terms = actSearch.split(/\s+/).filter(Boolean);
    rows = rows.filter(a => { const h = actHaystack(a); return terms.every(t => h.indexOf(t) >= 0); });
  }
  actSyncToolbar(base, rows);
  if(actFilter === 'LINKED') rows = rows.filter(a => a.projectId);
  if(actFilter === 'FREE') rows = rows.filter(a => !a.projectId);
  rows = rows.slice().sort((x, y) => {
    const dx = x.date || '', dy = y.date || '';
    if(dx === dy) return String(y.id).localeCompare(String(x.id));
    if(!dx) return 1; if(!dy) return -1;          // chưa có ngày luôn nằm cuối
    return actSort === 'asc' ? dx.localeCompare(dy) : dy.localeCompare(dx);
  });
  renderActivityList(rows, { empty: !base.length });
}

/* ---------- Vẽ bảng ---------- */
function actWeekHead(g, collapsed){
  let label, range = '';
  if(g.key === 'nodate') label = T('act.week.noDate');
  else {
    const rel = g.rel ? T('act.week.' + g.rel) : '';
    const wk = (g.year !== isoWeekOf(TODAY).year) ? T('act.week.ny', { w: g.week, y: g.year }) : T('act.week.n', { w: g.week });
    label = rel || wk;
    range = (rel ? '<span class="al-wk-code">W' + actPad(g.week) + '</span>' : '')
      + '<span class="al-wk-range">' + actFmtDate(g.start, g.start.getFullYear() !== g.end.getFullYear())
      + ' – ' + actFmtDate(g.end) + '</span>';
  }
  return '<button type="button" class="al-week-h' + (g.rel === 'this' ? ' is-now' : '') + '" aria-expanded="' + (!collapsed) + '" '
    + 'onclick="actToggleWeek(\'' + g.key + '\')">'
    + '<svg class="al-wk-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
    + '<span class="al-wk-t">' + actEsc(label) + '</span>' + range
    + '<span class="al-wk-n">' + actEsc(T('act.week.count', { n: g.items.length })) + '</span></button>';
}

function actRowHtml(a){
  const d = actParseDate(a.date);
  const note = actClean(a.note), next = actClean(a.next);
  const ncc = actNccList(a);
  const picName = actPicName(a.pic);
  const future = d && d > TODAY;
  const tip = [note, next ? '→ ' + next : ''].filter(Boolean).join('\n');
  return '<div class="al-row al-grid' + (a.id === actDrawerId ? ' is-open' : '') + '" role="row" tabindex="0" data-id="' + actEsc(a.id) + '" '
    + 'onclick="actRowClick(event,\'' + actEsc(a.id) + '\')" onkeydown="actRowKey(event,\'' + actEsc(a.id) + '\')">'
    + '<div class="al-c al-c-time" role="cell">'
      + '<span class="al-date">' + (d ? actFmtDate(d) : actEsc(T('act.week.noDate')))
      + (future ? '<span class="al-plan">' + actEsc(T('act.planned')) + '</span>' : '')
      + (actPending(a) ? '<span class="al-sync" title="' + actEsc(T('act.pendingHint')) + '" aria-label="' + actEsc(T('act.pending')) + '"></span>' : '')
      + '</span>' + actTypeBadge(a.type) + '</div>'
    + '<div class="al-c al-c-acc" role="cell"><b class="al-cust" title="' + actEsc(a.customer) + '">' + actEsc(a.customer || '') + '</b>'
      + (ncc.length ? '<span class="al-ncc" title="' + actEsc(ncc.join(' · ')) + '">' + actEsc(ncc.map(n => tv(n)).join(' · ')) + '</span>' : '') + '</div>'
    + '<div class="al-c al-c-pic" role="cell">' + (a.pic ? actAvatar(a.pic, 24) + '<span class="al-pic-n" title="' + actEsc(picName) + '">' + actEsc(picName) + '</span>' : '') + '</div>'
    + '<div class="al-c al-c-note" role="cell"' + (tip ? ' title="' + actEsc(tip) + '"' : '') + '>'
      + (note ? '<p class="al-note">' + actEsc(note) + '</p>' : (next ? '' : '<p class="al-note is-empty">' + actEsc(T('act.noContent')) + '</p>'))
      + (next ? '<span class="al-next"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' + actEsc(next) + '</span>' : '')
    + '</div>'
    + '<div class="al-c al-c-int" role="cell">' + actInterestBadge(a.potential) + '</div>'
    + '<div class="al-c al-c-opp" role="cell">' + actOppCell(a) + '</div>'
  + '</div>';
}

function renderActivityList(data, opts){
  opts = opts || {};
  const box = document.getElementById('actRows'); if(!box) return;
  data = Array.isArray(data) ? data : [];
  actView = data.map(a => a.id);

  if(!data.length){
    box.innerHTML = opts.empty
      ? '<div class="al-empty"><b>' + actEsc(T('act.empty')) + '</b><p>' + actEsc(T('act.emptyHint')) + '</p></div>'
      : '<div class="al-empty"><b>' + actEsc(T('act.noMatch')) + '</b><p>' + actEsc(T('act.noMatchHint')) + '</p>'
        + '<button type="button" class="btn-ghost" onclick="actClearFilters()">' + actEsc(T('act.clearFilters')) + '</button></div>';
    return;
  }

  const groups = groupActivitiesByWeek(data);
  let budget = actLimit, out = '', open = 0;
  for(const g of groups){
    const collapsed = !!actCollapsed[g.key];
    if(!collapsed) open += g.items.length;
    if(budget <= 0) continue;
    const items = collapsed ? [] : g.items.slice(0, budget);
    budget -= items.length;
    out += '<div class="al-week' + (collapsed ? ' is-collapsed' : '') + '" role="rowgroup" data-week="' + g.key + '">'
      + actWeekHead(g, collapsed) + items.map(actRowHtml).join('') + '</div>';
  }
  const hidden = open - Math.min(open, actLimit);
  if(hidden > 0)
    out += '<div class="al-more"><button type="button" class="btn-ghost" onclick="actShowMore()">'
      + actEsc(T('act.showMore', { n: Math.min(hidden, ACT_PAGE) })) + '</button></div>';
  box.innerHTML = out;
  if(actDrawerId && document.getElementById('actDrawer').classList.contains('open')) actFillDrawer();
}
window.renderActivityList = renderActivityList;

/* ---------- Tương tác dòng ---------- */
function actRowClick(e, id){
  if(e.target.closest('a,button,input,select,label')) return;
  const sel = window.getSelection && String(window.getSelection());
  if(sel && sel.length > 2) return;             // đang bôi đen để copy → không mở drawer
  openActDrawer(id, e.currentTarget);
}
function actRowKey(e, id){
  if(e.target !== e.currentTarget) return;
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openActDrawer(id, e.currentTarget); }
  else if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    const rows = Array.from(document.querySelectorAll('#actRows .al-row'));
    const i = rows.indexOf(e.currentTarget), nx = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if(nx){ e.preventDefault(); nx.focus(); }
  }
}
window.actRowClick = actRowClick; window.actRowKey = actRowKey;

/* ---------- Drawer: trọn biên bản hoạt động ---------- */
function openActDrawer(id, from){
  const a = ACTIVITIES.find(x => x.id === id); if(!a) return;
  actDrawerId = id;
  if(from) actDrawerReturn = from;
  else if(!document.getElementById('actDrawer').classList.contains('open')) actDrawerReturn = document.activeElement;
  actFillDrawer();
  document.getElementById('actDrawerBd').classList.add('open');
  const dr = document.getElementById('actDrawer');
  dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('#actRows .al-row').forEach(r => r.classList.toggle('is-open', r.dataset.id === id));
  dr.focus({ preventScroll: true });
}
function closeActDrawer(keepFocus){
  const dr = document.getElementById('actDrawer'); if(!dr || !dr.classList.contains('open')) return;
  dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true');
  document.getElementById('actDrawerBd').classList.remove('open');
  document.querySelectorAll('#actRows .al-row.is-open').forEach(r => r.classList.remove('is-open'));
  const back = actDrawerId && document.querySelector('#actRows .al-row[data-id="' + CSS.escape(actDrawerId) + '"]');
  actDrawerId = null;
  if(!keepFocus){ const f = back || actDrawerReturn; if(f && f.focus) f.focus({ preventScroll: true }); }
  actDrawerReturn = null;
}
function actDrawerStep(dir){
  const i = actView.indexOf(actDrawerId), id = actView[i + dir];
  if(!id) return;
  openActDrawer(id);
  const row = document.querySelector('#actRows .al-row[data-id="' + CSS.escape(id) + '"]');
  if(row) row.scrollIntoView({ block: 'nearest' });
}
function actDrawerEdit(){
  const id = actDrawerId; closeActDrawer(true);
  if(id) openActEdit(id);
}
function actDrawerCreateOpp(){
  const id = actDrawerId; closeActDrawer(true);
  if(id) createProjectFromAct(id);
}
Object.assign(window, { openActDrawer, closeActDrawer, actDrawerStep, actDrawerEdit, actDrawerCreateOpp });

function actFillDrawer(){
  const a = ACTIVITIES.find(x => x.id === actDrawerId);
  if(!a){ closeActDrawer(); return; }
  const d = actParseDate(a.date);
  const note = actClean(a.note), next = actClean(a.next);
  const ncc = actNccList(a), rel = (a.related || []).filter(Boolean);
  const wk = d ? isoWeekOf(d) : null;
  let dayTxt = '';
  if(d){
    try { dayTxt = d.toLocaleDateString(I18N.locale(), { weekday: 'long' }); } catch(e) {}
    dayTxt = (dayTxt ? dayTxt.charAt(0).toUpperCase() + dayTxt.slice(1) + ', ' : '') + actFmtDate(d);
  }

  document.getElementById('actDrawerTitle').textContent = a.customer || '';
  document.getElementById('actDrawerSub').innerHTML =
    '<span class="al-dr-date">' + actEsc(dayTxt || T('act.week.noDate')) + (wk ? ' · W' + actPad(wk.week) : '') + '</span>'
    + actTypeBadge(a.type) + actInterestBadge(a.potential)
    + (d && d > TODAY ? '<span class="al-plan">' + actEsc(T('act.planned')) + '</span>' : '');

  const i = actView.indexOf(a.id);
  const pv = document.getElementById('actDrPrev'), nx = document.getElementById('actDrNext');
  if(pv) pv.disabled = i <= 0;
  if(nx) nx.disabled = i < 0 || i >= actView.length - 1;
  const pos = document.getElementById('actDrPos');
  if(pos) pos.textContent = i >= 0 ? (i + 1) + ' / ' + actView.length : '';

  const p = actProjectOf(a);
  let opp;
  if(p.pr){
    opp = actOppCell(a);
  } else if(p.locked){
    opp = actOppCell(a);
  } else if(actCanCreateOpp()){
    opp = '<button type="button" class="al-new" onclick="actDrawerCreateOpp()">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
      + actEsc(T('act.createOpp')) + '</button>';
  } else opp = '<span class="al-none">' + actEsc(T('act.noOppLinked')) + '</span>';

  const chips = arr => arr.length
    ? '<span class="al-chips">' + arr.map(x => '<span class="al-chip">' + actEsc(x) + '</span>').join('') + '</span>'
    : '<span class="al-none">' + actEsc(T('act.dr.none')) + '</span>';

  document.getElementById('actDrawerBody').innerHTML =
    '<section class="al-dr-sec"><h4>' + actEsc(T('act.col.content')) + '</h4>'
      + (note ? '<div class="al-dr-note">' + actEsc(note) + '</div>' : '<p class="al-none">' + actEsc(T('act.noContent')) + '</p>')
    + '</section>'
    + (next ? '<section class="al-dr-sec"><h4>' + actEsc(T('act.nextStep')) + '</h4>'
      + '<div class="al-dr-next"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>' + actEsc(next) + '</span></div></section>' : '')
    + '<section class="al-dr-sec"><h4>' + actEsc(T('act.dr.info')) + '</h4><dl class="al-dr-meta">'
      + '<dt>' + actEsc(T('act.col.owner')) + '</dt><dd>' + (a.pic ? '<span class="al-dr-pic">' + actAvatar(a.pic, 22) + actEsc(actPicName(a.pic)) + '</span>' : '<span class="al-none">' + actEsc(T('act.dr.none')) + '</span>') + '</dd>'
      + '<dt>' + actEsc(T('common.supplier')) + '</dt><dd>' + chips(ncc.map(n => tv(n))) + '</dd>'
      + '<dt>' + actEsc(T('act.related')) + '</dt><dd>' + chips(rel.map(r => actPicName(r))) + '</dd>'
      + '<dt>' + actEsc(T('act.dr.opp')) + '</dt><dd>' + opp + '</dd>'
    + '</dl></section>'
    + '<section class="al-dr-sec al-dr-att" id="actDrAttach"></section>';

  const att = document.getElementById('actDrAttach');
  if(att && window.FISG_ATTACH && a.spId){
    FISG_ATTACH.mount('actDrAttach', { type: 'activity', id: a.spId,
      ctx: { pic: a.pic, date: a.date, customer: a.customer }, canUpload: false });
  } else if(att) att.remove();

  const ed = document.getElementById('actDrEdit');
  if(ed) ed.hidden = !canEditAct(a);
}

document.addEventListener('keydown', e => {
  const dr = document.getElementById('actDrawer');
  if(!dr || !dr.classList.contains('open')) return;
  if(document.querySelector('.overlay.open')) return;         // form khác đang mở phía trên
  if(e.key === 'Escape'){ e.preventDefault(); closeActDrawer(); return; }
  const tag = (e.target && e.target.tagName) || '';
  if(/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if(e.key === 'ArrowDown' || e.key === 'j'){ e.preventDefault(); actDrawerStep(1); }
  if(e.key === 'ArrowUp' || e.key === 'k'){ e.preventDefault(); actDrawerStep(-1); }
});

function _actProjIds(){
  const ids={}; (typeof scopeRecords==='function'?scopeRecords(RECORDS,me):RECORDS)
    .forEach(function(r){ ids[r.id]=1; }); return ids;
}
function canEditAct(a){
  if(!a || !me) return false;
  const c = cap(me.role);
  if(!c.edit) return false;
  if(c.admin || c.scope==='all') return true;
  return ownsActivity(a, me, _actProjIds());
}

function canDelAct(a){
  if(!a || !me || !cap(me.role).del) return false;
  return canEditAct(a);
}

function actCreateAllowed(name){
  if(!me) return false;
  const c = cap(me.role);

  if(c.admin || c.scope==='all' || (typeof canViewAll==='function' && canViewAll(me))) return true;
  const owner = (typeof customerOwnerOf==='function') ? customerOwnerOf(name) : '';
  if(!owner) return true;
  return typeof ownsCustomer==='function' && ownsCustomer(name, me);
}
function openActEdit(id){
  var a = ACTIVITIES.find(function(x){ return x.id === id; });
  if(!a) return;
  openActForm({ editId: id, customer: a.customer, ncc: a.ncc,
    nccs: (a.nccs && a.nccs.length) ? a.nccs : (a.ncc ? [a.ncc] : []),
    related: a.related || [], type: a.type, date: a.date,
    potential: a.potential, note: actClean(a.note),
    next: actClean(a.next), projectId: a.projectId || '' });
}
window.openActEdit = openActEdit;



function onActCustomer(){
  const name = (document.getElementById('a-cust').value || '').trim();
  const box = document.getElementById('a-owner');
  if(!box) return;
  if(!name){ box.hidden = true; box.textContent = ''; return; }
  const owner = (typeof customerOwnerOf === 'function') ? customerOwnerOf(name) : '';
  const mine = owner && me && (owner === (me.pic || me.name));
  box.hidden = false;
  box.className = 'owner-note' + (mine ? ' me' : (owner ? '' : ' none'));

  box.innerHTML = !owner
    ? T('act.owner.none')
    : mine
    ? T('act.owner.me')
    : T('act.owner.other', { o: esc4(owner) });
  actApplyGate();
}
window.onActCustomer = onActCustomer;

function actApplyGate(){
  const editing = !!aEditId;
  const fields = document.getElementById('a-fields');
  const gate = document.getElementById('a-gate');
  const saveBtn = document.getElementById('a-save');
  if(editing){
    if(fields) fields.style.display='contents';
    if(gate) gate.hidden=true;
    return;
  }
  const name = (document.getElementById('a-cust').value || '').trim();
  const allowed = !name || actCreateAllowed(name);
  if(fields) fields.style.display = allowed ? 'contents' : 'none';
  if(saveBtn) saveBtn.style.display = allowed ? 'inline-flex' : 'none';
  if(gate){
    if(!allowed){ gate.hidden=false;
      gate.textContent=T('act.gate'); }
    else gate.hidden=true;
  }
}
window.actApplyGate = actApplyGate;

var aEditId = null;
var aNccs = [];
var aRelated = [];

function aRenderChips(boxId, selId, chosen, options, placeholder, remove, editable){
  var box=document.getElementById(boxId); if(!box) return;
  var sel=document.getElementById(selId);
  box.querySelectorAll('.tag').forEach(function(t){ t.remove(); });
  chosen.forEach(function(v){
    var t=document.createElement('span'); t.className='tag';
    t.appendChild(document.createTextNode(v));
    if(editable){
      var b=document.createElement('button'); b.type='button'; b.textContent='×';
      b.setAttribute('aria-label',T('common.removeX',{x:v}));
      b.onclick=function(){ remove(v); };
      t.appendChild(b);
    }
    box.insertBefore(t, sel);
  });
  var low=chosen.map(function(x){ return String(x).toLowerCase(); });
  var rest=options.filter(function(n){ return low.indexOf(String(n).toLowerCase())<0; });
  sel.innerHTML='<option value="">'+placeholder+'</option>'
    +rest.map(function(n){ return '<option>'+esc4(n)+'</option>'; }).join('');
  sel.style.display = editable ? '' : 'none';
  sel.disabled = !editable;
}
function aRenderNcc(editable){
  aRenderChips('a-nccTags','a-ncc', aNccs,
    supplierOptions().concat(OTHER_NCC), '+ '+T('act.addSupplier'), aRmNcc, editable);
}
function aAddNcc(){ var v=document.getElementById('a-ncc').value; if(!v) return;
  if(aNccs.map(function(x){return String(x).toLowerCase();}).indexOf(v.toLowerCase())<0) aNccs.push(v);
  aRenderNcc(true); }
function aRmNcc(v){ aNccs=aNccs.filter(function(x){ return x!==v; }); aRenderNcc(true); }
window.aAddNcc=aAddNcc; window.aRmNcc=aRmNcc;

function aRenderRel(editable){
  var mine=me&&(me.pic||me.name);
  var opts=(typeof ALL_PICS!=='undefined'?ALL_PICS:[]).filter(function(p){ return p!==mine; });
  aRenderChips('a-relTags','a-rel', aRelated, opts, '+ '+T('act.addRelated'), aRmRel, editable);
}
function aAddRel(){ var v=document.getElementById('a-rel').value; if(!v) return;
  if(aRelated.indexOf(v)<0) aRelated.push(v); aRenderRel(true); }
function aRmRel(v){ aRelated=aRelated.filter(function(x){ return x!==v; }); aRenderRel(true); }
window.aAddRel=aAddRel; window.aRmRel=aRmRel;

function openActForm(prefill, origin){
  const p = prefill && typeof prefill === 'object' ? prefill : {};
  srcAct=null;
  aEditId = p.editId || null;
  const editing = !!aEditId;
  const editable = !editing || canEditAct(ACTIVITIES.find(function(x){return x.id===aEditId;}));
  NAV.enter(origin); NAV.renderBack('a-back');
  document.getElementById('a-title').textContent =
    p.title || (editing ? T('act.details') : T('act.workPlan'));
  document.getElementById('a-sub').innerHTML = p.sub ? esc4(p.sub) : '';
  const ncc = p.ncc || formNcc();

  const allCust = (typeof CUSTOMER_DIR !== 'undefined' && CUSTOMER_DIR.length)
    ? CUSTOMER_DIR.map(c => c.name) : LISTS.customers;

  const nrm = (typeof custOwnerKey === 'function')
    ? custOwnerKey : (s => String(s||'').trim().toLowerCase());
  const seenC = new Set(); const custList = [];
  allCust.concat(LISTS.customers).forEach(n => {
    const k = String(n||'').trim(); const nk = nrm(k);
    if(!k || !nk || seenC.has(nk)) return;
    seenC.add(nk); custList.push(k);
  });
  const dc = document.getElementById('dl-cust-all');
  if(dc) dc.innerHTML = custList.slice(0,2000).map(n=>`<option value="${esc4(n)}"></option>`).join('');

  aNccs = (p.nccs && p.nccs.length) ? p.nccs.slice()
        : (ncc && ncc!==OTHER_NCC ? [ncc] : []);
  aRenderNcc(editable);
  document.getElementById('a-date').value = p.date || isoOf(TODAY);
  document.getElementById('a-cust').value = p.customer || '';
  document.getElementById('a-note').value = p.note || '';
  document.getElementById('a-next').value = p.next || '';
  document.getElementById('a-type').value = actType(p.type);
  document.getElementById('a-pot').value = p.potential ? potLabel(p.potential) : 'High';
  onActCustomer();
  const mine=visible().filter(r=>r.status==='IN PROGRESS');

  const list = p.projectId && !mine.some(r=>r.id===p.projectId)
    ? [RECORDS.find(r=>r.id===p.projectId)].filter(Boolean).concat(mine)
    : mine;
  document.getElementById('a-proj').innerHTML='<option value="">— '+T('act.noOppLinked')+' —</option>'
    +list.slice(0,200).map(r=>`<option value="${r.id}"${r.id===p.projectId?' selected':''}>${r.customer} · ${r.product}</option>`).join('');

  aRelated = (p.related && p.related.length) ? p.related.slice() : [];
  aRenderRel(editable);

  ['a-cust','a-type','a-date','a-pot','a-note','a-next','a-proj'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.disabled = !editable;
  });
  const saveBtn=document.getElementById('a-save');
  if(saveBtn){ saveBtn.textContent = editing ? T('common.saveChanges') : T('act.savePlan');
    saveBtn.style.display = editable ? 'inline-flex' : 'none'; }
  const delBtn=document.getElementById('a-del');
  const cur0 = editing ? ACTIVITIES.find(function(x){return x.id===aEditId;}) : null;
  if(delBtn) delBtn.style.display = (editing && canDelAct(cur0)) ? 'inline-flex' : 'none';
  actApplyGate();

  const abox=document.getElementById('a-attach');
  if(abox && window.FISG_ATTACH){
    const cur = editing ? ACTIVITIES.find(function(x){return x.id===aEditId;}) : null;
    abox.style.display='';
    FISG_ATTACH.mount('a-attach', {
      type:'activity',
      id: cur && cur.spId ? cur.spId : '',
      ctx:{ pic:(cur&&cur.pic)||(me&&(me.pic||me.name)), date:(cur&&cur.date), customer:(cur&&cur.customer) },
      canUpload: editable,
      onChange:function(){ renderActs(); } });
  } else if(abox){ abox.style.display='none'; abox.innerHTML=''; }
  document.getElementById('aov').classList.add('open');
  document.getElementById(editable ? (p.customer?'a-note':'a-cust') : 'a-cust').focus();
}
function esc4(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function closeActForm(){
  aEditId = null;
  NAV.back(function(){ document.getElementById('aov').classList.remove('open'); });
}

function deleteAct(){
  const id = aEditId; if(!id) return;
  const a = ACTIVITIES.find(function(x){return x.id===id;});
  if(!a){ closeActForm(); return; }
  if(!canDelAct(a)){ toast(T('act.msg.noDelPerm')); return; }
  if(!confirm(T('act.confirmDel',{c:a.customer,d:new Date(a.date).toLocaleDateString(I18N.locale())}))) return;
  const i = ACTIVITIES.indexOf(a); if(i>=0) ACTIVITIES.splice(i,1);
  if(window.LS && LS.dropAct) LS.dropAct(id);
  closeActForm(); renderActs(); render(); cockpitRefresh();
  if(typeof welcomeRefresh==='function') welcomeRefresh();

  const onSP = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite();
  if(a.spId && onSP){

    FISG_STORE.deleteActivity(a).then(function(){
      toast(T('act.msg.deleted'));
    }).catch(function(e){
      console.warn('[activities] xoá trên SharePoint hỏng:', e&&(e.message||e));

      if(ACTIVITIES.indexOf(a)<0) ACTIVITIES.unshift(a);
      renderActs(); render(); cockpitRefresh();
      toast(T('act.msg.delFailed',{e:e.message||e}));
    });
  } else if(a.spId && !onSP){
    toast(T('act.msg.delLocal'));
  } else {
    toast(T('act.msg.deleted'));
  }
}
window.deleteAct = deleteAct;
function saveAct(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('a-cust')){toast(T('act.msg.enterAccount'));return;}

  const nccList = aNccs.slice();
  const ncc = nccList[0] || OTHER_NCC;
  const relList = aRelated.slice();

  if(aEditId){
    const a=ACTIVITIES.find(function(x){return x.id===aEditId;});
    if(!a){ aEditId=null; closeActForm(); return; }
    if(!canEditAct(a)){ toast(T('act.msg.noEditPerm')); return; }
    const relAdded=relList.filter(function(x){ return (a.related||[]).indexOf(x)<0; });
    a.customer=g('a-cust'); a.ncc=ncc; a.nccs=nccList; a.related=relList;
    a.type=g('a-type'); a.date=g('a-date');
    a.note=g('a-note')||'(không có nội dung)'; a.next=g('a-next')||'—';
    a.potential=g('a-pot'); a.projectId=g('a-proj')||null;
    if(window.LS && LS.updateAct) LS.updateAct(a);
    if(relAdded.length && typeof notifyPlain==='function')
      notifyPlain(T('act.notif.added',{c:esc4(a.customer),t:actType(a.type),d:new Date(a.date).toLocaleDateString(I18N.locale())}), relAdded);

    if(window.FISG_STORE && FISG_STORE.updateActivity && FISG_STORE.canWrite && FISG_STORE.canWrite() && a.spId){

      FISG_STORE.updateActivity(a.spId, { ActivityType:a.type, ActivityDate:a.date,
        Content:a.note, NextStep:a.next, PotentialLevel:a.potential,
        RelatedPeople:(a.related||[]).join('; '), SupplierList:(a.nccs||[]).join('; ') })
        .catch(function(e){ console.warn('[activities] chưa cập nhật được lên SharePoint', e&&(e.message||e)); });
    }
    aEditId=null;
    closeActForm(); renderActs(); render(); cockpitRefresh();
    if(typeof welcomeRefresh==='function') welcomeRefresh();
    toast(T('act.msg.saved'));
    return;
  }

  const a={id:LS.nextActId(),customer:g('a-cust'),pic:me.pic||me.name,
    ncc:ncc,nccs:nccList,related:relList,product:'',type:g('a-type'),date:g('a-date'),note:g('a-note')||'(không có nội dung)',
    next:g('a-next')||'—',potential:g('a-pot'),projectId:g('a-proj')||null};
  ACTIVITIES.unshift(a);
  LS.addAct(a);

  if(relList.length && typeof notifyPlain==='function')
    notifyPlain(T('act.notif.added',{c:esc4(a.customer),t:actType(a.type),d:new Date(a.date).toLocaleDateString(I18N.locale())}), relList);
  if(!LISTS.customers.includes(a.customer))LISTS.customers.push(a.customer);

  if(ncc && ncc!==OTHER_NCC && !LISTS.nccs.some(n=>String(n).trim().toLowerCase()===ncc.toLowerCase())){
    LISTS.nccs.push(ncc); if(window.dedupeNccs) dedupeNccs();
  }
  if(a.projectId){
    const pr=RECORDS.find(r=>r.id===a.projectId);
    if(pr){pr.comments.push({by:a.pic,at:a.date,text:'['+a.type+'] '+a.note+' → '+a.next});
      notify(pr,T('act.notif.logged',{name:`${pr.customer} · ${pr.product}`,note:a.note}));}
  }

  const pend = window.FISG_ATTACH ? FISG_ATTACH.takePending('a-attach') : [];
  closeActForm(); renderActs(); render(); cockpitRefresh();
  if(typeof welcomeRefresh==='function') welcomeRefresh();
  toast(a.projectId?T('act.msg.savedLinked'):T('act.msg.savedFree'));

  pushAct(a, pend);
}
function pushAct(a, pend){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    if(pend && pend.length) toast(T('act.msg.attPending',{n:pend.length}));
    return;
  }
  FISG_STORE.createActivity(a).then(spId=>{

    if(pend && pend.length && window.FISG_ATTACH)
      FISG_ATTACH.uploadFiles('activity', spId, { pic:a.pic, date:a.date, customer:a.customer }, pend);

    const oldId = a.id;
    LS.markSent(oldId, spId);
    a.spId = spId; a.id = 'A-' + spId;
    LS.dropAct(oldId, a.id);
    if(typeof invalidateCockpit==='function') invalidateCockpit();
    renderActs(); cockpitRefresh();
  }).catch(e=>{
    console.warn('[activities] chưa đẩy được lên SharePoint:', e && (e.message||e));
    renderActs();
    toast(T('act.msg.localOnly'));
  });
}

function actPending(a){
  return !!(window.LS && LS.isLocal && LS.isLocal(a) && !a.spId
            && window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite());
}
function createProjectFromAct(aid){
  const a=ACTIVITIES.find(x=>x.id===aid); if(!a)return;
  const d=a.date?new Date(a.date).toLocaleDateString(I18N.locale()):'';
  openCreateProjectModal({
    customerId: (typeof custKey==='function'?custKey(a.customer):a.customer),
    customerName: a.customer, supplier: a.ncc,
    product: a.product||'',
    noteContent: (a.note||'')+(a.next?' → '+a.next:''),
    noteSource: T('act.fromAct',{t:(typeof actType==='function'?actType(a.type):a.type)+(d?' '+d:'')}),
    sourceActivityId: a.id
  });
}

