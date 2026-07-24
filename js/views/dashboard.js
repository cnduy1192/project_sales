/* js/views/dashboard.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== CHART.JS HELPERS ====== */
const CHARTS={};
if(window.Chart){Chart.defaults.font.family='Inter';Chart.defaults.color='#697082';}
function mkCanvas(elId, boxClass){
  const host=document.getElementById(elId);
  host.className=boxClass; host.innerHTML='<canvas></canvas>';
  return host.querySelector('canvas');
}
function chartFallback(elId,legId){
  document.getElementById(elId).innerHTML='<div class="ins-empty">Cần internet để tải biểu đồ (Chart.js CDN).</div>';
  if(legId)document.getElementById(legId).innerHTML='';
}
function donut(elId, legId, items, cb){
  if(!window.Chart){chartFallback(elId,legId);return;}
  const total=items.reduce((s,i)=>s+i.value,0)||1;
  if(CHARTS[elId])CHARTS[elId].destroy();
  const cv=mkCanvas(elId,'donut-box');
  CHARTS[elId]=new Chart(cv,{type:'doughnut',
    data:{labels:items.map(i=>i.label),datasets:[{data:items.map(i=>i.value),backgroundColor:items.map(i=>i.color),borderWidth:2,borderColor:'#fff',hoverOffset:5}]},
    options:{cutout:'72%',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.label+': '+c.parsed+' ('+Math.round(100*c.parsed/total)+'%)'}}},
      onClick:(e,els)=>{if(cb&&els.length)window[cb](items[els[0].index].label);}},
    plugins:[{id:'ct',afterDraw(ch){const {ctx,chartArea:a}=ch;if(!a)return;ctx.save();ctx.textAlign='center';
      ctx.font='700 21px Inter';ctx.fillStyle='#16181D';ctx.fillText(total,(a.left+a.right)/2,(a.top+a.bottom)/2+2);
      ctx.font='500 10px Inter';ctx.fillStyle='#697082';ctx.fillText('dự án',(a.left+a.right)/2,(a.top+a.bottom)/2+16);ctx.restore();}}]
  });
  document.getElementById(legId).innerHTML=items.map(i=>
    `<div class="li" ${cb?`onclick="${cb}('${i.label.replace(/'/g,"\'")}')"`:''}><span class="sw" style="background:${i.color}"></span>${i.label}<b>${i.value}</b><small>${Math.round(100*i.value/total)}%</small></div>`).join('');
}
function lineChart(elId, labels, values){
  if(!window.Chart){chartFallback(elId);return;}
  if(CHARTS[elId])CHARTS[elId].destroy();
  const cv=mkCanvas(elId,'line-box');
  const g=cv.getContext('2d').createLinearGradient(0,0,0,230);
  g.addColorStop(0,'rgba(30,58,138,.16)');g.addColorStop(1,'rgba(30,58,138,0)');
  CHARTS[elId]=new Chart(cv,{type:'line',
    data:{labels,datasets:[{data:values,borderColor:'#1E3A8A',borderWidth:2,tension:.35,fill:true,backgroundColor:g,
      pointRadius:3,pointHoverRadius:5.5,pointBackgroundColor:'#fff',pointBorderColor:'#1E3A8A',pointBorderWidth:2,pointHitRadius:14}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},
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
  });
  cv.onmouseleave=hideLcTip;
}
/* ====== DASHBOARD ====== */
function statusClick(label){
  const map={'Đang chạy':'IN PROGRESS','Thắng':'WON','Thua':'LOST'};
  setF(map[label]||'ALL'); go('funnel');
}
function segClick(label){showInsight('seg', label);}
function picClick(label){showInsight('pic', label);}
function renderDash(){
  const rows=visible();
  const prog=rows.filter(r=>r.status==='IN PROGRESS'), won=rows.filter(r=>r.status==='WON'), lost=rows.filter(r=>r.status==='LOST');
  const kg=prog.reduce((s,r)=>s+r.kgThis,0);
  const nOver=prog.filter(r=>grp(r)==='overdue').length;
  const winRate=Math.round(100*won.length/(won.length+lost.length||1));
  const kpi=(label,val,sub)=>`<div class="kpi glass"><div class="k-label">${label}</div><div class="k-value">${val}</div><div class="k-sub">${sub}</div></div>`;
  document.getElementById('kpis').innerHTML =
    kpi('Tổng dự án',rows.length,'toàn bộ pipeline')+
    kpi('Đang chạy',prog.length,fmt(kg)+' KG tiềm năng 2026')+
    kpi('Tỷ lệ thắng',winRate+'%','<span class="trend-up">'+won.length+' thắng</span>· '+lost.length+' thua')+
    kpi('Quá hạn',nOver,'<span class="trend-down">cần xử lý</span>ngày đóng đã qua');
  donut('donutStatus','legStatus',[
    {label:'Đang chạy',value:prog.length,color:'#C2620A'},
    {label:'Thắng',value:won.length,color:'#15803D'},
    {label:'Thua',value:lost.length,color:'#BE1240'}],'statusClick');
  renderSegGrid(rows);
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
    return `<div class="hbar" onclick="picClick('${p}')"><div class="hb-label">${p}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*a.n/tmax)}%;background:#1E3A8A">${a.n}</div></div><div class="hb-extra">${wr}% thắng</div></div>`;}).join('');
  const up=prog.filter(r=>r.closing&&new Date(r.closing)>=TODAY).sort((a,b)=>a.closing<b.closing?-1:1).slice(0,7);
  document.getElementById('upcoming').innerHTML= up.length? up.map(r=>{
    const days=Math.round((new Date(r.closing)-TODAY)/864e5);
    const urg=days<=30?'var(--overdue)':days<=90?'var(--prog)':'var(--sbg)';
    return `<div class="hbar" onclick="openDetail('${r.id}')"><div class="hb-label">${r.customer}</div>
      <div style="flex:1;font-size:12px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.product}</div>
      <div class="hb-extra" style="color:${urg};font-weight:700">${days} ngày</div></div>`;}).join('') : '<div class="ins-empty">Không có dự án sắp đến hạn.</div>';
  const sb=document.getElementById('stageBars'); sb.innerHTML='';
  const colors=s=>SPINE_PALETTE[activeStages().indexOf(s)%SPINE_PALETTE.length];
  const stages=activeStages();
  const max=Math.max(...stages.map(s=>prog.filter(r=>r.stage===s).length),1);
  stages.forEach(s=>{
    const n=prog.filter(r=>r.stage===s).length;
    sb.innerHTML+=`<div class="hbar" style="cursor:default"><div class="hb-label">${s}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*n/max)}%;background:${colors(s)}">${n}</div></div></div>`;
  });
  const agg={}; prog.forEach(r=>agg[r.product]=(agg[r.product]||0)+r.kgThis);
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const pmax=top.length?top[0][1]:1;
  document.getElementById('prodBars').innerHTML = top.map(([p,v])=>
    `<div class="hbar" style="cursor:default"><div class="hb-label">${p}</div><div class="hb-track"><div class="hb-fill" style="width:${Math.max(8,100*v/pmax)}%;background:#1E3A8A">${fmt(v)}</div></div></div>`).join('');
  if(INSIGHT)renderInsight();
}

