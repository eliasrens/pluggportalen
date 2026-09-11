// ============================================================================
// Enhetstest för synliga lägen per arbetsområde (issue #200):
//   • gamemode-visibility.js: normalisering + has-gat + synlighetsfilter
//   • validate.js: hiddenModes sparas (bakåtkompatibelt, normaliserat)
//   • merge-area.js: hiddenModes behålls när nytt innehåll mergas in
// Körs browser-fritt med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GAMEMODES,
  ALL_MODES,
  ADVENTURE_MODES,
  normalizeHiddenModes,
  normalizeAreaModes,
  isModeHidden,
  isModeHiddenForClass,
  isModeHiddenForStudent,
  classAreaHiddenModes,
  effectiveHiddenModes,
  isModeHiddenForClassArea,
  visibleGamemodesForClassArea,
  areaContentFlags,
  availableGamemodes,
  visibleGamemodes,
  visibleGamemodesForStudent,
} from "../src/gamemode-visibility.js";
import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import { ADVENTURE_THEME_META } from "../src/adventure/themes/meta.js";
import { THEMES } from "../src/adventure/themes/index.js";

const QUIZ = [{ question: "Q?", options: ["a", "b"], answerIndex: 0 }];
const PAIRS = [
  { term: "t1", definition: "d1" },
  { term: "t2", definition: "d2" },
];

// --- normalizeHiddenModes ---------------------------------------------------

test("normalizeHiddenModes trimmar, tar bort tomma och dubbletter, behåller ordning", () => {
  assert.deepEqual(normalizeHiddenModes([" quiz ", "memory", "quiz", "", null, "  "]), [
    "quiz",
    "memory",
  ]);
});

test("normalizeHiddenModes ger tom lista för icke-lista", () => {
  assert.deepEqual(normalizeHiddenModes(undefined), []);
  assert.deepEqual(normalizeHiddenModes("quiz"), []);
  assert.deepEqual(normalizeHiddenModes(null), []);
});

test("isModeHidden är sant bara för id i hiddenModes", () => {
  const area = { hiddenModes: ["quiz"] };
  assert.equal(isModeHidden(area, "quiz"), true);
  assert.equal(isModeHidden(area, "memory"), false);
  assert.equal(isModeHidden({}, "quiz"), false); // saknas → inget dolt
});

// --- has-gat + synlighet ----------------------------------------------------

test("areaContentFlags speglar faktiskt innehåll", () => {
  assert.deepEqual(areaContentFlags({ quiz: QUIZ }), {
    quiz: true,
    pairs: false,
    readingTexts: false,
    sanningsjakt: true, // härleds ur quiz
    generator: false,
  });
  assert.deepEqual(areaContentFlags({ pairs: PAIRS }), {
    quiz: false,
    pairs: true,
    readingTexts: false,
    sanningsjakt: true, // ≥2 par
    generator: false,
  });
  assert.deepEqual(areaContentFlags({}), {
    quiz: false,
    pairs: false,
    readingTexts: false,
    sanningsjakt: false,
    generator: false,
  });
  // Läsuppdrag (issue #153): nivåtexter ger readingTexts-flaggan.
  assert.equal(areaContentFlags({ readingTexts: [{ id: "t1" }] }).readingTexts, true);
  // Räknegenerator (issue #279): en giltig area.generator ger generator-flaggan
  // (och INTE quiz/pairs), medan en ogiltig (okänd topic/ingen variant) inte gör det.
  assert.equal(
    areaContentFlags({ generator: { topic: "addition", variants: ["enkel"] } }).generator,
    true
  );
  assert.equal(areaContentFlags({ generator: { topic: "addition", variants: [] } }).generator, false);
  assert.equal(areaContentFlags({ generator: { topic: "bogus", variants: ["enkel"] } }).generator, false);
  const genFlags = areaContentFlags({ generator: { topic: "addition", variants: ["enkel"] } });
  assert.equal(genFlags.quiz, false);
  assert.equal(genFlags.pairs, false);
});

