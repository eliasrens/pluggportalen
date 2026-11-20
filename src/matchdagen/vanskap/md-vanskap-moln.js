// ============================================================================
// Matchdagen (#874, Etapp 4): vänskapsmatchernas tunna lager mot molnet (spec §11).
// Laddas BARA med import() (bootgrafen, #271), som src/schack/schack-moln.js. Klienten
// skriver ALDRIG i duellsamlingarna – allt går genom callables (functions/md-vanskap-anrop.js).
//
//   utmana(classId, till) → { utmaningId }         svara(utmaningId, ja, classId) → { matchId|null }
//   fraga(matchId, val) → { fas, roll, val, fraga, svar, deadline }
//   svar(matchId, svar) → { giltig, ratt, facit, tidenUte? }   svar = null: "tiden är ute" (fel)
//   tick(matchId, redo?) → { status, fas }          geUpp(matchId) → { status }
//   lyssnaLobby(classId, cb, onError)  → avregistrering   EN onSnapshot på mdLobby/{classId}
//   lyssnaMatch(matchId, cb, onError)  → avregistrering   EN onSnapshot på mdVanskap/{id}
//   lasPrivat(matchId, uid)            EN läsning (bara när eleven kommer tillbaka till en match)
//   lasElev(uid)                       EN läsning: mdVanskapElev/{uid} (dagens matcher)
//   MdMolnFel(code, message)           felet från servern
// Tiderna från servern är epoch-ms – jämför mot serverNow() (data-class-lock.js).
// ============================================================================

import { app, db } from "../../firebase-config.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { serverNow, syncServerClock } from "../../data-class-lock.js";

export { serverNow };

const REGION = "europe-west1";
const TIMEOUT_MS = 20_000;

export class MdMolnFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MdMolnFel";
    this.code = code;
  }
}

const calls = new Map();
async function call(name, data) {
  if (!calls.has(name)) calls.set(name, httpsCallable(getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION), name, { timeout: TIMEOUT_MS }));
  try {
    return (await calls.get(name)(data)).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "") || "unknown";
    const msg = String(err?.message || "");
    throw new MdMolnFel(code, msg && msg.toLowerCase() !== code ? msg : "Det gick inte just nu – försök igen.");
  }
}

export const utmana = (classId, till) => call("mdUtmana", { classId, till });
export const svara = (utmaningId, ja, classId) => call("mdSvara", { utmaningId, ja: ja === true, classId });
export const fraga = (matchId, val) => call("mdFraga", { matchId, val });
export const svar = (matchId, s) => call("mdSvar", { matchId, svar: s });
export const tick = (matchId, redo = false) => call("mdTick", { matchId, ...(redo ? { redo: true } : {}) });
export const geUpp = (matchId) => call("mdGeUpp", { matchId });

export function lyssnaLobby(classId, cb, onError = () => {}) {
  syncServerClock();
  return onSnapshot(doc(db, "mdLobby", classId), (s) => cb(s.exists() ? s.data() : {}), onError);
}

export function lyssnaMatch(matchId, cb, onError = () => {}) {
  syncServerClock();
  return onSnapshot(doc(db, "mdVanskap", matchId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

export async function lasPrivat(matchId, uid) {
  const s = await getDoc(doc(db, "mdVanskap", matchId, "privat", uid));
  return s.exists() ? s.data() : null;
}

export async function lasElev(uid) {
  const s = await getDoc(doc(db, "mdVanskapElev", uid));
  return s.exists() ? s.data() : {};
}
