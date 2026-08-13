(function () {
  "use strict";

  const FONT = "'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif";
  const INK = "#4C5364", INK3 = "#697082", LINE = "#EEF0F4";
  const NCC_COLOR = { Roquette: "#1E3A8A", IFF: "#0D9488", Kimica: "#7C3AED" };
  const EXTRA = ["#B45309", "#0B4F9E", "#DB2777", "#059669"];
  const colorOf = (n, i) => NCC_COLOR[n] || EXTRA[(i || 0) % EXTRA.length];
  const fmtN = n => (Number(n) || 0).toLocaleString("vi-VN");

  function applyTheme() {
    if (!window.Chart) return false;
    const D = Chart.defaults;
    D.font.family = FONT;
    D.font.size = 11.5;
    D.font.weight = 500;
    D.color = INK3;
    D.borderColor = LINE;

    if (D.animation) { D.animation.duration = 620; D.animation.easing = "easeOutQuart"; }
    D.animations = D.animations || {};
    D.datasets = D.datasets || {};

    D.plugins = D.plugins || {};

    if (D.plugins.tooltip) D.plugins.tooltip.enabled = false;
    if (D.plugins.legend) D.plugins.legend.labels = Object.assign(
      D.plugins.legend.labels || {}, { font: { family: FONT, size: 11.5 }, usePointStyle: true, boxWidth: 8, padding: 14 });

    if (D.elements) {
      if (D.elements.line) { D.elements.line.tension = 0.36; D.elements.line.borderWidth = 2.4; }
      if (D.elements.point) { D.elements.point.radius = 0; D.elements.point.hoverRadius = 5; D.elements.point.hitRadius = 12; }
      if (D.elements.bar) { D.elements.bar.borderRadius = 6; D.elements.bar.borderSkipped = false; }
      if (D.elements.arc) { D.elements.arc.borderWidth = 2; D.elements.arc.borderColor = "#fff"; }
    }
    return true;
  }

  function ensureCard() {
    const grid = document.querySelector("#view-dash .dash-grid");
    if (!grid || document.getElementById("volBox")) return;
    const card = document.createElement("div");
    card.className = "card glass span2 vol-card";
    card.innerHTML =
      '<h4>Sản lượng theo mặt hàng<small id="volSub"></small></h4>' +
      '<div class="vol-switch" id="volSwitch" role="group" aria-label="Chọn năm">' +
        '<button type="button" class="vol-tab on" data-y="kgThis">KG 2026</button>' +
        '<button type="button" class="vol-tab" data-y="kgNext">KG 2027</button>' +
      "</div>" +
      '<div class="vol-box"><canvas id="volBox" height="300"></canvas>' +
        '<div class="vol-state" id="volState" role="status"></div></div>';
    grid.appendChild(card);
    card.querySelectorAll(".vol-tab").forEach(b => {
      b.onclick = () => {
        card.querySelectorAll(".vol-tab").forEach(x => x.classList.toggle("on", x === b));
        render(b.dataset.y);
      };
    });
  }

  function render(field) {
    ensureCard();
    const cv = document.getElementById("volBox");
    if (!cv || !window.Chart) return;
    field = field || "kgThis";
    const data = ((typeof visible === "function" ? visible() : (window.RECORDS || [])) || [])
      .filter(r => r.status === "IN PROGRESS" || r.status === "WON");

    const by = {};
    data.forEach(r => {
      const p = r.product || "—";
      if (!by[p]) by[p] = { kg: 0, n: 0, ncc: {} };
      by[p].kg += Number(r[field]) || 0;
      by[p].n += 1;
      by[p].ncc[r.ncc] = (by[p].ncc[r.ncc] || 0) + 1;
    });
    const top = Object.keys(by).map(p => ({
      product: p, kg: by[p].kg, n: by[p].n,
      ncc: Object.keys(by[p].ncc).sort((a, b) => by[p].ncc[b] - by[p].ncc[a])[0] || "",
    })).filter(x => x.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, 12);

    const sub = document.getElementById("volSub");
    if (sub) sub.textContent = top.length
      ? "Dự án đang chạy + thắng · tổng " + fmtN(top.reduce((s, x) => s + x.kg, 0)) + " KG"
      : "Chưa có khối lượng từ dự án đang chạy hoặc thắng";

    if (window.dc) window.dc("volume");
    const state = document.getElementById("volState");
    if (!top.length) {
      cv.style.visibility = "hidden";
      if (state) { state.textContent = "NCC này chưa có khối lượng từ dự án đang chạy hoặc đã thắng."; state.classList.add("show"); }
      return;
    }
    cv.style.visibility = "visible";
    if (state) state.classList.remove("show");

    try {
    const nccList = [...new Set(top.map(t => t.ncc))];
    const valueLabels = {
      id: "fisgValueLabels",
      afterDatasetsDraw(c) {
        const meta = c.getDatasetMeta(0);
        if (!meta || !meta.data) return;
        const ctx = c.ctx;
        ctx.save();
        ctx.font = '600 10.5px ' + FONT;
        ctx.fillStyle = INK3;
        ctx.textBaseline = "middle";
        meta.data.forEach((bar, i) => {
          const v = c.data.datasets[0].data[i];
          if (v == null) return;
          ctx.fillText(fmtN(v), bar.x + 8, bar.y);
        });
        ctx.restore();
      },
    };
    const chart = new Chart(cv, {
      plugins: [valueLabels],
      type: "bar",
      data: {
        labels: top.map(t => t.product.length > 26 ? t.product.slice(0, 25) + "…" : t.product),
        datasets: [{
          label: "KG",
          data: top.map(t => t.kg),
          backgroundColor: top.map(t => colorOf(t.ncc, nccList.indexOf(t.ncc))),
          hoverBackgroundColor: top.map(t => colorOf(t.ncc, nccList.indexOf(t.ncc))),
          borderRadius: 7, borderSkipped: false, barThickness: 16, maxBarThickness: 20,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 650, easing: "easeOutQuart" },
        interaction: { mode: "nearest", axis: "y", intersect: false },
        layout: { padding: { right: 64 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: LINE, drawTicks: false },
            border: { display: false },
            ticks: { padding: 6, callback: v => v >= 1000 ? (v / 1000) + "K" : v },
          },
          y: {
            grid: { display: false }, border: { display: false },
            ticks: { padding: 8, font: { family: FONT, size: 11, weight: 600 }, color: INK },
          },
        },
        onClick: (e, els) => {
          if (!els.length || !window.toast) return;
          const t = top[els[0].index];
          toast(t.product + ": " + fmtN(t.kg) + " KG · " + t.n + " dự án");
        },
      },
    });
    if (window.rc) window.rc("volume", chart);
    } catch (e) {
      console.error("[charts] render volume", e);
      cv.style.visibility = "hidden";
      if (state) { state.textContent = "Không thể hiển thị biểu đồ khối lượng. Vui lòng thử lại."; state.classList.add("show"); }
    }
  }

  function wrap(name, fn) {
    const o = window[name];
    if (typeof o !== "function") return;
    window[name] = function () {
      let r;
      try { r = o.apply(this, arguments); } catch (e) { console.error("[charts] dashboard update", e); }
      try { fn(); } catch (e) { console.error("[charts] extension update", e); }
      return r;
    };
  }

  function repaintWhenFontReady() {
    if (!document.fonts || !document.fonts.ready) return;
    document.fonts.ready.then(() => {
      applyTheme();
      if (!window.Chart || !Chart.instances) return;
      Object.keys(Chart.instances).forEach(k => {
        try { Chart.instances[k].update("none"); } catch (e) {}
      });
    }).catch(() => {});
  }

  function boot() {
    if (!applyTheme()) setTimeout(applyTheme, 400);
    repaintWhenFontReady();
    wrap("renderDash", () => {
      const on = document.querySelector("#volSwitch .vol-tab.on");
      render(on ? on.dataset.y : "kgThis");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FISG_CHARTS = { applyTheme, renderVolume: render };
})();
