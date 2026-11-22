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
//   5. veckoschemat (#902, docs/VECKOSCHEMA.md): samma klass-dokument ger
//      schemaForStudent – en timer till nästa ändring (lektionens start/slut)
//      med samma skyddsnät. Fokuslåset går alltid före (kombineradGrind).
//      0 nya läsningar utan en lektion som pågår eller återstår i dag; annars
//      hämtas ämnena (+ lektionsämnenas områden om klassen ser hela biblioteket)
//      ur samma TTL-cache som Plugga-listan, en gång per ändrat behov.
// Tiden jämförs mot serverNow() (klock-korrigerad, data-class-lock.js).
//
// Laddas DYNAMISKT (ui.getLockGate) – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses, clearClassCache } from "./data-classes.js";
import { getSubjects, getAreas } from "./data-content.js";
import { gateFor, lockForStudent, lockBehoverInlamning, lockEfterInlamning } from "./class-lock.js";
import { schemaForStudent, nastaSchemaAndring, kombineradGrind, schemaInfoBehov } from "./klass-schema.js";
import { serverNow, syncServerClock } from "./data-class-lock.js";

let watch = null; // { meId, order: classId[], docs: Map, unsubs: fn[], iv, ready }
let svarWatch = null; // { t, unsub, inlamnad } – elevens svar under ett provlås med efter-val (#788)
let current = null; // aktivt lås (+ classId) eller null
let currentLage = null; // veckoschemats läge (#902) – null när ett lås gäller eller ingen lektion pågår
let currentKey = "null";
let timer = null;
// Ämnesnamn/-områden till schemaForStudent (#902): { nyckel, opts } när laddat, `laddar` = pågående nyckel.
let schemaInfo = { nyckel: null, opts: null, laddar: null, klar: null, amnen: null, omraden: false };
const lyssnare = new Set();

/**
 * Lyssna på grind-byten: fn(nyttLås|null, förraLås|null, nyttSchema|null, förraSchema|null).
 * Schemaläget är null medan ett lås gäller (låset går före). När schemat blir null har
 * förraSchema `avslutad: true` om lektionen nådde sin sluttid. Returnerar avregistrering.
 */
export function onLockChange(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

/** Router-/meny-vänlig vy av ett lås / den kombinerade grinden (ren logik – testbar). */
export { gateFor, kombineradGrind };

/** Den kombinerade grinden just nu: låset, annars schemat, annars null (efter lockForMe). */
export function aktuellGrind() {
  return kombineradGrind(current, currentLage);
}

function schemalaggSlut(lock, andring) {
  clearTimeout(timer);
  timer = null;
  const nasta = Math.min(lock ? lock.till : Infinity, andring ?? Infinity);
  if (nasta === Infinity) return;
  // +200 ms så vi garanterat landar EFTER sluttiden; taket = setTimeout-max.
  const ms = Math.min(Math.max(0, nasta - serverNow() + 200), 2_000_000_000);
  timer = setTimeout(omrakna, ms);
}

/**
 * Ladda ämnena (och vid behov lektionsämnenas områden) för schemaForStudent.
 * Samma TTL-cachade läsningar som Plugga-listan. Fel → utan namn/områdesinfo
 * (label = ämnes-id, varje ämne antas ha områden) – aldrig ett stängt läge.
 */
function laddaSchemaInfo(behov) {
  if (schemaInfo.laddar === behov.nyckel) return schemaInfo.klar;
  const info = { nyckel: null, opts: null, laddar: behov.nyckel, klar: null, amnen: null, omraden: false };
  schemaInfo = info;
  info.klar = (async () => {
    const subjects = await getSubjects().catch(() => null);
    const amnenMedOmraden = behov.omraden
      ? (await Promise.all(behov.amnen.map((a) => getAreas(a).then((l) => (l.length ? a : null), () => a)))).filter(Boolean)
      : null;
    if (schemaInfo !== info) return;
    info.opts = { subjects: subjects || undefined, amnenMedOmraden };
    info.nyckel = behov.nyckel;
    info.amnen = new Set(behov.amnen);
    info.omraden = behov.omraden;
    info.laddar = null;
    if (watch?.uppe) omrakna(); // i startläget räknar lockForMe om själv (tyst)
  })();
  return info.klar;
}

/** Schemaläget ur klasserna – eller det förra medan ämnesinfon laddas (inget flimmer). */
/** Täcker den laddade ämnesinfon behovet? (Färre ämnen kvar i dag → ingen ny hämtning.) */
const tacker = (info, behov) => info.nyckel !== null &&
  behov.amnen.every((a) => info.amnen.has(a)) && behov.omraden === info.omraden;

function schemaLage(klasser, now) {
  const behov = schemaInfoBehov(klasser, watch.meId, now);
  if (!behov) return null; // ingen lektion kvar i dag → ingen läsning
  if (!tacker(schemaInfo, behov)) {
    laddaSchemaInfo(behov);
    return currentLage;
  }
  return schemaForStudent(klasser, watch.meId, now, schemaInfo.opts);
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
  const now = serverNow();
  const las = lockForStudent(klasser, watch.meId, now);
  const next = lockEfterInlamning(las, inlamnadFor(las));
  // Fokuslåset går alltid före schemat: medan ett lås gäller räknas schemat som null.
  const lage = next ? null : schemaLage(klasser, now);
  const key = JSON.stringify([next, lage]);
  schemalaggSlut(next, nastaSchemaAndring(klasser, watch.meId, now));
  if (key === currentKey) return;
  const prev = current;
  const prevLage = currentLage;
  current = next;
  currentLage = lage;
  currentKey = key;
  if (tyst) return;
  // avslutad: lektionen nådde sin sluttid (inte urbockad/ändrad före) – "Lektionen är slut".
  const forra = prevLage && !lage ? { ...prevLage, avslutad: now >= prevLage.till - 1000 } : prevLage;
  for (const fn of lyssnare) {
    try {
      fn(next, prev, lage, forra);
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
  currentLage = null;
  currentKey = "null";
  schemaInfo = { nyckel: null, opts: null, laddar: null, klar: null, amnen: null, omraden: false };
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
    // Veckoschemat (#902): ämnesinfon först (högst 3 s) så första sidan grindas med rätt läge.
    const behov = schemaInfoBehov(mina, meId, serverNow());
    if (behov) await Promise.race([laddaSchemaInfo(behov), new Promise((r) => setTimeout(r, 3000))]);
    if (watch !== w) return;
    w.startar = true;
    omrakna({ tyst: true }); // startläget: routern grindar själv, ingen notis
    // Provlås med efter-val (#788): vänta in elevens svar (högst 3 s) så en elev
    // som redan lämnat in inte först skickas till provet vid en omladdning.
    if (svarWatch) await Promise.race([svarWatch.forsta, new Promise((r) => setTimeout(r, 3000))]);
    if (watch !== w) return;
    omrakna({ tyst: true });
    w.startar = false;
    w.uppe = true;
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
