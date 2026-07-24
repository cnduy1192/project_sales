/* js/views/activities.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== ACTIVITIES ↔ PROJECTS (2 chiều) ====== */
function setAF(f){actFilter=f;document.querySelectorAll('.chip[data-af]').forEach(c=>c.classList.toggle('on',c.dataset.af===f));renderActs();}
function actsOfProject(id){return ACTIVITIES.filter(a=>a.projectId===id);}
function renderActs(){
  const box=document.getElementById('actRows'); if(!box)return;
  let rows=visibleActs();
  if(actFilter==='LINKED')rows=rows.filter(a=>a.projectId);
  if(actFilter==='FREE')rows=rows.filter(a=>!a.projectId);
  rows=rows.slice(0,120);
  if(!rows.length){box.innerHTML='<div class="empty"><b>Chưa có hoạt động nào</b>Bấm "Ghi hoạt động" để bắt đầu.</div>';return;}
  box.innerHTML=rows.map(a=>{
    const pr=a.projectId?RECORDS.find(r=>r.id===a.projectId):null;
    const u=USERS.find(x=>x.pic===a.pic);
    const link=pr
      ? `<button class="act-link" onclick="openDetail('${pr.id}')" title="${pr.customer} · ${pr.product}">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>
           ${pr.product==='—'?pr.customer:pr.product}</button>`
      : `<button class="act-new" onclick="createProjectFromAct('${a.id}')">+ Tạo dự án</button>`;
    return `<div class="act-row">
      <div class="act-date">${new Date(a.date).toLocaleDateString('vi-VN')}<span class="act-type">${a.type}</span></div>
      <div><b style="font-size:13px">${a.customer}</b><div style="font-size:11px;color:var(--ink-3)">${a.ncc}</div></div>
      <div class="r-pic"><span class="avatar" style="width:22px;height:22px;font-size:9.5px;background:${u?u.color:'#8A90A4'}">${(a.pic||'?').slice(0,2).toUpperCase()}</span>${a.pic}</div>
      <div class="act-note">${a.note}<small>→ ${a.next}</small></div>
      <div><span class="pot pot-${a.potential}">${a.potential}</span></div>
      <div>${link}</div></div>`;}).join('');
}
function openActForm(){
  srcAct=null;
  document.getElementById('a-title').textContent='Ghi hoạt động khách hàng';
  document.getElementById('a-sub').innerHTML='';
  document.getElementById('a-ncc').innerHTML=NCCS.map(n=>`<option${n===nccFilter?' selected':''}>${n}</option>`).join('');
  document.getElementById('a-date').value='2026-07-07';
  ['a-cust','a-note','a-next'].forEach(x=>document.getElementById(x).value='');
  const mine=visible().filter(r=>r.status==='IN PROGRESS');
  document.getElementById('a-proj').innerHTML='<option value="">— Chưa gắn dự án nào —</option>'
    +mine.slice(0,200).map(r=>`<option value="${r.id}">${r.customer} · ${r.product}</option>`).join('');
  document.getElementById('aov').classList.add('open');
}
function closeActForm(){document.getElementById('aov').classList.remove('open');}
function saveAct(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('a-cust')){toast('Nhập tên khách hàng.');return;}
  const a={id:'A-'+String(ACTIVITIES.length+1).padStart(4,'0'),customer:g('a-cust'),pic:me.pic||me.name,
    ncc:g('a-ncc'),product:'',type:g('a-type'),date:g('a-date'),note:g('a-note')||'(không có nội dung)',
    next:g('a-next')||'—',potential:g('a-pot'),projectId:g('a-proj')||null};
  ACTIVITIES.unshift(a);
  if(!LISTS.customers.includes(a.customer))LISTS.customers.push(a.customer);
  if(a.projectId){
    const pr=RECORDS.find(r=>r.id===a.projectId);
    if(pr){pr.comments.push({by:a.pic,at:a.date,text:'['+a.type+'] '+a.note+' → '+a.next});
      notify(pr,`đã ghi hoạt động vào <b>${pr.customer} · ${pr.product}</b>: ${a.note}`);}
  }
  closeActForm(); renderActs(); render();
  toast('Đã lưu hoạt động'+(a.projectId?' và gắn vào dự án — đã thông báo người liên quan.':'. Có thể tạo dự án từ hoạt động này bất cứ lúc nào.'));
}
function createProjectFromAct(aid){
  const a=ACTIVITIES.find(x=>x.id===aid); if(!a)return;
  srcAct=a;
  openForm();
  document.getElementById('f-cust').value=a.customer;
  document.getElementById('f-ncc').value=a.ncc; onFormNcc();
  if(a.product)document.getElementById('f-prod').value=a.product;
  document.getElementById('f-desc').value='['+a.type+' '+a.date+'] '+a.note+' → '+a.next;
  toast('Đã kéo sẵn thông tin từ hoạt động của '+a.customer+'. Bổ sung phần còn thiếu rồi lưu.');
}

