// ============================================================================
// Bråkresan – generatorgranskning (src/brakresan/schema/granskning.js) · #706
// ----------------------------------------------------------------------------
// Spec §15 "Generatorgranskning för alla 50": minst 200 deterministiska
// granskningsexempel per utmaning. reviewChallenge kör dem och kontrollerar det
// som går att kontrollera GENERELLT; varje utmaning lägger sina egna
// matematiska kontroller (tillåtna tal, unik trippel, representationens andel …)
// i sitt eget test. Används av test/brakresan-generatorer.test.js för ALLA
// byggda utmaningar, så E/F/G (#710–#712) får kontrollen gratis.
//
// Per exempel (seed "granskning-NN-i", slot i tur och ordning):
//   1. generate är deterministisk (samma seed → samma params)
//   2. build är deterministisk och params tål JSON (sparas i Firestore)
//   3. uppgiften följer schemat (validateTask)
//   4. alla key.examples.right bedöms RÄTT och alla .wrong bedöms FEL
//      (status "graded" – ett felexempel får inte vara ett inmatningsfel)
//   5. publicTask saknar facit (key, feedback, review, params, values, core)
// Över alla exempel: minst MIN_VARIANTS olika kärnor. Reservbanken byggs och
// valideras, och planRound ger tio olika kärnor för 20 seeds.
// ============================================================================

import { createRng } from "./prng.js";
import { buildTask, gradeTask, coreOf, MIN_VARIANTS, MIN_RESERVE, REVIEW_SAMPLES, ROUND_SIZE } from "./kontrakt.js";
import { publicTask } from "./uppgift.js";
import { planRound } from "./omgangsplan.js";

const SECRET = ["key", "feedback", "review", "params", "values", "core"];

/**
 * @returns {{ id, samples, distinctCores, problems: string[] }} – problems tom = godkänd
 */
export function reviewChallenge(challenge, { samples = REVIEW_SAMPLES, plans = 20, minVariants = MIN_VARIANTS } = {}) {
  const problems = [];
  const cores = new Set();
  const note = (seed, msg) => {
    if (problems.length < 50) problems.push(`${challenge.id} [${seed}]: ${msg}`);
  };
  for (let i = 0; i < samples; i++) {
    const seed = `granskning-${challenge.id}-${i}`;
    const index = i % ROUND_SIZE;
    const slot = challenge.slots[index];
    let task;
    try {
      const params = challenge.generate(createRng(seed), { slot, index });
      const again = challenge.generate(createRng(seed), { slot, index });
      if (JSON.stringify(params) !== JSON.stringify(again)) note(seed, "generate är inte deterministisk");
      const stored = JSON.parse(JSON.stringify(params));
      task = buildTask(challenge, params, { index, role: slot });
      const rebuilt = buildTask(challenge, stored, { index, role: slot });
      if (JSON.stringify(task) !== JSON.stringify(rebuilt)) note(seed, "build ger annan uppgift ur sparade params");
      if (coreOf(challenge, params) !== task.core) note(seed, "core(params) ≠ build(params).core");
    } catch (err) {
      note(seed, err.message);
      continue;
    }
    cores.add(task.core);
    for (const a of task.key.examples.right) {
      const r = gradeTask(challenge, task, a);
      if (r.status !== "graded" || !r.correct) note(seed, `rätt exempel underkänt: ${JSON.stringify(a)} → ${r.status}/${r.message ?? r.reason}`);
    }
    for (const a of task.key.examples.wrong) {
      const r = gradeTask(challenge, task, a);
      if (r.status !== "graded") note(seed, `fel exempel blev inmatningsfel: ${JSON.stringify(a)}`);
      else if (r.correct) note(seed, `fel exempel godkänt: ${JSON.stringify(a)}`);
    }
    const pub = publicTask(task);
    for (const k of SECRET) if (k in pub) note(seed, `publicTask läcker ${k}`);
  }
  if (cores.size < minVariants) problems.push(`${challenge.id}: bara ${cores.size} olika kärnor på ${samples} exempel (minst ${minVariants})`);

  if (!Array.isArray(challenge.reserve) || challenge.reserve.length < MIN_RESERVE) {
    problems.push(`${challenge.id}: reservbanken har färre än ${MIN_RESERVE} uppgifter`);
  } else {
    challenge.reserve.forEach((r, i) => {
      try {
        buildTask(challenge, r.params, { index: 0, role: r.slot ?? null });
      } catch (err) {
        note(`reserv-${i}`, err.message);
      }
    });
  }

  for (let i = 0; i < plans; i++) {
    const seed = `plan-${challenge.id}-${i}`;
    try {
      const plan = planRound(challenge, { seed });
      if (new Set(plan.entries.map((e) => e.core)).size !== ROUND_SIZE) note(seed, "omgången har en semantisk dubblett");
    } catch (err) {
      note(seed, err.message);
    }
  }
  return { id: challenge.id, samples, distinctCores: cores.size, problems };
}
