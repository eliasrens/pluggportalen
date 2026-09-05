// ============================================================================
// Pluggportalen – app.js
// Hash-router och de gemensamma sidorna (start + lärare). Elevsidorna ligger i
// pages-elev.js, lärarsidorna i teacher.js och delade UI-hjälpare i ui.js.
// Avatarer i avatars.js.
//
// Sidor / routes:
//   #/                startsida (välj lärare eller elev)
//   #/elev            elev-inloggning
//   #/elev/avatar     välj grundavatar (första gången + byta senare)
//   #/elev/hem        (borttagen sida – omdirigerar till #/elev/hus)
//   #/elev/plugga     välj arbetsområde att öva på
//   #/elev/omrade     översikt för ett område: välj gamemode (?subj=&area=)
//   #/elev/spela      spela en gamemode (?subj=&area=&mode=)
//   #/elev/shop       shoppen (köp saker för pluggcoins) – pages-shop.js
//   #/elev/by         husvärlden, by-nivån (klassbyn: alla elevers hus) – pages-varld.js
//   #/elev/hus        husvärlden, ute-nivån (huset utifrån) – pages-varld.js
//   #/elev/rum        husvärlden, inne-nivån (rummet; husdjuren bor här) – pages-varld.js
//   #/elev/husdjur    (borttagen sida – omdirigerar till #/elev/rum)
//   #/elev/profil     profil: avatar, namn, coins, statistik
//   #/elev/klassfoto  (borttagen sida – omdirigerar till #/elev/by, klassbyn)
//   #/elev/klasskamrat  en klasskamrats rum i läsläge (?id=<studentId>)
//   #/larare          lärarsida (översikt)
//   #/larare/klass    klassöversikt (elevers framsteg, läs-endast)
//   #/larare/klasser  klasshantering (skapa klasser, lägg elever i dem)
//   #/larare/innehall innehållsinmatning (arbetsområdes-JSON) + AI-promptbyggare
//   #/larare/elever   elevkontohantering
//
// Hash-routing används medvetet så att GitHub Pages inte behöver någon
// server-omskrivning (alla "sidor" ligger i index.html).
// ============================================================================

import { app, el, go, renderTopbar, loading } from "./ui.js";
import { whenAuthReady } from "./auth.js";
import {
  pageElevLogin,
  pageElevAvatar,
  pageElevPlugga,
  pageElevProfil,
} from "./pages-elev.js";
import {
  pageLarare,
  pageLarareInnehall,
  pageLarareElever,
} from "./teacher.js";
// Klassöversikt (#/larare/klass) – additivt tillägg (håll separat för enkel rebase).
import { pageLarareKlass } from "./teacher.js";
// Klasskamratens rum (#/elev/klasskamrat) – läs-endast vy av en annan elevs rum.
import { pageElevKlasskamrat } from "./pages-klasskamrat.js";
// Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
import { pageLarareKlasser } from "./teacher.js";
import { pageElevShop } from "./pages-shop.js";
// Husvärlden (#/elev/hus + #/elev/rum) – EN stateful spelscen med kamerazoom
// mellan ute (huset) och inne (rummet), utan sidladdning – pages-varld.js.
import { pageElevVarld } from "./pages-varld.js";
import { pageElevOmrade, pageElevSpela } from "./gamemodes.js";

// Avatar-API:t exporteras vidare härifrån för bakåtkompatibilitet (importeras
// av seed/verktyg). Källan är numera avatars.js.
export { AVATARS, avatarEmoji } from "./avatars.js";

// --- Gemensamma sidor -------------------------------------------------------

function pageHome() {
  renderTopbar();
  app.replaceChildren(
    el(`<div>
      <div class="panel center">
        <h1>Välkommen till Pluggportalen! 📚</h1>
        <p class="hint">Öva SO på ett roligt sätt – samla pluggcoins och pynta ditt eget rum.</p>
      </div>
      <div class="card-grid">
        <button class="big-card gron" id="to-elev">
          <span class="emoji">🎒</span>
          <span class="title">Jag är elev</span>
          <span class="sub">Logga in och börja plugga</span>
        </button>
        <button class="big-card bla" id="to-larare">
          <span class="emoji">👩‍🏫</span>
          <span class="title">Jag är lärare</span>
          <span class="sub">Se innehåll och elever</span>
        </button>
      </div>
    </div>`)
  );
  app.querySelector("#to-elev").addEventListener("click", () => go("#/elev"));
  app.querySelector("#to-larare").addEventListener("click", () => go("#/larare"));
}

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

