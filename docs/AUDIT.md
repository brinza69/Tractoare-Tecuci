# Audit inițial și triaj (02.11.2026)

Surse: auditul SiteKit complet (`D:\SiteKit\reports\www.tractoaretecuci.ro\report.md`, 27 de pagini, 47 FAIL, 231 WARN) și PageSpeed Insights (pagespeed.web.dev, 02.11.2026, 23:06). Fiecare punct a fost reprodus pe site-ul live sau în cod.

## PageSpeed la pornire

| Pagina | Telefon P/A/BP/SEO | LCP | CLS | Calculator P/A/BP/SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` | 98/91/96/100 | 1,5 s | 0,085 | 100/91/96/100 | 0,2 s | 0,057 |
| `/utilaje` | 99/95/100/100 | 2,1 s | 0 | 100/95/100/100 | 0,5 s | 0,044 |
| `/product?slug=fendt-820-vario-tms-2009-8000h-italia` | 73/95/100/100 | 2,7 s | 0,808 | 77/95/100/100 | 0,3 s | 0,64 |
| `/contact` | 100/94/100/100 | 1,5 s | 0 | 100/94/100/100 | 0,2 s | 0 |

## Triaj

Etichete: **cod** (se repară în repo), **proprietar** (setări de cont sau date pe care doar proprietarul le are), **fals pozitiv**.

| Problema | Verificat | Etichetă |
|---|---|---|
| Produse și articole construite din JS după încărcare (CLS 0,64–0,81 pe produs, 63 de cuvinte în HTML față de ~200 după JS, același canonical `/product` în HTML pentru toate) | curl + PageSpeed | cod |
| Sitemap cu 2 adrese 404 (`blog-post?p=…`), un produs de două ori, 9 articole lipsă, 3 adrese `?category=` blocate în robots.txt | curl | cod |
| `assets/hero.jpg` lipsă (poster video și preload): 404 și eroare în consolă | curl | cod |
| 5 imagini `og:image` lipsă (utilaje, products, despre, contact, blog) | curl | cod |
| Favicon nedeclarat (folderul `assets/favicon` gol), iconițele 192/512 din manifest lipsă: Google arată globul gri în rezultate | cod | cod |
| Video hero 4,6 MB pornit și pe telefon; LCP 3,6 s pe telefon încetinit | audit | cod |
| Poze de 460–680 KB în cardurile de pe acasă și din stoc; logo PNG de 664 px afișat la 110 px (108 KB) | audit | cod |
| Imagini fără `width`/`height` în galerie; imaginea LCP `loading="lazy"` pe /products și /blog | audit | cod |
| axe: `aria-required-children` (grile cu `role="list"` fără `listitem`), contrast (link „Sari la conținut” alb pe verde deschis), `scrollable-region-focusable` (bara de categorii pe telefon) | axe | cod |
| Titluri peste 60 de caractere (7), descrieri peste 160 (2), titluri care sar niveluri (21) | audit | cod |
| Linkuri interne spre `.html` (redirect 301 la fiecare clic) | audit | cod |
| Harta Google pe /contact: API-ul Maps și cookie-uri Google înainte de orice clic, 236 KB JS nefolosit, erori RPC în consolă | PageSpeed + audit | cod |
| Lipsesc `llms.txt`, `llms-full.txt`, `security.txt` (fișier gol, nu e în `/.well-known/`) | curl | cod |
| Program diferit între pagini; JSON-LD fără sâmbătă | cod | cod (proprietarul a confirmat L–V 9–17, S 10–14) |
| Link OLX greșit la Fendt 920 (era al MF 7724), un John Deere dublat cu 6 poze lipsă, filtrul „Alte utilaje” nu prinde `semanatoare` | cod | cod (stocul se înlocuiește din OLX) |
| Link OLX mort (410) la Claas Arion 420 | audit | cod (utilajul nu mai e pe OLX) |
| Pagina principală nu are link spre politica de cookie-uri | audit | cod |
| `tractoare-tecuci.pages.dev` indexabil (dublură a site-ului) | curl | cod |
| `http://tractoaretecuci.ro/` face 2 redirecționări până la `https://www.` | curl | proprietar (o regulă de redirect în Cloudflare) |
| `robots.txt` gestionat de Cloudflare blochează GPTBot, ClaudeBot, Google-Extended (crawlere de antrenare) | curl | proprietar (alegere în Cloudflare; crawlerele de căutare AI nu sunt blocate) |
| Cloudflare ascunde emailul (rescrie `mailto:`, adaugă un script) | curl | cod: `<!--email_off-->` în jurul adresei |
| Fără banner de cookie-uri | audit | fals pozitiv: site-ul nu are trackere; bannerul apare doar când se activează GA4 |
| Conținut subțire pe paginile de utilaj | audit | parțial: se rezolvă cu descrierea din anunț + specificațiile de model |
| Text duplicat între cele două Fendt 724 | audit | dispare (nu mai sunt pe OLX) |

## Neclarități în anunțurile OLX (de verificat de proprietar)

- Fendt 209 S: câmpul „Ore de lucru” are 85.
- Massey Ferguson 7724: câmpul „An” are 2019, textul spune 2018 (pe site apare 2019).
- Merlo 34.10: textul spune „motor Deutz 4 cilindri an de fabricație 2025140 CP” (pe site: „motor Deutz, 4 cilindri”).
