/* tests/i18n-scan.js — dò chuỗi CÒN TIẾNG VIỆT khi app đang ở chế độ EN.
 *
 *   cd tests && node i18n-scan.js
 *
 * Cách làm: nạp index.html thật trong jsdom, đăng nhập, đi qua mọi màn hình và
 * mở mọi popup, rồi quét DOM tìm text node / placeholder / title còn dấu tiếng
 * Việt. In ra danh sách kèm nơi xuất hiện để bổ sung vào js/i18n.js.
 *
 * KHÔNG tự sửa gì. Đây là máy dò, việc dịch là của người. */
const { JSDOM } = require('jsdom'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script src="https:\/\/[^"]*"[^>]*><\/script>/g, '')
  .replace(/<link rel="stylesheet"[^>]*>/g, '').replace(/<link href="https:\/\/fonts[^>]*>/g, '');

/* Dấu tiếng Việt. Chữ không dấu (Roquette, Segment…) không tính là chưa dịch —
   máy không thể biết "Test" là tiếng Việt hay tiếng Anh. */
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/* Nội dung do người dùng nhập thì KHÔNG dịch — tên khách hàng, ghi chú, báo cáo.
   Dữ liệu mẫu bên dưới cố tình viết KHÔNG DẤU, để mọi chuỗi còn dấu tiếng Việt
   mà máy dò tìm thấy đều chắc chắn là chữ của giao diện, không phải của dữ liệu. */
const SKIP_SEL = '#aiMsgs, [data-noi18n], .wc-item-note, .ck-ev-note, .act-note, .cmt-t, ' +
                 '.tl-note, .rp-body, input, textarea';

(async () => {
  const dom = await new Promise(res => {
    const d = new JSDOM(HTML, {
      url: 'file://' + ROOT + '/index.html', runScripts: 'dangerously', resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
        function C() { return { destroy() {}, resize() {}, update() {}, data: {}, options: {} }; }
        C.register = () => {}; C.defaults = { font: {}, plugins: { legend: {} }, color: '' };
        C.getChart = () => null; w.Chart = C;
        w.confirm = () => true; w.fetch = () => Promise.reject(new Error('offline'));
        const st = {};
        Object.defineProperty(w, 'localStorage', { configurable: true, value: {
          getItem: k => st[k] === undefined ? null : st[k], setItem: (k, v) => { st[k] = String(v); },
          removeItem: k => { delete st[k]; }, key: i => Object.keys(st)[i],
          get length() { return Object.keys(st).length; } } });
        w.console.error = () => {}; w.console.warn = () => {};
        /* jsdom không có scrollIntoView; thiếu nó là cả một màn hình bị bỏ qua. */
        w.Element.prototype.scrollIntoView = function () {};
      },
    });
    setTimeout(() => res(d), 500);
  });

  const w = dom.window, d = w.document, E = c => w.eval(c);
  const T = E('todayISO()');
  const later = E('shiftISO(3)'), before = E('shiftISO(-3)');

  E(`RECORDS.push(
     {id:'P-1',ncc:'Roquette',customer:'Acecook',product:'Pregeflo',application:'Noodle',segment:'NOODLES',group:'SAVOURY',stage:'SOLUTION TESTING',status:'IN PROGRESS',prob:.5,kgThis:1000,kgNext:2000,pic:'Duy Che Ngoc',rnd:'',related:[],created:'${before}',closing:'${later}',desc:'demo',comments:[{by:'Duy Che Ngoc',at:'${before}',text:'note'}],updates:[]},
     {id:'P-2',ncc:'IFF',customer:'Bibica',product:'Flavour',application:'Bakery',segment:'BAKERY',group:'BAKERY',stage:'TESTING',status:'WON',prob:1,kgThis:500,kgNext:0,pic:'Duy Che Ngoc',rnd:'',related:[],created:'${before}',closing:'${before}',closedAt:'${before}',desc:'done',comments:[],updates:[]});
   ACTIVITIES.push(
     {id:'A-1',customer:'Acecook',pic:'Duy Che Ngoc',ncc:'Roquette',product:'',type:'Call',date:'${T}',note:'call',next:'send sample',potential:'Hot',projectId:'P-1'},
     {id:'A-2',customer:'Bibica',pic:'Duy Che Ngoc',ncc:'IFF',product:'',type:'Visit',date:'${later}',note:'visit',next:'—',potential:'Warm',projectId:null},
     {id:'A-3',customer:'Acecook',pic:'Duy Che Ngoc',ncc:'Khác',type:'Email',date:'${before}',note:'mail',next:'—',potential:'Cold',projectId:null});
   USERS.push({email:'duy@f.vn',picRaw:null,fullName:'Duy Che Ngoc',name:'Duy Che Ngoc',pic:'Duy Che Ngoc',role:'superadmin',color:'#1E3A8A'});`);
  await E('FISG_STORE.buildLists(RECORDS,ACTIVITIES)');
  E('loginAs(USERS.length-1)');

  const hits = new Map();
  const note = (text, where) => {
    const t = String(text).trim();
    if (!t || !VI.test(t)) return;
    if (!hits.has(t)) hits.set(t, new Set());
    hits.get(t).add(where);
  };

  function scan(where) {
    const wk = d.createTreeWalker(d.body, 1 /* SHOW_ELEMENT */ | 4 /* SHOW_TEXT */);
    let n;
    while ((n = wk.nextNode())) {
      if (n.nodeType === 3) {
        const p = n.parentElement;
        if (!p || p.closest(SKIP_SEL)) continue;
        if (p.offsetParent === null && p.closest('[style*="display:none"], [style*="display: none"]')) continue;
        note(n.nodeValue, where);
      } else {
        if (n.closest(SKIP_SEL)) continue;
        ['placeholder', 'title', 'aria-label'].forEach(a => {
          const v = n.getAttribute && n.getAttribute(a);
          if (v) note(v, where + ' [' + a + ']');
        });
      }
    }
  }

  /* i18n dịch qua MutationObserver — chạy ở microtask SAU khi render xong. Quét
     ngay lập tức sẽ thấy nguyên bản tiếng Việt và báo nhầm gần như mọi chuỗi. */
  const visit = async (label, code) => {
    try { E(code); } catch (e) { console.log('  (bỏ qua ' + label + ': ' + e.message + ')'); }
    await new Promise(r => setTimeout(r, 60));
    scan(label);
  };

  await visit('Tổng quan', "go('cockpit')");
  await visit('Tổng quan · ngăn kéo khách hàng', "openCustomer(custKey('Acecook'))");
  await visit('Sales Funnel', "closeCustomer(); go('funnel')");
  await visit('Khách hàng của tôi', "CUSTOMER_DIR.push({name:'Acecook',owner:'Duy Che Ngoc',legal:'CTY TNHH Acecook',spId:'1'}); CUSTOMER_OWNER[custOwnerKey('Acecook')]='Duy Che Ngoc'; go('customers')");
  await visit('KH · thêm mới', "cuOpenEdit()");
  await visit('KH · xem sửa', "cuCloseEdit(); cuOpenEdit('Acecook')");
  await visit('Chi tiết dự án', "openDetail('P-1')");
  await visit('Thêm dự án', "closeDetail(); openForm()");
  await visit('Đóng dự án', "closeForm(); openCloseModal('P-1')");
  await visit('Hoạt động', "closeCloseModal(); go('acts')");
  await visit('Ghi hoạt động', "openActForm()");
  await visit('Dashboard', "closeActForm(); go('dash')");
  await visit('Dashboard · tra cứu', "showInsight('kh','Acecook')");
  await visit('Báo cáo', "go('reports')");
  await visit('Soạn báo cáo', "openReportComposer()");
  await visit('Báo cáo · đã gửi + phản hồi', "REPORTS.push({id:'R-1',spId:'1',pic:'Duy Che Ngoc',picLabel:'Duy Che Ngoc',weekLabel:'03/08 – 09/08',createdAt:'2026-08-05',note:'Tuan tot',stats:{done:2,missed:0,changes:1,overdue:0},doneActs:[],missedActs:[],projectChanges:[],to:['Duy Che Ngoc'],comments:[{by:'Duy Che Ngoc',role:'superadmin',at:'2026-08-05',text:'ok'}]}); rpDiscard(); rpSelect('R-1')");
  await visit('Người dùng & phân quyền', "closeWelcome(); go('users')");
  await visit('Thêm người dùng · Sale Support', "openUserForm(); document.getElementById('u-role').value='salesupport'; admRoleHint()");
  await visit('Nhập NCC (Super Admin)', "FISG_SUPPLIER_IMPORT && FISG_SUPPLIER_IMPORT.render && FISG_SUPPLIER_IMPORT.render()");
  for (const m of ['mon', 'mid', 'fri'])
    await visit('Kế hoạch tuần · ' + m, "openWelcome(); wcSetMode('" + m + "')");
  await visit('Chia sẻ', "closeWelcome(); FISG_SHARE.open && FISG_SHARE.open()");

  const list = [...hits.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  console.log('\n=== CÒN TIẾNG VIỆT KHI CHỌN EN: ' + list.length + ' chuỗi ===\n');
  list.forEach(([t, where]) => {
    console.log('  "' + t.replace(/"/g, '\\"') + '"');
    console.log('      ← ' + [...where].join(' · '));
  });
  if (!list.length) console.log('  (không còn chuỗi nào)');
  console.log('\nDán vào DICT trong js/i18n.js theo dạng:  "chuỗi VI": "English",');
  process.exit(list.length ? 1 : 0);
})().catch(e => { console.error('SCAN', e); process.exit(2); });
