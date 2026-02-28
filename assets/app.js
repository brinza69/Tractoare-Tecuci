/* =============================================================================
   TRACTOARE TECUCI - APP.JS COMPLET
   Include: Funcționalitate site + Micro-Interacțiuni + ALT text SEO "second hand"
   
   ✅ MODIFICĂRI SEO (invizibile pentru utilizatori):
   - cardProduct(): ALT text pentru carduri produse (homepage + products.html)
   - pageDetail(): ALT text pentru galerie produs individual
   - pageBlog(): ALT text pentru carduri articole blog
   - pagePost(): ALT text pentru cover image articol
   ========================================================================== */

// ========== Link-uri OLX actualizate ==========
const OLX_LINKS = {
  'tractor-claas-arion-420-cis-panoramic': 'https://www.olx.ro/d/oferta/tractor-claas-arion-420-IDk0PzI.html',
  'fendt-724-vario-tms-deutz-240cp': 'https://www.olx.ro/d/oferta/fendt-724-vario-tms-IDk1TL8.html',
  'massey-ferguson-7724-dyna6-240cp': 'https://www.olx.ro/d/oferta/tractor-massey-ferguson-7724-IDk1TQc.html',
  'massey-ferguson-7719-s-powershift': 'https://www.olx.ro/d/oferta/massey-ferguson-7719-IDjH5h3.html',
  'fendt-724-vario-tms-deutz-240cp-2017': 'https://www.olx.ro/d/oferta/fendt-vario-tms-724-IDjOd3N.html',
  'john-deere-6120m-powerquad-inversor': 'https://www.olx.ro/d/oferta/john-deere-6120-m-IDjZUGL.html',
  'fendt-718-vario-tms-deutz-185cp': 'https://www.olx.ro/d/oferta/fendt-718-vario-tms-IDjZUXI.html',
  'fendt-920-vario-tms-man-220cp': 'https://www.olx.ro/d/oferta/fendt-920-vario-tms-IDjZUMQ.html',
  'merlo-panoramic-37-12-plus': 'https://www.olx.ro/d/oferta/merlo-panoramic-37-12-plus-IDjH5dG.html',
  'semanatoare-kuhn-maxima-2-gt-prasitoare': 'https://www.olx.ro/d/oferta/semanatoare-de-plante-prasitoare-kuhn-maxima-2-gt-IDk2Bv7.html',
  'semanatoare-gaspardo-mte-6-randuri': 'https://www.olx.ro/d/oferta/semanatoare-gaspardo-6-randuri-IDjeqEy.html'
};

// ========== helpers ==========
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = n => (n || 0).toLocaleString('ro-RO');
const getJSON = path => fetch(path, { cache: 'no-store' }).then(r => r.json()).then(items => {
  // Actualizează link-urile OLX
  return items.map(p => ({
    ...p,
    olx_link: OLX_LINKS[p.slug] || p.olx_link
  }));
});

// ========== UI base (year + active link) ==========
function uiBase() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // marchează linkul activ în meniu (desktop + drawer)
  document.querySelectorAll('.nav a, .drawer a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    const same = location.pathname.endsWith(href);
    if (same) a.classList.add('active');
  });
}

// ========== MENU (burger + drawer + backdrop) ==========
function setupMenu () {
  const header   = document.querySelector('.site-header');
  const hamb     = header?.querySelector('.hamb');
  const drawer   = header?.querySelector('.drawer');
  const backdrop = document.querySelector('.nav-backdrop');

  if (!header || !hamb || !drawer) return;

  const open  = () => {
    header.classList.add('open');
    if (backdrop) { backdrop.hidden = false; }
  };
  const close = () => {
    header.classList.remove('open');
    if (backdrop) { backdrop.hidden = true; }
  };
  const toggle = () => (header.classList.contains('open') ? close() : open());

  hamb.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  if (backdrop) backdrop.addEventListener('click', close);
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });

  document.addEventListener('click', (e) => {
    if (!header.classList.contains('open')) return;
    if (!header.contains(e.target)) close();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 769) close();
  });
}

