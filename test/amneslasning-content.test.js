// ============================================================================
// Ämnesläsning – lärarens innehåll (#673): validering, id, spara/redigera/ta bort
// och prompterna. Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §6–7, test 16–20.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addReadingTexts,
  isLegacyReadingText,
  levelCounts,
  levelGaps,
  normalizeTextsPerLevel,
  parseReadingTextsPaste,
  readingTextsOf,
  removeReadingText,
  updateReadingText,
  validateReadingTexts,
} from "../src/amneslasning/content.js";
import { buildAmnesPrompt, buildAreaPrompt, buildMorePrompt } from "../src/prompts.js";
import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import { deriveExerciseTypes, EXERCISE_TYPES } from "../src/exercise-types.js";
import { tabsFor } from "../src/teacher-area-items-ops.js";
import {
  AMNES_QUESTIONS_BY_LEVEL,
  AMNES_WORD_RANGES,
  AMNES_TEXTS_PER_LEVEL_DEFAULT,
  CATEGORIES,
} from "../src/lasresan/config.js";

const words = (n) => Array.from({ length: n }, (_, i) => `ord${i}`).join(" ");
const q = (n, extra = {}) => ({
  id: `q${n}`,
  question: `Fråga ${n}?`,
  options: ["Silver", "Bananer", "Papper", "Glas"],
  answerIndex: n % 4,
  category: CATEGORIES[n % CATEGORIES.length],
  ...extra,
});
/** En giltig text på ämnesnivå `level` (ordantal och frågor mitt i riktlinjen). */
function text(id, level, extra = {}) {
  const [wMin, wMax] = AMNES_WORD_RANGES[level] || AMNES_WORD_RANGES[1];
  const [qMin] = AMNES_QUESTIONS_BY_LEVEL[level] || AMNES_QUESTIONS_BY_LEVEL[1];
  return {
    id,
    title: `Rubrik ${id}`,
    level,
    textType: "fact",
    body: words(Math.round((wMin + wMax) / 2)),
    questions: Array.from({ length: qMin }, (_, i) => q(i + 1)),
    ...extra,
  };
}
const nine = () => [1, 2, 3].flatMap((l) => [1, 2, 3].map((i) => text(`t-${l}-${i}`, l)));

const area = (extra = {}) => ({
  id: "vikingar",
  name: "Vikingatiden",
  grade: "ak5",
  exerciseTypes: ["quiz"],
  quiz: [{ id: "q1", question: "När?", options: ["800", "1500"], answerIndex: 0, explanation: "" }],
  readingTexts: [text("vikingar-handel-1", 1, { title: "Vikingarna köper och säljer" })],
  ...extra,
});

// --- Övningstypen ----------------------------------------------------------

test("övningstypen 📖 Ämnesläsning finns med förklaringen ur specen", () => {
  const t = EXERCISE_TYPES.find((x) => x.id === "amneslasning");
  assert.equal(t.emoji, "📖");
  assert.equal(t.label, "Ämnesläsning");
  assert.equal(t.hint, "Läsförståelsetexter om området, på tre nivåer");
  assert.ok(!t.generated, "AI-författad typ (med i promptens val)");
});

test("deriveExerciseTypes: ämnestexter tänder typen, gamla nivåtexter gör det inte", () => {
  assert.deepEqual(deriveExerciseTypes({ readingTexts: [text("a", 1)] }), ["amneslasning"]);
  assert.deepEqual(deriveExerciseTypes({ readingTexts: [{ id: "rt1", title: "x", levels: { 1: {} } }] }), []);
});

// --- Test 16: panelens prompt ------------------------------------------------

test("test 16: prompten har namn, ämne, årskurs, önskemål och befintliga titlar", () => {
  const p = buildAmnesPrompt({ area: area(), subjectName: "SO", count: 3, onskemal: "fokusera på vikingarnas handel" });
  assert.match(p, /arbetsområdet\s+"Vikingatiden" i ämnet SO, för elever i årskurs 5/);
  assert.match(p, /Skriv 3 texter per nivå på tre nivåer, alltså 9 texter totalt/);
  assert.match(p, /Lärarens önskemål: fokusera på vikingarnas handel/);
  assert.match(p, /redan de här texterna – skriv INTE om samma sak igen:\n- Vikingarna köper och säljer \(nivå 1\)/);
  assert.match(p, /varje nivå har\n3 texter/);
});

