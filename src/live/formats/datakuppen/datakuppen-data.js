// ============================================================================
// Datakuppen – Firestore + Cloud Functions på klienten (#652). Laddas bara
// DYNAMISKT (projektorn, elevsidan, historiken), aldrig i bootgrafen.
// Eleven skriver INGEN data och INGA koder själv: svar, filer, kodval och hack
// går via de anropbara funktionerna (functions/datakuppen-core.js), allt
// annat läses. Samma mönster som guldrush-data.js.
//
// API (elev)
//   answer({ sid, attemptId, factorA?, factorB?, answer?, choiceIndex?, q?, year? })
//                                 → { attemptId, correct, correctAnswer, nextQ }
//   openFile({ sid, attemptId, fileIndex }) → { file, kind, delta, gold,
//                                   protectedUntil (ms|null), pending? }
//   pickCode({ sid, index? })     → { code, offers, expiresAtMs, auto? } –
//                                   index null = förslagen / "välj åt mig"
//   chooseTarget({ sid, targetUid? }) → { result: "target", targetUid, targetName,
//                                   options[3], expiresAtMs } | { result: "fallback", … }
//   guessCode({ sid, index?, targetUid? }) → { result: "hacked"|"wrong"|"timeout"|
//                                   "changed"|"protected", amount?, code? }
//     → alla kastar DatakuppError { code, message } (svenskt meddelande)
//   watchMe(sid, uid, cb, onErr)  → unsub; cb(dkPlayers-dokumentet | null)
//   watchMySelf(sid, uid, cb, onErr) → unsub; cb(dkSelf – min kod, förslag, hackkoder | null)
//   getQuestions(sid) · getMyAnswer(sid, attemptId)
// API (alla deltagare)
//   watchDkPlayers(sid, cb, onErr) · watchEvents(sid, cb, onErr, n=30) · getDkPlayers(sid)
// API (lärare)
//   getAnswers(sid)
// ============================================================================

import { app, db } from "../../../firebase-config.js";
import {
  doc, getDoc, getDocs, collection, query, orderBy, limit, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { DK_PUBLIC_DOC } from "./datakuppen-core.js";

const REGION = "europe-west1";

export class DatakuppError extends Error {
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
    throw new DatakuppError(code, own && code !== "internal" ? msg : "Kunde inte nå Datakuppen just nu – försök igen.");
  }
}

export const answer = (data) => call("datakuppAnswer", data);
export const openFile = (data) => call("datakuppOpenFile", data);
export const pickCode = (data) => call("datakuppPickCode", { sid: data.sid, index: data.index ?? null });
export const chooseTarget = (data) => call("datakuppChooseTarget", { sid: data.sid, targetUid: data.targetUid ?? null });
export const guessCode = (data) => call("datakuppGuessCode", { sid: data.sid, index: data.index ?? null, targetUid: data.targetUid ?? null });

const dkCol = (sid) => collection(db, "liveSessions", sid, "dkPlayers");
const withUid = (d) => ({ uid: d.id, ...d.data() });

export function watchDkPlayers(sid, cb, onErr) {
  return onSnapshot(dkCol(sid), (snap) => cb(snap.docs.map(withUid), { fromCache: snap.metadata.fromCache }), onErr);
}

export async function getDkPlayers(sid) {
  return (await getDocs(dkCol(sid))).docs.map(withUid);
}

export async function getAnswers(sid) {
  return (await getDocs(collection(db, "liveSessions", sid, "answers"))).docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchMe(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "dkPlayers", uid), (snap) => cb(snap.exists() ? withUid(snap) : null), onErr);
}

/** Mitt privata dokument (min kod, kodförslag, pågående hackkoder) – bara jag kan läsa det. */
export function watchMySelf(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "dkSelf", uid), (snap) => cb(snap.exists() ? snap.data() : null), onErr);
}

export function watchEvents(sid, cb, onErr, n = 30) {
  const q = query(collection(db, "liveSessions", sid, "dkEvents"), orderBy("at", "desc"), limit(n));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })), { fromCache: snap.metadata.fromCache }), onErr);
}

export async function getQuestions(sid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, ...DK_PUBLIC_DOC));
  return snap.exists() ? snap.data().questions || [] : [];
}

export async function getMyAnswer(sid, attemptId) {
  try {
    const snap = await getDoc(doc(db, "liveSessions", sid, "answers", attemptId));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
