// ============================================================================
// Guldrushen – Firestore + Cloud Functions på klienten (#563). Laddas bara
// DYNAMISKT (projektorn, elevsidan, historiken), aldrig i bootgrafen.
// Sessionen skapas/raderas/avslutas av kärnan (live-data.js). Eleven skriver
// INGET guld själv: svar, kistor och stöld/byte går via de anropbara
// funktionerna (functions/guldrush-core.js), allt annat läses.
//
// API (elev)
//   answer({ sid, attemptId, factorA?, factorB?, answer?, choiceIndex?, q? })
//                                 → { attemptId, correct, correctAnswer, nextQ }
//   openChest({ sid, attemptId, chestIndex }) → { chest, kind, delta, gold,
//                                   shield, pending? }
//   chooseVictim({ sid, victimUid? })  → { result, chest, victimUid?, amount, gold }
//     victimUid null/saknas = "slumpa åt mig" (nedräkningen tog slut)
//     → alla kastar GuldrushError { code, message } (svenskt meddelande)
//   watchMyGold(sid, uid, cb, onErr)   → unsub; cb(grPlayers-dokumentet | null)
//   getQuestions(sid)                  → quizets elevsynliga frågor (utan facit)
//   getMyAnswer(sid, attemptId)        → mitt svarsdokument | null (#564: en
//                                       oöppnad kista efter omladdning)
// API (alla deltagare)
//   watchGrPlayers(sid, cb, onErr)     → unsub; cb(grPlayers[], { fromCache })
//   watchEvents(sid, cb, onErr, n=30)  → unsub; cb(senaste n händelser, nyast
//                                       först, med id, { fromCache }) –
//                                       createEventCursor(); fromCache: true =
//                                       ögonblicksbild ur cachen, inte servern
//                                       (projektorns baslinje väntar in servern)
//   getGrPlayers(sid)                  → grPlayers[] (resultat/historik)
// ============================================================================

import { app, db } from "../../../firebase-config.js";
import {
  doc, getDoc, getDocs, collection, query, orderBy, limit, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { GR_PUBLIC_DOC } from "./guldrush-core.js";

const REGION = "europe-west1";

export class GuldrushError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const calls = new Map();
function callable(name) {
  if (!calls.has(name)) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    calls.set(name, httpsCallable(fns, name, { timeout: 15_000 }));
  }
  return calls.get(name);
}

async function call(name, data) {
  try {
    return (await callable(name)(data)).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "");
    const msg = String(err?.message || "");
    const own = msg && msg.toLowerCase().replace(/[\s_]/g, "-") !== code;
    throw new GuldrushError(code, own && code !== "internal" ? msg : "Kunde inte nå Guldrushen just nu – försök igen.");
  }
}

export const answer = (data) => call("guldrushAnswer", data);
export const openChest = (data) => call("guldrushOpenChest", data);
export const chooseVictim = (data) => call("guldrushChooseVictim", { sid: data.sid, victimUid: data.victimUid ?? null });

const grCol = (sid) => collection(db, "liveSessions", sid, "grPlayers");
const withUid = (d) => ({ uid: d.id, ...d.data() });

export function watchGrPlayers(sid, cb, onErr) {
  return onSnapshot(grCol(sid), (snap) => cb(snap.docs.map(withUid), { fromCache: snap.metadata.fromCache }), onErr);
}

export async function getGrPlayers(sid) {
  return (await getDocs(grCol(sid))).docs.map(withUid);
}

export function watchMyGold(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "grPlayers", uid), (snap) => cb(snap.exists() ? withUid(snap) : null), onErr);
}

export function watchEvents(sid, cb, onErr, n = 30) {
  const q = query(collection(db, "liveSessions", sid, "grEvents"), orderBy("at", "desc"), limit(n));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })), { fromCache: snap.metadata.fromCache }), onErr);
}

export async function getQuestions(sid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, ...GR_PUBLIC_DOC));
  return snap.exists() ? snap.data().questions || [] : [];
}

export async function getMyAnswer(sid, attemptId) {
  try {
    const snap = await getDoc(doc(db, "liveSessions", sid, "answers", attemptId));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null; // finns inte (reglerna kan inte läsa ett saknat dokuments uid) eller nätfel
  }
}
