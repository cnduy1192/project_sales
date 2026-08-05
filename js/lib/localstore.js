/* js/lib/localstore.js — lớp đè bền vững cho việc sales nhập trong phần mềm.
   Quy tắc: không đụng DOM. Lớp này CỘNG THÊM vào ACTIVITIES chứ không ghi đè,
   nên khi store.js tráo dữ liệu SharePoint thật vào, việc vừa nhập không mất. */

var LS = (function(){
  var KEY_PREFIX = 'fisg_local_';
  var EMPTY = { v:1, acts:[], done:{}, reports:[] };
  var _cache = null, _key = null, _ok = null;

  function available(){
    if(_ok !== null) return _ok;
    try{
      var t = '__fisg_probe__';
      localStorage.setItem(t,'1'); localStorage.removeItem(t);
      _ok = true;
    }catch(e){ _ok = false; }
    return _ok;
  }

  function keyOf(){
    var who = (typeof me !== 'undefined' && me && me.email) ? me.email : 'anon';
    return KEY_PREFIX + who;
  }

  /* Dữ liệu hỏng không được làm vỡ trang: vá về hình dạng đúng rồi đi tiếp. */
  function normalize(o){
    if(!o || typeof o !== 'object') return JSON.parse(JSON.stringify(EMPTY));
    return {
      v: 1,
      acts: Array.isArray(o.acts) ? o.acts.filter(function(a){ return a && a.id; }) : [],
      done: (o.done && typeof o.done === 'object') ? o.done : {},
      reports: Array.isArray(o.reports) ? o.reports.filter(function(r){ return r && r.id; }) : []
    };
  }

  function load(){
    var k = keyOf();
    if(_cache && _key === k) return _cache;
    _key = k;
    if(!available()){ _cache = normalize(null); return _cache; }
    try{ _cache = normalize(JSON.parse(localStorage.getItem(k))); }
    catch(e){ _cache = normalize(null); }
    return _cache;
  }

  function save(){
    if(!available() || !_cache) return false;
    try{ localStorage.setItem(_key, JSON.stringify(_cache)); return true; }
    catch(e){ return false; }
  }

  /* Đổi người đăng nhập thì phải đọc lại khoá khác. Nhưng khi trình duyệt chặn
     lưu trữ, bộ nhớ tạm LÀ dữ liệu duy nhất — xoá nó là mất trắng việc vừa nhập. */
  function reset(){ if(!available()) return; _cache = null; _key = null; }

  /* Nối hoạt động đã lưu vào ACTIVITIES, bỏ qua id đã tồn tại. Gọi được nhiều
     lần — sau đăng nhập, và sau mỗi lần store.js thay mảng. */
  function mergeActs(){
    var d = load();
    if(!d.acts.length) return 0;
    var have = {};
    ACTIVITIES.forEach(function(a){ have[a.id] = 1; if(a.spId) have['A-' + a.spId] = 1; });
    var added = 0, stale = [];
    d.acts.forEach(function(a){
      /* Đã lên SharePoint rồi thì bản chính thức tự về với id A-<spId>; nối thêm
         bản địa phương nữa là ra HAI dòng y hệt nhau trên bảng. */
      if(a.spId){ stale.push(a); return; }
      if(!have[a.id]){ ACTIVITIES.unshift(a); added++; }
    });
    stale.forEach(function(a){ dropAct(a.id, 'A-' + a.spId); });
    return added;
  }

  function nextActId(){
    var d = load(), n = 0;
    d.acts.forEach(function(a){
      var m = /^AL-(\d+)$/.exec(a.id);
      if(m) n = Math.max(n, +m[1]);
    });
    return 'AL-' + String(n+1).padStart(4,'0');
  }

  function addAct(a){
    var d = load();
    d.acts.unshift(a);
    save();
    return a;
  }

  /* Đánh dấu một hoạt động đã lên được SharePoint. Còn nằm trong acts (để lịch
     sử đánh dấu "đã làm" không đứt), nhưng mergeActs sẽ không nhân bản nữa vì
     store.js đọc về đúng dòng đó với id A-<spId>. */
  function markSent(id, spId){
    var d = load(), hit = null;
    d.acts.forEach(function(a){ if(a.id === id){ a.spId = spId; a.sentAt = todayISO(); hit = a; } });
    if(hit) save();
    return hit;
  }
  /* Việc đã nhập nhưng CHƯA lên được SharePoint — chỉ mình người nhập thấy. */
  function pendingActs(){
    return load().acts.filter(function(a){ return !a.spId; });
  }
  /* Đã lên SharePoint rồi thì bản địa phương hết nhiệm vụ: store.js sẽ tải về
     bản chính thức. Giữ lại cờ "đã làm" theo id mới. */
  function dropAct(id, newId){
    var d = load(), i = -1;
    d.acts.forEach(function(a, k){ if(a.id === id) i = k; });
    if(i < 0) return false;
    if(newId && d.done[id]){ d.done[newId] = d.done[id]; }
    delete d.done[id];
    d.acts.splice(i, 1);
    save();
    return true;
  }

  /* iso = null để gỡ cờ. */
  function markDone(id, iso){
    var d = load();
    if(iso) d.done[id] = iso; else delete d.done[id];
    save();
  }

  /* HOÀN THÀNH LÀ MỘT HÀNH ĐỘNG, KHÔNG PHẢI MỘT PHÉP SUY.

     Luật cũ có thêm một nhánh: ngày ≤ hôm nay thì coi như đã làm. Nó sinh ra cho
     ~334 bản ghi lịch sử không có cờ, lúc dữ liệu còn nằm trong file demo. Nhưng
     từ khi hoạt động đọc về từ SharePoint, nhánh đó biến MỌI việc vừa ghi thành
     "đã hoàn thành" ngay sau khi tải lại trang — người dùng chưa bấm gì cả, mà
     báo cáo tuần đã tính là xong.

     Nay chỉ một luật: có cờ thì mới xong. Cờ chỉ đặt được bằng nút "Hoàn thành". */
  function isDone(a){
    if(!a) return false;
    /* Cột "Ngày hoàn thành" trên SharePoint là NGUỒN SỰ THẬT — mọi máy và quản
       lý cùng đọc một chỗ. Cờ trong máy chỉ là lớp đệm cho lúc mất mạng, hoặc
       cho khi list chưa kịp thêm cột. */
    if(a.doneAt) return true;
    return !!load().done[a.id];
  }
  /* Ngày hoàn thành để hiển thị: ưu tiên bản trên SharePoint. */
  function doneAt(a){
    if(!a) return '';
    return a.doneAt || load().done[a.id] || '';
  }

  /* Bản ghi do người dùng nhập trong phần mềm nhưng chưa lên SharePoint. */
  function isLocal(a){ return !!a && /^AL-/.test(a.id); }

  /* Đã qua ngày mà chưa ai bấm hoàn thành. Trước đây chỉ xét bản ghi tạo trong
     phần mềm (isLocal) vì dữ liệu nhập sẵn không phân biệt được kế hoạch với
     thực tế. Nay mọi hoạt động đều do người dùng tạo và đều có cờ riêng, nên
     luật áp cho tất cả. Việc CỦA HÔM NAY chưa tính là bỏ quên — ngày vẫn còn. */
  function isMissed(a){
    if(!a || isDone(a)) return false;
    var iso = normDate(a.date);
    return !!iso && iso < todayISO();
  }

  function addReport(r){
    var d = load();
    d.reports.unshift(r);
    save();
    return r;
  }
  function nextReportId(){
    var d = load(), n = 0;
    d.reports.forEach(function(r){
      var m = /^R-(\d+)$/.exec(r.id);
      if(m) n = Math.max(n, +m[1]);
    });
    return 'R-' + String(n+1).padStart(4,'0');
  }

  /* Báo cáo lưu theo khoá của người gửi, nên manager đọc phải quét mọi khoá
     fisg_local_*. Bản thật dùng SharePoint List thì đây chỉ còn là một truy vấn. */
  function allReports(){
    if(!available()) return load().reports.slice();
    var out = [];
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if(k.indexOf(KEY_PREFIX) !== 0) continue;
      try{
        var d = normalize(JSON.parse(localStorage.getItem(k)));
        out = out.concat(d.reports);
      }catch(e){}
    }
    out.sort(function(a,b){ return a.createdAt < b.createdAt ? 1 : -1; });
    return out;
  }

  function reportsFor(pic){
    var key = picKey(pic);
    return allReports().filter(function(r){ return picKey(r.pic) === key; });
  }

  return {
    available: available, load: load, save: save, reset: reset,
    mergeActs: mergeActs, nextActId: nextActId, addAct: addAct,
    markDone: markDone, isDone: isDone, isLocal: isLocal, isMissed: isMissed,
    markSent: markSent, pendingActs: pendingActs, dropAct: dropAct, doneAt: doneAt,
    addReport: addReport, nextReportId: nextReportId,
    allReports: allReports, reportsFor: reportsFor
  };
})();
window.LS = LS;
