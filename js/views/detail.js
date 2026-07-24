/* js/views/detail.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== FORM (thêm mới) ====== */
function probOptions(sel,val){
  document.getElementById(sel).innerHTML=PROB_OPTS.map(p=>`<option value="${p}"${p===val?' selected':''}>${p}%</option>`).join('');
}
function buildForm(){
  const dl=(id,arr)=>document.getElementById(id).innerHTML=arr.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">`).join('');
  dl('dl-cust',LISTS.customers); dl('dl-prod',LISTS.products); dl('dl-app',LISTS.applications);
  document.getElementById('f-ncc').innerHTML=NCCS.map(n=>`<option${n===nccFilter?' selected':''}>${n}</option>`).join('');
  document.getElementById('f-grp').innerHTML=SEG_GROUPS.map(g=>`<option>${g}</option>`).join('');
  onFormGroup();
  document.getElementById('f-stage').innerHTML=activeStages().map(s=>`<option>${s}</option>`).join('');
  rebuildRel(); syncProb();
  document.getElementById('f-created').value='2026-07-07';
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
  document.getElementById('f-seg').innerHTML=SEG_TREE[g].map(s=>`<option>${s}</option>`).join('');
}
function onFormNcc(){
  const n=document.getElementById('f-ncc').value;
  document.getElementById('f-stage').innerHTML=(PIPELINES[n]||[]).map(s=>`<option>${s}</option>`).join('');
  syncProb();
}
function openForm(){document.getElementById('ov').classList.add('open');}
function closeForm(){document.getElementById('ov').classList.remove('open');}
function saveForm(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('f-cust')||!g('f-prod')||!g('f-app')||!g('f-closing')){toast('Vui lòng điền Khách hàng, Sản phẩm, Ứng dụng và Ngày đóng dự kiến.');return;}
  const synced=[];
  if(!LISTS.customers.includes(g('f-cust'))){LISTS.customers.push(g('f-cust'));synced.push('SF_Customers');}
  if(!LISTS.products.includes(g('f-prod'))){LISTS.products.push(g('f-prod'));synced.push('SF_Products');}
  if(!LISTS.applications.includes(g('f-app'))){LISTS.applications.push(g('f-app'));synced.push('SF_Applications');}
  const rec={id:'P-'+String(RECORDS.length+1).padStart(4,'0'),ncc:g('f-ncc'),group:g('f-grp'),
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
  buildForm(); closeForm(); render();
  notify(rec,`đã tạo dự án mới <b>${rec.customer} · ${rec.product}</b>`);
  toast('Đã lưu '+rec.id+(synced.length?' — giá trị mới được sync 2 chiều lên '+synced.join(', '):'')+'. Thông báo gửi qua Email & Teams.');
}

/* ====== DETAIL MODAL ====== */
function openDetail(id){
  curRec=RECORDS.find(r=>r.id===id); if(!curRec)return;
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
  const pr=curRec; closeDetail(); openActForm();
  document.getElementById('a-title').textContent='Ghi hoạt động cho dự án';
  document.getElementById('a-sub').innerHTML=`<span class="pill p-sbg">${pr.customer} · ${pr.product}</span>`;
  document.getElementById('a-cust').value=pr.customer;
  document.getElementById('a-ncc').value=pr.ncc;
  document.getElementById('a-proj').value=pr.id;
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
  if(!curRec.comments.length){
    box.innerHTML='<div class="d-empty">'+(curRec.desc?('Ghi chú từ Excel: “'+curRec.desc+'”'):'Chưa có trao đổi nào.')+'</div>';return;}
  box.innerHTML=curRec.comments.map(c=>{
    const u=USERS.find(x=>(x.pic||x.name)===c.by);
    return `<div class="cmt"><span class="avatar" style="width:26px;height:26px;font-size:10px;background:${u?u.color:'#8A90A4'}">${c.by.slice(0,2).toUpperCase()}</span>
      <div class="c-body"><b>${c.by}</b><small>${c.at}</small><p>${c.text}</p></div></div>`;}).join('');
  box.scrollTop=box.scrollHeight;
}
function nowStr(){return '07/07/2026 '+new Date().toTimeString().slice(0,5)}
function postComment(){
  const inp=document.getElementById('d-cmt'); const v=inp.value.trim(); if(!v)return;
  curRec.comments.push({by:me.pic||me.name,at:nowStr(),text:v});
  inp.value=''; dRenderComments();
  notify(curRec,`đã trao đổi trong <b>${curRec.customer} · ${curRec.product}</b>: “${v.slice(0,60)}${v.length>60?'…':''}”`);
}
function saveDetail(){
  const changes=[];
  const ns=document.getElementById('d-stage').value; if(ns!==curRec.stage){changes.push('giai đoạn → '+stageShort(ns));curRec.stage=ns;}
  const np=+document.getElementById('d-prob').value; if(np!==probPct(curRec)){changes.push('% dự án → '+np+'%');curRec.prob=np/100;}
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
  }
  closeDetail(); render();
}
function closeDetail(){document.getElementById('dov').classList.remove('open');}

