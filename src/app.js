// ============================================================================
// Pluggporten – app.js
// Hash-router och de gemensamma sidorna (start + lärare). Elevsidorna ligger i
// pages-elev.js, lärarsidorna i teacher.js och delade UI-hjälpare i ui.js.
// Avatarer i avatars.js.
//
// Sidor / routes:
//   #/                porten: elev-inloggningen (sidans framdörr, issue #338)
//   #/elev            samma port (gamla länkar/bokmärken fortsätter fungera)
//   #/elev/avatar     välj grundavatar (första gången + byta senare)
//   #/elev/hem        (borttagen sida – omdirigerar till #/elev/hus)
//   #/elev/plugga     välj arbetsområde att öva på
//   #/elev/omrade     översikt för ett område: välj gamemode (?subj=&area=)
//   #/elev/spela      spela en gamemode (?subj=&area=&mode=)
//   #/elev/lasresan   Läsresan: adaptiv läsförståelse på en spelkarta (#398) – laddas DYNAMISKT
//   #/elev/mattematchen  Mattematchen: multiplikationstävling (#458) – bara under aktiv period, DYNAMISK
//   #/elev/live       Live: lobby → 3-2-1 → realtidsmatch (#460) – laddas DYNAMISKT
//   #/elev/shop       shoppen (köp saker för pluggcoins) – pages-shop.js
//   #/elev/by         husvärlden, by-nivån (klassbyn: alla elevers hus) – pages-varld.js
//   #/elev/hus        husvärlden, ute-nivån (huset utifrån) – pages-varld.js
//   #/elev/rum        husvärlden, inne-nivån (rummet; husdjuren bor här) – pages-varld.js
//   #/elev/gard       husvärlden, baksidan/gården bakom huset (#328) – pages-varld.js
//   #/elev/laggard    husvärlden, inne i laggården på gården (#328) – pages-varld.js
//   #/elev/husdjur    (borttagen sida – omdirigerar till #/elev/rum)
//   #/elev/profil     profil: avatar, namn, coins, statistik
//   #/elev/klassfoto  (borttagen sida – omdirigerar till #/elev/by, klassbyn)
//   #/elev/klasskamrat  en klasskamrats rum i läsläge (?id=<studentId>)
//   #/larare          lärarsida (översikt)
//   #/larare/klass    klassöversikt (elevers framsteg, läs-endast)
//   #/larare/klasser  klasser & elevkonton (skapa klass + konton, medlemshantering)
//   #/larare/live     Live: skapa session, aktiva sessioner, historik; ?id= = projektorvy (#460)
//   #/larare/innehall innehållsinmatning (arbetsområdes-JSON) + AI-promptbyggare
//   #/larare/elever   (sammanslagen med #/larare/klasser – omdirigerar dit)
//
// Hash-routing används medvetet så att GitHub Pages inte behöver någon
// server-omskrivning (alla "sidor" ligger i index.html).
// ============================================================================

import {
  app, el, go, renderTopbar, loading, flash, getHiddenModules, getLockGate, onLockChange, escHtml,
} from "./ui.js";
import { moduleForRoute } from "./gamemode-visibility.js";
import { whenAuthReady } from "./auth.js";
import {
  pageElevLogin,
  pageElevAvatar,
  pageElevPlugga,
  pageElevProfil,
} from "./pages-elev.js";
// Lärarsidans flikar (#440): routes registreras ur flik-registryn TEACHER_TABS;
// sidmodulerna laddas med import() (utanför den statiska bootgrafen, #271).
import { TEACHER_TABS } from "./teacher-shared.js";
// Klasskamratens rum (#/elev/klasskamrat) – läs-endast vy av en annan elevs rum.
import { pageElevKlasskamrat } from "./pages-klasskamrat.js";
import { pageElevShop } from "./pages-shop.js";
// Husvärlden (#/elev/hus + #/elev/rum) – EN stateful spelscen med kamerazoom
// mellan ute (huset) och inne (rummet), utan sidladdning – pages-varld.js.
import { pageElevVarld } from "./pages-varld.js";
import { pageElevOmrade, pageElevSpela } from "./gamemodes.js";
// Äventyrsläget (#/elev/aventyr) importeras INTE statiskt här. Se pageElevAventyr()
// längre ner: modulen laddas DYNAMISKT först när eleven faktiskt navigerar till ett
// äventyr (issue #267). Så hamnar den tunga äventyrs-modulgrafen (motor, teman,
// kompass, scener) ALDRIG i app-bootens importkedja – ett runtime-fel där kan då
// aldrig fälla login/hem till en vit sida igen (incidenten 2026-09-10, PR #265).

