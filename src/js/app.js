// Tractoare Tecuci: the content is already in the HTML; this file only adds behaviour.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mobile menu
function menu() {
  const header = $('.site-header');
  const hamb = $('.hamb', header || document);
  const backdrop = $('.nav-backdrop');
  if (!header || !hamb) return;
  const set = (open) => {
    header.classList.toggle('open', open);
    hamb.setAttribute('aria-expanded', String(open));
    if (backdrop) backdrop.hidden = !open;
    if (open) $('#mobile-drawer a')?.focus();
  };
  hamb.addEventListener('click', () => set(!header.classList.contains('open')));
  backdrop?.addEventListener('click', () => set(false));
  $('#mobile-drawer')?.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('open')) { set(false); hamb.focus(); }
  });
  addEventListener('resize', () => { if (innerWidth >= 769) set(false); }, { passive: true });
}

// Header shadow after the first screen; one rAF per scroll burst.
function stickyHeader() {
  const header = $('.site-header');
  if (!header) return;
  let ticking = false;
  const update = () => { header.classList.toggle('scrolled', scrollY > 40); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// Cards below the first screen slide in once (transform only, so nothing shifts and text keeps its contrast).
function reveals() {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -40px 0px' });
  $$('.service-card, .card.product, .rev-card, .value-card, .post-card').forEach((el, i) => {
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.classList.add('reveal-element', `delay-${(i % 3) * 100}`);
    io.observe(el);
  });
}

// Subtle tilt on product and service cards for mouse users on large screens.
function tilt() {
  if (reduceMotion || !matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;
  $$('.card.product, .service-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 4;
      const y = ((e.clientY - r.top) / r.height - 0.5) * -4;
      card.style.transform = `perspective(1000px) rotateX(${y}deg) rotateY(${x}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

// Hero film: the poster image is the LCP; the film starts after load, only when motion and data allow it.
function heroVideo() {
  const video = $('.hero-bg');
  const toggle = $('[data-video-toggle]');
  if (!video) return;
  const conn = navigator.connection || {};
  if (reduceMotion || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) return;
  let userPaused = false;
  const start = () => {
    const kind = matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
    const av1 = video.canPlayType('video/webm; codecs="av01.0.05M.08"');
    const add = (src, type) => { const s = document.createElement('source'); s.src = src; s.type = type; video.append(s); };
    if (av1) add(video.dataset[`webm${kind[0].toUpperCase()}${kind.slice(1)}`], 'video/webm');
    add(video.dataset[`mp4${kind[0].toUpperCase()}${kind.slice(1)}`], 'video/mp4');
    video.load();
    video.addEventListener('playing', () => {
      video.classList.add('is-playing');
      if (toggle) { toggle.hidden = false; toggle.setAttribute('aria-pressed', 'false'); }
    });
    video.play().catch(() => {});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (userPaused) return;
        if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
      }).observe(video);
    }
  };
  toggle?.addEventListener('click', () => {
    userPaused = !video.paused;
    if (video.paused) video.play().catch(() => {}); else video.pause();
    toggle.setAttribute('aria-pressed', String(userPaused));
  });
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1200));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}

// Call / WhatsApp bar on phones; it steps aside while the page's own contact buttons are on screen.
function actionBar() {
  const bar = $('[data-action-bar]');
  const cta = $('[data-hero-cta]');
  if (!bar || !cta || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => bar.classList.toggle('is-hidden', e.isIntersecting)).observe(cta);
}

// Stock filters: the cards are in the HTML; filtering only hides them. The URL keeps the filter (shareable).
function stockFilters() {
  const form = $('#filters');
  const items = $$('.product-grid > li');
  if (!form || !items.length) return;
  const chips = $$('.chip-filter');
  const count = $('[data-result-count]');
  const empty = $('[data-empty]');
  const params = new URLSearchParams(location.search);
  for (const k of ['q', 'category', 'brand', 'maxHours']) if (params.has(k) && form.elements[k]) form.elements[k].value = params.get(k);
  const apply = (push) => {
    const q = form.elements.q.value.trim().toLowerCase();
    const cat = form.elements.category.value;
    const brand = form.elements.brand.value;
    const max = Number(form.elements.maxHours.value) || 0;
    let shown = 0;
    for (const li of items) {
      const c = li.firstElementChild.dataset;
      const ok = (!q || c.text.includes(q)) && (!cat || c.cat === cat) && (!brand || c.brand === brand) && (!max || Number(c.hours) <= max);
      li.hidden = !ok;
      if (ok) shown++;
    }
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    if (count) count.textContent = `${shown} ${shown === 1 ? 'utilaj afișat' : 'utilaje afișate'}`;
    if (empty) empty.hidden = shown > 0;
    if (push) {
      const p = new URLSearchParams();
      for (const k of ['q', 'category', 'brand', 'maxHours']) if (form.elements[k].value) p.set(k, form.elements[k].value);
      history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(true); });
  form.addEventListener('input', () => apply(true));
  form.addEventListener('change', () => apply(true));
  chips.forEach((b) => b.addEventListener('click', () => { form.elements.category.value = b.dataset.cat; apply(true); }));
  apply(false);
}

// Blog categories.
function blogFilters() {
  const pills = $$('.blog-cats .pill');
  const items = $$('#blogList > li');
  if (!pills.length) return;
  pills.forEach((p) => p.addEventListener('click', () => {
    const cat = p.dataset.cat;
    pills.forEach((x) => { x.classList.toggle('active', x === p); x.setAttribute('aria-pressed', String(x === p)); });
    items.forEach((li) => { li.hidden = cat !== 'toate' && !li.firstElementChild.dataset.cats.split(' ').includes(cat); });
  }));
}

// Product gallery and full-screen viewer.
function gallery() {
  const g = $('[data-gallery]');
  if (!g) return;
  const main = $('[data-main]', g);
  const count = $('[data-count]', g);
  const thumbs = $$('.g-thumb', g);
  const name = main.alt.replace(/, fotografia.*$/, '');
  let index = 0;
  const show = (i) => {
    index = (i + thumbs.length) % thumbs.length;
    const t = thumbs[index];
    main.srcset = t.dataset.srcset;
    main.alt = `${name}, fotografia ${index + 1} din ${thumbs.length}`;
    count.textContent = String(index + 1);
    thumbs.forEach((x, j) => (j === index ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
  };
  thumbs.forEach((t, i) => t.addEventListener('click', () => show(i)));

  const lb = $('[data-lb]');
  if (!lb || typeof lb.showModal !== 'function') return;
  const img = $('[data-lb-img]', lb);
  const set = (i) => { show(i); img.src = thumbs[index].dataset.full; img.alt = main.alt; };
  $('[data-lb-open]', g).addEventListener('click', () => { set(index); lb.showModal(); lb.classList.add('open'); });
  lb.addEventListener('close', () => lb.classList.remove('open'));
  $('[data-lb-prev]', lb).addEventListener('click', () => set(index - 1));
  $('[data-lb-next]', lb).addEventListener('click', () => set(index + 1));
  $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') set(index - 1);
    if (e.key === 'ArrowRight') set(index + 1);
  });
  let sx = 0;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const d = e.changedTouches[0].clientX - sx;
    if (Math.abs(d) > 50) set(index + (d < 0 ? 1 : -1));
  });
}

// Google map only on request (no Google request or cookie before the click).
function mapFacade() {
  const box = $('[data-map]');
  const btn = $('[data-map-load]');
  if (!box || !btn) return;
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = box.dataset.src;
    f.title = 'Hartă Google Maps: Tractoare Tecuci, Str. Tecuciului Nou 25, Tecuci';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.allowFullscreen = true;
    box.replaceChildren(f);
    box.classList.add('is-loaded');
  });
}

menu();
stickyHeader();
reveals();
tilt();
heroVideo();
actionBar();
stockFilters();
blogFilters();
gallery();
mapFacade();
