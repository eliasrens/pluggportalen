// ============================================================================
// Bråkresan – demonstrationsläget (src/brakresan/demo.js) · #708
// ----------------------------------------------------------------------------
// "Prova ett exempel" (eleven, §5) och lärarens testläge (§12) körs HELT i
// klienten: samma generator, omgångsplan och bedömning som servern, men med en
// lokal seed och utan ett enda anrop eller skrivning. Därför kan demo/test
// aldrig ändra statistik, stjärnor, mynt, drake eller jakt – och lärarkonton
// nekas dessutom av callables (functions/index.js).
//
//   demoRound(challengeId, seed?)  → { challenge, seed, tasks }  tio HELA uppgifter
//                                    (med key – läraren ser facit och hjälp)
//   exampleTask(challengeId, seed?) → { challenge, task }        en uppgift
//   gradeDemo(challenge, task, answer) → bedomning.js-resultat + reveal när bedömd
//   publicTask(task)                 → det eleven ser före "Kontrollera"
// Inga Firebase-importer: testas i Node (test/brakresan-demo.test.js).
// ============================================================================

import { loadChallenge } from "./utmaningar/index.js";
import { buildTask, gradeTask } from "./schema/kontrakt.js";
import { planRound } from "./schema/omgangsplan.js";
import { publicTask, revealTask } from "./schema/uppgift.js";

export { publicTask };

const localSeed = () => `demo-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

async function built(challengeId) {
  const challenge = await loadChallenge(challengeId);
  if (!challenge?.implemented) throw new Error("Den här utmaningen är inte klar ännu.");
  return challenge;
}

export async function demoRound(challengeId, seed = localSeed()) {
  const challenge = await built(challengeId);
  const plan = planRound(challenge, { seed });
  const tasks = plan.entries.map((e) => buildTask(challenge, e.params, { index: e.index, role: e.role, id: `demo-${seed}-${e.index}` }));
  return { challenge, seed, tasks };
}

/** En uppgift ur en "normal"-slot (inte den lättaste) – för "Prova ett exempel". */
export async function exampleTask(challengeId, seed = localSeed()) {
  const { challenge, tasks } = await demoRound(challengeId, seed);
  return { challenge, task: tasks.find((t) => t.role === "normal") || tasks[0] };
}

export function gradeDemo(challenge, task, answer) {
  const g = gradeTask(challenge, task, answer);
  return g.status === "graded" ? { ...g, reveal: revealTask(task) } : g;
}
