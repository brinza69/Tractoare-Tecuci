# Handoff tractoaretecuci.ro (14.11.2026)

## Actualizare 14.11.2026: ce mai trebuie de la proprietar

„Acțiunile proprietarului” (mai jos) e reverificată pe 14.11 pe site-ul live, în cele 15 anunțuri OLX active (aceleași ca pe site) și pe fișa publică Google Maps. Pe scurt: datele firmei sunt în registrul ANAF, proprietarul doar confirmă; cele trei neclarități din anunțurile OLX sunt tot acolo; profilul Google are tot sâmbătă 09–12 și linkul fără UTM; imaginile de prezentare sunt de stoc sau generate. Lucrurile care nu depind de proprietar sunt separate, în „De făcut de administrator”.

**Răspunsuri primite pe 14.11 (prin Alex):** Fendt 209 S are 8.500 de ore (corectat pe site); Massey Ferguson 7724 rămâne 2019; Merlo 34.10 are 140 CP (trecut în descriere); sâmbăta rămâne 10–14; nici proprietarul nu are acces la profilul Google; are poze proprii. Datele firmei din registrul ANAF sunt confirmate și puse pe site: în subsol pe toate paginile, în JSON-LD și ca operator în confidențialitate și termeni (`{{operator}}`, versiunea politicii 14.11.2026). Fără răspuns: statisticile și emailul pe domeniu. `tools/sync-olx.mjs` acceptă acum `year` și `hours` în `data/products.overrides.json`, pentru valorile confirmate de proprietar care diferă de câmpurile din OLX.

## Actualizare 04.11.2026 (a doua): design și blog automat

**Design** (commit c41721b; mai multe detalii în mesajul commit-ului):
- **Navbar:** pilulă plutitoare. Pe prima pagină stă transparentă peste film, cu text alb, și devine albă la derulare; pe celelalte pagini e albă de la început. Pe telefon, „Contact” e în meniul burger, nu în bară.
- **Meniul de pe telefon:** pe tot ecranul (dialog nativ), cu linkuri mari, categorii, Sună / WhatsApp și programul. Se închide cu Esc sau cu X.
- **Cardurile cu utilaje:** poza ocupă tot cardul, cu o corecție fină de culoare; marca, modelul, anul, orele și proveniența stau pe un gradient închis. Fără chenar alb.
- **Butoanele:** colțuri continue (squircle, ca la Apple) unde browserul le suportă, verde închis, fără efecte strălucitoare. Pe film, butonul principal e crem și cel secundar „de sticlă”.
- **Mișcare:** o singură curbă de animație; secțiunile apar la derulare, iar trecerea între pagini se face cu o estompare scurtă. Nimic din toate acestea la „mișcare redusă”.
- **Verificat:** PageSpeed pe live 100 / 100 / 100 / 100 pe telefon (LCP 1,2 s, CLS 0,001) și 100 pe calculator; axe fără probleme; testul pe 4 browsere × 5 lățimi trece; meniul și consimțământul trec în Chrome, WebKit și Firefox.

**Blog automat, zilnic** (commit 9d81140):
- Taskul programat „Blog zilnic Tractoare Tecuci” rulează în aplicația Claude de pe acest calculator, zilnic la ~08:43. Dacă aplicația e închisă la ora aceea, rulează la următoarea pornire.
- Ia următorul subiect din `data/blog-plan.json` (30 de subiecte, legate de utilajele din stoc și de întrebările cumpărătorilor), se documentează din surse, scrie articolul și îl trece prin `tools/new-post.mjs`. Scriptul respinge articolul dacă e prea scurt, are linkuri moarte, prețuri, alt telefon, promisiuni neconfirmate sau o copertă care nu e poza reală a unui utilaj din stoc. Abia apoi construiește site-ul, rulează verificările și publică.
- Fiecare articol listează la final sursele folosite. Subiectele noi se adaugă la finalul `data/blog-plan.json`, cu `"status": "todo"`.
- **De știut:** Google penalizează conținutul produs în masă fără valoare. De aceea verificările sunt stricte, iar un articol care nu le trece nu se publică (subiectul e marcat `skipped`). Recomandarea mea: o privire pe articole în primele două săptămâni; dacă nu sunt bune, taskul se oprește din aplicație (Scheduled → Blog zilnic Tractoare Tecuci → dezactivare).

**Linkul din Google Business Profile:** `?utm_source=google&utm_medium=gbp` doar marchează în GA4 vizitele venite din profil; adresa canonică rămâne cea simplă. Profilul nu e administrat din conturile de pe acest calculator, deci nu l-am modificat.

## Actualizare 04.11.2026: Google Analytics, Search Console, întrebări frecvente

