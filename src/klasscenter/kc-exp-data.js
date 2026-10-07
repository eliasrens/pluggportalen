// ============================================================================
// Klasscentret – Klass-EXP mot Firestore (#477, epic #476).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT (import("./klasscenter/kc-exp-data.js")) – aldrig
// från den statiska bootgrafen (#271: Pages-deployen är inte atomär).
//
// Skrivning: EN transaktion per klass och utdelning – läser elevens
// expMembers-post (regelräknarna), räknar fram EXP ur regelregistret
// (kc-exp-regler.js) och skriver shard + elevpost enligt kc-exp-skriv.js.
// Reglerna (firestore.rules "KLASSCENTRET") kräver 1..3 per skrivning och
// minst EXP_SPARR_S s mellan en elevs utdelningar → utdelningar per klass
// köas i följd, väntar ut spärren och delar upp större belopp. ALDRIG
// kastande: ett EXP-fel får inte störa elevens egen belöning (samma kontrakt
// som projektions-speglingen i game-shared.js awardExercise).
//
// En elev kan gå i flera klasser (classes/{id}.studentIds) – varje klass hon/
// han är med i får EXP:n, eftersom eleven också räknas i varje klass elevantal
// (normaliseringen i kc-niva.js).
//
// API
//   awardClassExp({ modul, resultat, area?, uid?, classIds? })
//       → Promise<Record<classId, antal>>   (elevens spel; modul = spelläges-id)
//   awardClassBonus(classId, kalla, mangd?) → Promise<number>  (lärare; mangd
//       saknas → klassBonusFor(kalla, elevantal))
//   getClassExp(classId)                    → Promise<KlassExp>
//   subscribeClassExp(classId, cb, onErr?)  → unsubscribe; cb(KlassExp) i realtid
//   KlassExp = { classId, exp, antalElever, progress, text }
//     progress = progressTillNasta(exp, antalElever), text = matarText(progress)
// ============================================================================

import { db, auth } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, onSnapshot, runTransaction, setDoc,
  increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "../auth.js";
import { getClasses } from "../data-classes.js";
import { planKlassExp, klassBonusFor } from "./kc-exp-regler.js";
import {
  planKlassExpWrites, planRaknareWrite, planKlassBonusWrite, pickExpShard, sumKlassExp,
  MAX_EXP_PER_SKRIVNING, MAX_BONUS_PER_SKRIVNING, EXP_SPARR_S,
} from "./kc-exp-skriv.js";
import { progressTillNasta, matarText } from "./kc-niva.js";

const fv = { increment, serverTimestamp };
const SPARR_MS = EXP_SPARR_S * 1000;
const MARGINAL_MS = 1500;
const ko = new Map(); // classId → löfteskedja (utdelningar i följd per klass)

const sov = (ms) => new Promise((r) => setTimeout(r, ms));

function toMs(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return Number(t) || 0;
}

function memberRef(classId, uid) {
  return doc(db, "classCenters", classId, "expMembers", uid);
}

function applicera(tx, w) {
  tx.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
}

async function elevensKlasser(uid) {
  const klasser = await getClasses();
  return klasser
    .filter((k) => Array.isArray(k.studentIds) && k.studentIds.includes(uid))
    .map((k) => k.id);
}

async function antalEleverI(classId) {
  const k = (await getClasses()).find((c) => c.id === classId);
  return Math.max(1, Array.isArray(k?.studentIds) ? k.studentIds.length : 0);
}

/**
 * Vänta tills elevens takt-spärr (lastAt + EXP_SPARR_S) har gått ut – men bara
 * om omgången faktiskt ger EXP (en ren räknar-skrivning har ingen spärr).
 */
async function vantaSparr(classId, uid, berakna) {
  const snap = await getDoc(memberRef(classId, uid)).catch(() => null);
  const d = snap?.exists() ? snap.data() : {};
  if (berakna(d.counts || {}).antal < 1) return;
  const last = toMs(d.lastAt);
  const vanta = last + SPARR_MS + MARGINAL_MS - Date.now();
  if (last && vanta > 0) await sov(Math.min(vanta, SPARR_MS + MARGINAL_MS));
}

/**
 * EN utdelning i en transaktion. berakna(counts) → { antal, raknare } räknas
 * om vid varje transaktionsförsök (färska räknare). Returnerar utdelat antal.
 */
async function transaktion(classId, uid, kalla, berakna) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(memberRef(classId, uid));
    const counts = (snap.exists() && snap.data().counts) || {};
    const { antal, raknare } = berakna(counts);
    const n = Math.min(MAX_EXP_PER_SKRIVNING, antal);
    if (n < 1) {
      const w = planRaknareWrite({ classId, uid, raknare });
      if (w) applicera(tx, w);
      return { delat: 0, kvar: 0 };
    }
    for (const w of planKlassExpWrites({ classId, uid, antal: n, kalla, raknare, shard: pickExpShard(), fv })) {
      applicera(tx, w);
    }
    return { delat: n, kvar: antal - n };
  });
}

