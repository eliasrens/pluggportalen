// ============================================================================
// Live: Firestore-lagret (#460). ALLA Live-läsningar/skrivningar går härifrån.
// Sessionen lever centralt i liveSessions/{sid} – ingen state i en viss flik,
// dator eller hos skaparen. Schemat: docs/DATAMODELL.md "Mattematchen & Live".
// Svarsbatchen planeras av src/tavling/answer-writes.js (samma plan som
// regeltesterna kör). Laddas bara DYNAMISKT (Live-sidorna), aldrig i bootgrafen.
//
// API (lärare)
//   createLiveSession(input)            → sid       (status "lobby")
//   startLiveSession(sid)               → STARTA: startedAt = serverTimestamp,
//                                         sedan endsAt = startedAt + nedräkning + längd
//   fillEndsAt(sid)                     → skriv endsAt om den saknas (idempotent)
//   setClassDivisor(sid, classId, n)    → justera nämnaren (lobby + under match;
//                                         låst efter slut → DIVISOR_LOCKED_MSG)
//   deleteLiveSession(sid)              → radera en session som inte startat
//                                         (+ lobbyns spelardokument) (#543)
//   setLiveWizards(sid, wizards)        → Trollkarlsduellen: { classId: "rasmus"|"elias" }
//                                         (bara i lobbyn – reglerna, #536)
//   finishLiveSession(sid)              → avsluta nu (lärarens knapp) / avbryt lobby
//   writeResultIfMissing(sid, result)   → historikens ögonblicksbild (en gång)
//   listFinishedSessions()              → avslutade sessioner (historik), nyast först
//   listClassSessions(classId)          → avslutade sessioner där klassen deltog
//   getPlayers(sid) / getCounters(sid)  → spelar-/räknardokument en gång (lärare)
//   getSession(sid)                     → sessionen en gång
// API (alla inloggade)
//   watchActiveSessions(cb, onErr)      → unsub; cb(sessions[]) status lobby|live
//   watchSession(sid, cb, onErr)        → unsub; cb(session|null)
//   watchCounters(sid, cb, onErr)       → unsub; cb(counterDocs[])   (lärare)
//   watchPlayers(sid, cb, onErr)        → unsub; cb(playerDocs[])    (lärare)
//   autoFinish(sid)                     → markera "finished" efter sluttid
//                                         (reglerna kontrollerar request.time)
// API (elev)
//   watchMyPlayer(sid, uid, cb)         → unsub; cb(player|null)
//   joinLiveSession(sid, { uid, classId }) → skapar spelardokumentet om det saknas
//   heartbeat(sid, uid)                 → närvaro-puls (lastSeenAt)
//   submitLiveAnswer({ session, uid, classId, mode, attempt }) → Promise
// ============================================================================

import { db } from "../firebase-config.js";
import {
  doc, getDoc, getDocs, getDocFromServer, collection, query, where, onSnapshot,
  addDoc, updateDoc, setDoc, writeBatch, runTransaction, increment, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { planLiveAnswerWrites, planLiveJoin, planLiveHeartbeat, pickShard } from "../tavling/answer-writes.js";
import { buildSessionDoc, toMs, DIVISOR_LOCKED_MSG } from "./live-core.js";
import { noteServerStamp } from "./live-clock.js";

const fv = { increment, serverTimestamp };
const sessRef = (sid) => doc(db, "liveSessions", sid);

function withId(d) {
  return { id: d.id, ...d.data() };
}

// Färska serverstämplar (ej lokala väntande skrivningar) → klockans undre gräns.
function noteStamps(snap, data, keys) {
  if (!data || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
  for (const k of keys) if (data[k]) noteServerStamp(data[k]);
}

// --- Lärare -------------------------------------------------------------------

/** Skapa en session (lobby). input: se live-core validateSessionInput. */
export async function createLiveSession(input, uid) {
  const data = { ...buildSessionDoc(input, { uid }), createdAt: serverTimestamp() };
  if (input.createdByName) data.createdByName = String(input.createdByName).slice(0, 60);
  const ref = await addDoc(collection(db, "liveSessions"), data);
  return ref.id;
}

/**
 * STARTA (vilken lärare som helst). Transaktion: bara lobby → live, så två
 * lärare som trycker samtidigt inte startar om klockan (reglerna nekar också).
 * @returns {Promise<boolean>} true om just DEN HÄR klienten startade
 */
export async function startLiveSession(sid) {
  const started = await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessRef(sid));
    if (!snap.exists() || snap.data().status !== "lobby") return false;
    tx.update(sessRef(sid), { status: "live", startedAt: serverTimestamp() });
    return true;
  });
  if (started) await fillEndsAt(sid).catch((e) => console.warn("Live: endsAt kunde inte skrivas", e));
  return started;
}