test("prompten: material med när det finns, utan tomma [[…]]-delar annars", () => {
  const med = buildAmnesPrompt({ area: area({ readingTexts: [] }), subjectName: "NO", material: "Fotosyntesen gör socker." });
  assert.match(med, /Utgå från det här materialet[^\n]*:\nFotosyntesen gör socker\./);
  const utan = buildAmnesPrompt({ area: area({ readingTexts: [] }), subjectName: "NO" });
  assert.doesNotMatch(utan, /önskemål|materialet och håll|redan de här texterna/);
});

test("prompten hämtar ordantal, frågor och kategorier ur konfigurationen", () => {
  const p = buildAmnesPrompt({ area: area(), subjectName: "SO" });
  for (const level of [1, 2, 3]) {
    const [w0, w1] = AMNES_WORD_RANGES[level];
    const [q0, q1] = AMNES_QUESTIONS_BY_LEVEL[level];
    assert.match(p, new RegExp(`Nivå ${level} \\([^)]*\\): cirka ${w0}–${w1} ord[^\\n]*${q0}–${q1} frågor`));
  }
  for (const c of CATEGORIES) assert.match(p, new RegExp(`"${c}"\\s+– `));
  assert.match(p, new RegExp(`Skriv ${AMNES_TEXTS_PER_LEVEL_DEFAULT} texter per nivå`), "förval 3");
});

test("antal per nivå hålls inom 1–5 (förval 3)", () => {
  assert.equal(normalizeTextsPerLevel(0), 1);
  assert.equal(normalizeTextsPerLevel(9), 5);
  assert.equal(normalizeTextsPerLevel("2"), 2);
  assert.equal(normalizeTextsPerLevel(""), 3);
});

// --- Test 20: områdes-prompten ---------------------------------------------

