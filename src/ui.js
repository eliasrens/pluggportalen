// ============================================================================
// Pluggporten – gemensamma UI-hjälpare
// Delas av app.js (router) och sidmodulerna: DOM-referenser, navigering,
// en liten mall-hjälpare och den bestående sidomenyn (renderTopbar) med
// karaktärspanel, navlänkar, coins och utloggning.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR, avatarArtReady, loadAvatarArt } from "./avatars.js";
import { coinIcon, starIcon } from "./icons.js";
import { modulesHiddenForStudent, OPT_IN_MODULES, STUDENT_MODULES } from "./gamemode-visibility.js";

export const app = document.getElementById("app");
export const sidebar = document.getElementById("sidebar");
export const sidebarBody = document.getElementById("sidebar-body");

// --- Mobil: hopfällbar off-canvas-meny --------------------------------------
// Hamburger + overlay ligger kvar mellan sidbyten (statiska i index.html), så
// lyssnarna kopplas en gång här. På desktop är menyn alltid fast (se CSS).
const hamburger = document.getElementById("hamburger");
const overlay = document.getElementById("sidebar-overlay");

/** Öppna/stäng sidomenyn på mobil. */
export function toggleSidomeny(open) {
  const willOpen = open ?? !document.body.classList.contains("sidomeny-oppen");
  document.body.classList.toggle("sidomeny-oppen", willOpen);
  hamburger?.setAttribute("aria-expanded", willOpen ? "true" : "false");
  if (overlay) overlay.hidden = !willOpen;
}

hamburger?.addEventListener("click", () => toggleSidomeny());
overlay?.addEventListener("click", () => toggleSidomeny(false));
// Klick på en navlänk i menyn stänger den på mobil.
sidebar?.addEventListener("click", (e) => {
  if (e.target.closest("a,button") && document.body.classList.contains("sidomeny-oppen")) {
    toggleSidomeny(false);
  }
});

/** Navigera till en hash-route. */
export function go(hash) {
  window.location.hash = hash;
}

/**
 * Läs query-parametrar ur hashen, t.ex. `#/elev/spela?area=vikingatiden&mode=quiz`.
 * @returns {Record<string,string>}
 */
