const CHARTS={};
if(window.Chart){Chart.defaults.font.family="'Outfit','Plus Jakarta Sans',system-ui,sans-serif";Chart.defaults.color='#697082';}

function dc(id){
  const chart=CHARTS[id];
  if(!chart)return;
  delete CHARTS[id];
  try{chart.destroy();}catch(e){console.warn('[charts] destroy '+id,e);}
}
function rc(id,chart){
  CHARTS[id]=chart;

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(CHARTS[id]!==chart)return;
    try{chart.resize();chart.update('none');}catch(e){console.warn('[charts] resize '+id,e);}
  }));
  return chart;
}
window.dc=dc;window.rc=rc;
function mkCanvas(elId, boxClass){
  const host=document.getElementById(elId);
  const oldCanvas=host&&host.querySelector('canvas');
  if(oldCanvas&&window.Chart&&Chart.getChart){
    const oldChart=Chart.getChart(oldCanvas);
    if(oldChart)try{oldChart.destroy();}catch(e){console.warn('[charts] orphan destroy '+elId,e);}
  }
  host.className=boxClass; host.innerHTML='<canvas></canvas>';
  return host.querySelector('canvas');
}
function chartFallback(elId,legId){
  dc(elId);
  document.getElementById(elId).innerHTML='<div class="ins-empty">'+T('db.needInternet')+'</div>';
  if(legId)document.getElementById(legId).innerHTML='';
}
function chartEmpty(elId,boxClass,message){
  dc(elId);
  const host=document.getElementById(elId);
  host.className=boxClass;
  host.innerHTML='<div class="ins-empty">'+message+'</div>';
}
function chartError(elId,boxClass,error){
  console.error('[charts] render '+elId,error);
  chartEmpty(elId,boxClass,T('db.chartError'));
}
function donut(elId, legId, items, cb){
  if(!window.Chart){chartFallback(elId,legId);return;}
  if(!items.some(i=>i.value>0)){
    chartEmpty(elId,'donut-box',T('db.noDataFilter'));
    document.getElementById(legId).innerHTML='';
    return;
  }
  const total=items.reduce((s,i)=>s+i.value,0)||1;
  try{
    dc(elId);
    const cv=mkCanvas(elId,'donut-box'),host=cv.parentElement;
    const center=document.createElement('div');center.className='donut-center';host.appendChild(center);
    const setCenter=i=>{const item=items[i],value=document.createElement('b'),label=document.createElement('span');value.style.color=item?item.color:'#16181D';value.textContent=item?item.value:total;label.textContent=item?item.label:T('db.oppsLower');center.replaceChildren(value,label);};
    setCenter();
    rc(elId,new Chart(cv,{type:'doughnut',
      data:{labels:items.map(i=>i.label),datasets:[{data:items.map(i=>i.value),backgroundColor:items.map(i=>i.color),borderWidth:2,borderColor:'#fff',hoverOffset:10,hoverBorderWidth:3}]},
      options:{cutout:'72%',responsive:true,maintainAspectRatio:false,animation:{animateRotate:true,animateScale:true,duration:500,easing:'easeOutQuart'},interaction:{mode:'nearest',intersect:true},
        plugins:{legend:{display:false},tooltip:{animation:{duration:180,easing:'easeOutQuart'},padding:12,cornerRadius:10,displayColors:true,callbacks:{title:c=>c[0].label,label:c=>' '+T('sf.nOpps',{n:c.parsed}),afterLabel:c=>' '+T('db.pctPipeline',{p:Math.round(100*c.parsed/total)})}}},
        onHover:(e,els)=>{const i=els.length?els[0].index:undefined;setCenter(i);cv.style.cursor=els.length?'pointer':'default';},
        onClick:(e,els)=>{if(cb&&els.length)window[cb](items[els[0].index].label);}}}));
  }catch(e){chartError(elId,'donut-box',e);}
  document.getElementById(legId).innerHTML=items.map(i=>
    `<div class="li" ${cb?`onclick="${cb}('${i.label.replace(/'/g,"\'")}')"`:''}><span class="sw" style="background:${i.color}"></span>${i.label}<b>${i.value}</b><small>${Math.round(100*i.value/total)}%</small></div>`).join('');
}
function lineChart(elId, labels, values){
  if(!window.Chart){chartFallback(elId);return;}
  if(!labels.length){chartEmpty(elId,'line-box',T('db.noNewOpps'));return;}
  try{
  dc(elId);
  const cv=mkCanvas(elId,'line-box');
  const g=cv.getContext('2d').createLinearGradient(0,0,0,230);
  g.addColorStop(0,'rgba(30,58,138,.16)');g.addColorStop(1,'rgba(30,58,138,0)');
  rc(elId,new Chart(cv,{type:'line',
    data:{labels,datasets:[{data:values,borderColor:'#1E3A8A',borderWidth:2,tension:.35,fill:true,backgroundColor:g,
      pointRadius:3,pointHoverRadius:5.5,pointBackgroundColor:'#fff',pointBorderColor:'#1E3A8A',pointBorderWidth:2,pointHitRadius:14}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},
      animation:{duration:680,easing:'easeOutQuart'},
      scales:{y:{beginAtZero:true,ticks:{precision:0,font:{size:10}},grid:{color:'rgba(20,26,46,.06)'}},
              x:{ticks:{maxTicksLimit:12,font:{size:10}},grid:{display:false}}},
      plugins:{legend:{display:false},tooltip:{enabled:false,external:c=>{
        const t=c.tooltip;
        if(!t||!t.opacity){hideLcTip();return;}
        const dp=t.dataPoints&&t.dataPoints[0];
        if(!dp){hideLcTip();return;}
        const rect=c.chart.canvas.getBoundingClientRect();
        lcTipAt(dp.dataIndex, rect.left+t.caretX, rect.top+t.caretY);
      }}}}
  }));
  cv.onmouseleave=hideLcTip;
  }catch(e){chartError(elId,'line-box',e);}
}