// ========== CONTACT ==========
function setupContact(){
  const f = $('#contactForm');
  if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const ok = f.checkValidity();
    const msg = $('#contactMsg');
    if (msg) msg.textContent = ok ? 'Mulțumim!' : 'Completează câmpurile.';
    if (ok) f.reset();
  });
}

// ========== HOME ==========
async function pageHome(){
  const g = $('#latestGrid'); if(!g) return;
  const items = await getJSON('data/products.json');
  g.innerHTML = items.slice(0,8).map(cardProduct).join('');
}

/* =============================================================================
   ✅ MODIFICARE SEO #1: Card produs cu ALT text "second hand" (INVIZIBIL)
   Locații: homepage (index.html), products.html
   ========================================================================== */
function cardProduct(p){
  const hoursDisplay = p.hours && p.hours > 0 
    ? `${p.year || ""} · ${fmt(p.hours)} ore` 
    : `${p.year || ""}`;

  // ✅ ALT text cu "second hand" (INVIZIBIL pentru utilizatori, SEO pentru Google Images)
  // Utilizatorii văd doar imaginea, NU văd textul "second hand"
  // Google Images indexează: "brand model second hand year - category import europa"
  const modelName = p.model || p.title.replace(p.brand, '').trim();
  const altText = `${p.brand} ${modelName} second hand ${p.year} - ${p.category} import Europa verificat tehnic`;

  return `
<a class="card product" href="product.html?slug=${encodeURIComponent(p.slug)}">
  <div class="media"><img loading="lazy" src="${p.cover}" alt="${altText}"></div>
  <div class="body">
    <span class="badge">${p.brand}</span>
    <h3>${p.title}</h3>
    <p class="muted">${hoursDisplay}</p>
  </div>
</a>`;
}

// ========== LIST + FILTRE ==========
async function pageList(){
  const g = $('#listGrid'); if(!g) return;
  const items = await getJSON('data/products.json');

  const url=new URL(location.href);
  const catInit=url.searchParams.get('category')||'';

  const brands=[...new Set(items.map(p=>p.brand))].sort();
  const brandSel=$('select[name="brand"]');
  if (brandSel) {
    brandSel.innerHTML='<option value="">Brand</option>'+brands.map(b=>`<option>${b}</option>`).join('');
  }

  const form=$('#filters'); if (!form) return;
  form.category.value=catInit;

  function apply(){
    const fd=new FormData(form);
    const q=(fd.get('q')||'').toLowerCase();
    let category=fd.get('category')||'';
    const brand=fd.get('brand')||'';
    const maxHours=+fd.get('maxHours')||0;

    // MAPARE: "alte" din HTML → "semanatoare" din JSON
    if (category === 'alte') {
      category = 'semanatoare';
    }

    const list=items.filter(p=>{
      if(q && !(p.title.toLowerCase().includes(q)||p.brand.toLowerCase().includes(q))) return false;
      if(category && p.category!==category) return false;
      if(brand && p.brand!==brand) return false;
      if(maxHours && (p.hours||0)>maxHours) return false;
      return true;
    });

    g.innerHTML=list.map(cardProduct).join('')||'<p class="muted">Nimic găsit.</p>';
  }

  form.addEventListener('submit',e=>{e.preventDefault(); apply();});
  
  $$('.cat-tabs .tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.cat-tabs .tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    form.category.value=t.dataset.cat||'';
    apply();
  }));

  apply();
}

/* =============================================================================
   ✅ MODIFICARE SEO #2: pageDetail() — meta tags + JSON-LD complete dinamice
   Locație: product.html (pagină detaliu produs individual)
   ========================================================================== */
