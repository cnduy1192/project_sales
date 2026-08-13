var WD_VI = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

function weekBounds(iso){
  var d = new Date(normDate(iso) || todayISO());
  var dow = d.getDay();
  var back = (dow === 0) ? 6 : dow - 1;
  var s = new Date(d.getTime()); s.setDate(s.getDate() - back);
  var e = new Date(s.getTime()); e.setDate(e.getDate() + 6);
  var start = isoOf(s), end = isoOf(e);
  return {
    start: start, end: end,
    label: start.slice(8,10)+'/'+start.slice(5,7)+' – '+end.slice(8,10)+'/'+end.slice(5,7)+'/'+end.slice(0,4)
  };
}
function thisWeek(){ return weekBounds(todayISO()); }

function dayMode(iso){
  var dow = new Date(normDate(iso) || todayISO()).getDay();
  if(dow === 1) return 'start';
  if(dow >= 2 && dow <= 4) return 'mid';
  return 'end';
}
function dayLabelVI(iso){ return WD_VI[new Date(normDate(iso)).getDay()]; }

function dayStampVI(iso){
  var d = normDate(iso) || todayISO();
  return dayLabelVI(d) + ', ngày ' + d.slice(8,10) + '/' + d.slice(5,7) + '/' + d.slice(0,4);
}

function userByName(pic){
  var K = picKey(pic);
  if(!K || typeof USERS === 'undefined') return null;
  return USERS.filter(function(x){
    return (typeof nameSetOf === 'function' ? nameSetOf(x) : [x.pic])
      .some(function(n){ return picKey(n) === K; });
  })[0] || null;
}
function scopeKindFor(pic){
  var u = userByName(pic);
  var k = (u && typeof cap === 'function') ? cap(u.role).scope : 'own-pic';
  return k === 'own-rnd' ? 'own-rnd' : 'own-pic';
}
function myScope(pic, kind){
  var K = picKey(pic);
  if(!K) return { key:'', records:[], acts:[] };
  kind = kind || scopeKindFor(pic);
  var u = userByName(pic);
  var mine = function(v){
    if(!v) return false;
    if(picKey(v) === K) return true;
    return !!(u && typeof isMine === 'function' && isMine(v, u));
  };
  var records = RECORDS.filter(function(r){
    if(kind === 'own-rnd') return mine(r.rnd);
    return mine(r.pic) || (r.related||[]).some(mine);
  });
  var ids = {}; records.forEach(function(r){ ids[r.id] = 1; });
  var acts = ACTIVITIES.filter(function(a){

    return mine(a.pic) || (a.related||[]).some(mine) || (a.projectId && ids[a.projectId]);
  });
  return { key:K, records:records, acts:acts };
}

function lastTouchMap(scope){
  var m = {};
  var bump = function(k, iso){ if(iso && (!m[k] || iso > m[k])) m[k] = iso; };
  scope.records.forEach(function(r){
    var k = custKey(r.customer);
    (r.updates||[]).forEach(function(u){ bump(k, normDate(u.at)); });
  });
  scope.acts.forEach(function(a){ bump(custKey(a.customer), normDate(a.date)); });
  return m;
}