/** endsAt = startedAt + nedräkning + matchlängd (exakt, inkl. nanosekunder). */
export async function fillEndsAt(sid) {
  const snap = await getDocFromServer(sessRef(sid));
  const s = snap.data();
  if (!s || !s.startedAt || s.endsAt) return;
  const extra = (Number(s.countdownSeconds) || 0) + (Number(s.durationSeconds) || 0);
  const endsAt = new Timestamp(s.startedAt.seconds + extra, s.startedAt.nanoseconds);
  await updateDoc(sessRef(sid), { endsAt });
}

/**
 * Lärarens nämnare (förifylld med klassens elevantal). Går i lobbyn och under
 * pågående match (#543) – poängen räknas om direkt i alla vyer via
 * realtidslagret. Efter slut nekar reglerna; här blir det ett begripligt fel.
 */
export async function setClassDivisor(sid, classId, n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1 || v > 999) throw new Error("Nämnaren måste vara ett heltal 1–999.");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessRef(sid));
    if (!snap.exists()) throw new Error("Matchen finns inte längre.");
    if (snap.data().status === "finished") throw new Error(DIVISOR_LOCKED_MSG);
    tx.update(sessRef(sid), { [`classDivisors.${classId}`]: v });
  });
}

/**
 * Radera en session som INTE startat (#543). Lobbyns spelardokument
 * (närvaro/redo) tas bort i samma batch; svar/räknare finns inte före start.
 * Reglerna nekar om sessionen hunnit starta (status ≠ lobby).
 */
export async function deleteLiveSession(sid) {
  const s = await getDocFromServer(sessRef(sid));
  if (!s.exists()) return;
  if (s.data().status !== "lobby") throw new Error("Bara en match som inte startat kan raderas – startade matcher sparas i historiken.");
  const players = await getDocs(collection(db, "liveSessions", sid, "players"));
  const b = writeBatch(db);
  players.docs.forEach((d) => b.delete(d.ref));
  b.delete(sessRef(sid));
  try {
    await b.commit();
  } catch (err) {
    if (err?.code === "permission-denied") throw new Error("Matchen hann starta – den kan inte raderas längre.");
    throw err;
  }
}

/** Trollkarlsduellen (#536): vem som är Rasmus/Elias. Reglerna: bara i lobbyn, en av varje. */
export async function setLiveWizards(sid, wizards) {
  await updateDoc(sessRef(sid), { wizards: { ...wizards } });
}

/** Lärarens "Avsluta" (live) eller "Avbryt" (lobby). */
export async function finishLiveSession(sid) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessRef(sid));
    if (!snap.exists() || snap.data().status === "finished") return;
    tx.update(sessRef(sid), { status: "finished", finishedAt: serverTimestamp() });
  });
}

/**
 * Matchslut när klockan gått ut: vilken klient som helst (elev eller lärare)
 * får markera "finished" – reglerna kräver request.time ≥ officiellt slut.
 * Ett avslag (någon hann före / för tidigt) är ofarligt.
 */