async function pageDetail(){
  const wrap=$('#detailWrap'); if(!wrap) return;
  const items=await getJSON('data/products.json');
  const slug=new URL(location.href).searchParams.get('slug');
  const item=items.find(p=>p.slug===slug);
  if(!item){wrap.innerHTML='<p>Produsul nu există.</p>'; return;}

  // ── Construiește datele SEO ─────────────────────────────────────────────
  const baseUrl = 'https://www.tractoaretecuci.ro';
  const canonical = `${baseUrl}/product?slug=${encodeURIComponent(item.slug)}`;
  const ogImage = item.cover ? `${baseUrl}/${item.cover}` : `${baseUrl}/assets/og-image.jpg`;
  const gallery = [item.cover, ...(item.gallery || [])];
  const modelName = item.model || item.title.replace(item.brand, '').trim();

  // Title: "Brand Model – An | Tractoare Tecuci"
  const pageTitle = `${item.title} – ${item.year || ''} | Tractoare Tecuci`;

  // Meta description: Brand + Model + CP + An + Ore + locație (~150 ch)
  const cpSpec = (item.specs || []).find(s => s.k && (s.k.includes('PUTERE') || s.k.includes('CP')));
  const cpVal = cpSpec ? ` ${cpSpec.v},` : '';
  const hrsText = item.hours && item.hours > 0 ? ` ${item.hours.toLocaleString('ro-RO')} ore,` : '';
  const itText = item.cover && item.cover.includes('italia') ? ' import Italia,' : '';
  const metaDesc = `${item.title},${cpVal} an ${item.year || ''},${hrsText}${itText} Tecuci, Galați. Verificat tehnic, consultanță și transport disponibile. Solicită ofertă!`
    .replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').slice(0, 160);

  // OG Title
  const ogTitle = `${item.title} – ${item.year || ''} | Tractoare Tecuci`;

  // ── Setare meta tags dinamice ───────────────────────────────────────────
  document.title = pageTitle;

  // Title + Description
  const pTitle = document.getElementById('pTitle');
  if (pTitle) pTitle.textContent = pageTitle;
  const pDesc = document.getElementById('pDesc');
  if (pDesc) pDesc.setAttribute('content', metaDesc);

  // Canonical
  const pCan = document.getElementById('pCanonical');
  if (pCan) pCan.setAttribute('href', canonical);

  // Open Graph
  const ogT = document.getElementById('ogTitle');   if (ogT)  ogT.setAttribute('content', ogTitle);
  const ogD = document.getElementById('ogDesc');    if (ogD)  ogD.setAttribute('content', metaDesc);
  const ogU = document.getElementById('ogUrl');     if (ogU)  ogU.setAttribute('content', canonical);
  const ogI = document.getElementById('ogImage');   if (ogI)  ogI.setAttribute('content', ogImage);

  // Twitter Card
  const twT = document.getElementById('twTitle');   if (twT)  twT.setAttribute('content', ogTitle);
  const twD = document.getElementById('twDesc');    if (twD)  twD.setAttribute('content', metaDesc);
  const twI = document.getElementById('twImage');   if (twI)  twI.setAttribute('content', ogImage);

  // ── JSON-LD Product ─────────────────────────────────────────────────────
  const isInStock = item.status === 'In stoc';
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": item.title,
    "description": item.short_desc || metaDesc,
    "sku": item.slug,
    "brand": {
      "@type": "Brand",
      "name": item.brand || "Tractoare Tecuci"
    },
    "category": item.category === 'tractor' ? 'Tractoare' :
                 item.category === 'telescopic' ? 'Încărcătoare telescopice' : 'Utilaje agricole',
    "image": gallery.filter(Boolean).map(g => `${baseUrl}/${g}`),
    "url": canonical,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "EUR",
      "availability": isInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/UsedCondition",
      "seller": {
        "@type": "Organization",
        "name": "Tractoare Tecuci",
        "url": baseUrl,
        "telephone": "+40764199074",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Str. Tecuciului Nou, nr. 25",
          "addressLocality": "Tecuci",
          "addressRegion": "Galați",
          "postalCode": "805300",
          "addressCountry": "RO"
        }
      }
    }
  };
  const productSchema = document.getElementById('productSchema');
  if (productSchema) productSchema.textContent = JSON.stringify(productLd, null, 2);

  // ── JSON-LD BreadcrumbList ──────────────────────────────────────────────
  const catLabel = item.category === 'tractor' ? 'Tractoare' :
                   item.category === 'telescopic' ? 'Telescopice' : 'Alte utilaje';
  const catUrl = `${baseUrl}/products?category=${item.category}`;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Acasă", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Stoc Utilaje", "item": `${baseUrl}/products` },
      { "@type": "ListItem", "position": 3, "name": catLabel, "item": catUrl },
      { "@type": "ListItem", "position": 4, "name": item.title, "item": canonical }
    ]
  };
  const breadcrumbSchema = document.getElementById('breadcrumbSchema');
  if (breadcrumbSchema) breadcrumbSchema.textContent = JSON.stringify(breadcrumbLd, null, 2);

  // ── Head badge + titlu pagină ───────────────────────────────────────────
  const hb=$('#prodHeadBrand'), ht=$('#prodHeadTitle');
  if(hb){ hb.textContent=item.brand||''; hb.hidden=!item.brand; }
  if(ht){ ht.textContent=item.title||''; ht.hidden=!item.title; }

  // ── Galerie ─────────────────────────────────────────────────────────────
  // ✅ ALT text cu "second hand" pentru imaginea principală
  const mainImageAlt = `${item.brand} ${modelName} second hand ${item.year} - import Europa verificat tehnic`;

  const galleryHTML=`
    <div class="g-main"><img src="${gallery[0]}" alt="${mainImageAlt}" loading="eager"></div>
    <div class="g-thumbs">
      ${gallery.map((g,i) => {
        if (i === 0) return '';
        const thumbAlt = `${item.brand} ${modelName} second hand - detaliu imagine ${i}`;
        return `<img src="${g}" alt="${thumbAlt}" loading="lazy">`;
      }).join('')}
    </div>`;

  // ── Specs ───────────────────────────────────────────────────────────────
  let rows=''; const s=item.specs||[];
  for(let i=0;i<s.length;i+=2){
    const spec1 = s[i]?.k && s[i]?.v ? `<div class="spec"><strong>${s[i].k}:</strong> ${s[i].v}</div>` : '';
    const spec2 = s[i+1]?.k && s[i+1]?.v ? `<div class="spec"><strong>${s[i+1].k}:</strong> ${s[i+1].v}</div>` : '';
    if(spec1 || spec2) rows+=`<div class="spec-grid">${spec1}${spec2}</div>`;
  }

  // FIX "0 ore"
  const hoursHTML = item.hours && item.hours > 0
    ? `<div class="item">Ore: <strong>${item.hours.toLocaleString('ro-RO')}</strong></div>`
    : '';

  // Buton OLX / source_link
  const extLink = item.olx_link || item.source_link;
  const extLabel = item.olx_link ? 'Vezi pe OLX' : 'Sursă listare';
  const olxButton = extLink
    ? `<a class="btn btn-outline" href="${extLink}" target="_blank" rel="noopener noreferrer">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
           <polyline points="15 3 21 3 21 9"></polyline>
           <line x1="10" y1="14" x2="21" y2="3"></line>
         </svg>
         ${extLabel}
       </a>`
    : '';

  // ── Badge status pentru produse Vandut ─────────────────────────────────
  const statusBadge = item.status === 'Vandut'
    ? `<p style="display:inline-flex;align-items:center;gap:6px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:999px;padding:5px 12px;font-weight:700;font-size:14px;margin-bottom:12px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Vândut
       </p>`
    : '';

  wrap.innerHTML=`
    <div class="gallery">${galleryHTML}</div>
    <div class="info">
      ${statusBadge}
      <p class="snippet">${item.short_desc||''}</p>
      <div class="meta">
        <div class="item">An: <strong>${item.year||'—'}</strong></div>
        ${hoursHTML}
      </div>
      <div class="cta">
        <a class="ask-offer" href="contact.html">Solicită ofertă</a>
        ${olxButton}
      </div>
      <span class="cta-note">Consultanță, transport &amp; finanțare disponibile.</span>
      <div class="specs">
        <h3>Specificații</h3>
        ${rows || '<p class="muted">Fără specificații suplimentare.</p>'}
      </div>
    </div>`;
}

