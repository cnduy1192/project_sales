/* js/views/funnel.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== RENDER FUNNEL ====== */
function setF(f){filter=f;document.querySelectorAll('.chip[data-f]').forEach(c=>c.classList.toggle('on',c.dataset.f===f));render();}
function fmt(n){return (n||0).toLocaleString('vi-VN')}
function stageShort(s){return (s||'').replace('SHARED BUSINESS GOAL','SHARED GOAL').replace('BUILDING A SOLUTION','BUILDING').replace('SOLUTION TESTING','TESTING').replace('OFFER & AGREEMENT','OFFER').replace('QUOTED / PO','QUOTED/PO').replace('TEST PASSED','PASSED')}
function probPct(r){return Math.round((r.prob||0)*100)}
function rowHTML(r, subId){
  const u = USERS.find(x=>x.pic===r.pic);
  const col = u?u.color:'#8A90A4';
  const overdue = subId==='overdue' ? ` <span class="pill p-over" style="font-size:10px;padding:2px 7px">trễ ${Math.round((TODAY-new Date(r.closing))/864e5)} ngày</span>`:'';
  const editable = canEdit(r) && r.status==='IN PROGRESS';
  const probBtn = editable
    ? `<button class="prob-btn" onclick="event.stopPropagation();openProbPop('${r.id}',event)">${probPct(r)}%<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>`
    : `<span class="prob-btn locked">${probPct(r)}%</span>`;
  const closeBtn = canClose(r)
    ? `<button class="close-btn" onclick="event.stopPropagation();openCloseModal('${r.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 13l2 2 4-4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 3v4M15 3v4"/></svg>Đóng</button>` : '';
  return `<div class="row" onclick="openDetail('${r.id}')">
    <div class="r-main"><b>${r.customer}</b><small>đóng ${r.closing? new Date(r.closing).toLocaleDateString('vi-VN'):'—'}${overdue}</small></div>
    <div class="r-app">${r.application}</div>
    <div class="r-prod">${r.product}</div>
    <div><span class="pill ${stageCls(r.stage)}"><span class="dot"></span>${stageShort(r.stage)}</span></div>
    <div>${probBtn}</div>
    <div class="r-kg">${fmt(r.kgThis)}<small>KG 2026</small></div>
    <div class="r-pic"><span class="avatar" style="width:24px;height:24px;font-size:10px;background:${col}">${(r.pic||'?').slice(0,2).toUpperCase()}</span>${r.pic||'—'}</div>
    <div>${closeBtn}</div>
  </div>`;
}
const SPINE_PALETTE=['#0B4F9E','#00838F','#F59E0B','#7C3AED','#0D9488','#DB2777'];
function renderSpine(rs){
  const box=document.getElementById('spineBox');
  const stages=activeStages();
  if(!rs.length||!stages.length){box.style.display='none';return;}
  box.style.display='block';
  box.classList.toggle('filtered',!!stageFilter);
  document.getElementById('spineClear').classList.toggle('show',!!stageFilter);
  document.getElementById('spineFlow').innerHTML=stages.map((s,i)=>{
    const n=rs.filter(r=>r.stage===s).length;
    return `<button class="spine-step${stageFilter===s?' on':''}" onclick="stageFilter=stageFilter==='${s.replace(/'/g,"\\'")}'?null:'${s.replace(/'/g,"\\'")}';render()"
      aria-pressed="${stageFilter===s}" title="${s}: ${n} dự án">
      <div class="spine-chev" style="--sc:${SPINE_PALETTE[i%SPINE_PALETTE.length]}">
        <div class="spine-num">${n}</div><div class="spine-lbl">${stageShort(s)}</div>
      </div></button>`;}).join('');
}
const THEAD=`<div class="thead"><div>Khách hàng</div><div>Ứng dụng</div><div>Sản phẩm</div><div>Giai đoạn</div><div>% dự án</div><div style="text-align:right">Tiềm năng</div><div>PIC</div><div></div></div>`;
function render(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  const rows=visible().filter(r=> filter==='ALL'||r.status===filter)
    .filter(r=> !q || (r.customer+r.product+r.application+(r.pic||'')).toLowerCase().includes(q))
    .filter(r=> !stageFilter || r.stage===stageFilter);
  renderSpine(visible().filter(r=>r.status==='IN PROGRESS'));
  const box=document.getElementById('groups'); box.innerHTML='';
  MAJORS.forEach(M=>{
    const mRows=rows.filter(r=> M.subs.some(s=>s.id===grp(r))); if(!mRows.length)return;
    const mKg=mRows.reduce((s,r)=>s+r.kgThis,0);
    const mEl=document.createElement('div'); mEl.className='major glass'+(collapsed['major-'+M.id]?' collapsed':'');
    let subsHTML='';
    M.subs.forEach(S=>{
      const rs=mRows.filter(r=>grp(r)===S.id); if(!rs.length)return;
      rs.sort((a,b)=>(a.closing||'9999')<(b.closing||'9999')?-1:1);
      const kg=rs.reduce((s,r)=>s+r.kgThis,0);
      const cid='sub-'+S.id;
      subsHTML+=`<div class="sub${collapsed[cid]?' collapsed':''}">
        <div class="sub-head" onclick="collapsed['${cid}']=!collapsed['${cid}'];render()">
          <span class="g-bar" style="background:${S.color}"></span>
          <span class="s-title">${S.title}</span><span class="g-count">${rs.length} dự án</span>
          <span class="g-kg">${fmt(kg)} <small>KG/năm</small></span>
          <button class="g-toggle" aria-label="Thu gọn / mở rộng"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
        </div>
        <div class="sub-body">${THEAD}${rs.map(r=>rowHTML(r,S.id)).join('')}</div>
      </div>`;
    });
    mEl.innerHTML=`<div class="major-head" onclick="collapsed['major-${M.id}']=!collapsed['major-${M.id}'];render()">
      <span class="g-bar" style="background:${M.color}"></span>
      <span class="m-title">${M.title}</span><span class="g-count">${mRows.length} dự án</span>
      <span class="g-kg">${fmt(mKg)} <small>KG/năm</small></span>
      <button class="g-toggle" aria-label="Thu gọn / mở rộng"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
    </div><div class="major-body">${subsHTML}</div>`;
    box.appendChild(mEl);
  });
  if(!box.children.length) box.innerHTML=`<div class="major glass"><div class="empty"><b>Không có dự án nào</b>Thử đổi bộ lọc, hoặc bấm "Thêm dự án" để tạo mới.</div></div>`;
}

