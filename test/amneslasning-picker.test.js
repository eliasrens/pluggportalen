// Ämnesläsning – elevflödet (#672): textval, läst-rad, återupptagning, kortet
// och bootgrafen. Spec docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §4, §10 test 10–13, 21.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_READ_MESSAGE,
  amnesSearchOrder,
  pendingKey,
  pickAmnesText,
  playableTexts,
  readProgress,
  readProgressLine,
} from "../src/amneslasning/picker.js";
import { areaOf, withStartedAmnesText, applyAmnesCompletion, buildAmnesAttempt } from "../src/amneslasning/progress.js";
import { normalizeLasresa } from "../src/lasresan/progress.js";
import { loadPending, savePending, clearPending, PENDING_PREFIX } from "../src/lasresan/reader-logic.js";
import { cheer } from "../src/lasresan/ui-summary.js";
import {
  GAMEMODES,
  areaContentFlags,
  areaStarModes,
  visibleGamemodesForClassArea,
} from "../src/gamemode-visibility.js";

const q = (id, answerIndex = 0) => ({
  id,
  question: `Fråga ${id}?`,
  options: ["A", "B", "C", "D"],
  answerIndex,
  category: "fakta",
});
const t = (id, level, n = 3) => ({
  id,
  title: `Text ${id}`,
  level,
  textType: "fact",
  body: "Lite text.",
  questions: Array.from({ length: n }, (_, k) => q(`q${k + 1}`)),
});

// Ett SO-område: 3 texter per nivå.
const VIKINGAR = [t("v1a", 1), t("v1b", 1), t("v1c", 1), t("v2a", 2), t("v2b", 2), t("v2c", 2), t("v3a", 3), t("v3b", 3), t("v3c", 3)];
const read = (entries) => ({ read: Object.fromEntries(entries.map(([id, lastAt]) => [id, { count: 1, lastAt }])), currentTextId: null });

// --- Test 10: oläst text på elevens ämnesnivå --------------------------------

test("Test 10: nästa text är en oläst text på elevens ämnesnivå", () => {
  for (const lvl of [1, 2, 3]) {
    const p = pickAmnesText(VIKINGAR, lvl, areaOf(undefined, "vikingar"));
    assert.equal(p.text.level, lvl);
    assert.equal(p.resumed, false);
    assert.equal(p.allRead, false);
  }
  // Redan lästa på nivån hoppas över.
  const p = pickAmnesText(VIKINGAR, 2, read([["v2a", 10], ["v2b", 20]]));
  assert.equal(p.text.id, "v2c");
});

// --- Test 11: närmaste nivå, sedan längst tillbaka ----------------------------

test("Test 11: inga olästa på nivån → närmaste nivå (lättare först)", () => {
  assert.deepEqual(amnesSearchOrder(1), [1, 2, 3]);
  assert.deepEqual(amnesSearchOrder(2), [2, 1, 3]);
  assert.deepEqual(amnesSearchOrder(3), [3, 2, 1]);
  // Nivå 2 utläst → nivå 1 (lika nära åt båda håll → lättare).
  const p = pickAmnesText(VIKINGAR, 2, read([["v2a", 1], ["v2b", 2], ["v2c", 3]]));
  assert.equal(p.text.level, 1);
  // Nivå 2 utläst och nivå 1 utläst → nivå 3.
  const p2 = pickAmnesText(VIKINGAR, 2, read([["v2a", 1], ["v2b", 2], ["v2c", 3], ["v1a", 4], ["v1b", 5], ["v1c", 6]]));
  assert.equal(p2.text.level, 3);
  assert.equal(p2.allRead, false);
  // Området saknar nivån helt → närmaste nivå som har texter.
  const bara3 = [t("x3", 3)];
  assert.equal(pickAmnesText(bara3, 1, areaOf(undefined, "x")).text.id, "x3");
});

test("Test 11: allt läst → texten som lästes längst tillbaka, med vänligt besked", () => {
  const all = VIKINGAR.map((x, k) => [x.id, 100 + k]);
  all[5][1] = 5; // v2c lästes först
  const p = pickAmnesText(VIKINGAR, 3, read(all));
  assert.equal(p.text.id, "v2c");
  assert.equal(p.allRead, true);
  assert.equal(ALL_READ_MESSAGE, "Du har läst alla texter i området! Här är en du läste för ett tag sedan.");
});

