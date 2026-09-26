function probOptions(sel,val){
  document.getElementById(sel).innerHTML=PROB_OPTS.map(p=>`<option value="${p}"${p===val?' selected':''}>${p}%</option>`).join('');
}
/* Form "Thêm dự án mới" (buildForm/openForm/saveForm…) đã chuyển sang js/views/project-form.js */

/* Trả về Promise<spId|null> để modal tải tệp đính kèm vào đúng dự án sau khi tạo xong */
function pushProject(rec){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()){
    toast(T('dt.msg.localOnly'));
    return Promise.resolve(null);
  }
  return FISG_STORE.createProject(rec).then(spId=>{
    const oldId=rec.id;
    rec.spId=spId; rec.id=rec.code||rec.id;   // mã FI-xxxx chính thức do store cấp

    ACTIVITIES.forEach(a=>{
      if(a.projectId!==oldId) return;
      a.projectId=rec.id;
      if(a.spId) FISG_STORE.updateActivity(a.spId, {RelatedProject: spId})
        .catch(e=>console.warn('[detail] không gắn được hoạt động '+a.id+' vào dự án:', e.message||e));
    });
    if(rec.desc) FISG_STORE.addProjectUpdate(spId, rec.desc, rec.pic, rec.created);
    if(typeof invalidateCockpit==='function') invalidateCockpit();
    render(); cockpitRefresh(); if(window.renderActs) renderActs();
    toast(T('dt.msg.savedSp',{id:rec.id}));
    return spId;
  }).catch(e=>{
    console.error('[detail] không tạo được dự án trên SharePoint:', e);
    toast(T('dt.msg.createFailed',{e:e.message||e}));
    return null;
  });
}

function openDetail(id, origin){
  const rec=RECORDS.find(r=>r.id===id); if(!rec)return;

  if(typeof ownsRecord==='function' && me
     && !(typeof canViewAll==='function' && canViewAll(me)) && !ownsRecord(rec, me)
     && !(typeof teamSeesRecord==='function' && teamSeesRecord(rec, me))){
    toast(T('dt.msg.notYours'));
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
  document.getElementById('d-stage').innerHTML=pipelineOf(curRec.ncc, curRec.stage).map(s=>`<option${s===curRec.stage?' selected':''}>${s}</option>`).join('');
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
      <div><b>${new Date(a.date).toLocaleDateString(I18N.locale())}</b> · ${a.pic}<div>${a.note}</div></div></div>`).join('')
    :'<div style="color:var(--ink-3);font-size:12px">'+T('dt.noActs')+'</div>')
    +`<button class="act-link" style="margin-top:8px" onclick="attachAct()">+ ${T('dt.logForOpp')}</button>`;
}
function attachAct(){
  const pr=curRec;

  const back=NAV.top();
  document.getElementById('dov').classList.remove('open');
  NAV.popRaw();
  openActForm({
    title:T('dt.logForOppTitle'),
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
    t.innerHTML=editable?`${v} <button onclick="dRmRel('${v}')" aria-label="${T('common.removeX',{x:v})}">×</button>`:v;
    box.insertBefore(t,sel);
  });
  sel.style.display=editable?'block':'none';
  sel.innerHTML='<option value="">+ '+T('dt.addParticipant')+'</option>'+ALL_PICS.filter(p=>!dRelated.includes(p)&&p!==curRec.pic).map(p=>`<option>${p}</option>`).join('');
}
function dAddRel(){const v=document.getElementById('d-rel').value;if(!v)return;dRelated.push(v);dRenderRel(true);}
function dRmRel(v){dRelated=dRelated.filter(x=>x!==v);dRenderRel(true);}
function dRenderComments(){
  const box=document.getElementById('d-comments');
  const count=document.getElementById('d-cmt-count');
  const n=curRec.comments.length;
  if(count)count.textContent=n?T('dt.nMessages',{n:n}):'';
  if(!n){
    box.innerHTML='<div class="d-empty">'+(curRec.desc?T('dt.excelNote',{x:curRec.desc}):T('dt.noComments'))+'</div>';return;}

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
  notify(curRec,T('dt.notif.comment',{name:`${curRec.customer} · ${curRec.product}`,x:v.slice(0,60)+(v.length>60?'…':'')}));
}
function saveDetail(){
  const changes=[];
  const ns=document.getElementById('d-stage').value; if(ns!==curRec.stage){changes.push('giai đoạn → '+stageShort(ns));curRec.stage=ns;}
  const np=+document.getElementById('d-prob').value; if(np!==probPct(curRec)){changes.push('Tiến độ dự án → '+np+'%');curRec.prob=np/100;}
  const nc=document.getElementById('d-closing').value; if(nc!==curRec.closing){changes.push('ngày đóng → '+new Date(nc).toLocaleDateString(I18N.locale()));curRec.closing=nc;}
  const k1=+document.getElementById('d-kg1').value||0; if(k1!==curRec.kgThis){changes.push('KG năm nay → '+fmt(k1));curRec.kgThis=k1;}
  const k2=+document.getElementById('d-kg2').value||0; if(k2!==curRec.kgNext){changes.push('KG năm sau → '+fmt(k2));curRec.kgNext=k2;}
  const added=dRelated.filter(x=>!curRec.related.includes(x));
  if(added.length)changes.push('thêm người tham gia: '+added.join(', '));
  const removed=curRec.related.filter(x=>!dRelated.includes(x));
  if(removed.length)changes.push('bỏ người tham gia: '+removed.join(', '));
  curRec.related=[...dRelated];
  if(changes.length){
    notify(curRec,T('dt.notif.updated',{name:`${curRec.customer} · ${curRec.product}`,x:changes.join(' · ')}));
    toast(T('dt.msg.savedNotify',{to:recipientsOf(curRec).join(', ')}));
    pushProjectPatch(curRec, {
      Stage: ns, WinProbability: np, ClosingDate: nc ? nc + 'T12:00:00Z' : undefined,
      PotentialKgThisYear: k1, PotentialKgNextYear: k2,
    }, changes.join(' · '));
  }
  closeDetail(); render(); cockpitRefresh();
}

function pushProjectPatch(rec, patch, note){
  if(!window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()) return;
  if(!rec.spId){
    toast(T('dt.msg.notOnSp'));
    return;
  }
  FISG_STORE.updateProject(rec.spId, patch)
    .then(()=>{ if(note) return FISG_STORE.addProjectUpdate(rec.spId, note, (me&&(me.pic||me.name))||'', isoOf(TODAY)); })
    .catch(e=>{
      console.error('[detail] không cập nhật được dự án trên SharePoint:', e);
      toast(T('dt.msg.updateFailed',{e:e.message||e}));
    });
}

function closeDetail(){
  NAV.back(function(){ document.getElementById('dov').classList.remove('open'); });
}

function closeDetailDone(){
  document.getElementById('dov').classList.remove('open');
  var o=NAV.back(function(){});
  return o;
}