function buildMyWeek(pic, weekStart){
  var w = weekBounds(weekStart || todayISO());
  var scope = myScope(pic);
  var T = todayISO();
  var inWeek = function(iso){ return !!iso && iso >= w.start && iso <= w.end; };

  var today = [], planned = [], done = [], missed = [];
  scope.acts.forEach(function(a){
    var iso = normDate(a.date);
    if(!inWeek(iso)) return;
    if(LS.isMissed(a)) missed.push(a);
    else if(iso === T) today.push(a);
    else if(iso > T) planned.push(a);
    else if(LS.isDone(a)) done.push(a);
  });
  var byDate = function(x,y){ return normDate(x.date) < normDate(y.date) ? -1 : 1; };
  today.sort(byDate); planned.sort(byDate); done.sort(byDate); missed.sort(byDate);

  var changes = [];
  scope.records.forEach(function(r){
    var base = { projectId:r.id, customer:r.customer, custLabel:custLabel(r.customer),
                 product:r.product, ncc:r.ncc, segment:r.segment, stage:r.stage };
    (r.updates||[]).forEach(function(u){
      var iso = normDate(u.at);
      if(inWeek(iso)) changes.push(Object.assign({}, base, { ts:iso, kind:'update', text:u.text||'' }));
    });
    var c = normDate(r.created);
    if(inWeek(c)) changes.push(Object.assign({}, base, { ts:c, kind:'new', text:r.desc||'' }));
    if(r.status !== 'IN PROGRESS'){
      var cs = closeStamp(r);
      if(cs && inWeek(cs.ts))
        changes.push(Object.assign({}, base, { ts:cs.ts, kind:'close', status:r.status, inferred:cs.inferred,
          text:(r.comments||[]).slice(-1)[0] ? r.comments[r.comments.length-1].text : '' }));
    }
  });
  changes.sort(function(a,b){ return a.ts < b.ts ? 1 : -1; });

  var open = scope.records.filter(function(r){ return r.status === 'IN PROGRESS'; });
  var overdue = open.filter(function(r){ return r.closing && normDate(r.closing) < T; });

  return {
    pic: pic, picLabel: picLabel(pic), start: w.start, end: w.end, label: w.label,
    today: today, planned: planned, done: done, missed: missed,
    projectChanges: changes,
    stats: {
      planned: planned.length + today.length,
      done: done.length,
      missed: missed.length,
      changes: changes.length,
      overdue: overdue.length,
      open: open.length,
      newProjects: changes.filter(function(c){ return c.kind === 'new'; }).length,
      won: changes.filter(function(c){ return c.kind === 'close' && c.status === 'WON'; }).length,
      lost: changes.filter(function(c){ return c.kind === 'close' && c.status === 'LOST'; }).length
    }
  };
}

var SUGGEST_LIMIT = 5;

function suggestWork(pic, limit){
  limit = limit || SUGGEST_LIMIT;
  var scope = myScope(pic);
  if(!scope.key) return [];
  var T = todayISO(), w = thisWeek();
  var touch = lastTouchMap(scope);
  var best = {};

  var offer = function(k, s){
    if(!best[k] || s.score > best[k].score) best[k] = s;
  };

  scope.records.filter(function(r){ return r.status === 'IN PROGRESS'; }).forEach(function(r){
    var k = custKey(r.customer);
    var base = {
      key: r.id, custKey: k, custLabel: custLabel(r.customer), projectId: r.id,
      product: r.product, segment: r.segment, ncc: r.ncc, kg: r.kgThis || 0
    };
    var closing = normDate(r.closing);
    if(closing && closing < T){
      var late = daysSince(closing);
      offer(k, Object.assign({}, base, { score: 100 + late, action:'update',
        reason: 'Quá hạn ngày đóng ' + late + ' ngày' }));
    } else if(closing){
      var left = -daysSince(closing);
      if(left <= 30) offer(k, Object.assign({}, base, { score: 60 + (30 - left), action:'schedule',
        reason: 'Đóng dự kiến sau ' + left + ' ngày' }));
    }
    var ups = (r.updates||[]).map(function(u){ return normDate(u.at); }).filter(Boolean).sort();
    var lastUp = ups.length ? ups[ups.length-1] : null;
    var age = lastUp ? daysSince(lastUp) : 999;
    offer(k, Object.assign({}, base, { score: 20 + age/10, action:'update',
      reason: lastUp ? 'Chưa cập nhật ' + age + ' ngày' : 'Chưa có cập nhật nào' }));
  });

  Object.keys(touch).forEach(function(k){
    var silent = daysSince(touch[k]);
    if(silent < 21) return;
    var r = scope.records.filter(function(x){ return custKey(x.customer) === k && x.status === 'IN PROGRESS'; })[0];
    offer(k, {
      key: 'C-' + k, custKey: k, custLabel: custLabel(k),
      projectId: r ? r.id : null, product: r ? r.product : null,
      segment: r ? r.segment : null, ncc: r ? r.ncc : null, kg: r ? (r.kgThis||0) : 0,
      score: 30 + silent/10, action:'schedule',
      reason: 'Im lặng ' + silent + ' ngày'
    });
  });

  var booked = {};
  scope.acts.forEach(function(a){
    var iso = normDate(a.date);
    if(iso && iso >= w.start && iso <= w.end) booked[custKey(a.customer)] = 1;
  });

  return Object.keys(best)
    .map(function(k){ return best[k]; })
    .filter(function(s){ return !booked[s.custKey]; })
    .sort(function(a,b){
      return b.score - a.score || b.kg - a.kg || (a.custLabel < b.custLabel ? -1 : 1);
    })
    .slice(0, limit);
}

