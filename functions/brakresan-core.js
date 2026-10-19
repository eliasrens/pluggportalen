// ============================================================================
// Bråkresan på SERVERN – omgångar och bedömning (functions/brakresan-core.js, #708)
// ----------------------------------------------------------------------------
// Spec §2 BEDÖMNING, §5, §13 "Betrodd bedömning", docs/BRAKRESAN.md §6.
// Klienten skickar bara SVAR. Servern väljer seed, bygger de tio uppgifterna,
// håller facit i brakresaSecrets/{roundId} (ingen klient läser det) och
// bedömer mot de SPARADE uppgifterna – en ändrad generator rör aldrig en
// gammal aktiv omgång. Allt sker i transaktioner med state-dokumentet som lås:
//
//   startRound   { challengeId, restart?, replaceRoundId? } → { roundId, resumed, round }
//                Aktiv omgång finns → den (återupptagning, samma tio uppgifter
//                och låsta svar). restart → den gamla blir "avbruten" och en ny
//                skapas i SAMMA transaktion. replaceRoundId (valfri) = byt bara
//                om den aktiva fortfarande är just den – ett dubbelklick eller en
//                andra flik startar då inte om en gång till.
//                Nekas (permission-denied) när klassen dolt Bråkresan eller är
//                låst till något annat i fokusläget (#735, assertModuleOpen;
//                ett inlämnat prov släpper eleven enligt efter-valet, #788).
//   answerTask   { roundId, index, answer, helpBefore? } → graded | invalid
//                Första GILTIGA svaret låser rätt/fel. Omförsök/dubbelklick →
//                det sparade utfallet (already: true). Inmatningsfel sparas inte.
//   reworkTask   { roundId, index, answer?, helpAfter?, attemptId? }
//                Bara efter ett fel. ≤ 5 försök sparas, poängen ändras ALDRIG.
//                attemptId (klientens id för försöket) gör omförsök idempotenta.
//   abortRound   { roundId } → { status: "avbruten" } – ingen belöning, svaren
//                finns kvar i statistiken.
//   ackDragon    { level } → { levelShown } – kläckning/evolution visad.
//   renameDragon { name } → { name } – #713. Servern rensar texten
//                (cleanDragonName) och skriver state.dragon.name +
//                studentData.brakdrake.name i samma transaktion. Ägget → fel.
//   finishRound  brakresan-avslut.js (stjärna, uppmuntran, mynt, drake).
//
// deps = { db, FieldValue, Timestamp, now?(), randomId?(n), loadChallenge? }
// Callables i index.js; lärare nekas där (testläget körs bara i klienten).
// Tester: test/functions-brakresan-core.test.mjs (+ -avslut, e2e).
// ============================================================================

import { randomInt } from "node:crypto";
import { loadChallenge as loadReal } from "./brakresan/utmaningar/index.js";
import { isChallengeId } from "./brakresan/schema/katalog.js";
import { buildTask, gradeTask, ROUND_SIZE } from "./brakresan/schema/kontrakt.js";
import { planRound, PlanError } from "./brakresan/schema/omgangsplan.js";
import { publicTask, revealTask } from "./brakresan/schema/uppgift.js";
import {
  dragonLevel, cleanDragonName, DRAGON_MAX_LEVEL, DRAGON_NAME_MAX, MAX_STARS_PER_CHALLENGE,
} from "./brakresan/schema/regler.js";
import {
  BrFel, ROUND_SCHEMA, brRefs, readState, challengeEntry, withChallenge, toPlain, cleanAnswer, helpSteps, mergeHelp,
  roundIdOf,
} from "./brakresan-state.js";

export { BrFel };
export { finishRound } from "./brakresan-avslut.js";

/** Rework-försök som sparas per uppgift (§13: "eventuell bearbetning"). */
export const MAX_REWORK = 5;
/** Kärnorna från så många senaste avslutade omgångar undviks i nästa. */
export const AVOID_ROUNDS = 3;

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function randomId(n = 20) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALNUM[randomInt(0, ALNUM.length)];
  return s;
}

const ctx = (deps) => ({
  ...deps,
  now: deps.now || Date.now,
  rid: deps.randomId || randomId,
  load: deps.loadChallenge || loadReal,
});

function indexOf(data) {
  const i = data?.index;
  if (!Number.isSafeInteger(i) || i < 0 || i >= ROUND_SIZE) throw new BrFel("invalid-argument", "Ogiltig uppgift.");
  return i;
}

