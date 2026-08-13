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

  function reset(){ if(!available()) return; _cache = null; _key = null; }

  function mergeActs(){
    var d = load();
    if(!d.acts.length) return 0;
    var have = {};
    ACTIVITIES.forEach(function(a){ have[a.id] = 1; if(a.spId) have['A-' + a.spId] = 1; });
    var added = 0, stale = [];
    d.acts.forEach(function(a){

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

  function updateAct(a){
    if(!a) return false;
    var d = load(), hit = false;
    d.acts = d.acts.map(function(x){ if(x.id === a.id){ hit = true; return a; } return x; });
    if(hit) save();
    return hit;
  }

  function markSent(id, spId){
    var d = load(), hit = null;
    d.acts.forEach(function(a){ if(a.id === id){ a.spId = spId; a.sentAt = todayISO(); hit = a; } });
    if(hit) save();
    return hit;
  }

  function pendingActs(){
    return load().acts.filter(function(a){ return !a.spId; });
  }

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

  function markDone(id, iso){
    var d = load();
    if(iso) d.done[id] = iso; else delete d.done[id];
    save();
  }

  function isDone(a){
    if(!a) return false;

    if(a.doneAt) return true;
    return !!load().done[a.id];
  }

  function doneAt(a){
    if(!a) return '';
    return a.doneAt || load().done[a.id] || '';
  }

  function isLocal(a){ return !!a && /^AL-/.test(a.id); }

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
    mergeActs: mergeActs, nextActId: nextActId, addAct: addAct, updateAct: updateAct,
    markDone: markDone, isDone: isDone, isLocal: isLocal, isMissed: isMissed,
    markSent: markSent, pendingActs: pendingActs, dropAct: dropAct, doneAt: doneAt,
    addReport: addReport, nextReportId: nextReportId,
    allReports: allReports, reportsFor: reportsFor
  };
})();
window.LS = LS;
