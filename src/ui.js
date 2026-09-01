// ============================================================================
// Pluggportalen – gemensamma UI-hjälpare
// Delas av app.js (router) och sidmodulerna: DOM-referenser, navigering,
// en liten mall-hjälpare och sidhuvudet (topbar) med avatar, coins och utloggning.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { evoFromStudentData } from "./evolution.js";

export const app = document.getElementById("app");
export const topbarRight = document.getElementById("topbar-right");

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

/**
 * Rita sidhuvudets högra del. När eleven är inloggad visas avatar + namn
 * (klick → profil), pluggcoins-saldo och en utloggningsknapp – överallt.
 */
export async function renderTopbar() {
  const session = data.getSession();
  if (!session) {
    topbarRight.innerHTML = "";
    return;
  }
  // Hämta coins + avatar (inkl. burna klädsaker) i ett svep.
  let coins = 0;
  let avatarId = DEFAULT_AVATAR;
  let avatarItems = [];
  let evo; // aktuellt utvecklingssteg + ev. grenval (härlett ur framstegen)
  try {
    const sd = await data.getStudentData();
    coins = sd.coins || 0;
    avatarId = sd.avatarId || DEFAULT_AVATAR;
    avatarItems = sd.avatarItems || [];
    evo = evoFromStudentData(sd);
  } catch {}

  const wrap = el(`<div class="topbar-user">
    <button class="avatar-chip" id="profil-btn" title="Min profil">
      <span class="avatar-emoji">${avatarMarkup(avatarId, avatarItems, evo)}</span>
      <span class="avatar-namn">${session.namn || "Elev"}</span>
    </button>
    <span class="coins">🪙 ${coins}</span>
    <button class="btn ghost liten" id="logout-btn">Logga ut</button>
  </div>`);
  wrap.querySelector("#profil-btn").addEventListener("click", () => go("#/elev/profil"));
  wrap.querySelector("#logout-btn").addEventListener("click", () => {
    data.logout();
    go("#/");
  });
  topbarRight.replaceChildren(wrap);
}
