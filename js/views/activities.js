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
      <div class="act-date">${new Date(a.date).toLocaleDateString('vi-VN')}<span class="act-type">${actType(a.type)}</span></div>
      <div><b style="font-size:13px">${a.customer}</b><div style="font-size:11px;color:var(--ink-3)">${a.ncc}</div></div>
      <div class="r-pic"><span class="avatar" style="width:22px;height:22px;font-size:9.5px;background:${u?u.color:'#8A90A4'}">${(a.pic||'?').slice(0,2).toUpperCase()}</span>${a.pic}</div>
      <div class="act-note">${a.note}${actPending(a)?' <span class="act-pending" title="Đã lưu trên máy bạn, chưa lên SharePoint — quản lý chưa thấy. Sẽ tự thử lại ở lần đăng nhập sau.">chưa đồng bộ</span>':''}<small>→ ${a.next}</small></div>
      <div><span class="pot pot-${potLabel(a.potential)}">${potLabel(a.potential)}</span></div>
      <div>${link}</div></div>`;}).join('');
}
/* prefill là tuỳ chọn — gọi openActForm() không tham số thì hành vi y như trước.
   Màn hình chào tuần truyền sẵn khách hàng, NCC, ngày và dự án vào đây. */
/* Nhãn cũ Hot/Warm/Cold vẫn nằm trong dữ liệu SharePoint và các activity đã lưu,
   nên ánh xạ sang High/Medium/Low khi hiển thị và khi nạp vào form. */
const POT_MAP = { Hot:'High', Warm:'Medium', Cold:'Low' };
function potLabel(v){ return POT_MAP[v] || v || ''; }
window.potLabel = potLabel;
/* Loại hoạt động: Seminar cũ gộp về Exhibition; các giá trị lạ giữ nguyên. */
const ACT_TYPE_MAP = { Seminar:'Exhibition', 'Khác':'Call' };
function actType(v){ return ACT_TYPE_MAP[v] || v || 'Call'; }

/* Một khách hàng có thể được nhiều sales tương tác, nhưng chỉ một người là chủ
   quản lý (Owner trên list Customers). Khi chọn khách, cho biết ai đang quản lý. */
function onActCustomer(){
  const name = (document.getElementById('a-cust').value || '').trim();
  const box = document.getElementById('a-owner');
  if(!box) return;
  if(!name){ box.hidden = true; box.textContent = ''; return; }
  const owner = (typeof customerOwnerOf === 'function') ? customerOwnerOf(name) : '';
  const mine = owner && me && (owner === (me.pic || me.name));
  box.hidden = false;
  box.className = 'owner-note' + (mine ? ' me' : (owner ? '' : ' none'));
  /* Chỉ nêu khách này của ai. Tên chủ đặt CUỐI câu (trong <b>) để phần chữ còn
     lại là một text-node liền mạch, dịch EN không bị cắt ngang bởi tên riêng. */
  box.innerHTML = !owner
    ? 'Khách hàng chưa có người tiếp quản.'
    : mine
    ? 'Bạn đang quản lý khách hàng này.'
    : 'Khách hàng đang được quản lý bởi <b>' + esc4(owner) + '</b>.';
}
window.onActCustomer = onActCustomer;

function openActForm(prefill, origin){
  const p = prefill && typeof prefill === 'object' ? prefill : {};
  srcAct=null;
  NAV.enter(origin); NAV.renderBack('a-back');
  document.getElementById('a-title').textContent = p.title || 'Kế hoạch làm việc';
  document.getElementById('a-sub').innerHTML = p.sub ? esc4(p.sub) : '';
  const ncc = p.ncc || formNcc();
  /* Danh bạ khách hàng: hiện TOÀN BỘ khách của phần mềm, kể cả khách do sales khác
     phụ trách — nhân viên thấy được, chọn xong dòng owner-note báo khách của ai. */
  const allCust = (typeof CUSTOMER_DIR !== 'undefined' && CUSTOMER_DIR.length)
    ? CUSTOMER_DIR.map(c => c.name) : LISTS.customers;
  const seenC = new Set(); const custList = [];
  allCust.concat(LISTS.customers).forEach(n => {
    const k = String(n||'').trim(); if(!k || seenC.has(k.toLowerCase())) return;
    seenC.add(k.toLowerCase()); custList.push(k);
  });
  const dc = document.getElementById('dl-cust-all');
  if(dc) dc.innerHTML = custList.slice(0,2000).map(n=>`<option value="${esc4(n)}"></option>`).join('');
  /* Nhà cung cấp: danh sách đầy đủ các NCC + lựa chọn "Khác" cho hoạt động chung. */
  const nccOpts = NCCS.concat(NCCS.indexOf(OTHER_NCC) < 0 ? [OTHER_NCC] : []);
  document.getElementById('a-ncc').innerHTML =
    nccOpts.map(n=>`<option${n===ncc?' selected':''}>${esc4(n)}</option>`).join('');
  document.getElementById('a-date').value = p.date || isoOf(TODAY);
  document.getElementById('a-cust').value = p.customer || '';
  document.getElementById('a-note').value = p.note || '';
  document.getElementById('a-next').value = p.next || '';
  document.getElementById('a-type').value = actType(p.type);
  document.getElementById('a-pot').value = p.potential ? potLabel(p.potential) : 'High';
  onActCustomer();
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
  /* Nhà cung cấp cho phép nhập tự do: nhận đúng chuỗi đã gõ; rỗng thì về "Khác". */
  const ncc=g('a-ncc')||OTHER_NCC;
  const a={id:LS.nextActId(),customer:g('a-cust'),pic:me.pic||me.name,
    ncc:ncc,product:'',type:g('a-type'),date:g('a-date'),note:g('a-note')||'(không có nội dung)',
    next:g('a-next')||'—',potential:g('a-pot'),projectId:g('a-proj')||null};
  ACTIVITIES.unshift(a);
  LS.addAct(a);
  if(!LISTS.customers.includes(a.customer))LISTS.customers.push(a.customer);
  /* NCC mới gõ tay được ghi nhớ cho phiên làm việc để lần sau chọn lại từ gợi ý. */
  if(ncc && ncc!==OTHER_NCC && !LISTS.nccs.some(n=>String(n).trim().toLowerCase()===ncc.toLowerCase())){
    LISTS.nccs.push(ncc); if(window.dedupeNccs) dedupeNccs();
  }
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
    /* Đổi luôn sang id của SharePoint và bỏ bản địa phương. Bản trước chỉ đánh
       dấu đã gửi mà vẫn giữ bản AL-, nên lần đăng nhập sau bảng hiện HAI dòng:
       một bản SharePoint và một bản còn kẹt trong máy. */
    const oldId = a.id;
    LS.markSent(oldId, spId);
    a.spId = spId; a.id = 'A-' + spId;
    LS.dropAct(oldId, a.id);
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