function statusClick(label){

  if(window.toast) toast(T('db.statusClick',{x:label}));
}
function segClick(label){showInsight('seg', label);}
function picClick(label){showInsight('pic', label);}

var donutSegDrill=null;
function segDonutClick(label){
  if(!donutSegDrill&&SEG_TREE[label]){donutSegDrill=label;showInsight('grp',label);return;}
  showInsight('seg',label);
}
function segDonutBack(){donutSegDrill=null;renderDash();}
function renderSegDonut(rows){
  const head=document.getElementById('donutDrillHead'), hint=document.getElementById('segDonutHint');
  let items;
  if(!donutSegDrill){
    head.innerHTML='<b>'+T('db.nGroups',{n:3})+'</b><span style="margin-left:auto">'+T('db.clickSliceSeg')+'</span>';
    if(hint)hint.textContent='';
    items=SEG_GROUPS.map(g=>({label:g,value:rows.filter(r=>r.group===g).length,color:GROUP_COLORS[g]}));
  }else{
    const g=donutSegDrill;
    head.innerHTML=`<button onclick="segDonutBack()">← ${T('db.nGroups',{n:3})}</button><span>/</span><b>${g}</b>
      <span style="margin-left:auto">${T('db.clickSegHistory')}</span>`;
    if(hint)hint.textContent='';
    items=SEG_TREE[g].map((sg,i)=>({label:sg,value:rows.filter(r=>r.segment===sg).length,color:SEG_COLORS[i%SEG_COLORS.length]}))
      .filter(i=>i.value>0);
    if(!items.length)items=SEG_TREE[g].map((sg,i)=>({label:sg,value:0,color:SEG_COLORS[i%SEG_COLORS.length]}));
  }
  donut('donutSeg','legSeg',items,'segDonutClick');
}
function renderDash(){
  const rows=visible();
  const prog=rows.filter(r=>r.status==='IN PROGRESS'), won=rows.filter(r=>r.status==='WON'), lost=rows.filter(r=>r.status==='LOST');
  const kg=prog.reduce((s,r)=>s+r.kgThis,0);
  const nOver=prog.filter(r=>grp(r)==='overdue').length;
  const winRate=Math.round(100*won.length/(won.length+lost.length||1));
  const kpi=(label,val,sub)=>`<div class="kpi glass"><div class="k-label">${label}</div><div class="k-value">${val}</div><div class="k-sub">${sub}</div></div>`;
  document.getElementById('kpis').innerHTML =
    kpi(T('db.kpi.total'),rows.length,T('db.kpi.totalSub'))+
    kpi(T('status.inProgress'),prog.length,T('db.kpi.openSub',{kg:fmt(kg),y:TODAY.getFullYear()}))+
    kpi(T('dash.kpi.winRate'),winRate+'%','<span class="trend-up">'+T('db.nWon',{n:won.length})+'</span>· '+T('db.nLost',{n:lost.length}))+
    kpi(T('db.kpi.overdue'),nOver,'<span class="trend-down">'+T('db.kpi.actionNeeded')+'</span>'+T('db.kpi.pastClose'));
  donut('donutStatus','legStatus',[
    {label:T('status.inProgress'),value:prog.length,color:'#C2620A'},
    {label:T('status.won'),value:won.length,color:'#15803D'},
    {label:T('status.lost'),value:lost.length,color:'#BE1240'}],'statusClick');
  renderSegGrid(rows);
  renderSegDonut(rows);
  const mAgg={};
  rows.forEach(r=>{if(r.created){const k=r.created.slice(0,7);mAgg[k]=(mAgg[k]||0)+1}});
  const keys=Object.keys(mAgg).sort();
  LC_DATA=keys.map(k=>({label:k.slice(5)+'/'+k.slice(2,4),recs:rows.filter(r=>r.created&&r.created.slice(0,7)===k)}));
  lineChart('lineChart', keys.map(k=>k.slice(5)+'/'+k.slice(2,4)), keys.map(k=>mAgg[k]));
  const picAgg={};
  rows.forEach(r=>{if(!r.pic)return;picAgg[r.pic]=picAgg[r.pic]||{n:0,won:0,closed:0};const a=picAgg[r.pic];a.n++;if(r.status==='WON'){a.won++;a.closed++}else if(r.status==='LOST')a.closed++;});
  const team=Object.entries(picAgg).sort((a,b)=>b[1].n-a[1].n).slice(0,8);
  const tmax=team.length?team[0][1].n:1;
  document.getElementById('teamBars').innerHTML=team.map(([p,a])=>{
    const wr=a.closed?Math.round(100*a.won/a.closed):0;
    return `<div class="hbar" onclick="picClick('${p}')"><div class="hb-label">${p}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*a.n/tmax)}%;background:#1E3A8A">${a.n}</div></div><div class="hb-extra">${T('db.pctWon',{p:wr})}</div></div>`;}).join('');
  const up=prog.filter(r=>r.closing&&new Date(r.closing)>=TODAY).sort((a,b)=>a.closing<b.closing?-1:1).slice(0,7);
  document.getElementById('upcoming').innerHTML= up.length? up.map(r=>{
    const days=Math.round((new Date(r.closing)-TODAY)/864e5);
    const urg=days<=30?'var(--overdue)':days<=90?'var(--prog)':'var(--sbg)';
    return `<div class="hbar" onclick="openDetail('${r.id}')"><div class="hb-label">${r.customer}</div>
      <div style="flex:1;font-size:12px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.product}</div>
      <div class="hb-extra" style="color:${urg};font-weight:700">${T('db.nDays',{n:days})}</div></div>`;}).join('') : '<div class="ins-empty">'+T('db.noUpcoming')+'</div>';
  const sb=document.getElementById('stageBars'); sb.innerHTML='';
  const colors=s=>SPINE_PALETTE[activeStages().indexOf(s)%SPINE_PALETTE.length];
  const stages=activeStages();
  const max=Math.max(...stages.map(s=>prog.filter(r=>atStage(r,s)).length),1);
  stages.forEach(s=>{
    const n=prog.filter(r=>atStage(r,s)).length;
    sb.innerHTML+=`<div class="hbar" style="cursor:default"><div class="hb-label">${s}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*n/max)}%;background:${colors(s)}">${n}</div></div></div>`;
  });
  const agg={}; prog.forEach(r=>agg[r.product]=(agg[r.product]||0)+r.kgThis);
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const pmax=top.length?top[0][1]:1;
  document.getElementById('prodBars').innerHTML = top.map(([p,v])=>
    `<div class="hbar" style="cursor:default"><div class="hb-label">${p}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*v/pmax)}%;background:#1E3A8A">${fmt(v)}</div></div></div>`).join('');
  if(INSIGHT)renderInsight();
}

