// ============================================================================
// Guldrushen – historikens och statistikens SIFFROR (#566). Ren logik (ingen
// DOM/Firebase) ur svaren (liveSessions/{sid}/answers, rättade av servern)
// och liveSessions.result (buildResult) – guldrush-history.js ritar dem.
// Testas i test/live-guldrush-historik.test.js.
//
// Varje elev svarar i egen takt på sina egna frågor, så "frågan" är:
//   multiplikation  faktorparet, oberoende av ordning (7 × 8 = 8 × 7)
//   quiz            ögonblicksbildens fråga (answers.q)
// statKeys som spellägets (multiplikation: t7, t8 – per tabell; quiz: svarets
// statKeys som servern kopierade ur frågan).
//
// API
//   questionKey(a)                → "m:7x8" | "q:3" | null (okänt svar)
//   questionStats(answers, { questions?, players? }) → perQuestion[] =
//                                   [{ index, key, text, answered, correct,
//                                   statKeys, byClass{classId: { answered,
//                                   correct }} }] – multiplikation i tabellordning,
//                                   quiz i frågeordning; byClass ur svarets
//                                   classId (eller spelarens)
//   playerAnswerStats(answers)    → Map uid → { answered, correct, wrong[] }
//                                   (wrong = frågornas text, unika, i svarsordning)
//   hardestQuestions(perQuestion, n=3, minAnswers=2) → lägst andel rätt först
//   podiumGroups(ranking)         → [{ rank, players[] }] plats 1–3 med DELAD
//                                   placering, bara elever med guld
//   playerCounts(result)          → Map uid → { correct, incorrect }
//   MAX_QUESTIONS                 tak för perQuestion i result (dokumentets storlek)
// ============================================================================

import { toMs } from "../../live-time.js";

export const MAX_QUESTIONS = 150;
const MULT = "multiplication_0_10";

const rate = (c, n) => (n > 0 ? c / n : null);

export function questionKey(a) {
  if (!a) return null;
  if (a.mode === MULT || (Number.isInteger(a.factorA) && Number.isInteger(a.factorB))) {
    const [x, y] = [a.factorA, a.factorB].sort((p, q) => p - q);
    return Number.isInteger(x) && Number.isInteger(y) ? `m:${x}x${y}` : null;
  }
  return Number.isInteger(a.q) ? `q:${a.q}` : null;
}

function describe(key, a, questions) {
  if (key.startsWith("m:")) {
    const [x, y] = key.slice(2).split("x").map(Number);
    return { order: x * 100 + y, text: `${x} × ${y}`, statKeys: [...new Set([`t${x}`, `t${y}`])] };
  }
  const q = a.q;
  const text = questions?.[q]?.text ?? questions?.[q]?.question ?? "";
  const keys = Array.isArray(a.statKeys) ? a.statKeys : questions?.[q]?.statKeys;
  return {
    order: q, text: String(text || `Fråga ${q + 1}`).slice(0, 200),
    statKeys: (Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string"),
  };
}

export function questionStats(answers, { questions = null, players = [] } = {}) {
  const classOf = new Map((players || []).map((p) => [p.uid, p.classId]));
  const by = new Map();
  for (const a of answers || []) {
    const key = questionKey(a);
    if (!key || typeof a.isCorrect !== "boolean") continue;
    let row = by.get(key);
    if (!row) {
      row = { key, ...describe(key, a, questions), answered: 0, correct: 0, byClass: {} };
      by.set(key, row);
    }
    row.answered++;
    if (a.isCorrect) row.correct++;
    const c = a.classId ?? classOf.get(a.uid);
    if (c) {
      const b = (row.byClass[c] ||= { answered: 0, correct: 0 });
      b.answered++;
      if (a.isCorrect) b.correct++;
    }
  }
  return [...by.values()].sort((a, b) => a.order - b.order).slice(0, MAX_QUESTIONS)
    .map(({ order, ...r }, index) => ({ index, ...r }));
}

export function playerAnswerStats(answers) {
  const out = new Map();
  const list = [...(answers || [])].sort((a, b) => (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0));
  for (const a of list) {
    const key = questionKey(a);
    if (!a?.uid || !key || typeof a.isCorrect !== "boolean") continue;
    const r = out.get(a.uid) || { answered: 0, correct: 0, wrong: [] };
    r.answered++;
    if (a.isCorrect) r.correct++;
    else {
      const t = describe(key, a, null).text;
      if (!r.wrong.includes(t)) r.wrong.push(t);
    }
    out.set(a.uid, r);
  }
  return out;
}

export function hardestQuestions(perQuestion, n = 3, minAnswers = 2) {
  return (perQuestion || []).filter((q) => q.answered >= minAnswers && q.correct < q.answered)
    .map((q) => ({ ...q, rate: rate(q.correct, q.answered) }))
    .sort((a, b) => a.rate - b.rate || b.answered - a.answered || a.index - b.index).slice(0, n);
}

export function podiumGroups(ranking) {
  const groups = [];
  for (const p of ranking || []) {
    if (!(p.gold > 0) || p.rank > 3) continue;
    const g = groups.find((x) => x.rank === p.rank);
    if (g) g.players.push(p);
    else groups.push({ rank: p.rank, players: [p] });
  }
  return groups.sort((a, b) => a.rank - b.rank);
}

export function playerCounts(result) {
  const out = new Map();
  for (const p of result?.ranking || []) {
    const correct = p.correct || 0;
    out.set(p.uid, { correct, incorrect: Math.max(0, (p.answered ?? correct) - correct) });
  }
  return out;
}
