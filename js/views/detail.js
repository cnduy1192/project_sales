/* js/views/detail.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== FORM (thêm mới) ====== */
function probOptions(sel,val){
  document.getElementById(sel).innerHTML=PROB_OPTS.map(p=>`<option value="${p}"${p===val?' selected':''}>${p}%</option>`).join('');
}
function buildForm(){
  const dl=(id,arr)=>document.getElementById(id).innerHTML=arr.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">`).join('');
  dl('dl-cust',LISTS.customers); dl('dl-prod',LISTS.products); dl('dl-app',LISTS.applications);
  /* Form ghi dữ liệu nên không có "Tất cả": lấy NCC đang xem, hoặc NCC đầu. */
  const fn=formNcc();
  document.getElementById('f-ncc').innerHTML=NCCS.map(n=>`<option${n===fn?' selected':''}>${n}</option>`).join('');
  document.getElementById('f-grp').innerHTML=SEG_GROUPS.map(g=>`<option>${g}</option>`).join('');
  onFormGroup();
  document.getElementById('f-stage').innerHTML=(PIPELINES[fn]||[]).map(s=>`<option>${s}</option>`).join('');
  rebuildRel(); syncProb();
  document.getElementById('f-created').value=isoOf(TODAY);
}
function rebuildRel(){
  const sel=document.getElementById('f-rel');
  sel.innerHTML='<option value="">+ Thêm người liên quan…</option>'+ALL_PICS.filter(p=>!related.includes(p)).map(p=>`<option>${p}</option>`).join('');
}
function addRel(){
  const v=document.getElementById('f-rel').value; if(!v)return;
  related.push(v);
  const t=document.createElement('span'); t.className='tag';
  t.innerHTML=`${v} <button onclick="rmRel('${v}',this)" aria-label="Xoá ${v}">×</button>`;
  document.getElementById('relTags').insertBefore(t,document.getElementById('f-rel'));
  rebuildRel();
}
function rmRel(v,btn){related=related.filter(x=>x!==v);btn.parentElement.remove();rebuildRel();}
function syncProb(){probOptions('f-prob',STAGE_PROB[document.getElementById('f-stage').value]||10);}
function onFormGroup(){
  const g=document.getElementById('f-grp').value;
  document.getElementById('f-seg').innerHTML=(SEG_TREE[g]||[]).map(s=>`<option>${s}</option>`).join('');
}
function onFormNcc(){
  const n=document.getElementById('f-ncc').value;
  document.getElementById('f-stage').innerHTML=(PIPELINES[n]||[]).map(s=>`<option>${s}</option>`).join('');
  syncProb();
}
function openForm(origin){
  NAV.enter(origin); NAV.renderBack('f-back');
  document.getElementById('ov').classList.add('open');
}
function closeForm(){
  NAV.back(function(){ document.getElementById('ov').classList.remove('open'); });
}
function saveForm(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('f-cust')||!g('f-prod')||!g('f-app')||!g('f-closing')){toast('Vui lòng điền Khách hàng, Sản phẩm, Ứng dụng và Ngày đóng dự kiến.');return;}
  const synced=[];
  if(!LISTS.customers.includes(g('f-cust'))){LISTS.customers.push(g('f-cust'));synced.push('SF_Customers');}
  if(!LISTS.products.includes(g('f-prod'))){LISTS.products.push(g('f-prod'));synced.push('SF_Products');}
  if(!LISTS.applications.includes(g('f-app'))){LISTS.applications.push(g('f-app'));synced.push('SF_Applications');}
  /* Id cũ sinh theo RECORDS.length nên đụng ngay id có sẵn. Tiền tố PL- đánh dấu
     "chưa có trên SharePoint"; đẩy lên xong sẽ đổi thành P-<id thật>. */
  const rec={id:'PL-'+Date.now().toString(36).toUpperCase(),ncc:g('f-ncc'),group:g('f-grp'),
    segment:g('f-seg'),application:g('f-app'),product:g('f-prod'),customer:g('f-cust'),
    created:g('f-created'),closing:g('f-closing'),stage:g('f-stage'),status:'IN PROGRESS',boptype:g('f-type'),
    prob:(+g('f-prob')||10)/100,kgThis:+g('f-kg1')||0,kgNext:+g('f-kg2')||0,desc:g('f-desc'),
    pic: me.pic||me.name, related:[...related], comments:[]};
  if(rec.desc) rec.comments.push({by:me.pic||me.name,at:nowStr(),text:rec.desc});
  RECORDS.unshift(rec);
  if(srcAct){srcAct.projectId=rec.id;
    rec.comments.unshift({by:srcAct.pic,at:srcAct.date,text:'[Nguồn gốc — '+srcAct.type+'] '+srcAct.note+' → '+srcAct.next});
    srcAct=null; renderActs();}
  ['f-cust','f-prod','f-app','f-kg1','f-kg2','f-desc'].forEach(x=>document.getElementById(x).value='');
  related=[]; document.querySelectorAll('#relTags .tag').forEach(t=>t.remove());
  buildForm(); closeForm(); render(); cockpitRefresh();
  notify(rec,`đã tạo dự án mới <b>${rec.customer} · ${rec.product}</b>`);
  toast('Đã tạo dự án cho '+rec.customer+' — đang lưu lên SharePoint…');
  pushProject(rec);
}
/* Đẩy dự án mới lên SharePoint. Trước bản này dự án tạo trong app chỉ nằm trong
   bộ nhớ trình duyệt: tải lại trang là mất, và không ai khác nhìn thấy. */