test("textvalet hoppar över trasiga texter och ger null för ett tomt område", () => {
  const blandat = [null, { id: "utan-fragor", level: 1, questions: [] }, { id: "fel-niva", level: 7, questions: [q("q1")] }, t("ok", 2)];
  assert.deepEqual(playableTexts(blandat).map((x) => x.id), ["ok"]);
  // Gamla nivåtexter (#152) räknas aldrig – samma regel som content.isAmnesText (#673).
  const gammal = { id: "g1", title: "Gammal", levels: { 1: { body: "…", questions: [q("q1")] } } };
  assert.deepEqual(playableTexts([gammal, t("ny", 1)]).map((x) => x.id), ["ny"]);
  assert.deepEqual(readProgress([gammal], { read: { g1: { count: 1 } } }), { read: 0, total: 0 });
  assert.equal(pickAmnesText([], 2, areaOf(undefined, "a")), null);
  assert.equal(pickAmnesText(undefined, 2, areaOf(undefined, "a")), null);
});

// --- Diskret rad: aldrig nivåsiffror -------------------------------------------

test("läst-raden: 'Du har läst 4 av 9 texter i området', bara texter som finns kvar", () => {
  const state = read([["v1a", 1], ["v2a", 2], ["v2b", 3], ["v3a", 4], ["borttagen", 5]]);
  const prog = readProgress(VIKINGAR, state);
  assert.deepEqual(prog, { read: 4, total: 9 });
  assert.equal(readProgressLine(prog), "Du har läst 4 av 9 texter i området");
  assert.equal(readProgressLine({ read: 0, total: 1 }), "Du har läst 0 av 1 text i området");
  assert.doesNotMatch(readProgressLine(prog), /nivå/i);
});

// --- Test 12: påbörjad text återupptas efter omladdning --------------------------

test("Test 12: påbörjad text återupptas (Firestore-läget + låsta svar i localStorage)", () => {
  // Eleven startar en text …
  const first = pickAmnesText(VIKINGAR, 2, areaOf(undefined, "vikingar"));
  const started = withStartedAmnesText(undefined, { subjectId: "so", areaId: "vikingar", textId: first.text.id }, 1000);
  // … och svarar på en fråga innan sidan laddas om.
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const key = pendingKey("vikingar", "elev1");
  savePending(storage, key, first.text.id, [{ qid: "q1", chosen: 2 }]);

  // Omladdning: samma text, återupptagen, med svaret kvar – även om nivån ändrats.
  const again = pickAmnesText(VIKINGAR, 3, areaOf(started.amneslasning, "vikingar"));
  assert.equal(again.text.id, first.text.id);
  assert.equal(again.resumed, true);
  assert.deepEqual(loadPending(storage, key, again.text.id), [{ qid: "q1", chosen: 2 }]);

  // Läsresans påbörjade text ligger på en egen nyckel och påverkas inte.
  savePending(storage, "elev1", "lr-n4-x", [{ qid: "q1", chosen: 0 }]);
  clearPending(storage, key);
  assert.deepEqual(loadPending(storage, "elev1", "lr-n4-x"), [{ qid: "q1", chosen: 0 }]);
  assert.ok(store.has(PENDING_PREFIX + "elev1"));
});

test("Test 12: en borttagen påbörjad text ger ny text med stale (force-start)", () => {
  const started = withStartedAmnesText(undefined, { subjectId: "so", areaId: "vikingar", textId: "borttagen" }, 1000);
  const p = pickAmnesText(VIKINGAR, 2, areaOf(started.amneslasning, "vikingar"));
  assert.equal(p.resumed, false);
  assert.equal(p.stale, true);
  assert.equal(p.text.level, 2);
});

test("efter en färdig text väljs nästa olästa (läst-listan från applyAmnesCompletion)", () => {
  const text = VIKINGAR[3]; // v2a
  const started = withStartedAmnesText(undefined, { subjectId: "so", areaId: "vikingar", textId: text.id }, 1000);
  const attempt = buildAmnesAttempt(text, text.questions.map((x) => ({ qid: x.id, chosen: 0 })), { subjectId: "so", areaId: "vikingar" });
  const out = applyAmnesCompletion({ lasresa: normalizeLasresa(undefined), amneslasning: started.amneslasning }, attempt, 2000);
  const area = areaOf(out.amneslasning, "vikingar");
  assert.equal(area.currentTextId, null);
  assert.deepEqual(readProgress(VIKINGAR, area), { read: 1, total: 9 });
  assert.equal(pickAmnesText(VIKINGAR, 2, area).text.id, "v2b");
});