function segStats(rows,pred){
  const rs=rows.filter(pred);
  const won=rs.filter(r=>r.status==='WON').length, lost=rs.filter(r=>r.status==='LOST').length;
  return {n:rs.length,prog:rs.filter(r=>r.status==='IN PROGRESS').length,
    win:(won+lost)?Math.round(100*won/(won+lost)):0,kg:rs.reduce((s,r)=>s+r.kgThis,0)};
}
function renderSegGrid(rows){
  const head=document.getElementById('drillHead'), grid=document.getElementById('segGrid');
  const hint=document.getElementById('segHint');
  if(!segDrill){
    head.innerHTML='<b>'+T('db.nGroups',{n:3})+'</b> — '+T('db.totalN',{n:rows.length});
    hint.textContent=T('db.clickGroupSeg');
    const max=Math.max(...SEG_GROUPS.map(g=>segStats(rows,r=>r.group===g).n),1);
    grid.innerHTML=SEG_GROUPS.map(g=>{
      const s=segStats(rows,r=>r.group===g), c=GROUP_COLORS[g];
      return `<button class="seg-cell" onclick="segDrill='${g}';renderDash()">
        <div class="sc-top"><span class="sc-dot" style="background:${c}"></span><span class="sc-name">${g}</span>
          <span style="margin-left:auto;font-size:10.5px;color:var(--ink-3)">${SEG_TREE[g].length} segment</span></div>
        <div class="sc-n">${s.n}</div><div class="sc-sub">${T('db.segCellSub',{a:s.prog,p:s.win,kg:fmt(s.kg)})}</div>
        <div class="sc-bar"><i style="width:${Math.round(100*s.n/max)}%;background:${c}"></i></div></button>`;}).join('');
  }else{
    const g=segDrill, segs=SEG_TREE[g];
    head.innerHTML=`<button onclick="segDrill=null;renderDash()">← ${T('db.nGroups',{n:3})}</button><span>/</span><b>${g}</b>
      <span style="margin-left:auto">${T('db.clickSegHistory')}</span>`;
    hint.textContent='';
    const max=Math.max(...segs.map(s=>segStats(rows,r=>r.segment===s).n),1);
    grid.innerHTML=segs.map((sg,i)=>{
      const s=segStats(rows,r=>r.segment===sg), c=SEG_COLORS[i%SEG_COLORS.length];
      return `<button class="seg-cell" onclick="showInsight('seg','${sg.replace(/'/g,"\\'")}')">
        <div class="sc-top"><span class="sc-dot" style="background:${c}"></span><span class="sc-name">${sg}</span></div>
        <div class="sc-n">${s.n}</div><div class="sc-sub">${T('db.segCellSub',{a:s.prog,p:s.win,kg:fmt(s.kg)})}</div>
        <div class="sc-bar"><i style="width:${Math.round(100*s.n/max)}%;background:${c}"></i></div></button>`;}).join('');
  }
}