test("test 20: bara Ämnesläsning ikryssad → prompten ber bara om ämnestexter", () => {
  const p = buildAreaPrompt(["amneslasning"], "", "ak4");
  assert.match(p, /"readingTexts"/);
  assert.match(p, /Skapa INGA faktatexter/);
  assert.match(p, /Skapa INGA quizfrågor/);
  assert.match(p, /Skapa INGA fakta-par/);
  assert.doesNotMatch(p, /"passage"|termImage|Quizfrågor med 4/, "inga quiz-/par-scheman");
  assert.match(p, /"texts": \[\],\n  "quiz": \[\],\n  "pairs": \[\],\n  "readingTexts": \[/);
});

test("Ämnesläsning + quiz: vanliga prompten ber även om ämnestexter", () => {
  const p = buildAreaPrompt(["quiz", "amneslasning"], "", null);
  assert.match(p, /Quizfrågor med 4 svarsalternativ/);
  assert.match(p, /Ämnestexter i "readingTexts" \(INTE i "texts"\): 3 texter per nivå/);
  assert.match(p, /"readingTexts": \[/);
});

test("prompten utan Ämnesläsning är oförändrad (nämner inte readingTexts)", () => {
  assert.doesNotMatch(buildAreaPrompt(["quiz"], "", null), /readingTexts|Ämnesläsning/);
  assert.doesNotMatch(buildAreaPrompt([], "", null), /readingTexts|Ämnesläsning/);
});

test("Lägg till-prompten: område med Ämnesläsning listar befintliga titlar", () => {
  const a = area({ exerciseTypes: ["quiz", "amneslasning"] });
  assert.match(buildMorePrompt(a, ""), /Ämnestexterna nedan finns redan[^\n]*\n- Vikingarna köper och säljer \(nivå 1\)/);
});

// --- Test 17: giltigt svar, förhandsgranskning per nivå, spara utan överskrivning

test("test 17: giltigt AI-svar valideras per nivå och sparas utan att befintliga skrivs över", () => {
  const before = area();
  const paste = JSON.stringify({ readingTexts: [...nine(), text("vikingar-handel-1", 2)] });
  const parsed = parseReadingTextsPaste("```json\n" + paste + "\n```");
  assert.equal(parsed.ok, true);
  const res = validateReadingTexts(parsed.list, { existing: before.readingTexts, expectedPerLevel: 3 });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.perLevel, { 1: 3, 2: 4, 3: 3 });
  // Krockande id görs om automatiskt.
  const renamed = res.items.find((it) => it.renamedFrom === "vikingar-handel-1");
  assert.equal(renamed.text.id, "vikingar-handel-1-2");

  const next = addReadingTexts(before, res.valid);
  assert.deepEqual(next.readingTexts[0], before.readingTexts[0], "befintlig text orörd och först");
  assert.equal(next.readingTexts.length, 11);
  assert.equal(new Set(next.readingTexts.map((t) => t.id)).size, 11, "unika id");
  assert.deepEqual(next.exerciseTypes, ["quiz", "amneslasning"], "typen slås på");
  assert.deepEqual(next.quiz, before.quiz, "övrigt innehåll orört");
  assert.equal(validateArea(next).ok, true);
});

// --- Test 18: fel stoppar, varningar gör det inte ---------------------------

test("test 18: 3 alternativ, ogiltig kategori och answerIndex utanför stoppas med tydliga fel", () => {
  const bad = text("fel", 1, {
    questions: [
      q(1, { options: ["A", "B", "C"] }),
      q(2, { category: "analys" }),
      q(3, { answerIndex: 4 }),
    ],
  });
  const res = validateReadingTexts([bad, text("bra", 1)]);
  assert.equal(res.ok, false);
  const msg = res.errors.join(" | ");
  assert.match(msg, /Text 1 \("Rubrik fel"\) fråga q1: måste ha exakt 4 icke-tomma alternativ \(har 3\)/);
  assert.match(msg, /fråga q2: okänd kategori "analys" – giltiga: fakta, ordforstaelse, mellan_raderna, helhet_slutsats/);
  assert.match(msg, /fråga q3: answerIndex måste vara 0–3/);
  assert.deepEqual(res.valid.map((t) => t.id), ["bra"], "den felaktiga texten sparas inte");
});

test("test 18: nivå, tomma fält och dubblett-id på fråga är fel", () => {
  const res = validateReadingTexts([
    text("a", 4),
    text("b", 1, { title: "" }),
    text("c", 1, { body: " " }),
    text("d", 1, { questions: [q(1), q(1)] }),
    text("e", 1, { questions: [] }),
    text("f", 1, { questions: [q(1, { question: "" })] }),
  ]);
  const msg = res.errors.join(" | ");
  assert.match(msg, /level måste vara 1, 2, 3/);
  assert.match(msg, /rubriken \(title\) saknas/);
  assert.match(msg, /texten \(body\) saknas/);
  assert.match(msg, /dubblett-id/);
  assert.match(msg, /0 frågor/);
  assert.match(msg, /frågetexten saknas/);
  assert.equal(res.valid.length, 0);
});

test("test 18: ordantal, frågeantal och få texter är varningar, inte fel", () => {
  const kort = text("kort", 2, { body: words(10), questions: [q(1), q(2)] });
  const res = validateReadingTexts([kort], { expectedPerLevel: 3 });
  assert.equal(res.ok, true, res.errors.join(" | "));
  const msg = res.warnings.join(" | ");
  assert.match(msg, /10 ord \(riktintervall nivå 2: 80–150\)/);
  assert.match(msg, /2 frågor \(ska vara 4–6\)/);
  assert.match(msg, /nivå 1: 0 giltiga texter av 3 begärda/);
  assert.match(msg, /Nivå 1 saknar texter/);
  assert.match(msg, /Nivå 2 har bara 1 text/);
});

test("test 18: svarsposition och längdledtråd varnar per nivå", () => {
  const allaA = (id) => text(id, 2, { questions: [1, 2, 3, 4].map((n) => q(n, { answerIndex: 0 })) });
  const res = validateReadingTexts([allaA("a"), allaA("b"), allaA("c")]);
  assert.equal(res.ok, true);
  assert.match(res.warnings.join(" | "), /nivå 2: rätt svar är A i 12 av 12 frågor/);
  const lang = (id) =>
    text(id, 3, { questions: [1, 2, 3, 4, 5].map((n) => q(n, { options: ["Ett mycket långt rätt svar", "B", "C", "D"], answerIndex: 0 })) });
  assert.match(validateReadingTexts([lang("x"), lang("y")]).warnings.join(" | "), /längdledtråd/);
});

test("normalisering: nivå som sträng, kategori-stavningar, saknat id/textType/fråge-id", () => {
  const raw = { title: "Vikingarnas hus", level: "3", body: words(170),
    questions: [1, 2, 3, 4, 5].map((n) => ({ question: `F${n}?`, options: ["a", "b", "c", "d"], answerIndex: "1", category: "Mellan raderna" })) };
  const res = validateReadingTexts([raw]);
  assert.equal(res.ok, true, res.errors.join(" | "));
  const t = res.valid[0];
  assert.equal(t.id, "vikingarnas-hus");
  assert.equal(t.level, 3);
  assert.equal(t.textType, "fact");
  assert.deepEqual(t.questions.map((x) => x.id), ["q1", "q2", "q3", "q4", "q5"]);
  assert.equal(t.questions[0].category, "mellan_raderna");
  assert.equal(t.questions[0].answerIndex, 1);
});

test("parseReadingTextsPaste: tydliga fel för tomt, trasig JSON och fel form", () => {
  assert.match(parseReadingTextsPaste("").errors[0], /Klistra in/);
  assert.match(parseReadingTextsPaste("{ trasig").errors[0], /Hittar ingen JSON|inte giltig JSON/);
  assert.match(parseReadingTextsPaste('{"readingTexts": [ }').errors[0], /inte giltig JSON/);
  assert.match(parseReadingTextsPaste('{"quiz": []}').errors[0], /saknar texter/);
  assert.equal(parseReadingTextsPaste('Här är svaret: [{"id":"a"}] Lycka till!').list.length, 1);
});

// --- Test 19: redigera en fråga, ta bort en text ----------------------------

test("test 19: läraren redigerar en fråga och tar bort en text", () => {
  const a = addReadingTexts(area(), [text("t2", 2), text("t3", 3)]);
  const t2 = a.readingTexts.find((t) => t.id === "t2");
  const questions = t2.questions.map((x, i) => (i === 0 ? { ...x, question: "Ny fråga?", options: ["1", "2", "3", "4"], answerIndex: 3, category: "helhet_slutsats" } : x));
  const edited = updateReadingText(a, "t2", { title: "Ny rubrik", level: 3, questions });
  const e = edited.readingTexts.find((t) => t.id === "t2");
  assert.equal(e.title, "Ny rubrik");
  assert.equal(e.level, 3);
  assert.deepEqual(e.questions[0], { id: "q1", question: "Ny fråga?", options: ["1", "2", "3", "4"], answerIndex: 3, category: "helhet_slutsats" });
  assert.equal(validateArea(edited).ok, true);

  const removed = removeReadingText(edited, "t3");
  assert.deepEqual(removed.readingTexts.map((t) => t.id), ["vikingar-handel-1", "t2"]);
  assert.throws(() => removeReadingText(removed, "t3"), /redan tagits bort/);
  assert.throws(() => updateReadingText(removed, "t3", {}), /tagits bort/);
});

test("redigering med fel stoppas av validateArea (grinden)", () => {
  const a = area();
  const bad = updateReadingText(a, "vikingar-handel-1", { questions: [q(1, { options: ["A", "B"] })] });
  const res = validateArea(bad);
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /Ämnestext 1 \("Vikingarna köper och säljer"\) fråga q1: måste ha exakt 4/);
});

