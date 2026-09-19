let wcModeOverride = null;
let wcLastFocus = null;

const WC_MODES = [
  { id:'start', get label(){ return I18N.t('wc.mode.start'); }, get sub(){ return I18N.t('wc.mode.startSub'); },
    c:'var(--marine)',  bg:'var(--marine-soft)', bd:'var(--marine-line)',
    icon:'<path d="M12 5v14M5 12h14"/>' },
  { id:'mid',   get label(){ return I18N.t('wc.mode.mid'); }, get sub(){ return I18N.t('wc.mode.midSub'); },
    c:'var(--bas)',     bg:'var(--bas-bg)',      bd:'rgba(14,116,144,.28)',
    icon:'<path d="M5 12l5 5L20 7"/>' },
  { id:'end',   get label(){ return I18N.t('wc.mode.end'); }, get sub(){ return I18N.t('wc.mode.endSub'); },
    c:'var(--prog)',    bg:'var(--prog-bg)',     bd:'var(--prog-bd)',
    icon:'<path d="M4 19V9M10 19V5M16 19v-7M4 19h16"/>' }
];
function wcModeMeta(id){ return WC_MODES.filter(function(m){ return m.id === id; })[0] || WC_MODES[1]; }
const WC_DAY_ABBR = { get length(){ return 7; } };
['sun','mon','tue','wed','thu','fri','sat'].forEach((d,i)=>Object.defineProperty(WC_DAY_ABBR, i, { get(){ return I18N.t('wd.short.'+d); } }));

function wcMode(){ return wcModeOverride || dayMode(todayISO()); }
function wcCanAct(){ return !!(me && me.pic && myCap().edit); }

function openWelcome(){
  wcLastFocus = document.activeElement;
  renderWelcome();
  document.getElementById('wcBd').classList.add('open');
  const m = document.getElementById('wcModal');
  m.classList.add('open');

  m.focus();
}
window.openWelcome = openWelcome;

function closeWelcome(){
  document.getElementById('wcBd').classList.remove('open');
  document.getElementById('wcModal').classList.remove('open');
  if(wcLastFocus && document.contains(wcLastFocus)) wcLastFocus.focus();
  wcLastFocus = null;
}
window.closeWelcome = closeWelcome;

function wcIsOpen(){
  const m = document.getElementById('wcModal');
  return !!m && m.classList.contains('open');
}
function welcomeRefresh(){ if(wcIsOpen()) renderWelcome(); }
window.welcomeRefresh = welcomeRefresh;

function wcSeenKey(){ return 'fisg_wc_seen_' + ((me && me.email) || 'anon'); }
function wcMaybeAutoOpen(){
  if(!me || !myCap().weeklyAuto) return;
  let seen = null;
  try{ seen = localStorage.getItem(wcSeenKey()); }catch(e){}
  if(seen === todayISO()) return;
  try{ localStorage.setItem(wcSeenKey(), todayISO()); }catch(e){}
  openWelcome();
}
window.wcMaybeAutoOpen = wcMaybeAutoOpen;

function wcSetMode(m){ wcModeOverride = m; renderWelcome(); }
window.wcSetMode = wcSetMode;

// Thu gọn / mở lại khung lịch để dành chỗ cho danh sách hoạt động.
function wcCalKey(){ return 'fisg_wc_calmin_' + ((me && me.email) || 'anon'); }
let wcCalMin = null; // null = chưa nạp; nạp lười theo đúng tài khoản.
function wcCalMinGet(){
  if(wcCalMin === null){
    // Mặc định thu gọn lịch; chỉ mở khi người dùng đã tự chọn mở ('0').
    try{ wcCalMin = localStorage.getItem(wcCalKey()) !== '0'; }catch(e){ wcCalMin = true; }
  }
  return wcCalMin;
}
function wcApplyCal(){
  const cal = document.getElementById('wcCal');
  const btn = document.getElementById('wcCalToggle');
  if(!cal || !btn) return;
  wcCalMinGet();
  cal.classList.toggle('collapsed', wcCalMin);
  btn.setAttribute('aria-expanded', wcCalMin ? 'false' : 'true');
  const lbl = btn.querySelector('span');
  if(lbl) lbl.textContent = wcCalMin ? I18N.t('wc.showCal') : I18N.t('wc.cal');
  btn.setAttribute('title', wcCalMin ? I18N.t('wc.showCalHint') : I18N.t('wc.hideCalHint'));
}
function wcToggleCal(){
  wcCalMin = !wcCalMinGet();
  try{ localStorage.setItem(wcCalKey(), wcCalMin ? '1' : '0'); }catch(e){}
  wcApplyCal();
}
window.wcToggleCal = wcToggleCal;

