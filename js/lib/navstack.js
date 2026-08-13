var NAV = (function(){
  var stack = [];

  var VIEW_LABEL = {
    cockpit: 'Tổng quan',
    funnel:  'Sales Funnel',
    acts:    'Hoạt động khách hàng',
    dash:    'Dashboard',
    reports: 'Báo cáo',
    users:   'Người dùng & phân quyền'
  };

  function currentViewId(){
    var list = (typeof VIEWS !== 'undefined') ? VIEWS : ['funnel'];
    for(var i = 0; i < list.length; i++){
      var el = document.getElementById('view-' + list[i]);
      if(el && el.style.display !== 'none') return list[i];
    }
    return 'funnel';
  }
  function currentViewLabel(){ return VIEW_LABEL[currentViewId()] || 'Sales Funnel'; }

  function enter(explicit){
    if(explicit){ stack.push(explicit); return; }

    if(typeof wcIsOpen === 'function' && wcIsOpen()){
      stack.push({ label:'Kế hoạch tuần', restore: window.openWelcome });
      closeWelcome();
      return;
    }

    var drawer = document.getElementById('ckDrawer');
    if(drawer && drawer.classList.contains('open') && typeof ckCust !== 'undefined' && ckCust){
      var key = ckCust;
      stack.push({ label: custLabel(key), restore: null });
      return;
    }

    stack.push({ label: currentViewLabel(), restore: null });
  }

  function top(){ return stack.length ? stack[stack.length-1] : null; }

  function popRaw(){ return stack.pop() || null; }
  function depth(){ return stack.length; }

  function back(closeFn){
    var origin = stack.pop() || null;
    if(typeof closeFn === 'function') closeFn();
    if(origin && typeof origin.restore === 'function') origin.restore();
    return origin;
  }

  function drop(n){
    n = n || 1;
    while(n-- > 0 && stack.length) stack.pop();
  }
  function clear(){ stack = []; }

  function renderBack(btnId){
    var btn = document.getElementById(btnId);
    if(!btn) return;
    var o = top();
    if(!o){ btn.classList.remove('on'); return; }
    btn.querySelector('span').textContent = o.label;
    btn.setAttribute('aria-label', 'Quay lại ' + o.label);
    btn.classList.add('on');
  }

  return { enter:enter, back:back, top:top, popRaw:popRaw, depth:depth, drop:drop, clear:clear,
           renderBack:renderBack, currentViewLabel:currentViewLabel };
})();
window.NAV = NAV;
