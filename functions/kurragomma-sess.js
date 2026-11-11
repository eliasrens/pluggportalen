// ============================================================================
// Kurragömma på SERVERN – sessionen, referenserna, tiderna och minnet
// (functions/kurragomma-sess.js, #838). Används av kurragomma-fas.js,
// -core.js, -tick.js och -resultat.js. Kontraktet: docs/KURRAGOMMA.md §8.
//
// MINNET (per instans, deps.minne – testerna ger var sitt): sessionen (högst
// KG_SESSION_TTL_MS gammal), quizet (oföränderligt) och spelarnas namn/klass.
// Sessionen ändras under matchen (kgFas, kgGomSlut, kgLetStart, kgPlacerade,
// status) – den som skriver uppdaterar minnet (sattSession), och ett fasbyte
// prövas alltid i en transaktion som läser färskt.
//
//   nyttMinne() · minneOf(deps) · satt(map, key, value, max)
//   refs(db, sid)                 → dokument och samlingar (kg* + kärnans players/answers)
//   parseSid(raw) · parseAttempt(raw) · parsePunkt(raw) · bad(msg) · isInt · fel(code, msg, details?)
//   sessionFor(deps, sid, { farsk? }) → sessionen (formatet kontrollerat)
//   sattSession(deps, sid, s)     efter en egen skrivning
//   tider(s)                      → { t0, slut, gomSlut, letStart } i ms (null där det saknas)
//   assertLive(s, nu)
//   playerFor(deps, sid, uid, s)  → { classId, name } (kärnans "Gå med")
//   quizFor(deps, sid)            → { pub, priv }
//   instFor(s) · kartaFor(s) · namnFor(s, namn) (lärarens namninställning)
//   larareFor(roll, s)            läraren som styr matchen (callerRole)
//   gomdaKvar(deps, sid)          → antal gömda kvar (en räknefråga = 1 läsning)
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import { matchWindow } from "./kistspel-core.js";
import { toMs } from "./kistspel/ks-regler.js";
import { normInstallningar } from "./kurragomma/kg-regler.js";
import { hamtaKarta } from "./kurragomma/kg-karta.js";

export const FORMAT = "kurragomma";
export const KG_SESSION_TTL_MS = 5000;
export const COL = {
  players: "kgPlayers", self: "kgSelf", secret: "kgSecret", events: "kgEvents", public: "kgPublic", private: "kgPrivate",
};
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
  return { sess: new Map(), quiz: new Map(), spelare: new Map() };
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
    player: (uid) => sess.collection("players").doc(uid),
    players: sess.collection("players"),
    answer: (id) => sess.collection("answers").doc(id),
    answers: sess.collection("answers"),
    kgPlayer: (uid) => sess.collection(COL.players).doc(uid),
    kgPlayers: sess.collection(COL.players),
    self: (uid) => sess.collection(COL.self).doc(uid),
    selfs: sess.collection(COL.self),
    secret: (uid) => sess.collection(COL.secret).doc(uid),
    secrets: sess.collection(COL.secret),
    events: sess.collection(COL.events),
    pub: sess.collection(COL.public).doc("questions"),
    priv: sess.collection(COL.private).doc("snapshot"),
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

/** { x, z } ur anropet – ändliga tal (kartan klämmer dem sedan). */
export function parsePunkt(raw) {
  const x = Number(raw?.x);
  const z = Number(raw?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1000 || Math.abs(z) > 1000) throw bad("Platsen saknas.");
  return { x, z };
}

export async function sessionFor(deps, sid, { farsk = false } = {}) {
  const m = minneOf(deps);
  const now = deps.now();
  const c = m.sess.get(sid);
  if (c && !farsk && now - c.at < KG_SESSION_TTL_MS) return c.s;
  const snap = await refs(deps.db, sid).sess.get();
  if (!snap.exists) throw new KsError("not-found", "Matchen finns inte.");
  const s = snap.data();
  if (s.format !== FORMAT) throw new KsError("failed-precondition", "Det här är inte en Kurragömma.");
  satt(m.sess, sid, { s, at: now }, MINNE_SESSIONER);
  return s;
}

export function sattSession(deps, sid, s) {
  satt(minneOf(deps).sess, sid, { s, at: deps.now() }, MINNE_SESSIONER);
  return s;
}

/**
 * Tiderna i ms: t0 = KÖR! (kärnans matchklocka startar, gömfasen börjar),
 * slut = ordinarie slut eller lärarens avslut om det kom före, gomSlut och
 * letStart ur sessionen (null tills servern satt dem).
 */
export function tider(s) {
  const w = matchWindow(s);
  if (!w) return { t0: null, slut: null, gomSlut: null, letStart: null };
  const f = toMs(s.finishedAt);
  return {
    t0: w.t0,
    slut: f != null && f < w.end ? Math.max(w.t0, f) : w.end,
    gomSlut: toMs(s.kgGomSlut),
    letStart: toMs(s.kgLetStart),
  };
}

export function assertLive(s, nu) {
  const { t0, slut } = tider(s);
  if (s.status !== "live" || t0 == null) throw new KsError("failed-precondition", "Matchen pågår inte.");
  if (nu < t0) throw new KsError("failed-precondition", "Matchen har inte börjat än.");
  if (nu >= slut) throw new KsError("failed-precondition", "Tiden är ute! ⏰");
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

export const instFor = (s) => normInstallningar(s.kgInstallningar || {});
export const kartaFor = (s) => hamtaKarta(instFor(s).karta);

/** Namnet i flödet och realtidshändelserna: lärarens inställning, av = null ("Någon"). */
export const namnFor = (s, namn) => (s.showNames === false ? null : String(namn || "") || null);

/** Läraren som styr matchen (samma som reglernas liveTeacherOf). */
export function larareFor(roll, s) {
  if (!roll) return false;
  if (roll.role === "admin") return true;
  return (s.participatingClassIds || []).some((c) => (roll.classIds || []).includes(c));
}

/** Antal gömda kvar – en räknefråga (1 läsning). */
export async function gomdaKvar(deps, sid) {
  const snap = await refs(deps.db, sid).kgPlayers.where("roll", "==", "gomd").count().get();
  return snap.data().count;
}