async function loadBuilt(load, id) {
  const ch = await load(id);
  if (!ch?.implemented) throw new BrFel("failed-precondition", "Den här utmaningen är inte klar ännu.");
  return ch;
}

/** Bedöm, men ett svar som bedömningen inte kan läsa blir ett inmatningsfel – aldrig ett låst fel. */
function grade(challenge, task, answer) {
  try {
    const g = gradeTask(challenge, task, answer);
    if (g?.status === "graded" || g?.status === "invalid") return g;
  } catch {
    /* faller igenom */
  }
  return { status: "invalid", error: "ogiltig", message: "Svaret kunde inte läsas – prova igen." };
}

const emptyAnswer = (index) => ({ index, first: null, helpBefore: [], helpAfter: [], rework: [], reveal: null });
const coresOf = (secretSnap) => (secretSnap?.exists ? (secretSnap.data().plan || []).map((p) => p.core) : []);

/** Tio nya uppgifter (utanför transaktionen – ren beräkning + en historikfråga). */
async function planFresh(c, r, challenge) {
  const prev = await r.rounds()
    .where("challengeId", "==", challenge.id).where("status", "==", "avslutad")
    .orderBy("finishedAt", "desc").limit(AVOID_ROUNDS).get();
  const avoidCores = prev.docs.flatMap((d) => d.data().cores || []);
  const roundId = c.rid(20);
  const seed = c.rid(24);
  let plan;
  try {
    plan = planRound(challenge, { seed, avoidCores });
  } catch (err) {
    if (err instanceof PlanError) throw new BrFel("failed-precondition", "Utmaningen kunde inte skapa nya uppgifter just nu.");
    throw err;
  }
  const tasks = plan.entries.map((e) => buildTask(challenge, e.params, { index: e.index, role: e.role, id: `${roundId}-${e.index}` }));
  return { roundId, seed, plan, tasks };
}

/** Modul-id i registret och låstypen i fokusläget (src/gamemode-visibility.js). */
export const MODUL_ID = "brakresan";

/** Bråkresan är en övningsmodul (`ovning: true` i registret, #788) – test/class-lock.test.js jämför. */
export const MODUL_OVNING = true;

/**
 * Frigör ett provlås eleven (#788, src/class-lock.js lockEfterInlamning)? Bara
 * när läraren valt ett efter-läge som öppnar Bråkresan OCH elevens svar på
 * just det tillfället är inlämnat – den som skriver är låst som förr.
 */
async function frigjordEfterProv(db, uid, l) {
  const e = l.efter;
  if (l.mal.typ !== "prov" || !e || typeof l.mal.id !== "string" || !/^[^/]{3,200}$/.test(l.mal.id)) return false;
  const oppnar = e.lage === "klass" || (e.lage === "ovning" && MODUL_OVNING) ||
    (e.lage === "egna" && Array.isArray(e.moduler) && e.moduler.includes(MODUL_ID));
  if (!oppnar) return false;
  const svar = await db.doc(`provTillfallen/${l.mal.id}/svar/${uid}`).get();
  return svar.exists && svar.data().inlamnad === true;
}

/**
 * Speglar elevens grind (#412/#436, src/class-lock.js) på servern (#735): en
 * omgång startar inte när någon av elevens klasser döljer Bråkresan eller har
 * ett aktivt fokuslås till något annat. Ett aktivt lås TILL Bråkresan öppnar
 * den även om den är dold (samma regel som klienten). Reglerna tillåter bara
 * kända låstyper, så varje typ med `till` i framtiden räknas som ett lås.
 * Ett provlås släpper en elev som lämnat in enligt lärarens efter-val (#788).
 */
export async function assertModuleOpen(db, uid, nowMs) {
  const klasser = (await db.collection("classes").where("studentIds", "array-contains", uid).get())
    .docs.map((d) => d.data());
  const las = klasser.map((k) => k.lock)
    .filter((l) => typeof l?.mal?.typ === "string" && Number(l.till) > nowMs);
  if (las.some((l) => l.mal.typ === MODUL_ID)) return;
  const fria = await Promise.all(las.map((l) => frigjordEfterProv(db, uid, l)));
  if (fria.includes(false)) throw new BrFel("permission-denied", "Din klass har fokusläge på något annat just nu.");
  if (klasser.some((k) => Array.isArray(k.hiddenModules) && k.hiddenModules.includes(MODUL_ID))) {
    throw new BrFel("permission-denied", "Bråkresan är stängd för din klass just nu.");
  }
}

