/* ==========================================================================
 * FISG i18n engine (key-based) — EN | VI
 * --------------------------------------------------------------------------
 * Dictionary : js/i18n-dict.js  -> window.I18N_DICT = { en:{...}, vi:{...}, val:{...} }
 * Public API :
 *   t(key, params?)      -> localized string. Params: t('x', {n: 3}) fills "{n}".
 *                           Plural: when params.n == 1 and 'key.one' exists, it is used.
 *   T(key, params?)      -> alias of t(); used inside renderers where a local
 *                           variable called `t` would shadow the global.
 *   tv(value)            -> display label for a stored DATA value (stage,
 *                           status, activity type…). Never changes the value.
 *   I18N.lang()          -> 'vi' | 'en'
 *   I18N.locale()        -> 'vi-VN' | 'en-GB' (numbers 1,234.5 · dates DD/MM/YYYY)
 *   I18N.decSep()        -> ',' | '.'
 *   I18N.setLang(l)      -> switch language, re-apply DOM, fire 'app:langchange'
 *   I18N.apply(root?)    -> bind [data-i18n*] attributes inside root
 *   I18N.onChange(fn)    -> subscribe to language changes (re-render hooks)
 *   I18N.audit()         -> console table of visible Vietnamese text that is
 *                           NOT bound to a key (QA helper)
 * HTML bindings:
 *   data-i18n="key"              textContent
 *   data-i18n-html="key"         innerHTML (dictionary content only — trusted)
 *   data-i18n-placeholder="key"  placeholder
 *   data-i18n-title="key"        title
 *   data-i18n-aria-label="key"   aria-label
 *   data-i18n-alt="key"          alt
 *   data-lang-switch             container that receives the EN | VI switch
 * Preference   : localStorage 'app_lang' (default 'vi'; migrates 'fisg_lang')
 * ========================================================================== */
