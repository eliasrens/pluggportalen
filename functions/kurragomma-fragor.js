// ============================================================================
// Kurragömma på SERVERN – perQuestion ur ett AGGREGAT (functions/kurragomma-fragor.js, #842)
// ----------------------------------------------------------------------------
// Kvoten (§5.5, slut-QA §2.1 förslag b): kgAvsluta läste alla answers (~1 500
// läsningar per match) bara för result.perQuestion. Nu räknar kgSvara per fråga
// i elevens EGET kgPlayers-dokument – i samma transaktion och samma update som
// poängen – och kgAvsluta bygger perQuestion ur de kgPlayers det ändå läser.
// Räknarna ligger per elev (ingen "het" delad räknare: 25 elever × ett svar
// var 8:e s på ett enda dokument hade gett transaktionskrockar), och bara
// servern skriver kgPlayers (firestore.rules). answers/{attemptId} skrivs
// fortfarande (tx.create = idempotensen, kistspelens statistik) men läses inte.
//
//   kgPlayers/{uid}.fragor = { [fält]: { a: besvarade, r: rätt } }
//     fält = "m3x4" (multiplikation, faktorerna sorterade) | "q7" (quizfråga 7)
//     – Firestore-fältnamn utan punkt/kolon så "fragor.m3x4.a" går att öka
//       med FieldValue.increment i en update.
//
//   fragaFalt(a)                 → "m3x4" | "q7" | null (a = graded svar med factorA/factorB eller q)
//   fragaUrFalt(falt)            → { factorA, factorB } | { q } | null (omvändningen)
//   fragorOkning(graded, FieldValue) → fälten till kgPlayers-update (tomt objekt utan nyckel)
//   fragestatistikUrSpelare(spelare, questions) → perQuestion, EXAKT samma form och
//     ordning som meteorstorm-resultat.js fragestatistik(answers, questions) gav:
//     [{ index, key, text, statKeys, answered, correct, byClass: { classId: { answered, correct } } }]
//     (test/live-kurragomma-842.test.js jämför de två på slumpade svar)
// ============================================================================

import { questionKey, describe, MAX_QUESTIONS } from "./meteorstorm-resultat.js";

export function fragaFalt(a) {
  const key = questionKey(a);
  return key ? key.replace(/[:]/g, "") : null;
}

export function fragaUrFalt(falt) {
  const m = /^m(\d+)x(\d+)$/.exec(String(falt || ""));
  if (m) return { factorA: Number(m[1]), factorB: Number(m[2]) };
  const q = /^q(\d+)$/.exec(String(falt || ""));
  return q ? { q: Number(q[1]) } : null;
}

/** Fälten som ökar räknarna i kgSvaras kgPlayers-update. */
export function fragorOkning(graded, FieldValue) {
  const falt = fragaFalt(graded);
  if (!falt) return {};
  return { [`fragor.${falt}.a`]: FieldValue.increment(1), [`fragor.${falt}.r`]: FieldValue.increment(graded.isCorrect ? 1 : 0) };
}

export function fragestatistikUrSpelare(spelare, questions) {
  const by = new Map();
  for (const p of spelare) {
    for (const [falt, v] of Object.entries(p?.fragor || {})) {
      const a = fragaUrFalt(falt);
      const key = a && questionKey(a);
      if (!key) continue;
      let row = by.get(key);
      if (!row) by.set(key, (row = { key, ...describe(key, a, questions), answered: 0, correct: 0, byClass: {} }));
      const n = Math.max(0, v?.a | 0);
      const r = Math.max(0, Math.min(n, v?.r | 0));
      row.answered += n;
      row.correct += r;
      const b = (row.byClass[p.classId] ||= { answered: 0, correct: 0 });
      b.answered += n;
      b.correct += r;
    }
  }
  return [...by.values()].sort((a, b) => a.order - b.order).slice(0, MAX_QUESTIONS)
    .map(({ order, ...r }, index) => ({ index, ...r }));
}
