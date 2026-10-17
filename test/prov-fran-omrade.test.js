// ============================================================================
// Prov (#745, spec §10): "Hämta från område" – omvandlingen i
// src/prov/prov-fran-omrade.js (DOM-fri). Quiz → flerval, quiz med passage →
// textblock + flerval, par → para (3–10, fler delas), tidslinje → ordna
// (sorterad efter år), ämnestext → textblock + flerval. Allt som kommer ut
// klarar validateProv. Rutan (provl-fran-omrade.js) laddas bara med import().
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORDNA_FRAGA, PARA_FRAGA, antalText, delaJamnt, fragorFranOmrade, omradetsSaker,
} from "../src/prov/prov-fran-omrade.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { laggTillFragor, nyttProv } from "../src/prov/prov-redigera-ops.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const q = (question, options, answerIndex, extra = {}) => ({ question, options, answerIndex, ...extra });
const VIKING = "Vikingarna seglade långt. De handlade i Birka och Hedeby.";
const AREA = {
  name: "Vikingatiden",
  quiz: [
    q("Var låg Birka?", ["Björkö", "Gotland", "Öland"], 0),
    q("Var handlade de?", ["Birka", "Rom", "Paris"], 0, { passage: VIKING }),
    q("Hur seglade de?", ["Kort", "Långt"], 1, { passage: VIKING }),
    q("Vad hette guden?", ["Tor", "Zeus"], 0, { passage: "En annan text om gudar." }),
    q("Sju alternativ?", ["a", "b", "c", "d", "e", "f", "g"], 2),
  ],
  pairs: [
    { term: "Tor", definition: "Åska" },
    { term: "Oden", definition: "Visdom" },
    { term: "Freja", definition: "Kärlek" },
    { term: "", termImage: "apple", definition: "Ett äpple" },
    { term: "Loke", definition: "Lurendrejare" },
  ],
  timeline: [
    { event: "Slaget vid Hastings", year: 1066 },
    { event: "Lindisfarne plundras", year: 793 },
    { event: "Rom grundas", year: -753 },
    { event: "Birka grundas", year: 750 },
  ],
  readingTexts: [
    // Gammal nivåtext (#152) – samma fältnamn, inga egna frågor: tas aldrig med.
    { id: "gammal", title: "Gammal", levels: { 1: { body: "x", questions: [] } } },
    {
      id: "runor", title: "Runstenar", level: 2, body: "Runstenar restes till minne av döda.",
      questions: [q("Varför restes runstenar?", ["Till minne", "För skojs skull", "Som vägvisare", "Som gränser"], 0)],
    },
  ],
};

const alla = (area) => omradetsSaker(area).flatMap((g) => g.saker.filter((s) => !s.problem).map((s) => s.nyckel));
const giltig = (fragor) => {
  const r = validateProv({ namn: "Test", fragor });
  assert.ok(r.ok, r.errors.join(" | "));
  return r;
};

describe("omradetsSaker – listan med kryssrutor", () => {
  it("grupperar per sort och hoppar över tomma sorter", () => {
    const g = omradetsSaker(AREA);
    assert.deepEqual(g.map((x) => x.sort), ["quiz", "lasning", "par", "tidslinje", "amnes"]);
    assert.deepEqual(omradetsSaker({ quiz: [], pairs: [] }), []);
    assert.deepEqual(omradetsSaker(null), []);
  });

  it("frågor med passage ligger under sin text, och quizlistan har bara de utan", () => {
    const g = omradetsSaker(AREA);
    assert.deepEqual(g[0].saker.map((s) => s.nyckel), ["quiz:0", "quiz:4"]);
    const las = g[1].saker;
    assert.deepEqual(las.map((s) => s.nyckel), ["quiz:1", "quiz:2", "quiz:3"]);
    assert.match(las[0].del, /^Text 1: Vikingarna/);
    assert.equal(las[1].del, las[0].del);
    assert.match(las[2].del, /^Text 2: /);
  });

  it("saker som inte kan bli provfrågor har en orsak", () => {
    const g = omradetsSaker(AREA);
    assert.match(g[0].saker[1].problem, /7 alternativ/);
    const bild = g[2].saker[3];
    assert.match(bild.problem, /bara bild/);
    assert.match(bild.etikett, /bild → Ett äpple/);
    assert.equal(g[3].saker[2].info, "753 f.Kr.");
  });

  it("ämnestexterna läses med readingTextsOf – gamla nivåtexter syns inte", () => {
    const amnes = omradetsSaker(AREA).find((x) => x.sort === "amnes").saker;
    assert.equal(amnes.length, 1);
    assert.equal(amnes[0].etikett, "Runstenar");
    assert.equal(amnes[0].info, "1 fråga · nivå 2");
  });
});

