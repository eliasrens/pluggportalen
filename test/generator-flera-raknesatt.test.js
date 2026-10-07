// Issue #470: flera räknesätt (topics) per generator-område – normalisering
// (gammalt + nytt format), validering, balanserad blandning (shuffle-bag) och att
// varje genererad uppgift kommer från ett valt räknesätt.
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGenerator, normalizeGeneratorTopic, hasGeneratorContent } from "../src/exercise-types.js";
import { validateArea } from "../src/validate.js";
import {
  buildRound,
  createProblemSource,
  createTopicBag,
  generatorTopics,
  sessionSeed,
  checkAnswer,
} from "../src/rakna-core.js";
import { generatorSummary, topicLabel } from "../src/teacher-generator-labels.js";

const MIX = {
  topics: [
    { topic: "addition", variants: ["enkel"] },
    { topic: "subtraktion", variants: ["enkel", "uppstallning"], talstorlek: "liten" },
    { topic: "multiplikation", variants: ["tabeller"], bildstod: false },
  ],
  grade: "ak4",
};
const CHOSEN = new Set(MIX.topics.map((t) => t.topic));

// --- normalisering -----------------------------------------------------------

test("normalizeGenerator: nytt format med flera räknesätt, inställningar per räknesätt", () => {
  assert.deepEqual(normalizeGenerator(MIX), MIX);
});

test("normalizeGenerator: gammalt { topic, variants } blir en lista med ETT räknesätt", () => {
  assert.deepEqual(
    normalizeGenerator({ topic: "division", variants: ["rest"], talstorlek: "stor", bildstod: false, grade: 5 }),
    { topics: [{ topic: "division", variants: ["rest"], bildstod: false, talstorlek: "stor" }], grade: "ak5" }
  );
});

test("normalizeGenerator: ogiltiga räknesätt och dubbletter släpps, minst ett giltigt krävs", () => {
  assert.deepEqual(
    normalizeGenerator({
      topics: [
        { topic: "bogus", variants: ["enkel"] },
        { topic: "addition", variants: [] },
        { topic: "subtraktion", variants: ["enkel", "bogus"] },
        { topic: "subtraktion", variants: ["uppstallning"] }, // dubblett – första vinner
        "skräp",
      ],
    }),
    { topics: [{ topic: "subtraktion", variants: ["enkel"] }] }
  );
  assert.equal(normalizeGenerator({ topics: [{ topic: "addition", variants: [] }] }), null);
  assert.equal(normalizeGenerator({ topics: [] }), null); // tom lista + inget gammalt topic
  assert.equal(hasGeneratorContent({ generator: { topics: [{ topic: "klocka", variants: ["las-av"] }] } }), true);
  // bildstöd sparas bara för räknesätt som stödjer det
  assert.equal("bildstod" in normalizeGeneratorTopic({ topic: "addition", variants: ["enkel"], bildstod: false }), false);
});

// --- validering ----------------------------------------------------------------

test("validateArea godtar flera räknesätt och sparar nya formatet", () => {
  const res = validateArea({ name: "Blandat", generator: MIX });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.generator, MIX);
  assert.deepEqual(res.value.exerciseTypes, ["generator"]);
});

test("validateArea ger tydliga fel per räknesätt", () => {
  const bad = validateArea({
    name: "X",
    generator: { topics: [{ topic: "addition", variants: ["enkel"] }, { topic: "bogus", variants: ["x"] }] },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /räknesätt 2.*okänt "topic"/.test(e)), bad.errors.join(" | "));

  const dup = validateArea({
    name: "X",
    generator: { topics: [{ topic: "addition", variants: ["enkel"] }, { topic: "addition", variants: ["enkel"] }] },
  });
  assert.equal(dup.ok, false);
  assert.ok(dup.errors.some((e) => /finns redan/.test(e)), dup.errors.join(" | "));

  const empty = validateArea({ name: "X", generator: { topics: [] } });
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((e) => /minst ett räknesätt/.test(e)), empty.errors.join(" | "));

  const noVariant = validateArea({ name: "X", generator: { topics: [{ topic: "addition", variants: [] }] } });
  assert.equal(noVariant.ok, false);
  assert.ok(noVariant.errors.some((e) => /minst en variant/.test(e)), noVariant.errors.join(" | "));
});

// --- shuffle-bag -----------------------------------------------------------------

