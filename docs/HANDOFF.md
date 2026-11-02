# Handoff tractoaretecuci.ro (03.11.2026)

## Stare

- Toată lucrarea e pe ramura `upgrade/site-2026-11`. `main` (site-ul live) nu a fost atins.
- Previzualizare publică a ramurii: https://upgrade-site-2026-11.tractoare-tecuci.pages.dev (Cloudflare îi pune `noindex`).
- Publicarea = merge în `main` (Cloudflare Pages publică automat). Se face doar cu acordul proprietarului.

## Cifrele (PageSpeed, telefon / calculator)

<!-- @after -->

## Ce s-a schimbat

- **Stocul vine din OLX.** `node tools/sync-olx.mjs` citește magazinul https://compaia.olx.ro/home/ și fiecare anunț (titlu, marcă, an, ore, țară, descriere, poze). Prețurile nu se preiau (alegerea proprietarului). Corecturile de ortografie pe anunțuri stau în `data/products.overrides.json`.
- **Specificații de model de pe TractorData**, doar unde modelul și anii de producție se potrivesc exact (7 din 15). Lista și motivele pentru cele lăsate deoparte sunt în `data/specs.map.json`.
- **Pagini statice** în loc de pagini construite din JavaScript: fiecare utilaj are adresa lui (`/utilaje/<slug>`), plus categorii (`/utilaje/tractoare`, `/utilaje/incarcatoare-telescopice`) și articolele (`/blog/<slug>`). Linkurile vechi `?slug=` trimit automat la paginile noi.
- **Design în aceeași temă, îmbunătățit:** paletă unitară (verde de câmp, olivul din logo, galben de semnalizare), fonturi Inter (text) și Barlow Semi Condensed (titluri), iconițe Font Awesome, galerie cu glisare, vizualizator pe tot ecranul, bară Sună / WhatsApp pe telefon, contact simplu (Sună, WhatsApp, Email, hartă la cerere).
- **Video hero** de la 4,6 MB la 1,0 MB (calculator) și 0,5 MB (telefon), cu poster afișat imediat, buton de pauză și oprire la economizor de date.
- **Fără trackere și fără cereri către Google înainte de un clic.** Harta Google se încarcă doar la „Arată harta”. Bannerul de cookie-uri (Statistici și Marketing separate, Consent Mode v2) e gata, dar apare doar când se completează un ID GA4.
- **SEO și AI:** titluri și descrieri noi, date structurate (firmă, utilaje, articole, breadcrumbs), sitemap corect, `robots.txt` curat, `llms.txt` și `llms-full.txt`, `security.txt`, favicon pentru Google, imagine de distribuire 1200×630.
- **Accesibilitate:** fără probleme axe grave; contrast, ordinea titlurilor, tastatură, mișcare redusă.

## Cum lucrezi de acum

Din folderul `D:\TT Site` (o singură dată: `cd tools; npm install`):

```bash
node tools/sync-olx.mjs        # aduce anunțurile noi de pe OLX
node tools/tractordata.mjs     # specificațiile de model (după data/specs.map.json)
node tools/build.mjs           # regenerează paginile
node tools/check-links.mjs     # verifică linkurile
```

Apoi commit și push. Textele paginilor sunt în `src/pages/`, stilurile în `src/css/`, iar telefonul, emailul, adresa, programul și ID-ul GA4 în `data/site.json`. HTML-ul de la rădăcină se generează: nu se editează direct.

## Acțiunile proprietarului

1. **Acordul pentru publicare** (merge în `main`).
2. **Datele firmei** pentru Legea 365/2002: CUI și nr. Reg. Com. pentru II Mirza Nicoleta, în `data/site.json` → `company`. Blocul apare automat în subsol.
3. **Google Analytics (opțional):** ID-ul `G-...` în `data/site.json` → `ga4Id`, apoi build. Bannerul de consimțământ apare abia atunci.
4. **De verificat în anunțurile OLX:** Fendt 209 S are 85 de ore în câmpul „Ore de lucru”; Massey Ferguson 7724 are anul 2019 în câmp și 2018 în text; la Merlo 34.10 textul spune „2025140 CP”.
5. **Imaginile de prezentare** (servicii, despre noi, blog): dacă nu sunt poze proprii, trebuie marcate „Imagine ilustrativă”. Spune-ne care sunt.
6. **Cloudflare (opțional):** `http://tractoaretecuci.ro` face 2 redirecționări până la `https://www.` (o regulă de redirect în Cloudflare le face una). Setarea „AI Crawl Control” blochează crawlerele de antrenare AI (GPTBot, ClaudeBot, Google-Extended); crawlerele de căutare AI au voie. E o alegere, nu o eroare.
7. **După publicare, în Search Console** (proprietatea e deja verificată prin DNS): trimite `https://www.tractoaretecuci.ro/sitemap.xml` și cere indexarea paginilor noi de utilaje, circa 10 pe zi.

## Starea Google (fără autentificare)

<!-- @google -->
