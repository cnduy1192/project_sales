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
  /* Đường ghi là bất đồng bộ: step đồng bộ sẽ báo ĐẠT trước khi assert kịp chạy. */
  async function astep(n,fn){try{await fn();pass++;console.log('OK   '+n)}catch(e){errs.push(n+': '+e.message);console.log('FAIL '+n+' — '+e.message)}}
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
  step('việc chưa bấm gì thì KHÔNG tự thành hoàn thành',()=>{
    /* Lỗi thật: luật cũ coi "ngày ≤ hôm nay" là đã làm, nên tải lại trang là
       mọi việc vừa ghi tự nhảy sang Đã làm dù chưa ai bấm. */
    const t=E('todayISO()');
    E(`ACTIVITIES.push(
       {id:'A-500',customer:'A',pic:'Phạm Bích Ngọc',ncc:'Roquette',product:'',type:'Call',date:'${t}',note:'việc từ SharePoint hôm nay',next:'—',potential:'Hot',projectId:null},
       {id:'A-501',customer:'A',pic:'Phạm Bích Ngọc',ncc:'Roquette',product:'',type:'Call',date:shiftISO(-2),note:'việc từ SharePoint hôm kia',next:'—',potential:'Hot',projectId:null});
       renderWelcome();`);
    if(E("LS.isDone(ACTIVITIES.find(function(a){return a.id==='A-500'}))"))
      throw new Error('việc hôm nay tự thành đã làm');
    if(E("LS.isDone(ACTIVITIES.find(function(a){return a.id==='A-501'}))"))
      throw new Error('việc quá khứ tự thành đã làm');
    const grps=[...d.querySelectorAll('#wcBody .wc-grp')];
    const miss=grps.find(g=>/Chưa đánh dấu/.test(g.textContent));
    if(!/việc từ SharePoint hôm kia/.test(miss.textContent))
      throw new Error('việc quá hạn chưa bấm phải nằm ở Chưa đánh dấu');
    const doing=grps.find(g=>/Đang làm hôm nay/.test(g.textContent));
    if(!/việc từ SharePoint hôm nay/.test(doing.textContent))
      throw new Error('việc hôm nay phải nằm ở Đang làm');
  });
  step('nút mang nhãn Hoàn thành và bấm mới ghi nhận',()=>{
    const grps=[...d.querySelectorAll('#wcBody .wc-grp')];
    const doing=grps.find(g=>/Đang làm hôm nay/.test(g.textContent));
    const btn=[...doing.querySelectorAll('.wc-btn.ok')];
    if(!btn.length)throw new Error('không có nút đánh dấu');
    if(btn[0].textContent.trim()!=='Hoàn thành')
      throw new Error('nhãn nút: '+btn[0].textContent.trim());
    E("wcMarkDone('A-500',1)");
    if(!E("LS.isDone(ACTIVITIES.find(function(a){return a.id==='A-500'}))"))
      throw new Error('bấm rồi vẫn chưa ghi nhận');
    E("wcMarkDone('A-500',0)");
    if(E("LS.isDone(ACTIVITIES.find(function(a){return a.id==='A-500'}))"))
      throw new Error('hoàn tác không gỡ được cờ');
    E("ACTIVITIES=ACTIVITIES.filter(function(a){return a.id!=='A-500'&&a.id!=='A-501'}); renderWelcome();");
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
  step('popup khách hàng không lộ dự án của sales khác',()=>{
    /* P-3 (Tâm) và P-4 (Tâm, Ngọc là người liên quan) cùng khách "C"/"D".
       Đặt cả hai về chung một khách để popup phải chọn lọc. */
    E(`RECORDS.find(function(r){return r.id==='P-3'}).customer='CJ Foods';
       RECORDS.find(function(r){return r.id==='P-4'}).customer='CJ Foods';
       ACTIVITIES.push({id:'A-11',customer:'CJ Foods',pic:'Tam',ncc:'Roquette',product:'',type:'Call',date:'2026-07-24',note:'ghi chú riêng của Tâm',next:'—',potential:'Hot',projectId:'P-3'});
       loginAs(${ix('ngoc@f.vn')}); closeWelcome(); FISG_EXTRAS.customerModal('CJ Foods')`);
    const b=d.getElementById('custBody').textContent;
    if(/P-3/.test(b))throw new Error('lộ dự án của sales khác');
    if(/ghi chú riêng của Tâm/.test(b))throw new Error('lộ hoạt động của sales khác');
    if(!/P-4/.test(b))throw new Error('mất dự án mình là người liên quan');
    const kpi=d.querySelector('#custBody .cust-kpi b').textContent;
    if(kpi!=='1')throw new Error('số đếm vẫn tính cả dự án bị ẩn: '+kpi);
    d.getElementById('custOv').classList.remove('open');
  });
  step('mở thẳng dự án của sales khác cũng bị chặn',()=>{
    E("curRec=null; openDetail('P-3')");
    if(E("curRec && curRec.id")==='P-3')throw new Error('vẫn mở được');
    E("openDetail('P-4')");
    if(E("curRec && curRec.id")!=='P-4')throw new Error('chặn nhầm dự án hợp lệ');
    E('closeDetail()');
  });
  step('link chia sẻ chỉ chụp phần dữ liệu mình được xem',()=>{
    const ids=E("JSON.stringify(FISG_SHARE_NET.buildSnapshot('Tất cả NCC','',[]).records.map(function(r){return r.id}))");
    if(/P-3/.test(ids))throw new Error('đẩy dự án của sales khác lên link công khai: '+ids);
    if(!/P-1/.test(ids))throw new Error('mất dự án của chính mình: '+ids);
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

  // ---- tab "Tất cả" ----
  step('tab Tất cả gộp mọi NCC, kể cả hoạt động Khác',()=>{
    E(`loginAs(${ix('duy@f.vn')}); go('funnel')`);
    const tabs=[...d.querySelectorAll('.ncc-tab')].map(t=>t.dataset.ncc);
    if(tabs[0]!==E('ALL_NCC'))throw new Error('tab Tất cả không đứng đầu: '+tabs.join(','));
    if(tabs.filter(t=>t===E('ALL_NCC')).length!==1)throw new Error('tab Tất cả bị nhân đôi');
    E(`ACTIVITIES.push({id:'AL-8',customer:'B',pic:'Tam',ncc:'IFF',product:'',type:'Call',date:'2026-07-25',note:'việc IFF',next:'—',potential:'Hot',projectId:null});
       RECORDS.push({id:'P-5',ncc:'IFF',customer:'E',product:'Q',application:'u',segment:'DAIRY',group:'SWEET',stage:'TESTING',status:'IN PROGRESS',prob:.4,kgThis:7,kgNext:0,pic:'Tam',rnd:'',related:[],created:'2026-07-05',closing:'2026-09-05',desc:'',comments:[],updates:[]});
       setNcc(ALL_NCC)`);
    if(!E('isAllNcc()'))throw new Error('không vào được chế độ Tất cả');
    const v=E('visible().map(function(r){return r.ncc}).join(",")');
    if(!/Roquette/.test(v)||!/IFF/.test(v))throw new Error('vẫn lọc theo một NCC: '+v);
    const av=E('visibleActs().map(function(a){return a.ncc}).join(",")');
    if(!/IFF/.test(av)||!/Khác/.test(av))throw new Error('hoạt động chưa gộp: '+av);
  });
  step('trục giai đoạn ở chế độ Tất cả dùng nhóm giai đoạn',()=>{
    const st=JSON.parse(E('JSON.stringify(activeStages())'));
    if(st.indexOf('Thử mẫu')<0)throw new Error('không phải nhóm giai đoạn: '+st.join(','));
    if(st.indexOf('SOLUTION TESTING')>=0)throw new Error('còn tên giai đoạn riêng của Roquette');
    /* Roquette "SOLUTION TESTING" và IFF "TESTING" phải rơi cùng một cột. */
    if(!E("atStage(RECORDS.find(function(r){return r.id==='P-1'}),'Thử mẫu')"))throw new Error('Roquette lệch cột');
    if(!E("atStage(RECORDS.find(function(r){return r.id==='P-5'}),'Thử mẫu')"))throw new Error('IFF lệch cột');
    E('render(); renderDash()');
    const n=[...d.querySelectorAll('#spineFlow .spine-step')].length;
    if(n!==st.length)throw new Error('trục vẽ '+n+' cột, cấu hình '+st.length);
  });
  step('form vẫn buộc chọn một NCC cụ thể khi đang xem Tất cả',()=>{
    if(E('NCCS.indexOf(formNcc())')<0)throw new Error('formNcc trả về: '+E('formNcc()'));
    E('buildForm()');
    const ncc=d.getElementById('f-ncc');
    if([...ncc.options].some(o=>o.value===E('ALL_NCC')))throw new Error('form có tuỳ chọn Tất cả');
    if(!d.getElementById('f-stage').options.length)throw new Error('ô giai đoạn rỗng');
    const st=[...d.getElementById('f-stage').options].map(o=>o.value);
    if(st.indexOf('Thử mẫu')>=0)throw new Error('form nhận nhóm giai đoạn thay vì giai đoạn thật');
    E("setNcc(NCCS[0])");
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

  // ---- ĐƯỜNG GHI LÊN SHAREPOINT ----
  /* Giả lập Graph. Cột Activities cố tình dùng internal name BỊ MÃ HOÁ và KHÔNG
     có cột PICName — đúng cảnh SharePoint tạo cột bằng tên tiếng Việt. Nếu lớp
     ghi đoán tên cột thay vì dò, mấy bước dưới đây trượt hết. Mock cũng từ chối
     field lạ y như Graph thật (400), để lỗi lộ ra ở đây thay vì trên máy khách. */
  const SP = { created:[], updated:[], nextId:900, fail:false };
  const COLS = {
    Activities:{ Title:'Title', OData__x004b_H:'Khách hàng', PIC:'Sale phụ trách',
      OData__x004e_CC:'NCC quan tâm', ActivityType:'Loại hoạt động', ActivityDate:'Ngày',
      Content:'Nội dung', NextStep:'Kết quả / Next step', PotentialLevel:'Mức độ tiềm năng',
      RelatedProject:'Dự án liên quan', Product:'Nguyên liệu quan tâm' },
    Projects:{ Title:'Title', Customer:'Khách hàng', Products:'Nguyên liệu', Supplier:'NCC',
      Application:'Ứng dụng', Segment:'Segment', SegmentGroup:'Nhóm ngành', Stage:'Giai đoạn',
      Status:'Trạng thái', Result:'Kết quả', WinProbability:'Xác suất thắng %',
      PotentialKgThisYear:'KG năm nay', PotentialKgNextYear:'KG năm sau',
      PICName:'PICName', CreationDate:'Ngày tạo', ClosingDate:'Ngày dự kiến chốt' },
    ProjectUpdates:{ Title:'Title', Project:'Dự án', PICName:'PICName',
      UpdateDate:'Ngày cập nhật', Content:'Nội dung' },
    Customers:{ Title:'Title' }, Products:{ Title:'Title' }, Suppliers:{ Title:'Title' },
  };
  const ITEMS = { Customers:[{id:'11',fields:{Title:'A'}}], Products:[{id:'21',fields:{Title:'X'}}],
                  Suppliers:[{id:'31',fields:{Title:'Roquette'}},{id:'32',fields:{Title:'IFF'}}] };
  w.FISG_CFG.USE_GRAPH = true;
  w.FISG_AUTH = { account:()=>({username:'duy@f.vn'}), getToken:async()=>'t' };
  w.FISG_GRAPH = {
    columns: async l => COLS[l] || {},
    listItems: async l => ITEMS[l] || [],
    createItem: async (l,f) => {
      if(SP.fail) throw new Error('Graph 403: không có quyền ghi');
      const bad = Object.keys(f).filter(k => !(COLS[l]||{})[k.replace(/LookupId$/,'')]);
      if(bad.length) throw new Error('Graph 400: cột không tồn tại: '+bad.join(','));
      const it = { id:String(SP.nextId++), fields:Object.assign({},f) };
      (ITEMS[l] = ITEMS[l] || []).push(it);
      SP.created.push({ list:l, fields:f, id:it.id });
      return it;
    },
    updateItem: async (l,id,f) => { SP.updated.push({ list:l, id, fields:f }); return null; },
    deleteItem: async () => null,
  };
  const wait = () => new Promise(r => setTimeout(r, 80));
  const madeIn = l => SP.created.filter(x => x.list === l);

  E(`loginAs(${ix('ngoc@f.vn')}); closeWelcome(); go('acts')`);
  E("openActForm({customer:'Khách Mới Toanh', ncc:'Roquette'})");
  d.getElementById('a-note').value='ghi thử lên SharePoint';
  d.getElementById('a-next').value='gửi mẫu';
  E('saveAct()');
  await wait();

  await astep('ghi hoạt động lên SharePoint bằng đúng tên cột thật',()=>{
    const c=madeIn('Activities');
    if(!c.length)throw new Error('không gọi createItem, chỉ tạo: '+SP.created.map(x=>x.list).join(','));
    const f=c[0].fields;
    if(!f.OData__x004b_HLookupId)throw new Error('không dò ra cột Khách hàng: '+Object.keys(f).join(','));
    if(f.Customer||f.CustomerLookupId)throw new Error('ghi bằng tên cột đoán bừa');
    if(f.PICName)throw new Error('ghi PICName dù list không có cột đó — Graph sẽ trả 400');
    if(f.PIC!=='Phạm Bích Ngọc')throw new Error('thiếu tên người phụ trách: '+JSON.stringify(f));
    if(!/^\d{4}-\d{2}-\d{2}T/.test(f.ActivityDate))throw new Error('ngày sai định dạng: '+f.ActivityDate);
    if(f.Content!=='ghi thử lên SharePoint')throw new Error('nội dung sai');
  });
  await astep('khách hàng mới tự tạo trong Customers, nhà cung cấp thì không',()=>{
    const cus=madeIn('Customers');
    if(cus.length!==1||cus[0].fields.Title!=='Khách Mới Toanh')throw new Error('không tạo khách mới');
    if(madeIn('Suppliers').length)throw new Error('tự sinh nhà cung cấp — không được');
  });
  await astep('ghi xong thì bỏ cờ chưa đồng bộ',()=>{
    const sp=E("(ACTIVITIES.find(function(x){return x.customer==='Khách Mới Toanh'})||{}).spId");
    if(!sp)throw new Error('chưa gắn spId');
    if(E('LS.pendingActs().length'))throw new Error('vẫn nằm trong hàng chờ');
  });
  await astep('hoạt động NCC "Khác" không sinh dòng rác trong Suppliers',async()=>{
    await E(`FISG_STORE.createActivity({id:'AL-x',customer:'A',pic:'Tam',ncc:'Khác',type:'Seminar',
      date:'2026-08-01',note:'hội thảo',next:'—',potential:'Warm',projectId:null})`);
    if(madeIn('Suppliers').length)throw new Error('sinh NCC "Khác"');
    const f=SP.created[SP.created.length-1].fields;
    if(f.OData__x004e_CCLookupId)throw new Error('vẫn gắn NCC cho hoạt động Khác');
  });

  SP.fail = true;
  E("openActForm({customer:'A', ncc:'Roquette'})");
  d.getElementById('a-note').value='ghi lúc mất mạng';
  E('saveAct()');
  await wait();
  await astep('ghi hỏng: giữ lại để thử lại, không giả vờ đã lưu',()=>{
    const p=E("LS.pendingActs().map(function(a){return a.note}).join('|')");
    if(!/ghi lúc mất mạng/.test(p))throw new Error('mất việc vừa nhập: '+p);
    if(E("(ACTIVITIES.find(function(x){return x.note==='ghi lúc mất mạng'})||{}).spId"))
      throw new Error('gắn spId dù ghi hỏng');
    if(!E("actPending(ACTIVITIES.find(function(x){return x.note==='ghi lúc mất mạng'}))"))
      throw new Error('không đánh dấu chưa đồng bộ');
    if(!/chưa đồng bộ/.test(d.getElementById('actRows').textContent))
      throw new Error('bảng không hiện dấu chưa đồng bộ');
  });
  SP.fail = false;
  await astep('lần đồng bộ sau tự đẩy nốt việc còn kẹt',async()=>{
    const n=await E('FISG_STORE.pushPendingActs()');
    if(n!==1)throw new Error('đẩy được '+n+' việc');
    if(E('LS.pendingActs().length'))throw new Error('vẫn còn kẹt');
  });

  // ---- dự án ----
  E("go('funnel'); openForm(); buildForm();");
  [['f-cust','Khách Dự Án'],['f-prod','Sản phẩm mới'],['f-app','Ứng dụng A'],['f-closing','2026-12-31']]
    .forEach(([id,v])=>{ d.getElementById(id).value=v; });
  E('saveForm()');
  await wait();
  await astep('tạo dự án ghi lên list Projects và đổi id theo SharePoint',()=>{
    const c=madeIn('Projects');
    if(!c.length)throw new Error('không ghi dự án');
    const f=c[0].fields;
    if(!f.CustomerLookupId)throw new Error('thiếu lookup khách hàng: '+Object.keys(f).join(','));
    if(f.Status!=='Open')throw new Error('trạng thái sai: '+f.Status);
    if(f.PICName!=='Phạm Bích Ngọc')throw new Error('thiếu PIC: '+f.PICName);
    const id=E("(RECORDS.find(function(r){return r.customer==='Khách Dự Án'})||{}).id");
    if(!/^P-\d+$/.test(String(id)))throw new Error('id chưa đổi theo SharePoint: '+id);
    if(!E("(RECORDS.find(function(r){return r.customer==='Khách Dự Án'})||{}).spId"))
      throw new Error('thiếu spId');
  });
  const pid = E("RECORDS.find(function(r){return r.customer==='Khách Dự Án'}).id");
  E(`openDetail('${pid}')`);
  d.getElementById('d-kg1').value='1234';
  E('saveDetail()');
  await wait();
  await astep('sửa dự án ghi PATCH kèm một dòng nhật ký',()=>{
    const u=SP.updated.filter(x=>x.list==='Projects');
    if(!u.length)throw new Error('không gọi updateItem');
    if(u[0].fields.PotentialKgThisYear!==1234)throw new Error('sai giá trị: '+JSON.stringify(u[0].fields));
    if(!madeIn('ProjectUpdates').length)throw new Error('thiếu dòng nhật ký');
  });

  // ---- khối Sắp tới ----
  await astep('khối Sắp tới hiện việc đã lên lịch, Dòng thời gian thì không',()=>{
    E(`loginAs(${ix('duy@f.vn')});
       ACTIVITIES.push(
         {id:'AL-U1',customer:'A',pic:'Phạm Bích Ngọc',ncc:'Roquette',product:'',type:'Visit',date:shiftISO(2),note:'ghé thăm tuần sau',next:'—',potential:'Hot',projectId:null},
         {id:'AL-U2',customer:'B',pic:'Tam',ncc:'IFF',product:'',type:'Call',date:shiftISO(30),note:'quá xa',next:'—',potential:'Warm',projectId:null});
       invalidateCockpit(); go('cockpit')`);
    const up=d.getElementById('ckUp').textContent;
    if(!/ghé thăm tuần sau/.test(up))throw new Error('thiếu việc sắp tới');
    if(/quá xa/.test(up))throw new Error('lấy cả việc ngoài 7 ngày');
    if(/ghé thăm tuần sau/.test(d.getElementById('ckFeed').textContent))
      throw new Error('việc tương lai lọt vào Dòng thời gian');
    const n=parseInt(d.getElementById('ckUpCount').textContent,10);
    if(!(n>=1))throw new Error('đếm sai: '+d.getElementById('ckUpCount').textContent);
    if(d.querySelectorAll('#ckUp .ck-ev-up').length!==n)
      throw new Error('số dòng không khớp số đếm');
  });
  await astep('Sắp tới chịu cùng bộ lọc NCC với Dòng thời gian',()=>{
    E("ckToggleNcc('IFF')");
    if(/ghé thăm tuần sau/.test(d.getElementById('ckUp').textContent))
      throw new Error('không chịu bộ lọc NCC');
    E("ckToggleNcc('IFF')");
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
       RECORDS.find(function(r){return r.id==='P-1'}).rnd='Trần Hoa';
       loginAs(USERS.length-2);`);
    const P1="RECORDS.find(function(r){return r.id==='P-1'})";
    if(E("canEdit("+P1+")")||E("canClose("+P1+")"))throw new Error('Director sửa được');
    E('loginAs(USERS.length-1)');
    if(!E("canEdit("+P1+")"))throw new Error('R&D phải ghi được');
    if(E("canClose("+P1+")"))throw new Error('R&D không được đóng dự án');
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

  /* ---- ĐỌC VỀ: cột lookup có internal name khác tên logic ----
     Đây là lỗi đã xảy ra thật: SharePoint đặt internal name là Customer0 (hoặc
     mã hoá tên tiếng Việt) trong khi phía đọc gõ cứng "Customer", nên khách
     hàng đọc về rỗng dù trên SharePoint nhìn vẫn đủ. Bước này phải chạy CUỐI
     cùng vì syncFromGraph thay sạch RECORDS/ACTIVITIES. */
  await astep('đọc được lookup dù internal name khác tên logic',async()=>{
    COLS.Activities = { Title:'Title', Customer0:'Customer', PIC:'PIC',
      OData__x004e_CC:'Supplier', ActivityType:'ActivityType', ActivityDate:'ActivityDate',
      Content:'Content', NextStep:'NextStep', PotentialLevel:'PotentialLevel',
      RelatedProject0:'RelatedProject' };
    COLS.Projects = { Title:'Title', Customer0:'Customer', Products0:'Products',
      Supplier0:'Supplier', Stage:'Stage', Status:'Status', PICName:'PICName',
      ClosingDate:'ClosingDate', CreationDate:'CreationDate' };
    ITEMS.Customers = [{id:'11',fields:{Title:'CJ Foods'}}];
    ITEMS.Suppliers = [{id:'31',fields:{Title:'Roquette'}}];
    ITEMS.Products  = [{id:'21',fields:{Title:'Pregeflo PJ 30'}}];
    ITEMS.Projects  = [{id:'544',fields:{ Title:'P-0544 thử', Customer0LookupId:'11',
      Products0LookupId:'21', Supplier0LookupId:'31', Stage:'SOLUTION TESTING',
      Status:'Open', PICName:'Vo Tan Cuong', ClosingDate:'2026-12-31T12:00:00Z' }}];
    ITEMS.Activities = [{id:'701',fields:{ Title:'CJ Foods · Call', Customer0LookupId:'11',
      PIC:'Vo Tan Cuong', OData__x004e_CCLookupId:'31', ActivityType:'Call',
      ActivityDate:'2026-08-05T12:00:00Z', Content:'Test', NextStep:'—',
      PotentialLevel:'Warm', RelatedProject0LookupId:'544' }}];
    ITEMS.ProjectUpdates = [];
    const ok = await E('FISG_STORE.syncFromGraph()');
    if(!ok)throw new Error('đồng bộ trả về false');
    /* ACTIVITIES[0] có thể là bản địa phương merge vào đầu — tìm đúng dòng đọc về. */
    const a = JSON.parse(E("JSON.stringify(ACTIVITIES.find(function(x){return x.id==='A-701'})||{})"));
    if(!a.id)throw new Error('không đọc về dòng nào từ SharePoint');
    if(a.customer!=='CJ Foods')throw new Error('mất tên khách hàng: '+JSON.stringify(a));
    if(a.ncc!=='Roquette')throw new Error('mất NCC: '+a.ncc);
    if(a.pic!=='Vo Tan Cuong')throw new Error('mất PIC: '+a.pic);
    /* Mã dự án lấy từ tiền tố trong Title nếu có, nếu không mới dùng id item. */
    if(a.projectId!=='P-0544')throw new Error('mất liên kết dự án: '+a.projectId);
    const r = JSON.parse(E("JSON.stringify(RECORDS.find(function(x){return x.id==='P-0544'})||{})"));
    if(!r.id)throw new Error('không đọc về dự án nào');
    if(r.customer!=='CJ Foods'||r.product!=='Pregeflo PJ 30')
      throw new Error('dự án mất lookup: '+JSON.stringify(r));
  });
  await astep('debug() chỉ ra khoá nào dò trượt cột nào',async()=>{
    const r = await E("FISG_STORE.debug('Activities')");
    if(!r || !r.own)throw new Error('debug không trả về danh sách cột nghiệp vụ');
    if(r.own.indexOf('ContentType')>=0||r.own.indexOf('Modified')>=0)
      throw new Error('vẫn liệt kê cột hệ thống');
    if(r.own.indexOf('Customer0')<0)throw new Error('thiếu cột nghiệp vụ: '+r.own.join(','));
  });
  await astep('cảnh báo cột: im khi rỗng thật, kêu khi mất cột',async()=>{
    /* NCC rỗng ở hoạt động "Khác" là chủ ý. Cảnh báo giả bị bỏ qua rất nhanh,
       nên chỉ kêu khi KHÔNG DÒ RA CỘT. */
    const grab = async () => {
      const out=[], old=w.console.warn;
      w.console.warn=(...a)=>{ out.push(a.map(String).join(' ')); };
      try { await E('FISG_STORE.syncFromGraph()'); } finally { w.console.warn=old; }
      return out.join('\n');
    };
    ITEMS.Activities.push({id:'702',fields:{ Title:'Khác · Seminar', Customer0LookupId:'11',
      PIC:'Vo Tan Cuong', ActivityType:'Seminar', ActivityDate:'2026-08-06T12:00:00Z',
      Content:'hội thảo chung', NextStep:'—', PotentialLevel:'Warm' }});
    const quiet = await grab();
    if(/không tìm thấy cột.*Supplier|đều trống.*Supplier/.test(quiet))
      throw new Error('kêu oan khi NCC rỗng thật:\n'+quiet);

    delete COLS.Activities.OData__x004e_CC;      // mất hẳn cột NCC
    const loud = await grab();
    if(!/không tìm thấy cột "Supplier"/.test(loud))
      throw new Error('mất cột mà không cảnh báo:\n'+loud);
    COLS.Activities.OData__x004e_CC = 'Supplier';
    await E('FISG_STORE.syncFromGraph()');
  });
  await astep('hoạt động đã lên SharePoint không hiện thành hai dòng',async()=>{
    /* Bản cũ chỉ đánh dấu "đã gửi" mà vẫn giữ bản AL- trong máy, nên lần đăng
       nhập sau mergeActs nối thêm một dòng y hệt bên cạnh bản chính thức. */
    E(`LS.addAct({id:'AL-77',customer:'CJ Foods',pic:'Vo Tan Cuong',ncc:'Roquette',
        product:'',type:'Call',date:'2026-08-05',note:'Test',next:'—',potential:'Warm',
        projectId:null,spId:'701'});
       LS.mergeActs()`);
    const n=E("ACTIVITIES.filter(function(x){return x.note==='Test'}).length");
    if(n!==1)throw new Error('có '+n+' dòng trùng nhau');
    if(E("LS.load().acts.filter(function(x){return x.id==='AL-77'}).length"))
      throw new Error('bản địa phương vẫn còn kẹt lại');
  });

  const real=errs.filter(e=>!/createLinearGradient|getContext|offline|Pipelines|chưa đăng nhập/.test(e));
  console.log('\n'+pass+' bước đạt · '+(real.length?'LỖI:\n'+real.join('\n'):'KHÔNG CÓ LỖI RUNTIME'));
}).catch(e=>console.error('HARNESS',e));
