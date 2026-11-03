# Handoff tractoaretecuci.ro (03.11.2026)

## Stare

- Toată lucrarea e pe ramura `upgrade/site-2026-11`. `main` (site-ul live) nu a fost atins.
- Previzualizare publică a ramurii: https://upgrade-site-2026-11.tractoare-tecuci.pages.dev (Cloudflare îi pune `noindex`).
- Publicarea = merge în `main` (Cloudflare Pages publică automat). Se face doar cu acordul proprietarului.

## Cifrele (PageSpeed, Performance / Accesibilitate / Best Practices, LCP, CLS)

| Pagina | Telefon înainte | Telefon după | Calculator înainte | Calculator după |
|---|---|---|---|---|
| `/` | 98 / 91 / 96, 1,5 s, 0,085 | **99 / 100 / 100**, 1,6 s, 0,001 | 100 / 91 / 96, 0,2 s, 0,057 | **99 / 100 / 100**, 0,5 s, 0 |
| `/utilaje` | 99 / 95 / 100, 2,1 s, 0 | **100 / 100 / 100**, 1,5 s, 0 | 100 / 95 / 100, 0,5 s, 0,044 | **100 / 100 / 100**, 0,3 s, 0,013 |
| pagina de utilaj | 73 / 95 / 100, 2,7 s, **0,808** | **99 / 100 / 100**, 2,1 s, 0 | 77 / 95 / 100, 0,3 s, **0,64** | **100 / 100 / 100**, 0,4 s, 0 |
| `/contact` | 100 / 94 / 100, 1,5 s, 0 | **100 / 100 / 100**, 0,9 s, 0,002 | 100 / 94 / 100, 0,2 s, 0 | **100 / 100 / 100**, 0,3 s, 0,001 |

„Înainte” = site-ul live (02.11.2026, pagina de utilaj: `/product?slug=fendt-820-…`). „După” = previzualizarea ramurii (03.11.2026, `/utilaje/fendt-820-vario-tms-2011`). SEO apare 69 pe previzualizare doar pentru că Cloudflare pune `noindex` pe adresele de test; toate celelalte verificări SEO trec (`node tools/seo-check.mjs`, 34 de pagini). Scorurile PageSpeed variază cu ±1 de la o rulare la alta.

Auditul SiteKit complet (34 de pagini, Chrome și WebKit): problemele reale găsite au fost reparate; ce a rămas e specific testului local (http, headere puse de Cloudflare) sau imaginile OG ale utilajelor, care există abia după publicare pe domeniul live. Testul pe 4 browsere (Chrome, Edge, Firefox, WebKit) la 320/390/768/1440/1920 px trece pe 14 pagini.

## Ce s-a schimbat

- **Stocul vine din OLX.** `node tools/sync-olx.mjs` citește magazinul https://compaia.olx.ro/home/ și fiecare anunț (titlu, marcă, an, ore, țară, descriere, poze). Prețurile nu se preiau (alegerea proprietarului). Corecturile de ortografie pe anunțuri stau în `data/products.overrides.json`.
- **Specificații de model de pe TractorData**, doar unde modelul și anii de producție se potrivesc exact (7 din 15). Lista și motivele pentru cele lăsate deoparte sunt în `data/specs.map.json`.
- **Pagini statice** în loc de pagini construite din JavaScript: fiecare utilaj are adresa lui (`/utilaje/<slug>`), plus categorii (`/utilaje/tractoare`, `/utilaje/incarcatoare-telescopice`) și articolele (`/blog/<slug>`). Linkurile vechi `?slug=` trimit automat la paginile noi; utilajele vândute redirecționează (301) spre categoria lor.
- **Design în aceeași temă, îmbunătățit:** paletă unitară (verde de câmp, olivul din logo, galben de semnalizare), fonturi Inter (text) și Barlow Semi Condensed (titluri), iconițe Font Awesome, galerie cu glisare și vizualizator pe tot ecranul, bară Sună / WhatsApp pe telefon, contact simplu (Sună, WhatsApp, Email, hartă la cerere). Finisare cu skill-ul `impeccable` (contrast, stări de hover, ierarhie), verificare SEO cu checklist-ul `searchfit-seo`.
- **Video hero** de la 4,6 MB la 1,0 MB (calculator) și 0,5 MB (telefon), cu poster afișat imediat, buton de pauză și oprire la economizor de date.
- **Fără trackere și fără cereri către Google înainte de un clic.** Harta Google se încarcă doar la „Arată harta”. Bannerul de cookie-uri (Statistici și Marketing separate, Consent Mode v2) e gata, dar apare doar când se completează un ID GA4.
- **SEO și AI:** titluri și descrieri noi, date structurate (firmă, utilaje, articole, breadcrumbs), sitemap corect, `robots.txt` curat, `llms.txt` și `llms-full.txt`, `security.txt`, favicon pentru Google, imagine de distribuire 1200×630.
- **Accesibilitate:** 100 în PageSpeed pe toate paginile măsurate; contrast, ordinea titlurilor, tastatură, mișcare redusă.

