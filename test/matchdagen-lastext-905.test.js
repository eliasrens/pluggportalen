// ============================================================================
// Tester: Matchdagen – visa lästext till frågorna (#905). Spec
// UTVECKLINGSUPPDRAG_MATCHDAGEN_LASNING.md §1–§5:
//   • lastext AV = exakt som före #905 (ögonblicksbild mot det gamla urvalet: plainQuizPool +
//     omradetsSaker, frågor med lästext aldrig med)
//   • lastext PÅ = alla frågor, lästexten i Fraga.kontext
//   • frågor som hänvisar till texten hoppas över vid AV; ett område med bara lästextfrågor AV/PÅ
//   • 300-gränsen (QUIZ_PASSAGE_MAX) bara i vänskapsmatcherna
//   • klienten (md-kallor.js) och servern (functions/md-vanskap-fragor.js) väljer samma
//   • klockan +15 s (md-config.js LASTEXT_EXTRA_S), förklaringen efter fel svar
//   • matchdagenInst.lastext: saknas = true, klienten och servern lika
// Ren node: node --test test/matchdagen-lastext-905.test.js
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import * as B from "../functions/md-vanskap-fragor.js";
import { omradetsSaker } from "../src/prov/prov-fran-omrade.js";
import { quizUrval, VANSKAP_LASTEXT_MAX } from "../src/matchdagen/md-lastext.js";
import { QUIZ_PASSAGE_MAX, passageCheck } from "../src/live/modes/quiz-passage.js";
import { prepareQuizQuestion } from "../src/live/modes/plugga-quiz-core.js";
import { LASTEXT_EXTRA_S, FORKLARING_MS } from "../src/matchdagen/delat/md-config.js";
import { normalizeInst, sammaInst, STANDARD_INST } from "../src/matchdagen/md-inst.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const klipp = (src, namn) => {
  const start = src.indexOf(`export function ${namn}(`);
  return src.slice(start, src.indexOf("\n}\n", start) + 3);
};
// Det gamla urvalet (före #905) med de RIKTIGA plainQuizPool/hasPassage ur game-shared.js
// (som drar in Firebase och kan inte importeras i node).
const GS = read("src/game-shared.js");
const utanExport = (f) => f.replace(/^export /, "");
const gammal = new Function(`${utanExport(klipp(GS, "hasPassage"))}\n${utanExport(klipp(GS, "plainQuizPool"))}\nreturn { hasPassage, plainQuizPool };`)();
function gamlaQuizNycklar(area) {
  const quiz = Array.isArray(area?.quiz) ? area.quiz : [];
  const giltiga = new Set(omradetsSaker(area || {}).filter((g) => g.sort === "quiz" || g.sort === "par")
    .flatMap((g) => g.saker).filter((s) => !s.problem).map((s) => s.nyckel));
  const ut = [];
  for (const q of gammal.plainQuizPool(quiz)) {
    const i = quiz.indexOf(q);
    if (!gammal.hasPassage(q) && giltiga.has(`quiz:${i}`)) ut.push(`quiz:${i}`);
  }
  return ut;
}

let K;
let F;
let S;
before(async () => {
  K = await import("../src/matchdagen/md-kallor.js");
  F = await import("../src/matchdagen/md-fragor.js");
  S = await import("../src/matchdagen/md-svar.js");
});

