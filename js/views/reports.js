/* js/views/reports.js — mục Báo cáo. Một view, nội dung theo vai trò:
   sales soạn và xem báo cáo của mình, manager/admin đọc của cả đội. */

let rpSel = null;        // id báo cáo đang mở, hoặc 'draft'
let rpDraft = null;      // bản nháp chưa gửi
let rpFilterPic = '';
const RP_COLORS = ['#01426A','#0E7490','#B45309','#6D28D9','#0D9488','#DB2777','#157F3C'];

function rpIsLead(){ return me && (me.role === 'manager' || me.role === 'superadmin'); }

/* ====== ĐIỀU PHỐI ====== */
function renderReports(){
  const list = rpIsLead()
    ? LS.allReports().filter(r => !rpFilterPic || picKey(r.pic) === picKey(rpFilterPic))
    : LS.reportsFor((me && me.pic) || '');

  rpRenderTools(list);
  rpRenderList(list);
  rpRenderPanel(list);
}
window.renderReports = renderReports;

function rpRenderTools(list){
  const box = document.getElementById('rpTools');
  if(rpIsLead()){
    const pics = Array.from(new Set(LS.allReports().map(r => picKey(r.pic)))).sort();
    box.innerHTML = `<select class="ck-sel" aria-label="Lọc theo sales" onchange="rpSetPic(this.value)">
      <option value="">Tất cả sales</option>
      ${pics.map(p => `<option value="${ckEsc(p)}"${picKey(rpFilterPic)===p?' selected':''}>${ckEsc(picLabel(p))}</option>`).join('')}
    </select>`;
  } else {
    box.innerHTML = `<button class="btn-primary" onclick="openReportComposer()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Soạn báo cáo tuần</button>`;
  }
}
function rpSetPic(v){ rpFilterPic = v; rpSel = null; renderReports(); }
window.rpSetPic = rpSetPic;

function rpRenderList(list){
  const box = document.getElementById('rpList');
  const draftRow = rpDraft ? `<button class="rp-row" aria-current="${rpSel==='draft'}" onclick="rpSelect('draft')">
      <b>Bản nháp — tuần ${ckEsc(rpDraft.weekLabel)}</b>
      <span class="w"><span class="ck-badge">chưa gửi</span></span>
      <span class="s">${rpDraft.stats.done} đã làm · ${rpDraft.stats.changes} thay đổi dự án</span>
    </button>` : '';

  if(!list.length && !rpDraft){
    box.innerHTML = `<div class="ck-empty">
      <b>Chưa có báo cáo nào</b>
      <p>${rpIsLead() ? 'Báo cáo do sales gửi sẽ hiện ở đây.' : 'Soạn báo cáo tuần để gửi cho quản lý.'}</p>
      ${rpIsLead() ? '' : '<button class="ck-chip" onclick="openReportComposer()">Soạn báo cáo tuần</button>'}
    </div>`;
    return;
  }
  box.innerHTML = draftRow + list.map(r => `
    <button class="rp-row" aria-current="${rpSel===r.id}" onclick="rpSelect('${ckAttr(r.id)}')">
      <b>${ckEsc(r.picLabel)} — tuần ${ckEsc(r.weekLabel)}</b>
      <span class="w">${ckVN(r.createdAt)}</span>
      <span class="s">${r.stats.done} đã làm · ${r.stats.missed} chưa đánh dấu · ${r.stats.changes} thay đổi dự án</span>
    </button>`).join('');
}

/* Bỏ bản nháp đang có nội dung thì phải hỏi — sales gõ nhận xét xong mà mất là
   mất công thật. */
function rpDraftDirty(){
  if(!rpDraft) return false;
  const el = document.getElementById('rpNote');
  return !!(el && el.value.trim());
}
function rpSelect(id){
  if(rpSel === 'draft' && id !== 'draft' && rpDraftDirty()
     && !confirm('Bản nháp có nhận xét chưa gửi. Rời khỏi và bỏ nội dung đã gõ?')) return;
  if(id !== 'draft' && rpSel === 'draft') rpDraft = null;
  rpSel = id;
  renderReports();
}
window.rpSelect = rpSelect;

function openReportComposer(){
  if(!(me && me.pic)){ toast('Chỉ tài khoản sales mới soạn được báo cáo tuần.'); return; }
  rpDraft = buildReport(me.pic, todayISO());
  rpSel = 'draft';
  go('reports');
  renderReports();
  const t = document.getElementById('rpNote'); if(t) t.focus();
}
window.openReportComposer = openReportComposer;