/* =============================================================================
   ✅ MODIFICARE SEO #3: Carduri blog cu ALT text "second hand" (INVIZIBIL)
   Locație: blog.html (listă articole blog)
   ========================================================================== */
async function pageBlog(){
  const list = $('#blogList'); 
  if (!list) return;

  const posts = await getJSON('data/posts.json');

  const card = (p) => {
    // ✅ ALT text cu "second hand" pentru carduri articole (INVIZIBIL)
    // Utilizatorii văd doar imaginea articolului, NU văd textul "second hand"
    // Google Images indexează: "title - ghid tractoare utilaje agricole second hand import europa"
    const altText = `${p.title} - ghid complet tractoare utilaje agricole second hand import Europa verificate tehnic`;
    
    return `
      <a class="card post-card" href="post.html?p=${encodeURIComponent(p.slug)}">
        <img loading="lazy" src="${p.cover || ''}" alt="${altText}">
        <div class="body">
          <h3>${p.title}</h3>
          <p class="muted">${p.excerpt || ''}</p>
        </div>
      </a>`;
  };

  const tabs = $$('.blog-cats .pill, .cat-tabs .pill');
  const normalize = (arr) => (Array.isArray(arr) && arr.length ? arr : ['ghiduri']);

  const render = (cat = 'toate') => {
    const filtered = (cat === 'toate')
      ? posts
      : posts.filter(p => normalize(p.cats).includes(cat));
    list.innerHTML = filtered.map(card).join('') || '<p class="muted">Nimic de afișat.</p>';
  };

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    render(t.dataset.cat || 'toate');
  }));

  render('toate');
}