const NEED_PLAN = Symbol("need-plan");

export async function startRound(deps, uid, data = {}) {
  const c = ctx(deps);
  const challengeId = data.challengeId;
  if (!isChallengeId(challengeId)) throw new BrFel("invalid-argument", "Okänd utmaning.");
  const restart = data.restart === true;
  const replace = data.replaceRoundId == null ? null : roundIdOf({ roundId: data.replaceRoundId });
  await assertModuleOpen(c.db, uid, c.now());
  const challenge = await loadBuilt(c.load, challengeId);
  const r = brRefs(c.db, uid);
  let fresh = null;

  for (;;) {
    const res = await c.db.runTransaction(async (tx) => {
      const state = readState(await tx.get(r.state));
      const entry = challengeEntry(state, challengeId);
      const activeId = entry.activeRoundId;
      const activeSnap = activeId ? await tx.get(r.round(activeId)) : null;
      const active = activeSnap?.exists && activeSnap.data().status === "aktiv" ? activeSnap.data() : null;
      const replaceIt = !!active && restart && (!replace || replace === activeId);
      if (active && !replaceIt) return { roundId: activeId, resumed: true, round: active };
      if (!fresh) return NEED_PLAN;

      const oldSecret = replaceIt ? await tx.get(r.secret(activeId)) : null;
      const at = c.Timestamp.fromMillis(c.now());
      const e = { ...entry };
      let next = state;
      if (replaceIt) {
        tx.update(r.round(activeId), { status: "avbruten", finishedAt: at, updatedAt: at, cores: coresOf(oldSecret) });
        e.roundsAborted += 1;
        e.lastAt = at;
        next = { ...state, totals: { ...state.totals, roundsAborted: state.totals.roundsAborted + 1 }, lastActivityAt: at };
      }
      const { roundId, seed, plan, tasks } = fresh;
      const round = {
        schema: ROUND_SCHEMA, roundId, studentId: uid, challengeId,
        mode: entry.stars >= MAX_STARS_PER_CHALLENGE ? "repetition" : "elev",
        version: plan.version, status: "aktiv",
        tasks: tasks.map(publicTask),
        answers: tasks.map((_, i) => emptyAnswer(i)),
        answeredCount: 0, correctCount: 0,
        startedAt: at, finishedAt: null, updatedAt: at, reward: null, cores: null,
      };
      tx.set(r.secret(roundId), {
        studentId: uid, challengeId, version: plan.version, seed,
        plan: plan.entries.map(({ index, role, params, core, source }) => ({ index, role, params, core, source })),
        tasks, createdAt: at,
      });
      tx.set(r.round(roundId), round);
      e.activeRoundId = roundId;
      e.activeAnswered = 0;
      tx.set(r.state, { ...withChallenge(next, challengeId, e), updatedAt: at });
      return { roundId, resumed: false, round };
    });
    if (res !== NEED_PLAN) return toPlain(res);
    fresh = await planFresh(c, r, challenge);
  }
}

/** Det sparade utfallet för en redan bedömd uppgift. */
function savedOutcome(round, index) {
  const a = round.answers[index];
  return {
    status: "graded", correct: a.first.correct, reason: a.first.reason ?? null, message: a.first.message ?? null,
    reveal: a.reveal ?? null, answeredCount: round.answeredCount, correctCount: round.correctCount, already: true,
  };
}

