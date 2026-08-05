/* js/views/welcome.js — màn hình chào tuần của sales.
   Chỉ dựng HTML và bắt sự kiện; mọi phép tính nằm ở js/lib/weekly.js.
   Dùng lại ckEsc/ckAttr của cockpit.js để thoát chuỗi. */

let wcModeOverride = null;   // công tắc xem trước; null = theo ngày thật
let wcLastFocus = null;

/* Ba chế độ suy từ thứ trong tuần. Màu và câu mô tả nói rõ việc của hôm nay. */
const WC_MODES = [
  { id:'start', label:'Đầu tuần',  sub:'Lên kế hoạch cho tuần',
    c:'var(--marine)',  bg:'var(--marine-soft)', bd:'var(--marine-line)',
    icon:'<path d="M12 5v14M5 12h14"/>' },
  { id:'mid',   label:'Giữa tuần', sub:'Bám việc đã lên lịch',
    c:'var(--bas)',     bg:'var(--bas-bg)',      bd:'rgba(14,116,144,.28)',
    icon:'<path d="M5 12l5 5L20 7"/>' },
  { id:'end',   label:'Cuối tuần', sub:'Nhìn lại và báo cáo',
    c:'var(--prog)',    bg:'var(--prog-bg)',     bd:'var(--prog-bd)',
    icon:'<path d="M4 19V9M10 19V5M16 19v-7M4 19h16"/>' }
];
function wcModeMeta(id){ return WC_MODES.filter(function(m){ return m.id === id; })[0] || WC_MODES[1]; }
const WC_DAY_ABBR = ['CN','T2','T3','T4','T5','T6','T7'];

function wcMode(){ return wcModeOverride || dayMode(todayISO()); }
function wcCanAct(){ return !!(me && me.pic && myCap().edit); }

