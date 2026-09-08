# I18N-PLAN – språkval & översättning av Pluggportalen

> **Status:** SPIKE / utredning (issue #134). Ingen produktkod – detta dokument är
> beslutsunderlag inför framtida implementations-issues.
> **Datum:** 2026-09-08.

---

## 0. TL;DR – rekommendation

1. **Välj alternativ (a): riktig i18n med sträng-nycklar + ordböcker `sv`/`en`.**
   Translate-API vid körning (b) väljs bort som primär lösning; Googles gamla
   gratis *Website Translator*-widget är **nedlagd** och utesluts helt (se §4.2).
2. **Översätt i första skedet BARA statiskt UI (appens ram/chrome).**
   Lärar-inmatat och AI-genererat **innehåll** (arbetsområden, källtexter, quiz,
   fakta-par) översätts **inte** maskinellt i v1 – det är pedagogiskt känsligt
   (se §5). Innehållet förblir på det språk läraren skrev det på.
3. **Sekvensera epicen SIST** bland pågående epics och håll den på en egen,
   ofta rebasad gren. Översättningen rör ~alla UI-filer (77 av 85 JS-filer) och
   krockar annars med allt annat som pågår (se §6).
4. Introducera en pytteliten `t("nyckel")`-hjälpare + en persistent språkväljare,
   och **extrahera strängar stegvis, modul för modul** – inte i en enda big-bang-PR.

Uppskattad omfattning: **~600–900 unika UI-strängar** i **77 filer**, grovt
**8–15 utvecklardagar** för full UI-täckning (svenska→engelska), fördelat på
flera små PR:er. Löpande kostnad ≈ 0 kr (statiska ordböcker, ingen körnings-API).

---

## 1. Syfte & avgränsning

Appen är i dag helt på svenska (SO-studiesida för åk 4). Målet med denna spike är
att rekommendera **hur** appen ska kunna byta språk (t.ex. engelska), inte att
implementera det. Leverans: detta dokument. Konkreta implementations-issues
skapas efteråt utifrån §7.

Avgränsning: spiken är **read-only**. Ingen sträng har extraherats, ingen
`t()`-hjälpare finns ännu, inga beroenden har lagts till.

---

## 2. Nuläge – teknik & arkitektur

| Aspekt | Nuläge |
|---|---|
| Stack | Statisk vanilla-JS-SPA (ingen byggpipeline, ingen npm-runtime-dep), ES-moduler, hash-router. Backend: Firebase/Firestore. Hostas på Firebase Hosting. |
| Antal källfiler | 85 JS-filer i `src/`, ~17 100 rader. |
| Rendering | Strängar skrivs **direkt in i HTML-template-literals** och byggs till DOM via hjälparen `el(htmlString)` i `src/ui.js` (och en del `innerHTML`). |
| Central renderingspunkt? | **Nej.** Det finns ingen central "render text"-funktion att haka i – varje sida bygger sin egen HTML. Det gör extraktion mer arbete (många ställen) men är rakt fram (mekaniskt). |
| Befintlig i18n | **Ingen.** Enda "språk"-spåren i koden är `localeCompare(..., "sv")` för sortering – inte översättningsinfrastruktur. |
| Språkdeklaration | `index.html` har `<html lang="sv">` hårdkodat. |

**Konsekvens:** en riktig i18n kräver att vi (1) inför en `t()`-hjälpare, (2) byter
ut hårdkodade strängar mot nyckel-anrop, (3) lägger ordböcker i separata filer.
Inget av detta kräver ett ramverk eller en byggpipeline – det passar den befintliga
"ingen-build"-filosofin.

### 2.1 Kartläggning av hårdkodade svenska strängar (omfattning)

Mätt på `src/*.js` 2026-09-08:

- **77 av 85 filer** innehåller minst en svensk UI-sträng.
- **~475** strängliteraler innehåller `å/ä/ö` (säker undre gräns).
- En bredare heuristik (svenska ord utan diakriter: *och, för, välj, spara, klass,
  elev, poäng* …) ger **~680 träffar**.
- Realistisk uppskattning efter avdrag för dubbletter/överlapp: **~600–900 unika
  UI-strängar** att extrahera.

Tyngdpunkt (flest strängar per fil, topp):

| Fil | ~strängar | Karaktär |
|---|---|---|
| `src/validate.js` | 42 | Valideringsmeddelanden |
| `src/shop-items.js` | 35 | Butiksartiklar (namn/beskrivning) |
| `src/pages-varld.js` | 33 | Husvärld-UI |
| `src/prompt-parts.js` | 28 | **AI-prompt-byggare** (specialfall, se §5.2) |
| `src/teacher-class*.js` | ~70 (summa) | Lärarvyer |
| `src/pages-shop.js` | 22 | Shop-sidan |
| `src/pages-elev.js`, `game-shared.js`, `pages-rum-pet-panel.js` … | 10–17 vardera | Elev-UI |

Även `index.html` innehåller UI-text (t.ex. `aria-label="Öppna meny"`, "Laddar…").

---

## 3. Vad ska (och ska inte) översättas?

Två helt olika textkategorier med olika ägare och känslighet:

| Kategori | Var den bor | Ägare | Översätts i v1? |
|---|---|---|---|
| **Statiskt UI / chrome** | Hårdkodat i JS/HTML | Utvecklare | **JA** – detta är hela poängen. |
| **Lärar-/AI-innehåll** (arbetsområden, källtexter, quiz-frågor, fakta-par) | Firestore (`subjects/areas/…`) | Lärare + AI | **NEJ** i v1 (se §5). |
| Elevgenererad data (namn, husnamn) | Firestore | Elev | Nej – översätts aldrig. |
| System-/hjälptext i lärarens promptbyggare | JS (`prompt-parts.js`, `prompts.js`) | Utvecklare | Delvis – se §5.2. |

---

## 4. Alternativen

### 4.1 Alternativ (a) – Riktig i18n: nyckel + ordböcker `sv`/`en`  ✅ REKOMMENDERAS

Inför en nyckel-baserad översättning:

```js
// src/i18n.js (skiss – byggs i implementations-issue, ej nu)
import { sv } from "./locales/sv.js";
import { en } from "./locales/en.js";
const DICTS = { sv, en };
let current = localStorage.getItem("lang") || "sv";
export function t(key, vars) { /* slå upp key i DICTS[current], fyll {vars} */ }
export function setLang(l) { current = l; localStorage.setItem("lang", l); rerender(); }
```

Anropssida i stället för hårdkodad sträng:

```js
// FÖRE: el(`<button>Spara</button>`)
// EFTER: el(`<button>${t("common.save")}</button>`)
```

**För:**
- Robust, förutsägbart, offline, **noll löpande kostnad**, inga API-nycklar/proxy.
- Full kontroll på ton/terminologi (viktigt för barn i åk 4 + pedagogik).
- Ingen FOUC/omflödning; korrekt `lang`-attribut; SEO/tillgänglighet intakt.
- Passar "ingen-build"-arkitekturen (ordböcker = vanliga ES-moduler).

**Emot:**
- Kräver **extraktion av ~600–900 strängar i 77 filer** (störst arbetsinsats).
- Ny disciplin framåt: nya strängar måste läggas som nycklar, inte hårdkodas
  (mitigeras med en enkel lint/CI-koll, se §7 steg 6).

### 4.2 Alternativ (b) – Translate-API vid körning/bygge  ❌ VÄLJS BORT

Två undervarianter:

**b1) Googles gamla gratis "Website Translator"-widget → BEKRÄFTAT NEDLAGD, UTESLUTS.**
Googles klientsides-widget (`translate_a/element.js`, "Google Översätt denna sida")
**avvecklades för allmän/kommersiell användning redan 2019–2020** och är sedan dess
endast kvar i begränsad form för vissa icke-kommersiella/statliga/utbildnings-org –
men Google marknadsför den inte längre, den ses som en död lösning och ger dålig
UX (banner, omflödning/FOUC, ingen kontroll på term/ton, tillgänglighetsproblem,
kan brytas när som helst). **Vi utesluter den helt** – både för att den är
avvecklad och för att den är olämplig för en barnapp där vi vill styra språket.

