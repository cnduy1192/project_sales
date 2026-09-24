(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s)
    .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtN = n => (Number(n) || 0).toLocaleString(I18N.locale());
  const viDay = d => d ? new Date(d).toLocaleDateString(I18N.locale()) : "—";
  const NCC_COLOR = { Roquette: "#1E3A8A", IFF: "#0D9488", Kimica: "#7C3AED" };
  const EXTRA_COLORS = ["#B45309", "#0B4F9E", "#DB2777", "#059669", "#9333EA"];
  const colorOf = (n, i) => NCC_COLOR[n] || EXTRA_COLORS[i % EXTRA_COLORS.length];

  const LS_KEY = "fisg_custom_nccs";
  const loadCustom = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } };
  const saveCustom = a => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {} };

  const normNcc = n => String(n == null ? "" : n).trim();
  const keyNcc = n => normNcc(n).toLowerCase();

  function dedupeNccs() {
    if (typeof LISTS === "undefined" || !Array.isArray(LISTS.nccs)) return;

    if (window.dedupeNccs) window.dedupeNccs();

    const custom = loadCustom(), kept = new Set(), keep = [];
    custom.forEach(x => {
      const k = keyNcc(x && x.name);
      if (!k || kept.has(k)) return;
      kept.add(k); keep.push(x);
    });
    if (keep.length !== custom.length) saveCustom(keep);
    if (typeof nccFilter !== "undefined" && nccFilter && !LISTS.nccs.includes(nccFilter)) {
      const match = LISTS.nccs.filter(n => keyNcc(n) === keyNcc(nccFilter))[0];
      if (match && window.setNcc) setNcc(match);
    }
  }

  function applySupplier(rawName, stages, probs, groups) {
    if (typeof LISTS === "undefined") return;
    const name = normNcc(rawName);
    if (!name) return;
    if (!LISTS.nccs.some(n => keyNcc(n) === keyNcc(name))) LISTS.nccs.push(name);
    LISTS.pipelines[name] = stages.slice();
    stages.forEach(s => {
      if (groups && groups[s] && !LISTS.groupOf[s]) LISTS.groupOf[s] = groups[s];
      if (probs && probs[s] != null && LISTS.probOf[s] == null) LISTS.probOf[s] = probs[s];
    });
  }

  function restoreCustom() {
    loadCustom().forEach(s => applySupplier(s.name, s.stages, s.probs, s.groups));
  }

  function rebuildTabs() {
    const box = document.getElementById("nccTabs");
    if (!box || typeof LISTS === "undefined") return;
    dedupeNccs();
    const all = typeof ALL_NCC !== "undefined" ? ALL_NCC : "*";
    const cur = typeof nccFilter !== "undefined" ? nccFilter : "";
    box.innerHTML =
      '<button class="ncc-tab ncc-tab-all' + (cur === all ? " on" : "") +
      '" data-ncc="' + all + '" onclick="setNcc(\'' + all + '\')"' +
      ' title="' + esc(T("hdr.allSuppliersHint")) + '">' + esc(T("common.all")) + '</button>' +
      LISTS.nccs.map(n =>
      '<button class="ncc-tab' + (n === (typeof nccFilter !== "undefined" ? nccFilter : "") ? " on" : "") +
      '" data-ncc="' + esc(n) + '" onclick="setNcc(\'' + esc(n).replace(/'/g, "\\'") + '\')">' + esc(n) + '</button>').join("");
    addSupplierButton();
  }

  function addSupplierButton() {
    const box = document.getElementById("nccTabs");
    if (!box || document.getElementById("btnAddNcc")) return;
    const b = document.createElement("button");
    b.id = "btnAddNcc"; b.type = "button"; b.className = "ncc-add";
    b.title = T("ex.addSupplier"); b.setAttribute("aria-label", T("ex.addSupplier"));
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    b.onclick = openSupplierModal;
    box.parentNode.insertBefore(b, box.nextSibling);
  }

  function openSupplierModal() {
    let ov = document.getElementById("nccOv");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "nccOv"; ov.className = "x-ov";
      ov.innerHTML = '<div class="x-modal glass" role="dialog" aria-modal="true" aria-labelledby="nccT">' +
        '<div class="x-head"><h3 id="nccT">' + esc(T("ex.addSupplier")) + '</h3>' +
        '<button class="x-close" id="nccX" type="button" aria-label="' + esc(T("common.close")) + '">×</button></div>' +
        '<div class="x-body" id="nccBody"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("open"); });
      document.getElementById("nccX").onclick = () => ov.classList.remove("open");
    }
    ov.classList.add("open");

    const existing = (typeof LISTS !== "undefined" ? LISTS.nccs : []).slice();
    const body = document.getElementById("nccBody");
    body.innerHTML =
      '<label class="x-f"><span>' + esc(T("ex.supplierName")) + '</span>' +
        '<input id="nccName" autocomplete="off" spellcheck="false"></label>' +
      '<div class="x-sec-h">' + esc(T("ex.pickPipeline")) + '</div>' +
      '<div class="ncc-tpls" id="nccTpls">' +
        existing.map((n, i) => {
          const st = (LISTS.pipelines[n] || []);
          return '<button type="button" class="ncc-tpl" data-src="' + esc(n) + '" ' +
            'style="--tc:' + colorOf(n, i) + '">' +
            '<span class="tpl-head"><b>' + esc(n) + '</b><small>' + esc(T("ex.nStages", { n: st.length })) + '</small></span>' +
            '<span class="tpl-stages">' + st.map((s, j) =>
              '<span class="tpl-stage"><i>' + (j + 1) + '</i>' + esc(s) + '</span>').join("") +
            '</span></button>';
        }).join("") +
      '</div>' +
      '<p class="x-msg" id="nccMsg" role="alert" aria-live="polite"></p>' +
      '<div class="x-actions">' +
        '<button type="button" class="x-btn ghost" id="nccCancel">' + esc(T("common.cancel")) + '</button>' +
        '<button type="button" class="x-btn primary" id="nccSave">' + esc(T("common.add")) + '</button>' +
      '</div>';

    let picked = existing[0] || "";
    const paint = () => body.querySelectorAll(".ncc-tpl").forEach(t =>
      t.classList.toggle("on", t.dataset.src === picked));
    body.querySelectorAll(".ncc-tpl").forEach(t => t.onclick = () => { picked = t.dataset.src; paint(); });
    paint();
    document.getElementById("nccCancel").onclick = () => ov.classList.remove("open");
    document.getElementById("nccSave").onclick = () => {
      const msg = document.getElementById("nccMsg");
      const name = (document.getElementById("nccName").value || "").trim();
      if (!name) { msg.textContent = T("ex.err.name"); msg.className = "x-msg err"; return; }
      if (LISTS.nccs.some(n => n.toLowerCase() === name.toLowerCase())) {
        msg.textContent = T("ex.err.dup"); msg.className = "x-msg err"; return;
      }
      if (!picked) { msg.textContent = T("ex.err.pipeline"); msg.className = "x-msg err"; return; }
      const stages = (LISTS.pipelines[picked] || []).slice();
      const probs = {}, groups = {};
      stages.forEach(s => { probs[s] = LISTS.probOf[s]; groups[s] = LISTS.groupOf[s]; });
      applySupplier(name, stages, probs, groups);
      const arr = loadCustom(); arr.push({ name, stages, probs, groups, from: picked }); saveCustom(arr);
      rebuildTabs();
      if (window.setNcc) setNcc(name);
      if (window.buildForm) try { buildForm(); } catch (e) {}
      ov.classList.remove("open");
      if (window.toast) toast(T("ex.msg.added", { n: name, p: picked }));
    };
  }

  function customerModal(cust) {
    let ov = document.getElementById("custOv");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "custOv"; ov.className = "x-ov";
      ov.innerHTML = '<div class="x-modal wide glass" role="dialog" aria-modal="true" aria-labelledby="custT">' +
        '<div class="x-head"><h3 id="custT"></h3>' +
        '<button class="x-close" id="custX" type="button" aria-label="' + esc(T("common.close")) + '">×</button></div>' +
        '<div class="x-body" id="custBody"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("open"); });
      document.getElementById("custX").onclick = () => ov.classList.remove("open");
    }
    ov.classList.add("open");

    const allR = typeof RECORDS !== "undefined" ? RECORDS : [];
    const allA = typeof ACTIVITIES !== "undefined" ? ACTIVITIES : [];
    const meNow = typeof me !== "undefined" ? me : null;
    const okR = typeof scopeRecords === "function" ? scopeRecords(allR, meNow) : allR;
    const okA = typeof scopeActs === "function" ? scopeActs(allA, meNow, okR) : allA;
    const prj = okR.filter(r => r.customer === cust);
    const acts = okA.filter(a => a.customer === cust);
    const run = prj.filter(r => r.status === "IN PROGRESS").length;
    const won = prj.filter(r => r.status === "WON").length;
    const lost = prj.filter(r => r.status === "LOST").length;
    const kg = prj.reduce((s, r) => s + (r.kgThis || 0), 0);
    const nccs = [...new Set(prj.map(r => r.ncc).concat(acts.map(a => a.ncc)).filter(Boolean))];

    document.getElementById("custT").innerHTML = esc(cust) +
      '<span class="cust-chips">' + nccs.map((n, i) =>
        '<span class="cust-chip" style="--c:' + colorOf(n, i) + '">' + esc(n) + "</span>").join("") + "</span>";

    document.getElementById("custBody").innerHTML =
      '<div class="cust-kpis">' +
        '<div class="cust-kpi"><b>' + prj.length + "</b><span>" + T("db.oppsLower") + "</span></div>" +
        '<div class="cust-kpi run"><b>' + run + "</b><span>" + T("cu.openLower") + "</span></div>" +
        '<div class="cust-kpi won"><b>' + won + "</b><span>" + T("ex.wonLower") + "</span></div>" +
        '<div class="cust-kpi lost"><b>' + lost + "</b><span>" + T("ex.lostLower") + "</span></div>" +
        '<div class="cust-kpi kg"><b>' + fmtN(kg) + "</b><span>KG 2026</span></div>" +
      "</div>" +
      '<div class="x-sec-h">' + T("ex.accountOpps") + '</div>' +
      (prj.length
        ? '<div class="cust-tbl"><table><thead><tr><th>' + T("ex.id") + '</th><th>' + T("common.product") + '</th><th>' + T("common.stage") + '</th>' +
          "<th>" + T("common.status") + "</th><th>KG</th><th>" + T("common.owner") + "</th></tr></thead><tbody>" +
          prj.map(r => '<tr data-open="' + esc(r.id) + '"><td><b>' + esc(r.id) + "</b></td><td>" +
            esc(r.product) + "</td><td>" + esc(r.stage) + '</td><td><span class="st st-' +
            (r.status === "WON" ? "won" : r.status === "LOST" ? "lost" : "run") + '">' +
            esc((typeof STATUS_VI !== "undefined" && STATUS_VI[r.status]) || r.status) + "</span></td><td>" + fmtN(r.kgThis) + "</td><td>" + esc(r.pic) + "</td></tr>").join("") +
          "</tbody></table></div>"
        : '<div class="x-empty">' + T("ex.noOpps") + '</div>') +
      '<div class="x-sec-h">' + T("ex.actHistory", { n: acts.length }) + "</div>" +
      (acts.length
        ? '<ol class="cust-tl">' + acts.slice()
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map(a => '<li><span class="tl-d">' + viDay(a.date) + '</span><span class="tl-b">' +
              '<span class="tl-head"><span class="tl-type">' + esc(window.actTypeText ? actTypeText(a.type) : (a.type || '—')) + '</span>' +
              (a.pic ? '<span class="tl-pic">' + esc(a.pic) + '</span>' : '') + '</span>' +
              (a.note ? '<span class="tl-note">' + esc(a.note) + "</span>" : "") +
              (a.next ? '<span class="tl-next">→ ' + esc(a.next) + "</span>" : "") +
              "</span></li>").join("") + "</ol>"
        : '<div class="x-empty">' + T("act.empty") + '</div>');

    document.getElementById("custBody").querySelectorAll("[data-open]").forEach(tr => {
      tr.onclick = () => {
        ov.classList.remove("open");
        if (window.openDetail) openDetail(tr.dataset.open);
      };
    });
  }

  function wireActivityClicks() {
    const box = document.getElementById("actRows");
    if (!box || box.dataset.custReady) return;
    box.dataset.custReady = "1";
    box.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      const row = e.target.closest(".act-row");
      if (!row) return;
      const name = (row.querySelector("b") || {}).textContent;
      if (name) customerModal(name.trim());
    });
    box.classList.add("act-clickable");
  }

  function segCard() {
    const grid = document.querySelector("#view-dash .dash-grid");
    if (!grid || document.getElementById("segShareBox")) return;
    const card = document.createElement("div");
    card.className = "card glass";
    card.innerHTML = '<h4 data-i18n="ex.segShare">' + T("ex.segShare") + '</h4>' +
      '<div id="segShareBox"></div><div class="legend" id="segShareLeg"></div>';
    const segCardEl = [...grid.children].find(c => /Phân khúc thị trường|Market Segments/.test(c.textContent));
    if (segCardEl && segCardEl.nextSibling) grid.insertBefore(card, segCardEl.nextSibling);
    else grid.appendChild(card);
  }

  function renderSegShare() {
    segCard();
    if (!document.getElementById("segShareBox") || !window.donut) return;
    const data = (typeof visible === "function" ? visible() : RECORDS) || [];
    const by = {};
    data.forEach(r => { if (r.segment) by[r.segment] = (by[r.segment] || 0) + 1; });
    const pal = (typeof SEG_COLORS !== "undefined" && SEG_COLORS) || ["#0B4F9E"];
    const items = Object.keys(by).sort((a, b) => by[b] - by[a])
      .map((s, i) => ({ label: s, value: by[s], color: pal[i % pal.length] }));
    if (!items.length) {
      document.getElementById("segShareBox").innerHTML = '<div class="x-empty">' + T("ex.noSegData") + '</div>';
      document.getElementById("segShareLeg").innerHTML = ""; return;
    }
    try {
      donut("segShareBox", "segShareLeg", items, lbl => {
        if (typeof segDrill !== "undefined") {  }
        if (window.toast) toast(lbl + ": " + T("sf.nOpps", { n: by[lbl] }));
      });
    } catch (e) { console.warn("[extras] segment chart:", e.message); }
  }

  function wrap(name, fn) {
    const o = window[name];
    if (typeof o !== "function") return;
    window[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) {} return r; };
  }
  const safe = f => { try { f(); } catch (e) { console.warn("[extras]", e && e.message); } };

  function boot() {
    safe(restoreCustom);
    safe(dedupeNccs);
    wrap("loginAs", () => setTimeout(() => {
      safe(rebuildTabs); safe(addSupplierButton); safe(wireActivityClicks);
    }, 90));
    wrap("renderActs", () => safe(wireActivityClicks));
    wrap("renderDash", () => safe(renderSegShare));
    wrap("go", () => { safe(addSupplierButton); safe(wireActivityClicks); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FISG_EXTRAS = { openSupplierModal, customerModal, renderSegShare, applySupplier, dedupeNccs };
})();
