// ============================================================================
// Pluggporten – Läsresan, Firestore-brygga (data-lasresan.js)
// ----------------------------------------------------------------------------
// Tunn brygga (som data-xp.js / data-reading-level.js) mellan Läsresans rena
// kärna (src/lasresan/progress.js m.fl.) och Firestore:
//   studentData/{id}.lasresa                 – elevens tillstånd (ett map-fält)
//   studentData/{id}/lasresaAttempts/{auto}  – ett försök per färdig text
// Se docs/LASRESAN.md + docs/DATAMODELL.md.
//
// Importeras BARA från Läsresans dynamiskt laddade moduler – aldrig statiskt
// från app.js (bootgrafen, #271 / incident 2026-09-10).
//
// DEGRADERING (regeln för lasresaAttempts deployas separat): nekas skrivningen
// av försöket (permission-denied) görs transaktionen om UTAN subkollektionen,
// och försöket sparas i stället i studentData.lasresaAttemptsFallback (de
// senaste FALLBACK_ATTEMPTS_MAX). Progression, nivå och pengar påverkas inte.
// listAttempts läser båda källorna.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData, defaultStudentData, invalidateStudentData } from "./data.js";
import {
  normalizeLasresa,
  withStartedText,
  buildAttempt,
  applyCompletion,
} from "./lasresan/progress.js";
import { award } from "./lasresan/rewards.js";
import { getStudentStartLevel } from "./data-lasresan-niva.js";
import { WORLDS } from "./lasresan/worlds/index.js";

export const ATTEMPTS_SUBCOLLECTION = "lasresaAttempts";
export const FALLBACK_FIELD = "lasresaAttemptsFallback";
export const FALLBACK_ATTEMPTS_MAX = 30;

function requireId(studentId) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  return studentId;
}

const isPermissionDenied = (err) =>
  !!err && (err.code === "permission-denied" || /insufficient permissions/i.test(err.message || ""));

/**
 * Elevens Läsresan-tillstånd. Saknas fältet → ny elev (Skogen, steg 0, på
 * klassens startnivå, #505 – annars nivå 3).
 * OBS: innehåller den DOLDA nivån – visa aldrig `level` för eleven.
 */
export async function getLasresa(studentId = currentStudentId()) {
  const sd = await getStudentData(requireId(studentId));
  const raw = sd && sd.lasresa;
  const startLevel = raw ? undefined : await getStudentStartLevel(studentId);
  return normalizeLasresa(raw, WORLDS, { startLevel });
}

/**
 * Starta en text. Finns redan en påbörjad text returneras den i stället (en
 * avbruten text återupptas – man kan inte "hoppa" en dålig text).
 * `force: true` BARA när den påbörjade texten inte längre finns i banken.
 * @returns {Promise<{textId:string, resumed:boolean}>}
 */
export async function startText(textId, studentId = currentStudentId(), { force = false } = {}) {
  requireId(studentId);
  if (typeof textId !== "string" || !textId) throw new Error("textId saknas.");
  const ref = doc(db, "studentData", studentId);
  // Klassens startnivå (#505) behövs bara om eleven inte börjat – men måste
  // vara samma som getLasresa gav, annars sparas fel nivå vid första texten.
  const startLevel = await getStudentStartLevel(studentId);
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const cur = normalizeLasresa(sd && sd.lasresa, WORLDS, { startLevel });
    const out = withStartedText(cur, textId, Date.now(), { force });
    if (!out.resumed) {
      if (snap.exists()) tx.update(ref, { lasresa: out.lasresa });
      else tx.set(ref, { ...defaultStudentData(), lasresa: out.lasresa });
    }
    return { textId: out.textId, resumed: out.resumed };
  });
  invalidateStudentData(studentId);
  return res;
}

/**
 * Kör completeText-transaktionen. withSubcollection=false → försöket hamnar i
 * studentData-fallbacken i stället för lasresaAttempts.
 */
function completeTx(ref, studentId, text, answers, completedAt, withSubcollection) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const cur = normalizeLasresa(sd && sd.lasresa, WORLDS);
    if (cur.currentTextId !== text.id) {
      // Redan avslutad (dubbelklick/omladdning) eller aldrig startad.
      return { ok: false, reason: cur.currentTextId ? "other-text-active" : "not-started" };
    }
    const attempt = buildAttempt(text, answers, {
      startedAt: cur.currentStartedAt,
      completedAt,
      studentId,
    });
    const { lasresa, journey } = applyCompletion(cur, attempt, WORLDS, completedAt);
    const patch = { lasresa };
    if (withSubcollection) {
      tx.set(doc(collection(ref, ATTEMPTS_SUBCOLLECTION)), attempt);
    } else {
      const prev = Array.isArray(sd && sd[FALLBACK_FIELD]) ? sd[FALLBACK_FIELD] : [];
      patch[FALLBACK_FIELD] = [...prev, attempt].slice(-FALLBACK_ATTEMPTS_MAX);
    }
    if (snap.exists()) tx.update(ref, patch);
    else tx.set(ref, { ...defaultStudentData(), ...patch });
    return { ok: true, attempt, lasresa, journey };
  });
}