/* =============================================================================
   ✅ MODIFICARE SEO #4: Cover image articol cu ALT text "second hand" (INVIZIBIL)
   Locație: blog-post.html (pagină articol individual)
   ========================================================================== */
async function pagePost(){
  const wrap = $('#postWrap');
  if (!wrap) return;

  const posts = await getJSON('data/posts.json');
  const params = new URLSearchParams(location.search);
  const slug = params.get('p') || params.get('slug');
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    wrap.innerHTML = `
      <div class="post-body">
        <div class="prose">
          <h1>Articolul nu a fost găsit</h1>
          <p>Vezi toate materialele pe <a href="blog.html">pagina de blog</a>.</p>
        </div>
      </div>`;
    document.title = 'Articol – Tractoare Tecuci';
    return;
  }

  // SEO meta tags
  const title = `${post.title} | Tractoare Tecuci`;
  const desc = post.excerpt || '';
  const canonical = `${location.origin}${location.pathname}?p=${encodeURIComponent(post.slug)}`;

  document.title = title;
  const tEl = $('#bTitle'); if (tEl) tEl.textContent = title;
  const dEl = $('#bDesc'); if (dEl) dEl.setAttribute('content', desc);
  const cEl = $('#bCanonical'); if (cEl) cEl.setAttribute('href', canonical);

  // JSON-LD Schema
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "datePublished": post.date,
    "author": { "@type": "Organization", "name": post.author || "Tractoare Tecuci" },
    "publisher": { 
      "@type": "Organization", 
      "name": "Tractoare Tecuci",
      "logo": { "@type": "ImageObject", "url": "assets/logo.png" } 
    },
    "image": post.cover,
    "description": post.excerpt
  };
  const ldEl = $('#jsonld-article'); 
  if (ldEl) ldEl.textContent = JSON.stringify(ld);

  // Format date
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ro-RO', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    }).format(d);
  };

  // Calculate reading time
  const words = (post.html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(2, Math.round(words / 200));

  // ✅ ALT text cu "second hand" pentru cover image articol (INVIZIBIL)
  // Utilizatorii văd doar cover image-ul, NU văd textul "second hand"
  // Google Images indexează: "title - ghid complet tractoare second hand import europa"
  const coverImageAlt = `${post.title} - ghid complet tractoare second hand import Europa verificate tehnic, sfaturi alegere și întreținere utilaje agricole`;

  wrap.innerHTML = `
    <header class="post-hero">
      <h1 class="post-title">${post.title}</h1>
      <div class="post-meta">${fmtDate(post.date)} · ${post.author || 'Tractoare Tecuci'} · ${readTime} min citire</div>
      <figure class="post-cover">
        <img src="${post.cover}" alt="${coverImageAlt}" loading="eager" decoding="async">
      </figure>
    </header>
    <div class="post-body">
      <div class="prose">
        ${post.html}
        <div class="share">
          <a class="btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">
            Distribuie pe Facebook
          </a>
          <a class="btn" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener">
            Distribuie pe X
          </a>
          <a class="btn" href="https://wa.me/?text=${encodeURIComponent(post.title + ' ' + canonical)}" target="_blank" rel="noopener">
            Trimite pe WhatsApp
          </a>
        </div>
      </div>
    </div>`;
}

