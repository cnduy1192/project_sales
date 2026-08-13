function setAF(f){actFilter=f;document.querySelectorAll('.chip[data-af]').forEach(c=>c.classList.toggle('on',c.dataset.af===f));renderActs();}

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

    const prAll=a.projectId?RECORDS.find(r=>r.id===a.projectId):null;
    const canSeePr = typeof ownsRecord!=='function' || !me
      || (typeof canViewAll==='function' && canViewAll(me)) || ownsRecord(prAll, me);
    const pr=prAll && canSeePr ? prAll : null;
    const u=USERS.find(x=>x.pic===a.pic);

    const link=!pr && prAll
      ? `<span class="act-link muted" title="Dự án do sales khác phụ trách">Dự án khác</span>`
      : pr
      ? `<button class="act-link" onclick="event.stopPropagation();openDetail('${pr.id}')" title="${pr.customer} · ${pr.product}">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>
           ${pr.product==='—'?pr.customer:pr.product}</button>`
      : `<button class="act-new" onclick="event.stopPropagation();createProjectFromAct('${a.id}')">+ Tạo dự án</button>`;
    return `<div class="act-row" role="button" tabindex="0" onclick="openActEdit('${a.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openActEdit('${a.id}')}"
        title="Bấm để xem & sửa hoạt động">
      <div class="act-date">${new Date(a.date).toLocaleDateString('vi-VN')}<span class="act-type">${actType(a.type)}</span></div>
      <div><b style="font-size:13px">${a.customer}</b><div style="font-size:11px;color:var(--ink-3)">${a.ncc}</div></div>
      <div class="r-pic"><span class="avatar" style="width:22px;height:22px;font-size:9.5px;background:${u?u.color:'#8A90A4'}">${(a.pic||'?').slice(0,2).toUpperCase()}</span>${a.pic}</div>
      <div class="act-note">${a.note}${actPending(a)?' <span class="act-pending" title="Đã lưu trên máy bạn, chưa lên SharePoint — quản lý chưa thấy. Sẽ tự thử lại ở lần đăng nhập sau.">chưa đồng bộ</span>':''}<small>→ ${a.next}</small></div>
      <div><span class="pot pot-${potLabel(a.potential)}">${potLabel(a.potential)}</span></div>
      <div>${link}</div></div>`;}).join('');
}

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
    potential: a.potential, note: a.note === '(không có nội dung)' ? '' : a.note,
    next: a.next === '—' ? '' : a.next, projectId: a.projectId || '' });
}
window.openActEdit = openActEdit;

const POT_MAP = { Hot:'High', Warm:'Medium', Cold:'Low' };
function potLabel(v){ return POT_MAP[v] || v || ''; }
window.potLabel = potLabel;

const ACT_TYPE_MAP = { Seminar:'Exhibition', 'Khác':'Call' };
function actType(v){ return ACT_TYPE_MAP[v] || v || 'Call'; }

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
    ? 'Khách hàng chưa có người tiếp quản.'
    : mine
    ? 'Bạn đang quản lý khách hàng này.'
    : 'Khách hàng đang được quản lý bởi <b>' + esc4(owner) + '</b>.';
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
      gate.textContent='Khách hàng này do sales khác quản lý — bạn không tạo hoạt động ở đây. Hãy chọn khách của mình hoặc khách chưa ai quản lý.'; }
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
      b.setAttribute('aria-label','Bỏ '+v);
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
    supplierOptions().concat(OTHER_NCC), '+ Thêm nhà cung cấp…', aRmNcc, editable);
}
function aAddNcc(){ var v=document.getElementById('a-ncc').value; if(!v) return;
  if(aNccs.map(function(x){return String(x).toLowerCase();}).indexOf(v.toLowerCase())<0) aNccs.push(v);
  aRenderNcc(true); }
function aRmNcc(v){ aNccs=aNccs.filter(function(x){ return x!==v; }); aRenderNcc(true); }
window.aAddNcc=aAddNcc; window.aRmNcc=aRmNcc;