/* ====== SEGMENT DRILL-DOWN ====== */
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
    head.innerHTML='<b>3 nhóm ngành</b> — tổng '+rows.length+' dự án';
    hint.textContent='click một nhóm để xem segment bên trong';
    const max=Math.max(...SEG_GROUPS.map(g=>segStats(rows,r=>r.group===g).n),1);
    grid.innerHTML=SEG_GROUPS.map(g=>{
      const s=segStats(rows,r=>r.group===g), c=GROUP_COLORS[g];
      return `<button class="seg-cell" onclick="segDrill='${g}';renderDash()">
        <div class="sc-top"><span class="sc-dot" style="background:${c}"></span><span class="sc-name">${g}</span>
          <span style="margin-left:auto;font-size:10.5px;color:var(--ink-3)">${SEG_TREE[g].length} segment</span></div>
        <div class="sc-n">${s.n}</div><div class="sc-sub">${s.prog} đang chạy · ${s.win}% thắng · ${fmt(s.kg)} KG</div>
        <div class="sc-bar"><i style="width:${Math.round(100*s.n/max)}%;background:${c}"></i></div></button>`;}).join('');
  }else{
    const g=segDrill, segs=SEG_TREE[g];
    head.innerHTML=`<button onclick="segDrill=null;renderDash()">← 3 nhóm ngành</button><span>/</span><b>${g}</b>
      <span style="margin-left:auto">click segment để xem lịch sử dự án</span>`;
    hint.textContent='';
    const max=Math.max(...segs.map(s=>segStats(rows,r=>r.segment===s).n),1);
    grid.innerHTML=segs.map((sg,i)=>{
      const s=segStats(rows,r=>r.segment===sg), c=SEG_COLORS[i%SEG_COLORS.length];
      return `<button class="seg-cell" onclick="showInsight('seg','${sg.replace(/'/g,"\\'")}')">
        <div class="sc-top"><span class="sc-dot" style="background:${c}"></span><span class="sc-name">${sg}</span></div>
        <div class="sc-n">${s.n}</div><div class="sc-sub">${s.prog} đang chạy · ${s.win}% thắng · ${fmt(s.kg)} KG</div>
        <div class="sc-bar"><i style="width:${Math.round(100*s.n/max)}%;background:${c}"></i></div></button>`;}).join('');
  }
}