function wcCycleMode(){
  const real = dayMode(todayISO());
  const order = WC_MODES.map(function(m){ return m.id; });
  const next = order[(order.indexOf(wcMode()) + 1) % order.length];
  wcModeOverride = (next === real) ? null : next;
  renderWelcome();
}
window.wcCycleMode = wcCycleMode;
function wcRealMode(){ wcModeOverride = null; renderWelcome(); }
window.wcRealMode = wcRealMode;

function renderWelcome(){
  const pic = (me && me.pic) || '';
  const mw = buildMyWeek(pic, todayISO());
  const mode = wcMode();
  const T = todayISO();

  document.getElementById('wcTitle').textContent =
    I18N.t('wc.hello', {name:(me && (me.pic || me.name)) || I18N.t('wc.you')});
  document.getElementById('wcDay').textContent = dayStampVI(T);
  document.getElementById('wcWhen').innerHTML = I18N.t('wc.weekOf', {w:mw.label});
  wcRenderModeChip(mode);

  wcRenderWeek(mw);
  wcRenderNextWeek(pic);
  wcRenderStats(mw);
  wcApplyCal();

  const body = document.getElementById('wcBody');
  body.innerHTML =
    (LS.available() ? '' : `<div class="ck-badge warn" style="margin-bottom:12px">${I18N.t('wc.noStorage')}</div>`) +
    (wcCanAct() ? '' : `<div class="ck-badge" style="margin-bottom:12px">${I18N.t('wc.readOnly')}</div>`) +
    (mode === 'start' ? wcBodyStart(mw) : mode === 'mid' ? wcBodyMid(mw) : wcBodyEnd(mw));

  wcRenderFoot(mode);
}
window.renderWelcome = renderWelcome;

