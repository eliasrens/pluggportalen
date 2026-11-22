// ============================================================================
// Matchdagen (#874, Etapp 4): vänskapsmatchernas tunna lager mot molnet (spec §11).
// Laddas BARA med import() (bootgrafen, #271), som src/schack/schack-moln.js. Klienten
// skriver ALDRIG i duellsamlingarna – allt går genom EN callable, mdVanskap { op } (#895,
// functions/md-vanskap-anrop.js): en tjänst = en kallstart, och den hålls varm av hela matchen.
//
//   varm()                                          väcker tjänsten (lobbyn, när fliken öppnas)
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

let anrop = null;
async function call(op, data = {}) {
  anrop ||= httpsCallable(getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION), "mdVanskap", { timeout: TIMEOUT_MS });
  try {
    return (await anrop({ op, ...data })).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "") || "unknown";
    const msg = String(err?.message || "");
    throw new MdMolnFel(code, msg && msg.toLowerCase() !== code ? msg : "Det gick inte just nu – försök igen.");
  }
}

export const varm = () => call("varm").catch(() => null);
export const utmana = (classId, till) => call("utmana", { classId, till });
export const svara = (utmaningId, ja, classId) => call("svara", { utmaningId, ja: ja === true, classId });
export const fraga = (matchId, val) => call("fraga", { matchId, val });
export const svar = (matchId, s) => call("svar", { matchId, svar: s });
export const tick = (matchId, redo = false) => call("tick", { matchId, ...(redo ? { redo: true } : {}) });
export const geUpp = (matchId) => call("geUpp", { matchId });

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