test("availableGamemodes ger bara lägen med underlag, oavsett hiddenModes", () => {
  const ids = availableGamemodes({ pairs: PAIRS, hiddenModes: ["para"] }).map((gm) => gm.id);
  // pairs ger para, memory (och sanningsjakt via ≥2 par); ingen quiz. Äventyrs-
  // temana kan spelas ur par (needsAny innehåller "pairs") → de ingår också.
  assert.deepEqual(
    new Set(ids),
    new Set([
      "para",
      "memory",
      "sanningsjakt",
      "aventyr:skattjakten",
      "aventyr:spokjakten",
      "aventyr:gruvan",
    ])
  );
});

test("availableGamemodes tar med äventyrs-temana bara när området har underlag", () => {
  // Inget innehåll → inga äventyrskort i listan.
  assert.equal(
    availableGamemodes({}).some((gm) => gm.id.startsWith("aventyr:")),
    false
  );
  // Quiz räcker (needsAny: quiz|par) → alla tre temana tillgängliga.
  const advIds = availableGamemodes({ quiz: QUIZ })
    .map((gm) => gm.id)
    .filter((id) => id.startsWith("aventyr:"));
  assert.deepEqual(new Set(advIds), new Set(["aventyr:skattjakten", "aventyr:spokjakten", "aventyr:gruvan"]));
});

test("visibleGamemodes = har underlag OCH inte urbockat", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const ids = visibleGamemodes(area).map((gm) => gm.id);
  assert.ok(!ids.includes("quiz"), "urbockat quiz ska bort");
  assert.ok(ids.includes("lasforstaelse"), "andra quiz-lägen påverkas inte");
  // Inga par → para/memory är inte synliga (has-gaten).
  assert.ok(!ids.includes("para"));
});

test("visibleGamemodes utan hiddenModes visar alla lägen med underlag (bakåtkompatibelt)", () => {
  const area = { quiz: QUIZ };
  const avail = availableGamemodes(area).map((gm) => gm.id);
  const vis = visibleGamemodes(area).map((gm) => gm.id);
  assert.deepEqual(vis, avail);
});

test("okänt mode-id i hiddenModes är ofarligt (matchar inget läge)", () => {
  const area = { quiz: QUIZ, hiddenModes: ["finns-inte"] };
  assert.equal(visibleGamemodes(area).length, availableGamemodes(area).length);
});

// --- klass-nivå (issue #208) ------------------------------------------------

test("isModeHiddenForClass är sant bara för id i klassens hiddenModes", () => {
  const cls = { hiddenModes: ["memory"] };
  assert.equal(isModeHiddenForClass(cls, "memory"), true);
  assert.equal(isModeHiddenForClass(cls, "quiz"), false);
  assert.equal(isModeHiddenForClass({}, "memory"), false); // saknas → inget dolt
  assert.equal(isModeHiddenForClass(null, "memory"), false); // ingen klass → inget dolt
});

test("isModeHiddenForStudent tar UNIONEN av klass- och områdes-dolda", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["memory"] };
  assert.equal(isModeHiddenForStudent(area, cls, "quiz"), true); // dolt via område
  assert.equal(isModeHiddenForStudent(area, cls, "memory"), true); // dolt via klass
  assert.equal(isModeHiddenForStudent(area, cls, "lasforstaelse"), false); // inget håll
  // Ingen klass (null) → faller tillbaka på enbart områdes-gaten (bakåtkompatibelt).
  assert.equal(isModeHiddenForStudent(area, null, "quiz"), true);
  assert.equal(isModeHiddenForStudent(area, null, "memory"), false);
});

test("visibleGamemodesForStudent döljer union klass ∪ område, respekterar has-gaten", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["kunskapsjakt"] };
  const ids = visibleGamemodesForStudent(area, cls).map((gm) => gm.id);
  assert.ok(!ids.includes("quiz"), "urbockat på område ska bort");
  assert.ok(!ids.includes("kunskapsjakt"), "urbockat på klass ska bort");
  assert.ok(ids.includes("lasforstaelse"), "övriga quiz-lägen kvar");
  assert.ok(!ids.includes("para"), "inget par-underlag → has-gaten döljer para");
});

test("visibleGamemodesForStudent utan klass-val = visibleGamemodes (bakåtkompatibelt)", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  assert.deepEqual(
    visibleGamemodesForStudent(area, null).map((gm) => gm.id),
    visibleGamemodes(area).map((gm) => gm.id)
  );
  assert.deepEqual(
    visibleGamemodesForStudent(area, { hiddenModes: [] }).map((gm) => gm.id),
    visibleGamemodes(area).map((gm) => gm.id)
  );
});

