// ============================================================================
// Enhetstest för obligatoriska läsförståelse-förkrav (issue #155):
//   • reading-prereq.js: normalisering, "godkänt"-tröskel (chans-skydd),
//     räkning av godkända enheter (både gamemode och framtida per-text), status.
//   • validate.js: readingPrereq normaliseras in i det sparade området och är
//     bakåtkompatibelt (utelämnas → fältet finns inte).
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  READING_PASS_STARS,
  isReadingPassed,
  normalizeReadingPrereq,
  readingPassCount,
  readingPrereqStatus,
} from "../src/reading-prereq.js";
import { validateArea } from "../src/validate.js";

// Minsta giltiga område (ett quizfråga räcker som innehåll).
function area(extra = {}) {
  return {
    name: "Vikingatiden",
    quiz: [{ question: "Vad?", options: ["A", "B"], answerIndex: 0 }],
    ...extra,
  };
}

test("godkänt kräver minst 2 stjärnor (chans-skydd), inte bara completed", () => {
  assert.equal(READING_PASS_STARS, 2);
  assert.equal(isReadingPassed({ completed: true, stars: 1 }), false); // påbörjad/svag
  assert.equal(isReadingPassed({ completed: true, stars: 2 }), true);
  assert.equal(isReadingPassed({ stars: 3 }), true);
  assert.equal(isReadingPassed(null), false);
  assert.equal(isReadingPassed(undefined), false);
  assert.equal(isReadingPassed({}), false);
});

test("normalizeReadingPrereq: tolerant och bakåtkompatibel", () => {
  assert.equal(normalizeReadingPrereq(undefined), null);
  assert.equal(normalizeReadingPrereq(null), null);
  assert.equal(normalizeReadingPrereq(false), null);
  assert.equal(normalizeReadingPrereq({}), null); // saknar required → av
  assert.equal(normalizeReadingPrereq({ required: 0 }), null);
  assert.equal(normalizeReadingPrereq({ required: -3 }), null);
  assert.deepEqual(normalizeReadingPrereq(true), { required: 1 });
  assert.deepEqual(normalizeReadingPrereq(2), { required: 2 });
  assert.deepEqual(normalizeReadingPrereq({ required: 3 }), { required: 3 });
  assert.deepEqual(normalizeReadingPrereq({ required: 2.7 }), { required: 3 }); // avrundas
  assert.deepEqual(normalizeReadingPrereq({ required: "2" }), { required: 2 });
});

test("readingPassCount: gamemode i dag, per-text framåtkompatibelt", () => {
  assert.equal(readingPassCount(undefined), 0);
  assert.equal(readingPassCount({}), 0);
  // Läsförståelse-gamemodet räknas som EN godkänd enhet.
  assert.equal(readingPassCount({ lasforstaelse: { stars: 1 } }), 0);
  assert.equal(readingPassCount({ lasforstaelse: { stars: 2 } }), 1);
  // Per-text-hink (skrivs av läsförståelse-läget): varje godkänd text räknas.
  assert.equal(
    readingPassCount({ reading: { t1: { stars: 3 }, t2: { stars: 2 }, t3: { stars: 1 } } }),
    2
  );
  // Har per-text NÅGON godkänd → den räknar (gamemodet blandas inte in).
  assert.equal(
    readingPassCount({ reading: { t1: { stars: 3 } }, lasforstaelse: { stars: 2 } }),
    1
  );
});

test("readingPrereqStatus: av → allt öppet; på → mätt först vid nog godkända", () => {
  // Inget förkrav satt → öppet (bakåtkompatibelt).
  assert.deepEqual(readingPrereqStatus(area(), {}), {
    enabled: false, required: 0, passed: 0, met: true,
  });
  // Förkrav på, inget godkänt ännu → ej mött.
  const a = area({ readingPrereq: { required: 2 } });
  assert.deepEqual(readingPrereqStatus(a, {}), {
    enabled: true, required: 2, passed: 0, met: false,
  });
  // Ett godkänt av två → fortfarande låst.
  assert.equal(readingPrereqStatus(a, { reading: { t1: { stars: 2 } } }).met, false);
  // Två godkända → upplåst.
  assert.equal(
    readingPrereqStatus(a, { reading: { t1: { stars: 2 }, t2: { stars: 3 } } }).met,
    true
  );
});

test("validateArea: readingPrereq sparas normaliserat och är bakåtkompatibelt", () => {
  // Utan fält → sparade dokumentet har inget readingPrereq (rena gamla områden).
  const bare = validateArea(area());
  assert.equal(bare.ok, true);
  assert.equal("readingPrereq" in bare.value, false);

  // Med giltigt fält → normaliseras in.
  const withPrereq = validateArea(area({ readingPrereq: { required: 2 } }));
  assert.equal(withPrereq.ok, true);
  assert.deepEqual(withPrereq.value.readingPrereq, { required: 2 });

  // Ogiltigt/av-värde tas bort helt (inte tomt fält).
  const off = validateArea(area({ readingPrereq: { required: 0 } }));
  assert.equal(off.ok, true);
  assert.equal("readingPrereq" in off.value, false);
});
