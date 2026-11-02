// Cookie consent, strict mode. Loaded only when data/site.json has a GA4 id.
// Nothing from Google loads before the visitor accepts Statistici. Consent Mode v2 defaults (all denied)
// are set inline in <head>; this file sends only the update for what was chosen.
(() => {
  const ID = window.TT_GA4;
  if (!ID) return;
  const KEY = 'tt-consent-v1';
  const FOURTEEN_MONTHS = 60 * 60 * 24 * 426;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode: choice lasts for this page */ } };
  let loaded = false;

  function deleteCookies(prefixes) {
    const host = location.hostname;
    const domains = ['', host, `.${host}`, `.${host.replace(/^www\./, '')}`];
    for (const raw of document.cookie.split(';')) {
      const name = raw.split('=')[0].trim();
      if (!prefixes.some((p) => name.startsWith(p))) continue;
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }

  function apply(c) {
    const a = c?.analytics ? 'granted' : 'denied';
    const m = c?.marketing ? 'granted' : 'denied';
    window[`ga-disable-${ID}`] = !c?.analytics;
    gtag('consent', 'update', { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m });
    if (!c?.analytics) deleteCookies(['_ga']);
    if (!c?.marketing) deleteCookies(['_gcl']);
    if (c?.analytics && !loaded) {
      loaded = true;
      gtag('js', new Date());
      gtag('config', ID, { cookie_expires: FOURTEEN_MONTHS, allow_google_signals: !!c.marketing, allow_ad_personalization_signals: !!c.marketing });
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
      document.head.append(s);
    } else if (loaded) {
      gtag('set', { allow_google_signals: !!c?.marketing, allow_ad_personalization_signals: !!c?.marketing });
    }
  }

  // Lead events (sent only when GA4 is loaded, i.e. after consent).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !loaded) return;
    const href = a.getAttribute('href');
    const ev = href.startsWith('tel:') ? 'click_phone' : href.includes('wa.me/') ? 'click_whatsapp' : href.startsWith('mailto:') ? 'click_email' : '';
    if (ev) gtag('event', ev, { link_url: href, page_path: location.pathname });
  });

  const box = document.createElement('section');
  box.className = 'consent';
  box.setAttribute('aria-label', 'Cookie-uri');
  box.hidden = true;
  box.innerHTML = `<div class="consent-card">
    <h2 class="consent-title">Cookie-uri</h2>
    <p>Folosim Google Analytics doar dacă ești de acord, ca să vedem ce pagini ajută. Fără acord nu se încarcă nimic de la Google. Detalii în <a href="/confidentialitate#cookies">politica de confidențialitate</a>.</p>
    <form class="consent-choices" hidden>
      <label><input type="checkbox" name="analytics"> <span><strong>Statistici</strong>: vizite și pagini citite (Google Analytics)</span></label>
      <label><input type="checkbox" name="marketing"> <span><strong>Marketing</strong>: măsurarea și personalizarea reclamelor Google</span></label>
    </form>
    <div class="consent-actions">
      <button type="button" class="consent-btn" data-c="all">Accept tot</button>
      <button type="button" class="consent-btn" data-c="none">Refuz</button>
      <button type="button" class="consent-btn consent-btn-link" data-c="choose">Aleg eu</button>
      <button type="button" class="consent-btn" data-c="save" hidden>Salvez alegerea</button>
    </div>
  </div>`;
  document.body.append(box);
  const form = box.querySelector('form');
  const btn = (k) => box.querySelector(`[data-c="${k}"]`);
  const open = (choose) => {
    const c = read();
    form.elements.analytics.checked = !!c?.analytics;
    form.elements.marketing.checked = !!c?.marketing;
    form.hidden = !choose;
    btn('choose').hidden = choose;
    btn('save').hidden = !choose;
    box.hidden = false;
    document.body.classList.add('consent-open');
    (choose ? form.elements.analytics : btn('all')).focus({ preventScroll: true });
  };
  const close = () => { box.hidden = true; document.body.classList.remove('consent-open'); };
  const decide = (c) => { c.ts = Date.now(); write(c); apply(c); close(); };
  box.addEventListener('click', (e) => {
    const k = e.target.closest('[data-c]')?.dataset.c;
    if (k === 'all') decide({ analytics: true, marketing: true });
    if (k === 'none') decide({ analytics: false, marketing: false });
    if (k === 'choose') open(true);
    if (k === 'save') decide({ analytics: form.elements.analytics.checked, marketing: form.elements.marketing.checked });
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-consent-open]')) open(true); });
  // A choice made in another tab applies here too.
  addEventListener('storage', (e) => { if (e.key === KEY) { apply(read()); close(); } });

  const saved = read();
  if (saved) apply(saved); else open(false);
})();
