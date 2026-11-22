// ============================================================================
// Matchdagen på SERVERN – topplistan per årskurs (functions/md-topplista-bygg.js, #880)
// ----------------------------------------------------------------------------
// docs/MATCHDAGEN.md §21. Bara Cloud Functions skriver (firestore.rules):
//   mdTopplista/skolan   { version, byggd, arskurser: { "3": [rad…], "ovriga": [...] }, antal: { "3": n } }
//                        rad = { uid, n, lag, f, k, d, ls, v, gm, im, m, plats } (matchdagen/delat/md-topplista.js)
// Eleven läser EN gång när fliken Topplista öppnas – alla årskurser i samma dokument.
//
// Byggs en gång i timmen (mdTopplista, onSchedule i index.js):
//   1. topplistan + EN fråga "har någon karriär sparats sedan förra bygget?" (matchdagen där senast > byggd, limit 1).
//      Nej, och förra bygget är yngre än TVINGA_MS → klart (2 läsningar, ingen skrivning).
//   2. annars: alla classes, classProjections för klasserna med Matchdagen (namnen), och karriärerna för eleverna
//      med Matchdagen (getAll med fältmask – bara fälten listan behöver) → EN skrivning.
// deps = { db, now?() }  →  { byggd: bool, elever, uteslutna }
// ⚠️ DEPLOY: rules → functions (Cloud Scheduler-jobbet skapas av deployen, Blaze) → webben.
// ============================================================================

import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { harMatchdagen, post } from "./md-vanskap-state.js";
import { akNyckel, arskursAvKlass, byggTopplistor, sorteraNycklar } from "./matchdagen/md-topplista.js";

export const TOPPLISTA = "mdTopplista";
export const DOK = "skolan";
/** Utan sparade matcher byggs listan ändå om var 6:e timme (namn, klasser och Matchdagen på/av). */
export const TVINGA_MS = 6 * 60 * 60 * 1000;
const FALT = ["klubb", "div", "sasong", "summa", "sasonger", "dagar"];
const GET_ALL_MAX = 300;

const msAv = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0);
const kort = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Eleverna med Matchdagen: uid → { ak, klass (namnet), classId } – den lägsta årskursen (som elevArskurs). */
export function eleverMedMatchdagen(klasser) {
  const ut = new Map();
  const sorterade = [...klasser].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sv") || (a.id < b.id ? -1 : 1));
  for (const k of sorterade) {
    const ak = akNyckel(arskursAvKlass(k.name));
    for (const uid of Array.isArray(k.studentIds) ? k.studentIds : []) {
      if (typeof uid !== "string" || !uid || !harMatchdagen(k, uid)) continue;
      const fore = ut.get(uid);
      if (fore && sorteraNycklar([fore.ak, ak])[0] === fore.ak) continue;
      ut.set(uid, { ak, klass: kort(k.name, 20), classId: k.id });
    }
  }
  return ut;
}

async function getAllMask(db, refs) {
  const ut = [];
  for (let i = 0; i < refs.length; i += GET_ALL_MAX) {
    ut.push(...await db.getAll(...refs.slice(i, i + GET_ALL_MAX), { fieldMask: FALT }));
  }
  return ut;
}

export async function byggTopplista(deps, { tvinga = false } = {}) {
  const { db } = deps;
  const nu = (deps.now || Date.now)();
  const ref = db.collection(TOPPLISTA).doc(DOK);
  const fore = await ref.get();
  const byggdFore = fore.exists ? msAv(fore.data().byggd) : 0;
  if (!tvinga && byggdFore && nu - byggdFore < TVINGA_MS) {
    const andrad = await db.collection("matchdagen").where("senast", ">", new Date(byggdFore)).select().limit(1).get();
    if (andrad.empty) return { byggd: false, elever: 0, uteslutna: 0 };
  }

  const klasser = (await db.collection("classes").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const med = eleverMedMatchdagen(klasser);
  const classIds = [...new Set([...med.values()].map((e) => e.classId))];
  const [proj, karr] = await Promise.all([
    classIds.length ? db.getAll(...classIds.map((id) => db.collection("classProjections").doc(id))) : [],
    med.size ? getAllMask(db, [...med.keys()].map((uid) => db.collection("matchdagen").doc(uid))) : [],
  ]);
  const members = new Map(proj.map((s) => [s.id, s.exists ? s.data().members || {} : {}]));
  const elever = [];
  for (const s of karr) {
    if (!s.exists) continue;
    const e = med.get(s.id);
    elever.push({ uid: s.id, K: s.data(), ak: e.ak, klass: e.klass, namn: kort(post(members.get(e.classId), s.id)?.namn, 40) });
  }
  // Reserv (som namnFor): students/{uid}.namn för den som saknas i klassprojektionen.
  const utanNamn = elever.filter((e) => !e.namn);
  if (utanNamn.length) {
    const stu = await db.getAll(...utanNamn.map((e) => db.collection("students").doc(e.uid)));
    stu.forEach((s, i) => { utanNamn[i].namn = kort(s.exists ? s.data().namn : "", 40); });
  }
  const { arskurser, antal, uteslutna } = byggTopplistor(elever);
  await ref.set({ version: 1, byggd: new Date(nu), arskurser, antal });
  if (uteslutna) logger.info("mdTopplista: karriärer utanför listan (inte rimliga)", { uteslutna });
  return { byggd: true, elever: elever.length, uteslutna };
}

/** Varje hel timme (Cloud Scheduler, svensk tid). index.js re-exporterar den. */
export const mdTopplista = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Europe/Stockholm", region: "europe-west1", memory: "256MiB", maxInstances: 1, retryCount: 0 },
  async () => {
    const r = await byggTopplista({ db: getFirestore(), now: Date.now });
    if (r.byggd) logger.info("mdTopplista byggd", r);
  },
);