const ST_SHORT={'WON':'WON','LOST':'LOST','IN PROGRESS':'IN PROGRESS'};
const ST_COL={'WON':'#15803D','LOST':'#BE1240','IN PROGRESS':'#C2620A'};
function lcTipAt(i,x,y){
  const d=LC_DATA[i]; if(!d)return;
  const tip=document.getElementById('lcTip');
  const items=d.recs.slice(0,6).map(r=>
    `<div class="lt-row"><span class="lt-dot" style="background:${ST_COL[r.status]||'#8A90A4'}"></span>
     <span class="lt-name">${r.customer} · ${r.product}</span>
     <b>${probPct(r)}%</b><span class="lt-st" style="color:${ST_COL[r.status]||'#8A90A4'}">${ST_SHORT[r.status]||r.status}</span></div>`).join('');
  tip.innerHTML=`<div class="lt-head">${T('db.monthNew',{m:d.label,n:d.recs.length})}</div>`+items
    +(d.recs.length>6?`<div class="lt-more">${T('db.moreOpps',{n:d.recs.length-6})}</div>`:'');
  tip.style.display='block';
  tip.style.left=Math.min(x+16, innerWidth-380)+'px';
  tip.style.top=Math.min(y+14, innerHeight-tip.offsetHeight-14)+'px';
}
function hideLcTip(){document.getElementById('lcTip').style.display='none';}

