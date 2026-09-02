// ============================================================================
// Pluggportalen – gemensamma UI-hjälpare
// Delas av app.js (router) och sidmodulerna: DOM-referenser, navigering,
// en liten mall-hjälpare och den bestående sidomenyn (renderTopbar) med
// karaktärspanel, XP-bar, ⚡-genväg, navlänkar, coins och utloggning.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { evoFromStudentData } from "./evolution.js";
import { coinIcon } from "./icons.js";

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

// Elevens huvuddestinationer i sidomenyn (ordning = visningsordning).
// `grupp` avskiljer profil-relaterade val (Hem/Plugga/Shoppen) från övriga
// destinationer. "Min klass" hör inte till den egna profilen och renderas
// därför i en egen grupp med en visuell avdelare ovanför.
const NAV_LANKAR = [
  { hash: "#/elev/hem", ikon: "🏠", label: "Hem", grupp: "profil" },
  { hash: "#/elev/plugga", ikon: "📚", label: "Plugga", grupp: "profil" },
  { hash: "#/elev/shop", ikon: "🛒", label: "Shoppen", grupp: "profil" },
  { hash: "#/elev/klassfoto", ikon: "👩‍👦‍👦", label: "Min klass", grupp: "socialt" },
];

/**
 * Rita sidomenyn. Namnet behålls (renderTopbar) eftersom alla sidor redan
 * anropar det vid varje navigering – nu ritar det i stället den bestående
 * vänstermenyn med karaktärspanel, XP-bar, ⚡-genväg och navlänkar.
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

  // Hämta coins + avatar (inkl. burna klädsaker) + XP/nivå + stjärnor i ett svep.
  let coins = 0;
  let avatarId = DEFAULT_AVATAR;
  let avatarItems = [];
  let evo; // nivå, XP-progress och utvecklingssteg (härlett ur framstegen)
  let stjarnor = 0; // insamlade stjärnor – visas i sidomenyns fot ovanför mynten
  try {
    const sd = await data.getStudentData();
    coins = sd.coins || 0;
    avatarId = sd.avatarId || DEFAULT_AVATAR;
    avatarItems = sd.avatarItems || [];
    evo = evoFromStudentData(sd);
    stjarnor = (await data.getStats()).stars || 0;
  } catch {}

  // XP-baren speglar exakt samma värde som utvecklingssidan (evoFromStudentData
  // → xpIntoLevel(xp).progressRatio).
  const pct = evo ? Math.round(Math.min(1, Math.max(0, evo.progressRatio)) * 100) : 0;
  const niva = evo ? evo.level : 1;

  const navHtml = NAV_LANKAR.map((l, i) => {
    // Avdelare när gruppen byts (t.ex. mellan profil-valen och "Min klass").
    const nyGrupp = i > 0 && l.grupp !== NAV_LANKAR[i - 1].grupp;
    const avdelare = nyGrupp ? `<hr class="sido-nav-avdelare" aria-hidden="true" />` : "";
    return `${avdelare}<a class="sido-nav-lank${l.hash.slice(1) === path ? " aktiv" : ""}" href="${l.hash}">
        <span class="sido-nav-ikon" aria-hidden="true">${l.ikon}</span>
        <span class="sido-nav-text">${l.label}</span>
      </a>`;
  }).join("");

  const wrap = el(`<div class="sido-inner">
    <div class="sido-karaktar">
      <span class="sido-figur">
        <span class="sido-avatar">${avatarMarkup(avatarId, avatarItems, evo)}</span>
      </span>
      <a class="sido-namn" href="#/elev/profil" title="Min profil">${session.namn || "Elev"}</a>
      <div class="sido-xp-rad">
        <div class="sido-xp-kol">
          <div class="sido-xp-topp">
            <span class="sido-niva" title="Din nivå">Nivå ${niva}</span>
          </div>
          <div class="sido-xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="${pct}" aria-label="Framsteg mot nästa nivå">
            <div class="sido-xp-fyll" style="width:${pct}%"></div>
          </div>
        </div>
        <a class="sido-blixt" href="#/elev/utveckling" title="Till Utveckling" aria-label="Till Utveckling">⚡</a>
      </div>
    </div>

    <nav class="sido-nav" aria-label="Huvudmeny">${navHtml}</nav>

    <div class="sido-fot">
      <span class="sido-stjarnor" title="Dina stjärnor">⭐ ${stjarnor} stjärnor</span>
      <div class="sido-fot-rad">
        <span class="coins" title="Dina pluggcoins">${coinIcon(22)} ${coins}</span>
        <button class="btn ghost liten" id="logout-btn">Logga ut</button>
      </div>
    </div>
  </div>`);

  wrap.querySelector("#logout-btn").addEventListener("click", () => {
    data.logout();
    go("#/");
  });

  sidebarBody.replaceChildren(wrap);
}