/**
 * Avsluta den påbörjade texten. EN transaktion skriver försöket + nytt
 * tillstånd (dold nivå, steg/värld, totaler, sedda texter, kategoristatistik).
 * Därefter läggs pengarna på det vanliga saldot via data.addCoins (rewards.award).
 *
 * @param {{text:object, answers:{qid:string, chosen:(number|null)}[]}} args
 *   `text` = ReadingText (rättas HÄR mot answerIndex), `answers` från läsvyn.
 * @returns {Promise<{ok:true, attempt, progress:{worldId,stepInWorld,completedWorlds},
 *   walk:{worldId,fromStep,toStep}, worldCompleted:boolean, completedWorldId, unlockedWorldId,
 *   coins:number, balance:(number|null), attemptStoredIn:("subcollection"|"studentData")}
 *   | {ok:false, reason:string}>}
 *   Nivån returneras MEDVETET inte – UI:t ska aldrig kunna visa den.
 */
export async function completeText({ text, answers }, studentId = currentStudentId()) {
  requireId(studentId);
  if (!text || !text.id || !Array.isArray(text.questions)) throw new Error("text saknas.");
  const ref = doc(db, "studentData", studentId);
  const completedAt = Date.now();
  let res;
  let attemptStoredIn = "subcollection";
  try {
    res = await completeTx(ref, studentId, text, answers, completedAt, true);
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    console.warn(
      "[Läsresan] lasresaAttempts nekades (regeln ej deployad?) – sparar försöket i studentData i stället.",
      err
    );
    attemptStoredIn = "studentData";
    res = await completeTx(ref, studentId, text, answers, completedAt, false);
  }
  invalidateStudentData(studentId);
  if (!res.ok) return res;

  let reward = { coins: 0, balance: null };
  try {
    reward = await award(res.attempt.correct, { studentId });
  } catch (err) {
    // Försöket är sparat (med earnedMoney); saldot kunde inte uppdateras.
    console.warn("[Läsresan] kunde inte lägga till pengar:", err);
  }
  const { journey } = res;
  return {
    ok: true,
    attempt: res.attempt,
    progress: journey.progress,
    walk: journey.walk,
    worldCompleted: journey.worldCompleted,
    completedWorldId: journey.completedWorldId,
    unlockedWorldId: journey.unlockedWorldId,
    coins: reward.coins,
    balance: reward.balance,
    attemptStoredIn,
  };
}

/**
 * Elevens senaste försök (nyast först). Läser lasresaAttempts och fallback-
 * fältet i studentData; nekad/saknad subkollektion ger bara fallbacken.
 */
export async function listAttempts(studentId = currentStudentId(), max = 20) {
  requireId(studentId);
  const out = [];
  try {
    const q = query(
      collection(db, "studentData", studentId, ATTEMPTS_SUBCOLLECTION),
      orderBy("completedAt", "desc"),
      qLimit(max)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    console.warn("[Läsresan] lasresaAttempts kunde inte läsas (regeln ej deployad?)", err);
  }
  try {
    const snap = await getDoc(doc(db, "studentData", studentId));
    const fb = snap.exists() ? snap.data()[FALLBACK_FIELD] : null;
    if (Array.isArray(fb)) fb.forEach((a, i) => out.push({ id: `fallback-${i}`, ...a }));
  } catch (err) {
    console.warn("[Läsresan] kunde inte läsa fallback-försök", err);
  }
  return out.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, max);
}

/**
 * Läsresan-tillstånd för flera elever (lärarens klasstabell). En getDoc per
 * elev (läraren, ~30 elever, inte varje elevsida). Elev som inte börjat →
 * lasresa: null. Nekad/saknad läsning hoppas över per elev.
 * @returns {Promise<{studentId:string, lasresa:(object|null)}[]>}
 */
export async function getClassLasresa(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  return Promise.all(
    ids.map(async (studentId) => {
      try {
        const snap = await getDoc(doc(db, "studentData", studentId));
        const raw = snap.exists() ? snap.data().lasresa : null;
        return { studentId, lasresa: raw ? normalizeLasresa(raw, WORLDS) : null };
      } catch (err) {
        console.warn(`[Läsresan] kunde inte läsa ${studentId}`, err);
        return { studentId, lasresa: null };
      }
    })
  );
}