/* ====== KHUNG CHI TIẾT ====== */
function rpRenderPanel(list){
  const box = document.getElementById('rpPanel');
  const draft = rpSel === 'draft';
  const r = draft ? rpDraft : list.filter(x => x.id === rpSel)[0];

  if(!r){
    box.innerHTML = `<div class="ck-empty">
      <b>Chọn một báo cáo để đọc</b>
      <p>${rpIsLead() ? 'Bấm một dòng bên trái để xem chi tiết tuần làm việc của sales.'
                      : 'Hoặc soạn báo cáo mới cho tuần này.'}</p>
    </div>`;
    return;
  }

  const s = r.stats;
  const listOf = (title, items, render) => `
    <div class="wc-sec">
      <div class="wc-sec-h"><h3>${title}</h3><span>${items.length}</span></div>
      ${items.length ? items.map(render).join('') : '<div class="rp-sum">Không có mục nào.</div>'}
    </div>`;

  box.innerHTML = `
    <h3>${ckEsc(r.picLabel)} — tuần ${ckEsc(r.weekLabel)}</h3>
    <div class="rp-meta">${draft ? 'Bản nháp · số liệu chốt khi bấm gửi'
      : 'Đã gửi ' + ckVN(r.createdAt) + ' · đến ' + ckEsc((r.to||[]).join(', ') || '—')}</div>

    <div class="wc-stats" style="margin-top:16px">
      <div class="wc-stat" style="--sc:var(--wc-done)"><b>${s.done}</b><span>Đã làm</span></div>
      <div class="wc-stat" style="--sc:var(--wc-miss)"><b>${s.missed}</b><span>Chưa đánh dấu</span></div>
      <div class="wc-stat" style="--sc:var(--marine)"><b>${s.changes}</b><span>Thay đổi dự án</span></div>
      <div class="wc-stat" style="--sc:var(--overdue)"><b>${s.overdue}</b><span>Quá hạn</span></div>
    </div>

    <div class="rp-charts">
      <div class="rp-chart">
        <h4>Hoạt động theo loại</h4>
        <div id="rpChart1"></div><div class="legend" id="rpLeg1"></div>
        <p class="rp-sum" id="rpSum1"></p>
      </div>
      <div class="rp-chart">
        <h4>Dự án đang chạy theo giai đoạn</h4>
        <div id="rpChart2"></div><div class="legend" id="rpLeg2"></div>
        <p class="rp-sum" id="rpSum2"></p>
      </div>
    </div>

    ${listOf('Hoạt động đã làm', r.doneActs, a => `
      <div class="wc-item"><div class="wc-item-t">
        <span class="wc-item-n">${ckEsc(a.custLabel)}</span>
        <span class="ck-tag" style="--kc:var(--ck-act);--kc-bg:rgba(14,116,144,.10)">${ckEsc(a.type||'—')}</span>
        <span class="wc-kg">${ckVN(a.date)}</span></div>
        <div class="wc-item-r">${ckEsc(a.note||'—')}</div></div>`)}

    ${r.missedActs.length ? listOf('Kế hoạch chưa đánh dấu', r.missedActs, a => `
      <div class="wc-item"><div class="wc-item-t">
        <span class="wc-item-n">${ckEsc(a.custLabel)}</span>
        <span class="ck-badge warn">${ckVN(a.date)}</span></div>
        <div class="wc-item-r">${ckEsc(a.note||'—')}</div></div>`) : ''}

    ${listOf('Thay đổi dự án', r.projectChanges.slice(0,15), c => `
      <div class="wc-item"><div class="wc-item-t">
        <span class="wc-item-n">${ckEsc(c.custLabel)}</span>
        <span class="wc-kg">${ckVN(c.ts)}</span></div>
        <div class="wc-item-r">${ckEsc(c.product||'')}${c.text ? ' — ' + ckEsc(c.text.slice(0,110)) : ''}</div></div>`)}

    <div class="rp-field">
      <label for="rpNote">Nhận xét của ${draft ? 'bạn' : ckEsc(r.picLabel)}</label>
      ${draft
        ? `<textarea id="rpNote" placeholder="Vd: Tuần này tập trung nhóm DAIRY, hai khách hẹn thử mẫu tuần sau…"></textarea>
           <p class="hint">Nhận xét gửi kèm số liệu ở trên. Số liệu được chốt tại thời điểm gửi.</p>`
        : `<div class="rp-sum" style="font-size:13px;color:var(--text-2)">${ckEsc(r.note || 'Không có nhận xét.')}</div>`}
    </div>

    ${draft ? `<div class="rp-send">
      <button class="btn-primary" onclick="sendReport()">Gửi cho quản lý</button>
      <button class="btn-ghost" onclick="rpDiscard()">Bỏ bản nháp</button>
      <span class="rp-to">Người nhận: ${ckEsc(managerNames().join(', ') || '—')}</span>
    </div>` : ''}`;

  rpDrawCharts(r);
}