/* ====== LINE CHART TOOLTIP ====== */
const ST_SHORT={'WON':'WON','LOST':'LOST','IN PROGRESS':'IN PROGRESS'};
const ST_COL={'WON':'#15803D','LOST':'#BE1240','IN PROGRESS':'#C2620A'};
function lcTipAt(i,x,y){
  const d=LC_DATA[i]; if(!d)return;
  const tip=document.getElementById('lcTip');
  const items=d.recs.slice(0,6).map(r=>
    `<div class="lt-row"><span class="lt-dot" style="background:${ST_COL[r.status]||'#8A90A4'}"></span>
     <span class="lt-name">${r.customer} · ${r.product}</span>
     <b>${probPct(r)}%</b><span class="lt-st" style="color:${ST_COL[r.status]||'#8A90A4'}">${ST_SHORT[r.status]||r.status}</span></div>`).join('');
  tip.innerHTML=`<div class="lt-head">Tháng ${d.label} · ${d.recs.length} dự án mới</div>`+items
    +(d.recs.length>6?`<div class="lt-more">+ ${d.recs.length-6} dự án khác…</div>`:'');
  tip.style.display='block';
  tip.style.left=Math.min(x+16, innerWidth-380)+'px';
  tip.style.top=Math.min(y+14, innerHeight-tip.offsetHeight-14)+'px';
}
function hideLcTip(){document.getElementById('lcTip').style.display='none';}

