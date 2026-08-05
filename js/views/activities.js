/* js/views/activities.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== ACTIVITIES ↔ PROJECTS (2 chiều) ====== */
function setAF(f){actFilter=f;document.querySelectorAll('.chip[data-af]').forEach(c=>c.classList.toggle('on',c.dataset.af===f));renderActs();}
/* Hoạt động của một dự án — vẫn phải qua bộ lọc quyền: sales không được đọc
   ghi chú của sales khác trên dự án mình không liên quan. */
function actsOfProject(id){
  return scopeActs(ACTIVITIES.filter(a=>a.projectId===id), me, scopeRecords(RECORDS, me));
}
function renderActs(){
  const box=document.getElementById('actRows'); if(!box)return;
  let rows=visibleActs();
  if(actFilter==='LINKED')rows=rows.filter(a=>a.projectId);
  if(actFilter==='FREE')rows=rows.filter(a=>!a.projectId);
  rows=rows.slice(0,120);
  if(!rows.length){box.innerHTML='<div class="empty"><b>Chưa có hoạt động nào</b>Bấm "Ghi hoạt động" để bắt đầu.</div>';return;}
  box.innerHTML=rows.map(a=>{
    /* Hoạt động của mình có thể gắn vào dự án của sales khác. Thấy hoạt động
       không có nghĩa được thấy dự án — nên chỉ hiện nút mở khi thật sự có quyền,
       còn lại là một nhãn câm, không lộ tên sản phẩm. */
    const prAll=a.projectId?RECORDS.find(r=>r.id===a.projectId):null;
    const pr=prAll && (typeof ownsRecord!=='function' || !me || ownsRecord(prAll, me)) ? prAll : null;
    const u=USERS.find(x=>x.pic===a.pic);
    const link=!pr && prAll
      ? `<span class="act-link muted" title="Dự án do sales khác phụ trách">Dự án khác</span>`
      : pr
      ? `<button class="act-link" onclick="openDetail('${pr.id}')" title="${pr.customer} · ${pr.product}">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>
           ${pr.product==='—'?pr.customer:pr.product}</button>`
      : `<button class="act-new" onclick="createProjectFromAct('${a.id}')">+ Tạo dự án</button>`;
    return `<div class="act-row">
      <div class="act-date">${new Date(a.date).toLocaleDateString('vi-VN')}<span class="act-type">${a.type}</span></div>
      <div><b style="font-size:13px">${a.customer}</b><div style="font-size:11px;color:var(--ink-3)">${a.ncc}</div></div>
      <div class="r-pic"><span class="avatar" style="width:22px;height:22px;font-size:9.5px;background:${u?u.color:'#8A90A4'}">${(a.pic||'?').slice(0,2).toUpperCase()}</span>${a.pic}</div>
      <div class="act-note">${a.note}${actPending(a)?' <span class="act-pending" title="Đã lưu trên máy bạn, chưa lên SharePoint — quản lý chưa thấy. Sẽ tự thử lại ở lần đăng nhập sau.">chưa đồng bộ</span>':''}<small>→ ${a.next}</small></div>
      <div><span class="pot pot-${a.potential}">${a.potential}</span></div>
      <div>${link}</div></div>`;}).join('');
}
/* prefill là tuỳ chọn — gọi openActForm() không tham số thì hành vi y như trước.
   Màn hình chào tuần truyền sẵn khách hàng, NCC, ngày và dự án vào đây. */