function pushProject(rec){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    toast('Chưa đăng nhập Microsoft 365 — dự án này chỉ nằm trên máy bạn và sẽ mất khi tải lại trang.');
    return;
  }
  FISG_STORE.createProject(rec).then(spId=>{
    const oldId=rec.id;
    rec.spId=spId; rec.id='P-'+spId;
    /* Hoạt động vừa gắn vào dự án phải trỏ theo id mới — cả trên màn hình lẫn
       trên SharePoint, nếu không lần tải sau nó lại rời khỏi dự án. */
    ACTIVITIES.forEach(a=>{
      if(a.projectId!==oldId) return;
      a.projectId=rec.id;
      if(a.spId) FISG_STORE.updateActivity(a.spId, {RelatedProject: spId})
        .catch(e=>console.warn('[detail] không gắn được hoạt động '+a.id+' vào dự án:', e.message||e));
    });
    if(rec.desc) FISG_STORE.addProjectUpdate(spId, rec.desc, rec.pic, rec.created);
    if(typeof invalidateCockpit==='function') invalidateCockpit();
    render(); cockpitRefresh(); if(window.renderActs) renderActs();
    toast('Đã lưu '+rec.id+' lên SharePoint.');
  }).catch(e=>{
    console.error('[detail] không tạo được dự án trên SharePoint:', e);
    toast('KHÔNG lưu được lên SharePoint: '+(e.message||e)+'. Dự án chỉ đang nằm trên màn hình, '
      +'tải lại trang là mất — hãy chụp lại thông tin trước khi rời đi.');
  });
}