// Avatar-API:t exporteras vidare härifrån för bakåtkompatibilitet (importeras
// av seed/verktyg). Källan är numera avatars.js.
export { AVATARS, avatarEmoji } from "./avatars.js";

// --- Gemensamma sidor -------------------------------------------------------
// Den gamla startsidan ("Jag är elev"/"Jag är lärare") är borttagen (issue
// #338): porten (elev-inloggningen) ÄR sidans framdörr och #/ ritar den
// direkt. Lärare når sin egen inloggning via direktlänken #/larare (eller den
// diskreta "Lärare →"-länken på porten) – lärarspärren renderGate är kvar
// oförändrad på #/larare/klasser.

// Delad kontext som lärarsidorna (teacher.js) får: app-ytan, navigering och
// topbar-renderaren. Håller lärarmodulen fri från globala beroenden.
const teacherCtx = { app, go, renderTopbar };

function pageNotFound() {
  renderTopbar();
  app.replaceChildren(
    el(`<div class="panel center">
      <h1>Hoppsan! 🙈</h1>
      <p>Den här sidan finns inte.</p>
      <button class="btn" id="home">Till startsidan</button>
    </div>`)
  );
  app.querySelector("#home").addEventListener("click", () => go("#/"));
}

// Äventyrsläget (#/elev/aventyr): ladda den tunga äventyrs-modulen DYNAMISKT
// (issue #267) först vid navigering hit. Ett fel i äventyrsgrafen fångas här och
// visas som ett snällt fel INNE i äventyrsvyn – aldrig som vit sida i hela appen.
async function pageElevAventyr() {
  loading();
  try {
    const mod = await import("./adventure/index.js");
    return await mod.pageElevAventyr();
  } catch (err) {
    console.error("Äventyrsläget kunde inte laddas:", err);
    renderTopbar();
    app.replaceChildren(
      el(`<div class="panel center">
        <div class="big-emoji">🗺️</div>
        <h2>Äventyret kunde inte laddas</h2>
        <p class="hint">Något gick fel när äventyret skulle startas. Prova igen om en stund, eller välj ett annat sätt att öva så länge.</p>
        <button class="btn" id="adv-tillbaka">Tillbaka till att plugga</button>
      </div>`)
    );
    const back = app.querySelector("#adv-tillbaka");
    if (back) back.addEventListener("click", () => go("#/elev/plugga"));
  }
}

// Läsresan (#/elev/lasresan): samma mönster som äventyret – dynamisk import och
// ett snällt fel INNE i vyn om modulgrafen inte går att ladda.
async function pageElevLasresan() {
  loading();
  try {
    const mod = await import("./lasresan/page-lasresan.js");
    return await mod.pageLasresan();
  } catch (err) {
    console.error("Läsresan kunde inte laddas:", err);
    renderTopbar();
    app.replaceChildren(
      el(`<div class="panel center">
        <div class="big-emoji">📖</div>
        <h2>Läsresan kunde inte laddas</h2>
        <p class="hint">Något gick fel. Prova igen om en stund.</p>
        <button class="btn" id="lr-tillbaka">Tillbaka till att plugga</button>
      </div>`)
    );
    const back = app.querySelector("#lr-tillbaka");
    if (back) back.addEventListener("click", () => go("#/elev/plugga"));
  }
}

