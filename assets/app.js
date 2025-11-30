// ========== helpers ==========
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = n => (n || 0).toLocaleString('ro-RO');
const getJSON = path => fetch(path, { cache: 'no-store' }).then(r => r.json());

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

// Card produs (fara pret) + CTA
function cardProduct(p){
  const hoursDisplay = p.hours && p.hours > 0 
    ? `${p.year || ""} · ${fmt(p.hours)} ore` 
    : `${p.year || ""}`;

  return `
<a class="card product" href="product.html?slug=${encodeURIComponent(p.slug)}">
  <div class="media"><img loading="lazy" src="${p.cover}" alt="${p.title}"></div>
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
    const category=fd.get('category')||'';
    const brand=fd.get('brand')||'';
    const maxHours=+fd.get('maxHours')||0;

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

// ========== DETAIL ==========
async function pageDetail(){
  const wrap=$('#detailWrap'); if(!wrap) return;
  const items=await getJSON('data/products.json');
  const slug=new URL(location.href).searchParams.get('slug');
  const item=items.find(p=>p.slug===slug);
  if(!item){wrap.innerHTML='<p>Produsul nu există.</p>'; return;}

  document.title=`${item.title} – Tractoare Tecuci`;

  const hb=$('#prodHeadBrand'), ht=$('#prodHeadTitle');
  if(hb){ hb.textContent=item.brand||''; hb.hidden=!item.brand; }
  if(ht){ ht.textContent=item.title||''; ht.hidden=!item.title; }

  const gallery=[item.cover,...(item.gallery||[])];
  const galleryHTML=`
    <div class="g-main"><img src="${gallery[0]}" alt="${item.title}"></div>
    <div class="g-thumbs">
      ${gallery.map((g,i)=> i===0 ? '' : `<img src="${g}" alt="${item.title} imagine ${i}">`).join('')}
    </div>`;

  let rows=''; const s=item.specs||[];
  for(let i=0;i<s.length;i+=2){
    rows+=`<div class="spec-grid">
      <div class="spec"><strong>${s[i]?.k||''}:</strong> ${s[i]?.v||''}</div>
      <div class="spec"><strong>${s[i+1]?.k||''}:</strong> ${s[i+1]?.v||''}</div>
    </div>`;
  }

  const hoursHTML = item.hours && item.hours > 0 
    ? `<div class="item">Ore: <strong>${item.hours.toLocaleString('ro-RO')}</strong></div>` 
    : '';

  const olxButton = item.olx_link 
    ? `<a class="btn btn-outline" href="${item.olx_link}" target="_blank" rel="noopener noreferrer">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
           <polyline points="15 3 21 3 21 9"></polyline>
           <line x1="10" y1="14" x2="21" y2="3"></line>
         </svg>
         Vezi pe OLX
       </a>` 
    : '';

  wrap.innerHTML=`
    <div class="gallery">${galleryHTML}</div>
    <div class="info">
      <p class="snippet">${item.short_desc||''}</p>
      <div class="meta">
        <div class="item">An: <strong>${item.year||'—'}</strong></div>
        ${hoursHTML}
      </div>
      <div class="cta">
        <a class="ask-offer" href="contact.html">Solicită ofertă</a>
        ${olxButton}
      </div>
      <span class="cta-note">Consultanță, transport & finanțare disponibile.</span>
      <div class="specs">
        <h3>Specificații</h3>
        ${rows || '<p class="muted">Fără specificații suplimentare.</p>'}
      </div>
    </div>`;
}

// ========== BLOG LIST ==========
async function pageBlog(){
  const list = $('#blogList'); 
  if (!list) return;

  const posts = await getJSON('data/posts.json');

  const card = (p) => `
    <a class="card post-card" href="post.html?p=${encodeURIComponent(p.slug)}">
      <img loading="lazy" src="${p.cover || ''}" alt="${p.alt || p.title}">
      <div class="body">
        <h3>${p.title}</h3>
        <p class="muted">${p.excerpt || ''}</p>
      </div>
    </a>`;

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

// ========== BLOG POST ==========
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

  wrap.innerHTML = `
    <header class="post-hero">
      <h1 class="post-title">${post.title}</h1>
      <div class="post-meta">${fmtDate(post.date)} · ${post.author || 'Tractoare Tecuci'} · ${readTime} min citire</div>
      <figure class="post-cover">
        <img src="${post.cover}" alt="${post.alt || post.title}" loading="eager" decoding="async">
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

// ========== ADMIN ==========
function download(name, content, mime='application/json'){
  const a=document.createElement('a'); 
  a.href=URL.createObjectURL(new Blob([content],{type:mime}));
  a.download=name; 
  a.click(); 
  URL.revokeObjectURL(a.href);
}

async function pageAdmin(){
  if(document.body.dataset.page!=='admin') return;

  let products=[]; 
  const listP=$('#adminProducts'), dlgP=$('#dlgProduct'), frmP=$('#frmProduct');
  
  const renderP=()=>{
    listP.innerHTML=products.map(p=>`
      <div class="card">
        <div class="body">
          <strong>${p.title}</strong>
          <div class="muted">${p.brand} · ${p.category}</div>
          <p>
            <button class="btn" data-edit="${p.slug}">Editează</button>
            <button class="btn" data-del="${p.slug}">Șterge</button>
          </p>
        </div>
      </div>`).join('');
  };
  
  try{
    products=await getJSON('data/products.json'); 
    renderP();
  }catch(e){}

  $('#importProducts').onchange=async e=>{
    const f=e.target.files[0]; 
    if(!f) return; 
    products=JSON.parse(await f.text()); 
    renderP();
  };
  
  $('#exportProducts').onclick=()=>download('products.json', JSON.stringify(products,null,2));
  
  $('#newProduct').onclick=()=>{
    if(!frmP) return;
    frmP.reset(); 
    frmP.dataset.mode='new';
    $('#dlgProductTitle').textContent='Produs nou';
    dlgP?.showModal();
  };
  
  listP?.addEventListener('click',e=>{
    const b=e.target.closest('button'); 
    if(!b) return;
    const slug=b.dataset.edit||b.dataset.del; 
    const i=products.findIndex(x=>x.slug===slug);
    
    if(b.dataset.edit){
      const p=products[i]; 
      if(!frmP) return;
      frmP.reset(); 
      frmP.dataset.mode='edit'; 
      frmP.dataset.slug=p.slug;
      $('#dlgProductTitle').textContent='Editează produs';
      frmP.title.value=p.title||''; 
      frmP.slug.value=p.slug||'';
      frmP.brand.value=p.brand||''; 
      frmP.category.value=p.category||'';
      frmP.year.value=p.year||''; 
      frmP.hours.value=p.hours||'';
      frmP.status.value=p.status||'In stoc';
      frmP.cover.value=p.cover||'';
      frmP.gallery.value=(p.gallery||[]).join(', ');
      frmP.short_desc.value=p.short_desc||'';
      frmP.specs.value=JSON.stringify(p.specs||[],null,2);
      dlgP?.showModal();
    } else if(b.dataset.del){
      if(confirm('Ștergi produsul?')){ 
        products.splice(i,1); 
        renderP(); 
      }
    }
  });
  
  frmP?.addEventListener('close',()=>{
    if(frmP.returnValue!=='ok') return;
    try{
      const p={
        title:frmP.title.value.trim(),
        slug:frmP.slug.value.trim(),
        brand:frmP.brand.value.trim(),
        category:frmP.category.value,
        year:+frmP.year.value||0,
        hours:+frmP.hours.value||0,
        status:frmP.status.value.trim()||'In stoc',
        cover:frmP.cover.value.trim(),
        gallery:frmP.gallery.value.split(',').map(s=>s.trim()).filter(Boolean),
        short_desc:frmP.short_desc.value.trim(),
        specs:JSON.parse(frmP.specs.value||'[]')
      };
      if(!p.title||!p.slug) throw new Error('Titlu și slug obligatorii.');
      const i=products.findIndex(x=>x.slug===p.slug);
      if(frmP.dataset.mode==='new'){
        if(i>-1) throw new Error('Slug existent.');
        products.unshift(p);
      } else {
        products[i]=p;
      }
      renderP();
    }catch(err){ 
      alert(err.message); 
    }
  });

  // POSTS
  let posts=[]; 
  const listB=$('#adminPosts'), dlgB=$('#dlgPost'), frmB=$('#frmPost');
  
  const renderB=()=>{
    listB.innerHTML=posts.map(p=>`
      <div class="card">
        <div class="body">
          <strong>${p.title}</strong>
          <p class="muted">${p.excerpt||''}</p>
          <p>
            <button class="btn" data-edit="${p.slug}">Editează</button>
            <button class="btn" data-del="${p.slug}">Șterge</button>
          </p>
        </div>
      </div>`).join('');
  };
  
  try{
    posts=await getJSON('data/posts.json'); 
    renderB();
  }catch(e){}

  $('#importPosts').onchange=async e=>{
    const f=e.target.files[0]; 
    if(!f) return; 
    posts=JSON.parse(await f.text()); 
    renderB();
  };
  
  $('#exportPosts').onclick=()=>download('posts.json', JSON.stringify(posts,null,2));
  
  $('#newPost').onclick=()=>{
    frmB.reset(); 
    frmB.dataset.mode='new'; 
    $('#dlgPostTitle').textContent='Articol nou'; 
    dlgB.showModal();
  };
  
  listB?.addEventListener('click',e=>{
    const b=e.target.closest('button'); 
    if(!b) return;
    const slug=b.dataset.edit||b.dataset.del; 
    const i=posts.findIndex(x=>x.slug===slug);
    
    if(b.dataset.edit){
      const p=posts[i];
      frmB.reset(); 
      frmB.dataset.mode='edit'; 
      frmB.dataset.slug=p.slug;
      $('#dlgPostTitle').textContent='Editează articol';
      frmB.title.value=p.title; 
      frmB.slug.value=p.slug; 
      frmB.cover.value=p.cover||'';
      frmB.excerpt.value=p.excerpt||''; 
      frmB.html.value=p.html||''; 
      dlgB.showModal();
    } else if(b.dataset.del){
      if(confirm('Ștergi articolul?')){ 
        posts.splice(i,1); 
        renderB(); 
      }
    }
  });
  
  frmB?.addEventListener('close',()=>{
    if(frmB.returnValue!=='ok') return;
    try{
      const p={
        title:frmB.title.value.trim(),
        slug:frmB.slug.value.trim(),
        cover:frmB.cover.value.trim(),
        excerpt:frmB.excerpt.value.trim(),
        html:frmB.html.value
      };
      if(!p.title||!p.slug) throw new Error('Titlu și slug obligatorii.');
      const i=posts.findIndex(x=>x.slug===slug);
      if(frmB.dataset.mode==='new'){
        if(i>-1) throw new Error('Slug existent.');
        posts.unshift(p);
      } else {
        posts[i]=p;
      }
      renderB();
    }catch(err){ 
      alert(err.message); 
    }
  });

  // SEO helpers
  $('#genSitemap').onclick=()=>{
    const base=location.origin+location.pathname.replace(/\/admin\.html.*$/,'');
    const urls=[
      `${base}/index.html`,
      `${base}/utilaje.html`,
      `${base}/products.html`,
      `${base}/blog.html`
    ];
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`;
    download('sitemap.xml', xml, 'application/xml');
  };
  
  $('#genRobots').onclick=()=>{
    const base=location.origin+location.pathname.replace(/\/admin\.html.*$/,'');
    download('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml`, 'text/plain');
  };
}

// ========== Bootstrap ==========
document.addEventListener('DOMContentLoaded', ()=>{
  uiBase();
  setupMenu();
  setupContact();

  const page=document.body.dataset.page||'';
  if(page==='home')   pageHome();
  if(page==='list')   pageList();
  if(page==='detail') pageDetail();
  if(page==='blog')   pageBlog();
  if(page==='post')   pagePost();
  if(page==='admin')  pageAdmin();
});