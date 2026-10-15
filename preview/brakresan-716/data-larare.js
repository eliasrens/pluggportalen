// Preview-stub för src/brakresan/larare/data-larare.js (#716) – ingen Firebase.
// Elevernas state-dokument genereras deterministiskt; omgångarna byggs med den
// RIKTIGA demoRound (samma uppgifter/bilder som servern sparar) och elevsvaren
// tas ur uppgifternas key.examples (rätt eller fel). Rekommendationerna lever i
// sessionStorage. ?elever=2 → litet underlag, ?tom=1 hanteras av sidan.
import { CHALLENGES } from "../../src/brakresan/schema/katalog.js";
import { demoRound, gradeDemo, publicTask } from "../../src/brakresan/demo.js";
import { revealTask } from "../../src/brakresan/schema/uppgift.js";
import { ms, recDokument } from "../../src/brakresan/larare/statistik.js";

const DAG = 86_400_000;
const NU = Date.now();
const ts = (t) => ({ seconds: Math.floor(t / 1000), nanoseconds: 0 });

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export const ELEVER = [
  ["s1", "Alva Berg", "owl", 0.9, 30], ["s2", "Bo Ek", "frog", 0.55, 14], ["s3", "Cleo Nyström", "unicorn", 0.75, 22],
  ["s4", "Dan Holm", "robot", 0.4, 9], ["s5", "Elsa <b>Åberg</b>", "cat", 0.85, 35], ["s6", "Filip Sund", "panda", 0, 0],
  ["s7", "Greta Vik", "koala", 0.65, 18], ["s8", "Hugo Lind", "lion", 0.7, 12], ["s9", "Ines Falk", "fox", 0.95, 40],
  ["s10", "Jonatan Ro", "bear", 0.5, 5],
].map(([id, namn, avatarId, skill, antal]) => ({ id, namn, username: id, avatarId, skill, antal }));

function stateFor(e, i) {
  if (!e.antal) return null; // aldrig öppnat Bråkresan → standardvärden i getState
  const r = rng(1000 + i * 77);
  const challenges = {};
  const tot = { roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 };
  let senast = 0;
  // Svåra moment: 25–35 (räkna) går sämre, 01–10 bättre.
  for (const c of CHALLENGES.slice(0, e.antal)) {
    const svar = c.nr > 24 ? 0.18 : c.nr < 11 ? -0.08 : 0;
    const p = Math.max(0.15, Math.min(0.98, e.skill - svar + (r() - 0.5) * 0.2));
    const omg = 1 + Math.floor(r() * 4);
    const firstTotal = omg * 10 - (r() < 0.2 ? 4 : 0);
    const firstCorrect = Math.round(firstTotal * p);
    const stars = Math.min(3, Math.floor((p > 0.78 ? omg : p > 0.6 ? omg / 2 : 0)));
    const lastAt = NU - Math.floor(r() * (e.skill > 0.6 ? 6 : 40)) * DAG - Math.floor(r() * DAG);
    senast = Math.max(senast, lastAt);
    const aktiv = r() < 0.08;
    const ent = {
      stars, starRounds: [], encouragementPaid: false, activeRoundId: aktiv ? `aktiv-${e.id}-${c.id}` : null,
      activeAnswered: aktiv ? 4 : 0, roundsCompleted: omg - (r() < 0.15 ? 1 : 0), roundsAborted: r() < 0.15 ? 1 : 0,
      firstCorrect, firstTotal, helpBefore: Math.round(firstTotal * (1 - p) * 0.6), helpAfter: Math.round(firstTotal * (1 - p) * 0.4),
      best: Math.min(10, Math.round(p * 10) + 1), last: Math.round(p * 10), lastAt: ts(lastAt),
    };
    challenges[c.id] = ent;
    for (const k of Object.keys(tot)) tot[k] += ent[k];
  }
  const totalStars = Object.values(challenges).reduce((s, x) => s + x.stars, 0);
  return {
    schema: 1, totalStars, mastered: Object.values(challenges).filter((x) => x.stars === 3).length,
    challenges, totals: tot, encouragementCoins: 0, dragon: null, hunts: { count: 0, coins: 0, lastDate: null },
    lastActivityAt: ts(senast),
  };
}

const STATES = new Map(ELEVER.map((e, i) => [e.id, stateFor(e, i)]));
const fake = (v, t = 200) => new Promise((res) => setTimeout(() => res(v), t));

export async function loadClass(ids) {
  return fake(new Map(ids.map((id) => [id, id === "s4" && new URLSearchParams(location.search).has("saknas") ? null : STATES.get(id) ?? {
    schema: 1, totalStars: 0, mastered: 0, challenges: {}, totals: { roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 }, lastActivityAt: null,
  }])));
}