// Mattematchen (#/elev/mattematchen, #458): samma mönster – dynamisk import, och
// sidan själv skickar hem eleven om ingen aktiv period finns för klassen.
async function pageElevMattematchen() {
  loading();
  try {
    const mod = await import("./tavling/page-mattematchen.js");
    return await mod.pageMattematchen();
  } catch (err) {
    console.error("Mattematchen kunde inte laddas:", err);
    renderTopbar();
    app.replaceChildren(
      el(`<div class="panel center">
        <div class="big-emoji">🧮</div>
        <h2>Mattematchen kunde inte laddas</h2>
        <p class="hint">Något gick fel. Prova igen om en stund.</p>
        <button class="btn" id="mm-tillbaka">Till Hem</button>
      </div>`)
    );
    app.querySelector("#mm-tillbaka")?.addEventListener("click", () => go("#/elev/hus"));
  }
}

// Live (#/elev/live, #460): samma mönster – dynamisk import, snällt fel i vyn.
async function pageElevLive() {
  loading();
  try {
    const mod = await import("./live/page-elev-live.js");
    return await mod.pageElevLive();
  } catch (err) {
    console.error("Live kunde inte laddas:", err);
    renderTopbar();
    app.replaceChildren(
      el(`<div class="panel center">
        <div class="big-emoji">⚡</div>
        <h2>Live kunde inte laddas</h2>
        <p class="hint">Något gick fel. Prova att ladda om sidan.</p>
      </div>`)
    );
  }
}

// --- Router -----------------------------------------------------------------

const routes = {
  // Porten (elev-inloggningen) är framdörren – både #/ och gamla #/elev.
  "/": pageElevLogin,
  "/elev": pageElevLogin,
  "/elev/avatar": pageElevAvatar,
  // Hem-hjälten är slopad: eleven landar direkt i hus-scenen. Gamla länkar/
  // bokmärken till #/elev/hem omdirigeras snällt till huset.
  "/elev/hem": () => go("#/elev/hus"),
  "/elev/plugga": pageElevPlugga,
  "/elev/omrade": pageElevOmrade,
  "/elev/spela": pageElevSpela,
  // Äventyrsläget: gemensam spelmotor, tema väljs via ?tema= (default testbanan).
  "/elev/aventyr": pageElevAventyr,
  "/elev/shop": pageElevShop,
  // Läsresan (#398/#401): egen huvudmodul bredvid Plugga. DYNAMISK import (som
  // äventyret, #267/#271) så att Läsresans moduler aldrig hamnar i bootgrafen.
  "/elev/lasresan": pageElevLasresan,
  // Mattematchen (#458): syns i menyn bara under en aktiv period (ui.getMattematch).
  "/elev/mattematchen": pageElevMattematchen,
  // Live (#460): realtidsmatch klass mot klass – syns bara när klassen är inbjuden.
  "/elev/live": pageElevLive,
  // Husvärlden – samma scen för alla tre routes: "by" startar i klassbyn,
  // "hus" ute och "rum" inne. Är scenen redan uppe byter route-bytet bara
  // zoomnivå (sömlöst, ingen omrendering) – se pages-varld.js.
  "/elev/by": () => pageElevVarld("by"),
  "/elev/hus": () => pageElevVarld("hus"),
  "/elev/rum": () => pageElevVarld("rum"),
  // Gårds-grenen (#328): baksidan/gården bakom huset + laggårdens interiör –
  // samma scen, nya zoomnivåer (själva gren-modulen laddas dynamiskt först
  // vid besök, så bootgrafen växer inte – se pages-varld.js/varld-gard.js).
  "/elev/gard": () => pageElevVarld("gard"),
  "/elev/laggard": () => pageElevVarld("laggard"),
  // Kompis-hus-nivån (#/elev/kompis?id=…): zooma in till en kamrats hus-
  // exteriör (läs-vy) innan man går in i deras rum – samma scen, ny zoomnivå.
  "/elev/kompis": () => pageElevVarld("kompis"),
  // Skol-nivån (#/elev/skolan): zooma UT från byn och se andra klassers byar.
  "/elev/skolan": () => pageElevVarld("skola"),
  // Grannby-nivån (#/elev/grannby?id=…): zooma in till en annan klass by-
  // översikt (läs-vy med deras riktiga hus + stjärnor) – samma scen, ny zoomnivå.
  "/elev/grannby": () => pageElevVarld("grannby"),
  // Grannby-HUS-nivån (#/elev/grannhus?id=…&klass=…): gå in i en annan klass elevs
  // hus-exteriör (läs-vy) innan man går in i deras rum (#114) – samma scen, ny nivå.
  "/elev/grannhus": () => pageElevVarld("grannhus"),
  // Husdjuren bor numera i Mitt rum – gamla länkar skickas dit.
  "/elev/husdjur": () => go("#/elev/rum"),
  "/elev/profil": pageElevProfil,
  // "Min klass"/klassfotot är ersatt av klassbyn i spelvärlden (skylten vid
  // gården) – gamla länkar/bokmärken skickas dit.
  "/elev/klassfoto": () => go("#/elev/by"),
  // Klasskamratens rum (#/elev/klasskamrat?id=…) – läs-endast vy av annans rum.
  "/elev/klasskamrat": pageElevKlasskamrat,
  // Översikts-hubben är borttagen (issue #304): #/larare omdirigerar till den
  // enade klass-fliken så gamla länkar/bokmärken inte bryts. Lärarspärren
  // (renderGate) visas av #/larare/klasser om man inte är inloggad.
  "/larare": () => go("#/larare/klasser"),
  // Klassöversikt/statistik (gamla #/larare/klass) är sammanslagen med Klasser &
  // elever (issue #299): framstegsmatrisen är nu en 📊-expander per klasskort.
  // Gamla länkar/bokmärken skickas dit (samma mönster som /larare/elever).
  "/larare/klass": () => go("#/larare/klasser"),
  // #/larare/klasser (klass-master-detail) och #/larare/innehall registreras
  // ur TEACHER_TABS nedanför routes-objektet (#440).
  // AI-prompt-sidan är sammanslagen med innehållssidan (issue #62): den
  // dynamiska promptbyggaren bor nu där. Gamla länkar/bokmärken skickas dit.
  "/larare/prompter": () => go("#/larare/innehall"),
  // Elevkontohanteringen är sammanslagen med klass-sidan (klass-centrerad). Gamla
  // länkar/bokmärken skickas dit (samma mönster som /larare/prompter).
  "/larare/elever": () => go("#/larare/klasser"),
};
// Lärarflikarna ur registryn (#440): en ny lärarmodul = en rad i TEACHER_TABS.
for (const tab of TEACHER_TABS) routes[tab.hash.slice(1)] = () => tab.page(teacherCtx);