function wcRenderModeChip(mode){
  const m = wcModeMeta(mode);
  const preview = !!wcModeOverride;
  const btn = document.getElementById('wcMode');
  btn.className = 'wc-modechip' + (preview ? ' preview' : '');
  btn.style.cssText = `--mc:${m.c};--mc-bg:${m.bg};--mc-bd:${m.bd}`;
  btn.innerHTML =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>
     <span><b>${m.label}</b><small>${m.sub}</small></span>
     ${preview ? '<span class="revert">'+I18N.t('wc.preview')+'</span>' : ''}`;
  btn.setAttribute('title', preview
    ? I18N.t('wc.previewTitle', {m:m.label.toLowerCase()})
    : I18N.t('wc.modeTitle', {d:dayStampVI(todayISO())}));
  btn.setAttribute('aria-label', I18N.t('wc.modeAria', {m:m.label,s:m.sub}));
}

function wcWeekStripHtml(mw){
  const T = todayISO();
  const bucket = {};
  const put = (a, cls) => {
    const d = normDate(a.date); if(!d) return;
    (bucket[d] = bucket[d] || []).push(cls);
  };
  mw.done.forEach(a => put(a,'done'));
  mw.today.forEach(a => put(a, LS.isDone(a) ? 'done' : 'plan'));
  mw.planned.forEach(a => put(a,'plan'));
  mw.missed.forEach(a => put(a,'miss'));

  let html = '';
  for(let i = 0; i < 7; i++){
    const d = new Date(mw.start); d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    const dots = bucket[iso] || [];
    const shown = dots.slice(0,5);
    const cls = iso === T ? ' now' : (iso < T ? ' past' : '');
    const label = dots.length
      ? I18N.t('wc.tasksOn', {n:dots.length,d:ckVN(iso)})
      : I18N.t('wc.noTasksOn', {d:ckVN(iso)});
    html += `<button type="button" class="wc-day${cls}" data-iso="${iso}"
      onclick="wcDayMenu(event,'${iso}')" aria-label="${ckEsc(label)} — ${I18N.t('wc.clickToAdd')}">
      <span class="wc-day-n">${WC_DAY_ABBR[d.getDay()]}</span>
      <span class="wc-day-d">${iso.slice(8,10)}</span>
      <span class="wc-dots">${shown.map(c => `<i class="wc-dot ${c}"></i>`).join('')}${
        dots.length > 5 ? `<i class="wc-kg">+${dots.length-5}</i>` : ''}</span>
    </button>`;
  }
  return html;
}
function wcRenderWeek(mw){
  document.getElementById('wcWeek').innerHTML = wcWeekStripHtml(mw);
}
function wcRenderNextWeek(pic){
  const box = document.getElementById('wcWeekNext'); if(!box) return;
  const cur = thisWeek();
  const d = new Date(cur.start); d.setDate(d.getDate() + 7);
  const mw2 = buildMyWeek(pic, isoOf(d));
  box.innerHTML = wcWeekStripHtml(mw2);
  const lbl = document.getElementById('wcNextLabel');
  if(lbl) lbl.textContent = ' ' + mw2.label;
}

function wcDayMenu(ev, iso){
  ev.preventDefault(); ev.stopPropagation();
  wcCloseDayMenu();
  const anchor = ev.currentTarget;
  const pop = document.createElement('div');
  pop.className = 'wc-daypop glass';
  pop.id = 'wcDayPop';
  pop.innerHTML =
    '<div class="wc-daypop-h">' + dayStampVI(iso) + '</div>' +
    '<button type="button" class="wc-daypop-b" data-act="log">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' + I18N.t('act.create') + '</button>' +
    '<button type="button" class="wc-daypop-b" data-act="proj">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></svg>' + I18N.t('fn.addOpp') + '</button>';
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(r.left, innerWidth - pw - 10);
  let top = r.bottom + 6;
  if(top + ph > innerHeight - 10) top = r.top - ph - 6;
  pop.style.left = Math.max(10, left) + 'px';
  pop.style.top = Math.max(10, top) + 'px';
  pop.querySelector('[data-act="log"]').onclick = () => { wcCloseDayMenu(); wcQuickLog(iso); };
  pop.querySelector('[data-act="proj"]').onclick = () => { wcCloseDayMenu(); wcQuickProject(iso); };
  setTimeout(() => document.addEventListener('click', wcCloseDayMenu, { once:true }), 0);
}
function wcCloseDayMenu(){ const p = document.getElementById('wcDayPop'); if(p) p.remove(); }
window.wcDayMenu = wcDayMenu;

function wcQuickLog(iso){
  closeWelcome();
  if(typeof openActForm === 'function') openActForm({ date: iso });
}
function wcQuickProject(iso){
  closeWelcome();
  if(typeof openCreateProjectModal === 'function') openCreateProjectModal({ createdDate: iso });
}
window.wcQuickLog = wcQuickLog; window.wcQuickProject = wcQuickProject;

function wcRenderStats(mw){
  const cards = [
    { v: mw.stats.done,    k:I18N.t('wc.done'),        c:'var(--wc-done)', go:'done' },
    { v: mw.stats.planned, k:I18N.t('wc.planned'),      c:'var(--wc-plan)', go:'planned' },
    { v: mw.stats.missed,  k:I18N.t('wc.unmarked'), c:'var(--wc-miss)', go:'missed' },
    { v: mw.stats.overdue, k:I18N.t('ck.sig.overdue'), c:'var(--overdue)', go:'overdue' },
    { v: mw.stats.open,    k:I18N.t('status.inProgress'),     c:'var(--marine)',  go:'open' }
  ];
  document.getElementById('wcStats').innerHTML = cards.map(c =>
    `<button type="button" class="wc-stat" style="--sc:${c.c}" onclick="wcStatClick('${c.go}')"
       aria-label="${ckEsc(c.k)}: ${c.v} — ${I18N.t('wc.clickToOpen')}">
       <b>${c.v}</b><span>${c.k}</span></button>`).join('');
}

function wcStatClick(kind){
  closeWelcome();
  if(kind === 'overdue' || kind === 'open'){
    if(typeof go === 'function') go('funnel');
    if(kind === 'open' && typeof setF === 'function') setF('IN PROGRESS');
    if(kind === 'overdue' && typeof setF === 'function') setF('IN PROGRESS');
  } else {
    if(typeof go === 'function') go('acts');
  }
}
window.wcStatClick = wcStatClick;

function wcSection(title, count, items, extra){
  return `<section class="wc-sec">
    <div class="wc-sec-h"><h3>${title}</h3><span>${count}</span>${extra ? `<em>${extra}</em>` : ''}</div>
    ${items}
  </section>`;
}
function wcEmpty(msg, btnLabel, btnCall){
  return `<div class="ck-empty"><b>${msg}</b>${
    btnLabel ? `<button class="ck-chip" onclick="${btnCall}">${btnLabel}</button>` : ''}</div>`;
}

function wcSuggestRow(s){
  const acts = wcCanAct() ? `<div class="wc-acts">
    <button class="wc-btn pri" onclick="wcSchedule('${ckAttr(s.custKey)}','${s.projectId||''}','${ckAttr(s.ncc||'')}')">${I18N.t('wc.schedule')}</button>
    ${s.projectId ? `<button class="wc-btn" onclick="wcOpenProject('${s.projectId}')">${I18N.t('wc.openOpp')}</button>` : ''}
  </div>` : '';
  return `<div class="wc-item">
    <div class="wc-item-t">
      <span class="wc-item-n">${ckEsc(s.custLabel)}</span>
      ${s.ncc ? `<span class="ck-badge">${ckEsc(s.ncc)}</span>` : ''}
      ${s.segment ? `<span class="ck-tag" style="--kc:var(--marine);--kc-bg:var(--marine-soft)">${ckEsc(s.segment)}</span>` : ''}
    </div>
    <div class="wc-item-r"><b>${ckEsc(s.reason)}</b>${
      s.product ? ' · ' + ckEsc(s.product) : ''}${
      s.kg ? ` · <span class="wc-kg">${fmt(s.kg)} KG</span>` : ''}</div>
    ${acts}
  </div>`;
}

// Chọn nút phù hợp cho một hoạt động: đã xong → "Hoàn tác";
// tới hạn hôm nay hoặc đã qua → "Hoàn thành" ngay; còn ở tương lai → không nút.
function wcAutoAction(a){
  if(!wcCanAct()) return null;
  if(LS.isDone(a)) return 'undo';
  const d = normDate(a.date);
  return (d && d <= todayISO()) ? 'done' : null;
}

function wcActRow(a, action){
  let btn = '';
  if(wcCanAct() && action === 'done')
    btn = `<button class="wc-btn ok" onclick="wcMarkDone('${ckAttr(a.id)}',1)">${I18N.t('wc.markDone')}</button>`;
  if(wcCanAct() && action === 'undo')
    btn = `<button class="wc-btn" onclick="wcMarkDone('${ckAttr(a.id)}',0)">${I18N.t('wc.undo')}</button>`;
  // "Đổi lịch" hiện trước "Hoàn thành" cho mọi hoạt động chưa hoàn thành.
  const resched = (wcCanAct() && !LS.isDone(a))
    ? `<button class="wc-btn resched" onclick="wcReschedule('${ckAttr(a.id)}',event)"
         aria-label="${I18N.t('wc.reschedAria')}">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M14 14l-2.5 2.5"/></svg>${I18N.t('wc.resched')}</button>` : '';
  const open = a.projectId
    ? `<button class="wc-btn" onclick="wcOpenProject('${ckAttr(a.projectId)}')">${I18N.t('wc.openOpp')}</button>` : '';
  return `<div class="wc-item">
    <div class="wc-item-t">
      <span class="wc-item-n">${ckEsc(custLabel(a.customer))}</span>
      <span class="ck-tag" style="--kc:var(--ck-act);--kc-bg:rgba(14,116,144,.10)">${ckEsc(a.type||'—')}</span>
      <span class="wc-kg">${ckVN(normDate(a.date))}</span>
      ${a.ncc ? `<span class="ck-badge">${ckEsc(a.ncc)}</span>` : ''}
    </div>
    <div class="wc-item-r">${ckEsc(a.note || '—')}${
      a.next && a.next !== '—' ? ` · <b>${I18N.t('ck.next')}</b> ${ckEsc(a.next)}` : ''}</div>
    ${(resched||btn||open) ? `<div class="wc-acts">${resched}${btn}${open}</div>` : ''}
  </div>`;
}

