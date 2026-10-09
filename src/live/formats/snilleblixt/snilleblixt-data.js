// ============================================================================
// Snilleblixten – Firestore-lagret (#556). Laddas bara DYNAMISKT (projektorn,
// elevsidan, historiken), aldrig i bootgrafen. Sessionen skapas/raderas/
// avslutas av kärnan (live-data.js: createLiveSession kör formatets
// prepareCreate, deleteLiveSession raderar privateDocs, finishLiveSession).
// Planerna (vad som skrivs) kommer ur snilleblixt-flode.js – samma planer som
// regeltesterna kör.
//
// API (lärare)
//   openQuestion(sid, fromIndex)    → NÄSTA FRÅGA (fromIndex −1 = första)
//   closeQuestion(sid, fromIndex)   → "Avsluta frågan nu" / auto-stäng
//   revealQuestion(sid, fromIndex)  → avslöja: q.facit + sbScores/{i} (poäng)
//   skipQuestion(sid, fromIndex)    → hoppa över (inga poäng)
//     → alla: Promise<{ done: bool, reason? }> – transaktion ur AKTUELLT läge;
//       done:false = en annan lärare hann före (eller fel läge, eller
//       reglerna nekade den förlorande transaktionen) – ofarligt
//   getSnapshot(sid)                → { questions, facit } (lärarskyddat)
//   watchQuestionAnswers(sid, i, cb, onErr) → unsub; cb(svarsdokument[])
//   getQuestionAnswers(sid, i)      → svarsdokument[]
// API (alla deltagare)
//   watchScores(sid, cb, onErr)     → unsub; cb(sbScores[]) i frågeordning
//   getScores(sid)                  → sbScores[]
// API (elev)
//   submitAnswer({ sid, s, uid, classId, choiceIndex?, answer? })
//                                   → Promise<"ok" | "redan-svarat">
//   getMyAnswer(sid, index, uid)    → svarsdokumentet | null (omladdning)
// ============================================================================

import { db } from "../../../firebase-config.js";
import {
  doc, getDoc, getDocs, setDoc, collection, query, where, onSnapshot, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SB_PRIVATE_DOC, answerDocId } from "./snilleblixt-core.js";
import { planStep, planAnswer } from "./snilleblixt-flode.js";

const fv = { serverTimestamp };
const sessRef = (sid) => doc(db, "liveSessions", sid);
const privRef = (sid) => doc(db, "liveSessions", sid, ...SB_PRIVATE_DOC);
const byIndex = (a, b) => a.index - b.index;

async function step(sid, action, fromIndex) {
  try {
    return await stepTx(sid, action, fromIndex);
  } catch (err) {
    // Två lärare samtidigt: den förlorande transaktionen kan nekas av reglerna
    // (läget har redan gått ett steg) i stället för att köras om – samma utfall.
    if (err?.code === "permission-denied") return { done: false, reason: "nekad" };
    throw err;
  }
}

async function stepTx(sid, action, fromIndex) {
  // Svaren läses FÖRE transaktionen (frågan är redan stängd vid reveal, så
  // inga nya kan tillkomma; poängen räknas ändå bara inom svarsfönstret).
  const answers = action === "reveal" || action === "skip" ? await getQuestionAnswers(sid, fromIndex) : [];
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(sessRef(sid));
    if (!snap.exists()) return { done: false, reason: "saknas" };
    const s = snap.data();
    const snapshot = action === "open" || action === "reveal" ? (await tx.get(privRef(sid))).data() : null;
    const plan = planStep(s, action, { fromIndex, snapshot, answers, fv });
    if (plan.noop) return { done: false, reason: plan.noop };
    tx.update(sessRef(sid), plan.patch);
    if (plan.scores) tx.set(doc(db, "liveSessions", sid, "sbScores", String(plan.scores.index)), plan.scores);
    return { done: true };
  });
}

export const openQuestion = (sid, fromIndex) => step(sid, "open", fromIndex);
export const closeQuestion = (sid, fromIndex) => step(sid, "close", fromIndex);
export const revealQuestion = (sid, fromIndex) => step(sid, "reveal", fromIndex);
export const skipQuestion = (sid, fromIndex) => step(sid, "skip", fromIndex);

export async function getSnapshot(sid) {
  const snap = await getDoc(privRef(sid));
  return snap.exists() ? snap.data() : null;
}

const answersQuery = (sid, index) => query(collection(db, "liveSessions", sid, "sbAnswers"), where("q", "==", index));

export async function getQuestionAnswers(sid, index) {
  if (!Number.isInteger(index) || index < 0) return [];
  return (await getDocs(answersQuery(sid, index))).docs.map((d) => d.data());
}

export function watchQuestionAnswers(sid, index, cb, onErr) {
  return onSnapshot(answersQuery(sid, index), (snap) => cb(snap.docs.map((d) => d.data())), onErr);
}

export async function getScores(sid) {
  return (await getDocs(collection(db, "liveSessions", sid, "sbScores"))).docs.map((d) => d.data()).sort(byIndex);
}

export function watchScores(sid, cb, onErr) {
  return onSnapshot(collection(db, "liveSessions", sid, "sbScores"), (snap) => cb(snap.docs.map((d) => d.data()).sort(byIndex)), onErr);
}

/** Elevens enda svar. Fanns det redan (dubbelklick, två flikar) nekar reglerna → "redan-svarat". */
export async function submitAnswer({ sid, s, uid, classId, choiceIndex, answer }) {
  const w = planAnswer({ sid, s, uid, classId, choiceIndex, answer, fv });
  try {
    await setDoc(doc(db, ...w.path), w.data);
    return "ok";
  } catch (err) {
    if (err?.code === "permission-denied" && (await getMyAnswer(sid, w.data.q, uid))) return "redan-svarat";
    throw err;
  }
}

export async function getMyAnswer(sid, index, uid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, "sbAnswers", answerDocId(index, uid)));
  return snap.exists() ? snap.data() : null;
}
