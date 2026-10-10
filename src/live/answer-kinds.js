// ============================================================================
// Live – svarskomponent per svarssätt (#551, epic #550)
// ----------------------------------------------------------------------------
// Elevsidan (och nya format) väljer HUR eleven svarar ur sessionens
// answerKind (answerKindOf(session), saknas = "free"):
//   "free"   ✍️ skriv själv – src/mult/fast-answer.js (som före #551)
//   "choice" 🔘 flerval – src/live/choice-flow.js: spelläget + fyra
//            knappar (src/live/choice-answer.js, #552). Laddas latt.
// Ett svarssätt som saknas här (nyare klient) → elevsidan visar "ladda om".
//
// KOMPONENT-KONTRAKTET (samma som mountFastAnswer, så elevsidan är generisk):
//   mount(root, opts) → handle
//     opts: { source, check, choices?, onAnswer, inputMode?, enabled?, idleText? }
//       source.next() → fråga, check(q, raw) → { valid, correct, correctAnswer }
//       – SAMMA rättning för båda (choice: raw = valt alternativs värde).
//       choices(q) → { options, answerIndex } (bara choice, game-modes.js)
//       onAnswer(attempt) EN gång per fråga: { attemptId, seq, question,
//       raw, result, answeredAt } – choice dessutom choiceIndex (0–3)
//   handle: setEnabled(bool, idleText?), destroy(), focus?(),
//           pauseFocus?() / resumeFocus?()
//
// API
//   hasAnswerComponent(kind)  → bool – finns komponenten i den här versionen?
//   loadAnswerComponent(kind) → Promise<mount> – kastar för okänt/saknat
// ============================================================================

import { mountFastAnswer } from "../mult/fast-answer.js";

// Nytt svarssätt = en rad här (dynamisk import – inte i bootkedjan, #271).
const COMPONENTS = {
  free: async () => mountFastAnswer,
  choice: () => import("./choice-flow.js").then((m) => m.mountChoiceFlow),
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