Totul de mai jos e pe **contul Google al lui Alex** (administratorul site-ului), singurul proprietar al proprietății Search Console. Adresa contului nu e scrisă aici, pentru că `docs/` se poate deschide public.

**GA4** (contul Analytics „Alex Brînzei”, 405279578, unde e și Impecabil):
- Proprietatea **Tractoare Tecuci**, ID **562146511**, fus orar România, monedă RON.
- Flux web `https://www.tractoaretecuci.ro`, ID **16265207559**, Measurement ID **`G-ZYBRN9TW7B`** (în `data/site.json` → `ga4Id`).
- Păstrarea datelor: **14 luni** pentru evenimente și utilizatori, ca în politica de confidențialitate.
- Măsurare îmbunătățită activă, fără „Interacțiuni cu formulare”: singurul formular de pe site e bannerul de cookie-uri, pe care GA îl număra ca formular.
- **Evenimente-cheie:** `click_phone`, `click_whatsapp`, `click_email` (create după nume, fără valoare în bani). `close_convert_lead` și `qualify_lead` sunt puse automat de Google și nu apar pe site.
- **Conectări:** Search Console `tractoaretecuci.ro` legat de fluxul web (03.11.2026).
- Verificat pe site-ul live, în Chrome și WebKit: nimic de la Google și niciun cookie `_ga` înainte de alegere; „Refuz” arată identic cu „Accept tot”; „Aleg eu” arată cele două bife, nebifate; „Statistici” încarcă GA4 și trimite `page_view`; retragerea din „Setări cookies” șterge `_ga*`. GA4 Realtime a văzut vizita de test și cele trei clicuri.

**Bannerul de cookie-uri**, reparat după primul test: bifele apăreau din prima vedere, fără buton de salvare; „Accept tot” era evidențiat de focus; pe telefoanele mici și în modul peisaj bannerul acoperea „Vezi stocul” și „Sună acum”. Acum prima vedere are doar Accept tot / Refuz / Aleg eu, fără buton evidențiat. Pe telefoanele mici bannerul se retrage cât timp ar acoperi butoanele din hero și apare la prima derulare; după „Aleg eu” nu se mai retrage.

**Search Console** (proprietate Domeniu `tractoaretecuci.ro`):
- Sitemap: `https://www.tractoaretecuci.ro/sitemap.xml` retrimis pe 03.11.2026, stare **Reușit**, 34 de pagini. Vechiul `sitemap-images.xml` (acum redirecționat) a fost eliminat.
- Inspectarea adreselor, 03.11.2026. Google acceptă circa 10–11 cereri pe zi; a 12-a a primit „Cotă depășită”.

| Adresa | Stare la 03.11 | Ce s-a făcut |
|---|---|---|
| `/`, `/utilaje`, `/products`, `/contact`, `/despre-noi`, `/blog` | indexate | nimic (nu se cere din nou) |
| `/utilaje/tractoare` | Google nu cunoaște adresa | indexare cerută |
| `/utilaje/fendt-718-vario-2021`, `john-deere-6125r-2015`, `massey-ferguson-7724-2019`, `fendt-930-vario-2008`, `fendt-820-vario-tms-2011`, `merlo-34-10-2007`, `fendt-farmer-309-ci-2009` | Google nu cunoaște adresa | indexare cerută |
| `/utilaje/mccormick-x4-80-xl-2020`, `fendt-415-vario-2010`, `massey-ferguson-2230-2011` | Descoperită, neindexată | indexare cerută |
| `/utilaje/fendt-favorit-512-c-1997`, `same-argon-75-f-2005`, `/utilaje/incarcatoare-telescopice` | Google nu cunoaște adresa | de cerut în zilele următoare |
| `/utilaje/mccormick-cx-85-2005`, `fendt-209-s-2005`, `fendt-farmer-307-lsa-1988` | Descoperită, neindexată | de cerut în zilele următoare |
| 9 articole din `/blog/…` | 6 descoperite, 3 necunoscute | după paginile de utilaje |
| `/termeni` / `/confidentialitate` | descoperită / accesată cu crawlere, neindexată | fără grabă |

**Întrebări frecvente și ghiduri** (pentru Google și pentru răspunsurile date de AI): `/utilaje` are 7 întrebări despre cumpărare (preț la telefon, proveniență, verificare tehnică, vizionare sau apel video, transport în țară și UE, opțiuni de plată, program), generate din `data/site.json` și doar din afirmații care erau deja pe site. Aceleași întrebări sunt în `llms-full.txt`, cu date structurate `FAQPage` pe `/utilaje` și pe `/despre-noi`. Paginile de categorie listează ghidurile din blog (7 la tractoare, 2 la încărcătoare telescopice). Textul principal de pe `/utilaje` a crescut de la 46 la 215 cuvinte.