export async function autoFinish(sid) {
  try {
    await updateDoc(sessRef(sid), { status: "finished", finishedAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Historikens ögonblicksbild – skrivs en gång (av en lärarklient). Den klient
 * vars transaktion skrev result delar också ut Klasscentrets Live-bonusar
 * (#479), pokaler (#495) och mynt-priset till klasskassan (#526) –
 * dynamiskt, aldrig kastande → en gång per session.
 */
export async function writeResultIfMissing(sid, result) {
  let skrev = null;
  await runTransaction(db, async (tx) => {
    skrev = null;
    const snap = await tx.get(sessRef(sid));
    if (!snap.exists() || snap.data().result || snap.data().status !== "finished") return;
    tx.update(sessRef(sid), { result: { ...result, computedAt: serverTimestamp() } });
    skrev = { ...snap.data(), result };
  });
  // Först NÄR result är committat: bonus + pokaler (#495, idempotenta id:n).
  if (skrev) {
    import("../klasscenter/kc-koppling.js").then((m) => {
      m.liveKlassBonus(result);
      m.pokalerEfterAvslut("live", sid, skrev);
      m.livePrisEfterAvslut(sid, skrev);
    }).catch(() => {});
  }
}

function newestFirst(list) {
  return list.sort((a, b) => (toMs(b.startedAt) || toMs(b.createdAt) || 0) - (toMs(a.startedAt) || toMs(a.createdAt) || 0));
}

/** Avslutade sessioner (historik). Bara enkelfälts-index → sorteras i klienten. */
export async function listFinishedSessions() {
  const snap = await getDocs(query(collection(db, "liveSessions"), where("status", "==", "finished")));
  return newestFirst(snap.docs.map(withId));
}

/** Avslutade, spelade sessioner där klassen deltog (Statistik → Live). */
export async function listClassSessions(classId) {
  const snap = await getDocs(query(collection(db, "liveSessions"), where("participatingClassIds", "array-contains", classId)));
  return newestFirst(snap.docs.map(withId).filter((s) => s.status === "finished" && s.startedAt));
}

/** Alla spelare i en session (lärare). */
export async function getPlayers(sid) {
  const snap = await getDocs(collection(db, "liveSessions", sid, "players"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Klassräknarna en gång (historik utan sparat result). */
export async function getCounters(sid) {
  const snap = await getDocs(collection(db, "liveSessions", sid, "counters"));
  return snap.docs.map((d) => d.data());
}

/** Läs en session en gång. */
export async function getSession(sid) {
  const snap = await getDoc(sessRef(sid));
  return snap.exists() ? withId(snap) : null;
}

// --- Prenumerationer (realtid) ------------------------------------------------

/** Pågående sessioner (lobby + live) – lärarnas "Aktiva Live-sessioner" och elevens meny. */
export function watchActiveSessions(cb, onErr) {
  const q = query(collection(db, "liveSessions"), where("status", "in", ["lobby", "live"]));
  return onSnapshot(q, (snap) => cb(newestFirst(snap.docs.map(withId))), onErr);
}

export function watchSession(sid, cb, onErr) {
  return onSnapshot(sessRef(sid), (snap) => {
    const s = snap.exists() ? withId(snap) : null;
    noteStamps(snap, s, ["startedAt"]);
    cb(s);
  }, onErr);
}

export function watchCounters(sid, cb, onErr) {
  return onSnapshot(collection(db, "liveSessions", sid, "counters"), (snap) => {
    if (!snap.metadata.hasPendingWrites) snap.docChanges().forEach((c) => noteServerStamp(c.doc.get("lastAt")));
    cb(snap.docs.map((d) => d.data()));
  }, onErr);
}

export function watchPlayers(sid, cb, onErr) {
  return onSnapshot(collection(db, "liveSessions", sid, "players"), (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  }, onErr);
}

// --- Elev ---------------------------------------------------------------------

export function watchMyPlayer(sid, uid, cb, onErr) {
  return onSnapshot(doc(db, "liveSessions", sid, "players", uid), (snap) => {
    const p = snap.exists() ? snap.data() : null;
    noteStamps(snap, p, ["lastSeenAt"]);
    cb(p);
  }, onErr);
}

/**
 * "Gå med" (lobby) eller sen anslutning (live). Finns spelardokumentet redan
 * (omladdning/återanslutning) skapas det INTE om – reglerna tillåter bara create.
 */
export async function joinLiveSession(sid, { uid, classId }) {
  const ref = doc(db, "liveSessions", sid, "players", uid);
  const have = await getDoc(ref);
  if (have.exists()) return { ...have.data(), resumed: true };
  const me = await getDoc(doc(db, "students", uid));
  const name = me.exists() ? me.data().namn || "" : "";
  const w = planLiveJoin({ sessionId: sid, uid, classId, name, fv });
  await setDoc(doc(db, ...w.path), w.data);
  return { ...w.data, resumed: false };
}

export async function heartbeat(sid, uid) {
  const w = planLiveHeartbeat({ sessionId: sid, uid, fv });
  await setDoc(doc(db, ...w.path), w.data, { merge: true });
}

/**
 * Ett svar → EN batch (svar + spelare + ev. klass-shard). Väntar inte in
 * något i UI:t – anroparen fångar fel. attempt = fast-answer-försöket.
 */
export function submitLiveAnswer({ session, uid, classId, mode, attempt }) {
  const writes = planLiveAnswerWrites({
    sessionId: session.id,
    attemptId: attempt.attemptId,
    uid,
    classId,
    mode: mode.id,
    record: mode.answerRecord(attempt.question, attempt.result),
    isCorrect: !!attempt.result.correct,
    shard: pickShard(session.counterShards),
    fv,
  });
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
