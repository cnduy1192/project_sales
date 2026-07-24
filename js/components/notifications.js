/* js/components/notifications.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== NOTIFICATIONS ====== */
function recipientsOf(r){
  const set=new Set([r.pic,...(r.related||[])].filter(Boolean));
  set.delete(me.pic||me.name);
  return [...set].length?[...set]:['(chưa có người liên quan)'];
}
function notify(rec,action){
  NOTIFS.unshift({who:me.pic||me.name,action,to:recipientsOf(rec),at:nowStr()});
  renderNotifs();
}
function renderNotifs(){
  const dot=document.getElementById('bellDot');
  dot.style.display=NOTIFS.length?'flex':'none'; dot.textContent=NOTIFS.length;
  document.getElementById('notifList').innerHTML = NOTIFS.length ? NOTIFS.map(n=>{
    const u=USERS.find(x=>(x.pic||x.name)===n.who);
    return `<div class="notif"><span class="avatar" style="width:28px;height:28px;font-size:10px;background:${u?u.color:'#8A90A4'}">${n.who.slice(0,2).toUpperCase()}</span>
    <div><b>${n.who}</b> ${n.action}<small>Gửi đến: ${n.to.join(', ')} · ${n.at}</small>
    <span class="n-via"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Email + Microsoft Teams</span></div></div>`;
  }).join('') : '<div class="notif">Chưa có thông báo nào.</div>';
}
function toggleNotif(e){e.stopPropagation();document.getElementById('notifPanel').classList.toggle('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.notif-panel')&&!e.target.closest('.icon-btn'))document.getElementById('notifPanel').classList.remove('open');});

