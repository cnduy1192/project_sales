/* js/lib/navstack.js — đường về khi người dùng mở sâu thêm một cấp.
   Mọi modal trong app đều là lớp phủ trên một bảng chủ. Vấn đề không phải là
   modal che mất bảng — đóng ra là bảng hiện lại — mà là người dùng KHÔNG BIẾT
   mình sẽ rơi về đâu, và hai đường đi bị đứt hẳn:
     · popup Tổng quan tuần tự đóng khi mở dự án, không có đường quay lại;
     · modal "Đóng dự án" gọi closeDetail() nên dự án biến mất khỏi ngăn xếp.

   Ngăn xếp này giữ mô tả của lớp NGAY DƯỚI modal đang mở: nhãn để hiển thị, và
   hàm khôi phục nếu lớp đó đã bị che đi. */

var NAV = (function(){
  var stack = [];

  var VIEW_LABEL = {
    cockpit: 'Tổng quan điều hành',
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

  /* Gọi NGAY TRƯỚC khi mở một modal. Tự nhận ra lớp hiện tại là gì:
     popup toàn màn hình thì che đi và nhớ đường về; ngăn kéo Cockpit nằm dưới
     modal nên để nguyên, chỉ ghi nhãn; còn lại là bảng chủ của view. */
  function enter(explicit){
    if(explicit){ stack.push(explicit); return; }

    if(typeof wcIsOpen === 'function' && wcIsOpen()){
      stack.push({ label:'Tổng quan tuần', restore: window.openWelcome });
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
  /* Lấy lớp ra mà KHÔNG khôi phục — dùng cho hành động dứt điểm, khi không muốn
     quay lại modal trung gian. */
  function popRaw(){ return stack.pop() || null; }
  function depth(){ return stack.length; }

  /* Đóng modal hiện tại rồi trả người dùng về lớp dưới. */
  function back(closeFn){
    var origin = stack.pop() || null;
    if(typeof closeFn === 'function') closeFn();
    if(origin && typeof origin.restore === 'function') origin.restore();
    return origin;
  }

  /* Xong một hành động dứt điểm (đóng dự án, lưu xong): bỏ lớp trung gian và
     về thẳng bảng chủ thay vì quay lại modal vừa thao tác. */
  function drop(n){
    n = n || 1;
    while(n-- > 0 && stack.length) stack.pop();
  }
  function clear(){ stack = []; }

  /* Vẽ chip đường về vào đầu modal. Không có lớp dưới thì ẩn hẳn — không hiện
     một nút vô nghĩa. */
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
