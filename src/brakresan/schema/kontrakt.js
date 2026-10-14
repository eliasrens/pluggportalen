// ============================================================================
// Bråkresan – generatorkontraktet (src/brakresan/schema/kontrakt.js) · #706
// ----------------------------------------------------------------------------
// Spec §6 "Genereringskontrakt". Varje utmaning är EN fil ../utmaningar/uNN.js
// som default-exporterar defineChallenge({...}):
//
//   id            "03" (måste finnas i katalog.js)
//   version       generatorversion, heltal ≥ 1. HÖJ den när uppgifterna ändras –
//                 sparade omgångar bär sin version och sina byggda uppgifter, så
//                 en gammal aktiv omgång rättas med sina ursprungliga regler.
//   slots         valfri: tio slot-namn (standard DEFAULT_SLOTS = 3 intro,
//                 4 normal, 3 överföring). Katalogens egna blandningar (t.ex.
//                 10: "fyra bild, tre målning, tre tal") skrivs som egna slots.
//   generate(rng, { slot, index }) → params
//                 Ren JSON. Får BARA använda rng (prng.js). Samma rng-följd →
//                 samma params.
//   build(params) → { core, prompt, values, view, answer, key, help,
//                     misconceptions, feedback, review }
//                 REN funktion av params (inget rng, ingen klocka): samma params
//                 ger samma problem, bild, facit och förklaring (§6). Se
//                 uppgift.js för fälten och bedomning.js för answer/key.
//   core(params)  valfri snabbväg till build(params).core (dubblettkontroll)
//   validate(task, answer)  valfri egen bedömning (standard: gradeAnswer)
//   reserve       ≥ 10 validerade { slot?, params } – reservbanken när
//                 generatorn inte hittar en ny kärna inom MAX_TRIES (§6)
//
// En utmaning som ännu inte byggts är stubChallenge("NN") (implemented: false).
// Servern vägrar starta omgångar för stubbar; generatorgranskningen
// (granskning.js, test/brakresan-generatorer.test.js) körs för alla som är byggda.
// ============================================================================

import { challengeMeta } from "./katalog.js";
import { gradeAnswer } from "./bedomning.js";
import { TASK_SCHEMA, validateTask } from "./uppgift.js";
import { ROUND_SIZE } from "./regler.js";

export { ROUND_SIZE };
export const DEFAULT_SLOTS = Object.freeze(["intro", "intro", "intro", "normal", "normal", "normal", "normal",
  "overforing", "overforing", "overforing"]);
/** §6: minst 60 meningsfulla varianter per utmaning. */
export const MIN_VARIANTS = 60;
/** Reservbankens minsta storlek. */
export const MIN_RESERVE = 10;
/** §15: minst 200 deterministiska granskningsexempel per utmaning. */
export const REVIEW_SAMPLES = 200;

export class ContractError extends Error {
  constructor(id, problems) {
    super(`Bråkresan ${id}: ${[].concat(problems).join("; ")}`);
    this.name = "ContractError";
    this.problems = [].concat(problems);
  }
}

/** En byggd utmaning. Kastar ContractError om kontraktet inte följs. */
export function defineChallenge(def) {
  const p = [];
  const meta = challengeMeta(def?.id);
  if (!meta) throw new ContractError(String(def?.id), "okänt id");
  if (!Number.isSafeInteger(def.version) || def.version < 1) p.push("version måste vara ett heltal ≥ 1");
  if (typeof def.generate !== "function") p.push("generate saknas");
  if (typeof def.build !== "function") p.push("build saknas");
  if (def.validate !== undefined && typeof def.validate !== "function") p.push("validate måste vara en funktion");
  if (def.core !== undefined && typeof def.core !== "function") p.push("core måste vara en funktion");
  const slots = def.slots ?? DEFAULT_SLOTS;
  if (!Array.isArray(slots) || slots.length !== ROUND_SIZE || slots.some((s) => typeof s !== "string")) {
    p.push(`slots måste vara ${ROUND_SIZE} namn`);
  }
  if (!Array.isArray(def.reserve) || def.reserve.length < MIN_RESERVE ||
      def.reserve.some((r) => !r || typeof r.params !== "object")) {
    p.push(`reserve måste ha minst ${MIN_RESERVE} { params }`);
  }
  if (p.length) throw new ContractError(def.id, p);
  return Object.freeze({ ...def, name: meta.name, slots: Object.freeze([...slots]), implemented: true });
}

/** Platshållare för en utmaning som en senare sub-issue bygger. */
export function stubChallenge(id) {
  const meta = challengeMeta(id);
  if (!meta) throw new ContractError(String(id), "okänt id");
  return Object.freeze({ id, name: meta.name, version: 0, implemented: false });
}

/** Kärnan för params (dubblettkontroll) – core() om den finns, annars build().core. */
export function coreOf(challenge, params) {
  return challenge.core ? challenge.core(params) : challenge.build(params).core;
}

/**
 * Bygg en hel uppgift ur params. Kastar ContractError om resultatet bryter mot
 * uppgiftsschemat. `id` sätts av servern ("<roundId>-<index>").
 */
export function buildTask(challenge, params, { index = 0, role = null, id = null } = {}) {
  if (!challenge?.implemented) throw new ContractError(challenge?.id ?? "?", "utmaningen är inte byggd ännu");
  const body = challenge.build(params);
  const task = {
    schema: TASK_SCHEMA,
    id: id ?? `demo-${challenge.id}-${index}`,
    challengeId: challenge.id,
    version: challenge.version,
    index,
    role: role ?? challenge.slots[index] ?? null,
    params,
    ...body,
  };
  const problems = validateTask(task);
  if (problems.length) throw new ContractError(challenge.id, problems);
  return task;
}

/** Bedöm ett svar på en byggd uppgift (betrodd miljö). */
export function gradeTask(challenge, task, answer) {
  return (challenge.validate ?? gradeAnswer)(task, answer);
}