/* ====== % QUICK EDIT POPOVER ====== */
function openProbPop(id,ev){
  probRecId=id;
  const r=RECORDS.find(x=>x.id===id);
  const pop=document.getElementById('probPop');
  document.getElementById('ppChips').innerHTML=PROB_OPTS.map(p=>
    `<button class="pp-chip${probPct(r)===p?' on':''}" onclick="setProb(${p})">${p}%</button>`).join('');
  pop.classList.add('open');
  const w=pop.offsetWidth||300;
  pop.style.left=Math.min(ev.clientX-40, innerWidth-w-12)+'px';
  pop.style.top=Math.min(ev.clientY+14, innerHeight-110)+'px';
}
function setProb(p){
  const r=RECORDS.find(x=>x.id===probRecId); if(!r)return;
  const old=probPct(r);
  r.prob=p/100;
  document.getElementById('probPop').classList.remove('open');
  if(old!==p){notify(r,`đã cập nhật % dự án <b>${r.customer} · ${r.product}</b>: ${old}% → ${p}%`);toast(`% dự án ${r.customer} · ${r.product}: ${old}% → ${p}%. Đã thông báo người liên quan.`);}
  render();
}
document.addEventListener('click',e=>{if(!e.target.closest('.prob-pop')&&!e.target.closest('.prob-btn'))document.getElementById('probPop').classList.remove('open');});

/* ====== CLOSE PROJECT ====== */
function openCloseModal(id){
  const r=RECORDS.find(x=>x.id===id); if(!r||!canClose(r)){toast('Chỉ người tạo dự án (PIC) hoặc Manager mới có quyền đóng dự án.');return;}
  closeRecId=id; closeResult=null;
  document.getElementById('c-sub').innerHTML=`<span class="pill p-sbg">${r.customer} · ${r.product}</span>`;
  document.getElementById('c-won').classList.remove('sel');
  document.getElementById('c-lost').classList.remove('sel');
  document.getElementById('c-reason').value='';
  closeDetail();
  document.getElementById('cov').classList.add('open');
}
function pickResult(res){
  closeResult=res;
  document.getElementById('c-won').classList.toggle('sel',res==='WON');
  document.getElementById('c-lost').classList.toggle('sel',res==='LOST');
}
function confirmClose(){
  const r=RECORDS.find(x=>x.id===closeRecId); if(!r)return;
  const reason=document.getElementById('c-reason').value.trim();
  if(!closeResult){toast('Chọn kết quả Thắng hoặc Thua.');return;}
  if(!reason){toast('Vui lòng nhập lý do đóng dự án.');return;}
  r.status=closeResult; r.prob=closeResult==='WON'?1:0;
  r.comments.push({by:me.pic||me.name,at:nowStr(),text:`[Đóng dự án — ${STATUS_VI[closeResult]}] ${reason}`});
  notify(r,`đã đóng dự án <b>${r.customer} · ${r.product}</b> — kết quả: <b>${STATUS_VI[closeResult]}</b>. Lý do: ${reason.slice(0,60)}${reason.length>60?'…':''}`);
  closeCloseModal(); render();
  toast(`Đã đóng ${r.id} (${STATUS_VI[closeResult]}). Thông báo gửi qua Email & Teams đến: ${recipientsOf(r).join(', ')}.`);
}
function closeCloseModal(){document.getElementById('cov').classList.remove('open');closeRecId=null;}

