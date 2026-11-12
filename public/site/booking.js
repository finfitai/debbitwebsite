/* Meeting booking: the cal.com event the old site used (debbitmy/30min), opened as a popup.
   If the cal.com script can't load, the links still open the booking page in a new tab. */
(function () {
  (function (C, A, L) { const p = function (a, ar) { a.q.push(ar); }; const d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal; const ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; const s = d.head.appendChild(d.createElement('script')); s.src = A; s.onload = () => { cal.ready = true; }; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
  Cal('init', '30min', {origin: 'https://cal.com'});
  Cal.ns['30min']('ui', {cssVarsPerTheme: {light: {'cal-brand': '#F03D78'}, dark: {'cal-brand': '#F03D78'}}, hideEventTypeDetails: false, layout: 'month_view', theme: 'dark'});
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-cal-link]');
    if (!a || !window.Cal || !Cal.ready) return;
    e.preventDefault(); e.stopPropagation();
    Cal.ns['30min']('modal', {calLink: a.dataset.calLink, config: {layout: 'month_view'}});
  }, true);
})();