/* ====== INSIGHT SEARCH (chi tiết & lịch sử) ====== */
function insSuggest(){
  const q=document.getElementById('insQ').value.trim().toLowerCase();
  const box=document.getElementById('insSug');
  if(!q){box.classList.remove('open');return;}
  const sug=[];
  LISTS.customers.filter(c=>c.toLowerCase().includes(q)).slice(0,5).forEach(c=>sug.push({t:'kh',label:c}));
  LISTS.products.filter(c=>c.toLowerCase().includes(q)).slice(0,5).forEach(c=>sug.push({t:'prod',label:c}));
  LISTS.segments.filter(s=>s.toLowerCase().includes(q)).slice(0,4).forEach(s=>sug.push({t:'seg',label:s}));
  ALL_PICS.filter(p=>p.toLowerCase().includes(q)).slice(0,4).forEach(p=>sug.push({t:'pic',label:p}));
  activeStages().filter(s=>s.toLowerCase().includes(q)||stageShort(s).toLowerCase().includes(q)).slice(0,4).forEach(s=>sug.push({t:'stage',label:s}));
  box.innerHTML=sug.length?sug.map(s=>{
    const tag=s.t==='kh'?'<span class="t t-kh">KHÁCH HÀNG</span>':s.t==='prod'?'<span class="t t-prod">SẢN PHẨM</span>':s.t==='seg'?'<span class="t t-seg">SEGMENT</span>':s.t==='stage'?'<span class="t t-stage">BOP STAGE</span>':'<span class="t t-pic">SALES</span>';
    return `<button onclick="showInsight('${s.t}','${s.label.replace(/'/g,"\\'")}')">${tag}<b>${s.label}</b></button>`;}).join('')
    :'<button disabled style="color:var(--text-3)">Không tìm thấy kết quả</button>';
  box.classList.add('open');
}
document.addEventListener('click',e=>{if(!e.target.closest('.ins-wrap'))document.getElementById('insSug').classList.remove('open');});
function showInsight(type,key){
  INSIGHT={type,key};
  document.getElementById('insQ').value=key;
  document.getElementById('insSug').classList.remove('open');
  go('dash'); renderInsight();
  document.getElementById('insResult').scrollIntoView({behavior:'smooth',block:'center'});
}
function renderInsight(){
  const {type,key}=INSIGHT;
  const match = type==='kh' ? r=>r.customer===key : type==='prod' ? r=>r.product===key : type==='seg' ? r=>r.segment===key : type==='stage' ? r=>r.stage===key : r=>r.pic===key;
  const ps=visible().filter(match);
  const box=document.getElementById('insResult');
  if(!ps.length){box.innerHTML='<div class="ins-empty">Không có dự án nào (trong phạm vi quyền xem của bạn).</div>';return;}
  const prog=ps.filter(r=>r.status==='IN PROGRESS'),won=ps.filter(r=>r.status==='WON'),lost=ps.filter(r=>r.status==='LOST');
  const kg=ps.reduce((s,r)=>s+r.kgThis,0);
  const wr=won.length+lost.length?Math.round(100*won.length/(won.length+lost.length)):0;
  const tag=type==='kh'?'<span class="t t-kh" style="font-size:10.5px;padding:3px 9px">KHÁCH HÀNG</span>':type==='prod'?'<span class="t t-prod" style="font-size:10.5px;padding:3px 9px">SẢN PHẨM</span>':type==='seg'?'<span class="t t-seg" style="font-size:10.5px;padding:3px 9px">SEGMENT</span>':type==='stage'?'<span class="t t-stage" style="font-size:10.5px;padding:3px 9px">BOP STAGE</span>':'<span class="t t-pic" style="font-size:10.5px;padding:3px 9px">SALES</span>';
  const items=[...ps].sort((a,b)=>(a.created||'')<(b.created||'')?1:-1);
  box.innerHTML=`
    <div class="ins-head">${tag}<h3>${key}</h3></div>
    <div class="ins-stats">
      <span class="ins-stat">Tổng: <b>${ps.length}</b> dự án</span>
      <span class="ins-stat">Đang chạy: <b>${prog.length}</b></span>
      <span class="ins-stat">Thắng: <b>${won.length}</b> · Thua: <b>${lost.length}</b> (<b>${wr}%</b> win)</span>
      <span class="ins-stat">Tiềm năng: <b>${fmt(kg)}</b> KG/năm</span>
    </div>
    <div class="tl">${items.map(r=>{
      const tc=r.status==='WON'?'var(--won)':r.status==='LOST'?'var(--lost)':grp(r)==='overdue'?'var(--overdue)':'#1E3A8A';
      const last=r.comments.length?r.comments[r.comments.length-1].text:(r.desc||'');
      return `<div class="tl-item" style="--tc:${tc}" onclick="openDetail('${r.id}')">
        <div class="tl-date">${r.created?new Date(r.created).toLocaleDateString('vi-VN'):'—'} → ${r.closing?new Date(r.closing).toLocaleDateString('vi-VN'):'—'}</div>
        <div class="tl-title">${r.customer} · ${r.product} <span style="color:var(--text-3);font-weight:500">(${r.application})</span></div>
        <div class="tl-meta">
          <span class="pill ${stageCls(r.stage)}" style="font-size:10.5px;padding:2px 8px">${stageShort(r.stage)}</span>
          <span class="pill ${STATUS_CLS[r.status]||''}" style="font-size:10.5px;padding:2px 8px">${STATUS_VI[r.status]}</span>
          <span class="pill" style="font-size:10.5px;padding:2px 8px;background:rgba(20,26,46,.06);color:var(--text-2)">${probPct(r)}%</span>
          <span>${fmt(r.kgThis)} KG · PIC: ${r.pic||'—'}</span>
        </div>
        ${last?`<div style="font-size:12px;color:var(--text-3);margin-top:3px">“${last.slice(0,90)}${last.length>90?'…':''}”</div>`:''}
      </div>`;}).join('')}</div>`;
}