// --- Test 13 + 21: kortet syns bara med ämnestexter, i alla ämnen ----------------

test("Test 13: kortet syns bara i områden som har ämnestexter", () => {
  const ids = (area) => visibleGamemodesForClassArea(area, null).map((gm) => gm.id);
  const quizArea = { quiz: [{ question: "?", options: ["a", "b"], answerIndex: 0 }] };
  assert.ok(!ids(quizArea).includes("amneslasning"));
  assert.equal(areaContentFlags(quizArea).readingTexts, false);
  assert.equal(areaContentFlags({ readingTexts: [] }).readingTexts, false);
  assert.equal(areaContentFlags({ readingTexts: [{ id: "x", questions: [] }] }).readingTexts, false);
  assert.ok(ids({ ...quizArea, readingTexts: VIKINGAR }).includes("amneslasning"));
  // Faktatexterna (`texts`) tänder INTE kortet – bara readingTexts.
  assert.ok(!ids({ texts: [{ title: "Fakta", body: "…" }] }).includes("amneslasning"));
});

test("Test 13: ett område med BARA ämnestexter listas för eleven (bara Ämnesläsning)", () => {
  // pages-elev.js döljer områden utan synliga lägen – ett rent ämnesläsningsområde syns.
  assert.deepEqual(visibleGamemodesForClassArea({ readingTexts: VIKINGAR }, null).map((gm) => gm.id), ["amneslasning"]);
  // Läraren kan dölja läget som alla andra (område/klass).
  assert.deepEqual(visibleGamemodesForClassArea({ readingTexts: VIKINGAR, hiddenModes: ["amneslasning"] }, null), []);
  assert.deepEqual(visibleGamemodesForClassArea({ readingTexts: VIKINGAR }, { hiddenModes: ["amneslasning"] }), []);
  // Inga stjärnor: läget räknas inte i stjärn-nämnaren.
  assert.equal(GAMEMODES.find((gm) => gm.id === "amneslasning").noStars, true);
  assert.deepEqual(areaStarModes({ readingTexts: VIKINGAR }, null), []);
});

test("Test 21: ett engelskaområde fungerar som ett SO-område", () => {
  const english = [
    { ...t("en-pets-1", 1), title: "My dog Max", body: "Max is my dog. He likes to run in the park." },
    { ...t("en-pets-2", 2), title: "Pets in Britain" },
    { ...t("en-pets-3", 3), title: "Why people keep pets", textType: "story" },
  ];
  const area = { name: "Animals", readingTexts: english };
  assert.ok(visibleGamemodesForClassArea(area, null).some((gm) => gm.id === "amneslasning"));
  const p = pickAmnesText(english, 2, areaOf(undefined, "animals", "engelska"));
  assert.equal(p.text.id, "en-pets-2");
  const attempt = buildAmnesAttempt(p.text, p.text.questions.map((x) => ({ qid: x.id, chosen: 0 })), { subjectId: "engelska", areaId: "animals" });
  assert.equal(attempt.subjectId, "engelska");
  assert.equal(attempt.correct, 3);
  assert.equal(attempt.earnedMoney, 15);
});

test("sammanfattningen är Läsresans – samma positiva rubriker", () => {
  assert.equal(cheer(3, 3).text, "Alla rätt!");
  assert.equal(cheer(0, 3).text, "Bra kämpat!");
});

// --- Bootgrafen (#271): allt laddas med import() ---------------------------------

test("Ämnesläsningen ligger utanför den statiska bootgrafen från app.js", () => {
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
      if (m[1].startsWith(".")) queue.push(resolve(dirname(file), m[1]));
    }
  }
  const bad = [...seen].filter(
    (f) => f.includes(join(root, "amneslasning")) || f.endsWith("data-amneslasning.js") || f.includes(join(root, "lasresan"))
  );
  assert.deepEqual(bad, [], "Ämnesläsning-moduler i bootgrafen");
  assert.ok(seen.size > 20, `bootgrafen verkar för liten (${seen.size})`);
  const gm = readFileSync(join(root, "gamemodes.js"), "utf8");
  assert.match(gm, /import\(["']\.\/amneslasning\/page-amneslasning\.js["']\)/);
  assert.match(gm, /import\(["']\.\/amneslasning\/picker\.js["']\)/);
});
