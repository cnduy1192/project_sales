/* js/charts.js — Lớp biểu đồ cho Dashboard (Chart.js 4.5.1), nạp CUỐI.
 * 1) Bộ theme dùng chung: chữ Plus Jakarta Sans, số dạng tabular, tooltip và lưới tiết chế
 * 2) Biểu đồ mới: sản lượng (KG) theo từng mặt hàng trong Sales Funnel
 */
(function () {
  "use strict";

  const FONT = "'Plus Jakarta Sans',sans-serif";
  const INK = "#4C5364", INK3 = "#697082", LINE = "#EEF0F4";
  const NCC_COLOR = { Roquette: "#1E3A8A", IFF: "#0D9488", Kimica: "#7C3AED" };
  const EXTRA = ["#B45309", "#0B4F9E", "#DB2777", "#059669"];
  const colorOf = (n, i) => NCC_COLOR[n] || EXTRA[(i || 0) % EXTRA.length];
  const fmtN = n => (Number(n) || 0).toLocaleString("vi-VN");

  /* ---------- 1. Theme dùng chung ---------- */
  function applyTheme() {
    if (!window.Chart) return false;
    const D = Chart.defaults;
    D.font.family = FONT;
    D.font.size = 11.5;
    D.font.weight = 500;
    D.color = INK3;
    D.borderColor = LINE;
    D.animation = { duration: 620, easing: "easeOutQuart" };
    D.animations = D.animations || {};
    D.datasets = D.datasets || {};

    D.plugins = D.plugins || {};
    Object.assign(D.plugins.tooltip, {
      backgroundColor: "rgba(16,24,40,.94)",
      titleFont: { family: FONT, size: 12, weight: 700 },
      bodyFont: { family: FONT, size: 12, weight: 500 },
      padding: 11, cornerRadius: 10, boxPadding: 5,
      displayColors: true, usePointStyle: true, borderWidth: 0,
      caretSize: 6, caretPadding: 8,
    });
    if (D.plugins.legend) D.plugins.legend.labels = Object.assign(
      D.plugins.legend.labels || {}, { font: { family: FONT, size: 11.5 }, usePointStyle: true, boxWidth: 8, padding: 14 });

    // nét mềm hơn cho line & cột bo góc
    if (D.elements) {
      if (D.elements.line) { D.elements.line.tension = 0.36; D.elements.line.borderWidth = 2.4; }
      if (D.elements.point) { D.elements.point.radius = 0; D.elements.point.hoverRadius = 5; D.elements.point.hitRadius = 12; }
      if (D.elements.bar) { D.elements.bar.borderRadius = 6; D.elements.bar.borderSkipped = false; }
      if (D.elements.arc) { D.elements.arc.borderWidth = 2; D.elements.arc.borderColor = "#fff"; }
    }
    return true;
  }

  /* ---------- 2. Sản lượng theo mặt hàng ---------- */
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

    // gộp KG theo mặt hàng, giữ NCC chiếm ưu thế để tô màu
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

    const nccList = [...new Set(top.map(t => t.ncc))];
    const chart = new Chart(cv, {
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
        layout: { padding: { right: 14 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: c => top[c[0].dataIndex].product,
              label: c => "  " + fmtN(c.parsed.x) + " KG",
              afterLabel: c => "  " + top[c.dataIndex].ncc + " · " + top[c.dataIndex].n + " dự án",
            },
          },
        },
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
  }

  /* ---------- gắn vào vòng đời ---------- */
  function wrap(name, fn) {
    const o = window[name];
    if (typeof o !== "function") return;
    window[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) {} return r; };
  }
  function boot() {
    if (!applyTheme()) setTimeout(applyTheme, 400);       // Chart.js tải từ CDN
    wrap("renderDash", () => {
      const on = document.querySelector("#volSwitch .vol-tab.on");
      render(on ? on.dataset.y : "kgThis");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FISG_CHARTS = { applyTheme, renderVolume: render };
})();