// --- Fältet på området: validateArea, merge, gamla nivåtexter --------------

test("§6.4: ett område med BARA ämnestexter kan sparas (utan quiz eller par)", () => {
  const res = validateArea({ name: "Fotosyntesen", exerciseTypes: ["amneslasning"], readingTexts: nine() });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.readingTexts.length, 9);
  assert.deepEqual(res.value.quiz, []);
  assert.deepEqual(res.value.exerciseTypes, ["amneslasning"]);
  assert.deepEqual(levelCounts(res.value.readingTexts), { 1: 3, 2: 3, 3: 3 });
  // Utan uttryckliga typer härleds typen ur innehållet.
  assert.deepEqual(validateArea({ name: "X", readingTexts: nine() }).value.exerciseTypes, ["amneslasning"]);
});

test("readingTexts blandas inte ihop med texts", () => {
  const res = validateArea({ name: "X", texts: [{ title: "Fakta", body: "Kort." }], readingTexts: [text("a", 1)] });
  assert.equal(res.value.texts.length, 1);
  assert.equal(res.value.readingTexts.length, 1);
  assert.equal(res.value.texts[0].questions, undefined);
});

test("gamla nivåtexter (#152) i fältet ignoreras: inget fel, räknas inte, släpps som förut", () => {
  const legacy = { id: "rt1", title: "Lästext", levels: { 1: { body: "x", questions: [] } } };
  assert.equal(isLegacyReadingText(legacy), true);
  assert.deepEqual(readingTextsOf({ readingTexts: [legacy, text("a", 1)] }).map((t) => t.id), ["a"]);
  const res = validateArea({ name: "X", quiz: area().quiz, readingTexts: [legacy] });
  assert.equal(res.ok, true);
  assert.equal(res.value.readingTexts, undefined);
  // Nya texter får inte krocka med en gammal posts id.
  const next = addReadingTexts({ readingTexts: [legacy] }, [text("rt1", 1)]);
  assert.deepEqual(next.readingTexts.map((t) => t.id), ["rt1", "rt1-2"]);
});

