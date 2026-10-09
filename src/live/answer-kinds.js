// ============================================================================
// Live – svarskomponent per svarssätt (#551, epic #550)
// ----------------------------------------------------------------------------
// Elevsidan (och nya format) väljer HUR eleven svarar ur sessionens
// answerKind (answerKindOf(session), saknas = "free"):
//   "free"   ✍️ skriv själv – src/mult/fast-answer.js (som före #551)
//   "choice" 🔘 flerval – fyra alternativknappar. Komponenten byggs i issue B
//            (#552) och kopplas in i COMPONENTS nedan; tills dess finns den
//            inte och elevsidan visar "ladda om" i stället för att krascha.
//
// KOMPONENT-KONTRAKTET (samma som mountFastAnswer, så elevsidan är generisk):
//   mount(root, opts) → handle
//     opts: { source, check, onAnswer, inputMode?, enabled?, idleText? }
//       source.next() → fråga; för "choice" med q.options (4 alternativ,
//       se game-modes.js "SVARSSÄTTET choice")
//       check(q, raw) → { valid, correct, correctAnswer, … } – raw = text
//       (free) resp. knappens index 0–3 (choice)
//       onAnswer(attempt) EN gång per fråga: { attemptId, seq, question,
//       raw, result, answeredAt } – för choice bär result choiceIndex
//   handle: setEnabled(bool, idleText?), destroy(), focus?(),
//           pauseFocus?() / resumeFocus?()
//
// API
//   hasAnswerComponent(kind)  → bool – finns komponenten i den här versionen?
//   loadAnswerComponent(kind) → Promise<mount> – kastar för okänt/saknat
// ============================================================================

import { mountFastAnswer } from "../mult/fast-answer.js";

// Flerval (#552): lägg till t.ex.
//   choice: () => import("./choice-answer.js").then((m) => m.mountChoiceAnswer),
// (dynamisk import – inte i den boot-kritiska kedjan, #271).
const COMPONENTS = {
  free: async () => mountFastAnswer,
};

/** Finns en svarskomponent för svarssättet i den här versionen? */
export function hasAnswerComponent(kind) {
  return Object.hasOwn(COMPONENTS, kind);
}

/** Svarssättets mount-funktion (laddas latt för allt utom skriv själv). */
export async function loadAnswerComponent(kind) {
  if (!hasAnswerComponent(kind)) throw new Error(`Live: ingen svarskomponent för svarssättet ${kind}`);
  return COMPONENTS[kind]();
}