## Stocul automat

O singură comandă face tot: citește OLX, actualizează stocul și specificațiile, regenerează paginile și rulează verificările.

```bash
node tools/update-stock.mjs            # doar actualizează fișierele
node tools/update-stock.mjs --commit   # și face commit + push (publică dacă ești pe main)
```

- E sigură nesupravegheată: nu schimbă nimic dacă OLX arată brusc sub jumătate din anunțuri (blocare sau pagină incompletă), nu descarcă din nou pozele anunțurilor neschimbate (o rulare fără noutăți durează ~30 s) și nu lasă fișiere orfane.
- **Rulare automată de două ori pe zi** (aprox. 07–08 și 17–18): șablonul GitHub Actions e în `docs/stock-sync.workflow.yml`. Nu l-am putut urca activ, pentru că autentificarea GitHub de pe acest calculator nu are dreptul `workflow`. După merge în `main`, rulează o dată:

  ```bash
  gh auth refresh -s workflow
  ```

  apoi mută fișierul în `.github/workflows/stock-sync.yml`, commit și push. Dacă OLX blochează serverele GitHub (rularea apare ca eșuată în fila Actions, fără să strice nimic), alternativa e o sarcină programată în Windows pe un calculator care stă pornit, cu aceeași comandă.
- Un anunț nou de tractor apare automat; specificațiile TractorData pentru el se adaugă de mână în `data/specs.map.json` (scriptul afișează ce anunțuri noi nu au încă). Corecturile de diacritice pentru anunțurile noi merg în `data/products.overrides.json`.

## Cum lucrezi de acum

Din folderul `D:\TT Site` (o singură dată: `cd tools; npm install`):

```bash
node tools/build.mjs           # regenerează paginile
node tools/check-links.mjs     # verifică linkurile
node tools/seo-check.mjs       # verificările SEO
node tools/qa.mjs              # 4 browsere × 5 lățimi (cu node tools/serve.mjs pornit)
```

Textele paginilor sunt în `src/pages/`, stilurile în `src/css/`, iar telefonul, emailul, adresa, programul și ID-ul GA4 în `data/site.json`. HTML-ul de la rădăcină se generează: nu se editează direct. Graful graphify al codului e local în `graphify-out/` (`graphify update .` după schimbări).

## Acțiunile proprietarului

1. **Acordul pentru publicare** (merge în `main`).
2. **Datele firmei** pentru Legea 365/2002: CUI și nr. Reg. Com. pentru II Mirza Nicoleta, în `data/site.json` → `company`. Blocul apare automat în subsol.
3. **Google Analytics (opțional):** ID-ul `G-...` în `data/site.json` → `ga4Id`, apoi build. Bannerul de consimțământ apare abia atunci.
4. **De verificat în anunțurile OLX:** Fendt 209 S are 85 de ore în câmpul „Ore de lucru”; Massey Ferguson 7724 are anul 2019 în câmp și 2018 în text; la Merlo 34.10 textul spune „2025140 CP”.
5. **Imaginile de prezentare** (servicii, despre noi, blog): dacă nu sunt poze proprii, trebuie marcate „Imagine ilustrativă”. Spune-ne care sunt.
6. **Stocul automat:** `gh auth refresh -s workflow`, apoi activarea workflow-ului (secțiunea de mai sus).
7. **Cloudflare (opțional):** `http://tractoaretecuci.ro` face 2 redirecționări până la `https://www.` (o regulă de redirect în Cloudflare le face una). Setarea „AI Crawl Control” blochează crawlerele de antrenare AI (GPTBot, ClaudeBot, Google-Extended); crawlerele de căutare AI au voie. E o alegere, nu o eroare.
8. **După publicare, în Search Console** (proprietatea e deja verificată prin DNS): trimite `https://www.tractoaretecuci.ro/sitemap.xml` și cere indexarea paginilor noi de utilaje, circa 10 pe zi.
9. **După publicare:** verifică videoul din hero pe un iPhone (Safari cere răspuns 206 la video; domeniul live îl dă, adresa de test `pages.dev` nu).

## Starea Google (fără autentificare)

- **Search Console:** domeniul e verificat prin înregistrarea DNS `google-site-verification`. Starea indexării se vede doar din cont.
- **Bing Webmaster Tools:** verificat prin `BingSiteAuth.xml`.
- **Google Business Profile:** există, „Tractoare Tecuci”, categoria „Dealer de tractoare”, 4,6 stele din 9 recenzii, aceeași adresă și același telefon ca site-ul. Linkul site-ului din profil poate primi `?utm_source=google&utm_medium=gbp`, ca vizitele să se vadă separat în GA4.
- **„Surse preferate” Google:** pagina cere autentificare; neverificat.