const TEXT = "Vikingarnas långskepp var smala och lätta. De kunde både ros och seglas.";
const LANG = `${"Det var en gång en lång text. ".repeat(14)}Slut.`; // > 300 tecken
const OMRADEN = {
  "so/blandat": {
    quiz: [
      { question: "Vad heter Sveriges huvudstad?", options: ["Stockholm", "Göteborg", "Malmö"], answerIndex: 0, explanation: "Stockholm är huvudstad sedan 1600-talet." },
      { question: "Enligt texten, varför var skeppen grunda?", options: ["Floder", "Storm"], answerIndex: 0, passage: TEXT, explanation: "Grunda skepp kom upp i floderna." },
      { question: "Hur tog man sig fram?", options: ["Rodd och segel", "Bara segel"], answerIndex: 0, passage: `  ${TEXT}\n\n ` },
      { question: "Vad handlar den långa texten om?", options: ["En text", "Inget"], answerIndex: 0, passage: LANG },
      { question: "", options: ["A", "B"], answerIndex: 0, passage: TEXT },
      { question: "Två lika?", options: ["Ja", "ja"], answerIndex: 0, passage: TEXT },
      { question: "Vilken älv är längst?", options: ["Klarälven", "Torne älv"], answerIndex: 1 },
    ],
    pairs: [
      { term: "landskap", definition: "ett av Sveriges 25 gamla områden" },
      { term: "län", definition: "ett område med en egen region" },
    ],
  },
  "so/baraLasning": {
    quiz: [
      { question: "Vem skrev texten enligt författaren?", options: ["Ida", "Bo"], answerIndex: 0, passage: "Ida skrev en dikt." },
      { question: "Vad gjorde Ida?", options: ["Skrev", "Sov"], answerIndex: 0, passage: "Ida skrev en dikt." },
    ],
  },
  "so/utanLasning": { quiz: [{ question: "1 + 1?", options: ["2", "3"], answerIndex: 0 }] },
  "so/tomt": {},
};

describe("urvalet: lästext AV = som före #905", () => {
  it("ögonblicksbild mot det gamla urvalet (plainQuizPool + omradetsSaker) – och OMRADEN-fixturen", () => {
    for (const [nyckel, area] of Object.entries(OMRADEN)) {
      const quiz = K.omradeKalla(nyckel, area, { lastext: false }).nycklar.filter((k) => k.startsWith("quiz:"));
      assert.deepEqual(quiz, gamlaQuizNycklar(area), nyckel);
    }
    assert.deepEqual(K.omradeKalla("so/blandat", OMRADEN["so/blandat"]).nycklar,
      ["quiz:0", "quiz:6", "par:0", "par:1"], "utan lastext-val: AV (omradeKalla:s standard)");
  });
  it("frågor som hänvisar till texten (och alla med lästext) hoppas över; ingen kontext", async () => {
    const s = await F.skapaFragestrom({ inst: { omraden: ["so/blandat"], lastext: false }, uid: "u", hamtaOmrade: async (a, b) => OMRADEN[`${a}/${b}`], lagring: minne(), rng: skapaPrng("av").tal });
    for (let n = 0; n < 8; n++) {
      const f = s.nasta();
      assert.equal(f.kontext, undefined);
      assert.doesNotMatch(f.text, /Enligt texten|Hur tog man sig fram/);
    }
  });
  it("ett område med bara lästextfrågor: AV inga frågor, PÅ alla med texten", () => {
    assert.deepEqual(K.omradeKalla("so/baraLasning", OMRADEN["so/baraLasning"], { lastext: false }).nycklar, []);
    const pa = quizUrval(OMRADEN["so/baraLasning"].quiz, { lastext: true });
    assert.deepEqual(pa, [{ i: 0, kontext: "Ida skrev en dikt." }, { i: 1, kontext: "Ida skrev en dikt." }], "texthänvisningar tillåtna när texten visas");
    assert.deepEqual(K.omradeKalla("so/baraLasning", OMRADEN["so/baraLasning"], { lastext: true }).nycklar, ["quiz:0", "quiz:1"]);
  });
});