// --- Router -----------------------------------------------------------------

const routes = {
  "/": pageHome,
  "/elev": pageElevLogin,
  "/elev/avatar": pageElevAvatar,
  // Hem-hjälten är slopad: eleven landar direkt i hus-scenen. Gamla länkar/
  // bokmärken till #/elev/hem omdirigeras snällt till huset.
  "/elev/hem": () => go("#/elev/hus"),
  "/elev/plugga": pageElevPlugga,
  "/elev/omrade": pageElevOmrade,
  "/elev/spela": pageElevSpela,
  "/elev/shop": pageElevShop,
  // Husvärlden – samma scen för alla tre routes: "by" startar i klassbyn,
  // "hus" ute och "rum" inne. Är scenen redan uppe byter route-bytet bara
  // zoomnivå (sömlöst, ingen omrendering) – se pages-varld.js.
  "/elev/by": () => pageElevVarld("by"),
  "/elev/hus": () => pageElevVarld("hus"),
  "/elev/rum": () => pageElevVarld("rum"),
  // Kompis-hus-nivån (#/elev/kompis?id=…): zooma in till en kamrats hus-
  // exteriör (läs-vy) innan man går in i deras rum – samma scen, ny zoomnivå.
  "/elev/kompis": () => pageElevVarld("kompis"),
  // Skol-nivån (#/elev/skolan): zooma UT från byn och se andra klassers byar.
  "/elev/skolan": () => pageElevVarld("skola"),
  // Grannby-nivån (#/elev/grannby?id=…): zooma in till en annan klass by-
  // översikt (läs-vy, inga enskilda elevers rum) – samma scen, ny zoomnivå.
  "/elev/grannby": () => pageElevVarld("grannby"),
  // Husdjuren bor numera i Mitt rum – gamla länkar skickas dit.
  "/elev/husdjur": () => go("#/elev/rum"),
  "/elev/profil": pageElevProfil,
  // "Min klass"/klassfotot är ersatt av klassbyn i spelvärlden (skylten vid
  // gården) – gamla länkar/bokmärken skickas dit.
  "/elev/klassfoto": () => go("#/elev/by"),
  // Klasskamratens rum (#/elev/klasskamrat?id=…) – läs-endast vy av annans rum.
  "/elev/klasskamrat": pageElevKlasskamrat,
  "/larare": () => pageLarare(teacherCtx),
  // Klassöversikt (#/larare/klass) – additivt tillägg (håll separat för enkel rebase).
  "/larare/klass": () => pageLarareKlass(teacherCtx),
  // Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
  "/larare/klasser": () => pageLarareKlasser(teacherCtx),
  "/larare/innehall": () => pageLarareInnehall(teacherCtx),
  // AI-prompt-sidan är sammanslagen med innehållssidan (issue #62): den
  // dynamiska promptbyggaren bor nu där. Gamla länkar/bokmärken skickas dit.
  "/larare/prompter": () => go("#/larare/innehall"),
  "/larare/elever": () => pageLarareElever(teacherCtx),
};

function router() {
  // Skala bort ev. query-del (?area=…&mode=…) innan route-uppslag.
  const raw = (window.location.hash || "#/").slice(1) || "/";
  const path = raw.split("?")[0] || "/";
  // Husvärlden får en bredare innehållsyta (större spelcanvas) – sidomenyn
  // påverkas inte (den ligger utanför .container).
  document.body.classList.toggle(
    "varld-lage",
    path === "/elev/by" || path === "/elev/hus" || path === "/elev/rum" ||
    path === "/elev/kompis" || path === "/elev/skolan" || path === "/elev/grannby"
  );
  const handler = routes[path] || pageNotFound;
  handler();
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