// Löpnummer per navigering: grinden (#412/#436) väntar asynkront på klasslistan
// och får inte rita en gammal route om eleven hunnit navigera vidare.
let routeSeq = 0;

/** Aktuell route ur hashen: { path, query } (query = URLSearchParams). */
function aktuellRutt() {
  const raw = (window.location.hash || "#/").slice(1) || "/";
  const [path, q] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(q || "") };
}

/**
 * Elev-grinden: vart ska eleven skickas i stället för `path`? null = får öppnas.
 *  - Fokusläget (#436, lärarens klass-lås) styr när det är aktivt: målet nås
 *    alltid (även om modulen är dold), resten bara om låset OCH modul-valet
 *    tillåter – annars till låsets mål (som alltid är öppet → ingen loop).
 *  - Annars modul-grinden (#412): dold modul (classes/{id}.hiddenModules) → hem.
 */
function sparrMal(path, query, las, dolda) {
  const modul = moduleForRoute(path);
  const modulOk = !modul || !dolda.includes(modul);
  if (las) {
    return las.allows(path, query) && (las.isTarget(path, query) || modulOk) ? null : las.home;
  }
  return modulOk ? null : "#/elev/hus";
}

// Lärarens lås/upplåsning eller ett passerat klockslag (#436): rita om menyn och
// grinda om den route eleven står på – UTAN att ladda om sidan. Ett pågående
// spel i målområdet lämnas orört; bara Plugga-listan (vars innehåll beror på
// låset) ritas om, och en route som nu är spärrad byts mot låsets mål.
onLockChange(async (las, prev) => {
  const { path, query } = aktuellRutt();
  if (!path.startsWith("/elev/") || path === "/elev/avatar") return;
  if (las && !prev) flash(`🎯 Fokusläge: din klass jobbar med ${escHtml(las.label)} till ${las.klockslag}.`);
  else if (las) flash(`🎯 Fokusläget ändrades: ${escHtml(las.label)} till ${las.klockslag}.`);
  else flash("Fokusläget är slut – nu är allt öppet igen! 🎉");
  renderTopbar();
  const dit = sparrMal(path, query, las, await getHiddenModules());
  if (dit) window.location.replace(dit);
  else if (path === "/elev/plugga") router();
});