**Google Business Profile**, nemodificat: „Tractoare Tecuci”, Dealer de tractoare, 4,6 stele din 9 recenzii, adresa și telefonul identice cu site-ul. Niciun cont Google logat pe acest calculator nu administrează profilul. Diferențe față de site: **sâmbătă 09–12 în profil, 10–14 pe site**, iar linkul site-ului nu are UTM.

## Stare

- **Publicat pe 03.11.2026** cu acordul proprietarului: `main` = ramura `upgrade/site-2026-11` (fast-forward), Cloudflare a publicat în ~20 s.
- Verificat pe domeniul live: toate paginile răspund 200, redirecționările vechi duc la paginile noi, videoul răspunde 206 (merge în Safari), pozele au cache de un an, `docs/`, `tools/`, `src/` și `tractoare-tecuci.pages.dev` sunt `noindex`, emailul nu mai e rescris de Cloudflare.
- Live, PageSpeed: acasă pe telefon 100 / 100 / 100 / 100 (LCP 1,5 s, CLS 0,001); pagina de utilaj 99 / 100 / 100 / 100 pe telefon (LCP 2,1 s, CLS 0) și 100 / 100 / 100 / 100 pe calculator.
- Auditul SiteKit pe live: 1 eroare și 55 de avertismente, față de 47 de erori și 231 de avertismente înainte. Eroarea (prima poză din rândul de sus pe categorii, pe calculator) e reparată în commit-ul de după.

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
- **Fără trackere și fără cereri către Google înainte de un clic.** Harta Google se încarcă doar la „Arată harta”. Bannerul de cookie-uri (Statistici și Marketing separate, Consent Mode v2) e activ de pe 03.11.2026, cu GA4 `G-ZYBRN9TW7B`.
- **SEO și AI:** titluri și descrieri noi, date structurate (firmă, utilaje, articole, breadcrumbs), sitemap corect, `robots.txt` curat, `llms.txt` și `llms-full.txt`, `security.txt`, favicon pentru Google, imagine de distribuire 1200×630.
- **Accesibilitate:** 100 în PageSpeed pe toate paginile măsurate; contrast, ordinea titlurilor, tastatură, mișcare redusă.

## Stocul automat

O singură comandă face tot: citește OLX, actualizează stocul și specificațiile, regenerează paginile și rulează verificările.

```bash
node tools/update-stock.mjs            # doar actualizează fișierele
node tools/update-stock.mjs --commit   # și face commit + push (publică dacă ești pe main)
```

- E sigură nesupravegheată: nu schimbă nimic dacă OLX arată brusc sub jumătate din anunțuri (blocare sau pagină incompletă), nu descarcă din nou pozele anunțurilor neschimbate (o rulare fără noutăți durează ~30 s) și nu lasă fișiere orfane. Cu `--commit` nu face nimic cât timp în folder sunt modificări nesalvate (cineva lucrează), pornește de la ce e live și scrie în commit utilajele noi și cele scoase.
- **Rulare automată de două ori pe zi, activă din 04.11.2026:** sarcina Windows „Tractoare Tecuci - stoc OLX” (Task Scheduler) rulează `tools/stock-sync.cmd` zilnic la 07:30 și 17:30. Dacă PC-ul e oprit la ora respectivă, rulează la pornire. Nu deschide nicio fereastră. Jurnalul e în `.tmp/stock-sync.log`. Testată pe 04.11: 15 anunțuri, stoc neschimbat. Merge doar cât timp acest PC e pornit și autentificat cu `gh`.
- **Alternativă care nu depinde de PC:** șablonul GitHub Actions din `docs/stock-sync.workflow.yml`. Are nevoie o singură dată de `gh auth refresh -s workflow` și de mutarea fișierului în `.github/workflows/stock-sync.yml`. Atunci sarcina Windows se poate opri, ca să nu ruleze de două ori. OLX poate bloca serverele GitHub.
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

## Acțiunile proprietarului (verificat 14.11.2026)

**Obligatoriu (Legea 365/2002, art. 5; GDPR, art. 13)**

1. **Identificarea firmei** (rezolvat 14.11, confirmat prin Alex). Registrul ANAF, 14.11.2026: **MÎRZA NICOLETA ÎNTREPRINDERE INDIVIDUALĂ**, CUI **30248262**, Nr. Reg. Com. **F2012000543175**, sediu Str. Tecuciul Nou nr. 25, Tecuci, Galați; activă, plătitoare de TVA, CAEN 4661 (comerț cu ridicata al mașinilor agricole). Sunt în `data/site.json` → `company` și apar în subsol, în JSON-LD și, prin `{{operator}}`, în politica de confidențialitate și în termeni.