// --- validate.js ------------------------------------------------------------

test("validateArea saknar hiddenModes → tom lista (bakåtkompatibelt)", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, []);
});

test("validateArea normaliserar hiddenModes", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ, hiddenModes: [" quiz ", "quiz", ""] });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, ["quiz"]);
});

test("validateArea ignorerar ogiltig hiddenModes utan fel", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ, hiddenModes: "quiz" });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, []);
});

// --- merge-area.js ----------------------------------------------------------

test("mergeAreaContent behåller områdets hiddenModes", () => {
  const existing = { name: "Test", id: "test", quiz: QUIZ, hiddenModes: ["quiz"] };
  const res = mergeAreaContent(existing, { quiz: [{ question: "Ny?", options: ["x", "y"], answerIndex: 1 }] });
  assert.ok(res.ok, res.errors?.join("; "));
  assert.deepEqual(res.value.hiddenModes, ["quiz"]);
  assert.equal(res.value.quiz.length, 2);
});

// Katalogen ska ha alla lägen (skydd mot att någon råkar tömma den).
test("GAMEMODES har de åtta lägena (inkl. räkna)", () => {
  assert.deepEqual(
    GAMEMODES.map((gm) => gm.id),
    ["lasforstaelse", "lastext", "para", "quiz", "kunskapsjakt", "sanningsjakt", "memory", "rakna"]
  );
});

// Räkna-läget (issue #279) tänds BARA av ett generator-område, och ett rent
// generator-område tänder inte quiz/par/läs-lägena (grötskydd).
test("räkna tänds av generator-område och inget annat läge gör det", () => {
  const genArea = { generator: { topic: "addition", variants: ["enkel"] } };
  const ids = availableGamemodes(genArea).map((gm) => gm.id);
  assert.deepEqual(ids, ["rakna"]);
  // Ett quiz-område tänder INTE räkna.
  assert.ok(!availableGamemodes({ quiz: QUIZ }).map((gm) => gm.id).includes("rakna"));
});

// --- äventyrs-teman i synlighetslistan (issue #214) -------------------------

test("ADVENTURE_MODES är nyckelade aventyr:<id> och ligger sist i ALL_MODES", () => {
  const advIds = ADVENTURE_MODES.map((m) => m.id);
  assert.deepEqual(new Set(advIds), new Set(["aventyr:skattjakten", "aventyr:spokjakten", "aventyr:gruvan"]));
  // ALL_MODES = de sju vanliga + äventyren (i den ordningen).
  assert.deepEqual(
    ALL_MODES.map((m) => m.id),
    [...GAMEMODES.map((m) => m.id), ...advIds]
  );
});

test("dolt äventyrs-tema (område ELLER klass) filtreras bort för eleven", () => {
  const area = { quiz: QUIZ, hiddenModes: ["aventyr:skattjakten"] };
  const cls = { hiddenModes: ["aventyr:gruvan"] };
  const ids = visibleGamemodesForStudent(area, cls).map((gm) => gm.id);
  assert.ok(!ids.includes("aventyr:skattjakten"), "dolt på område ska bort");
  assert.ok(!ids.includes("aventyr:gruvan"), "dolt på klass ska bort");
  assert.ok(ids.includes("aventyr:spokjakten"), "odolt tema kvar");
  // isModeHiddenForStudent svarar direkt med samma union-hjälpare som övriga lägen.
  assert.equal(isModeHiddenForStudent(area, cls, "aventyr:skattjakten"), true);
  assert.equal(isModeHiddenForStudent(area, cls, "aventyr:gruvan"), true);
  assert.equal(isModeHiddenForStudent(area, cls, "aventyr:spokjakten"), false);
});