function aRenderRel(editable){
  var mine=me&&(me.pic||me.name);
  var opts=(typeof ALL_PICS!=='undefined'?ALL_PICS:[]).filter(function(p){ return p!==mine; });
  aRenderChips('a-relTags','a-rel', aRelated, opts, '+ Thêm người liên quan…', aRmRel, editable);
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
    p.title || (editing ? 'Chi tiết hoạt động' : 'Kế hoạch làm việc');
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
  document.getElementById('a-proj').innerHTML='<option value="">— Chưa gắn dự án nào —</option>'
    +list.slice(0,200).map(r=>`<option value="${r.id}"${r.id===p.projectId?' selected':''}>${r.customer} · ${r.product}</option>`).join('');

  aRelated = (p.related && p.related.length) ? p.related.slice() : [];
  aRenderRel(editable);

  ['a-cust','a-type','a-date','a-pot','a-note','a-next','a-proj'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.disabled = !editable;
  });
  const saveBtn=document.getElementById('a-save');
  if(saveBtn){ saveBtn.textContent = editing ? 'Lưu thay đổi' : 'Lưu kế hoạch';
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
  if(!canDelAct(a)){ toast('Bạn không có quyền xoá hoạt động này.'); return; }
  if(!confirm('Xoá hoạt động với "'+a.customer+'" ngày '+new Date(a.date).toLocaleDateString('vi-VN')+'? Không thể hoàn tác.')) return;
  const i = ACTIVITIES.indexOf(a); if(i>=0) ACTIVITIES.splice(i,1);
  if(window.LS && LS.dropAct) LS.dropAct(id);
  closeActForm(); renderActs(); render(); cockpitRefresh();
  if(typeof welcomeRefresh==='function') welcomeRefresh();

  const onSP = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite();
  if(a.spId && onSP){

    FISG_STORE.deleteActivity(a).then(function(){
      toast('Đã xoá hoạt động.');
    }).catch(function(e){
      console.warn('[activities] xoá trên SharePoint hỏng:', e&&(e.message||e));

      if(ACTIVITIES.indexOf(a)<0) ACTIVITIES.unshift(a);
      renderActs(); render(); cockpitRefresh();
      toast('CHƯA xoá được trên SharePoint: '+(e.message||e)+'. Hoạt động vẫn còn.');
    });
  } else if(a.spId && !onSP){
    toast('Đã bỏ khỏi màn hình, nhưng CHƯA đăng nhập SharePoint nên chưa xoá thật — tải lại trang sẽ thấy lại.');
  } else {
    toast('Đã xoá hoạt động.');
  }
}
window.deleteAct = deleteAct;
function saveAct(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('a-cust')){toast('Nhập tên khách hàng.');return;}

  const nccList = aNccs.slice();
  const ncc = nccList[0] || OTHER_NCC;
  const relList = aRelated.slice();

  if(aEditId){
    const a=ACTIVITIES.find(function(x){return x.id===aEditId;});
    if(!a){ aEditId=null; closeActForm(); return; }
    if(!canEditAct(a)){ toast('Bạn không có quyền sửa hoạt động này.'); return; }
    const relAdded=relList.filter(function(x){ return (a.related||[]).indexOf(x)<0; });
    a.customer=g('a-cust'); a.ncc=ncc; a.nccs=nccList; a.related=relList;
    a.type=g('a-type'); a.date=g('a-date');
    a.note=g('a-note')||'(không có nội dung)'; a.next=g('a-next')||'—';
    a.potential=g('a-pot'); a.projectId=g('a-proj')||null;
    if(window.LS && LS.updateAct) LS.updateAct(a);
    if(relAdded.length && typeof notifyPlain==='function')
      notifyPlain('đã thêm bạn vào hoạt động với <b>'+esc4(a.customer)+'</b> ('+actType(a.type)
        +', '+new Date(a.date).toLocaleDateString('vi-VN')+') — đã vào kế hoạch tuần của bạn', relAdded);

    if(window.FISG_STORE && FISG_STORE.updateActivity && FISG_STORE.canWrite && FISG_STORE.canWrite() && a.spId){

      FISG_STORE.updateActivity(a.spId, { ActivityType:a.type, ActivityDate:a.date,
        Content:a.note, NextStep:a.next, PotentialLevel:a.potential,
        RelatedPeople:(a.related||[]).join('; '), SupplierList:(a.nccs||[]).join('; ') })
        .catch(function(e){ console.warn('[activities] chưa cập nhật được lên SharePoint', e&&(e.message||e)); });
    }
    aEditId=null;
    closeActForm(); renderActs(); render(); cockpitRefresh();
    if(typeof welcomeRefresh==='function') welcomeRefresh();
    toast('Đã lưu thay đổi hoạt động.');
    return;
  }

  const a={id:LS.nextActId(),customer:g('a-cust'),pic:me.pic||me.name,
    ncc:ncc,nccs:nccList,related:relList,product:'',type:g('a-type'),date:g('a-date'),note:g('a-note')||'(không có nội dung)',
    next:g('a-next')||'—',potential:g('a-pot'),projectId:g('a-proj')||null};
  ACTIVITIES.unshift(a);
  LS.addAct(a);

  if(relList.length && typeof notifyPlain==='function')
    notifyPlain('đã thêm bạn vào hoạt động với <b>'+esc4(a.customer)+'</b> ('+actType(a.type)
      +', '+new Date(a.date).toLocaleDateString('vi-VN')+') — đã vào kế hoạch tuần của bạn', relList);
  if(!LISTS.customers.includes(a.customer))LISTS.customers.push(a.customer);

  if(ncc && ncc!==OTHER_NCC && !LISTS.nccs.some(n=>String(n).trim().toLowerCase()===ncc.toLowerCase())){
    LISTS.nccs.push(ncc); if(window.dedupeNccs) dedupeNccs();
  }
  if(a.projectId){
    const pr=RECORDS.find(r=>r.id===a.projectId);
    if(pr){pr.comments.push({by:a.pic,at:a.date,text:'['+a.type+'] '+a.note+' → '+a.next});
      notify(pr,`đã ghi hoạt động vào <b>${pr.customer} · ${pr.product}</b>: ${a.note}`);}
  }

  const pend = window.FISG_ATTACH ? FISG_ATTACH.takePending('a-attach') : [];
  closeActForm(); renderActs(); render(); cockpitRefresh();
  if(typeof welcomeRefresh==='function') welcomeRefresh();
  toast('Đã lưu hoạt động'+(a.projectId?' và gắn vào dự án — đã thông báo người liên quan.':'. Có thể tạo dự án từ hoạt động này bất cứ lúc nào.'));

  pushAct(a, pend);
}
function pushAct(a, pend){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    if(pend && pend.length) toast('Chưa đăng nhập SharePoint nên '+pend.length+' tệp đính kèm chưa được tải lên.');
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
    toast('Đã lưu trên máy bạn nhưng CHƯA lên SharePoint — quản lý chưa thấy hoạt động này. '
      + 'Phần mềm sẽ tự thử lại ở lần đăng nhập sau.');
  });
}

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