// Bật lịch nhỏ (dùng lại datepicker) ngay cạnh nút để chọn ngày mới.
function wcReschedule(id, ev){
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  if(!wcCanAct()){ toast(I18N.t('wc.msg.roResched')); return; }
  const a = ACTIVITIES.find(x => x.id === id);
  if(!a){ toast(I18N.t('wc.msg.actNotFound')); return; }
  const anchor = ev && ev.currentTarget;
  const old = document.getElementById('wcRsWrap'); if(old) old.remove();

  const host = document.createElement('span');
  host.id = 'wcRsWrap';
  host.style.cssText = 'position:fixed;z-index:1300;opacity:0;';
  const input = document.createElement('input');
  input.type = 'date';
  input.value = normDate(a.date) || todayISO();
  host.appendChild(input);
  document.body.appendChild(host);
  if(anchor){
    const r = anchor.getBoundingClientRect();
    host.style.left = Math.round(r.left) + 'px';
    host.style.top = Math.round(r.bottom) + 'px';
  }
  if(window.FISG_DATEPICKER) FISG_DATEPICKER.scan();
  input.addEventListener('change', function(){
    const v = input.value;
    host.remove();
    if(v && v !== (normDate(a.date) || '')) wcApplyReschedule(a, v);
  });
  setTimeout(function(){ input.focus(); }, 0);
}
window.wcReschedule = wcReschedule;