/* ====== DETAIL MODAL ====== */
function openDetail(id, origin){
  const rec=RECORDS.find(r=>r.id===id); if(!rec)return;
  /* Chốt chặn cuối: dù đường dẫn nào gọi tới (bảng, popup khách hàng, link cũ),
     dự án ngoài phạm vi quyền cũng không được mở ra. */
  if(typeof ownsRecord==='function' && me && !ownsRecord(rec, me)){
    toast('Dự án này thuộc sales khác. Bạn cần được thêm vào mục Người liên quan để xem.');
    return;
  }
  curRec=rec;
  NAV.enter(origin); NAV.renderBack('d-back');
  dRelated=[...curRec.related];
  document.getElementById('d-title').textContent=curRec.customer+' — '+curRec.id;
  document.getElementById('d-pills').innerHTML=
    `<span class="pill ${stageCls(curRec.stage)}"><span class="dot"></span>${stageShort(curRec.stage)}</span>
     <span class="pill ${STATUS_CLS[curRec.status]||''}"><span class="dot"></span>${STATUS_VI[curRec.status]||curRec.status}</span>
     <span class="pill" style="background:rgba(20,26,46,.06);color:var(--text-2)">PIC: ${curRec.pic||'—'}</span>`;
  document.getElementById('d-prod').value=curRec.product;
  document.getElementById('d-app').value=curRec.application;
  document.getElementById('d-type').value=curRec.boptype||'';
  document.getElementById('d-stage').innerHTML=(PIPELINES[curRec.ncc]||[]).map(s=>`<option${s===curRec.stage?' selected':''}>${s}</option>`).join('');
  probOptions('d-prob',probPct(curRec));
  document.getElementById('d-closing').value=curRec.closing||'';
  document.getElementById('d-kg1').value=curRec.kgThis;
  document.getElementById('d-kg2').value=curRec.kgNext;
  const editable=canEdit(curRec)&&curRec.status==='IN PROGRESS';
  ['d-stage','d-prob','d-closing','d-kg1','d-kg2'].forEach(x=>document.getElementById(x).disabled=!editable);
  document.getElementById('d-save').style.display=editable?'inline-flex':'none';
  document.getElementById('d-close-proj').style.display=canClose(curRec)?'inline-flex':'none';
  dRenderRel(editable); dRenderComments(); dRenderActs();
  document.getElementById('dov').classList.add('open');
}
function dRenderActs(){
  const box=document.getElementById('d-acts');
  const as=actsOfProject(curRec.id);
  box.innerHTML=(as.length?as.map(a=>
    `<div class="linked-item"><span class="act-type">${a.type}</span>
      <div><b>${new Date(a.date).toLocaleDateString('vi-VN')}</b> · ${a.pic}<div>${a.note}</div></div></div>`).join('')
    :'<div style="color:var(--ink-3);font-size:12px">Chưa có hoạt động nào gắn vào dự án này.</div>')
    +`<button class="act-link" style="margin-top:8px" onclick="attachAct()">+ Ghi hoạt động cho dự án này</button>`;
}
function attachAct(){
  const pr=curRec;
  /* Hoạt động này mở TỪ dự án, nên đường về phải là dự án — không phải bảng chủ. */
  const back=NAV.top();
  document.getElementById('dov').classList.remove('open');
  NAV.popRaw();
  openActForm({
    title:'Ghi hoạt động cho dự án',
    sub:pr.customer+' · '+pr.product,
    customer:pr.customer, ncc:pr.ncc, projectId:pr.id
  },{ label:pr.customer+' · '+pr.product,
      restore:function(){ openDetail(pr.id, back); } });
}
function dSyncProb(){probOptions('d-prob',STAGE_PROB[document.getElementById('d-stage').value]||10);}
function dRenderRel(editable){
  const box=document.getElementById('d-relTags');
  box.querySelectorAll('.tag').forEach(t=>t.remove());
  const sel=document.getElementById('d-rel');
  dRelated.forEach(v=>{
    const t=document.createElement('span'); t.className='tag';
    t.innerHTML=editable?`${v} <button onclick="dRmRel('${v}')" aria-label="Xoá ${v}">×</button>`:v;
    box.insertBefore(t,sel);
  });
  sel.style.display=editable?'block':'none';
  sel.innerHTML='<option value="">+ Thêm người tham gia…</option>'+ALL_PICS.filter(p=>!dRelated.includes(p)&&p!==curRec.pic).map(p=>`<option>${p}</option>`).join('');
}
function dAddRel(){const v=document.getElementById('d-rel').value;if(!v)return;dRelated.push(v);dRenderRel(true);}
function dRmRel(v){dRelated=dRelated.filter(x=>x!==v);dRenderRel(true);}
function dRenderComments(){
  const box=document.getElementById('d-comments');
  const count=document.getElementById('d-cmt-count');
  const n=curRec.comments.length;
  if(count)count.textContent=n?n+' tin nhắn':'';
  if(!n){
    box.innerHTML='<div class="d-empty">'+(curRec.desc?('Ghi chú từ Excel: “'+curRec.desc+'”'):'Chưa có trao đổi nào.')+'</div>';return;}
  /* Your own messages sit on the right; everyone else on the left. */
  const mine=me&&(me.pic||me.name);
  box.innerHTML=curRec.comments.map(c=>{
    const u=USERS.find(x=>(x.pic||x.name)===c.by);
    const own=c.by===mine;
    return `<div class="cmt${own?' me':''}">
      <span class="avatar" style="width:26px;height:26px;font-size:10px;background:${u?u.color:'#8A90A4'}">${c.by.slice(0,2).toUpperCase()}</span>
      <div class="c-body"><b>${c.by}</b><small>${c.at}</small><p>${c.text}</p></div></div>`;}).join('');
  box.scrollTop=box.scrollHeight;
}
function nowStr(){
  var d=new Date();
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+
         d.getFullYear()+' '+d.toTimeString().slice(0,5);
}
function postComment(){
  const inp=document.getElementById('d-cmt'); const v=inp.value.trim(); if(!v)return;
  curRec.comments.push({by:me.pic||me.name,at:nowStr(),text:v});
  inp.value=''; dRenderComments();
  if(window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite() && curRec.spId)
    FISG_STORE.addProjectUpdate(curRec.spId, v, (me&&(me.pic||me.name))||'', isoOf(TODAY));
  notify(curRec,`đã trao đổi trong <b>${curRec.customer} · ${curRec.product}</b>: “${v.slice(0,60)}${v.length>60?'…':''}”`);
}
function saveDetail(){
  const changes=[];
  const ns=document.getElementById('d-stage').value; if(ns!==curRec.stage){changes.push('giai đoạn → '+stageShort(ns));curRec.stage=ns;}
  const np=+document.getElementById('d-prob').value; if(np!==probPct(curRec)){changes.push('Tiến độ dự án → '+np+'%');curRec.prob=np/100;}
  const nc=document.getElementById('d-closing').value; if(nc!==curRec.closing){changes.push('ngày đóng → '+new Date(nc).toLocaleDateString('vi-VN'));curRec.closing=nc;}
  const k1=+document.getElementById('d-kg1').value||0; if(k1!==curRec.kgThis){changes.push('KG năm nay → '+fmt(k1));curRec.kgThis=k1;}
  const k2=+document.getElementById('d-kg2').value||0; if(k2!==curRec.kgNext){changes.push('KG năm sau → '+fmt(k2));curRec.kgNext=k2;}
  const added=dRelated.filter(x=>!curRec.related.includes(x));
  if(added.length)changes.push('thêm người tham gia: '+added.join(', '));
  const removed=curRec.related.filter(x=>!dRelated.includes(x));
  if(removed.length)changes.push('bỏ người tham gia: '+removed.join(', '));
  curRec.related=[...dRelated];
  if(changes.length){
    notify(curRec,`đã cập nhật <b>${curRec.customer} · ${curRec.product}</b>: ${changes.join(' · ')}`);
    toast('Đã lưu. Thông báo gửi qua Email & Microsoft Teams đến: '+recipientsOf(curRec).join(', ')+'.');
    pushProjectPatch(curRec, {
      Stage: ns, WinProbability: np, ClosingDate: nc ? nc + 'T12:00:00Z' : undefined,
      PotentialKgThisYear: k1, PotentialKgNextYear: k2,
    }, changes.join(' · '));
  }
  closeDetail(); render(); cockpitRefresh();
}
/* Ghi thay đổi lên SharePoint + một dòng nhật ký. Lỗi thì nói thẳng, vì bản trên
   màn hình đã đổi rồi mà bản thật thì chưa. */
function pushProjectPatch(rec, patch, note){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()) return;
  if(!rec.spId){
    toast('Dự án này chưa có trên SharePoint nên thay đổi chưa được lưu lại.');
    return;
  }
  FISG_STORE.updateProject(rec.spId, patch)
    .then(()=>{ if(note) return FISG_STORE.addProjectUpdate(rec.spId, note, (me&&(me.pic||me.name))||'', isoOf(TODAY)); })
    .catch(e=>{
      console.error('[detail] không cập nhật được dự án trên SharePoint:', e);
      toast('Thay đổi CHƯA lên được SharePoint: '+(e.message||e));
    });
}

function closeDetail(){
  NAV.back(function(){ document.getElementById('dov').classList.remove('open'); });
}
/* Lưu xong là hành động dứt điểm: bỏ lớp trung gian, về thẳng nơi xuất phát. */
function closeDetailDone(){
  document.getElementById('dov').classList.remove('open');
  var o=NAV.back(function(){});
  return o;
}

