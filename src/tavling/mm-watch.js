// ============================================================================
// Mattematchen – elevens bevakare av aktiv period (#458)
// ----------------------------------------------------------------------------
// Håller elevens AKTIVA Mattematch i minnet så sidomenyn och sidan kan fråga
// utan nätverksrunda vid varje sidbyte (samma mönster som class-lock-watch.js):
//   1. klasslistan (TTL-cachad) → elevens klasser
//   2. EN onSnapshot-fråga: mathCompetitions där participatingClassIds
//      array-contains-any elevens klasser (enkelfälts-index, inget deploy-krav)
//      → lärarens nya/ändrade/stoppade tävling slår igenom direkt
//   3. timer till nästa startAt/endAt (+ 30 s-skyddsnät och flik-återkomst)
//      → menyn visar/döljer Mattematchen automatiskt när perioden börjar/slutar
// Tiden jämförs mot serverNow() (klock-korrigerad, data-class-lock.js).
//
// Laddas DYNAMISKT (ui.getMattematch) – aldrig i den statiska bootgrafen (#271).
// Fel → null (dold): en trasig läsning får aldrig stoppa resten av sidan.
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection, query, where, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses } from "../data-classes.js";
import { serverNow, syncServerClock } from "../data-class-lock.js";
import { activeCompetitionFor, nextBoundary } from "./mm-core.js";

let watch = null; // { meId, myClassIds, comps, unsub, iv, ready }
let current = null; // { competition, classId } | null
let currentKey = "null";
let timer = null;
const lyssnare = new Set();

export { serverNow as mmNow };

/** Lyssna på byten: fn(nytt|null, förra|null). Returnerar avregistrering. */
export function onMattematchChange(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

// Nyckeln fångar allt som syns för eleven (ny period, namn, sluttid, paus).
function keyOf(m) {
  if (!m) return "null";
  const c = m.competition;
  return JSON.stringify([c.id, m.classId, c.name, c.status, String(c.endAt?.seconds ?? c.endAt)]);
}

function schemalagg() {
  clearTimeout(timer);
  timer = null;
  if (!watch) return;
  const t = nextBoundary(watch.comps, watch.myClassIds, serverNow());
  if (t == null) return;
  timer = setTimeout(omrakna, Math.min(Math.max(0, t - serverNow() + 250), 2_000_000_000));
}

function omrakna({ tyst = false } = {}) {
  if (!watch) return;
  const next = activeCompetitionFor(watch.comps, watch.myClassIds, serverNow());
  schemalagg();
  const key = keyOf(next);
  const prev = current;
  current = next;
  if (key === currentKey) return;
  currentKey = key;
  if (tyst) return;
  for (const fn of lyssnare) {
    try {
      fn(next, prev);
    } catch (err) {
      console.error("Mattematchen: lyssnare kastade", err);
    }
  }
}

/** Sluta bevaka (utloggning / elevbyte). */
export function stopMattematchWatch() {
  if (!watch) return;
  watch.unsub?.();
  clearInterval(watch.iv);
  clearTimeout(timer);
  watch = null;
  current = null;
  currentKey = "null";
}

/**
 * Elevens aktiva Mattematch ({ competition, classId }) eller null. Första
 * anropet för en elev startar bevakningen; senare anrop svarar ur minnet.
 * @param {string} meId
 */
export async function mattematchForMe(meId) {
  if (!meId) {
    stopMattematchWatch();
    return null;
  }
  if (watch?.meId === meId) {
    await watch.ready;
    return current;
  }
  stopMattematchWatch();
  const w = { meId, myClassIds: [], comps: [], unsub: null, iv: null };
  watch = w;
  w.ready = (async () => {
    syncServerClock().then(() => watch === w && omrakna());
    const klasser = await getClasses().catch(() => []);
    if (watch !== w) return;
    w.myClassIds = klasser
      .filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId))
      .map((c) => c.id);
    if (!w.myClassIds.length) return; // ingen klass → ingen tävling
    // array-contains-any tar högst 30 värden (en elev har ett par klasser).
    const q = query(
      collection(db, "mathCompetitions"),
      where("participatingClassIds", "array-contains-any", w.myClassIds.slice(0, 30))
    );
    // Första svaret inväntas (menyn ska inte blinka), sedan lever lyssnaren.
    await new Promise((resolve) => {
      let forsta = true;
      w.unsub = onSnapshot(
        q,
        (snap) => {
          if (watch !== w) return resolve();
          w.comps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          omrakna({ tyst: forsta });
          forsta = false;
          resolve();
        },
        (err) => {
          console.warn("Mattematchen: kunde inte bevaka tävlingar", err);
          resolve();
        }
      );
    });
    if (watch === w) w.iv = setInterval(omrakna, 30_000);
  })();
  await w.ready;
  return current;
}

// Fliken tillbaka i förgrunden → kolla direkt (bakgrunds-timers stryps).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) omrakna();
  });
}