describe("urvalet: lästext PÅ", () => {
  it("alla giltiga frågor, lästexten normaliserad (som Live) – hela texten i elevens egna matcher", async () => {
    const k = K.omradeKalla("so/blandat", OMRADEN["so/blandat"], { lastext: true });
    assert.deepEqual(k.nycklar, ["quiz:0", "quiz:1", "quiz:2", "quiz:3", "quiz:6", "par:0", "par:1"], "tom fråga och dubbla alternativ bort");
    const r = skapaPrng("pa").tal;
    assert.equal(k.fraga("quiz:1", r).kontext, TEXT);
    assert.equal(k.fraga("quiz:2", r).kontext, TEXT, "blanksteg och radbrytningar ihop");
    assert.equal(k.fraga("quiz:3", r).kontext, LANG.trim(), "ingen längdgräns i elevens egna matcher");
    assert.equal(k.fraga("quiz:0", r).kontext, undefined, "frågor utan lästext har ingen kontext");
    assert.equal(k.fraga("par:0", r).kontext, undefined);
  });
  it("frågeströmmen (md-fragor.js) följer inst.lastext – saknas = på", async () => {
    for (const inst of [{ omraden: ["so/baraLasning"] }, { omraden: ["so/baraLasning"], lastext: true }]) {
      const s = await F.skapaFragestrom({ inst, uid: "u", hamtaOmrade: async (a, b) => OMRADEN[`${a}/${b}`], lagring: minne(), rng: skapaPrng("s").tal });
      assert.equal(s.tom, false);
      const f = s.nasta();
      assert.equal(f.kontext, "Ida skrev en dikt.");
      assert.equal(s.ratta(f, f.ratt).ratt, true, "rättningen är densamma");
    }
  });
  it("samma regel som Live-läget (quiz-passage.js): PÅ = Live med showPassage, utan Live-gränsen", () => {
    for (const q of OMRADEN["so/blandat"].quiz) {
      const live = prepareQuizQuestion(q, 0, { showPassage: true });
      const md = passageCheck(q, { showPassage: true });
      if (live.ok) assert.equal(md.passage, live.q.passage || "");
      if (!live.ok && live.reason === "lang-passage") assert.equal(passageCheck(q, { showPassage: true, maxPassage: Infinity }).reason, null);
    }
  });
});

describe("300-gränsen bara i vänskapsmatcherna, och klienten = servern", () => {
  it("gränsen är Live:s", () => {
    assert.equal(VANSKAP_LASTEXT_MAX, 300);
    assert.equal(QUIZ_PASSAGE_MAX, 300);
    assert.ok(LANG.length > 300);
  });
  it("vänskapsmatchen hoppar över en lästext längre än 300 tecken, elevens egna matcher inte", () => {
    assert.deepEqual(B.omradePool(OMRADEN["so/blandat"], true).quiz, [0, 1, 2, 6]);
    assert.ok(K.omradeKalla("so/blandat", OMRADEN["so/blandat"], { lastext: true }).nycklar.includes("quiz:3"));
  });
  it("samma frågor och lästexter på klienten och servern (AV och PÅ med vänskapens gräns)", () => {
    for (const lastext of [false, true]) {
      for (const [nyckel, area] of Object.entries(OMRADEN)) {
        const p = B.omradePool(area, lastext);
        const k = K.omradeKalla(nyckel, area, { lastext, maxPassage: VANSKAP_LASTEXT_MAX });
        assert.deepEqual([...p.quiz.map((i) => `quiz:${i}`), ...p.par.map((i) => `par:${i}`)], k.nycklar, `${nyckel} lastext=${lastext}`);
        const r = skapaPrng("x").tal;
        for (const i of p.quiz) assert.equal(p.kontext[i] || undefined, k.fraga(`quiz:${i}`, r).kontext, `${nyckel} quiz:${i}`);
      }
    }
  });
  it("serverns bank: kontext i det eleven ser, förklaringen bara i facit (r) och i svaret efter fel", () => {
    const kallor = B.byggKallor(B.normInst({ omraden: ["so/blandat"] }), OMRADEN);
    const bank = B.byggBank(kallor, { antal: 12, rng: skapaPrng("b").tal });
    const med = bank.find((p) => p.pub.kontext);
    assert.ok(med, "lästext på som standard");
    assert.equal(med.pub.kontext, TEXT);
    for (const p of bank) assert.equal(p.pub.forklaring, undefined, "förklaringen är inte elevsynlig före svaret");
    const huvudstad = bank.find((p) => p.pub.text === "Vad heter Sveriges huvudstad?");
    const ratt = huvudstad.pub.alternativ.indexOf("Stockholm");
    assert.equal(B.ratta(huvudstad, (ratt + 1) % huvudstad.pub.alternativ.length).forklaring, "Stockholm är huvudstad sedan 1600-talet.");
    assert.ok(!bank.some((p) => p.pub.text === "Vad handlar den långa texten om?"), "för lång text i vänskapsmatchen");
    const av = B.byggBank(B.byggKallor(B.normInst({ omraden: ["so/blandat"], lastext: false }), OMRADEN), { antal: 12, rng: skapaPrng("b").tal });
    assert.ok(!av.some((p) => p.pub.kontext));
  });
  it("servern läser lästexten ur samma rena kod (kopian, inte en egen)", () => {
    assert.match(read("functions/md-vanskap-fragor.js"), /from "\.\/matchdagen\/kallor\/matchdagen\/md-lastext\.js"/);
    assert.equal(read("functions/matchdagen/kallor/matchdagen/md-lastext.js"), read("src/matchdagen/md-lastext.js"));
    assert.equal(read("functions/matchdagen/kallor/live/modes/quiz-passage.js"), read("src/live/modes/quiz-passage.js"));
    assert.match(read("functions/md-vanskap-spel.js"), /forklaring/, "mdSvar skickar förklaringen");
  });
});