function wcApplyReschedule(a, iso){
  const prev = normDate(a.date) || '';
  a.date = iso;
  renderWelcome();
  toast(I18N.t('wc.msg.rescheduled', {c:custLabel(a.customer),d:ckVN(iso)}));
  if(!a.spId || !window.FISG_STORE || !FISG_STORE.setActivityDate) return;
  if(!(FISG_STORE.canWrite && FISG_STORE.canWrite())){
    toast(I18N.t('wc.msg.localOnly'));
    return;
  }
  FISG_STORE.setActivityDate(a.spId, iso).then(function(ok){
    if(ok === false){ toast(I18N.t('wc.msg.dateNotSaved')); return; }
    if(typeof invalidateCockpit === 'function') invalidateCockpit();
    if(window.renderActs) renderActs();
  }).catch(function(e){
    a.date = prev; renderWelcome();
    toast(I18N.t('wc.msg.saveErrRevert', {e:e && (e.message||e)}));
  });
}
window.wcApplyReschedule = wcApplyReschedule;

function wcChangeRow(c){
  const m = c.kind === 'close'
    ? (c.status === 'WON' ? { l:I18N.t('status.won'), v:'var(--won)', b:'var(--won-bg)' } : { l:I18N.t('status.lost'), v:'var(--lost)', b:'var(--lost-bg)' })
    : c.kind === 'new' ? { l:I18N.t('ck.kind.new'), v:'var(--ck-new)', b:'var(--accent-soft)' }
    : { l:I18N.t('ck.kind.update'), v:'var(--ck-update)', b:'rgba(10,92,143,.10)' };
  return `<div class="wc-item">
    <div class="wc-item-t">
      <span class="wc-item-n">${ckEsc(c.custLabel)}</span>
      <span class="ck-tag" style="--kc:${m.v};--kc-bg:${m.b}">${m.l}</span>
      <span class="wc-kg">${ckVN(c.ts)}</span>
    </div>
    <div class="wc-item-r">${ckEsc(c.product || '')}${c.text ? ' — ' + ckEsc(c.text.slice(0,110)) : ''}</div>
    <div class="wc-acts"><button class="wc-btn" onclick="wcOpenProject('${ckAttr(c.projectId)}')">${I18N.t('wc.openOpp')}</button></div>
  </div>`;
}