export async function answerTask(deps, uid, data = {}) {
  const c = ctx(deps);
  const roundId = roundIdOf(data);
  const index = indexOf(data);
  const answer = cleanAnswer(data.answer);
  const helpBefore = helpSteps(data.helpBefore);
  const r = brRefs(c.db, uid);

  return c.db.runTransaction(async (tx) => {
    const rs = await tx.get(r.round(roundId));
    if (!rs.exists) throw new BrFel("not-found", "Omgången finns inte.");
    const round = rs.data();
    if (round.answers?.[index]?.first) return toPlain(savedOutcome(round, index));
    if (round.status !== "aktiv") throw new BrFel("failed-precondition", "Omgången är inte längre aktiv.");
    const [secretSnap, stateSnap] = await Promise.all([tx.get(r.secret(roundId)), tx.get(r.state)]);
    const task = secretSnap.exists ? secretSnap.data().tasks?.[index] : null;
    if (!task) throw new BrFel("failed-precondition", "Omgångens uppgifter saknas.");
    const g = grade(await c.load(round.challengeId), task, answer);
    if (g.status === "invalid") return { status: "invalid", error: g.error, message: g.message };

    const at = c.Timestamp.fromMillis(c.now());
    const correct = g.correct === true;
    const reveal = revealTask(task);
    const answers = round.answers.map((a, i) => (i !== index ? a : {
      ...emptyAnswer(i), ...a,
      first: { answer, correct, reason: g.reason ?? null, message: g.message ?? null, at },
      helpBefore: mergeHelp(a?.helpBefore, helpBefore),
      reveal,
    }));
    const answeredCount = answers.filter((a) => a?.first).length;
    const correctCount = answers.filter((a) => a?.first?.correct === true).length;
    tx.update(r.round(roundId), { answers, answeredCount, correctCount, updatedAt: at });

    const state = readState(stateSnap);
    const e = challengeEntry(state, round.challengeId);
    const usedHelp = answers[index].helpBefore.length > 0 ? 1 : 0;
    const ne = {
      ...e,
      activeAnswered: e.activeRoundId === roundId ? answeredCount : e.activeAnswered,
      firstCorrect: e.firstCorrect + (correct ? 1 : 0),
      firstTotal: e.firstTotal + 1,
      helpBefore: e.helpBefore + usedHelp,
      lastAt: at,
    };
    const t = state.totals;
    const totals = { ...t, firstCorrect: t.firstCorrect + (correct ? 1 : 0), firstTotal: t.firstTotal + 1, helpBefore: t.helpBefore + usedHelp };
    tx.set(r.state, { ...withChallenge({ ...state, totals, lastActivityAt: at }, round.challengeId, ne), updatedAt: at });

    return toPlain({
      status: "graded", correct, reason: g.reason ?? null, message: g.message ?? null, reveal, answeredCount, correctCount,
      already: false,
    });
  });
}

export async function reworkTask(deps, uid, data = {}) {
  const c = ctx(deps);
  const roundId = roundIdOf(data);
  const index = indexOf(data);
  const answer = data.answer === undefined || data.answer === null ? null : cleanAnswer(data.answer);
  const helpAfter = helpSteps(data.helpAfter);
  const attemptId = data.attemptId == null ? null : String(data.attemptId);
  if (attemptId !== null && !/^[A-Za-z0-9_-]{4,64}$/.test(attemptId)) throw new BrFel("invalid-argument", "Ogiltigt försök.");
  const r = brRefs(c.db, uid);

  return c.db.runTransaction(async (tx) => {
    const rs = await tx.get(r.round(roundId));
    if (!rs.exists) throw new BrFel("not-found", "Omgången finns inte.");
    const round = rs.data();
    const a = round.answers?.[index];
    if (!a?.first || a.first.correct !== false) {
      throw new BrFel("failed-precondition", "Bearbetning görs efter ett svar som inte var rätt.");
    }
    const rework = Array.isArray(a.rework) ? a.rework : [];
    const prior = attemptId ? rework.find((w) => w.attemptId === attemptId) : null;
    if (prior) return { status: "graded", correct: prior.correct, message: prior.message ?? null, reworkCount: rework.length, already: true };

    const [secretSnap, stateSnap] = await Promise.all([tx.get(r.secret(roundId)), tx.get(r.state)]);
    let g = null;
    if (answer) {
      const task = secretSnap.exists ? secretSnap.data().tasks?.[index] : null;
      if (!task) throw new BrFel("failed-precondition", "Omgångens uppgifter saknas.");
      g = grade(await c.load(round.challengeId), task, answer);
    }
    const at = c.Timestamp.fromMillis(c.now());
    const help = mergeHelp(a.helpAfter, helpAfter);
    const newHelp = (a.helpAfter || []).length === 0 && help.length > 0;
    const saveTry = g?.status === "graded" && rework.length < MAX_REWORK;
    const nextRework = saveTry
      ? [...rework, { answer, correct: g.correct === true, message: g.message ?? null, at, ...(attemptId ? { attemptId } : {}) }]
      : rework;
    if (saveTry || help.length !== (a.helpAfter || []).length) {
      const answers = round.answers.map((x, i) => (i === index ? { ...x, helpAfter: help, rework: nextRework } : x));
      tx.update(r.round(roundId), { answers, updatedAt: at });
    }
    if (newHelp) {
      const state = readState(stateSnap);
      const e = challengeEntry(state, round.challengeId);
      const totals = { ...state.totals, helpAfter: state.totals.helpAfter + 1 };
      tx.set(r.state, { ...withChallenge({ ...state, totals }, round.challengeId, { ...e, helpAfter: e.helpAfter + 1 }), updatedAt: at });
    }
    if (!g) return { status: "ok", reworkCount: nextRework.length };
    if (g.status === "invalid") return { status: "invalid", error: g.error, message: g.message };
    return { status: "graded", correct: g.correct === true, message: g.message ?? null, reworkCount: nextRework.length, saved: saveTry };
  });
}

