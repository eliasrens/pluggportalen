// Läsresan – läsvyns rena logik, sammanfattningens texter och bootgrafen (#401).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  displayOrder,
  validAnswers,
  countCorrect,
  loadPending,
  savePending,
  clearPending,
  PENDING_PREFIX,
} from "../src/lasresan/reader-logic.js";
import { cheer } from "../src/lasresan/ui-summary.js";
import { coinsFor } from "../src/lasresan/rewards.js";

const text = {
  id: "lr-n3-test",
  questions: [
    { id: "q1", options: ["a", "b", "c", "d"], answerIndex: 2 },
    { id: "q2", options: ["a", "b", "c", "d"], answerIndex: 0 },
    { id: "q3", options: ["a", "b", "c", "d"], answerIndex: 3 },
  ],
};

test("displayOrder är en permutation och stabil per nyckel", () => {
  for (const key of ["a/q1", "lr-n1-katten/q2", "x"]) {
    const o = displayOrder(key, 4);
    assert.deepEqual([...o].sort(), [0, 1, 2, 3]);
    assert.deepEqual(displayOrder(key, 4), o, "samma nyckel → samma ordning");
  }
  assert.deepEqual(displayOrder("x", 0), []);
});

test("displayOrder sprider rätt svars position (ingen fast bokstav)", () => {
  const pos = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) pos[displayOrder(`t/q${i}`, 4).indexOf(0)] += 1;
  for (const n of pos) assert.ok(n > 60 && n < 140, `skev fördelning ${pos}`);
});

test("validAnswers behåller bara en obruten, giltig följd från första frågan", () => {
  assert.deepEqual(validAnswers(text, null), []);
  assert.deepEqual(validAnswers(text, [{ qid: "q1", chosen: 1 }, { qid: "q2", chosen: 0 }]), [
    { qid: "q1", chosen: 1 },
    { qid: "q2", chosen: 0 },
  ]);
  // Fel qid, ogiltigt index eller lucka bryter följden.
  assert.deepEqual(validAnswers(text, [{ qid: "q2", chosen: 0 }]), []);
  assert.deepEqual(validAnswers(text, [{ qid: "q1", chosen: 4 }]), []);
  assert.deepEqual(validAnswers(text, [{ qid: "q1", chosen: 0 }, null, { qid: "q3", chosen: 3 }]), [{ qid: "q1", chosen: 0 }]);
  // Fler svar än frågor kapas.
  const all = text.questions.map((q) => ({ qid: q.id, chosen: 0 }));
  assert.equal(validAnswers(text, [...all, { qid: "q4", chosen: 0 }]).length, 3);
});

test("countCorrect räknar mot answerIndex", () => {
  assert.equal(countCorrect(text, [{ qid: "q1", chosen: 2 }, { qid: "q2", chosen: 1 }, { qid: "q3", chosen: 3 }]), 2);
  assert.equal(countCorrect(text, []), 0);
});

test("pågående svar sparas per elev och text, och tål trasig lagring", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  savePending(storage, "elev1", "lr-n3-test", [{ qid: "q1", chosen: 2 }]);
  assert.deepEqual(loadPending(storage, "elev1", "lr-n3-test"), [{ qid: "q1", chosen: 2 }]);
  assert.deepEqual(loadPending(storage, "elev1", "annan-text"), [], "annan text → inga svar");
  assert.deepEqual(loadPending(storage, "elev2", "lr-n3-test"), [], "annan elev → inga svar");
  clearPending(storage, "elev1");
  assert.deepEqual(loadPending(storage, "elev1", "lr-n3-test"), []);
  mem.set(PENDING_PREFIX + "elev1", "{trasig json");
  assert.deepEqual(loadPending(storage, "elev1", "lr-n3-test"), []);
  const throwing = { getItem() { throw new Error("blockerad"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("x"); } };
  assert.deepEqual(loadPending(throwing, "e", "t"), []);
  savePending(throwing, "e", "t", []);
  clearPending(throwing, "e");
  assert.deepEqual(loadPending(null, "e", "t"), []);
});

test("sammanfattningen är alltid positiv och nämner aldrig nivå", () => {
  for (const [c, t] of [[0, 6], [1, 6], [4, 8], [6, 8], [8, 8]]) {
    const { text: msg } = cheer(c, t);
    assert.ok(msg.length > 0);
    assert.doesNotMatch(msg, /nivå|ner|sämre|fel/i);
  }
  assert.equal(cheer(8, 8).text, "Alla rätt!");
});

test("spec Test 8: 4 rätt av 7 → exakt 12 coins (3 per rätt)", () => {
  assert.equal(coinsFor(4), 12);
  assert.equal(coinsFor(6), 18);
});

// --- Bootgrafen (incidenten 2026-09-10, #271) --------------------------------
// Inget under src/lasresan/ och inte data-lasresan.js får nås STATISKT från
// app.js. Routen använder dynamisk import().
test("Läsresan ligger utanför den statiska bootgrafen från app.js", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const seen = new Set();
  const queue = [join(root, "app.js")];
  const re = /(?:^|[\s;])(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      queue.push(resolve(dirname(file), spec));
    }
  }
  const bad = [...seen].filter((f) => f.includes(`${join(root, "lasresan")}`) || f.endsWith("data-lasresan.js"));
  assert.deepEqual(bad, [], "Läsresan-moduler i bootgrafen");
  assert.ok(seen.size > 20, `bootgrafen verkar för liten (${seen.size}) – fel i BFS:en?`);
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /import\(["']\.\/lasresan\/page-lasresan\.js["']\)/);
});