test("Lägg till innehåll (merge) behåller ämnestexterna och kan lägga till fler", () => {
  const a = area();
  const quizOnly = mergeAreaContent(a, { quiz: [{ question: "Ny?", options: ["a", "b"], answerIndex: 1 }] });
  assert.equal(quizOnly.ok, true, (quizOnly.errors || []).join(" | "));
  assert.deepEqual(quizOnly.value.readingTexts, a.readingTexts);

  const more = mergeAreaContent(a, { readingTexts: [text("vikingar-handel-1", 2)] });
  assert.equal(more.ok, true, (more.errors || []).join(" | "));
  assert.deepEqual(more.value.readingTexts.map((t) => t.id), ["vikingar-handel-1", "vikingar-handel-1-2"]);
  assert.equal(more.added.readingTexts, 1);
  assert.ok(more.value.exerciseTypes.includes("amneslasning"));

  const bad = mergeAreaContent(a, { readingTexts: [text("x", 9)] });
  assert.equal(bad.ok, false);
});

test("levelGaps: varning när en nivå saknar texter eller har för få", () => {
  assert.deepEqual(levelGaps([text("a", 1), text("b", 1), text("c", 2)]).map((g) => [g.level, g.count]), [[2, 1], [3, 0]]);
  assert.deepEqual(levelGaps(nine()), []);
});

test("underradens flik Ämnesläsning: visas med ämnestexter eller vald typ, inte för gamla nivåtexter", () => {
  const ids = (a) => tabsFor(a).map((t) => `${t.id}:${t.count}`);
  assert.deepEqual(ids({ readingTexts: [text("a", 1), text("b", 2)] }), ["amnes:2"]);
  assert.deepEqual(ids({ exerciseTypes: ["amneslasning"], readingTexts: [] }), ["amnes:0"]);
  assert.deepEqual(ids({ readingTexts: [{ id: "rt1", title: "x", levels: { 1: {} } }] }), []);
  assert.deepEqual(ids(area()), ["quiz:1", "amnes:1"]);
});

test("gamemode-visibility (inline, bootgrafen) ger samma svar som content.js-regeln", async () => {
  const { areaContentFlags } = await import("../src/gamemode-visibility.js");
  const { isPlayableAmnesText } = await import("../src/amneslasning/content.js");
  const giltig = text("ok", 2);
  const cases = {
    "gammal #152-post": [{ id: "rt1", title: "x", levels: { 1: { body: "b", questions: [q(1)] } } }],
    "nivå 0": [text("a", 0)],
    "nivå 4": [text("a", 4)],
    "nivå 2.5": [text("a", 2.5)],
    'nivå "3"': [text("a", "3")],
    'nivå "2.0"': [text("a", "2.0")],
    "nivå true": [text("a", true)],
    "nivå null": [{ ...text("a", 1), level: null }],
    "tomma questions": [text("a", 1, { questions: [] })],
    "questions saknas": [{ id: "a", title: "x", level: 1, body: "b" }],
    "id saknas": [{ ...text("a", 1), id: "" }],
    "id ej sträng": [{ ...text("a", 1), id: 7 }],
    "null och tal": [null, 3, "x", []],
    "giltig": [giltig],
    "gammal + giltig": [{ id: "rt1", levels: {} }, giltig],
    "tom lista": [],
  };
  for (const [namn, readingTexts] of Object.entries(cases)) {
    const regel = readingTextsOf({ readingTexts }).filter(isPlayableAmnesText).length > 0;
    assert.equal(areaContentFlags({ readingTexts }).readingTexts, regel, namn);
  }
  assert.equal(areaContentFlags({ readingTexts: [giltig] }).readingTexts, true);
  assert.equal(areaContentFlags({}).readingTexts, false);
});