export async function abortRound(deps, uid, data = {}) {
  const c = ctx(deps);
  const roundId = roundIdOf(data);
  const r = brRefs(c.db, uid);
  return c.db.runTransaction(async (tx) => {
    const rs = await tx.get(r.round(roundId));
    if (!rs.exists) throw new BrFel("not-found", "Omgången finns inte.");
    const round = rs.data();
    if (round.status === "avbruten") return { status: "avbruten", already: true };
    if (round.status !== "aktiv") throw new BrFel("failed-precondition", "Omgången är redan avslutad.");
    const [secretSnap, stateSnap] = await Promise.all([tx.get(r.secret(roundId)), tx.get(r.state)]);
    const at = c.Timestamp.fromMillis(c.now());
    tx.update(r.round(roundId), { status: "avbruten", finishedAt: at, updatedAt: at, cores: coresOf(secretSnap) });
    const state = readState(stateSnap);
    const e = challengeEntry(state, round.challengeId);
    const mine = e.activeRoundId === roundId;
    const ne = { ...e, activeRoundId: mine ? null : e.activeRoundId, activeAnswered: mine ? 0 : e.activeAnswered,
      roundsAborted: e.roundsAborted + 1, lastAt: at };
    const totals = { ...state.totals, roundsAborted: state.totals.roundsAborted + 1 };
    tx.set(r.state, { ...withChallenge({ ...state, totals, lastActivityAt: at }, round.challengeId, ne), updatedAt: at });
    return { status: "avbruten", already: false };
  });
}

export async function ackDragon(deps, uid, data = {}) {
  const c = ctx(deps);
  const level = data.level;
  if (!Number.isSafeInteger(level) || level < 0 || level > DRAGON_MAX_LEVEL) throw new BrFel("invalid-argument", "Ogiltig nivå.");
  const r = brRefs(c.db, uid);
  return c.db.runTransaction(async (tx) => {
    const state = readState(await tx.get(r.state));
    if (!state.dragon) throw new BrFel("failed-precondition", "Draken har inte kläckts ännu.");
    const old = state.dragon.levelShown || 0;
    const levelShown = Math.max(old, Math.min(level, dragonLevel(state.totalStars)));
    if (levelShown !== old) {
      tx.set(r.state, { ...state, dragon: { ...state.dragon, levelShown }, updatedAt: c.Timestamp.fromMillis(c.now()) });
    }
    return { levelShown };
  });
}

export async function renameDragon(deps, uid, data = {}) {
  const c = ctx(deps);
  if (typeof data.name !== "string" || data.name.length > 200) throw new BrFel("invalid-argument", "Ogiltigt namn.");
  const name = cleanDragonName(data.name);
  if (!name) throw new BrFel("invalid-argument", `Skriv ett namn med 1–${DRAGON_NAME_MAX} tecken.`);
  const r = brRefs(c.db, uid);
  return c.db.runTransaction(async (tx) => {
    const state = readState(await tx.get(r.state));
    if (!state.dragon) throw new BrFel("failed-precondition", "Ägget har inte kläckts ännu.");
    const at = c.Timestamp.fromMillis(c.now());
    tx.set(r.state, { ...state, dragon: { ...state.dragon, name }, updatedAt: at });
    // merge: placering (pos/room/stowed) och nivå i husposten lämnas orörda.
    tx.set(r.data, { brakdrake: { id: state.dragon.id, name } }, { merge: true });
    return { name };
  });
}