async function bygg(studentId, challengeId, k, ent) {
  const { challenge, tasks } = await demoRound(challengeId, `pv-${studentId}-${challengeId}-${k}`);
  const r = rng(studentId.length * 31 + Number(challengeId) * 7 + k);
  const aktiv = k === 0 && ent.activeRoundId;
  const status = aktiv ? "aktiv" : k === 1 && ent.roundsAborted ? "avbruten" : "avslutad";
  const p = ent.firstTotal ? ent.firstCorrect / ent.firstTotal : 0.5;
  const answers = tasks.map((t, i) => {
    if (aktiv && i >= ent.activeAnswered) return { index: i, first: null, helpBefore: [], helpAfter: [], rework: [], reveal: null };
    const ratt = r() < p;
    const ex = (ratt ? t.key.examples?.right : t.key.examples?.wrong)?.[0] ?? t.key.examples?.right?.[0];
    const g = ex ? gradeDemo(challenge, t, ex) : { status: "graded", correct: ratt };
    const correct = g.status === "graded" ? g.correct : false;
    const hjalp = r() < 0.3 ? ["orientering", ...(r() < 0.5 ? ["princip"] : [])] : [];
    return {
      index: i, first: { answer: ex ?? null, correct, reason: g.reason ?? null, message: g.message ?? null, at: ts(NU) },
      helpBefore: hjalp, helpAfter: correct ? [] : ["modellering"],
      rework: correct || !t.key.examples?.right?.[0] ? [] : [{ answer: t.key.examples.right[0], correct: true, at: ts(NU) }],
      reveal: revealTask(t),
    };
  });
  const startedAt = ms(ent.lastAt) - k * 2 * DAG;
  const correctCount = answers.filter((a) => a.first?.correct).length;
  return {
    schema: 1, roundId: `pv-${studentId}-${challengeId}-${k}`, studentId, challengeId, mode: "elev", version: challenge.version,
    status, tasks: tasks.map(publicTask), answers, answeredCount: answers.filter((a) => a.first).length, correctCount,
    startedAt: ts(startedAt), finishedAt: status === "aktiv" ? null : ts(startedAt + 15 * 60_000),
    reward: status === "avslutad" ? { kind: correctCount >= 8 ? "stjarna" : correctCount >= 6 ? "uppmuntran" : "ingen", starOrdinal: correctCount >= 8 ? 1 : null } : null,
  };
}

export async function listRounds(studentId, { challengeId = null, fran = null, limit = 20 } = {}) {
  const st = STATES.get(studentId);
  if (!st) return fake([]);
  const ids = challengeId ? [challengeId] : Object.keys(st.challenges).reverse().slice(0, 6);
  const ut = [];
  for (const id of ids) {
    const ent = st.challenges[id];
    if (!ent || Number(id) > 35) continue; // 36–50 byggs av G
    const n = Math.min(3, (ent.roundsCompleted || 0) + (ent.roundsAborted || 0) + (ent.activeRoundId ? 1 : 0));
    for (let k = 0; k < n; k++) ut.push(await bygg(studentId, id, k, ent));
  }
  return fake(ut.filter((r) => !fran || ms(r.startedAt) >= fran).sort((a, b) => ms(b.startedAt) - ms(a.startedAt)).slice(0, limit), 300);
}

export async function listStarEvents(studentId) {
  const st = STATES.get(studentId);
  if (!st) return fake([]);
  const ev = [];
  for (const [id, e] of Object.entries(st.challenges)) {
    for (let k = 0; k < e.stars; k++) ev.push({ type: "stjarna", challengeId: id, createdAt: ts(ms(e.lastAt) - (e.stars - k) * 3 * DAG) });
  }
  return fake(ev);
}

const NYCKEL = "pv716-recs";
const lasRecs = () => JSON.parse(sessionStorage.getItem(NYCKEL) || "null") ?? [
  { id: "r1", teacherId: "t1", classId: "6a", studentId: null, challengeIds: ["11", "12", "14"], comment: "Vi tränar likvärdiga bråk den här veckan", active: true, createdAt: ts(NU - 2 * DAG) },
  { id: "r2", teacherId: "t1", classId: null, studentId: "s4", challengeIds: ["02", "07"], comment: null, active: true, createdAt: ts(NU - DAG) },
];
const sparaRecs = (l) => sessionStorage.setItem(NYCKEL, JSON.stringify(l));

export async function listRecs({ classId = null, studentIds = [] } = {}) {
  return fake(lasRecs().filter((r) => r.active && ((classId && r.classId === classId) || studentIds.includes(r.studentId))));
}
export async function createRec(rec) {
  const d = { id: `r${Date.now()}`, ...recDokument(rec, "t1"), createdAt: ts(Date.now()) };
  sparaRecs([d, ...lasRecs()]);
  return fake(d);
}
export async function endRec(id) {
  sparaRecs(lasRecs().map((r) => (r.id === id ? { ...r, active: false } : r)));
  return fake(null);
}
export async function deleteRec(id) {
  sparaRecs(lasRecs().filter((r) => r.id !== id));
  return fake(null);
}

export const API = { loadClass, listRounds, listStarEvents, listRecs, createRec, endRec, deleteRec };