function wcBodyStart(mw){
  const sg = suggestWork(mw.pic, 5);
  const booked = mw.today.concat(mw.planned);
  return (sg.length
      ? wcSection(I18N.t('wc.sec.todo'), sg.length, sg.map(wcSuggestRow).join(''),
          I18N.t('wc.sec.todoHint'))
      : wcSection(I18N.t('wc.sec.todo'), 0,
          wcEmpty(I18N.t('wc.empty.noPriority'), I18N.t('wc.openFunnel'), 'wcGo(\'funnel\')')))
    + wcSection(I18N.t('wc.sec.booked'), booked.length,
        booked.length ? booked.map(a => wcActRow(a, wcAutoAction(a))).join('')
                      : wcEmpty(I18N.t('wc.empty.noneBooked'),
                          wcCanAct() ? I18N.t('wc.logNew') : '', 'wcSchedule()'));
}

function wcBodyMid(mw){

  const doing = mw.today.filter(function(a){ return !LS.isDone(a); });
  const doneToday = mw.today.filter(LS.isDone);
  const done = doneToday.concat(mw.done);
  const total = mw.planned.length + doing.length + done.length + mw.missed.length;

  const group = (title, count, items, render, emptyMsg, extra) =>
    `<div class="wc-grp">
       <div class="wc-grp-h"><b>${title}</b><span>${count}</span>${extra ? `<em>${extra}</em>` : ''}</div>
       ${count ? items.map(render).join('') : `<div class="wc-grp-e">${emptyMsg}</div>`}
     </div>`;

  const board = wcSection(I18N.t('wc.sec.update'), total,
      group(I18N.t('wc.grp.today'), doing.length, doing,
            a => wcActRow(a, 'done'),
            I18N.t('wc.grp.todayEmpty'))
    + group(I18N.t('wc.grp.missed'), mw.missed.length, mw.missed,
            a => wcActRow(a, 'done'),
            I18N.t('wc.grp.missedEmpty'))
    + group(I18N.t('wc.grp.planned'), mw.planned.length, mw.planned,
            a => wcActRow(a, null),
            I18N.t('wc.grp.plannedEmpty'))
    + group(I18N.t('wc.grp.done'), done.length, done,
            a => wcActRow(a, 'undo'),
            I18N.t('wc.grp.doneEmpty'))
    + (wcCanAct()
        ? `<div class="wc-grp-act"><button class="wc-btn pri" onclick="wcSchedule()">${I18N.t('wc.logNew')}</button></div>`
        : ''),
    total ? I18N.t('wc.markDoneHint') : '');

  if(total) return board;
  const sg = suggestWork(mw.pic, 3);
  return board + (sg.length
    ? wcSection(I18N.t('wc.sec.topNow'), sg.length, sg.map(wcSuggestRow).join(''),
                I18N.t('wc.sec.topNowHint'))
    : '');
}

function wcBodyEnd(mw){
  const done = mw.done.concat(mw.today.filter(LS.isDone));
  return wcSection(I18N.t('wc.grp.done'), done.length,
      done.length ? done.map(a => wcActRow(a, null)).join('')
                  : wcEmpty(I18N.t('wc.empty.noneDone'),
                      wcCanAct() ? I18N.t('act.log') : '', 'wcSchedule()'))
    + (mw.missed.length ? wcSection(I18N.t('wc.sec.unmarkedPlan'), mw.missed.length,
        mw.missed.map(a => wcActRow(a, 'done')).join('')) : '')
    + wcSection(I18N.t('wc.sec.oppChanges'), mw.projectChanges.length,
        mw.projectChanges.length ? mw.projectChanges.slice(0,12).map(wcChangeRow).join('')
                                 : wcEmpty(I18N.t('wc.empty.noChanges'),
                                     I18N.t('wc.openFunnel'), 'wcGo(\'funnel\')'));
}

