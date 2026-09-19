// ============================================================================
// Enhetstester: gemensamma klassprojekt (#331) – de RENA hjälparna i
// class-projection-entries.js (Firebase-fria, ingen emulator behövs).
// Firestore-wiringen (donateToClassProject m.fl. i data-classes.js) är tunn
// transaktions-plumbing ovanpå exakt de här övergångarna; regel-sidan täcks av
// test/firestore-rules-class-docs.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeClassProject,
  normalizeClassProjects,
  isProjectFunded,
  applyProjectDonation,
} from "../src/class-projection-entries.js";

describe("normalizeClassProject", () => {
  it("tål null/skräp → komplett tomt projekt", () => {
    for (const raw of [null, undefined, "x", 7, []]) {
      assert.deepEqual(normalizeClassProject(raw), {
        goalAmount: 0,
        collected: 0,
        contributions: {},
        createdAt: null,
      });
    }
  });

  it("klamrar belopp till heltal ≥ 0 och rensar ogiltiga bidrag", () => {
    const p = normalizeClassProject({
      goalAmount: "500",
      collected: -3,
      contributions: { elev1: 40.4, elev2: 0, elev3: -5, "": 9, elev4: "abc" },
      createdAt: 1758200000000,
    });
    assert.equal(p.goalAmount, 500);
    assert.equal(p.collected, 0);
    assert.deepEqual(p.contributions, { elev1: 40 });
    assert.equal(p.createdAt, 1758200000000);
  });
});

describe("normalizeClassProjects", () => {
  it("saknat dokument/fält → tom map (inga projekt startade)", () => {
    assert.deepEqual(normalizeClassProjects(null), {});
    assert.deepEqual(normalizeClassProjects({}), {});
    assert.deepEqual(normalizeClassProjects({ projects: "trasig" }), {});
  });

  it("normaliserar varje byggnads projekt", () => {
    const m = normalizeClassProjects({
      projects: {
        stadshus: { goalAmount: 500, collected: 40, contributions: { elev1: 40 } },
        park: null,
      },
    });
    assert.deepEqual(Object.keys(m).sort(), ["park", "stadshus"]);
    assert.equal(m.stadshus.collected, 40);
    assert.equal(m.park.goalAmount, 0);
  });
});

describe("isProjectFunded", () => {
  it("fullt när collected ≥ goalAmount (och mål satt)", () => {
    assert.equal(isProjectFunded({ goalAmount: 100, collected: 100 }), true);
    assert.equal(isProjectFunded({ goalAmount: 100, collected: 99 }), false);
  });
  it("ett mål-löst projekt (goalAmount 0) är aldrig fullt", () => {
    assert.equal(isProjectFunded({ goalAmount: 0, collected: 999 }), false);
    assert.equal(isProjectFunded(null), false);
  });
});

describe("applyProjectDonation", () => {
  const base = { goalAmount: 500, collected: 40, contributions: { elev1: 40 } };

  it("ökar collected + donatorns bidrag (ackumulerande)", () => {
    const r1 = applyProjectDonation(base, "elev1", 10);
    assert.equal(r1.ok, true);
    assert.equal(r1.project.collected, 50);
    assert.deepEqual(r1.project.contributions, { elev1: 50 });

    const r2 = applyProjectDonation(r1.project, "elev2", 25);
    assert.equal(r2.project.collected, 75);
    assert.deepEqual(r2.project.contributions, { elev1: 50, elev2: 25 });
  });

  it("muterar inte in-objektet (ren övergång)", () => {
    const before = JSON.stringify(base);
    applyProjectDonation(base, "elev2", 10);
    assert.equal(JSON.stringify(base), before);
  });

  it("nekar ogiltiga belopp (0, negativt, icke-tal) och saknad elev", () => {
    for (const bad of [0, -5, NaN, "x", null, undefined]) {
      assert.equal(applyProjectDonation(base, "elev1", bad).ok, false);
    }
    assert.equal(applyProjectDonation(base, "", 10).ok, false);
  });

  it("nekar donation som skjuter över målet (inga coins slösas)", () => {
    const r = applyProjectDonation(base, "elev1", 461); // 40 + 461 > 500
    assert.equal(r.ok, false);
    assert.equal(r.error, "mer än vad som saknas");
    // ...men exakt upp till målet går bra.
    const ok = applyProjectDonation(base, "elev1", 460);
    assert.equal(ok.ok, true);
    assert.equal(isProjectFunded(ok.project), true);
  });

  it("nekar donation till ett redan fullfinansierat projekt", () => {
    const full = { goalAmount: 100, collected: 100, contributions: {} };
    assert.equal(applyProjectDonation(full, "elev1", 1).ok, false);
  });
});
