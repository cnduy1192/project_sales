/* tests/smoke.js — kiểm thử khói, chạy toàn bộ app trong jsdom.
 *
 *   cd tests && npm install jsdom && node smoke.js
 *
 * Nạp index.html thật với mọi script, giả lập Graph/localStorage, rồi đi qua các
 * đường dễ vỡ nhất: phân quyền, đổi tên PIC, danh mục cấu hình, các màn hình.
 * Không cần mạng, không cần SharePoint. */
const {JSDOM}=require('jsdom'), fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname, '..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8')
  .replace(/<script src="https:\/\/[^"]*"[^>]*><\/script>/g,'')
  .replace(/<link rel="stylesheet"[^>]*>/g,'').replace(/<link href="https:\/\/fonts[^>]*>/g,'');
const errs=[];
Promise.resolve(new JSDOM(HTML,{url:'file://'+ROOT+'/index.html',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
  beforeParse(w){
    w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    function C(){return{destroy(){},resize(){},update(){},data:{},options:{}}}
    C.register=()=>{};C.defaults={font:{},plugins:{legend:{}},color:''};C.getChart=()=>null;w.Chart=C;
    w.confirm=()=>true; w.fetch=()=>Promise.reject(new Error('offline'));
    const st={};Object.defineProperty(w,'localStorage',{configurable:true,value:{
      getItem:k=>st[k]===undefined?null:st[k],setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]},
      key:i=>Object.keys(st)[i],get length(){return Object.keys(st).length}}});
    w.onerror=m=>errs.push('onerror: '+m);
    w.console.error=(...a)=>{errs.push('console.error: '+a.join(' '))};
  }})).then(d0=>new Promise(r=>setTimeout(()=>r(d0),500))).then(async dom=>{
  const w=dom.window,d=w.document,E=c=>w.eval(c);
  let pass=0;
  function step(n,fn){try{fn();pass++;console.log('OK   '+n)}catch(e){errs.push(n+': '+e.message);console.log('FAIL '+n+' — '+e.message)}}
  const T=todayIso=>E('todayISO()');

  // Ngọc xuất hiện dưới HAI tên tắt trong dữ liệu
  E(`RECORDS.push(
     {id:'P-1',ncc:'Roquette',customer:'A',product:'X',application:'u',segment:'NOODLES',group:'SAVOURY',stage:'SOLUTION TESTING',status:'IN PROGRESS',prob:.5,kgThis:10,kgNext:0,pic:'Ngoc',rnd:'',related:[],created:'2026-07-01',closing:'2026-09-01',desc:'',comments:[],updates:[]},
     {id:'P-2',ncc:'Roquette',customer:'B',product:'Y',application:'v',segment:'BAKERY',group:'BAKERY',stage:'SOLUTION TESTING',status:'IN PROGRESS',prob:.4,kgThis:20,kgNext:0,pic:'Bich Ngoc',rnd:'',related:[],created:'2026-07-02',closing:'2026-09-02',desc:'',comments:[],updates:[]},
     {id:'P-3',ncc:'Roquette',customer:'C',product:'Z',application:'w',segment:'SNACK',group:'BAKERY',stage:'SOLUTION TESTING',status:'IN PROGRESS',prob:.4,kgThis:30,kgNext:0,pic:'Tam',rnd:'',related:[],created:'2026-07-03',closing:'2026-09-03',desc:'',comments:[],updates:[]});
   ACTIVITIES.push(
     {id:'A-1',customer:'A',pic:'Ngoc',ncc:'Roquette',product:'',type:'Call',date:'2026-07-20',note:'gọi cũ',next:'—',potential:'Hot',projectId:'P-1'},
     {id:'A-2',customer:'B',pic:'Bich Ngoc',ncc:'Roquette',product:'',type:'Visit',date:'2026-07-21',note:'thăm',next:'—',potential:'Warm',projectId:'P-2'});
   USERS.push(
     {email:'ngoc@f.vn', picRaw:'Ngoc, Bich Ngoc', fullName:'Phạm Bích Ngọc', name:'Phạm Bích Ngọc', pic:'Phạm Bích Ngọc', role:'sales', color:'#0D9488'},
     {email:'duy@f.vn',  picRaw:null, fullName:'Duy Che Ngoc', name:'Duy Che Ngoc', pic:'Duy Che Ngoc', role:'superadmin', color:'#1E3A8A'});`);

  const alias = E('FISG_STORE.applyPicAliases()');
  step('hai tên tắt cùng đổi thành một tên đầy đủ',()=>{
    if(E("RECORDS[0].pic")!=='Phạm Bích Ngọc')throw new Error('Ngoc: '+E('RECORDS[0].pic'));
    if(E("RECORDS[1].pic")!=='Phạm Bích Ngọc')throw new Error('Bich Ngoc: '+E('RECORDS[1].pic'));
    if(E("ACTIVITIES[0].pic")!=='Phạm Bích Ngọc'||E("ACTIVITIES[1].pic")!=='Phạm Bích Ngọc')
      throw new Error('hoạt động chưa đổi');
    if(E("RECORDS[2].pic")!=='Tam')throw new Error('đổi nhầm người khác');
    console.log('   bảng ánh xạ:',JSON.stringify(alias.map));
  });
  await E('FISG_STORE.buildLists(RECORDS,ACTIVITIES)');
  step('funnel gộp hai tên về một người',()=>{
    if(E('LISTS.pics.indexOf("Ngoc")')>=0||E('LISTS.pics.indexOf("Bich Ngoc")')>=0)
      throw new Error('danh sách sales còn tên tắt: '+E('JSON.stringify(LISTS.pics)'));
    console.log('   danh sách sales:',E('JSON.stringify(LISTS.pics)'));
  });
  const ix = m => E(`USERS.findIndex(function(u){return u.email==='${m}'})`);
  step('Ngọc thấy CẢ HAI dự án dù dữ liệu ghi hai tên khác nhau',()=>{
    E(`loginAs(${ix('ngoc@f.vn')})`);
    const v=E('visible().map(function(r){return r.id}).sort().join(",")');
    if(v!=='P-1,P-2')throw new Error('thấy: '+v);
    if(E('visibleActs().length')!==2)throw new Error('hoạt động: '+E('visibleActs().length'));
  });
  step('Kế hoạch tuần cũng gộp hai tên',()=>{
    const mw=E('JSON.stringify(buildMyWeek(me.pic).stats)');
    const sc=E('myScope(me.pic).records.map(function(r){return r.id}).sort().join(",")');
    if(sc!=='P-1,P-2')throw new Error('myScope: '+sc);
  });

  step('Super Admin thấy MỌI menu',()=>{
    E('closeWelcome()');
    E(`loginAs(${ix('duy@f.vn')})`);
    const vis=id=>d.getElementById(id).style.display!=='none';
    if(!vis('navCockpit'))throw new Error('thiếu Cockpit');
    if(!vis('navWelcome'))throw new Error('thiếu Kế hoạch tuần');
    if(!vis('navUsers'))throw new Error('thiếu Người dùng & phân quyền');
    if(!vis('navReports'))throw new Error('thiếu Báo cáo');
    if(d.getElementById('wcModal').classList.contains('open'))throw new Error('popup không được tự bật cho admin');
    console.log('   menu:',[...d.querySelectorAll('.nav-item')].filter(b=>b.style.display!=='none').map(b=>b.querySelector('.nav-t').textContent).join(' · '));
  });
  step('Super Admin mở được Kế hoạch tuần bằng tay',()=>{
    E('openWelcome()');
    if(!d.getElementById('wcModal').classList.contains('open'))throw new Error('không mở được');
    E('closeWelcome()');
  });
  step('nhãn menu đã đổi thành Kế hoạch tuần',()=>{
    const t=d.getElementById('navWelcome').textContent;
    if(!/Kế hoạch tuần/.test(t))throw new Error(t);
    if(/Tổng quan tuần/.test(d.querySelector('.side-nav').textContent))throw new Error('còn nhãn cũ');
  });

  // ---- giữa tuần: khối cập nhật hoạt động ----
  E(`loginAs(${ix('ngoc@f.vn')}); closeWelcome(); openWelcome(); wcSetMode('mid')`);
  step('giữa tuần luôn hiện khối Cập nhật hoạt động, kể cả tuần trống',()=>{
    const b=d.getElementById('wcBody').textContent;
    if(!/Cập nhật hoạt động/.test(b))throw new Error('thiếu khối');
    ['Đang làm hôm nay','Đã lên kế hoạch','Đã làm trong tuần'].forEach(g=>{
      if(!b.includes(g))throw new Error('thiếu nhóm: '+g);
    });
    if(d.querySelectorAll('#wcBody .wc-grp').length!==4)
      throw new Error('số nhóm: '+d.querySelectorAll('#wcBody .wc-grp').length);
    if(!d.querySelectorAll('#wcBody .wc-grp-e').length)throw new Error('thiếu trạng thái rỗng');
    console.log('   nhóm rỗng:',d.querySelectorAll('#wcBody .wc-grp-e').length+'/4 · gợi ý kèm theo:',
                /Việc đáng làm nhất/.test(b));
  });
  step('có việc thì hiện đúng nhóm',()=>{
    const t=E('todayISO()');
    const w=E('JSON.stringify(thisWeek())');
    const wk=JSON.parse(w);
    E(`ACTIVITIES.push(
       {id:'AL-1',customer:'A',pic:'Phạm Bích Ngọc',ncc:'Roquette',product:'',type:'Call',date:'${t}',note:'việc hôm nay',next:'—',potential:'Hot',projectId:'P-1'},
       {id:'AL-2',customer:'B',pic:'Phạm Bích Ngọc',ncc:'Roquette',product:'',type:'Visit',date:'${wk.end}',note:'việc cuối tuần',next:'—',potential:'Warm',projectId:'P-2'});
       renderWelcome();`);
    const b=d.getElementById('wcBody').textContent;
    if(!/việc hôm nay/.test(b))throw new Error('thiếu việc hôm nay');
    if(!/việc cuối tuần/.test(b))throw new Error('thiếu việc đã lên kế hoạch');
    const empties=d.querySelectorAll('#wcBody .wc-grp-e').length;
    if(empties!==2)throw new Error('số nhóm rỗng phải còn 2, đang '+empties);
    if(/Việc đáng làm nhất/.test(b))throw new Error('tuần đã có việc thì không kèm gợi ý nữa');
  });
  step('đánh dấu Đã làm chuyển việc sang nhóm Đã làm',()=>{
    E("LS.markDone('AL-1', todayISO()); renderWelcome();");
    const grps=[...d.querySelectorAll('#wcBody .wc-grp')];
    const doing=grps.find(g=>/Đang làm hôm nay/.test(g.textContent));
    const done=grps.find(g=>/Đã làm trong tuần/.test(g.textContent));
    if(/việc hôm nay/.test(doing.textContent))throw new Error('vẫn nằm ở Đang làm');
    if(!/việc hôm nay/.test(done.textContent))throw new Error('chưa sang Đã làm');
  });

  // ---- phạm vi của Sales: không nhìn sang việc của người khác ----
  step('Sales không thấy dự án của sales khác, trừ khi là người liên quan',()=>{
    E(`RECORDS.push({id:'P-4',ncc:'Roquette',customer:'D',product:'W',application:'u',segment:'MEAT',group:'SAVOURY',stage:'SOLUTION TESTING',status:'IN PROGRESS',prob:.3,kgThis:5,kgNext:0,pic:'Tam',rnd:'',related:['Phạm Bích Ngọc'],created:'2026-07-04',closing:'2026-09-04',desc:'',comments:[],updates:[]});
       loginAs(${ix('ngoc@f.vn')}); closeWelcome();`);
    const v=E('visible().map(function(r){return r.id}).sort().join(",")');
    if(/P-3/.test(v))throw new Error('nhìn thấy dự án của Tâm: '+v);
    if(!/P-4/.test(v))throw new Error('không thấy dự án mình là người liên quan: '+v);
  });
  step('Sales không thấy hoạt động của sales khác',()=>{
    E(`ACTIVITIES.push(
       {id:'A-9',customer:'C',pic:'Tam',ncc:'Roquette',product:'',type:'Call',date:'2026-07-22',note:'việc của Tâm',next:'—',potential:'Hot',projectId:'P-3'},
       {id:'A-10',customer:'D',pic:'Tam',ncc:'Roquette',product:'',type:'Call',date:'2026-07-23',note:'việc trên dự án chung',next:'—',potential:'Hot',projectId:'P-4'});`);
    const ids=E('visibleActs().map(function(a){return a.id}).join(",")');
    if(/A-9/.test(ids))throw new Error('đọc được hoạt động của Tâm: '+ids);
    if(!/A-10/.test(ids))throw new Error('mất hoạt động trên dự án mình liên quan: '+ids);
    /* mở dự án của người khác bằng tay cũng không lộ ghi chú */
    if(E("actsOfProject('P-3').length"))throw new Error('actsOfProject để lọt dữ liệu');
    if(E("actsOfProject('P-4').length")!==1)throw new Error('actsOfProject chặn nhầm dự án chung');
  });
  step('Manager vẫn thấy toàn bộ',()=>{
    E(`loginAs(${ix('duy@f.vn')})`);
    const v=E('visible().map(function(r){return r.id}).sort().join(",")');
    if(!/P-3/.test(v))throw new Error('admin bị chặn: '+v);
  });

  // ---- NCC "Khác" ----
  step('form hoạt động có tuỳ chọn Khác và không tạo tab NCC mới',()=>{
    E(`loginAs(${ix('ngoc@f.vn')}); closeWelcome(); go('acts'); openActForm()`);
    const opts=[...d.getElementById('a-ncc').options].map(o=>o.textContent);
    if(opts.indexOf('Khác')<0)throw new Error('thiếu Khác: '+opts.join(','));
    if(E('NCCS.indexOf("Khác")')>=0)throw new Error('Khác lọt vào danh sách NCC');
    if([...d.querySelectorAll('.ncc-tab')].some(t=>t.textContent==='Khác'))throw new Error('Khác tạo tab riêng');
    E('closeActForm()');
  });
  step('hoạt động NCC Khác hiện ở mọi tab, không biến mất sau khi tạo',()=>{
    E(`ACTIVITIES.unshift({id:'AL-9',customer:'A',pic:'Phạm Bích Ngọc',ncc:'Khác',product:'',type:'Seminar',date:'${E('todayISO()')}',note:'hội thảo chung',next:'—',potential:'Warm',projectId:null});`);
    ['Roquette','IFF','Kimica-Navido'].forEach(n=>{
      E(`nccFilter='${n}'`);
      if(!E('visibleActs().some(function(a){return a.id==="AL-9"})'))throw new Error('mất ở tab '+n);
    });
    E("nccFilter='Roquette'");
  });

  // ---- cột Hoạt động gần nhất ----
  step('Hoạt động gần nhất phân biệt chưa có / đã đặt lịch / im lặng lâu',()=>{
    const q=s=>JSON.parse(E('JSON.stringify(ckQuiet('+(s?"'"+s+"'":'null')+'))'));
    const none=q(null);
    if(none.pct!==0||!/Chưa có/.test(none.text))throw new Error('chưa có: '+JSON.stringify(none));
    const fut=q('2026-12-31');
    if(fut.pct!==0||!/lịch/.test(fut.text))throw new Error('tương lai vẫn vẽ vạch: '+JSON.stringify(fut));
    if(/-/.test(fut.text))throw new Error('còn hiện số ngày âm: '+fut.text);
    const old=q('2026-01-01'), mid=q(E('isoOf(new Date(TODAY.getTime()-5*864e5))'));
    if(old.pct<=mid.pct)throw new Error('vạch không dài theo số ngày im lặng');
    if(old.color===mid.color)throw new Error('màu không đổi theo mức im lặng');
    if(!none.title||!fut.title)throw new Error('thiếu chú giải khi rê chuột');
  });
  step('nhãn đã đổi tên đúng',()=>{
    const nav=d.querySelector('.side-nav').textContent;
    if(/Tổng quan điều hành/.test(nav))throw new Error('còn "Tổng quan điều hành"');
    if(!/Tổng quan/.test(nav))throw new Error('mất mục Tổng quan');
    const html=d.body.innerHTML;
    if(/% dự án/.test(html))throw new Error('còn nhãn "% dự án"');
    if(/Sản phẩm Roquette/.test(html))throw new Error('còn nhãn "Sản phẩm Roquette"');
    if(!/Tiến độ dự án/.test(html))throw new Error('thiếu nhãn "Tiến độ dự án"');
    E(`loginAs(${ix('duy@f.vn')}); go('cockpit')`);
    const ck=d.getElementById('view-cockpit').textContent;
    if(/Chạm gần nhất/.test(ck))throw new Error('còn "Chạm gần nhất"');
    if(!/Hoạt động gần nhất/.test(ck))throw new Error('thiếu "Hoạt động gần nhất"');
  });

  // ================= HỒI QUY =================
  step('cấu hình quy trình ba NCC còn nguyên',()=>{
    const p=JSON.parse(E('JSON.stringify(LISTS.pipelines)'));
    if(!p.Roquette||p.Roquette.length!==4)throw new Error('Roquette: '+JSON.stringify(p.Roquette));
    if(!p.IFF||p.IFF.length!==5)throw new Error('IFF');
    if(!(p.Kimica||p['Kimica-Navido']))throw new Error('mất Kimica');
    if(E("STAGE_GROUP['SOLUTION TESTING']")!=='Thử mẫu')throw new Error('mất nhóm giai đoạn');
    if(E("STAGE_PROB['QUOTED / PO']")!==80)throw new Error('mất % mặc định');
    if(E('SEG_GROUPS.length')!==3)throw new Error('mất nhóm ngành');
  });
  step('năm vai trò + vai trò lạ rơi vào mặc định chặt nhất',()=>{
    if(E('JSON.stringify(ROLE_ORDER)')!=='["sales","rnd","manager","director","superadmin"]')
      throw new Error(E('JSON.stringify(ROLE_ORDER)'));
    const c=JSON.parse(E('JSON.stringify(cap("ke-toan"))'));
    if(c.scope!=='own-pic'||c.edit||c.close||c.admin||c.cockpit||c.weekly)throw new Error(JSON.stringify(c));
  });
  step('Director chỉ đọc, R&D không đóng dự án',()=>{
    E(`USERS.push(
       {email:'dir@f.vn',picRaw:null,fullName:'Lê Giám Đốc',name:'Lê Giám Đốc',pic:'Lê Giám Đốc',role:'director',color:'#6D28D9'},
       {email:'rnd@f.vn',picRaw:null,fullName:'Trần Hoa',name:'Trần Hoa',pic:'Trần Hoa',role:'rnd',color:'#B45309'});
       RECORDS[0].rnd='Trần Hoa'; loginAs(USERS.length-2);`);
    if(E("canEdit(RECORDS[0])")||E("canClose(RECORDS[0])"))throw new Error('Director sửa được');
    E('loginAs(USERS.length-1)');
    if(!E("canEdit(RECORDS[0])"))throw new Error('R&D phải ghi được');
    if(E("canClose(RECORDS[0])"))throw new Error('R&D không được đóng dự án');
    if(E('visible().map(function(r){return r.id}).join(",")')!=='P-1')throw new Error('phạm vi R&D sai');
  });
  step('Cockpit, Funnel, Hoạt động, Dashboard, Báo cáo đều dựng được',()=>{
    E(`loginAs(${ix('duy@f.vn')})`);
    if(!d.querySelectorAll('.ck-sig').length)throw new Error('Cockpit trống');
    ['funnel','acts','dash','reports','users'].forEach(v=>E(`go('${v}')`));
    if(!d.getElementById('userRows').textContent.trim())throw new Error('bảng người dùng trống');
  });
  step('mở rồi lưu chi tiết không làm mất Người liên quan',()=>{
    E("go('funnel'); render(); openDetail('P-4')");
    if(E("JSON.stringify(dRelated)")!==E("JSON.stringify(RECORDS.find(function(r){return r.id==='P-4'}).related)"))
      throw new Error('ô chọn bị dọn ngay sau khi mở: '+E('JSON.stringify(dRelated)'));
    E('closeDetail()');
    if(!E("RECORDS.find(function(r){return r.id==='P-4'}).related.length"))
      throw new Error('dữ liệu bị xoá');
  });
  step('chip đường về của modal vẫn đúng',()=>{
    E("go('acts'); openDetail('P-1')");
    const b=d.getElementById('d-back');
    if(!b.classList.contains('on'))throw new Error('không hiện chip');
    E('closeDetail()');
    if(E('NAV.depth()'))throw new Error('ngăn xếp rò rỉ');
  });
  step('ghi hoạt động mới lưu bền vững với tiền tố AL-',()=>{
    E("go('acts'); openActForm({customer:'A',ncc:'Roquette'})");
    d.getElementById('a-note').value='kiểm thử khói';
    E('saveAct()');
    const n=E('LS.load().acts.length');
    if(!n)throw new Error('chưa lưu');
    if(!/^AL-/.test(E('LS.load().acts[0].id')))throw new Error('id sai tiền tố');
    E('LS.reset()');
    if(E('LS.load().acts.length')!==n)throw new Error('mất sau khi tải lại');
  });

  const real=errs.filter(e=>!/createLinearGradient|getContext|offline|Pipelines|chưa đăng nhập/.test(e));
  console.log('\n'+pass+' bước đạt · '+(real.length?'LỖI:\n'+real.join('\n'):'KHÔNG CÓ LỖI RUNTIME'));
}).catch(e=>console.error('HARNESS',e));
