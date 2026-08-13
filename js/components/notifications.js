function recipientsOf(r){
  const set=new Set([r.pic,...(r.related||[])].filter(Boolean));
  set.delete(me.pic||me.name);
  return [...set].length?[...set]:['(chưa có người liên quan)'];
}
function notify(rec,action){
  NOTIFS.unshift({who:me.pic||me.name,action,to:recipientsOf(rec),at:nowStr()});
  renderNotifs();
}

function notifyPlain(action,to){
  NOTIFS.unshift({who:me.pic||me.name,action,to:(to&&to.length?to:['(chưa có người nhận)']),at:nowStr()});
  renderNotifs();
}
function managerNames(){

  return USERS.filter(u=>cap(u.role).scope==='all').map(u=>u.pic||u.name);
}

function reportRecipients(u){
  u = u || (typeof me!=='undefined'?me:null);
  if(u && u.reportsTo) return [u.reportsTo];
  return managerNames();
}
window.reportRecipients = reportRecipients;

var RP_NOTIFS = [];

function _seenKey(){ return 'fisg_notif_seen_' + ((me&&me.email)||'anon'); }
function _seenSet(){
  try{ return new Set(JSON.parse(localStorage.getItem(_seenKey())||'[]')); }
  catch(e){ return new Set(); }
}
function _saveSeen(set){
  try{ localStorage.setItem(_seenKey(), JSON.stringify([...set].slice(-500))); }catch(e){}
}
function _cmtKey(code,c){ return 'C:'+code+':'+picKey(c.by)+':'+(c.at||'')+':'+(c.text||'').slice(0,24); }

function _notifCandidates(){
  if(typeof REPORTS==='undefined' || !me) return [];
  const lead = cap(me.role).scope==='all';
  const meKey = picKey(me.pic||me.name);
  const out = [];
  REPORTS.forEach(r=>{

    const addressed = (r.to||[]).filter(Boolean);
    const forLead = lead && picKey(r.pic)!==meKey
      && (addressed.length===0 || addressed.some(t=>picKey(t)===meKey));
    if(forLead)
      out.push({ key:'R:'+r.id, who:r.pic, action:'đã gửi <b>báo cáo tuần '+r.weekLabel+'</b>',
                 at:r.createdAt, report:r.id });
    (r.comments||[]).forEach(c=>{
      if(picKey(c.by)===meKey) return;
      const cLead = c.role && cap(c.role).scope==='all';

      const forMe = lead ? !cLead : (picKey(r.pic)===meKey);
      if(forMe)
        out.push({ key:_cmtKey(r.id,c), who:c.by,
                   action:'đã phản hồi <b>báo cáo tuần '+r.weekLabel+'</b>: "'
                        + (c.text||'').slice(0,50) + ((c.text||'').length>50?'…':'') + '"',
                   at:c.at, report:r.id });
    });
  });
  out.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  return out;
}

function refreshNotifs(){
  const seen = _seenSet();
  RP_NOTIFS = _notifCandidates().filter(n=>!seen.has(n.key));
  renderNotifs();
}
window.refreshNotifs = refreshNotifs;

function markReportsSeen(){
  const seen = _seenSet();
  _notifCandidates().forEach(n=>seen.add(n.key));
  _saveSeen(seen);
  RP_NOTIFS = [];
  renderNotifs();
}
window.markReportsSeen = markReportsSeen;

function openReportNotif(code){
  document.getElementById('notifPanel').classList.remove('open');
  if(window.go){ go('reports'); }
  if(window.rpSelect) try{ rpSelect(code); }catch(e){}
}
window.openReportNotif = openReportNotif;

function renderNotifs(){
  const dot=document.getElementById('bellDot');
  const rp = (typeof RP_NOTIFS!=='undefined') ? RP_NOTIFS : [];
  const total = rp.length + NOTIFS.length;
  if(dot){ dot.style.display=total?'flex':'none'; dot.textContent=total; }
  const box=document.getElementById('notifList'); if(!box) return;

  const rpHtml = rp.map(n=>{
    const u=USERS.find(x=>(x.pic||x.name)===n.who);
    const who = (window.picLabel?picLabel(n.who):n.who)||'—';
    return `<button class="notif notif-btn" onclick="openReportNotif('${(n.report||'').replace(/'/g,"\\'")}')">
      <span class="avatar" style="width:28px;height:28px;font-size:10px;background:${u?u.color:'#8A90A4'}">${String(who).slice(0,2).toUpperCase()}</span>
      <div><b>${who}</b> ${n.action}<small>${n.at?new Date(n.at).toLocaleDateString('vi-VN'):''}</small></div></button>`;
  }).join('');

  const memHtml = NOTIFS.map(n=>{
    const u=USERS.find(x=>(x.pic||x.name)===n.who);
    return `<div class="notif"><span class="avatar" style="width:28px;height:28px;font-size:10px;background:${u?u.color:'#8A90A4'}">${n.who.slice(0,2).toUpperCase()}</span>
    <div><b>${n.who}</b> ${n.action}<small>Gửi đến: ${n.to.join(', ')} · ${n.at}</small></div></div>`;
  }).join('');

  box.innerHTML = (rpHtml + memHtml) || '<div class="notif">Chưa có thông báo nào.</div>';
}
function toggleNotif(e){e.stopPropagation();document.getElementById('notifPanel').classList.toggle('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.notif-panel')&&!e.target.closest('.icon-btn'))document.getElementById('notifPanel').classList.remove('open');});