test("createTopicBag: jämn fördelning (skillnad ≤ 1 hela vägen) och aldrig samma två i rad", () => {
  for (const k of [2, 3, 5]) {
    const topics = Array.from({ length: k }, (_, i) => ({ topic: `t${i}` }));
    for (const seed of [1, 42, 999, 123456]) {
      const bag = createTopicBag(topics, seed);
      const counts = new Map();
      let prev = null;
      for (let i = 0; i < 60; i++) {
        const t = bag.next().topic;
        assert.notEqual(t, prev, `samma räknesätt två gånger i rad (k=${k}, seed=${seed}, i=${i})`);
        prev = t;
        counts.set(t, (counts.get(t) || 0) + 1);
        const vals = topics.map((x) => counts.get(x.topic) || 0);
        assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, `obalans vid i=${i}: ${vals}`);
      }
    }
  }
});

test("createTopicBag: deterministisk per seed, olika ordning för olika seed", () => {
  const topics = ["a", "b", "c", "d"].map((topic) => ({ topic }));
  const seq = (seed) => {
    const b = createTopicBag(topics, seed);
    return Array.from({ length: 12 }, () => b.next().topic).join("");
  };
  assert.equal(seq(7), seq(7));
  const all = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seq));
  assert.ok(all.size > 1, "alla frön gav samma ordning");
});

test("createTopicBag: ett räknesätt → alltid det", () => {
  const only = { topic: "addition" };
  const bag = createTopicBag([only], 5);
  for (let i = 0; i < 5; i++) assert.equal(bag.next(), only);
});

// --- runda / ström ---------------------------------------------------------------

test("buildRound: varje uppgift kommer från ett valt räknesätt, alla förekommer, rättning följer topic", () => {
  const gen = normalizeGenerator(MIX);
  for (const uid of ["e1", "e2", "e3"]) {
    const round = buildRound(gen, sessionSeed(uid, 1), 8);
    assert.equal(round.length, 8);
    const seen = new Set();
    round.forEach((item, i) => {
      assert.ok(CHOSEN.has(item.topic), item.topic);
      seen.add(item.topic);
      if (i > 0) assert.notEqual(item.topic, round[i - 1].topic);
      const entry = gen.topics.find((t) => t.topic === item.topic);
      assert.ok(entry.variants.includes(item.variant), `${item.topic}/${item.variant}`);
      assert.equal(checkAnswer(item.problem, item.answer, String(item.answer)), true);
    });
    assert.deepEqual(seen, CHOSEN);
  }
});

test("buildRound: deterministisk per seed med flera räknesätt", () => {
  const gen = normalizeGenerator(MIX);
  const a = buildRound(gen, 4242, 8).map((x) => `${x.topic}:${x.problem.text}`);
  const b = buildRound(gen, 4242, 8).map((x) => `${x.topic}:${x.problem.text}`);
  assert.deepEqual(a, b);
});

test("buildRound: answerType följer uppgiftens faktiska räknesätt (numeriskt + klocka blandat)", () => {
  const gen = normalizeGenerator({
    topics: [
      { topic: "addition", variants: ["enkel"] },
      { topic: "klocka", variants: ["las-av"] },
    ],
  });
  const round = buildRound(gen, 77, 8);
  for (const item of round) {
    assert.equal(item.problem.answerType, item.topic === "klocka" ? "time" : "numeric");
  }
});

test("buildRound: gammalt enkel-topic-område ger EXAKT samma uppgifter som förut (normaliserat eller rått)", () => {
  const legacy = { topic: "multiplikation", variants: ["tabeller", "dubbelt"], grade: "ak3", talstorlek: "stor" };
  const raw = buildRound(legacy, 31337, 8).map((x) => x.problem.text);
  const norm = buildRound(normalizeGenerator(legacy), 31337, 8).map((x) => x.problem.text);
  assert.deepEqual(norm, raw);
  assert.deepEqual(generatorTopics(legacy), [legacy]);
});

test("createProblemSource: balanserad blandning även över batch-gränserna (äventyren)", () => {
  const gen = normalizeGenerator(MIX);
  const src = createProblemSource(gen, sessionSeed("e", 9));
  const counts = { addition: 0, subtraktion: 0, multiplikation: 0 };
  let prev = null;
  for (let i = 0; i < 30; i++) {
    const item = src.next();
    assert.ok(CHOSEN.has(item.topic));
    assert.notEqual(item.topic, prev, `samma räknesätt i rad vid i=${i}`);
    prev = item.topic;
    counts[item.topic]++;
  }
  assert.deepEqual(Object.values(counts), [10, 10, 10]);
});

// --- lärar-sammanfattning ---------------------------------------------------------

test("generatorSummary: räknesättens namn + totalt antal varianter", () => {
  assert.deepEqual(generatorSummary(MIX), {
    topics: "Addition + Subtraktion + Multiplikation",
    variants: 4,
    count: 3,
  });
  assert.equal(generatorSummary({ topic: "matt-langd", variants: ["omvandla"] }).topics, "Mätning: längd");
  assert.equal(generatorSummary(null), null);
  assert.equal(topicLabel("negativa-tal"), "Negativa tal");
});