function insSuggest(){
  const q=document.getElementById('insQ').value.trim().toLowerCase();
  const box=document.getElementById('insSug');
  if(!q){box.classList.remove('open');return;}
  const sug=[];
  LISTS.customers.filter(c=>c.toLowerCase().includes(q)).slice(0,5).forEach(c=>sug.push({t:'kh',label:c}));
  LISTS.products.filter(c=>c.toLowerCase().includes(q)).slice(0,5).forEach(c=>sug.push({t:'prod',label:c}));
  SEG_GROUPS.filter(g=>g.toLowerCase().includes(q)).slice(0,3).forEach(g=>sug.push({t:'grp',label:g}));
  LISTS.segments.filter(s=>s.toLowerCase().includes(q)).slice(0,4).forEach(s=>sug.push({t:'seg',label:s}));
  ALL_PICS.filter(p=>p.toLowerCase().includes(q)).slice(0,4).forEach(p=>sug.push({t:'pic',label:p}));
  activeStages().filter(s=>s.toLowerCase().includes(q)||stageShort(s).toLowerCase().includes(q)).slice(0,4).forEach(s=>sug.push({t:'stage',label:s}));
  box.innerHTML=sug.length?sug.map(s=>{
    return `<button onclick="showInsight('${s.t}','${s.label.replace(/'/g,"\\'")}')">${INS_TAG[s.t]||''}<b>${s.label}</b></button>`;}).join('')
    :'<button disabled style="color:var(--text-3)">'+T('common.noResults')+'</button>';
  box.classList.add('open');
}
document.addEventListener('click',e=>{if(!e.target.closest('.ins-wrap'))document.getElementById('insSug').classList.remove('open');});
const INS_TAG={get kh(){return '<span class="t t-kh">'+T('db.tag.account')+'</span>';},get prod(){return '<span class="t t-prod">'+T('db.tag.product')+'</span>';},
  get grp(){return '<span class="t t-grp">'+T('db.tag.group')+'</span>';},seg:'<span class="t t-seg">SEGMENT</span>',
  stage:'<span class="t t-stage">BOP STAGE</span>',pic:'<span class="t t-pic">SALES</span>'};

const INS_MATCH={kh:(k)=>r=>custKey(r.customer)===custKey(k),prod:(k)=>r=>r.product===k,grp:(k)=>r=>r.group===k,
  seg:(k)=>r=>r.segment===k,

  stage:(k)=>r=>atStage(r,k),pic:(k)=>r=>r.pic===k};
function showInsight(type,key){
  INSIGHT={type,key};
  const input=document.getElementById('insQ');
  input.value=key;
  const wrap=document.querySelector('.ins-wrap'); if(wrap)wrap.classList.add('filled');
  document.getElementById('insSug').classList.remove('open');
  go('dash'); renderInsight();
  document.getElementById('insResult').scrollIntoView({behavior:'smooth',block:'center'});
}

function clearInsight(){
  INSIGHT=null;
  const input=document.getElementById('insQ');
  if(input)input.value='';
  const wrap=document.querySelector('.ins-wrap'); if(wrap)wrap.classList.remove('filled');
  const sug=document.getElementById('insSug'); if(sug){sug.classList.remove('open');sug.innerHTML='';}
  const box=document.getElementById('insResult');
  if(box)box.innerHTML='<div class="ins-empty">'+T('db.lookupEmpty')+'</div>';
}
window.clearInsight=clearInsight;
const D_VI=d=>d?new Date(d).toLocaleDateString(I18N.locale()):'—';
const TL_FADE_TOP=.62, TL_FADE_END=.10;

