/* ---------------- languages ---------------- */
(function () {
  const LANGS = [['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['ms', 'Bahasa Melayu'], ['id', 'Bahasa Indonesia'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['af', 'Afrikaans'], ['sw', 'Kiswahili'], ['zh', '中文']];
  const D = window.I18N || {};
  let lang = 'en';
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const has = s => /\p{L}/u.test(s);
  const NO = 'script,style,canvas,svg,textarea,.lg,[translate="no"],.num';
  const esc = s => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
  const tr = k => (lang !== 'en' && D[lang] && D[lang][k]) || k;
  window.__t = (k, v) => tr(k).replace(/\{(\w+)\}/g, (m, n) => v && n in v ? v[n] : m);
  window.__lang = () => lang;

  function leafKey(el) {
    let k = '', map = {};
    for (const n of el.childNodes) {
      if (n.nodeType === 3) k += n.nodeValue;
      else if (n.nodeType === 1 && n.classList.contains('lg')) { const t = n.getAttribute('aria-label'); map[t] = n.outerHTML; k += '{' + t + '}'; }
      else if (n.nodeName === 'BR') { k += '{br}'; map.br = '<br>'; }
      else if (n.nodeType === 8) continue;
      else return null;
    }
    return [norm(k), map];
  }
  function doEl(el) {
    if (el.closest(NO)) return;
    const lk = leafKey(el);
    if (lk) {
      const cur = el.innerHTML;
      if (el.__v !== cur) { el.__k = has(lk[0].replace(/\{[^}]*\}/g, '')) ? lk[0] : null; el.__m = lk[1]; el.__src = cur; }
      if (el.__k) {
        const out = tr(el.__k);
        const html = out === el.__k ? el.__src : esc(out).replace(/\{([^}]+)\}/g, (m, t) => el.__m[t] || m);
        if (cur !== html) el.innerHTML = html;
        el.__v = el.innerHTML;
      }
    } else {
      for (const n of el.childNodes) if (n.nodeType === 3 && (n.__k || has(n.nodeValue))) {
        if (n.__v !== n.nodeValue) n.__k = n.nodeValue;
        const k = norm(n.__k), out = tr(k), m = n.__k.match(/^(\s*)[\s\S]*?(\s*)$/);
        const v = out === k ? n.__k : m[1] + out + m[2];
        if (n.nodeValue !== v) n.nodeValue = v;
        n.__v = n.nodeValue;
      }
    }
    for (const a of ['placeholder', 'aria-label', 'title']) {
      if (!el.hasAttribute(a) || el.classList.contains('lg')) continue;
      el.__a = el.__a || {};
      const cur = el.getAttribute(a), rec = el.__a[a];
      if (!rec || rec.v !== cur) el.__a[a] = {k: norm(cur)};
      const out = tr(el.__a[a].k); if (cur !== out) el.setAttribute(a, out); el.__a[a].v = out;
    }
  }
  function walk(root) { if (root.nodeType !== 1) root = root.parentElement; if (!root) return; doEl(root); root.querySelectorAll('*').forEach(doEl); }
  let mo;
  function apply(l, save) {
    lang = LANGS.some(x => x[0] === l) ? l : 'en';
    const h = document.documentElement; h.lang = lang; h.dir = lang === 'ar' ? 'rtl' : 'ltr';
    walk(document.body); if (mo) mo.takeRecords();
    document.querySelectorAll('.langsel').forEach(s => { s.value = lang; });
    if (save) try { localStorage.setItem('debbit.lang', lang); } catch (e) {}
    window.dispatchEvent(new Event('langchange'));
  }
  function pick() {
    try { const s = localStorage.getItem('debbit.lang'); if (s) return s; } catch (e) {}
    for (const n of navigator.languages || [navigator.language || 'en']) { const p = n.toLowerCase().split('-')[0]; if (LANGS.some(x => x[0] === p)) return p; if (p === 'zsm' || p === 'may') return 'ms'; if (p === 'in') return 'id'; }
    return 'en';
  }
  document.querySelectorAll('.langsel').forEach(s => {
    s.setAttribute("translate", "no"); s.innerHTML = LANGS.map(([c, n]) => `<option value="${c}" lang="${c}">${n}</option>`).join('');
    s.onchange = () => apply(s.value, true);
  });
  window.__setLang = l => apply(l, true);
  window.__i18nKeys = () => { const keys = new Set(); const add = k => { if (k && has(k.replace(/\{[^}]*\}/g, ''))) keys.add(k); };
    document.body.querySelectorAll('*').forEach(el => { if (el.closest(NO)) return; const lk = leafKey(el); if (lk) add(lk[0]); else for (const n of el.childNodes) if (n.nodeType === 3) add(norm(n.nodeValue));
      for (const a of ['placeholder', 'aria-label', 'title']) if (el.hasAttribute(a) && !el.classList.contains('lg')) add(norm(el.getAttribute(a))); });
    return [...keys]; };
  mo = new MutationObserver(rs => { if (lang === 'en') return; const seen = new Set(); rs.forEach(r => { const t = r.target.nodeType === 1 ? r.target : r.target.parentElement; if (t && !seen.has(t)) { seen.add(t); walk(t); } }); mo.takeRecords(); });
  mo.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label']});
  apply(pick(), false);
})();