(function () {
  'use strict';
  var STORE_KEY = 'app_lang';
  var LANG = 'vi';
  try {
    var saved = localStorage.getItem(STORE_KEY) || localStorage.getItem('fisg_lang');
    if (saved === 'en' || saved === 'vi') LANG = saved;
    localStorage.setItem(STORE_KEY, LANG);
  } catch (e) {}
  document.documentElement.lang = LANG;

  function dict() { return window.I18N_DICT || { en: {}, vi: {}, val: {} }; }

  function fmt(s, p) {
    if (!p) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return p[k] === undefined || p[k] === null ? m : p[k];
    });
  }

  var missing = {};
  function t(key, params) {
    var d = dict(), s;
    /* simple plural: t('x', {n: 1}) uses 'x.one' when that key exists */
    if (params && String(params.n) === '1' && d[LANG] && d[LANG][key + '.one'] !== undefined) key = key + '.one';
    s = d[LANG] && d[LANG][key];
    if (s === undefined) s = d.vi && d.vi[key];
    if (s === undefined) {
      if (!missing[key]) { missing[key] = 1; try { console.warn('[i18n] missing key:', key); } catch (e) {} }
      s = key;
    }
    return fmt(s, params);
  }

  /* Data values (stored in SharePoint / config in Vietnamese or English)
     are translated for display only. Unknown values pass through as-is. */
  function tv(value) {
    if (value === undefined || value === null) return value;
    var v = dict().val || {}, k = String(value).trim(), e = v[k];
    if (!e) return value;
    return (LANG === 'en' ? e.en : e.vi) || value;
  }

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function apply(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    var q = function (sel, fn) {
      if (root.matches && root.matches(sel)) fn(root);
      root.querySelectorAll(sel).forEach(fn);
    };
    q('[data-i18n]', function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    q('[data-i18n-html]', function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    ATTRS.forEach(function (a) {
      q('[data-i18n-' + a + ']', function (el) { el.setAttribute(a, t(el.getAttribute('data-i18n-' + a))); });
    });
    if (root === document) {
      var tt = document.querySelector('title[data-i18n]');
      if (tt) document.title = t(tt.getAttribute('data-i18n'));
    }
  }

  var subs = [];
  function onChange(fn) { if (typeof fn === 'function') subs.push(fn); }

  function setLang(l) {
    l = l === 'en' ? 'en' : 'vi';
    if (l === LANG) { syncSwitch(); return; }
    LANG = l;
    try { localStorage.setItem(STORE_KEY, LANG); } catch (e) {}
    document.documentElement.lang = LANG;
    apply(document);
    syncSwitch();
    subs.forEach(function (fn) { try { fn(LANG); } catch (e) { console.error('[i18n] re-render hook failed', e); } });
    try { document.dispatchEvent(new CustomEvent('app:langchange', { detail: { lang: LANG } })); } catch (e) {}
    if (window.I18N_LEGACY) window.I18N_LEGACY.sync(LANG);
  }

  /* ---------- EN | VI switch ---------- */
  var SWITCH_CSS =
    '.lang-switch{position:relative;display:inline-flex;align-items:center;flex:none;height:34px;padding:3px 3px 3px 9px;' +
    'border-radius:20px;background:#fff;border:1px solid #E3E6EC;font-family:inherit}' +
    '.lang-switch .ls-globe{color:#6B7280;margin-right:5px;flex:none}' +
    '.lang-switch .ls-thumb{position:absolute;top:3px;left:28px;width:38px;height:26px;border-radius:16px;background:#1E3A5F;transition:transform .25s ease}' +
    '.lang-switch.is-vi .ls-thumb{transform:translateX(38px)}' +
    '.lang-switch .ls-opt{position:relative;z-index:1;width:38px;height:26px;border:0;background:none;border-radius:16px;' +
    'font-size:11.5px;font-weight:800;letter-spacing:.04em;color:#6B7280;cursor:pointer}' +
    '.lang-switch .ls-opt[aria-pressed="true"]{color:#fff}' +
    '.lang-switch .ls-opt:focus-visible{outline:2px solid #2563EB;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.lang-switch .ls-thumb{transition:none}}';

  function ensureSwitchCss() {
    if (document.getElementById('i18nSwitchCss')) return;
    if (document.querySelector('link[href*="styles.css"]')) return; // styles.css already ships .lang-switch
    var st = document.createElement('style'); st.id = 'i18nSwitchCss'; st.textContent = SWITCH_CSS;
    document.head.appendChild(st);
  }

  function buildSwitch(host) {
    if (host.__i18nSwitch) return;
    host.__i18nSwitch = true;
    host.classList.add('lang-switch');
    host.setAttribute('role', 'group');
    host.setAttribute('data-i18n-aria-label', 'common.language');
    host.innerHTML =
      '<svg class="ls-globe" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/></svg>' +
      '<span class="ls-thumb" aria-hidden="true"></span>' +
      '<button class="ls-opt" type="button" data-l="en" lang="en" title="English">EN</button>' +
      '<button class="ls-opt" type="button" data-l="vi" lang="vi" title="Tiếng Việt">VI</button>';
    host.querySelectorAll('.ls-opt').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-l')); });
    });
  }

  function syncSwitch() {
    document.querySelectorAll('[data-lang-switch]').forEach(function (sw) {
      sw.classList.toggle('is-vi', LANG === 'vi');
      sw.querySelectorAll('.ls-opt').forEach(function (b) {
        var on = b.getAttribute('data-l') === LANG;
        b.setAttribute('aria-pressed', String(on));
      });
    });
  }

  /* ---------- QA helper ---------- */
  var VI_RE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
  function audit() {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var p = n.parentElement, s = n.nodeValue.trim();
      if (!s || !p || p.closest('script,style,[data-noi18n]')) continue;
      if (!p.offsetParent && getComputedStyle(p).position !== 'fixed') continue;
      if (VI_RE.test(s)) out.push({ text: s.slice(0, 80), el: p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className.split(' ')[0] : '') });
    }
    console.table(out);
    return out;
  }

  function boot() {
    ensureSwitchCss();
    document.querySelectorAll('[data-lang-switch]').forEach(buildSwitch);
    apply(document);
    syncSwitch();
    if (window.I18N_LEGACY) window.I18N_LEGACY.sync(LANG);
  }

  window.I18N = {
    t: t, tv: tv, apply: apply, setLang: setLang, onChange: onChange, audit: audit,
    lang: function () { return LANG; },
    locale: function () { return LANG === 'en' ? 'en-GB' : 'vi-VN'; },   // for toLocaleString()
    decSep: function () { return LANG === 'en' ? '.' : ','; },           // decimal separator for manual formatting
    missing: function () { return Object.keys(missing); },
    mountSwitch: function (host) { ensureSwitchCss(); buildSwitch(host); apply(host); syncSwitch(); }
  };
  window.t = t; window.T = t; window.tv = tv; window.setLang = setLang;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
