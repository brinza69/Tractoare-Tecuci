// Tractoare Tecuci: the content is already in the HTML; this file only adds behaviour.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Full-screen menu on a native modal <dialog>: focus trap, Esc and the inert page come from the browser.
function menu() {
  const dialog = $('dialog#menu');
  if (!dialog?.showModal) return;
  const openers = $$('[data-menu-open]');
  const setExpanded = (v) => openers.forEach((b) => b.setAttribute('aria-expanded', String(v)));
  openers.forEach((b) => b.addEventListener('click', () => { dialog.showModal(); setExpanded(true); }));
  $$('[data-menu-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
  // Following a link closes the menu first, so the page behind is clean on back navigation.
  dialog.addEventListener('click', (e) => { if (e.target.closest('a')) dialog.close(); });
  dialog.addEventListener('close', () => { setExpanded(false); openers[0]?.focus({ preventScroll: true }); });
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches && dialog.open) dialog.close(); });
}

// The nav pill frosts a little more once the page scrolls; one rAF per scroll burst.
function stickyHeader() {
  const header = $('[data-nav]');
  if (!header) return;
  let ticking = false;
  const update = () => { header.toggleAttribute('data-scrolled', scrollY > 24); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// Cards below the first screen slide in once (transform only, so nothing shifts and text keeps its contrast).
function reveals() {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -40px 0px' });
  $$('.card.product, .post-card, .section-head, .services-head, .service-card, .rev-card, .cat-card, .about-teaser__inner > *, .faq-block, .guides, .q, .related-list > li').forEach((el, i) => {
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.classList.add('reveal-element', `delay-${(i % 3) * 100}`);
    io.observe(el);
  });
}

// Subtle tilt on product and service cards for mouse users on large screens.
function tilt() {
  if (reduceMotion || !matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;
  $$('.service-card').forEach((card) => {
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
  const track = $('[data-track]', g);
  const slides = $$('.g-open', track);
  const thumbs = $$('.g-thumb', g);
  const thumbList = $('[data-thumbs]', g);
  const count = $('[data-count]', g);
  const prev = $('[data-prev]', g);
  const next = $('[data-next]', g);
  const total = slides.length;
  const behavior = reduceMotion ? 'auto' : 'smooth';
  let index = 0;

  // Full-size photos for slides 2+ once the page has loaded, or as soon as the visitor touches the gallery.
  let upgraded = false;
  const upgrade = () => {
    if (upgraded) return;
    upgraded = true;
    $$('img[data-srcset]', track).forEach((img) => { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); });
  };
  ['pointerdown', 'keydown', 'focusin'].forEach((ev) => g.addEventListener(ev, upgrade, { once: true, passive: true }));
  track.addEventListener('scroll', upgrade, { once: true, passive: true });
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(upgrade, { timeout: 4000 }) : setTimeout(upgrade, 2500));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });

  // The strip scrolls natively (swipe, trackpad, keyboard); the index follows the scroll position.
  const sync = () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i === index) return;
    index = Math.min(total - 1, Math.max(0, i));
    count.textContent = String(index + 1);
    prev.disabled = index === 0;
    next.disabled = index === total - 1;
    thumbs.forEach((t, j) => (j === index ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    const t = thumbs[index].parentElement;
    const left = t.offsetLeft - (thumbList.clientWidth - t.clientWidth) / 2;
    thumbList.scrollTo({ left, behavior });
  };
  let raf = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  const go = (i) => track.scrollTo({ left: Math.min(total - 1, Math.max(0, i)) * track.clientWidth, behavior });
  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  thumbs.forEach((t, i) => t.addEventListener('click', () => go(i)));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });
  addEventListener('resize', () => go(index), { passive: true });

  // Full-screen viewer (native <dialog>: focus trap, Esc, focus returns to the photo).
  const lb = $('[data-lb]');
  if (!lb || typeof lb.showModal !== 'function') return;
  const img = $('[data-lb-img]', lb);
  const lbCount = $('[data-lb-count]', lb);
  let at = 0;
  const preload = (i) => { const s = slides[(i + total) % total]; if (s) new Image().src = s.dataset.full; };
  const show = (i) => {
    at = (i + total) % total;
    img.src = slides[at].dataset.full;
    img.alt = $('img', slides[at]).alt;
    lbCount.textContent = `${at + 1} / ${total}`;
    preload(at + 1);
    preload(at - 1);
  };
  slides.forEach((s, i) => s.addEventListener('click', () => { show(i); lb.showModal(); lb.classList.add('open'); }));
  lb.addEventListener('close', () => { lb.classList.remove('open'); go(at); });
  $('[data-lb-prev]', lb).addEventListener('click', () => show(at - 1));
  $('[data-lb-next]', lb).addEventListener('click', () => show(at + 1));
  $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-img-wrap')) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'ArrowRight') show(at + 1);
  });
  let sx = 0;
  let sy = 0;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) lb.close();
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