function openActForm(prefill, origin){
  const p = prefill && typeof prefill === 'object' ? prefill : {};
  srcAct=null;
  NAV.enter(origin); NAV.renderBack('a-back');
  document.getElementById('a-title').textContent = p.title || 'Ghi hoạt động khách hàng';
  document.getElementById('a-sub').innerHTML = p.sub ? esc4(p.sub) : '';
  const ncc = p.ncc || formNcc();
  /* "Khác" cho hoạt động chưa gắn nhà cung cấp nào — hội thảo chung, khách mới
     chưa rõ sẽ chào hàng của ai. Trước đây bắt buộc phải chọn một trong ba NCC. */
  const nccOpts = NCCS.concat(NCCS.indexOf(OTHER_NCC) < 0 ? [OTHER_NCC] : []);
  document.getElementById('a-ncc').innerHTML=nccOpts.map(n=>`<option${n===ncc?' selected':''}>${n}</option>`).join('');
  document.getElementById('a-date').value = p.date || isoOf(TODAY);
  document.getElementById('a-cust').value = p.customer || '';
  document.getElementById('a-note').value = p.note || '';
  document.getElementById('a-next').value = p.next || '';
  if(p.type) document.getElementById('a-type').value = p.type;
  if(p.potential) document.getElementById('a-pot').value = p.potential;
  const mine=visible().filter(r=>r.status==='IN PROGRESS');
  /* Dự án gợi ý có thể nằm ngoài nccFilter hiện tại, nên chèn thêm nếu thiếu. */
  const list = p.projectId && !mine.some(r=>r.id===p.projectId)
    ? [RECORDS.find(r=>r.id===p.projectId)].filter(Boolean).concat(mine)
    : mine;
  document.getElementById('a-proj').innerHTML='<option value="">— Chưa gắn dự án nào —</option>'
    +list.slice(0,200).map(r=>`<option value="${r.id}"${r.id===p.projectId?' selected':''}>${r.customer} · ${r.product}</option>`).join('');
  document.getElementById('aov').classList.add('open');
  document.getElementById(p.customer?'a-note':'a-cust').focus();
}
function esc4(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function closeActForm(){
  NAV.back(function(){ document.getElementById('aov').classList.remove('open'); });
}
function saveAct(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('a-cust')){toast('Nhập tên khách hàng.');return;}
  /* Id cũ sinh theo ACTIVITIES.length nên đụng ngay id có sẵn (A-0335 đã tồn tại).
     Tiền tố AL- vừa tránh đụng, vừa đánh dấu bản ghi do người dùng nhập trong
     phần mềm — thứ duy nhất phân biệt được kế hoạch với thực tế. */
  const a={id:LS.nextActId(),customer:g('a-cust'),pic:me.pic||me.name,
    ncc:g('a-ncc'),product:'',type:g('a-type'),date:g('a-date'),note:g('a-note')||'(không có nội dung)',
    next:g('a-next')||'—',potential:g('a-pot'),projectId:g('a-proj')||null};
  ACTIVITIES.unshift(a);
  LS.addAct(a);
  if(!LISTS.customers.includes(a.customer))LISTS.customers.push(a.customer);
  if(a.projectId){
    const pr=RECORDS.find(r=>r.id===a.projectId);
    if(pr){pr.comments.push({by:a.pic,at:a.date,text:'['+a.type+'] '+a.note+' → '+a.next});
      notify(pr,`đã ghi hoạt động vào <b>${pr.customer} · ${pr.product}</b>: ${a.note}`);}
  }
  closeActForm(); renderActs(); render(); cockpitRefresh();
  if(typeof welcomeRefresh==='function') welcomeRefresh();
  toast('Đã lưu hoạt động'+(a.projectId?' và gắn vào dự án — đã thông báo người liên quan.':'. Có thể tạo dự án từ hoạt động này bất cứ lúc nào.'));
  /* Hiện lên màn hình trước, đẩy lên SharePoint sau — nhập liệu không phải chờ
     mạng. Nhưng nếu đẩy hỏng thì PHẢI nói, vì lúc đó chỉ mình người nhập thấy
     việc này, quản lý không thấy gì cả. */
  pushAct(a);
}
function pushAct(a){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()) return;
  FISG_STORE.createActivity(a).then(spId=>{
    LS.markSent(a.id, spId);
    a.spId = spId;
    if(typeof invalidateCockpit==='function') invalidateCockpit();
    renderActs(); cockpitRefresh();
  }).catch(e=>{
    console.warn('[activities] chưa đẩy được lên SharePoint:', e && (e.message||e));
    renderActs();
    toast('Đã lưu trên máy bạn nhưng CHƯA lên SharePoint — quản lý chưa thấy hoạt động này. '
      + 'Phần mềm sẽ tự thử lại ở lần đăng nhập sau.');
  });
}
/* Việc đã nhập nhưng chưa lên SharePoint: chỉ mình người nhập thấy, nên phải
   nhìn ra được ngay trên bảng chứ không im lặng. */
function actPending(a){
  return !!(window.LS && LS.isLocal && LS.isLocal(a) && !a.spId
            && window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite());
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