**b2) Google Cloud Translation API (v2/v3) i runtime/build.**
- **Kostar pengar och kräver GCP-nyckel + proxy** (nyckeln får inte ligga i
  klienten → kräver en Cloud Function/serverless-proxy = ny infrastruktur).
- Pris (2026): **500 000 tecken/mån gratis**, därefter **$20 / miljon tecken**.
  Nya GCP-konton har $300 i trial-kredit i 90 dagar.
- För *statiskt UI* är detta onödigt: strängmängden är liten och ändras sällan →
  maskinöversättning i runtime är overkill och sämre kvalitet än en handgranskad
  ordbok.
- För *innehåll* (stort, växande) skulle kostnad/kvalitet/pedagogik bli ett problem
  (se §5).

**Slutsats (b):** olämpligt som primär lösning. Cloud Translation kan däremot
användas som **engångs-verktyg vid build/översättning** för att *seeda* engelska
ordboken (b2 som utvecklarverktyg, inte som runtime) – men även då granskas
resultatet manuellt.

### 4.3 Alternativ (c) – Hybrid

UI via ordbok (a) + innehåll via Cloud Translation (b2) on-demand. **Väljs bort i
v1** eftersom innehållsöversättning är den pedagogiskt känsliga och dyra delen (§5).
Hybrid kan bli aktuellt i en **framtida v2** om behovet av översatt innehåll
uppstår – men då som ett medvetet, avgränsat tillägg (t.ex. "visa AI-översättning
(granska själv)"-knapp för läraren), inte automatiskt för elever.

---

## 5. Pedagogiska ställningstagandet: översätt bara UI, inte innehållet

**Rekommendation: v1 översätter bara statiskt UI. Lärar-/AI-innehåll maskinöversätts
INTE.**

### 5.1 Varför inte översätta innehållet (v1)
- **Pedagogisk risk:** SO-innehåll för åk 4 (historia, källtexter, quiz-frågor,
  facit) måste vara faktakorrekt och nivåanpassat. Maskinöversättning kan subtilt
  ändra betydelse, facit och svårighetsgrad – ett fel svar i ett quiz är värre än
  ingen översättning.
- **Ägarskap:** innehållet skrivs av läraren (ev. via AI-prompt). Läraren äger språket
  och kan själv skapa en engelsk variant om hen vill (befintlig innehållsinmatning).
- **Kostnad/skalning:** innehåll är stort och växande → återkommande API-kostnad och
  cache-/versionshantering i Firestore. UI är litet och stabilt.
- **Konsekvens:** en engelsk elev får engelskt *gränssnitt* men ser innehållet på det
  språk läraren la in det. Det är en ärlig och trygg default. (Framtida v2 kan låta
  *läraren* – inte eleven – beställa en granskningsbar AI-översättning per område.)

### 5.2 Gråzon: `prompt-parts.js` / `prompts.js`
AI-promptbyggaren (lärarverktyg) innehåller svensk systemtext. Den är "UI för läraren"
men styr vilket språk AI:n genererar innehåll på. **Rekommendation:** behandla dess
*etiketter/hjälptexter* som UI (översätts), men låt **själva prompten fortsätta be
AI:n skapa innehåll på svenska** (eller lägg till ett medvetet språkval för läraren i
en senare issue). Dvs vi översätter inte pedagogiken via en bakväg.

---

## 6. Arbetsmängd, kostnad & konfliktrisk

### 6.1 Arbetsmängd (svenska→engelska, full UI-täckning)
- Infrastruktur (`i18n.js`, `locales/`, språkväljare, `t()`-genomdragning i `ui.js`
  + router-rerender): **~1–2 dagar.**
- Strängextraktion 77 filer / ~600–900 strängar: **~6–10 dagar**, mekaniskt,
  parallelliserbart per modul-kluster (elev / lärare / husvärld / shop / validate).
- Engelsk översättning + korrektur (åk 4-ton): **~1–3 dagar** (ordboken kan seedas
  med Cloud Translation som engångsverktyg, sedan handgranskas).
- **Totalt ≈ 8–15 utvecklardagar**, uppdelat i flera små PR:er.

### 6.2 Kostnad
- Löpande: **0 kr** (statiska ordböcker, ingen runtime-API, ingen ny infra).
- Engångs (om Cloud Translation används för att seeda `en`-ordboken): UI-strängarna
  är totalt uppskattningsvis ~30–60k tecken → **ryms i gratis 500k/mån** → **0 kr**.

### 6.3 Konfliktrisk mot andra epics — HÖG (rör ~alla UI-filer)
Extraktionen ändrar `el(\`…Svenska…\`)` → `el(\`…${t(...)}…\`)` i 77 filer. Varje
annan epic som rör UI (husvärld, shop, quiz, lärarvyer) kommer att krocka i merge.

**Sekvensering – rekommendation:**
1. **Kör i18n-epicen SIST**, efter att pågående feature-epics (t.ex. #108/#110/#111
   och andra öppna) är mergade till main.
2. Håll den på en **egen gren som rebasas ofta** mot main/feature-branchen.
3. **Extrahera i moduler, inte big-bang:** en PR per fil-kluster, mergas snabbt, så
   fönstret för konflikt per PR blir litet.
4. Inför tidigt (även före full extraktion) infrastrukturen + språkväljaren så att
   nya strängar från och med då skrivs som nycklar → minskar framtida skuld.

---

## 7. Konkreta första implementations-steg → bli implementations-issues

Följande blir separata issues under epicen (grov ordning):

1. **i18n-kärna:** skapa `src/i18n.js` (`t()`, `setLang()`, `{var}`-interpolation,
   `localStorage`-persistens, fallback `sv`) + `src/locales/sv.js` & `en.js` (tomma/
   nyckelram). *Ingen extraktion än.* (S)
2. **Språkväljare + `<html lang>`:** persistent språkväljare i sidomenyn (`ui.js`),
   uppdatera `document.documentElement.lang`, re-render av aktuell route vid byte. (S)
3. **Extrahera "ram"-UI:** `ui.js` (sidomeny/nav/topbar), `index.html`, `app.js`,
   felmeddelanden. (M)
4. **Extrahera elev-kluster:** `pages-elev.js`, `pages-shop.js`+`shop-items.js`,
   husvärld (`pages-varld.js`, `varld-*`, `pages-rum-*`), `game-shared.js`,
   `games-quiz.js`, `games-match.js`, `gamemodes.js`. (L – dela i flera issues)
5. **Extrahera lärar-kluster:** `teacher*.js`, `validate.js`, `exercise-types.js`,
   `prompt-parts.js`/`prompts.js` (endast etiketter, se §5.2). (L)
6. **CI-vakt mot regression:** enkel node-check som flaggar nya svenska strängliteraler
   utanför `locales/` (t.ex. `å/ä/ö` i `el(\`…\`)`), så nya strängar inte hårdkodas. (S)
7. **Engelsk ordbok + korrektur:** fyll `en.js`, seed ev. med Cloud Translation-
   engångskörning, handgranska ton för åk 4. (M)
8. **QA:** klicka igenom alla flöden på `en`, kontrollera trunkering/layout, plural,
   datum/nummer (`toLocaleString`), `aria-label`. (M)

*(v2, ej nu):* lärar-initierad, granskningsbar AI-översättning av innehåll (hybrid).

---

## 8. Risker & öppna frågor

- **Textexpansion/layout:** engelska ↔ svenska ger olika längder → testa knapp-/
  panel-trunkering (särskilt husvärld och shop).
- **Interpolerade meningar:** strängar med inbäddade värden (`${namn} fick ${n} coins`)
  måste bli parametriserade nycklar, inte konkatenering, för korrekt ordföljd.
- **Plural/genus:** svenska och engelska pluralregler skiljer sig – håll pluralformer
  som separata nycklar eller lätt plural-helper.
- **`localeCompare(..., "sv")`:** sorteringar bör följa valt språk (mindre viktigt).
- **Dubbelarbete under övergången:** tills CI-vakten (steg 6) finns kan nya epics
  återinföra hårdkodade strängar – därför bör kärnan (steg 1–2 + 6) landa tidigt.
- **Öppen fråga till beställaren:** vilka språk utöver `en` är aktuella? Ordboks-
  ansatsen skalar till fler språk utan kodändring, men korrektur kostar per språk.

---

## 9. Beslut som behöver beställarens OK

1. Godkänn **alternativ (a)** + **UI-only i v1** (innehåll ej maskinöversatt).
2. Godkänn **sekvensering sist** + egen ofta-rebasad gren.
3. Bekräfta **målspråk** (engelska i v1? fler senare?).

*(Denna PR innehåller endast detta dokument. Ingen produktkod. Mergas inte utan
beställarens OK.)*

---

### Källor (webb, verifierat 2026-09-08)
- Google Translate Website Widget – avvecklad: TranslatePress, ConveyThis, Tripepi Smith
  (https://translatepress.com/google-translate-website-widget/ ,
  https://www.conveythis.com/google-translate-widget-discontinued ,
  https://tripepismith.com/insights/google-translate/).
- Cloud Translation-pris (500k tecken/mån gratis, $20/miljon därefter):
  Google Cloud Translation pricing-sammanställningar 2026
  (https://langbly.com/compare/google-cloud-translation-api-pricing/ ,
  https://costgoat.com/pricing/google-translate).
