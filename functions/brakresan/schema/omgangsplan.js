// ============================================================================
// Bråkresan – omgångsplanen (src/brakresan/schema/omgangsplan.js) · #706
// ----------------------------------------------------------------------------
// Spec §6: "Skapa de tio uppgifterna när omgången börjar och lagra deras
// identitet." planRound väljer tio params ur utmaningens generator:
//   • en uppgift per slot (3 intro, 4 normal, 3 överföring eller utmaningens egna)
//   • tio OLIKA semantiska kärnor inom omgången – alltid
//   • undvik kärnor ur elevens tidigare omgångar (avoidCores) så långt det går:
//     första halvan av försöken är strikta, andra halvan släpper avoidCores
//     (men aldrig dubbletter inom omgången)
//   • BEGRÄNSAT antal försök (MAX_TRIES per slot), sedan reservbanken
//     (challenge.reserve) – aldrig en oändlig genereringsloop. Räcker inte ens
//     reserven kastas PlanError (servern svarar då ett sakligt fel).
// Deterministiskt: samma utmaning, version, seed och avoidCores → samma plan.
// Servern väljer seeden (node:crypto) och sparar planen; klienten kan aldrig
// begära en egen seed för en elevomgång.
// ============================================================================

import { createRng } from "./prng.js";
import { coreOf, ROUND_SIZE } from "./kontrakt.js";

export const MAX_TRIES = 60;

export class PlanError extends Error {
  constructor(id, slot) {
    super(`Bråkresan ${id}: hittade ingen ny uppgift för slot ${slot} (generator + reservbank slut)`);
    this.name = "PlanError";
  }
}

/**
 * @param {object} challenge  defineChallenge-objekt
 * @param {{ seed: string, avoidCores?: string[] }} opts
 * @returns {{ challengeId, version, seed, entries: Array<{ index, role, params, core, source, relaxed }> }}
 *   source = "generator" | "reserv"; relaxed = true om en tidigare kärna fick återkomma.
 */
export function planRound(challenge, { seed, avoidCores = [] } = {}) {
  if (!challenge?.implemented) throw new PlanError(challenge?.id ?? "?", "-");
  if (typeof seed !== "string" || !seed) throw new TypeError("Bråkresan: planRound kräver en seed");
  const avoid = new Set(avoidCores);
  const used = new Set();
  const entries = [];
  for (let index = 0; index < ROUND_SIZE; index++) {
    const slot = challenge.slots[index];
    const rng = createRng(`${seed}#${index}`);
    let pick = null;
    for (let t = 0; t < MAX_TRIES && !pick; t++) {
      const params = challenge.generate(rng, { slot, index });
      const core = coreOf(challenge, params);
      if (used.has(core)) continue;
      const strict = t < MAX_TRIES / 2;
      if (strict && avoid.has(core)) continue;
      pick = { params, core, source: "generator", relaxed: avoid.has(core) };
    }
    if (!pick) {
      const candidates = challenge.reserve
        .filter((r) => !r.slot || r.slot === slot)
        .map((r) => ({ params: r.params, core: coreOf(challenge, r.params) }))
        .filter((r) => !used.has(r.core));
      const fresh = candidates.filter((r) => !avoid.has(r.core));
      const pool = fresh.length ? fresh : candidates;
      if (!pool.length) throw new PlanError(challenge.id, slot);
      const r = pool[Math.floor(rng() * pool.length)];
      pick = { params: r.params, core: r.core, source: "reserv", relaxed: avoid.has(r.core) };
    }
    used.add(pick.core);
    entries.push({ index, role: slot, ...pick });
  }
  return { challengeId: challenge.id, version: challenge.version, seed, entries };
}