/* ====== BIỂU ĐỒ ======
   Không mượn donut() của dashboard vì tooltip ở đó ghi cứng đơn vị "dự án". */
function rpDrawCharts(r){
  const pic = r.pic;
  const data = reportCharts(r, pic);
  rpDonut('rpChart1','rpLeg1','rpSum1', data.actsByType, 'hoạt động',
    'Chưa có hoạt động nào được đánh dấu hoàn thành trong tuần.');
  rpDonut('rpChart2','rpLeg2','rpSum2', data.openByStage, 'dự án',
    'Không có dự án nào đang chạy.');
}

function rpDonut(elId, legId, sumId, items, unit, emptyMsg){
  const sum = document.getElementById(sumId);
  const leg = document.getElementById(legId);
  const total = items.reduce((s,i) => s + i.value, 0);

  if(!total){
    chartEmpty(elId,'donut-box', emptyMsg);
    if(leg) leg.innerHTML = '';
    if(sum) sum.textContent = '';
    return;
  }
  const withColor = items.map((i,k) => Object.assign({}, i, { color: RP_COLORS[k % RP_COLORS.length] }));

  /* Bản tóm tắt bằng chữ: biểu đồ một mình không đọc được bằng trình đọc màn hình. */
  if(sum) sum.textContent = 'Tổng ' + total + ' ' + unit + ': ' +
    withColor.map(i => i.label + ' ' + i.value).join(' · ');

  if(!window.Chart){ chartFallback(elId, legId); return; }
  try{
    dc(elId);
    const cv = mkCanvas(elId,'donut-box');
    rc(elId, new Chart(cv, {
      type:'doughnut',
      data:{ labels: withColor.map(i => i.label),
             datasets:[{ data: withColor.map(i => i.value), backgroundColor: withColor.map(i => i.color),
                         borderWidth:2, borderColor:'#fff', hoverOffset:8 }] },
      options:{ cutout:'68%', responsive:true, maintainAspectRatio:false,
        animation:{ duration: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420,
                    easing:'easeOutQuart' },
        plugins:{ legend:{ display:false },
          tooltip:{ padding:11, cornerRadius:9,
            callbacks:{ label: c => ' ' + c.parsed + ' ' + unit + ' · ' + Math.round(100*c.parsed/total) + '%' } } } }
    }));
  }catch(e){ chartError(elId,'donut-box',e); }

  if(leg) leg.innerHTML = withColor.map(i =>
    `<div class="li"><span class="sw" style="background:${i.color}"></span>${ckEsc(i.label)}<b>${i.value}</b><small>${Math.round(100*i.value/total)}%</small></div>`).join('');
}

/* ====== GỬI ====== */
function sendReport(){
  if(!rpDraft) return;
  const note = (document.getElementById('rpNote')||{}).value || '';
  rpDraft.note = note.trim();
  rpDraft.to = managerNames();
  const saved = LS.addReport(rpDraft);
  notifyPlain('đã gửi <b>báo cáo tuần ' + saved.weekLabel + '</b> — ' +
    saved.stats.done + ' hoạt động, ' + saved.stats.changes + ' thay đổi dự án', saved.to);
  rpDraft = null; rpSel = saved.id;
  renderReports();
  toast('Đã gửi báo cáo tuần ' + saved.weekLabel + ' đến: ' + saved.to.join(', ') + '.');
}
window.sendReport = sendReport;

function rpDiscard(){
  if(rpDraftDirty() && !confirm('Bỏ bản nháp và nội dung đã gõ?')) return;
  rpDraft = null; rpSel = null; renderReports();
}
window.rpDiscard = rpDiscard;