/* =============================================================================
   MICRO-INTERACȚIUNI - FUNCȚIONALITATE EXTINSĂ
   (FĂRĂ MODIFICĂRI - funcționează perfect)
   ========================================================================== */

// ========== 1. STICKY NAVBAR – FADE SUBTIL LA SCROLL ==========
function initStickyNavbar() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScroll = 0;
  const scrollThreshold = 100;

  function handleScroll() {
    const currentScroll = window.pageYOffset;

    if (currentScroll > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }

  // Throttle pentru performanță
  let ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ========== 2. RIPPLE EFFECT PE BUTOANE ==========
function initRippleEffect() {
  const buttons = document.querySelectorAll('.btn, .svc-cta, .more-btn');

  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('btn-ripple');

      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      this.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
}

// ========== 3. INTERSECTION OBSERVER – SCROLL REVEALS ==========
function initScrollReveals() {
  const revealElements = document.querySelectorAll(
    '.service-card, .card.product, .rev-card, .about-teaser__inner'
  );

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-element', 'revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach((element, index) => {
    element.classList.add('reveal-element');
    
    if (element.parentElement.classList.contains('product-grid') ||
        element.parentElement.classList.contains('services-grid')) {
      const delayClass = `delay-${Math.min((index % 3) * 100, 300)}`;
      element.classList.add(delayClass);
    }

    observer.observe(element);
  });
}

// ========== 4. SMOOTH SCROLL PENTRU ANCHOR LINKS ==========
function initSmoothScroll() {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId === '#' || targetId === '#top') return;

      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        e.preventDefault();
        
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
        const targetPosition = targetElement.offsetTop - headerHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ========== 5. LAZY LOAD IMAGES ==========
function initLazyLoad() {
  if ('loading' in HTMLImageElement.prototype) {
    return;
  }

  const lazyImages = document.querySelectorAll('img[data-src]');
  
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        imageObserver.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => imageObserver.observe(img));
}

