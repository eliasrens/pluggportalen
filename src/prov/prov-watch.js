// ============================================================================
// Prov (#740, spec §5.5): elevens bevakare – samma mönster som Live
// (live-watch.js). "Prov" syns i menyn bara när
//   • elevens klass har ett ÖPPET tillfälle: EN onSnapshot med
//     where("classId", "in", klasser) + where("status", "==", "oppet")
//     (reglerna kräver statusfiltret), eller
//   • eleven fått ett rättat prov tillbaka de senaste 14 dagarna: ETT getDocs
//     per inloggning (collection group rattning, elevId + aterlamnad, limit 10).
// Provsidan läser tillfällena härifrån – ingen egen läsning av listan.
// Laddas DYNAMISKT av ui.js (getProvVisible) – aldrig i bootgrafen (#271).
//
// API
//   provVisibleFor(meId) → Promise<boolean> (startar bevakningen första gången)
//   provForMe(meId)      → Promise<{ oppna, tillbaka, myClassIds }>
//   onProvChange(fn)     → fn({ oppna, tillbaka, synligt, nyttOppet, andrat })
//   stopProvWatch()
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection, collectionGroup, getDocs, limit, onSnapshot, orderBy, query, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses } from "../data-classes.js";
import { serverNow, syncServerClock } from "../data-class-lock.js";
import { SAMLING_TILLFALLEN, RATTNING, STATUS } from "./prov-modell.js";
import { provSynligt } from "./prov-tillfalle-logik.js";

let watch = null; // { meId, myClassIds, oppna, tillbaka, unsub, ready }
let synligt = false;
const lyssnare = new Set();

export function onProvChange(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

function meddela(nyttOppet = false) {
  if (!watch) return;
  const fore = synligt;
  synligt = provSynligt(watch, serverNow());
  const info = { oppna: watch.oppna, tillbaka: watch.tillbaka, synligt, nyttOppet, andrat: fore !== synligt };
  lyssnare.forEach((fn) => { try { fn(info); } catch (e) { console.warn(e); } });
}

export function stopProvWatch() {
  if (!watch) return;
  watch.unsub?.();
  watch = null;
  synligt = false;
}

/** Elevens tillbakalämnade rättningar (nyast först, högst 10) – en läsning. */
async function hamtaTillbaka(meId) {
  const q = query(collectionGroup(db, RATTNING), where("elevId", "==", meId), where("aterlamnad", "==", true),
    orderBy("aterlamnadAt", "desc"), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.ref.parent.parent.id, ...d.data() }));
}

/** Starta (eller återanvänd) bevakningen för eleven. */
export async function provForMe(meId) {
  if (!meId) {
    stopProvWatch();
    return { oppna: [], tillbaka: [], myClassIds: [] };
  }
  if (watch?.meId !== meId) {
    stopProvWatch();
    const w = { meId, myClassIds: [], oppna: [], tillbaka: [], unsub: null };
    watch = w;
    w.ready = (async () => {
      syncServerClock();
      const klasser = await getClasses().catch(() => []);
      if (watch !== w) return;
      // "in" tar högst 30 värden – en elev går i långt färre klasser.
      w.myClassIds = klasser.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId)).map((c) => c.id).slice(0, 30);
      const tillbakaP = hamtaTillbaka(meId).then((t) => { if (watch === w) w.tillbaka = t; }, (err) => console.warn("Prov: tillbakalämnade kunde inte läsas", err));
      if (!w.myClassIds.length) return void (await tillbakaP);
      // Sidomenyn väntar på svaret – häng aldrig mer än 4 s (offline o.d.).
      const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
      let forsta = true;
      await Promise.race([timeout, Promise.all([tillbakaP, new Promise((resolve) => {
        const q = query(collection(db, SAMLING_TILLFALLEN), where("classId", "in", w.myClassIds), where("status", "==", STATUS.OPPET));
        w.unsub = onSnapshot(q, (snap) => {
          if (watch !== w) return;
          const fore = new Set(w.oppna.map((t) => t.id));
          w.oppna = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const nytt = !forsta && w.oppna.some((t) => !fore.has(t.id));
          forsta = false;
          meddela(nytt);
          resolve();
        }, (err) => {
          console.warn("Prov: kunde inte bevaka provtillfällen", err);
          resolve();
        });
      })])]);
    })();
  }
  const w = watch;
  await w.ready;
  return { oppna: w.oppna, tillbaka: w.tillbaka, myClassIds: w.myClassIds };
}

/** Ska Prov synas i elevens meny? Första anropet startar bevakningen. */
export async function provVisibleFor(meId) {
  const info = await provForMe(meId);
  synligt = provSynligt(info, serverNow());
  return synligt;
}
