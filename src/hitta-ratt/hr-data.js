// ============================================================================
// Hitta rätt! – försök, resultat och topplistor på klienten (src/hitta-ratt/hr-data.js) · #609
// ----------------------------------------------------------------------------
// Laddas bara DYNAMISKT (Hitta rätt!-routen), aldrig i bootgrafen.
// Eleven skriver INGA poäng: klienten skapar bara starten av ett försök och
// skickar svaren till Cloud Functionen hittaRattSubmit, som räknar om allt
// (functions/hitta-ratt-core.js, arkitektur §4.1).
//
// API
//   startaForsok(packId)        → attemptId  (hittaRattAttempts/{id}, startedAt = serverns tid)
//   skickaOmgang(attemptId, svar) → { result, pb, nyttRekord, coins, top, egen,
//                                    plats, antal, leaderboard }
//     svar: punkt [{ itemId, lon, lat }] · område [{ itemId, omrade, ms }]
//     Kastar HittaRattFel { code, message }. Nätfel → anropa igen med SAMMA
//     attemptId (idempotent: samma svar, inga dubbla coins).
//   hamtaTopplista(packId, uid?) → { typ, titel, max, top, egen, plats, antal }
//     EN läsning (hittaRattBoards/{packId}) – inga läsningar per elev (#231).
// ============================================================================

import { app, db } from "../firebase-config.js";
import {
  collection, doc, getDoc, serverTimestamp, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { currentStudentId, invalidateStudentData } from "../data.js";
import { topplista } from "./delat/rank.js";
import { invalideraLedare } from "./hr-pokal-rum.js";
import { invalideraKatalog } from "./hr-egna-data.js";

const REGION = "europe-west1";

export class HittaRattFel extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

let submitCall = null;
function submitFn() {
  if (!submitCall) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    submitCall = httpsCallable(fns, "hittaRattSubmit", { timeout: 20_000 });
  }
  return submitCall;
}

export async function startaForsok(packId, uid = currentStudentId()) {
  if (!uid) throw new HittaRattFel("unauthenticated", "Logga in först.");
  const ref = doc(collection(db, "hittaRattAttempts"));
  await setDoc(ref, { uid, packId, startedAt: serverTimestamp(), status: "open" });
  return ref.id;
}

export async function skickaOmgang(attemptId, svar) {
  try {
    const res = (await submitFn()({ attemptId, svar })).data;
    // Saldot ändrat på servern. godkanda (inte coins): ett omförsök efter ett
    // tappat svar ger coins 0 men krediteringen har ändå skett (#608).
    if (res?.coins > 0 || res?.result?.godkanda > 0) invalidateStudentData(currentStudentId());
    // Ledarna kan ha bytts (#610) – huset läser om pokalerna vid nästa besök.
    invalideraLedare();
    invalideraKatalog(); // egna pack: ny version/topplista syns direkt (#633)
    return res;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "");
    const msg = String(err?.message || "");
    const egen = msg && msg.toLowerCase().replace(/[\s_]/g, "-") !== code;
    throw new HittaRattFel(code, egen && code !== "internal" ? msg : "Resultatet kunde inte sparas just nu – försök igen.");
  }
}

/** Skolans topplista för ett pack. Saknat dokument = tom lista. */
export async function hamtaTopplista(packId, uid = currentStudentId()) {
  const snap = await getDoc(doc(db, "hittaRattBoards", packId));
  const d = snap.exists() ? snap.data() : {};
  const typ = d.typ === "area" ? "area" : "point";
  const t = topplista(d.entries || {}, typ, uid);
  const jag = (r) => (r.uid === uid ? { ...r, jag: true } : r);
  return { typ, titel: d.titel || "", max: d.max ?? null, ...t, top: t.top.map(jag), egen: t.egen ? jag(t.egen) : null };
}