function router() {
  // Signalera till bootvakten i index.html att modulgrafen laddats och routern
  // kör – annars visar den sitt "Sajten uppdateras just nu"-läge efter 8 s
  // (rotorsak #271: icke-atomär Pages-utrullning kan fälla modulgrafen).
  window.__PLUGG_BOOTED = true;
  // Skala bort ev. query-del (?area=…&mode=…) innan route-uppslag.
  const raw = (window.location.hash || "#/").slice(1) || "/";
  const path = raw.split("?")[0] || "/";
  // Husvärlden får en bredare innehållsyta (större spelcanvas) – sidomenyn
  // påverkas inte (den ligger utanför .container). Porten (#/ och #/elev)
  // behöver INTE klassen: dess scen är position:fixed och fyller hela
  // viewporten kant till kant (lead-beslut i #338).
  document.body.classList.toggle(
    "varld-lage",
    path === "/elev/by" || path === "/elev/hus" || path === "/elev/rum" ||
    path === "/elev/kompis" || path === "/elev/skolan" || path === "/elev/grannby" ||
    path === "/elev/grannhus" || path === "/elev/gard" || path === "/elev/laggard"
  );
  // Läsresan får en bredare innehållsyta (text och frågor sida vid sida).
  document.body.classList.toggle("lasresan-lage", path === "/elev/lasresan");
  // Mattematchen: en skärm utan scroll (fråga, svar, knappar) – se mattematchen.css.
  document.body.classList.toggle("mm-lage", path === "/elev/mattematchen");
  // Live: samma krav (ingen scroll) – live.css låter .container fylla viewporten.
  document.body.classList.toggle("live-lage", path === "/elev/live");
  // Lärar-routes: håll body-bakgrunden mörk under HELA vistelsen – även i glappet
  // mellan flik-byten, då den gamla .teacher-dark-vyn tas bort en kort stund och
  // body:has(.teacher-dark) slutar matcha (→ annars blänker elevsidans ljusa
  // gradient till vitt). Elevsidan saknar klassen och behåller sin ljusa bakgrund.
  document.body.classList.toggle(
    "larare-lage",
    path === "/larare" || path.startsWith("/larare/")
  );
  const handler = routes[path] || pageNotFound;
  // Elev-grinden (sparrMal): dolda moduler (#412) och fokusläget (#436) nås inte
  // ens via direktlänk. replace() så bakåtknappen inte studsar in i grinden.
  // Låset svarar ur minnet efter första anropet, så husvärldens zoom väntar inte.
  const seq = ++routeSeq;
  if (!path.startsWith("/elev/") || path === "/elev/avatar") return handler();
  const modul = moduleForRoute(path);
  Promise.all([getLockGate(), modul ? getHiddenModules() : []]).then(([las, dolda]) => {
    if (seq !== routeSeq) return; // eleven hann navigera vidare
    const dit = sparrMal(path, aktuellRutt().query, las, dolda);
    if (!dit) return handler();
    flash(las
      ? `🎯 Fokusläge: din klass jobbar med ${escHtml(las.label)} just nu.`
      : "Den delen är stängd för din klass just nu.");
    window.location.replace(dit);
  });
}

document.getElementById("brand").addEventListener("click", () => go("#/"));
window.addEventListener("hashchange", router);

// Boot: vänta in att Firebase Auth återställt (eller bekräftat frånvaron av) en
// session INNAN första sidan ritas – annars skulle en "kom-ihåg-mig"-elev
// kastas ut till inloggningen vid en omladdning (auth.currentUser är null en
// kort stund medan SDK:t initierar). Efterföljande hashchange kör router direkt.
async function boot() {
  loading();
  try {
    await whenAuthReady();
  } catch {}
  router();
}
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