function buildReport(pic, weekStart){
  var mw = buildMyWeek(pic, weekStart);
  var lite = function(a){
    return { id:a.id, date:normDate(a.date), type:a.type, customer:a.customer,
             custLabel:custLabel(a.customer), ncc:a.ncc, note:a.note||'', next:a.next||'' };
  };
  return {
    id: LS.nextReportId(),
    pic: pic, picLabel: picLabel(pic),
    weekStart: mw.start, weekEnd: mw.end, weekLabel: mw.label,
    createdAt: todayISO(),
    stats: mw.stats,
    doneActs: mw.done.concat(mw.today.filter(LS.isDone)).map(lite),
    missedActs: mw.missed.map(lite),
    plannedActs: mw.planned.map(lite),
    projectChanges: mw.projectChanges.slice(0, 50),
    note: '',
    to: []
  };
}

function reportCharts(report, pic){
  var byType = {};
  report.doneActs.forEach(function(a){ byType[a.type||'Khác'] = (byType[a.type||'Khác']||0) + 1; });

  var byStage = {};
  myScope(pic).records.filter(function(r){ return r.status === 'IN PROGRESS'; })
    .forEach(function(r){
      var g = STAGE_GROUP[r.stage] || 'Khác';
      byStage[g] = (byStage[g]||0) + 1;
    });

  return {
    actsByType: Object.keys(byType).map(function(k){ return { label:k, value:byType[k] }; }),
    openByStage: Object.keys(byStage).map(function(k){ return { label:k, value:byStage[k] }; })
  };
}

function weeklyAssert(pic){
  pic = pic || (me && me.pic) || 'Thu';
  var out = [];
  var t = function(name, ok, detail){ out.push(ok); console.log((ok?'✓':'✗')+' '+name+' — '+detail); };

  var a = weekBounds('2026-07-07');
  t('mốc tuần thứ Ba', a.start === '2026-07-06' && a.end === '2026-07-12', a.start+' → '+a.end);

  var b = weekBounds('2027-01-01');
  t('mốc tuần qua giao thừa', b.start === '2026-12-28' && b.end === '2027-01-03', b.start+' → '+b.end);

  var c = weekBounds('2026-07-12');
  t('Chủ Nhật thuộc tuần trước đó', c.start === '2026-07-06', c.start+' → '+c.end);

  var modes = ['2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11','2026-07-12'].map(dayMode);
  t('ánh xạ chế độ theo thứ (T2→CN)',
    modes.join(',') === 'start,mid,mid,mid,end,end,end', modes.join(','));

  var w = thisWeek(), mw = buildMyWeek(pic, w.start);
  var all = mw.today.concat(mw.planned, mw.done, mw.missed);
  t('không có bản ghi ngoài tuần',
    all.every(function(x){ var d = normDate(x.date); return d >= mw.start && d <= mw.end; }),
    all.length + ' hoạt động trong ' + mw.label);

  var sg = suggestWork(pic, 5);
  var keys = sg.map(function(s){ return s.custKey; });
  t('đề xuất tối đa 5, không trùng khách',
    sg.length <= 5 && keys.length === new Set(keys).size, sg.length + ' mục');
  t('điểm giảm dần, hoà thì KG lớn trước',
    sg.every(function(s,i){ return i === 0 || sg[i-1].score > s.score
      || (sg[i-1].score === s.score && sg[i-1].kg >= s.kg); }),
    sg.map(function(s){ return Math.round(s.score)+'/'+s.kg+'kg'; }).join(' ≥ '));

  var booked = {};
  myScope(pic).acts.forEach(function(x){
    var d = normDate(x.date);
    if(d >= w.start && d <= w.end) booked[custKey(x.customer)] = 1;
  });
  t('khách đã có lịch tuần này bị loại',
    sg.every(function(s){ return !booked[s.custKey]; }),
    Object.keys(booked).length + ' khách đã có lịch');

  console.log('\nViệc nên làm:');
  sg.forEach(function(s){
    console.log('  ' + s.custLabel + ' — ' + s.reason + ' · ' + (s.kg||0).toLocaleString('vi-VN') + ' KG');
  });
  return out.every(Boolean);
}
window.weeklyAssert = weeklyAssert;
