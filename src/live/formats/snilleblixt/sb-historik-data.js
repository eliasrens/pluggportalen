// ============================================================================
// Snilleblixten – historikens och statistikens SIFFROR (#560). Ren logik
// (ingen DOM/Firebase) ur liveSessions.result (buildResult) och sbScores –
// snilleblixt-history.js ritar dem. Testas i test/live-snilleblixt-historik.test.js.
//
// API
//   rate(correct, answered)       → 0..1 | null (inga svar)
//   questionRates(result)         → [{ index, nr, text, answered, correct, rate,
//                                   skipped, statKeys }] i frågeordning
//   hardestQuestions(result, n=3) → de n frågor klassen hade svårast för
//                                   (lägst andel rätt, minst ett svar, ej hoppade)
//   categoryRates(perQuestions, categories, { classId? }) → [{ key, label,
//                                   answered, correct, rate }] – per spellägets
//                                   statKeys (multiplikation: per tabell); bara
//                                   kategorier med svar. classId = bara klassens
//                                   svar (perQuestion.byClass)
//   podiumGroups(ranking)         → [{ rank, players[] }] plats 1–3 med DELAD
//                                   placering, bara elever med poäng
//   playerCounts(result)          → Map uid → { correct, incorrect }
//   answerMatrix(ranking, scores) → [{ uid, name, cells: ("ratt"|"fel"|"inget"|
//                                   "hoppad")[] }] – per elev och fråga
// ============================================================================

export function rate(correct, answered) {
  return answered > 0 ? correct / answered : null;
}

export function questionRates(result) {
  return (result?.perQuestion || []).map((q) => ({
    index: q.index, nr: q.index + 1, text: q.text || "", answered: q.answered || 0, correct: q.correct || 0,
    rate: q.skipped ? null : rate(q.correct || 0, q.answered || 0), skipped: !!q.skipped, statKeys: q.statKeys || [],
  }));
}

export function hardestQuestions(result, n = 3) {
  return questionRates(result).filter((q) => q.rate != null)
    .sort((a, b) => a.rate - b.rate || b.answered - a.answered || a.index - b.index).slice(0, n);
}

export function categoryRates(perQuestions, categories = [], { classId = null } = {}) {
  const sum = new Map();
  for (const q of perQuestions || []) {
    if (!q || q.skipped) continue;
    const src = classId ? q.byClass?.[classId] : q;
    if (!src || !(src.answered > 0)) continue;
    for (const key of new Set(q.statKeys || [])) {
      const row = sum.get(key) || { answered: 0, correct: 0 };
      row.answered += src.answered;
      row.correct += src.correct || 0;
      sum.set(key, row);
    }
  }
  return (categories || []).filter((c) => sum.has(c.key)).map((c) => {
    const r = sum.get(c.key);
    return { key: c.key, label: c.label, answered: r.answered, correct: r.correct, rate: rate(r.correct, r.answered) };
  });
}

export function podiumGroups(ranking) {
  const groups = [];
  for (const p of ranking || []) {
    if (!(p.points > 0) || p.rank > 3) continue;
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

export function answerMatrix(ranking, scores) {
  const qs = [...(scores || [])].sort((a, b) => a.index - b.index);
  return (ranking || []).map((p) => ({
    uid: p.uid,
    name: p.name,
    cells: qs.map((sc) => {
      if (sc.skipped) return "hoppad";
      if (!(p.uid in (sc.correct || {}))) return "inget";
      return sc.correct[p.uid] ? "ratt" : "fel";
    }),
  }));
}
