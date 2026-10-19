// ============================================================================
// Pluggporten – elevens lås-bevakare (issue #436, fokusläge)
// ----------------------------------------------------------------------------
// Håller elevens AKTIVA klass-lås i minnet så routern och sidomenyn kan fråga
// utan nätverksrunda vid varje sidbyte (husvärldens zoom får inte vänta):
//   1. första frågan: klasslistan (TTL-cachad, samma läsning som sidorna gör)
//      → elevens klasser → lås-läget direkt
//   2. därefter en onSnapshot-lyssnare per klass-dokument → lärarens "Lås" /
//      "Lås upp nu" slår igenom DIREKT, utan omladdning
//   3. en timer till `till` (+ 15 s-intervall och flik-återkomst som skyddsnät
//      mot strypta bakgrunds-timers) → automatisk återgång när klockslaget går
//   4. provlås med ett efter-val (#788): en onSnapshot på elevens eget svar
//      (provTillfallen/{t}/svar/{uid}) → inlämnat ger lärarens efter-läge direkt
// Tiden jämförs mot serverNow() (klock-korrigerad, data-class-lock.js).
//
// Laddas DYNAMISKT (ui.getLockGate) – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses, clearClassCache } from "./data-classes.js";
import { gateFor, lockForStudent, lockBehoverInlamning, lockEfterInlamning } from "./class-lock.js";
import { serverNow, syncServerClock } from "./data-class-lock.js";

let watch = null; // { meId, order: classId[], docs: Map, unsubs: fn[], iv, ready }
let svarWatch = null; // { t, unsub, inlamnad } – elevens svar under ett provlås med efter-val (#788)
let current = null; // aktivt lås (+ classId) eller null
let currentKey = "null";
let timer = null;
const lyssnare = new Set();

/** Lyssna på lås-byten: fn(nyttLås|null, förraLås|null). Returnerar avregistrering. */
export function onLockChange(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

/** Router-/meny-vänlig vy av ett lås (bor i class-lock.js, ren logik – testbar). */
export { gateFor };

function schemalaggSlut(lock) {
  clearTimeout(timer);
  timer = null;
  if (!lock) return;
  // +200 ms så vi garanterat landar EFTER sluttiden; taket = setTimeout-max.
  const ms = Math.min(Math.max(0, lock.till - serverNow() + 200), 2_000_000_000);
  timer = setTimeout(omrakna, ms);
}

function stoppaSvar() {
  svarWatch?.unsub();
  svarWatch = null;
}

/**
 * Har eleven lämnat in provet som låset gäller? Startar (eller byter) lyssnaren
 * på elevens svar. Tills första svaret kommit räknas provet som INTE inlämnat.
 */
function inlamnadFor(lock) {
  if (!lockBehoverInlamning(lock)) {
    stoppaSvar();
    return false;
  }
  const t = lock.mal.id;
  if (svarWatch?.t !== t) {
    stoppaSvar();
    let forstaKlar;
    const sw = { t, inlamnad: false, unsub: null, forsta: new Promise((r) => (forstaKlar = r)) };
    svarWatch = sw;
    sw.unsub = onSnapshot(
      doc(db, "provTillfallen", t, "svar", watch.meId),
      (snap) => {
        if (svarWatch !== sw) return;
        sw.inlamnad = snap.exists() && snap.data().inlamnad === true;
        forstaKlar();
        // Startläget (lockForMe väntar in första svaret): routern grindar själv.
        omrakna({ tyst: !!watch?.startar });
      },
      (err) => {
        console.warn("Fokusläget: kunde inte bevaka provsvaret", t, err);
        forstaKlar();
      }
    );
  }
  return svarWatch.inlamnad;
}

/** Räkna om låset ur de bevakade klass-dokumenten; meddela vid ändring. */
function omrakna({ tyst = false } = {}) {
  if (!watch) return;
  const klasser = watch.order.map((id) => watch.docs.get(id)).filter(Boolean);
  const las = lockForStudent(klasser, watch.meId, serverNow());
  const next = lockEfterInlamning(las, inlamnadFor(las));
  const key = JSON.stringify(next);
  schemalaggSlut(next);
  if (key === currentKey) return;
  const prev = current;
  current = next;
  currentKey = key;
  if (tyst) return;
  for (const fn of lyssnare) {
    try {
      fn(next, prev);
    } catch (err) {
      console.error("Fokusläget: lyssnare kastade", err);
    }
  }
}

/** Sluta bevaka (utloggning / elevbyte). */
export function stopLockWatch() {
  if (!watch) return;
  watch.unsubs.forEach((u) => u());
  stoppaSvar();
  clearInterval(watch.iv);
  clearTimeout(timer);
  watch = null;
  current = null;
  currentKey = "null";
}

/**
 * Elevens aktiva lås (eller null). Första anropet för en elev startar
 * bevakningen; senare anrop svarar ur minnet.
 * @param {string} meId
 */
export async function lockForMe(meId) {
  if (!meId) {
    stopLockWatch();
    return null;
  }
  if (watch?.meId === meId) {
    await watch.ready;
    return current;
  }
  stopLockWatch();
  const w = { meId, order: [], docs: new Map(), unsubs: [], iv: null };
  watch = w;
  w.ready = (async () => {
    // Klock-synken får aldrig fördröja första sidan – omräkning när den landat.
    syncServerClock().then(() => watch === w && omrakna());
    const klasser = await getClasses().catch(() => []);
    if (watch !== w) return;
    const mina = klasser.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId));
    w.order = mina.map((c) => c.id);
    mina.forEach((c) => w.docs.set(c.id, c));
    w.startar = true;
    omrakna({ tyst: true }); // startläget: routern grindar själv, ingen notis
    // Provlås med efter-val (#788): vänta in elevens svar (högst 3 s) så en elev
    // som redan lämnat in inte först skickas till provet vid en omladdning.
    if (svarWatch) await Promise.race([svarWatch.forsta, new Promise((r) => setTimeout(r, 3000))]);
    if (watch !== w) return;
    omrakna({ tyst: true });
    w.startar = false;
    for (const id of w.order) {
      let forsta = true;
      w.unsubs.push(
        onSnapshot(
          doc(db, "classes", id),
          (snap) => {
            if (watch !== w) return;
            if (snap.exists()) w.docs.set(id, { id, ...snap.data() });
            else w.docs.delete(id);
            // Klassen ändrades efter start → TTL-cachen är inaktuell (Plugga-
            // listan, modul-synligheten m.m. ska läsa om).
            if (!forsta) clearClassCache();
            forsta = false;
            omrakna();
          },
          (err) => console.warn("Fokusläget: kunde inte bevaka klassen", id, err)
        )
      );
    }
    w.iv = setInterval(omrakna, 15_000);
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