// Lätt metadata (meta.js) och det tunga registret (index.js) får inte glida isär –
// en glömd rad när ett nytt tema läggs till fångas här.
test("ADVENTURE_THEME_META är i synk med THEMES (id/namn/emoji/needs)", () => {
  assert.deepEqual(
    ADVENTURE_THEME_META.map((m) => m.id).sort(),
    Object.keys(THEMES).sort()
  );
  for (const m of ADVENTURE_THEME_META) {
    const theme = THEMES[m.id];
    assert.ok(theme, `THEMES saknar ${m.id}`);
    assert.equal(m.namn, theme.namn, `namn skiljer för ${m.id}`);
    assert.equal(m.emoji, theme.progressIcon, `emoji/progressIcon skiljer för ${m.id}`);
    assert.deepEqual(m.needs, theme.questionKinds, `needs/questionKinds skiljer för ${m.id}`);
  }
});

// --- per-(klass × område) resolution (issue #298) ---------------------------
// Datamodell: classes/{id}.areaModes = { [areaId]: { hiddenModes: [modeId,...] } }.
// EFFEKTIVT dolt = union av area.hiddenModes ∪ cls.hiddenModes ∪
// cls.areaModes[areaId].hiddenModes. areaId härleds ur area.id.

test("classAreaHiddenModes läser rätt områdes-post och normaliserar", () => {
  const cls = {
    areaModes: {
      a1: { hiddenModes: [" quiz ", "memory", "quiz", ""] },
      a2: { hiddenModes: ["para"] },
    },
  };
  assert.deepEqual(classAreaHiddenModes(cls, "a1"), ["quiz", "memory"]);
  assert.deepEqual(classAreaHiddenModes(cls, "a2"), ["para"]);
});

test("classAreaHiddenModes faller tillbaka på [] vid saknad map/areaId/klass", () => {
  assert.deepEqual(classAreaHiddenModes(null, "a1"), []);          // ingen klass
  assert.deepEqual(classAreaHiddenModes({}, "a1"), []);            // ingen map
  assert.deepEqual(classAreaHiddenModes({ areaModes: {} }, "a1"), []); // ingen post
  assert.deepEqual(classAreaHiddenModes({ areaModes: { a1: {} } }, "a1"), []); // ingen lista
  assert.deepEqual(classAreaHiddenModes({ areaModes: { a1: { hiddenModes: ["quiz"] } } }, null), []); // ingen areaId
  assert.deepEqual(classAreaHiddenModes({ areaModes: { a1: { hiddenModes: ["quiz"] } } }, "a2"), []); // annat område
});

