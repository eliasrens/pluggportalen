// ============================================================================
// Meteorstormen på SERVERN – sessionen, spelarna och minnet
// (functions/meteorstorm-sess.js, #821). Används av meteorstorm-core.js,
// -status.js och -ratta.js.
//
// MINNET (per instans, deps.minne – testerna ger var sitt): sessionen (högst
// MS_SESSION_TTL_MS gammal), quizet (oföränderligt), spelarnas namn/klass,
// loggen (meteorstorm-status.js) och quiz-rättningarna (meteorstorm-ratta.js).
// Sessionen ändras inte under matchen utom status/finishedAt – ett lärar-
// avslut syns här inom TTL:en, och msAvsluta räknar ändå bara loggen fram
// till finishedAt.
//
//   nyttMinne() · minneOf(deps) · satt(map, key, value, max)
//   refs(db, sid)                     → dokument och samlingar
//   parseSid(raw) · parseAttempt(raw) · fel(code, msg, details?)
//   sessionFor(deps, sid, { farsk? }) → sessionen (formatet kontrollerat)
//   slutFor(s) · assertLive(s, now)
//   playerFor(deps, sid, uid, s)      → { classId, name } (kärnans "Gå med")
//   quizFor(deps, sid)                → { pub, priv }
//   raknaStationer(s, players) · stationerOk(s) · stationerFor(deps, sid, s)
//   cfgFor(s)                         → motorns indata utan handlingar
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import { matchWindow } from "./kistspel-core.js";
import { toMs } from "./kistspel/ks-regler.js";

export const FORMAT = "meteorstorm";
export const MS_SESSION_TTL_MS = 5000;
export const COL = { events: "msEvents", players: "msPlayers", public: "msPublic", private: "msPrivate", las: "msLas" };
export const MULT = "multiplication_0_10";
export const QUIZ = "plugga_quiz";
export const MINNE_SESSIONER = 30;

const SID_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const bad = (msg) => new KsError("invalid-argument", msg);
export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function fel(code, message, details) {
  const e = new KsError(code, message);
  if (details) e.details = details;
  return e;
}

export function nyttMinne() {
  return {
    sess: new Map(), quiz: new Map(), spelare: new Map(), logg: new Map(),
    statusNasta: new Map(), rattat: new Map(), felSkickat: new Map(),
  };
}
const MINNE = nyttMinne();
export const minneOf = (deps) => deps.minne || MINNE;

/** Map med tak: äldst ut först. */
export function satt(map, key, value, max) {
  map.delete(key);
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value);
}

export function refs(db, sid) {
  const sess = db.collection("liveSessions").doc(sid);
  return {
    sess,
    events: sess.collection(COL.events),
    ev: (uid, nr) => sess.collection(COL.events).doc(`${uid}_${nr}`),
    msPlayer: (uid) => sess.collection(COL.players).doc(uid),
    msPlayers: sess.collection(COL.players),
    status: sess.collection(COL.public).doc("status"),
    pub: sess.collection(COL.public).doc("questions"),
    priv: sess.collection(COL.private).doc("snapshot"),
    las: (classId) => sess.collection(COL.las).doc(classId),
    player: (uid) => sess.collection("players").doc(uid),
    players: sess.collection("players"),
  };
}

export function parseSid(raw) {
  const sid = raw?.sid;
  if (typeof sid !== "string" || !SID_RE.test(sid)) throw bad("Matchens id saknas.");
  return sid;
}

export function parseAttempt(raw) {
  const id = raw?.attemptId;
  if (typeof id !== "string" || !ATTEMPT_RE.test(id)) throw bad("Svarets id saknas.");
  return id;
}

