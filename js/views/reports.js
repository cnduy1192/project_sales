/* js/views/reports.js — mục Báo cáo. Một view, nội dung theo vai trò:
   sales soạn và xem báo cáo của mình, manager/admin đọc của cả đội. */

let rpSel = null;        // id báo cáo đang mở, hoặc 'draft'
let rpDraft = null;      // bản nháp chưa gửi
let rpFilterPic = '';
const RP_COLORS = ['#01426A','#0E7490','#B45309','#6D28D9','#0D9488','#DB2777','#157F3C'];

function rpIsLead(){ return !!(me && cap(me.role).scope === 'all'); }

/* Báo cáo ĐÃ GỬI lấy từ SharePoint (REPORTS). Khi chưa đăng nhập được Graph thì
   lùi về localStorage để vẫn xem được bản cũ trên máy này. */
function rpSentReports(){
  const useSp = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite()
             && typeof REPORTS !== 'undefined';
  const all = useSp ? REPORTS.slice() : (window.LS ? LS.allReports() : []);
  if(rpIsLead())
    return all.filter(r => !rpFilterPic || picKey(r.pic) === picKey(rpFilterPic));
  return all.filter(r => picKey(r.pic) === picKey((me && me.pic) || ''));
}

/* Ai được viết phản hồi trên một báo cáo: quản lý (nhìn toàn đội) trên MỌI báo
   cáo; sales trên báo cáo của CHÍNH MÌNH (trao đổi hai chiều). */
function rpCanComment(r){
  if(!me || !r) return false;
  if(cap(me.role).scope === 'all') return true;
  return picKey(r.pic) === picKey(me.pic || '');
}

/* ====== ĐIỀU PHỐI ====== */
function renderReports(){
  const list = rpSentReports();
  rpRenderTools(list);
  rpRenderList(list);
  rpRenderPanel(list);
  /* Một trang giữa: có báo cáo/nháp đang mở thì ẩn danh sách, hiện tài liệu. */
  const grid = document.querySelector('#view-reports .rp-grid');
  const open = !!(rpSel && (rpSel === 'draft' ? rpDraft : list.some(x => x.id === rpSel)));
  if(grid) grid.classList.toggle('has-open', open);
  if(window.markReportsSeen) markReportsSeen();   // mở mục Báo cáo = đã xem
}
window.renderReports = renderReports;