test("effectiveHiddenModes = union område ∪ klass ∪ klass×område (utan dubbletter)", () => {
  const area = { id: "a1", quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = {
    hiddenModes: ["memory"],
    areaModes: { a1: { hiddenModes: ["para", "quiz"] } }, // "quiz" dubbel med området
  };
  assert.deepEqual(effectiveHiddenModes(area, cls), ["quiz", "memory", "para"]);
});

test("effectiveHiddenModes faller tillbaka på område∪klass utan per-område-map", () => {
  const area = { id: "a1", hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["memory"] };            // ingen areaModes
  assert.deepEqual(effectiveHiddenModes(area, cls), ["quiz", "memory"]);
  // Tom klass / inget dolt någonstans → tom mängd.
  assert.deepEqual(effectiveHiddenModes({ id: "a1" }, null), []);
  assert.deepEqual(effectiveHiddenModes({ id: "a1" }, {}), []);
});

test("effectiveHiddenModes ignorerar per-område-posten när area saknar id", () => {
  const area = { hiddenModes: ["quiz"] };             // inget id → ingen map-nyckel
  const cls = { hiddenModes: ["memory"], areaModes: { a1: { hiddenModes: ["para"] } } };
  assert.deepEqual(effectiveHiddenModes(area, cls), ["quiz", "memory"]); // "para" faller bort
});

test("isModeHiddenForClassArea döljer via var och en av de tre nivåerna", () => {
  const area = { id: "a1", quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = {
    hiddenModes: ["memory"],
    areaModes: { a1: { hiddenModes: ["para"] }, a2: { hiddenModes: ["kunskapsjakt"] } },
  };
  assert.equal(isModeHiddenForClassArea(area, cls, "quiz"), true);           // område
  assert.equal(isModeHiddenForClassArea(area, cls, "memory"), true);         // klass globalt
  assert.equal(isModeHiddenForClassArea(area, cls, "para"), true);           // klass × område a1
  assert.equal(isModeHiddenForClassArea(area, cls, "kunskapsjakt"), false);  // gäller bara a2, inte a1
  assert.equal(isModeHiddenForClassArea(area, cls, "lastext"), false);       // odolt
});

test("isModeHiddenForClassArea är bakåtkompatibel (= område∪klass) utan map", () => {
  const area = { id: "a1", quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["memory"] };
  // Samma svar som gamla isModeHiddenForStudent när ingen per-område-map finns.
  for (const m of ["quiz", "memory", "para"]) {
    assert.equal(
      isModeHiddenForClassArea(area, cls, m),
      isModeHiddenForStudent(area, cls, m),
      `mode ${m} ska matcha gamla union-beteendet`
    );
  }
});

test("visibleGamemodesForClassArea filtrerar bort per-område-dolt men behåller has-gaten", () => {
  const area = { id: "a1", quiz: QUIZ, pairs: PAIRS };
  const cls = { areaModes: { a1: { hiddenModes: ["quiz", "memory"] } } };
  const ids = visibleGamemodesForClassArea(area, cls).map((gm) => gm.id);
  assert.ok(!ids.includes("quiz"), "quiz dolt per klass×område");
  assert.ok(!ids.includes("memory"), "memory dolt per klass×område");
  assert.ok(ids.includes("para"), "para har underlag och är odolt → kvar");
  assert.ok(ids.includes("kunskapsjakt"), "kunskapsjakt (quiz-underlag) odolt → kvar");
  // Lägen utan underlag kommer aldrig med (has-gaten), oavsett dolt-status.
  assert.ok(!ids.includes("rakna"), "inget generator-underlag → aldrig med");
});

test("visibleGamemodesForClassArea utan map/klass = visibleGamemodesForStudent", () => {
  const area = { id: "a1", quiz: QUIZ, pairs: PAIRS, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["memory"] };
  assert.deepEqual(
    visibleGamemodesForClassArea(area, cls).map((gm) => gm.id),
    visibleGamemodesForStudent(area, cls).map((gm) => gm.id)
  );
});

test("per-område-dolt äventyrstema (klass × område) filtreras bort för eleven", () => {
  const area = { id: "a1", quiz: QUIZ };
  const cls = { areaModes: { a1: { hiddenModes: ["aventyr:skattjakten"] } } };
  const ids = visibleGamemodesForClassArea(area, cls).map((gm) => gm.id);
  assert.ok(!ids.includes("aventyr:skattjakten"), "dolt per klass×område ska bort");
  assert.ok(ids.includes("aventyr:spokjakten"), "odolt tema kvar");
  assert.equal(isModeHiddenForClassArea(area, cls, "aventyr:skattjakten"), true);
});

// --- normalizeAreaModes (skriv-sidan, issue #299) --------------------------

test("normalizeAreaModes normaliserar varje områdes lista och släpper tomma id", () => {
  const out = normalizeAreaModes({
    a1: { hiddenModes: [" quiz ", "quiz", "", "memory"] },
    "  ": { hiddenModes: ["para"] }, // tomt/blankt områdes-id släpps
    a2: { hiddenModes: [] }, // tom lista BEHÅLLS (kan av-dölja via merge)
  });
  assert.deepEqual(out, {
    a1: { hiddenModes: ["quiz", "memory"] },
    a2: { hiddenModes: [] },
  });
});

test("normalizeAreaModes ger tom map för icke-objekt / array / null", () => {
  assert.deepEqual(normalizeAreaModes(null), {});
  assert.deepEqual(normalizeAreaModes(undefined), {});
  assert.deepEqual(normalizeAreaModes([1, 2]), {});
  assert.deepEqual(normalizeAreaModes("nope"), {});
});

test("normalizeAreaModes → classAreaHiddenModes round-trip (lärar-spar → elev-gat)", () => {
  // Det lärar-UI:t skulle spara (urbockade lägen per område) …
  const saved = normalizeAreaModes({ a1: { hiddenModes: ["quiz", "quiz", " memory "] } });
  const cls = { areaModes: saved };
  // … läses av elev-gaten på exakt samma form.
  assert.deepEqual(classAreaHiddenModes(cls, "a1"), ["quiz", "memory"]);
  assert.deepEqual(classAreaHiddenModes(cls, "okänt"), []);
});