describe("matchdagenInst.lastext", () => {
  it("saknas = true, bara false stänger av – klienten och servern lika", () => {
    assert.equal(STANDARD_INST.lastext, true);
    for (const raw of [null, {}, { lastext: true }, { lastext: false }, { lastext: "nej" }, { lastext: 0 }]) {
      const c = normalizeInst(raw).lastext;
      assert.equal(c, raw?.lastext !== false, JSON.stringify(raw));
      assert.equal(B.normInst(raw).lastext, c, JSON.stringify(raw));
    }
    assert.equal(sammaInst({ lastext: false }, {}), false);
    assert.equal(sammaInst({ lastext: true }, {}), true);
  });
  it("reglerna: lastext är en valfri bool i validMatchdagenInst", () => {
    const r = read("firestore.rules");
    const f = r.slice(r.indexOf("function validMatchdagenInst"), r.indexOf("function validMatchdagenInst") + 1200);
    assert.match(f, /'foljPlugga', 'lastext', 'updatedAt'/);
    assert.match(f, /\(!\('lastext' in d\) \|\| d\.lastext is bool\)/);
  });
});

describe("frågekortet: klockan och förklaringen", () => {
  it("+15 s för en fråga med lästext när läraren valt klocka – annars oförändrat", () => {
    assert.equal(LASTEXT_EXTRA_S, 15);
    assert.equal(S.klockaFor(30, { kontext: "T" }), 45);
    assert.equal(S.klockaFor(60, { kontext: "T" }), 75);
    assert.equal(S.klockaFor(30, { text: "Q" }), 30);
    assert.equal(S.klockaFor(0, { kontext: "T" }), 0, "klockan av förblir av");
  });
  it("ett fel svar med förklaring står kvar längre (högst FORKLARING_MS.max)", () => {
    assert.equal(S.felMs(""), S.FEL_MS);
    assert.equal(S.felMs("abc"), S.FEL_MS + 3 * FORKLARING_MS.perTecken);
    assert.equal(S.felMs("x".repeat(10000)), FORKLARING_MS.max);
  });
  it("solospelets anropare ger klockan med klockaFor; vänskapen har serverns tid", () => {
    for (const f of ["src/matchdagen/vy/md-match-spel.js", "src/matchdagen/vy/md-straff-spel.js", "src/matchdagen/vy/md-vy-lager.js"]) {
      assert.match(read(f), /klocka: klockaFor\(S\.inst\.klocka, /, f);
    }
  });
  it("Plugga-quizfrågan bär sin förklaring; kortet visar den efter fel svar", () => {
    const f = K.omradeKalla("so/blandat", OMRADEN["so/blandat"], { lastext: false }).fraga("quiz:0", skapaPrng("f").tal);
    assert.equal(f.forklaring, "Stockholm är huvudstad sedan 1600-talet.");
    const src = read("src/matchdagen/md-svar.js");
    assert.match(src, /<p class="md-fraga-kontext">\$\{esc\(fraga\.kontext\)\}<\/p>/);
    assert.match(src, /r\.ratt \? "" : String\(r\.forklaring \|\| fraga\.forklaring \|\| ""\)/);
    assert.match(src, /md-fraga-forklaring/);
  });
});

/** localStorage i minnet. */
function minne() {
  const m = new Map();
  return { hamta: (k) => m.get(k) ?? null, spara: (k, v) => m.set(k, v) };
}