export function getParams() {
  const hash = window.location.hash || "";
  const q = hash.indexOf("?");
  const out = {};
  if (q === -1) return out;
  const sp = new URLSearchParams(hash.slice(q + 1));
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

/** Escapa text för HTML (t.ex. lärarens områdesnamn i sidomenyn/flash). */
export function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** Bygg ett element från en HTML-sträng (första elementet returneras). */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Visa en enkel laddningsindikator i huvudytan. */
export function loading(msg = "Laddar…") {
  app.innerHTML = `<div class="spinner">${msg}</div>`;
}

/** Visa ett felmeddelande som fyller huvudytan. */
export function pageError(title, err) {
  app.replaceChildren(
    el(`<div class="panel"><div class="msg error">${title}: ${err?.message || err}</div></div>`)
  );
}

/** Begränsa ett tal till [min, max] (ogiltigt tal → min). */
export function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Liten toast-ruta längst ner på sidan. */
export function flash(text, isError = false) {
  let box = document.getElementById("flash-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "flash-box";
    box.className = "flash-box";
    document.body.appendChild(box);
  }
  const note = el(`<div class="flash${isError ? " error" : ""}">${text}</div>`);
  box.appendChild(note);
  requestAnimationFrame(() => note.classList.add("show"));
  setTimeout(() => {
    note.classList.remove("show");
    setTimeout(() => note.remove(), 300);
  }, 2600);
}

/**
 * Modulerna som lärarens klass-val döljer för den inloggade eleven (#412),
 * inklusive opt-in-moduler som ingen av elevens klasser aktiverat (#605).
 * Läser den TTL-cachade klasslistan (ingen extra runda vid sidbyte). Fel →
 * bara opt-in-modulerna dolda: en trasig läsning ska aldrig låsa ute eleven,
 * men heller aldrig visa en modul läraren inte slagit på.
 */
export async function getHiddenModules() {
  const meId = data.currentStudentId();
  if (!meId) return [...OPT_IN_MODULES];
  try {
    return modulesHiddenForStudent(await data.getClasses(), meId);
  } catch {
    return [...OPT_IN_MODULES];
  }
}

// --- Fokusläget / klass-låset (#436) -----------------------------------------
// Lås-logiken + bevakaren (onSnapshot på elevens klass-dokument) laddas
// DYNAMISKT – aldrig i den statiska bootgrafen (#271). Fel → null (öppet):
// ett trasigt lås ska aldrig låsa ute eleven från hela sidan.
let lasModP = null;
const lasLyssnare = new Set();

/**
 * Elevens aktiva lås som grind-vy ({ home, label, klockslag, allows(path,q),
 * isTarget(path,q), allowsArea(subj,area) }) eller null. Efter första anropet
 * svarar den ur minnet (ingen nätverksrunda per sidbyte).
 */
export async function getLockGate() {
  const meId = data.currentStudentId();
  try {
    if (!meId) {
      if (lasModP) (await lasModP).stopLockWatch();
      return null;
    }
    lasModP ||= import("./class-lock-watch.js").then((mod) => {
      mod.onLockChange((next, prev) => {
        const gate = mod.gateFor(next);
        lasLyssnare.forEach((fn) => fn(gate, prev, next));
      });
      return mod;
    });
    const mod = await lasModP;
    return mod.gateFor(await mod.lockForMe(meId));
  } catch (err) {
    console.warn("Fokusläget kunde inte läsas – allt öppet:", err);
    lasModP = null;
    return null;
  }
}

/**
 * Lyssna på lås-byten (lärare låser/låser upp, klockslaget passerar, eleven
 * lämnar in provet #788): fn(grind|null, förraLåset|null, nyttLåset|null).
 */
export function onLockChange(fn) {
  lasLyssnare.add(fn);
  return () => lasLyssnare.delete(fn);
}

// --- Mattematchen (#458) -------------------------------------------------------
// Menylänken syns BARA när en aktiv period finns där elevens klass deltar.
// Bevakaren (onSnapshot + timer till start/slut) laddas DYNAMISKT (#271) och
// ritar om menyn själv när perioden börjar/slutar. Fel → null (dold).
let mmModP = null;

/** Elevens aktiva Mattematch ({ competition, classId }) eller null. */
export async function getMattematch() {
  const meId = data.currentStudentId();
  try {
    if (!meId) {
      if (mmModP) (await mmModP).stopMattematchWatch();
      return null;
    }
    mmModP ||= import("./tavling/mm-watch.js").then((mod) => {
      mod.onMattematchChange(() => renderTopbar());
      return mod;
    });
    return await (await mmModP).mattematchForMe(meId);
  } catch (err) {
    console.warn("Mattematchen kunde inte läsas – dold:", err);
    mmModP = null;
    return null;
  }
}

// --- Live (#460) ---------------------------------------------------------------
// Live syns i menyn bara när elevens klass har en lobby/pågående match.
// Bevakaren (onSnapshot) laddas DYNAMISKT (#271); fel → dold, aldrig krasch.
let liveModP = null;

/** Finns en Live-lobby/match för elevens klass just nu? */
export async function getLiveVisible() {
  const meId = data.currentStudentId();
  try {
    if (!meId) {
      if (liveModP) (await liveModP).stopLiveWatch();
      return false;
    }
    liveModP ||= import("./live/live-watch.js").then((mod) => {
      mod.onLiveVisibleChange((on) => {
        const path = (window.location.hash || "#/").slice(1).split("?")[0];
        if (!path.startsWith("/elev/")) return;
        if (on && path !== "/elev/live") flash("⚡ En Live-match väntar på din klass – tryck på <b>Live pågår!</b> i menyn!");
        renderTopbar();
      });
      return mod;
    });
    return await (await liveModP).liveVisibleFor(meId);
  } catch (err) {
    console.warn("Live-synligheten kunde inte läsas:", err);
    liveModP = null;
    return false;
  }
}

// --- Prov (#740) ----------------------------------------------------------------
// "Prov" syns i menyn bara när elevens klass har ett ÖPPET provtillfälle (EN
// onSnapshot, som Live) eller eleven fått ett rättat prov tillbaka de senaste
// 14 dagarna (ETT getDocs per inloggning). Bevakaren laddas DYNAMISKT (#271).
let provModP = null;

/** Ska Prov synas i elevens meny? */
export async function getProvVisible() {
  const meId = data.currentStudentId();
  try {
    if (!meId) {
      if (provModP) (await provModP).stopProvWatch();
      return false;
    }
    provModP ||= import("./prov/prov-watch.js").then((mod) => {
      mod.onProvChange(({ nyttOppet, andrat }) => {
        const path = (window.location.hash || "#/").slice(1).split("?")[0];
        if (!path.startsWith("/elev/") || (!nyttOppet && !andrat)) return;
        if (nyttOppet && !path.startsWith("/elev/prov")) flash("📝 Din lärare har öppnat ett prov – tryck på <b>Prov</b> i menyn.");
        renderTopbar();
      });
      return mod;
    });
    return await (await provModP).provVisibleFor(meId);
  } catch (err) {
    console.warn("Prov-synligheten kunde inte läsas:", err);
    provModP = null;
    return false;
  }
}

// Villkorade menylänkar (#458/#460): `villkor` i NAV_LANKAR = nyckel här. Länken
// syns bara när villkoret (en dynamiskt laddad bevakare som själv ritar om
// menyn vid ändring) svarar sant – eller när eleven står på sidan (ej Live, #824).
// Nästa villkorade modul = en rad här + `villkor` på sin rad i STUDENT_MODULES.
const NAV_VILLKOR = {
  mattematchen: async () => !!(await getMattematch()),
  live: getLiveVisible,
  prov: getProvVisible,
};
export const villkorSynlig = (l, v, path) => !l.villkor || !!v[l.villkor] || (l.grupp !== "live" && l.hash.slice(1) === path);

// Elevens huvuddestinationer i sidomenyn. Menyn ritas grupp för grupp i
// NAV_GRUPPER-ordning (#701), inom gruppen i listans ordning.
// `grupp`: "mitt" = Hem/Shoppen (ingen rubrik), "ova" = övningsdelarna (rubrik
// ÖVA). En grupp utan synliga länkar ritar ingen rubrik.
// Modul-länkarna HÄRLEDS ur modulregistret (STUDENT_MODULES, #734): en NY MODUL
// läggs där (grupp "ova") – inte här.
// "Min klass" är borta ur navet – klassen nås numera i spelvärlden via
// klasskylten vid gården (#/elev/by, klassbyn).
// `modul` = id i TOGGLABLE_MODULES (#412): länken döljs om klassen döljer modulen
// (opt-in-moduler (#605) är dolda tills klassen aktiverat dem).
// `villkor` (#458/#460): länken syns bara när NAV_VILLKOR[villkor] svarar sant.
// Live ritas inte som länk utan som Live-ruta överst (#701) – samma synlighet.
const NAV_GRUPPER = [
  { id: "mitt", rubrik: "" },
  { id: "ova", rubrik: "Öva" },
];
const NAV_LANKAR = [
  { hash: "#/elev/hus", ikon: "🏠", label: "Hem", grupp: "mitt" },
  // Shoppen, Plugga, Läsresan, Mattematchen (villkor), Hitta rätt!, Ekvationsresan …
  ...STUDENT_MODULES.map((m) => ({
    hash: `#${m.routes[0]}`, ikon: m.ikon, label: m.label, grupp: m.grupp,
    modul: m.toggle === false ? undefined : m.id, villkor: m.villkor,
  })),
  // Live (#460): bara när klassen har en lobby/pågående match – blir Live-rutan.
  { hash: "#/elev/live", ikon: "⚡", label: "Live", grupp: "live", villkor: "live" },
];

/**
 * Rita sidomenyn. Namnet behålls (renderTopbar) eftersom alla sidor redan
 * anropar det vid varje navigering – nu ritar det i stället den bestående
 * vänstermenyn med profilruta (stjärnor + coins), Live-ruta och navgrupper.
 *
 * Sidomenyn (karaktär + nav) visas bara för en inloggad elev på elevsidorna.
 * På start-, inloggnings- och lärarsidorna fälls den ihop (body saknar
 * `.med-sidomeny`) så att innehållsytan får full bredd – lärarsidorna har sin
 * egen navigering (teacherNav) inuti #app.
 */
export async function renderTopbar() {
  const session = data.getSession();
  const path = (window.location.hash || "#/").slice(1).split("?")[0] || "/";
  const visaMeny = !!session && path.startsWith("/elev/") && path !== "/elev/avatar";

  document.body.classList.toggle("med-sidomeny", visaMeny);
  if (hamburger) hamburger.hidden = !visaMeny;
  if (!visaMeny) {
    if (sidebarBody) sidebarBody.replaceChildren();
    toggleSidomeny(false); // stäng ev. öppen mobilmeny när vi lämnar elevläget
    return;
  }

  // Hämta coins + avatar (inkl. burna klädsaker) + stjärnor i ett svep.
  let coins = 0;
  let avatarId = DEFAULT_AVATAR;
  let avatarItems = [];
  let stjarnor = 0; // insamlade stjärnor – visas i profilrutan bredvid mynten
  const doldaP = getHiddenModules(); // parallellt med elevdatat nedan
  const lasP = getLockGate();
  // Alla villkor (NAV_VILLKOR) parallellt; ett fel döljer bara den länken.
  const villkorP = Promise.all(
    Object.entries(NAV_VILLKOR).map(async ([k, fn]) => [k, await fn().catch(() => false)])
  );
  try {
    const sd = await data.getStudentData();
    coins = sd.coins || 0;
    avatarId = sd.avatarId || DEFAULT_AVATAR;
    avatarItems = sd.avatarItems || [];
    // Köpt avatar (#694): ladda konsten (lazy) innan sidan ritas – en gång per besök.
    if (!avatarArtReady(avatarId)) await loadAvatarArt();
    stjarnor = (await data.getStats()).stars || 0;
  } catch {}

  const dolda = new Set(await doldaP);
  const las = await lasP;
  const villkor = Object.fromEntries(await villkorP);
  // Fokusläget (#436) styr när det är aktivt: målet syns alltid (även om dess
  // modul annars är dold), resten bara om låset och modul-valet tillåter.
  const lankar = NAV_LANKAR.filter((l) => {
    if (!villkorSynlig(l, villkor, path)) return false;
    const synlig = !l.modul || !dolda.has(l.modul);
    if (!las) return synlig;
    const p = l.hash.slice(1);
    return las.allows(p) && (las.isTarget(p) || synlig);
  });
  const fokusHtml = las
    ? `<a class="sido-fokus" href="${las.home}" title="Din lärare har låst klassen hit">
        <span class="sido-fokus-ikon" aria-hidden="true">🎯</span>
        <span class="sido-fokus-text">Fokus: <b>${escHtml(las.label)}</b>
          <small>till ${las.klockslag}</small></span>
      </a>`
    : "";
  const lankHtml = (l) => `<a class="sido-nav-lank${l.hash.slice(1) === path ? " aktiv" : ""}" href="${l.hash}">
        <span class="sido-nav-ikon" aria-hidden="true">${l.ikon}</span>
        <span class="sido-nav-text">${l.label}</span>
      </a>`;
  const navHtml = NAV_GRUPPER.map((g) => {
    const iGrupp = lankar.filter((l) => l.grupp === g.id);
    if (!iGrupp.length) return "";
    const rubrik = g.rubrik ? `<div class="sido-grupp">${g.rubrik}</div>` : "";
    return rubrik + iGrupp.map(lankHtml).join("");
  }).join("");
  // Live-rutan (#701): samma filter som länkarna ovan (villkor + fokuslås).
  const live = lankar.find((l) => l.grupp === "live");
  const liveHtml = live
    ? `<a class="sido-live${live.hash.slice(1) === path ? " aktiv" : ""}" href="${live.hash}">
        <span class="sido-live-ikon" aria-hidden="true">${live.ikon}</span>
        <span class="sido-live-text">Live pågår!<small>Gå med i klassens match</small></span>
        <span class="sido-live-prick" aria-hidden="true"></span>
      </a>`
    : "";
  const tal = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("sv-SE");

  const wrap = el(`<div class="sido-inner">
    <div class="sido-karaktar">
      <div class="sido-profil-rad">
        <a class="sido-figur" href="#/elev/profil" title="Min profil">
          <span class="sido-avatar">${avatarMarkup(avatarId, avatarItems)}</span>
        </a>
        <a class="sido-namn" href="#/elev/profil" title="Min profil">
          <b>${escHtml(session.namn || "Elev")}</b><span>Min profil ›</span>
        </a>
      </div>
      <div class="sido-valuta">
        <span title="Dina stjärnor">${starIcon(18)} ${tal(stjarnor)}</span>
        <span title="Dina pluggcoins">${coinIcon(18)} ${tal(coins)}</span>
      </div>
    </div>

    ${fokusHtml}
    ${liveHtml}
    <nav class="sido-nav" aria-label="Huvudmeny">${navHtml}</nav>

    <div class="sido-fot">
      <button class="sido-logga-ut" id="logout-btn">Logga ut</button>
    </div>
  </div>`);

  wrap.querySelector("#logout-btn").addEventListener("click", async () => {
    // Hitta rätt!s lämna-vakt (#605) frågar FÖRE utloggningen – "Avbryt" ska inte
    // lämna eleven kvar i omgången men redan utloggad (#611 F1).
    if (window.__ppLamnaVakt?.({ oldURL: location.href, newURL: `${location.href.split("#")[0]}#/` })) return;
    // Schack (#780 F1): ta bort elevens väntan i lobbyn medan eleven ännu är inloggad (högst 1,5 s).
    await window.__ppSchackLamna?.();
    data.logout();
    go("#/");
  });

  sidebarBody.replaceChildren(wrap);
}