function rpRenderTools(list){
  const box = document.getElementById('rpTools');
  if(rpIsLead()){
    const src = (window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite() && typeof REPORTS!=='undefined')
      ? REPORTS : (window.LS ? LS.allReports() : []);
    const pics = Array.from(new Set(src.map(r => picKey(r.pic)))).sort();
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
  box.innerHTML = draftRow + list.map(r => {
    const nc = (r.comments || []).length;
    return `<button class="rp-row" aria-current="${rpSel===r.id}" onclick="rpSelect('${ckAttr(r.id)}')">
      <b>${ckEsc(r.picLabel)} — tuần ${ckEsc(r.weekLabel)}</b>
      <span class="w">${ckVN(r.createdAt)}${nc ? ` <span class="rp-cc">${nc} phản hồi</span>` : ''}</span>
      <span class="s">${r.stats.done} đã làm · ${r.stats.missed} chưa đánh dấu · ${r.stats.changes} thay đổi dự án</span>
    </button>`;
  }).join('');
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
    <button class="rp-back" onclick="rpSelect(null)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Tất cả báo cáo</button>
    <h3>${ckEsc(r.picLabel)} — tuần ${ckEsc(r.weekLabel)}</h3>
    <div class="rp-meta">${draft ? 'Bản nháp · số liệu chốt khi bấm gửi'
      : 'Đã gửi ' + ckVN(r.createdAt)}</div>

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
    </div>` : rpThreadHtml(r)}`;

  rpDrawCharts(r);
}

/* ====== LUỒNG PHẢN HỒI ====== */
function rpThreadHtml(r){
  const cmts = r.comments || [];
  const thread = cmts.length
    ? cmts.map(c => {
        const mine = me && picKey(c.by) === picKey(me.pic || me.name);
        const lead = c.role && cap(c.role).scope === 'all';
        return `<div class="rp-cmt${mine?' me':''}">
          <div class="rp-cmt-h"><b>${ckEsc(picLabel(c.by) || c.by || '—')}</b>
            ${lead ? '<span class="rp-cmt-tag">Quản lý</span>' : ''}
            <span>${ckVN(c.at)}</span></div>
          <div class="rp-cmt-b">${ckEsc(c.text || '')}</div>
        </div>`;
      }).join('')
    : '<div class="rp-sum">Chưa có phản hồi nào.</div>';

  const canComment = rpCanComment(r);
  const box = canComment
    ? `<div class="rp-cmt-form">
         <textarea id="rpCmt" placeholder="${cap(me.role).scope==='all'
            ? 'Phản hồi cho ' + ckEsc(r.picLabel) + '…' : 'Trả lời quản lý…'}" rows="2"></textarea>
         <button class="btn-primary" onclick="rpPostComment('${ckAttr(r.id)}')">Gửi phản hồi</button>
       </div>`
    : '';

  return `<div class="rp-thread">
    <div class="wc-sec-h"><h3>Trao đổi</h3><span>${cmts.length}</span></div>
    <div class="rp-thread-list">${thread}</div>
    ${box}
  </div>`;
}

function rpPostComment(code){
  const el = document.getElementById('rpCmt');
  const text = el ? el.value.trim() : '';
  if(!text){ toast('Nhập nội dung phản hồi.'); return; }
  const r = rpSentReports().find(x => x.id === code);
  if(!r || !rpCanComment(r)){ toast('Bạn không có quyền phản hồi báo cáo này.'); return; }
  if(!(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite())){
    toast('Chưa đăng nhập Microsoft 365 — chưa gửi được phản hồi.'); return;
  }
  const btn = el && el.parentElement.querySelector('button');
  if(btn){ btn.disabled = true; btn.textContent = 'Đang gửi…'; }
  /* Hiện ngay trên màn hình để người viết thấy phản hồi của mình, rồi ghi. */
  const by = (me && (me.pic || me.name)) || '';
  r.comments = (r.comments || []).concat([{ by:by, role:me.role, at:todayISO(), text:text }]);
  renderReports();
  FISG_STORE.addReportComment(code, text, by, me.role).then(()=>{
    if(window.refreshNotifs) refreshNotifs();
    renderReports();
    toast('Đã gửi phản hồi.');
  }).catch(e=>{
    console.warn('[reports] gửi phản hồi hỏng:', e && (e.message||e));
    toast('CHƯA gửi được phản hồi lên SharePoint: ' + (e.message||e));
    renderReports();
  });
}
window.rpPostComment = rpPostComment;

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
  if(!rpDraft.id) rpDraft.id = (window.LS && LS.nextReportId) ? LS.nextReportId() : ('R-'+Date.now().toString(36).toUpperCase());
  rpDraft.createdAt = rpDraft.createdAt || todayISO();

  const draft = rpDraft;
  if(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite()){
    const btn = document.querySelector('.rp-send .btn-primary');
    if(btn){ btn.disabled = true; btn.textContent = 'Đang gửi…'; }
    FISG_STORE.sendReportToSP(draft).then(code=>{
      rpDraft = null; rpSel = code;
      if(window.refreshNotifs) refreshNotifs();
      renderReports();
      toast('Đã gửi báo cáo tuần ' + draft.weekLabel + '.');
    }).catch(e=>{
      console.warn('[reports] gửi báo cáo hỏng:', e && (e.message||e));
      toast('CHƯA gửi được lên SharePoint: ' + (e.message||e) + '. Bản nháp vẫn còn để gửi lại.');
      if(btn){ btn.disabled = false; btn.textContent = 'Gửi cho quản lý'; }
    });
    return;
  }
  /* Không đăng nhập Graph: lùi về localStorage (chỉ máy này thấy). */
  const saved = LS.addReport(draft);
  notifyPlain('đã gửi <b>báo cáo tuần ' + saved.weekLabel + '</b>', saved.to);
  rpDraft = null; rpSel = saved.id;
  renderReports();
  toast('Đã lưu báo cáo trên máy này (chưa đăng nhập SharePoint nên quản lý chưa nhận được).');
}
window.sendReport = sendReport;

function rpDiscard(){
  if(rpDraftDirty() && !confirm('Bỏ bản nháp và nội dung đã gõ?')) return;
  rpDraft = null; rpSel = null; renderReports();
}
window.rpDiscard = rpDiscard;
