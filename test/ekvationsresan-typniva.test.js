// ============================================================================
// Tester: Ekvationsresan – Nästa rad (C) och Hitta felet (E) först från nivå 6
// (#657, Elias 2026-10-13). Ingen väg får ge C/E på nivå 1–5: nivåns andelar,
// färdighetsmodellens mix (bro-fokus), tvingad typ, "Försök igen" på en äldre
// C/E-uppgift och extrautmaningarna.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTask, similarTask, seededRng } from "../src/ekvationsresan/generator.js";
import { LEVELS, TYPE_MIN_LEVEL, typeAllowed, FARDIGHET } from "../src/ekvationsresan/config.js";
import { blandning, nastaUppgift } from "../src/ekvationsresan/nasta-uppgift.js";
import { generateExtraTask } from "../src/ekvationsresan/extra.js";

const CE = (t) => t.type === "C" || t.type === "E";
const LAGA = [1, 2, 3, 4, 5];
const HOGA = [6, 7, 8, 9, 10, 11, 12];
const N = 1500;

/** Elev som är stark på vågen men svag på skrivsätt och förenkling → bro-fokus (höjer C). */
const BRO = { balans: { v: 90, h: 0, n: 8 }, skrivsatt: { v: 20, h: 60, n: 8 }, forenkling: { v: 20, h: 60, n: 8 } };

test("TYPE_MIN_LEVEL: C och E från nivå 6; nivå 1–5 har inga C/E i andelarna", () => {
  assert.deepEqual({ ...TYPE_MIN_LEVEL }, { C: 6, E: 6 });
  for (const l of LAGA) {
    assert.ok(!typeAllowed("C", l) && !typeAllowed("E", l), `nivå ${l}`);
    const types = LEVELS[l - 1].types;
    assert.ok(!("C" in types) && !("E" in types), `nivå ${l}: ${JSON.stringify(types)}`);
  }
  for (const l of HOGA) assert.ok(typeAllowed("C", l) && typeAllowed("E", l), `nivå ${l}`);
  for (const t of ["A", "B", "D", "F"]) assert.ok(typeAllowed(t, 1), t);
});

test(`inga C/E på nivå 1–5 över ${N} slumpade uppgifter per nivå (med och utan färdighetsmodell)`, () => {
  for (const level of LAGA) {
    for (const skills of [{}, BRO]) {
      const rng = seededRng(`lag-${level}-${skills === BRO ? "bro" : "ny"}`);
      let prev = null;
      for (let i = 0; i < N; i++) {
        prev = nastaUppgift({ level, skills }, { rng, previous: prev });
        assert.ok(!CE(prev), `nivå ${level}: ${prev.type}`);
      }
    }
    // bro-fokus höjer D (och A), aldrig C
    const b = blandning(level, BRO);
    assert.ok(b.fokus.bro);
    assert.ok(!("C" in b.mix.types) && !("E" in b.mix.types));
    assert.equal(b.mix.types.D, FARDIGHET.broD);
  }
});

test("C och E förekommer på nivå 6–12", () => {
  for (const level of HOGA) {
    const rng = seededRng(`hog-${level}`);
    const seen = new Set();
    let prev = null;
    for (let i = 0; i < 400; i++) seen.add((prev = generateTask(level, { rng, previous: prev })).type);
    assert.ok(seen.has("C") && seen.has("E"), `nivå ${level}: ${[...seen]}`);
    assert.equal(generateTask(level, { rng, type: "C" }).type, "C");
    assert.equal(generateTask(level, { rng, type: "E" }).type, "E");
  }
  // bro-fokus höjer C från nivå 6
  assert.equal(blandning(6, BRO).mix.types.C, FARDIGHET.broC);
});

test("tvingad C/E under nivå 6 (QA-seed, äldre uppgift i Försök igen) blir A/B", () => {
  for (const level of LAGA) {
    const rng = seededRng(`tvingad-${level}`);
    for (const type of ["C", "E"]) {
      for (let i = 0; i < 20; i++) {
        const t = generateTask(level, { rng, type });
        assert.ok(t.type === "A" || t.type === "B", `nivå ${level} tvingad ${type}: ${t.type}`);
      }
    }
    // En sparad C/E-uppgift från före #657 på låg nivå: "Försök igen" ger A/B.
    const gammal = { ...generateTask(level, { rng, type: "B" }), type: level >= 3 ? "E" : "C" };
    assert.ok(!CE(similarTask(gammal, { rng })));
  }
});

test("extrautmaningarna ger aldrig C/E", () => {
  const rng = seededRng("extra-ce");
  for (const level of [...LAGA, ...HOGA]) {
    for (let i = 0; i < 20; i++) assert.ok(!CE(generateExtraTask({ rng, level })));
  }
});