async function delaUt(classId, uid, modul, resultat, area) {
  let berakna = (counts) => planKlassExp(modul, resultat, { area, raknare: counts });
  let totalt = 0;
  for (let varv = 0; varv < 20; varv++) {
    await vantaSparr(classId, uid, berakna);
    let res;
    try {
      res = await transaktion(classId, uid, modul, berakna);
    } catch (err) {
      // permission-denied = troligen spärren (annan flik, klockavvikelse):
      // ett nytt försök efter en hel spärrtid. Annat fel → ge upp tyst.
      if (err?.code !== "permission-denied" || varv > 0) throw err;
      await sov(SPARR_MS + MARGINAL_MS);
      continue;
    }
    totalt += res.delat;
    if (res.kvar < 1) break;
    // Resten (> 3 på en gång, ovanligt) delas ut i nästa varv – räknarna är
    // redan sparade, så bara beloppet följer med.
    const kvar = res.kvar;
    berakna = () => ({ antal: kvar, raknare: null });
  }
  return totalt;
}

/**
 * Elevens klass-EXP för en avklarad omgång. Anropa EFTER att elevens egna
 * framsteg sparats (de påverkas inte). Väntar inte spelet på svaret behövs
 * ingen await. Aldrig kastande.
 * @param {{ modul:string, resultat:object, area?:string, uid?:string, classIds?:string[] }} a
 *   modul = spelläges-id ("quiz", "memory", "aventyr:gruvan", "lasresan",
 *   "mattematchen", "rakna" …), resultat = regelns form (kc-exp-regler.js).
 * @returns {Promise<Record<string, number>>} utdelat antal per klass-id
 */
export async function awardClassExp({ modul, resultat, area, uid = currentStudentId(), classIds } = {}) {
  const ut = {};
  try {
    if (!uid || !modul) return ut;
    const ids = Array.isArray(classIds) ? classIds : await elevensKlasser(uid);
    await Promise.all(ids.map((classId) => {
      const steg = (ko.get(classId) || Promise.resolve())
        .then(() => delaUt(classId, uid, modul, resultat, area))
        .then((n) => { ut[classId] = n; }, (err) => {
          ut[classId] = 0;
          console.warn("[klasscenter] klass-EXP kunde inte delas ut", classId, err?.code || err);
        });
      ko.set(classId, steg);
      return steg;
    }));
  } catch (err) {
    console.warn("[klasscenter] klass-EXP hoppades över", err?.code || err);
  }
  return ut;
}

/**
 * Klassbonus från läraren/lärarflödet (Live-match klar, klassutmaning …).
 * Kräver teacher-claim (firestore.rules). mangd saknas → klassBonusFor(kalla,
 * elevantal). Belopp > 1000 delas upp på flera skrivningar.
 * @returns {Promise<number>} utdelad bonus
 */
export async function awardClassBonus(classId, kalla, mangd) {
  const uid = auth.currentUser?.uid; // lärarens Auth-uid (ingen elevsession)
  if (!classId || !uid) return 0;
  let kvar = Math.floor(Number(mangd ?? klassBonusFor(kalla, await antalEleverI(classId))) || 0);
  let delat = 0;
  while (kvar > 0) {
    const n = Math.min(MAX_BONUS_PER_SKRIVNING, kvar);
    const w = planKlassBonusWrite({ classId, uid, mangd: n, kalla, shard: pickExpShard(), fv });
    await setDoc(doc(db, ...w.path), w.data, { merge: true });
    delat += n;
    kvar -= n;
  }
  return delat;
}

function klassExp(classId, exp, antalElever) {
  const progress = progressTillNasta(exp, antalElever);
  return { classId, exp, antalElever, progress, text: matarText(progress) };
}

/** Klassens EXP + nivå + mätartext (en läsning av ≤ 5 shard-dokument). */
export async function getClassExp(classId) {
  const [snap, antal] = await Promise.all([
    getDocs(collection(db, "classCenters", classId, "expShards")),
    antalEleverI(classId),
  ]);
  return klassExp(classId, sumKlassExp(snap.docs.map((d) => d.data())), antal);
}

/** Realtid för mätaren: cb(KlassExp) vid varje shard-ändring. */
export function subscribeClassExp(classId, cb, onErr) {
  // Mätaren ritas först när BÅDE elevantal och shards finns (annars skulle
  // första bilden normaliseras mot fel antal elever).
  let antal = null;
  let senaste = null;
  let aktiv = true;
  const visa = () => {
    if (aktiv && antal != null && senaste != null) cb(klassExp(classId, senaste, antal));
  };
  antalEleverI(classId).then((n) => { antal = n; visa(); }, () => { antal = 1; visa(); });
  const unsub = onSnapshot(
    collection(db, "classCenters", classId, "expShards"),
    (snap) => {
      senaste = sumKlassExp(snap.docs.map((d) => d.data()));
      visa();
    },
    onErr
  );
  return () => { aktiv = false; unsub(); };
}
