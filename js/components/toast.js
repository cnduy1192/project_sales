/* js/components/toast.js — tách từ index.html gốc. Nạp dạng classic script (scope toàn cục). */
/* ====== TOAST ====== */
let toastT;
function toast(m){const t=document.getElementById('toastEl');t.textContent=m;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',4600);}
document.getElementById('ov').addEventListener('click',e=>{if(e.target.id==='ov')closeForm();});
document.getElementById('dov').addEventListener('click',e=>{if(e.target.id==='dov')closeDetail();});
document.getElementById('cov').addEventListener('click',e=>{if(e.target.id==='cov')closeCloseModal();});
