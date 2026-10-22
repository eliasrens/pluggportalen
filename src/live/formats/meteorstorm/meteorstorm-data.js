// ============================================================================
// Meteorstormen – Firestore + Cloud Functions på klienten (#821). Laddas bara
// DYNAMISKT (projektorn, elevsidan, historiken), aldrig i bootgrafen.
// Klienten skriver INGENTING i formatets samlingar: svar + handling går via
// msAgera (functions/meteorstorm-core.js), allt annat läses.
// Kontraktet: docs/METEORSTORMEN.md §7–§9.
//
// API (elev)
//   skapaKlient({ sid, uid, seed, gameMode, antalFragor }) → ms-klient.js
//                                  (svar + handling, felbufferten, nr/energi/k,
//                                  kalla() = multiplikationens frågekälla)
//   getQuestions(sid)              → quizets elevsynliga frågor
//   hamtaStatus(sid)               → msPublic/status | null (en läsning)
//   skapaStatusvakt(sid, cb, { intervallMs? }) → { fran(status), stop() }
//                                  cb(status) – status ur msAgera-svaren
//                                  (fran) och, bara när inget kommit på
//                                  intervallMs (20 s), en läsning av
//                                  msPublic/status. En elev som svarar läser
//                                  alltså aldrig statusdokumentet (kvoten).
//   watchMe(sid, uid, cb, onErr)   → unsub; cb(msPlayers/{uid} | null) – totalerna efter matchen
// API (lärare/projektor)
//   watchEvents(sid, cb, onErr)    → unsub; cb(händelser, äldst först) – loggen till motorn
//   getEvents(sid) · getMsPlayers(sid)
//   avsluta(sid)                   → msAvsluta → { result, redan }
//   MsError { code, message, details? }
// ============================================================================

import { app, db } from "../../../firebase-config.js";
import {
  doc, getDoc, getDocs, collection, query, orderBy, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { createMsKlient } from "./ms-klient.js";

const REGION = "europe-west1";
// Bara elever som inte svarat rätt på en stund läser statusdokumentet (svaren
// bär status). 20 s ger klienterna marginal under 6 000 läsningar (#821 F6).
const STATUS_INTERVALL_MS = 20_000;

export class MsError extends Error {
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
    throw new MsError(code, own && code !== "internal" ? msg : "Kunde inte nå rymdstationen just nu – försök igen.", err?.details);
  }
}

function sessionLagring() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

export function skapaKlient(opts) {
  return createMsKlient({ ...opts, call, lagring: sessionLagring() });
}

export const avsluta = (sid) => call("msAvsluta", { sid });

const sub = (sid, col) => collection(db, "liveSessions", sid, col);

export async function getQuestions(sid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, "msPublic", "questions"));
  return snap.exists() ? snap.data().questions || [] : [];
}

export async function hamtaStatus(sid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, "msPublic", "status"));
  return snap.exists() ? snap.data() : null;
}

export function skapaStatusvakt(sid, cb, { intervallMs = STATUS_INTERVALL_MS } = {}) {
  let senast = 0;
  let stoppad = false;
  const fran = (status) => {
    if (!status || stoppad) return;
    senast = Date.now();
    cb(status);
  };
  const tick = async () => {
    if (stoppad || Date.now() - senast < intervallMs) return;
    senast = Date.now();
    try {
      fran(await hamtaStatus(sid));
    } catch { /* nästa varv */ }
  };
  const timer = setInterval(tick, 1000);
  tick();
  return { fran, stop() { stoppad = true; clearInterval(timer); } };
}

export function watchMe(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "msPlayers", uid), (s) => cb(s.exists() ? s.data() : null), onErr);
}

const withId = (d) => ({ id: d.id, ...d.data() });

export function watchEvents(sid, cb, onErr) {
  return onSnapshot(query(sub(sid, "msEvents"), orderBy("t")), (snap) => cb(snap.docs.map(withId)), onErr);
}

export async function getEvents(sid) {
  return (await getDocs(query(sub(sid, "msEvents"), orderBy("t")))).docs.map(withId);
}

export async function getMsPlayers(sid) {
  return (await getDocs(sub(sid, "msPlayers"))).docs.map((d) => ({ uid: d.id, ...d.data() }));
}
