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
//   #/elev/hem        elev-startsida (kräver inloggning)
//   #/elev/plugga     välj arbetsområde att öva på
//   #/elev/omrade     översikt för ett område: välj gamemode (?subj=&area=)
//   #/elev/spela      spela en gamemode (?subj=&area=&mode=)
//   #/elev/shop       shoppen (köp saker för pluggcoins) – pages-shop.js
//   #/elev/rum        mitt rum (placera saker + klä på avataren) – pages-rum.js
//   #/elev/profil     profil: avatar, namn, coins, statistik
//   #/larare          lärarsida (översikt)
//   #/larare/klass    klassöversikt (elevers framsteg, läs-endast)
//   #/larare/innehall innehållsinmatning (arbetsområdes-JSON)
//   #/larare/prompter färdiga AI-prompter
//   #/larare/elever   elevkontohantering
//
// Hash-routing används medvetet så att GitHub Pages inte behöver någon
// server-omskrivning (alla "sidor" ligger i index.html).
// ============================================================================

import { app, el, go, renderTopbar } from "./ui.js";
import {
  pageElevLogin,
  pageElevAvatar,
  pageElevHem,
  pageElevPlugga,
  pageElevProfil,
} from "./pages-elev.js";
import {
  pageLarare,
  pageLarareInnehall,
  pageLararePrompter,
  pageLarareElever,
} from "./teacher.js";
// Klassöversikt (#/larare/klass) – additivt tillägg (håll separat för enkel rebase).
import { pageLarareKlass } from "./teacher.js";
import { pageElevShop } from "./pages-shop.js";
import { pageElevRum } from "./pages-rum.js";
// Mitt husdjur (#/elev/husdjur) – additivt tillägg (håll separat för enkel rebase).
import { pageElevHusdjur } from "./pages-pet.js";
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
  "/elev/hem": pageElevHem,
  "/elev/plugga": pageElevPlugga,
  "/elev/omrade": pageElevOmrade,
  "/elev/spela": pageElevSpela,
  "/elev/shop": pageElevShop,
  "/elev/rum": pageElevRum,
  // Mitt husdjur (#/elev/husdjur) – additivt tillägg (håll separat för enkel rebase).
  "/elev/husdjur": pageElevHusdjur,
  "/elev/profil": pageElevProfil,
  "/larare": () => pageLarare(teacherCtx),
  // Klassöversikt (#/larare/klass) – additivt tillägg (håll separat för enkel rebase).
  "/larare/klass": () => pageLarareKlass(teacherCtx),
  "/larare/innehall": () => pageLarareInnehall(teacherCtx),
  "/larare/prompter": () => pageLararePrompter(teacherCtx),
  "/larare/elever": () => pageLarareElever(teacherCtx),
};

function router() {
  // Skala bort ev. query-del (?area=…&mode=…) innan route-uppslag.
  const raw = (window.location.hash || "#/").slice(1) || "/";
  const path = raw.split("?")[0] || "/";
  const handler = routes[path] || pageNotFound;
  handler();
}

document.getElementById("brand").addEventListener("click", () => go("#/"));
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
// DOMContentLoaded kan redan ha hänt (modulen laddas defer):
if (document.readyState !== "loading") router();
