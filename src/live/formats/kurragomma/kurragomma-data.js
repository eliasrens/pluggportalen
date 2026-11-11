// ============================================================================
// Kurragömma – Firestore, Cloud Functions och rörelsekanalen på KLIENTEN (#839).
// Laddas bara DYNAMISKT (projektorn, elevsidan, historiken), aldrig i bootgrafen.
// Klienten skriver INGENTING i kg-samlingarna: allt går via callables
// (functions/kurragomma-core.js); i Realtime Database bara sökarens egen pos
// (kg-kanal.js). Kontraktet: docs/KURRAGOMMA.md §10.
//
// API (elev)
//   anslut(sid) · las(sid, { x, z }) · svara(sid, payload) · leta(sid, { x, z })
//   getQuestions(sid)              → quizets elevsynliga frågor (kgPublic/questions)
//   watchMe(sid, uid, cb, onErr)   → unsub; cb(kgPlayers/{uid} | null) – roll, poäng, laddningar, hittadAvNamn
// API (lärare/projektor)
//   starta(sid) · tick(sid) · avsluta(sid) → { result, redan }
//   getKgPlayers(sid) · getEvents(sid)   (historiken, E)
// API (båda)
//   kanal({ sid, uid })            → kg-kanal.js skapaRorelsekanal i rtdb-läge mot prod-
//                                  instansen (KG_DATABASE_URL) – eller emulatorn när
//                                  globalThis.__PP_RTDB_URL / __PP_RTDB_EMULATOR är satt (QA)
//   KgError { code, message, details? }
// ============================================================================

import { app, db } from "../../../firebase-config.js";
import { doc, getDoc, getDocs, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { skapaRorelsekanal, KG_DATABASE_URL } from "./kg-kanal.js";

const REGION = "europe-west1";

export class KgError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    if (details) this.details = details;
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

export async function call(name, data) {
  try {
    return (await callable(name)(data)).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "");
    const msg = String(err?.message || "");
    const own = msg && msg.toLowerCase().replace(/[\s_]/g, "-") !== code;
    throw new KgError(code, own && code !== "internal" ? msg : "Kunde inte nå ön just nu – försök igen.", err?.details);
  }
}

export const starta = (sid) => call("kgStarta", { sid });
export const anslut = (sid) => call("kgAnslut", { sid });
export const las = (sid, p) => call("kgLas", { sid, x: p.x, z: p.z });
export const svara = (sid, payload) => call("kgSvara", { sid, ...payload });
export const leta = (sid, p) => call("kgLeta", { sid, x: p.x, z: p.z });
export const tick = (sid) => call("kgTick", { sid });
export const avsluta = (sid) => call("kgAvsluta", { sid });

/** Rörelsekanalen (RTDB). QA mot emulatorn: __PP_RTDB_URL (hela adressen med ?ns=) eller __PP_RTDB_EMULATOR { host, port }. */
export function kanal({ sid, uid }) {
  const g = globalThis;
  return skapaRorelsekanal({ sid, uid, lage: "rtdb", app, url: g.__PP_RTDB_URL || KG_DATABASE_URL, emulator: g.__PP_RTDB_EMULATOR || null });
}

const sub = (sid, col) => collection(db, "liveSessions", sid, col);
const withId = (d) => ({ id: d.id, ...d.data() });

export async function getQuestions(sid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, "kgPublic", "questions"));
  return snap.exists() ? snap.data().questions || [] : [];
}

export function watchMe(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "kgPlayers", uid), (s) => cb(s.exists() ? { uid, ...s.data() } : null), onErr);
}

export async function getKgPlayers(sid) {
  return (await getDocs(sub(sid, "kgPlayers"))).docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getEvents(sid) {
  return (await getDocs(query(sub(sid, "kgEvents"), orderBy("t")))).docs.map(withId);
}
