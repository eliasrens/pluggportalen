// ============================================================================
// Enhetstest för klassaggregatet i src/leveling.js (progressTotals +
// aggregateKlassStats) – den gemensamma, BARA POSITIVA klasstatistiken som
// klassbyn (#/elev/by) visar. Körs med Node:s inbyggda testkörare: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  progressTotals,
  aggregateKlassStats,
  xpForLevel,
  levelForXp,
} from "../src/leveling.js";

// --- progressTotals --------------------------------------------------------

test("progressTotals summerar avklarade övningar och stjärnor", () => {
  const progress = {
    vikingatiden: {
      quiz: { completed: true, stars: 3 },
      memory: { completed: true, stars: 2 },
    },
    stenaldern: {
      quiz: { completed: true, stars: 1 },
      memory: { completed: false, stars: 0 },
    },
  };
  assert.deepEqual(progressTotals(progress), { completed: 3, stars: 6 });
});

test("progressTotals är robust mot tomt/trasigt", () => {
  assert.deepEqual(progressTotals(), { completed: 0, stars: 0 });
  assert.deepEqual(progressTotals(null), { completed: 0, stars: 0 });
  assert.deepEqual(
    progressTotals({ a: { m: null }, b: { m: "trasig" } }),
    { completed: 0, stars: 0 }
  );
});

test("progressTotals ignorerar negativa stjärnor (aldrig negativt)", () => {
  const p = { a: { m: { completed: true, stars: -5 } } };
  assert.deepEqual(progressTotals(p), { completed: 1, stars: 0 });
});

// --- aggregateKlassStats ---------------------------------------------------

test("aggregateKlassStats summerar allas positiva bidrag", () => {
  const students = [
    { xp: 100, completed: 4, stars: 8 },
    { xp: 40, completed: 2, stars: 3 },
    { xp: 0, completed: 0, stars: 0 },
  ];
  const s = aggregateKlassStats(students);
  assert.equal(s.antalElever, 3);
  assert.equal(s.totalXp, 140);
  assert.equal(s.totalCompleted, 6);
  assert.equal(s.totalStars, 11);
});

test("klass-nivån härleds ur SUMMAN av allas XP (samma kurva som eleven)", () => {
  const students = [{ xp: 50 }, { xp: 30 }, { xp: 20 }]; // summa 100
  const s = aggregateKlassStats(students);
  // xpForLevel(3) = 100 → totalt 100 XP räcker exakt till klass-nivå 3.
  assert.equal(xpForLevel(3), 100);
  assert.equal(s.level, 3);
  assert.equal(s.level, levelForXp(100));
});

test("klass-nivån växer när klassen pluggar mer (monotont)", () => {
  const fore = aggregateKlassStats([{ xp: 100 }, { xp: 100 }]);
  const efter = aggregateKlassStats([{ xp: 100 }, { xp: 400 }]);
  assert.ok(efter.totalXp > fore.totalXp);
  assert.ok(efter.level >= fore.level);
  assert.ok(efter.level > fore.level, "mer XP ska ge minst en högre klass-nivå här");
});

test("aggregateKlassStats är robust mot tomt/saknade fält (aldrig negativt)", () => {
  const tom = aggregateKlassStats([]);
  assert.deepEqual(
    { antalElever: tom.antalElever, totalXp: tom.totalXp, totalCompleted: tom.totalCompleted, totalStars: tom.totalStars },
    { antalElever: 0, totalXp: 0, totalCompleted: 0, totalStars: 0 }
  );
  assert.equal(tom.level, 1); // nivå 1 vid 0 XP, aldrig lägre

  const trasig = aggregateKlassStats([{}, { xp: -10, stars: -3 }, null]);
  assert.equal(trasig.totalXp, 0);
  assert.equal(trasig.totalStars, 0);
  assert.equal(trasig.level, 1);
});

test("aggregateKlassStats klarar icke-array-indata", () => {
  const s = aggregateKlassStats(undefined);
  assert.equal(s.antalElever, 0);
  assert.equal(s.totalXp, 0);
});