export async function sessionFor(deps, sid, { farsk = false } = {}) {
  const m = minneOf(deps);
  const now = deps.now();
  const c = m.sess.get(sid);
  if (c && !farsk && now - c.at < MS_SESSION_TTL_MS) return c.s;
  const snap = await refs(deps.db, sid).sess.get();
  if (!snap.exists) throw new KsError("not-found", "Matchen finns inte.");
  const s = snap.data();
  if (s.format !== FORMAT) throw new KsError("failed-precondition", "Det här är inte en Meteorstorm.");
  satt(m.sess, sid, { s, at: now }, MINNE_SESSIONER);
  return s;
}

/** Slutet: ordinarie slut, eller lärarens avslut om det kom före. */
export function slutFor(s) {
  const w = matchWindow(s);
  if (!w) return null;
  const f = toMs(s.finishedAt);
  return f != null && f < w.end ? Math.max(w.t0, f) : w.end;
}

export function assertLive(s, now) {
  const w = matchWindow(s);
  if (s.status !== "live" || !w) throw new KsError("failed-precondition", "Matchen pågår inte.");
  if (now < w.t0) throw new KsError("failed-precondition", "Stormen har inte börjat än.");
  if (now >= w.end) throw new KsError("failed-precondition", "Tiden är ute! ⏰");
}

/** Kärnans spelardokument (eleven gick med) = deltagare. Namn och klass i minnet. */
export async function playerFor(deps, sid, uid, s) {
  const m = minneOf(deps);
  const key = `${sid}/${uid}`;
  let p = m.spelare.get(key);
  if (!p) {
    const snap = uid ? await refs(deps.db, sid).player(uid).get() : null;
    const d = snap?.exists ? snap.data() : null;
    if (!d) throw new KsError("permission-denied", "Gå med i matchen först.");
    p = { classId: String(d.classId || ""), name: String(d.name || "") };
    satt(m.spelare, key, p, 5000);
  }
  if (!(s.participatingClassIds || []).includes(p.classId)) throw new KsError("permission-denied", "Gå med i matchen först.");
  return p;
}

/** Quizets frågor + facit (oföränderliga – läses en gång per instans). */
export async function quizFor(deps, sid) {
  const m = minneOf(deps);
  let q = m.quiz.get(sid);
  if (!q) {
    const r = refs(deps.db, sid);
    const [pub, priv] = await deps.db.getAll(r.pub, r.priv);
    q = { pub: pub.data() || { questions: [] }, priv: priv.data() || { facit: [] } };
    satt(m.quiz, sid, q, MINNE_SESSIONER);
  }
  return q;
}

export const stationerOk = (s) => Array.isArray(s.msStationer) && s.msStationer.length === (s.participatingClassIds || []).length;

/**
 * msStationer = [{ classId, aktiva }] – antal elever per klass som gått med
 * senast när stormen började (joinedAt ≤ t0), minst 1.
 */
export function raknaStationer(s, players) {
  const t0 = matchWindow(s)?.t0 ?? Infinity;
  return (s.participatingClassIds || []).map((classId) => ({
    classId,
    aktiva: Math.max(1, players.filter((p) => p.classId === classId && (toMs(p.joinedAt) ?? -Infinity) <= t0).length),
  }));
}

/**
 * aktiva per station sätts EN gång (första handlingen eller msAvsluta) och
 * sparas på sessionen – alla projektorer och msAvsluta använder samma tal.
 */
export async function stationerFor(deps, sid, s) {
  if (stationerOk(s)) return s.msStationer;
  const r = refs(deps.db, sid);
  const players = (await r.players.get()).docs.map((d) => d.data());
  const varde = await deps.db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (stationerOk(d)) return d.msStationer;
    const st = raknaStationer(d, players);
    tx.update(r.sess, { msStationer: st });
    return st;
  });
  s.msStationer = varde;
  return varde;
}

export function cfgFor(s) {
  return {
    seed: s.msSeed ?? 0,
    startMs: matchWindow(s)?.t0 ?? 0,
    varaktighetMs: (Number(s.durationSeconds) || 0) * 1000,
    stationer: s.msStationer || (s.participatingClassIds || []).map((classId) => ({ classId, aktiva: 1 })),
    installningar: s.msInstallningar || {},
  };
}
