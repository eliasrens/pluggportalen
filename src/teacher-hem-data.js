// ============================================================================
// Pluggporten – lärarsidan: Hem, läsningarna (teacher-hem-data.js, #807)
// ----------------------------------------------------------------------------
// Kvoten (#114/#231, epic #802 §0): Hem läser HÖGST EN gång per klass, aldrig
// per elev. Allt Hem läser utöver det som redan lästs (klasserna, kontot,
// Live-lyssnaren) går genom adaptern nedan, så att testet kan räkna anropen
// (test/lararsida-hem.test.js). Listan finns i docs/LARARSIDAN_HEM_LASNINGAR.md:
//   projektion(classId)     classProjections/{classId} – 1 getDoc per synlig
//                           klass (session-cachad 30 s i data-content.js)
//   attRatta({classes,role}) provTillfallen where classId in … + attRatta == true
//                           (delas med märket, cachad 5 min – prov-att-ratta.js)
//   oppnaProv(classIds)     provTillfallen where classId in … + status == "oppet"
//   egetProv(uid)           prov where createdBy == uid, limit 1   } bara medan Kom
//   egenLive(uid)           liveSessions where createdBy == uid,   } igång visas och
//                           limit 1                                } steget inte är klart
// Laddas med import() från teacher-hem.js (#271).
// ============================================================================

import { db } from "./firebase-config.js";
import { collection, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClassProjection } from "./data.js";
import { LAGRING } from "./teacher-hem-logik.js";

// --- localStorage (aldrig kastande: privat läge, fullt, blockerat) ------------
export function lasLokalt(nyckel, reserv = null) {
  try {
    const v = localStorage.getItem(nyckel);
    return v == null ? reserv : JSON.parse(v);
  } catch {
    return reserv;
  }
}
export function sparaLokalt(nyckel, v) {
  try {
    if (v == null) localStorage.removeItem(nyckel);
    else localStorage.setItem(nyckel, JSON.stringify(v));
  } catch { /* ingen lagring – valet gäller bara den här visningen */ }
}

/** Admin: dolda klasser (per lärare, i den här webbläsaren). */
export const doldaKlasser = (uid) => new Set(lasLokalt(LAGRING.doldaKlasser(uid), []));
export const sparaDoldaKlasser = (uid, set) => sparaLokalt(LAGRING.doldaKlasser(uid), set.size ? [...set] : null);

// --- Firestore ------------------------------------------------------------------
const delar30 = (ids) => {
  const ut = [];
  for (let i = 0; i < ids.length; i += 30) ut.push(ids.slice(i, i + 30));
  return ut;
};
const finns = async (q) => !(await getDocs(q)).empty;

/** Den riktiga adaptern (Firestore). */
export const FIRESTORE = {
  projektion: async (classId) => (await getClassProjection(classId))?.members || {},
  attRatta: async (o) => (await import("./prov/prov-att-ratta.js")).hamtaAttRatta(o),
  oppnaProv: async (classIds) => {
    const snaps = await Promise.all(delar30([...new Set(classIds)]).map((d) =>
      getDocs(query(collection(db, "provTillfallen"), where("classId", "in", d), where("status", "==", "oppet")))));
    return snaps.flatMap((s) => s.docs.map((x) => ({ id: x.id, ...x.data() })));
  },
  egetProv: (uid) => finns(query(collection(db, "prov"), where("createdBy", "==", uid), limit(1))),
  egenLive: (uid) => finns(query(collection(db, "liveSessions"), where("createdBy", "==", uid), limit(1))),
};

/**
 * Allt Hem läser. Varje del felar för sig (tom/null) – sidan ritar det som gick.
 * @param {object} o
 * @param {object[]} o.classes   lärarens klasser (redan lästa, filterClasses)
 * @param {object[]} o.synliga   klasserna som visas (admin: utan dolda) – projektionerna läses bara för dem
 * @param {object} o.role        myRole()
 * @param {{ prov?: boolean, live?: boolean }} [o.fraga]  Kom igång-stegen som ska kollas
 * @param {object} [adapter]
 */
export async function lasHem({ classes, synliga, role, fraga = {} }, adapter = FIRESTORE) {
  const tyst = (p, reserv) => Promise.resolve().then(p).catch((err) => (console.warn("Hem:", err), reserv));
  const [members, attRatta, oppnaProv, egetProv, egenLive] = await Promise.all([
    Promise.all(synliga.map((c) => tyst(() => adapter.projektion(c.id), null))),
    tyst(() => adapter.attRatta({ classes, role }), []),
    classes.length ? tyst(() => adapter.oppnaProv(classes.map((c) => c.id)), []) : [],
    fraga.prov ? tyst(() => adapter.egetProv(role.uid), false) : false,
    fraga.live ? tyst(() => adapter.egenLive(role.uid), false) : false,
  ]);
  return { members: new Map(synliga.map((c, i) => [c.id, members[i]])), attRatta, oppnaProv, egetProv, egenLive };
}