function insYear(r){return r.closing?String(new Date(r.closing).getFullYear()):null;}
function renderInsight(){
  const {type,key}=INSIGHT;
  const mk=INS_MATCH[type]||INS_MATCH.pic;
  const ps=visible().filter(mk(key));
  const box=document.getElementById('insResult');
  if(!ps.length){box.innerHTML='<div class="ins-empty">'+T('db.noOppsScope')+'</div>';return;}
  const prog=ps.filter(r=>r.status==='IN PROGRESS'),won=ps.filter(r=>r.status==='WON'),lost=ps.filter(r=>r.status==='LOST');
  const kg=ps.reduce((s,r)=>s+r.kgThis,0);
  const wr=won.length+lost.length?Math.round(100*won.length/(won.length+lost.length)):0;
  const tag=(INS_TAG[type]||'').replace('class="t','style="font-size:10.5px;padding:3px 9px" class="t');
  const buckets={};
  ps.forEach(r=>{const y=insYear(r)||'—';(buckets[y]=buckets[y]||[]).push(r);});
  const years=Object.keys(buckets).filter(y=>y!=='—').sort((a,b)=>b-a);
  if(buckets['—'])years.push('—');
  const thisYear=String(TODAY.getFullYear());

  const steps=Math.max(1,ps.length-1);
  const fade=i=>'rgba(1,66,106,'+(TL_FADE_TOP-(TL_FADE_TOP-TL_FADE_END)*(Math.min(i,steps)/steps)).toFixed(3)+')';
  let seen=0;
  const branches=years.map(y=>{
    const rs=buckets[y].sort((a,b)=>(a.closing||'')<(b.closing||'')?1:-1);
    const yw=rs.filter(r=>r.status==='WON').length, yl=rs.filter(r=>r.status==='LOST').length;
    const yp=rs.filter(r=>r.status==='IN PROGRESS').length;
    const meta=[yp?T('db.nOpen',{n:yp}):'',yw?T('db.nWon',{n:yw}):'',yl?T('db.nLost',{n:yl}):''].filter(Boolean).join(' · ');
    const start=seen, end=seen+rs.length;
    const knot='rgba(1,66,106,'+Math.max(.4,TL_FADE_TOP-(TL_FADE_TOP-TL_FADE_END)*(start/steps)+.2).toFixed(3)+')';
    seen=end;
    return `<div class="tly${y===thisYear?' now':''}${y==='—'?' na':''}"
      style="--f0:${fade(start)};--f1:${fade(end)};--fknot:${knot}">
      <div class="tly-head"><span class="tly-year">${y==='—'?T('db.noCloseDate'):y}</span>
        <span class="tly-count">${T('sf.nOpps',{n:rs.length})}</span>
        ${meta?`<span class="tly-meta">${meta}</span>`:''}</div>
      <div class="tly-body">${rs.map((r,k)=>{
        const tc=r.status==='WON'?'var(--won)':r.status==='LOST'?'var(--lost)':grp(r)==='overdue'?'var(--overdue)':'var(--accent)';
        const last=r.comments.length?r.comments[r.comments.length-1].text:(r.desc||'');
        return `<button class="tl-item" style="--tc:${tc};--tline:${fade(start+k)}" onclick="openDetail('${r.id}')">
          <div class="tl-date">${D_VI(r.created)} → ${D_VI(r.closing)}</div>
          <div class="tl-title">${r.customer} · ${r.product} <span style="color:var(--text-3);font-weight:500">(${r.application})</span></div>
          <div class="tl-meta">
            <span class="pill ${stageCls(r.stage)}" style="font-size:10.5px;padding:2px 8px">${stageShort(r.stage)}</span>
            <span class="pill ${STATUS_CLS[r.status]||''}" style="font-size:10.5px;padding:2px 8px">${STATUS_VI[r.status]}</span>
            <span class="pill" style="font-size:10.5px;padding:2px 8px;background:rgba(20,26,46,.06);color:var(--text-2)">${probPct(r)}%</span>
            <span>${fmt(r.kgThis)} KG · PIC: ${r.pic||'—'}</span>
          </div>
          ${last?`<div class="tl-note">“${last.slice(0,90)}${last.length>90?'…':''}”</div>`:''}
        </button>`;}).join('')}</div></div>`;}).join('');
  box.innerHTML=`
    <div class="ins-head">${tag}<h3>${key}</h3>
      <button class="ins-reset" onclick="clearInsight()">${T('db.clearLookup')}</button></div>
    <div class="ins-stats">
      <span class="ins-stat">${T('db.ins.total',{n:ps.length})}</span>
      <span class="ins-stat">${T('status.inProgress')}: <b>${prog.length}</b></span>
      <span class="ins-stat">${T('db.ins.wonLost',{w:won.length,l:lost.length,p:wr})}</span>
      <span class="ins-stat">${T('db.ins.potential',{kg:fmt(kg)})}</span>
    </div>
    <div class="tlt">${branches}</div>`;
}