/* ====== MỞ / ĐÓNG ====== */
function openWelcome(){
  wcLastFocus = document.activeElement;
  renderWelcome();
  document.getElementById('wcBd').classList.add('open');
  const m = document.getElementById('wcModal');
  m.classList.add('open');
  /* Đặt tiêu điểm vào chính hộp thoại: bàn phím và trình đọc màn hình vào đúng
     chỗ, mà không vẽ khung sáng quanh nút đóng ngay khi vừa mở. */
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

/* Mỗi ngày một lần cho mỗi người. Mục sidebar mở lại không ghi cờ. */
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

/* Ngày thật quyết định chế độ. Nút chip chỉ để xem thử hai chế độ còn lại —
   quay hết một vòng là trở về đúng chế độ của hôm nay. */
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

/* ====== DỰNG ====== */
function renderWelcome(){
  const pic = (me && me.pic) || '';
  const mw = buildMyWeek(pic, todayISO());
  const mode = wcMode();
  const T = todayISO();

  document.getElementById('wcTitle').textContent =
    'Chào ' + ((me && (me.pic || me.name)) || 'bạn');
  document.getElementById('wcDay').textContent = dayStampVI(T);
  document.getElementById('wcWhen').innerHTML = 'Tuần <b>' + mw.label + '</b>';
  wcRenderModeChip(mode);

  wcRenderWeek(mw);
  wcRenderStats(mw);

  const body = document.getElementById('wcBody');
  body.innerHTML =
    (LS.available() ? '' : `<div class="ck-badge warn" style="margin-bottom:12px">Trình duyệt đang chặn lưu trữ — việc bạn nhập sẽ mất khi tải lại trang.</div>`) +
    (wcCanAct() ? '' : `<div class="ck-badge" style="margin-bottom:12px">Bạn đang xem ở chế độ chỉ đọc. Chỉ tài khoản sales mới ghi được hoạt động.</div>`) +
    (mode === 'start' ? wcBodyStart(mw) : mode === 'mid' ? wcBodyMid(mw) : wcBodyEnd(mw));

  wcRenderFoot(mode);
}
window.renderWelcome = renderWelcome;

/* ---- Chip chế độ tuần ---- */
function wcRenderModeChip(mode){
  const m = wcModeMeta(mode);
  const preview = !!wcModeOverride;
  const btn = document.getElementById('wcMode');
  btn.className = 'wc-modechip' + (preview ? ' preview' : '');
  btn.style.cssText = `--mc:${m.c};--mc-bg:${m.bg};--mc-bd:${m.bd}`;
  btn.innerHTML =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>
     <span><b>${m.label}</b><small>${m.sub}</small></span>
     ${preview ? '<span class="revert">xem thử</span>' : ''}`;
  btn.setAttribute('title', preview
    ? 'Đang xem thử chế độ ' + m.label.toLowerCase() + '. Bấm để xem chế độ tiếp theo.'
    : 'Chế độ hôm nay, suy từ ' + dayStampVI(todayISO()) + '. Bấm để xem thử chế độ khác.');
  btn.setAttribute('aria-label', (preview ? 'Đang xem thử chế độ ' : 'Chế độ ') + m.label +
    ' — ' + m.sub + '. Bấm để chuyển chế độ xem thử.');
}

/* ---- Dải bảy ngày ---- */
function wcRenderWeek(mw){
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
      ? dots.length + ' việc ngày ' + ckVN(iso)
      : 'Không có việc ngày ' + ckVN(iso);
    html += `<div class="wc-day${cls}" role="listitem" aria-label="${ckEsc(label)}">
      <span class="wc-day-n">${WC_DAY_ABBR[d.getDay()]}</span>
      <span class="wc-day-d">${iso.slice(8,10)}</span>
      <span class="wc-dots">${shown.map(c => `<i class="wc-dot ${c}"></i>`).join('')}${
        dots.length > 5 ? `<i class="wc-kg">+${dots.length-5}</i>` : ''}</span>
    </div>`;
  }
  document.getElementById('wcWeek').innerHTML = html;
}

/* ---- Dải số ---- */
function wcRenderStats(mw){
  const cards = [
    { v: mw.stats.done,    k:'Đã làm',      c:'var(--wc-done)' },
    { v: mw.stats.planned, k:'Kế hoạch',    c:'var(--wc-plan)' },
    { v: mw.stats.missed,  k:'Chưa đánh dấu', c:'var(--wc-miss)' },
    { v: mw.stats.overdue, k:'Dự án quá hạn', c:'var(--overdue)' },
    { v: mw.stats.open,    k:'Đang chạy',   c:'var(--marine)' }
  ];
  document.getElementById('wcStats').innerHTML = cards.map(c =>
    `<div class="wc-stat" style="--sc:${c.c}"><b>${c.v}</b><span>${c.k}</span></div>`).join('');
}

/* ---- Khối chung ---- */
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

/* ---- Dòng gợi ý ---- */
function wcSuggestRow(s){
  const acts = wcCanAct() ? `<div class="wc-acts">
    <button class="wc-btn pri" onclick="wcSchedule('${ckAttr(s.custKey)}','${s.projectId||''}','${ckAttr(s.ncc||'')}')">Đặt lịch</button>
    ${s.projectId ? `<button class="wc-btn" onclick="wcOpenProject('${s.projectId}')">Mở dự án</button>` : ''}
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

/* ---- Dòng hoạt động ---- */
function wcActRow(a, action){
  let btn = '';
  if(wcCanAct() && action === 'done')
    btn = `<button class="wc-btn ok" onclick="wcMarkDone('${ckAttr(a.id)}',1)">Hoàn thành</button>`;
  if(wcCanAct() && action === 'undo')
    btn = `<button class="wc-btn" onclick="wcMarkDone('${ckAttr(a.id)}',0)">Hoàn tác</button>`;
  const open = a.projectId
    ? `<button class="wc-btn" onclick="wcOpenProject('${ckAttr(a.projectId)}')">Mở dự án</button>` : '';
  return `<div class="wc-item">
    <div class="wc-item-t">
      <span class="wc-item-n">${ckEsc(custLabel(a.customer))}</span>
      <span class="ck-tag" style="--kc:var(--ck-act);--kc-bg:rgba(14,116,144,.10)">${ckEsc(a.type||'—')}</span>
      <span class="wc-kg">${ckVN(normDate(a.date))}</span>
      ${a.ncc ? `<span class="ck-badge">${ckEsc(a.ncc)}</span>` : ''}
    </div>
    <div class="wc-item-r">${ckEsc(a.note || '—')}${
      a.next && a.next !== '—' ? ` · <b>Tiếp theo:</b> ${ckEsc(a.next)}` : ''}</div>
    ${(btn||open) ? `<div class="wc-acts">${btn}${open}</div>` : ''}
  </div>`;
}

/* ---- Dòng thay đổi dự án ---- */
function wcChangeRow(c){
  const m = c.kind === 'close'
    ? (c.status === 'WON' ? { l:'Thắng', v:'var(--won)', b:'var(--won-bg)' } : { l:'Thua', v:'var(--lost)', b:'var(--lost-bg)' })
    : c.kind === 'new' ? { l:'Dự án mới', v:'var(--ck-new)', b:'var(--accent-soft)' }
    : { l:'Cập nhật', v:'var(--ck-update)', b:'rgba(10,92,143,.10)' };
  return `<div class="wc-item">
    <div class="wc-item-t">
      <span class="wc-item-n">${ckEsc(c.custLabel)}</span>
      <span class="ck-tag" style="--kc:${m.v};--kc-bg:${m.b}">${m.l}</span>
      <span class="wc-kg">${ckVN(c.ts)}</span>
    </div>
    <div class="wc-item-r">${ckEsc(c.product || '')}${c.text ? ' — ' + ckEsc(c.text.slice(0,110)) : ''}</div>
    <div class="wc-acts"><button class="wc-btn" onclick="wcOpenProject('${ckAttr(c.projectId)}')">Mở dự án</button></div>
  </div>`;
}

/* ====== BA CHẾ ĐỘ ====== */
function wcBodyStart(mw){
  const sg = suggestWork(mw.pic, 5);
  const booked = mw.today.concat(mw.planned);
  return (sg.length
      ? wcSection('Việc nên làm tuần này', sg.length, sg.map(wcSuggestRow).join(''),
          'xếp theo mức cấp thiết, hoà thì KG lớn trước')
      : wcSection('Việc nên làm tuần này', 0,
          wcEmpty('Không có việc nào nổi lên cần ưu tiên', 'Mở Sales Funnel', 'wcGo(\'funnel\')')))
    + wcSection('Đã có trong lịch tuần này', booked.length,
        booked.length ? booked.map(a => wcActRow(a, null)).join('')
                      : wcEmpty('Tuần này chưa có gì trong lịch',
                          wcCanAct() ? 'Ghi hoạt động mới' : '', 'wcSchedule()'));
}

function wcBodyMid(mw){
  /* Khối "Cập nhật hoạt động" LUÔN hiện, kể cả tuần trống — đây là việc chính
     của giữa tuần, không phải phần thưởng khi có sẵn dữ liệu. Ba nhóm bám đúng
     ba trạng thái một việc có thể ở: đã lên kế hoạch · đang làm · đã làm. */
  const doing = mw.today.filter(function(a){ return !LS.isDone(a); });
  const doneToday = mw.today.filter(LS.isDone);
  const done = doneToday.concat(mw.done);
  const total = mw.planned.length + doing.length + done.length + mw.missed.length;

  const group = (title, count, items, render, emptyMsg, extra) =>
    `<div class="wc-grp">
       <div class="wc-grp-h"><b>${title}</b><span>${count}</span>${extra ? `<em>${extra}</em>` : ''}</div>
       ${count ? items.map(render).join('') : `<div class="wc-grp-e">${emptyMsg}</div>`}
     </div>`;

  const board = wcSection('Cập nhật hoạt động', total,
      group('Đang làm hôm nay', doing.length, doing,
            a => wcActRow(a, 'done'),
            'Hôm nay chưa có việc nào trên lịch.')
    + group('Chưa đánh dấu — đã qua ngày', mw.missed.length, mw.missed,
            a => wcActRow(a, 'done'),
            'Không có việc nào bị bỏ quên.')
    + group('Đã lên kế hoạch — còn lại trong tuần', mw.planned.length, mw.planned,
            a => wcActRow(a, null),
            'Chưa đặt lịch việc nào cho những ngày còn lại.')
    + group('Đã làm trong tuần', done.length, done,
            a => wcActRow(a, 'undo'),
            'Chưa có việc nào được đánh dấu hoàn thành.')
    + (wcCanAct()
        ? `<div class="wc-grp-act"><button class="wc-btn pri" onclick="wcSchedule()">Ghi hoạt động mới</button></div>`
        : ''),
    total ? 'bấm "Hoàn thành" để báo cáo cuối tuần tính đúng' : '');

  /* Tuần trống thì gợi ý thêm việc — nhưng ĐẶT DƯỚI khối cập nhật, không thay
     thế nó, để chỗ ghi nhận công việc luôn ở cùng một vị trí. */
  if(total) return board;
  const sg = suggestWork(mw.pic, 3);
  return board + (sg.length
    ? wcSection('Việc đáng làm nhất lúc này', sg.length, sg.map(wcSuggestRow).join(''),
                'gợi ý theo mức cấp thiết')
    : '');
}

function wcBodyEnd(mw){
  const done = mw.done.concat(mw.today.filter(LS.isDone));
  return wcSection('Đã làm trong tuần', done.length,
      done.length ? done.map(a => wcActRow(a, null)).join('')
                  : wcEmpty('Tuần này chưa ghi nhận hoạt động nào',
                      wcCanAct() ? 'Ghi hoạt động' : '', 'wcSchedule()'))
    + (mw.missed.length ? wcSection('Kế hoạch chưa đánh dấu', mw.missed.length,
        mw.missed.map(a => wcActRow(a, 'done')).join('')) : '')
    + wcSection('Thay đổi dự án', mw.projectChanges.length,
        mw.projectChanges.length ? mw.projectChanges.slice(0,12).map(wcChangeRow).join('')
                                 : wcEmpty('Không có dự án nào đổi trạng thái tuần này',
                                     'Mở Sales Funnel', 'wcGo(\'funnel\')'));
}

/* ====== CHÂN ====== */
function wcRenderFoot(mode){
  const note = mode === 'start' ? 'Đặt lịch xong, việc sẽ hiện ở dải bảy ngày phía trên.'
    : mode === 'mid' ? 'Bấm "Hoàn thành" khi xong việc để báo cáo cuối tuần tính đúng.'
    : 'Báo cáo là ảnh chụp số liệu tại thời điểm gửi.';
  const main = mode === 'end'
    ? `<button class="wc-btn pri" onclick="wcOpenReports()">Soạn báo cáo tuần</button>`
    : `<button class="wc-btn pri" onclick="wcGo('funnel')">Vào Sales Funnel</button>`;
  const extra = (mode === 'start' && wcCanAct())
    ? `<button class="wc-btn" onclick="wcSchedule()">Ghi hoạt động mới</button>` : '';
  document.getElementById('wcFoot').innerHTML =
    `<span class="wc-note-line">${note}</span>
     <span class="grow"><button class="wc-btn" onclick="closeWelcome()">Để sau</button>${extra}${main}</span>`;
}

/* ====== HÀNH ĐỘNG ====== */
/* Ngày mặc định khi đặt lịch là ngày làm việc kế tiếp — đây là lên lịch, không
   phải ghi lại việc vừa làm. */
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
  if(!wcCanAct()){ toast('Chế độ chỉ đọc — đăng nhập bằng tài khoản sales để ghi hoạt động.'); return; }
  openActForm({
    title: custKey ? 'Đặt lịch với ' + custLabel(custKey) : 'Ghi hoạt động khách hàng',
    sub: custKey ? 'Từ gợi ý tuần này' : '',
    customer: custKey ? custLabel(custKey) : '',
    ncc: ncc || undefined,
    date: wcNextWorkday(),
    projectId: projectId || ''
  });
}
window.wcSchedule = wcSchedule;

/* Không tự đóng popup nữa — NAV.enter() nhận ra popup đang mở, che nó đi và
   ghi đường về, nên đóng modal con là popup hiện lại. */
function wcOpenProject(id){ openDetail(id); }
window.wcOpenProject = wcOpenProject;

function wcGo(v){ closeWelcome(); go(v); }
window.wcGo = wcGo;

function wcOpenReports(){ closeWelcome(); go('reports'); openReportComposer(); }
window.wcOpenReports = wcOpenReports;

function wcMarkDone(id, on){
  const iso = on ? todayISO() : null;
  const a = ACTIVITIES.find(x => x.id === id);
  /* Đổi trên màn hình trước, ghi lên SharePoint sau — bấm xong là thấy ngay.
     Nhưng đây là dữ liệu dùng chung, nên ghi hỏng thì phải nói, không im. */
  LS.markDone(id, iso);
  if(a) a.doneAt = iso || '';
  renderWelcome();
  toast(on ? 'Đã ghi nhận hoàn thành. Bấm "Hoàn tác" ở mục Đã làm trong tuần nếu nhầm.'
           : 'Đã bỏ đánh dấu hoàn thành.');
  if(!a || !window.FISG_STORE || !FISG_STORE.setActivityDone) return;
  FISG_STORE.setActivityDone(a.spId, iso).then(res => {
    if(res === 'nocol' && a.spId)
      toast('Đã lưu trên máy bạn. Trạng thái này chưa dùng chung được vì list Activities '
          + 'thiếu cột "Ngày hoàn thành" — xem docs/SharePoint_Setup.md.');
    if(typeof invalidateCockpit === 'function') invalidateCockpit();
    if(window.renderActs) renderActs();
  }).catch(e => {
    console.warn('[welcome] không ghi được trạng thái hoàn thành:', e && (e.message || e));
    toast('CHƯA lưu được lên SharePoint: ' + (e.message || e)
        + '. Quản lý chưa thấy trạng thái này.');
  });
}
window.wcMarkDone = wcMarkDone;

/* ====== BÀN PHÍM ====== */
document.addEventListener('keydown', e => {
  if(!wcIsOpen()) return;
  /* Modal dự án mở đè lên thì để nó xử lý phím trước. */
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
