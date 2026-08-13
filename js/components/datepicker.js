(function () {
  "use strict";
  var DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  var MON_VI = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
  var MON_EN = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  function monName(m) {
    return (document.documentElement.lang === "en" ? MON_EN : MON_VI)[m];
  }
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var iso = function (y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); };
  function parseISO(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }
  function todayParts() { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }

  var openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; document.removeEventListener("keydown", onEsc, true); } }
  function onEsc(e) { if (e.key === "Escape") { closePop(); } }

  function build(input) {
    if (input.dataset.dpReady) return;
    input.dataset.dpReady = "1";

    var wrap = document.createElement("div");
    wrap.className = "dp-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dp-btn";
    btn.setAttribute("aria-label", "Mở lịch chọn ngày");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/>' +
      '<path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
    wrap.appendChild(btn);

    var view = null;

    function open() {
      if (openPop && openPop._input === input) { closePop(); return; }
      closePop();
      if (input.disabled) return;
      var sel = parseISO(input.value);
      view = sel ? { y: sel.y, m: sel.m } : (function () { var t = todayParts(); return { y: t.y, m: t.m }; })();
      var pop = document.createElement("div");
      pop.className = "dp-cal glass";
      pop._input = input;
      document.body.appendChild(pop);
      openPop = pop;
      render(pop, sel);
      place(pop, wrap);
      document.addEventListener("keydown", onEsc, true);
    }

    function render(pop, sel) {
      var first = new Date(view.y, view.m, 1);
      var startDow = (first.getDay() + 6) % 7;
      var days = new Date(view.y, view.m + 1, 0).getDate();
      var t = todayParts();
      var cells = "";
      for (var i = 0; i < startDow; i++) cells += '<span class="dp-pad"></span>';
      for (var d = 1; d <= days; d++) {
        var isToday = t.y === view.y && t.m === view.m && t.d === d;
        var isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
        cells += '<button type="button" class="dp-d' + (isSel ? " sel" : "") + (isToday ? " today" : "") +
          '" data-d="' + d + '">' + d + '</button>';
      }
      pop.innerHTML =
        '<div class="dp-head">' +
          '<span class="dp-title" data-noi18n>' + monName(view.m) + " " + view.y + "</span>" +
          '<div class="dp-nav">' +
            '<button type="button" class="dp-mv" data-mv="-1" aria-label="Tháng trước">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
            '<button type="button" class="dp-mv" data-mv="1" aria-label="Tháng sau">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
          "</div></div>" +
        '<div class="dp-dow">' + DOW.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" +
        '<div class="dp-grid">' + cells + "</div>" +
        '<div class="dp-foot">' +
          '<button type="button" class="dp-link" data-act="clear">Xoá</button>' +
          '<button type="button" class="dp-link" data-act="today">Hôm nay</button>' +
        "</div>";

      pop.querySelectorAll(".dp-mv").forEach(function (b) {
        b.onclick = function (e) {

          if (e) { e.preventDefault(); e.stopPropagation(); }
          view.m += +b.dataset.mv;
          if (view.m < 0) { view.m = 11; view.y--; }
          if (view.m > 11) { view.m = 0; view.y++; }
          render(pop, parseISO(input.value));
          place(pop, wrap);
        };
      });
      pop.querySelectorAll(".dp-d").forEach(function (b) {
        b.onclick = function () { commit(iso(view.y, view.m, +b.dataset.d)); };
      });
      pop.querySelector('[data-act="clear"]').onclick = function () { commit(""); };
      pop.querySelector('[data-act="today"]').onclick = function () {
        var t2 = todayParts(); view = { y: t2.y, m: t2.m }; commit(iso(t2.y, t2.m, t2.d));
      };
    }

    function commit(v) {
      input.value = v;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePop();
    }

    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); open(); });

    input.addEventListener("mousedown", function (e) { e.preventDefault(); });
    input.addEventListener("focus", open);
  }

  function place(pop, wrap) {
    var r = wrap.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(r.left, innerWidth - pw - 10);
    var top = r.bottom + 6;
    if (top + ph > innerHeight - 10) top = Math.max(10, r.top - ph - 6);
    pop.style.left = Math.max(10, left) + "px";
    pop.style.top = top + "px";
  }

  document.addEventListener("click", function (e) {
    if (openPop && !openPop.contains(e.target) && !e.target.closest(".dp-wrap")) closePop();
  });
  window.addEventListener("resize", closePop);

  function scan() { document.querySelectorAll('input[type="date"]').forEach(build); }
  window.FISG_DATEPICKER = { scan: scan };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