// ========== 6. FORM VALIDATION SUBTILĂ ==========
function initFormValidation() {
  const forms = document.querySelectorAll('form');

  forms.forEach(form => {
    const inputs = form.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        if (this.hasAttribute('required') && !this.value.trim()) {
          this.style.borderColor = '#ef4444';
          this.setAttribute('aria-invalid', 'true');
        } else {
          this.style.borderColor = '';
          this.removeAttribute('aria-invalid');
        }
      });

      input.addEventListener('input', function() {
        if (this.hasAttribute('required') && this.value.trim()) {
          this.style.borderColor = '#22c55e';
          this.removeAttribute('aria-invalid');
        }
      });
    });
  });
}

// ========== 7. CARD HOVER PARALLAX (OPȚIONAL) ==========
function initCardParallax() {
  if (window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) {
    const cards = document.querySelectorAll('.card.product, .service-card');

    cards.forEach(card => {
      card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / centerY * 2;
        const rotateY = (centerX - x) / centerX * 2;

        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
      });

      card.addEventListener('mouseleave', function() {
        this.style.transform = '';
      });
    });
  }
}

// ========== 8. VIDEO PRELOAD ==========
function initVideoPreload() {
  const video = document.querySelector('.hero-bg');
  if (!video) return;

  video.addEventListener('loadeddata', function() {
    this.style.opacity = '1';
  });

  video.addEventListener('error', function() {
    console.warn('Video-ul nu s-a putut încărca');
  });
}

// ========== 9. ACCESSIBILITY HELPERS ==========
function initAccessibility() {
  const drawer = document.querySelector('.drawer');
  const hamburger = document.querySelector('.hamb');

  if (hamburger && drawer) {
    hamburger.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      if (!isExpanded) {
        setTimeout(() => {
          const firstLink = drawer.querySelector('a');
          if (firstLink) firstLink.focus();
        }, 100);
      }
    });
  }

  // Skip to main content link
  const skipLink = document.createElement('a');
  skipLink.href = '#main';
  skipLink.textContent = 'Sari la conținut';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--eco-accent);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 100;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  document.body.insertBefore(skipLink, document.body.firstChild);
}

// ========== 10. REDUCED MOTION SUPPORT ==========
function respectReducedMotion() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (prefersReducedMotion.matches) {
    document.documentElement.style.setProperty('--transition-smooth', 'none');
    document.documentElement.style.setProperty('--transition-soft', 'none');
    
    console.log('♿ Reduced motion activat - animații dezactivate');
  }
}

// ========== Bootstrap COMPLET ==========
document.addEventListener('DOMContentLoaded', ()=>{
  console.log('🚜 Tractoare Tecuci - Inițializare completă...');

  // UI Base
  uiBase();
  setupMenu();
  setupContact();

  // Micro-Interacțiuni
  respectReducedMotion();
  initStickyNavbar();
  initRippleEffect();
  initScrollReveals();
  initSmoothScroll();
  initLazyLoad();
  initFormValidation();
  initCardParallax();
  initVideoPreload();
  initAccessibility();

  // Pagini
  const page=document.body.dataset.page||'';
  if(page==='home')   pageHome();
  if(page==='list')   pageList();
  if(page==='detail') pageDetail();
  if(page==='blog')   pageBlog();
  if(page==='post')   pagePost();

  console.log('✅ Site + Micro-interacțiuni + SEO "second hand" active!');
});

/* =============================================================================
   FIN APP.JS COMPLET CU ALT TEXT "SECOND HAND" INVIZIBIL
   
   📊 REZUMAT MODIFICĂRI SEO:
   - ✅ cardProduct(): ALT text pentru homepage + products.html
   - ✅ pageDetail(): ALT text pentru galerie produs individual
   - ✅ pageBlog(): ALT text pentru carduri articole blog
   - ✅ pagePost(): ALT text pentru cover image articol
   
   🎯 REZULTAT:
   - Utilizatorii văd: imagini normale, ZERO text "second hand" vizibil
   - Google vede: ALT text "second hand" pentru indexare Google Images
   - SEO boost: rankings pentru "tractoare second hand", "utilaje second hand romania"
   ========================================================================== */