function wcRenderFoot(mode){
  const note = mode === 'start' ? I18N.t('wc.note.start')
    : mode === 'mid' ? I18N.t('wc.note.mid')
    : I18N.t('wc.note.end');

  const canCompose = (typeof rpCanCompose === 'function') && rpCanCompose();
  const main = mode === 'end'
    ? (canCompose
        ? `<button class="wc-btn pri" onclick="wcOpenReports()">${I18N.t('wc.composeReport')}</button>`
        : `<button class="wc-btn pri" onclick="wcGo('reports')">${I18N.t('wc.teamReports')}</button>`)
    : `<button class="wc-btn pri" onclick="wcGo('funnel')">${I18N.t('wc.goFunnel')}</button>`;
  const extra = (mode === 'start' && wcCanAct())
    ? `<button class="wc-btn" onclick="wcSchedule()">${I18N.t('wc.logNew')}</button>` : '';
  document.getElementById('wcFoot').innerHTML =
    `<span class="wc-note-line">${note}</span>
     <span class="grow"><button class="wc-btn" onclick="closeWelcome()">${I18N.t('wc.later')}</button>${extra}${main}</span>`;
}

function wcNextWorkday(){
  const w = thisWeek();
  const d = new Date(todayISO());
  for(let i = 1; i <= 7; i++){
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if(dow !== 0 && dow !== 6 && isoOf(d) <= w.end) return isoOf(d);
  }
  return todayISO();
}

function wcSchedule(custKey, projectId, ncc){
  if(!wcCanAct()){ toast(I18N.t('wc.msg.roLog')); return; }
  openActForm({
    title: custKey ? I18N.t('wc.scheduleWith', {c:custLabel(custKey)}) : I18N.t('act.logAccount'),
    sub: custKey ? I18N.t('wc.fromSuggestion') : '',
    customer: custKey ? custLabel(custKey) : '',
    ncc: ncc || undefined,
    date: wcNextWorkday(),
    projectId: projectId || ''
  });
}
window.wcSchedule = wcSchedule;

function wcOpenProject(id){ openDetail(id); }
window.wcOpenProject = wcOpenProject;

function wcGo(v){ closeWelcome(); go(v); }
window.wcGo = wcGo;

function wcOpenReports(){ closeWelcome(); go('reports'); openReportComposer(); }
window.wcOpenReports = wcOpenReports;

function wcMarkDone(id, on){
  const iso = on ? todayISO() : null;
  const a = ACTIVITIES.find(x => x.id === id);

  LS.markDone(id, iso);
  if(a) a.doneAt = iso || '';
  renderWelcome();
  toast(on ? I18N.t('wc.msg.done')
           : I18N.t('wc.msg.undone'));
  if(!a || !window.FISG_STORE || !FISG_STORE.setActivityDone) return;
  FISG_STORE.setActivityDone(a.spId, iso).then(res => {
    if(res === 'nocol' && a.spId)
      toast(I18N.t('wc.msg.noDoneCol'));
    if(typeof invalidateCockpit === 'function') invalidateCockpit();
    if(window.renderActs) renderActs();
  }).catch(e => {
    console.warn('[welcome] không ghi được trạng thái hoàn thành:', e && (e.message || e));
    toast(I18N.t('wc.msg.doneNotSaved', {e:e.message || e}));
  });
}
window.wcMarkDone = wcMarkDone;

document.addEventListener('keydown', e => {
  if(!wcIsOpen()) return;

  if(document.querySelector('.overlay.open')) return;
  if(e.key === 'Escape'){ e.preventDefault(); closeWelcome(); return; }
  if(e.key !== 'Tab') return;
  const m = document.getElementById('wcModal');
  const f = m.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(!f.length) return;
  const first = f[0], last = f[f.length-1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
