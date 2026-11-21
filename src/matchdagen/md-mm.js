// ============================================================================
// Matchdagen → Mattematchen (#879): ett svar på en tabellfråga (md-kallor.js
// tabellKalla) som Mattematchens svar. Ren modul – inga Firebase-importer; själva
// skrivningen gör md-data.js mmRaknaIn (src/tavling/mm-live.js).
//
//   mmSvar(fraga, svar) → { record, isCorrect } | null
//     record = Live-lägets answerRecord { factorA, factorB, answer, correctAnswer }
//     (fälten firestore.rules prövar). null = inte en tabellfråga, ogiltigt svar
//     eller en faktor utanför 0–10 (multiplication_0_10) – det räknas inte.
//     svar = index (flerval, heltal) eller text (skriv själv), som visaFraga ger rattaFraga.
// Laddas bara med import() – aldrig i bootgrafen (#271).
// ============================================================================

import MULTIPLICATION_0_10 from "../live/modes/multiplication-0-10.js";

const faktor = (t) => Number.isInteger(t) && t >= 0 && t <= 10;

export function mmSvar(fraga, svar) {
  const q = fraga?.kallTyp === "tabell" ? fraga.data?.q : null;
  if (!q || !faktor(q.a) || !faktor(q.b)) return null;
  const i = svar == null || svar === "" ? NaN : Number(svar); // som rattaFraga: "2" är alternativ 2
  const raw = fraga.typ !== "flerval" ? svar : Number.isInteger(i) ? fraga.data.options?.[i] : null;
  if (raw == null) return null;
  const r = MULTIPLICATION_0_10.checkAnswer(q, String(raw));
  return r.valid ? { record: MULTIPLICATION_0_10.answerRecord(q, r), isCorrect: r.correct } : null;
}