**Corectitudine (date greșite sau neclare pe site)**

Anul și orele vin din câmpurile anunțului OLX. Când proprietarul confirmă altă valoare, ea se trece în `data/products.overrides.json` (`year`, `hours`) și are prioritate față de OLX.

2. **Fendt 209 S** (rezolvat 14.11): 8.500 de ore, în overrides (`hours`). Câmpul din OLX spune tot 85.
3. **Massey Ferguson 7724** (rezolvat 14.11): rămâne 2019, ca în câmpul din OLX; textul anunțului spune 2018, dar descrierea de pe site nu conține anul.
4. **Merlo 34.10** (rezolvat 14.11): 140 CP, trecut în descrierea din overrides. „2025” din textul anunțului rămâne neexplicat și nu apare pe site.
5. **Programul de sâmbătă** (confirmat 14.11): 10–14. Pe Google Maps e tot 09–12 până se rezolvă accesul (punctul 7).
6. **Imaginile de prezentare nu sunt poze proprii:** servicii, despre noi, categorii, coperțile celor 9 articole și cele trei fotografii de lângă recenziile de pe prima pagină sunt imagini de stoc sau generate. Camionul Scania nu e al firmei, deși textul alternativ spune că transportă utilaje spre România. Nu așteaptă răspunsul proprietarului: se marchează „Imagine ilustrativă” sau se înlocuiesc, iar fotografiile de lângă recenzii se scot. Pozele proprii (punctul 9) le înlocuiesc când vin.

**Acces la conturi**

7. **Google Business Profile** („Tractoare Tecuci”, 4,6 stele din 10 recenzii la 14.11): nu îl administrează nici Alex, nici proprietarul (14.11). Pasul următor: proprietarul, cu contul Google pe care vrea să-l folosească, caută firma pe business.google.com și cere acces. Google întreabă administratorul actual, iar dacă acesta nu răspunde, îi oferă proprietarului verificarea. Apoi îl adaugă pe Alex ca administrator. Până atunci, programul de sâmbătă se poate propune din Google Maps („Sugerează o modificare”). După acces: linkul `https://www.tractoaretecuci.ro/?utm_source=google&utm_medium=gbp` (acum fără UTM), sâmbătă 10–14, răspunsuri la recenzii, poze.

**Opțional**

8. **Statistici pentru proprietar:** o adresă Gmail a lui → GA4 → Administrare → Gestionarea accesului la proprietate, rol Vizualizator.
9. **Poze proprii** (14.11: proprietarul are; de primit): curtea cu utilaje, camionul sau platforma de transport, echipa, livrări la clienți (cu acordul lor). Merg în `assets/about/`, la servicii și în profilul Google.
10. **Email pe domeniu** (de exemplu `contact@` pe domeniul site-ului, redirecționat gratuit prin Cloudflare Email Routing spre adresa actuală): doar dacă îl vrea. Apoi `data/site.json` → `email`.

## De făcut de administrator

- **Search Console:** indexarea pentru adresele „de cerut” din tabelul de mai sus, apoi reinspectarea celor cerute pe 03.11 (circa 10 cereri pe zi). Starea nu a fost reverificată pe 14.11.
- **Blogul automat nu a publicat nimic:** până pe 14.11 `data/blog-plan.json` are 30 din 30 de subiecte `todo` și nu există niciun articol nou din 04.11, deși taskul rulează zilnic. De investigat.
- **Ore rotunjite în descrieri:** la Same Argon 75 F și Fendt 930 Vario titlul arată orele din câmp (4.852, 8.503), iar descrierea din overrides numărul rotunjit din text (4.800, 8.500). Se scoate numărul din descriere sau se scrie „circa”.
- **Stocul automat:** rulează de pe acest PC (sarcina Windows, vezi „Stocul automat”). Opțional, varianta GitHub Actions, care nu depinde de PC.
- **Cloudflare (opțional):** `http://tractoaretecuci.ro` face tot 2 redirecționări până la `https://www.` (o regulă de redirect le face una). „AI Crawl Control” blochează în continuare crawlerele de antrenare AI (GPTBot, ClaudeBot, Google-Extended); crawlerele de căutare AI au voie. E o alegere, nu o eroare.
- **Videoul din hero pe un iPhone:** de verificat (Safari cere răspuns 206 la video; domeniul live îl dă, adresa de test `pages.dev` nu).

## Starea Google

- **Search Console și GA4:** vezi „Actualizare 04.11.2026” de mai sus.
- **Bing Webmaster Tools:** verificat prin `BingSiteAuth.xml`; după indexarea în Google se poate importa din Search Console.
- **Google Ads:** nu a fost cerut; nu există cont.
- **„Surse preferate” Google:** pagina cere autentificare; neverificat.