describe("fragorFranOmrade – omvandlingen", () => {
  it("quizfråga → flerval (1 poäng, rätt index)", () => {
    const { fragor, varningar } = fragorFranOmrade(AREA, ["quiz:0"]);
    assert.deepEqual(varningar, []);
    assert.deepEqual(fragor, [{ id: "f1", typ: "flerval", fraga: "Var låg Birka?", poang: 1, alternativ: ["Björkö", "Gotland", "Öland"], ratt: 0 }]);
  });

  it("quiz med passage → textet en gång och flerval under, bara de valda", () => {
    const { fragor } = fragorFranOmrade(AREA, ["quiz:1", "quiz:2", "quiz:3"]);
    assert.deepEqual(fragor.map((f) => f.typ), ["text", "flerval", "flerval", "text", "flerval"]);
    assert.equal(fragor[0].brodtext, VIKING);
    assert.equal(fragor[3].brodtext, "En annan text om gudar.");
    const en = fragorFranOmrade(AREA, ["quiz:2"]).fragor;
    assert.deepEqual(en.map((f) => f.typ), ["text", "flerval"]);
    assert.equal(en[1].fraga, "Hur seglade de?");
    giltig(fragor);
  });

  it("quizfråga som inte går (7 alternativ) hoppas över med varning", () => {
    const { fragor, varningar } = fragorFranOmrade(AREA, ["quiz:4"]);
    assert.deepEqual(fragor, []);
    assert.match(varningar[0], /Sju alternativ.*hoppades över.*7 alternativ/);
  });

  it("par → en para-fråga med de valda paren; bildpar hoppas över med varning", () => {
    const { fragor, varningar } = fragorFranOmrade(AREA, ["par:0", "par:1", "par:3", "par:4"]);
    assert.equal(fragor.length, 1);
    assert.equal(fragor[0].typ, "para");
    assert.equal(fragor[0].fraga, PARA_FRAGA);
    assert.deepEqual(fragor[0].par, [
      { vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Loke", hoger: "Lurendrejare" },
    ]);
    assert.equal(fragor[0].poang, 3, "en poäng per par");
    assert.deepEqual(varningar, ["1 par har bara en bild och hoppades över – ett prov visar bara text."]);
  });

  it("färre än 3 par → ingen fråga, varning", () => {
    const { fragor, varningar } = fragorFranOmrade(AREA, ["par:0", "par:1", "par:3"]);
    assert.deepEqual(fragor, []);
    assert.equal(varningar.length, 2);
    assert.match(varningar[1], /minst 3 par \(2 gick att ta med\)/);
  });

  it("fler än 10 par delas jämnt i flera para-frågor (11 → 6 + 5)", () => {
    const pairs = Array.from({ length: 11 }, (_, i) => ({ term: `T${i}`, definition: `D${i}` }));
    const { fragor, varningar } = fragorFranOmrade({ pairs }, pairs.map((_, i) => `par:${i}`));
    assert.deepEqual(fragor.map((f) => f.par.length), [6, 5]);
    assert.deepEqual(fragor.map((f) => f.fraga), [`${PARA_FRAGA} (del 1 av 2)`, `${PARA_FRAGA} (del 2 av 2)`]);
    assert.match(varningar[0], /11 par blev 2/);
    giltig(fragor);
  });

  it("par med samma begrepp eller förklaring tas bara med en gång", () => {
    const pairs = [
      { term: "A", definition: "1" }, { term: "a", definition: "2" }, { term: "B", definition: "1 " },
      { term: "C", definition: "3" }, { term: "D", definition: "4" },
    ];
    const { fragor, varningar } = fragorFranOmrade({ pairs }, pairs.map((_, i) => `par:${i}`));
    assert.deepEqual(fragor[0].par.map((p) => p.vanster), ["A", "C", "D"]);
    assert.equal(varningar.length, 2);
    giltig(fragor);
  });

  it("tidslinje → ordna, sorterad efter år (f.Kr. först)", () => {
    const { fragor, varningar } = fragorFranOmrade(AREA, ["tid:0", "tid:1", "tid:2", "tid:3"]);
    assert.deepEqual(varningar, []);
    assert.equal(fragor.length, 1);
    assert.equal(fragor[0].typ, "ordna");
    assert.equal(fragor[0].fraga, ORDNA_FRAGA);
    assert.deepEqual(fragor[0].saker, ["Rom grundas", "Birka grundas", "Lindisfarne plundras", "Slaget vid Hastings"]);
    assert.equal(fragor[0].poang, 4);
  });

  it("händelser från samma år → bara den första (ordningen måste vara entydig)", () => {
    const timeline = [
      { event: "A", year: 1000 }, { event: "B", year: 1100 }, { event: "C", year: 1000 }, { event: "D", year: 1200 },
    ];
    const { fragor, varningar } = fragorFranOmrade({ timeline }, ["tid:0", "tid:1", "tid:2", "tid:3"]);
    assert.deepEqual(fragor[0].saker, ["A", "B", "D"]);
    assert.match(varningar[0], /"C" hoppades över: en annan vald händelse är också från 1000/);
  });

  it("fler än 10 händelser delas i flera ordna-frågor i tidsordning", () => {
    const timeline = Array.from({ length: 12 }, (_, i) => ({ event: `H${i}`, year: 2000 - i }));
    const { fragor } = fragorFranOmrade({ timeline }, timeline.map((_, i) => `tid:${i}`));
    assert.deepEqual(fragor.map((f) => f.saker.length), [6, 6]);
    assert.equal(fragor[0].saker[0], "H11");
    assert.equal(fragor[1].saker[5], "H0");
    giltig(fragor);
  });

  it("ämnestext → textblock med titeln + frågorna som flerval", () => {
    const { fragor } = fragorFranOmrade(AREA, ["amnes:0"]);
    assert.deepEqual(fragor.map((f) => f.typ), ["text", "flerval"]);
    assert.equal(fragor[0].titel, "Runstenar");
    assert.equal(fragor[0].brodtext, "Runstenar restes till minne av döda.");
    assert.deepEqual(fragor[1].alternativ.length, 4);
    assert.equal(fragor[1].ratt, 0);
  });

  it("för lång text (> 6000 tecken) hoppas över med sina frågor", () => {
    const lang = "a".repeat(6001);
    const area = { quiz: [q("F?", ["1", "2"], 0, { passage: lang })], readingTexts: [{ id: "t", title: "Lång", level: 1, body: lang, questions: [q("G?", ["1", "2", "3", "4"], 1)] }] };
    assert.ok(omradetsSaker(area).every((g) => g.saker.every((s) => /6000/.test(s.problem))));
    const { fragor, varningar } = fragorFranOmrade(area, ["quiz:0", "amnes:0"]);
    assert.deepEqual(fragor, []);
    assert.equal(varningar.length, 2);
  });

  it("allt på en gång: klarar validateProv, ordningen per sort, unika id", () => {
    const { fragor } = fragorFranOmrade(AREA, alla(AREA));
    giltig(fragor);
    assert.deepEqual(fragor.map((f) => f.typ), ["flerval", "text", "flerval", "flerval", "text", "flerval", "para", "ordna", "text", "flerval"]);
    assert.equal(new Set(fragor.map((f) => f.id)).size, fragor.length);
    assert.equal(antalText(fragor), "7 frågor och 3 textblock");
  });

  it("okända och tomma nycklar ignoreras", () => {
    assert.deepEqual(fragorFranOmrade(AREA, ["quiz:99", "x:1", "par:abc"]), { fragor: [], varningar: [] });
    assert.deepEqual(fragorFranOmrade(AREA, []), { fragor: [], varningar: [] });
  });

  it("läggs sist i ett befintligt prov – id som krockar byts", () => {
    const prov = { ...nyttProv(), fragor: [{ id: "f1", typ: "santfalskt", fraga: "Sant?", ratt: true, poang: 1 }] };
    const r = laggTillFragor(prov, fragorFranOmrade(AREA, ["quiz:0", "amnes:0"]).fragor);
    assert.ok(r.ok);
    assert.deepEqual(r.prov.fragor.map((f) => f.id), ["f1", "f2", "f3", "f4"]);
    giltig(r.prov.fragor);
  });
});

describe("delaJamnt", () => {
  it("delar i bitar om högst 10, så jämnt som möjligt", () => {
    const n = (len) => delaJamnt(Array.from({ length: len }, (_, i) => i)).map((b) => b.length);
    assert.deepEqual(n(3), [3]);
    assert.deepEqual(n(10), [10]);
    assert.deepEqual(n(11), [6, 5]);
    assert.deepEqual(n(21), [7, 7, 7]);
    assert.deepEqual(n(25), [9, 8, 8]);
  });
});

describe("rutan laddas lat (#271)", () => {
  it("provl-redigera.js importerar rutan bara med import()", () => {
    const red = readFileSync(join(SRC, "prov", "larare", "provl-redigera.js"), "utf8");
    assert.match(red, /await import\("\.\/provl-fran-omrade\.js"\)/);
    assert.doesNotMatch(red, /^import[^;]*provl-fran-omrade/m);
    assert.match(red, /data-act="omrade"[^<]*>[\s\S]*?Hämta från område/);
  });

  it("rutan läser områdena via data-content.js och visar ägaren som Innehållsstudion", () => {
    const ruta = readFileSync(join(SRC, "prov", "larare", "provl-fran-omrade.js"), "utf8");
    assert.match(ruta, /from "\.\.\/\.\.\/data-content\.js"/);
    assert.match(ruta, /createdByLabel/);
  });
});
