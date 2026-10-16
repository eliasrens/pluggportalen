#!/usr/bin/env node
// ============================================================================
// Bråkresan – generatorgranskning per utmaning (admin/qa-brakresan-generatorer.mjs) · #709
// ----------------------------------------------------------------------------
// Spec §15 "Generatorgranskning för alla 50". Kör för varje BYGGD utmaning:
//   1. den generella granskningen (src/brakresan/schema/granskning.js):
//      200 deterministiska exempel, schema, rätt/fel-exempel, facitläckor i
//      hjälpen, publicTask utan facit, ≥ 60 kärnor, reservbanken
//   2. utmaningens EGNA matematikkontroller: admin/qa-brakresan/uNN.mjs
//      (tillåtna tal, facit, alternativa rätta svar, unikhet,
//      missuppfattningsalternativ, representationens andel …) – samma 200
//      exempel, en uppgift i taget, plus `plan(plans)` över hela omgångar
//   3. omgångarna: 100 planer utan semantiska dubbletter, och tre omgångar
//      i följd (avoidCores) – hur ofta en tidigare kärna måste återkomma
//
// E/F/G (#710–#712): lägg admin/qa-brakresan/uNN.mjs för era utmaningar –
//   export function audit(task, { challenge, grade }) → string[]   (per uppgift)
//   export function plan(plans, { challenge }) → string[]          (valfri, hela omgångar)
// Testerna (test/brakresan-utmaningar-d.test.js m.fl.) kör samma kontroller.
//
//   node admin/qa-brakresan-generatorer.mjs              alla byggda
//   node admin/qa-brakresan-generatorer.mjs 03 12        bara dessa
//   node admin/qa-brakresan-generatorer.mjs 19 --visa 3  + skriv ut 3 uppgifter
// Avslutar med kod 1 om något problem hittas.
// ============================================================================

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadChallenge } from "../src/brakresan/utmaningar/index.js";
import { CHALLENGE_IDS } from "../src/brakresan/schema/katalog.js";
import { reviewChallenge } from "../src/brakresan/schema/granskning.js";
import { createRng } from "../src/brakresan/schema/prng.js";
import { buildTask, gradeTask, REVIEW_SAMPLES, ROUND_SIZE } from "../src/brakresan/schema/kontrakt.js";
import { planRound } from "../src/brakresan/schema/omgangsplan.js";

const AUDIT_DIR = new URL("./qa-brakresan/", import.meta.url);
const PLANS = 100;

/** Utmaningens egna kontroller, eller null om filen saknas. */
export async function loadAudit(id) {
  const url = new URL(`u${id}.mjs`, AUDIT_DIR);
  return existsSync(fileURLToPath(url)) ? import(url.href) : null;
}

/** Samma 200 exempel som granskning.js (seed "granskning-NN-i"). */
export function samples(challenge, n = REVIEW_SAMPLES) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const index = i % ROUND_SIZE;
    const slot = challenge.slots[index];
    const params = challenge.generate(createRng(`granskning-${challenge.id}-${i}`), { slot, index });
    out.push(buildTask(challenge, params, { index, role: slot }));
  }
  return out;
}

/** Hela omgångar för plan-kontrollerna: [[task × 10] …]. */
export function plans(challenge, n = PLANS) {
  return Array.from({ length: n }, (_, i) => planRound(challenge, { seed: `qa-plan-${challenge.id}-${i}` }).entries
    .map((e) => buildTask(challenge, e.params, { index: e.index, role: e.role })));
}

/** Tre omgångar i följd där varje ny undviker de tidigare kärnorna (servern: AVOID_ROUNDS = 3). */
function serie(challenge, seed) {
  const avoid = [];
  let relaxed = 0;
  for (let r = 0; r < 3; r++) {
    const plan = planRound(challenge, { seed: `${seed}-${r}`, avoidCores: [...avoid] });
    relaxed += plan.entries.filter((e) => e.relaxed).length;
    avoid.push(...plan.entries.map((e) => e.core));
  }
  return relaxed;
}

/**
 * Granska en utmaning. Svarar { id, name, samples, distinctCores, problems, relaxedPerSerie, audited }.
 */
export async function auditChallenge(challenge) {
  const base = reviewChallenge(challenge);
  const problems = [...base.problems];
  const mod = await loadAudit(challenge.id);
  const grade = (task, answer) => gradeTask(challenge, task, answer);
  const note = (msgs, where) => {
    for (const m of msgs || []) if (problems.length < 80) problems.push(`${challenge.id} [${where}]: ${m}`);
  };
  if (mod?.audit) {
    samples(challenge).forEach((task, i) => note(mod.audit(task, { challenge, grade }), `exempel ${i}`));
  }
  const omgangar = plans(challenge);
  omgangar.forEach((tasks, i) => {
    if (new Set(tasks.map((t) => t.core)).size !== ROUND_SIZE) note(["semantisk dubblett i omgången"], `plan ${i}`);
  });
  if (mod?.plan) note(mod.plan(omgangar, { challenge, grade }), "planer");
  const relaxed = Array.from({ length: 10 }, (_, i) => serie(challenge, `qa-serie-${challenge.id}-${i}`));
  return {
    id: challenge.id, name: challenge.name, samples: base.samples, distinctCores: base.distinctCores, problems,
    relaxedPerSerie: relaxed.reduce((a, b) => a + b, 0) / relaxed.length, audited: !!mod?.audit,
  };
}

async function main(argv) {
  const visa = argv.includes("--visa") ? Number(argv[argv.indexOf("--visa") + 1]) || 2 : 0;
  const ids = argv.filter((a, i) => /^\d\d$/.test(a) && argv[i - 1] !== "--visa");
  let fel = 0;
  for (const id of ids.length ? ids : CHALLENGE_IDS) {
    const ch = await loadChallenge(id);
    if (!ch.implemented) {
      if (ids.length) console.log(`${id} ${ch.name}: inte byggd ännu`);
      continue;
    }
    const r = await auditChallenge(ch);
    const ok = r.problems.length === 0;
    if (!ok) fel++;
    console.log(`${ok ? "✓" : "✗"} ${r.id} ${r.name}: ${r.samples} exempel, ${r.distinctCores} kärnor, ` +
      `${PLANS} omgångar, egna kontroller ${r.audited ? "ja" : "SAKNAS"}, ` +
      `återkommande kärnor i omgång 2–3: ${r.relaxedPerSerie.toFixed(1)} av 30`);
    for (const p of r.problems) console.log(`    ${p}`);
    for (const t of samples(ch, visa)) {
      console.log(`    · [${t.role}] ${t.prompt}  →  ${t.key.display}`);
    }
  }
  return fel;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = (await main(process.argv.slice(2))) ? 1 : 0;
}
