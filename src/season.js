// ============================================================================
// Pluggporten – säsongen i klienten (issue #690, epic #689)
// ----------------------------------------------------------------------------
// EN onSnapshot-lyssnare på ETT dokument (config/season) för hela sessionen –
// läskvoten (#231). Läget hålls i season-store.js (ren logik) och exponeras:
//
//   getSeason()          { season, halloween, halloweenUntil, halloweenActive, config }
//   isHalloweenActive()  Halloween på just nu (server-korrigerad klocka)
//   onSeasonChange(fn)   fn(nytt, förra) vid ändring – också document-händelsen
//                        "pp:season" (detail = { season, prev })
//   startSeasonWatch()   startar lyssnaren (anropas av de andra, idempotent)
//   saveSeason(...)      BARA admin (firestore.rules) – adminfliken Säsong
//
// Senast kända värde sparas i localStorage (SEASON_CACHE_KEY) så att rätt tema
// kan visas direkt vid nästa start, även utloggad (inloggningsskärmen, §1.5).
// Klockan: serverNow() (samma som fokusläget, data-class-lock.js), så att en
// framställd datorklocka inte förlänger eller avslutar Halloween.
//
// Laddas BARA med import() – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { auth, db } from "./firebase-config.js";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { serverNow, syncServerClock } from "./data-class-lock.js";
import { createSeasonStore } from "./season-store.js";
import { SEASONS, normalizeSeason } from "./season-config.js";

/** localStorage-nyckeln: JSON { season, halloween, halloweenUntil(ms|null) }. */
export const SEASON_CACHE_KEY = "pp:season";

const store = createSeasonStore({
  now: serverNow,
  load: () => JSON.parse(localStorage.getItem(SEASON_CACHE_KEY) || "null"),
  save: (s) => localStorage.setItem(SEASON_CACHE_KEY, JSON.stringify(s)),
});

store.subscribe((next, prev) => {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("pp:season", { detail: { season: next, prev } }));
});

let unsub = null;
let loaded;
const loadedP = new Promise((r) => (loaded = r));

/** Löses när servern svarat första gången (eller läsningen misslyckats). */
export function seasonLoaded() {
  startSeasonWatch();
  return loadedP;
}

/** Starta (en gång) lyssnaren på config/season. Fungerar även utloggad. */
export function startSeasonWatch() {
  if (unsub) return;
  unsub = onSnapshot(
    doc(db, "config", "season"),
    (snap) => {
      store.snapshot(snap.exists() ? snap.data() : null);
      loaded();
    },
    // Nekad (t.ex. reglerna inte deployade): behåll cachen (eller sommar) och
    // försök inte igen i sessionen – sidan ska aldrig gå sönder eller spamma.
    (err) => {
      console.warn("Säsongen: kunde inte läsa config/season", err);
      loaded();
    }
  );
  syncServerClock().then(() => store.recheck());
}

/** Nuvarande säsongsläge (cachat/förvalt tills servern svarat). */
export function getSeason() {
  startSeasonWatch();
  return store.get();
}

export function isHalloweenActive() {
  return getSeason().halloweenActive;
}

/** Har servern svarat (annars visar getSeason() cachen eller sommar)? */
export function seasonFromServer() {
  return store.fromServer;
}

/** fn(nytt, förra) vid varje ändring. Returnerar avregistrering. */
export function onSeasonChange(fn) {
  startSeasonWatch();
  return store.subscribe(fn);
}

/**
 * Spara säsongen (admin). halloweenUntil = ms eller null (inget slutdatum).
 * @param {{season:string, halloween:boolean, halloweenUntil:number|null}} v
 */
export async function saveSeason(v) {
  if (!Object.prototype.hasOwnProperty.call(SEASONS, v.season)) throw new Error(`Okänd säsong: ${v.season}`);
  const s = normalizeSeason(v);
  await setDoc(doc(db, "config", "season"), {
    season: s.season,
    halloween: s.halloween,
    halloweenUntil: s.halloweenUntil == null ? null : Timestamp.fromMillis(s.halloweenUntil),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  });
}

// Fliken tillbaka i förgrunden → räkna om direkt (bakgrunds-timers stryps).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) store.recheck();
  });
}
