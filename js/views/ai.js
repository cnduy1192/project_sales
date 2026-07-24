/* js/views/ai.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== AI ASSISTANT (Gemini qua Cloudflare Worker gateway) ====== */
let AI_URL = '', AI_HIST = [], AI_BUSY = false;
try{ AI_URL = localStorage.getItem('fisg_ai_url')||''; }catch(e){}
function initAI(){
  document.getElementById('aiFab').style.display='flex';
  document.getElementById('aiUrl').value=AI_URL;
  updateAIStatus();
  if(!document.querySelectorAll('#aiMsgs .ai-msg').length)
    aiAppend('bot','Xin chào <b>'+me.name+'</b>! Tôi là FI Assistant — trợ lý AI về pipeline Sales Funnel và phụ gia thực phẩm Roquette (NUTRIOSE, CLEARAM, tinh bột biến tính…).\nHỏi tôi về tiến độ dự án, báo cáo tuần, hoặc cách tăng khả năng thắng.');
}
function updateAIStatus(){
  const on=!!AI_URL;
  document.getElementById('aiStatus').className='ai-status'+(on?'':' off');
  document.getElementById('aiStatusText').textContent=on?'Gemini qua Cloudflare — đã kết nối':'Chế độ cục bộ — chưa cấu hình gateway';
}
function toggleAI(){document.getElementById('aiPanel').classList.toggle('open');}
function toggleAISettings(){document.getElementById('aiSettings').classList.toggle('open');}
function saveAIUrl(){
  AI_URL=document.getElementById('aiUrl').value.trim().replace(/\/$/,'');
  try{localStorage.setItem('fisg_ai_url',AI_URL);}catch(e){}
  updateAIStatus(); toggleAISettings();
  toast(AI_URL?'Đã lưu gateway. Chatbot dùng Gemini thật.':'Đã xoá gateway. Chatbot chạy chế độ cục bộ.');
}
function aiEsc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function aiMd(s){
  return aiEsc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-•] (.*)$/gm,'• $1').replace(/\n/g,'<br>');
}
function aiAppend(role,html){
  const box=document.getElementById('aiMsgs');
  const d=document.createElement('div'); d.className='ai-msg'+(role==='user'?' user':'');
  d.innerHTML=(role==='user'?'':'<span class="ai-avatar" style="width:28px;height:28px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="4" y="7" width="16" height="12" rx="4"/><circle cx="9.5" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.4" fill="currentColor" stroke="none"/><path d="M12 7V4"/></svg></span>')
    +'<div class="m-body">'+html+'</div>';
  box.appendChild(d); box.scrollTop=box.scrollHeight;
  return d;
}
function aiTyping(){
  const box=document.getElementById('aiMsgs');
  const d=document.createElement('div'); d.className='ai-msg'; d.id='aiTypingEl';
  d.innerHTML='<span class="ai-avatar" style="width:28px;height:28px"></span><div class="m-body ai-typing"><span></span><span></span><span></span></div>';
  box.appendChild(d); box.scrollTop=box.scrollHeight;
}
function aiUntype(){const e=document.getElementById('aiTypingEl');if(e)e.remove();}
function aiQuick(t){document.getElementById('aiText').value=t;aiSend();}
function aiQuickFill(t){const i=document.getElementById('aiText');i.value=t;i.focus();i.setSelectionRange(t.indexOf('30%'),t.indexOf('30%')+3);}
/* -- dữ liệu realtime gửi kèm cho AI: toàn bộ pipeline -- */
function aiContext(){
  const rows=RECORDS;
  const prog=rows.filter(r=>r.status==='IN PROGRESS');
  const stats='HÔM NAY: 07/07/2026. TỔNG QUAN REALTIME: '+rows.length+' dự án ('+prog.length+' đang chạy, '
    +rows.filter(r=>r.status==='WON').length+' thắng, '+rows.filter(r=>r.status==='LOST').length+' thua); '
    +prog.filter(r=>grp(r)==='overdue').length+' quá hạn; tiềm năng đang chạy '
    +prog.reduce((s,r)=>s+r.kgThis,0).toLocaleString('vi-VN')+' KG/2026.';
  const table=rows.map(r=>[r.id,r.ncc,r.customer,r.product,r.application,r.group+'/'+r.segment,stageShort(r.stage),probPct(r)+'%',r.status,r.closing||'',r.kgThis,r.pic].join('|')).join('\n');
  return stats+'\nDỮ LIỆU (id|NCC|khách hàng|sản phẩm|ứng dụng|nhóm/segment|stage|%|status|ngày đóng|KG2026|PIC):\n'+table;
}
const AI_SYSTEM='Bạn là FI Assistant — trợ lý AI nội bộ của FI SAIGON JSC, nhà phân phối phụ gia thực phẩm tại Việt Nam cho 3 nhà cung cấp: Roquette (NUTRIOSE, CLEARAM, CLEARGUM, GLUCIDEX, NUTRALYS, POLYSORB, tinh bột biến tính), IFF (nhũ hoá, hydrocolloid, enzyme) và Kimica-Navido (alginate KIMICA ALGIN, KIMILOID). Nhiệm vụ: (1) hỗ trợ nhân viên về nghiên cứu, pha chế, ứng dụng và bán phụ gia thực phẩm; (2) phân tích pipeline Sales Funnel từ dữ liệu được cung cấp — tổng hợp theo tiến độ %, trạng thái, quá hạn; (3) đề xuất bước hành động cụ thể để tăng khả năng thắng dự án (mỗi NCC có pipeline riêng: Roquette dùng BOP Stage, IFF/Kimica dùng Sample Sent→Testing→Test Passed→Quoted/PO). Luôn trả lời bằng tiếng Việt, ngắn gọn, có số liệu cụ thể từ dữ liệu, dùng **đậm** cho điểm chính và gạch đầu dòng khi liệt kê. Người đang hỏi: ';
async function aiSend(){
  const inp=document.getElementById('aiText'); const q=inp.value.trim();
  if(!q||AI_BUSY)return;
  inp.value=''; aiAppend('user',aiEsc(q)); AI_HIST.push({role:'user',text:q});
  AI_BUSY=true; aiTyping();
  let ans;
  if(AI_URL){
    try{
      const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),45000);
      const res=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
        body:JSON.stringify({system:AI_SYSTEM+me.name+' (vai trò '+roleVI(me.role)+').\n'+aiContext(),messages:AI_HIST.slice(-10)})});
      clearTimeout(t);
      const j=await res.json();
      ans=j.text||j.error||'Gateway không trả lời được. Kiểm tra Worker và Gemini API key.';
    }catch(e){ans='Không gọi được gateway ('+e.message+'). Kiểm tra URL Worker trong Cài đặt, hoặc dùng chế độ cục bộ bằng cách xoá URL.';}
  }else{
    await new Promise(r=>setTimeout(r,700));
    ans=aiLocal(q);
  }
  aiUntype(); AI_HIST.push({role:'model',text:ans});
  aiAppend('bot',aiMd(ans)); AI_BUSY=false;
}
/* -- chế độ cục bộ: phân tích trực tiếp trên dữ liệu khi chưa có gateway -- */
function aiLocal(q){
  const ql=q.toLowerCase();
  const prog=RECORDS.filter(r=>r.status==='IN PROGRESS');
  const pm=ql.match(/(\d{1,3})\s*%/);
  if(pm){
    const pct=+pm[1];
    const hits=prog.filter(r=>probPct(r)===pct).sort((a,b)=>b.kgThis-a.kgThis);
    if(!hits.length)return 'Không có dự án đang chạy nào ở đúng tiến độ **'+pct+'%**. Các mức hiện có: '+[...new Set(prog.map(probPct))].sort((a,b)=>a-b).map(x=>x+'%').join(', ')+'.';
    const top=hits.slice(0,8).map(r=>'- **'+r.customer+'** · '+r.product+' ('+r.application+') — '+stageShort(r.stage)+', đóng '+(r.closing?new Date(r.closing).toLocaleDateString('vi-VN'):'?')+', '+r.kgThis.toLocaleString('vi-VN')+' KG, PIC '+r.pic).join('\n');
    return '**'+hits.length+' dự án đang ở tiến độ '+pct+'%** (tổng '+hits.reduce((s,r)=>s+r.kgThis,0).toLocaleString('vi-VN')+' KG/2026):\n'+top+(hits.length>8?'\n…và '+(hits.length-8)+' dự án khác.':'')+'\n\n**Gợi ý bước tiếp theo:**\n- Dự án ở TESTING: chốt lịch đánh giá mẫu với khách trong 2 tuần, chuẩn bị phương án giá sớm.\n- Dự án ở BUILDING: xác nhận spec kỹ thuật và gửi mẫu thử đợt mới.\n- Ưu tiên các dự án KG lớn và ngày đóng gần nhất; cập nhật % ngay trên funnel sau mỗi buổi làm việc với khách.';
  }
  if(ql.includes('báo cáo')||ql.includes('tuần')){
    const over=prog.filter(r=>grp(r)==='overdue');
    const soon=prog.filter(r=>r.closing&&(new Date(r.closing)-TODAY)/864e5>=0&&(new Date(r.closing)-TODAY)/864e5<=30);
    const newm=RECORDS.filter(r=>r.created&&r.created.slice(0,7)==='2026-06');
    return '**BÁO CÁO TUẦN — PIPELINE FI SAIGON (07/07/2026)**\n'
      +'- Đang chạy: **'+prog.length+'** dự án, tiềm năng **'+prog.reduce((s,r)=>s+r.kgThis,0).toLocaleString('vi-VN')+' KG/2026**\n'
      +'- Tạo mới tháng 6: **'+newm.length+'** dự án\n'
      +'- Quá hạn cần xử lý: **'+over.length+'** — '+(over.slice(0,3).map(r=>r.customer+' ('+r.pic+')').join(', ')||'không có')+'\n'
      +'- Đóng trong 30 ngày tới: **'+soon.length+'** dự án\n\n**Đề xuất ưu tiên tuần này:**\n- Review '+over.length+' dự án quá hạn: gia hạn ngày đóng hoặc đóng LOST kèm lý do.\n- Đẩy các dự án 50-75% ở SOLUTION TESTING sang OFFER: chuẩn bị báo giá.\n- Nhắc PIC cập nhật trao đổi để manager theo dõi realtime.\n\n(Chế độ cục bộ — kết nối Cloudflare Worker để nhận phân tích sâu hơn từ Gemini.)';
  }
  return 'Chế độ cục bộ đang bật (chưa cấu hình gateway Gemini). Tôi vẫn phân tích được dữ liệu pipeline:\n- Gõ "**tổng hợp dự án 30%**" — liệt kê theo tiến độ kèm gợi ý.\n- Gõ "**báo cáo tuần**" — tóm tắt pipeline cho manager.\n\nĐể hỏi đáp tự do về phụ gia thực phẩm và nhận gợi ý sâu hơn, bấm bánh răng và dán URL Cloudflare Worker (xem file FISG_AI_Worker.js).';
}

