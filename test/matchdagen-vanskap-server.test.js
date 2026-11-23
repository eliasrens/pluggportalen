// ============================================================================
// Tester: Matchdagen 4 (#874) – synken till functions/matchdagen/ och vänskapsmatchens
// frågebank på servern (functions/md-vanskap-fragor.js). Spec §11.3, §15:
//   • kopian i functions/matchdagen/ är identisk med src/ (motorn + frågekällornas rena kod)
//   • servern väljer samma Plugga-frågor som solospelet (omradePool = omradeKalla:s urval)
//   • banken: källorna turas om, en ändlig källa upprepar inget förrän den är slut, inget facit i pub
//   • rättningen: Live:s gradeMult/gradeQuiz och Räknas checkAnswer
// game-shared.js byts mot de riktiga plainQuizPool/hasPassage (som test/matchdagen-fragor.test.js).
// Ren node: node --test test/matchdagen-vanskap-server.test.js
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { driftedFiles, sharedFiles, KALLOR } from "../admin/sync-matchdagen-functions.mjs";
import * as B from "../functions/md-vanskap-fragor.js";
import { GRANS } from "../src/prov/typer/delat.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const klipp = (src, namn) => {
  const start = src.indexOf(`export function ${namn}(`);
  return src.slice(start, src.indexOf("\n}\n", start) + 3);
};
const GS = read("src/game-shared.js");
const STUB = `${klipp(GS, "hasPassage")}\n${klipp(GS, "plainQuizPool")}`;
const HOOK = `export async function resolve(spec, ctx, next) {
  if (spec === "../game-shared.js" && ctx.parentURL.endsWith("/src/matchdagen/md-kallor.js")) {
    return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(STUB)}) };
  }
  return next(spec, ctx);
}`;

let K;
let normalizeInst;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  K = await import("../src/matchdagen/md-kallor.js");
  ({ normalizeInst } = await import("../src/matchdagen/md-inst.js"));
});

const lang = (n) => "x".repeat(n);
const OMRADEN = {
  "so/sverige": {
    quiz: [
      { question: "Vad heter Sveriges huvudstad?", options: ["Stockholm", "Göteborg", "Malmö"], answerIndex: 0 },
      { question: "Vilken älv är längst?", options: ["Klarälven", "Torne älv"], answerIndex: 1 },
      { question: "Enligt texten, vad hände?", options: ["A", "B"], answerIndex: 0, passage: "En text." },
      { question: "", options: ["A", "B"], answerIndex: 0 },
      { question: "Två lika?", options: ["Ja", "ja"], answerIndex: 0 },
      { question: "Sju alternativ?", options: ["1", "2", "3", "4", "5", "6", "7"], answerIndex: 0 },
      { question: lang(1001), options: ["a", "b"], answerIndex: 0 },
      { question: "Långt alternativ", options: [lang(301), "b"], answerIndex: 1 },
      { question: "Inget facit", options: ["a", "b"], answerIndex: 5 },
    ],
    pairs: [
      { term: "landskap", definition: "ett av Sveriges 25 gamla områden" },
      { term: "län", definition: "ett område med en egen region" },
      { term: "kommun", definition: "en ort med eget styre" },
      { term: "Län", definition: "dubbletten" },
      { termImage: "bild.png", definition: "bara bild" },
      { term: lang(301), definition: "för lång" },
    ],
  },
  "so/baraLasning": { quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0, passage: "P" }] },
  "so/ettPar": { pairs: [{ term: "a", definition: "b" }] },
  "so/tomt": {},
  "ma/addera": { generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } },
  "ma/klocka": { generator: { topic: "klocka", variants: ["las-av"], grade: "ak4" } },
};

describe("synken till functions/matchdagen/ (admin/sync-matchdagen-functions.mjs)", () => {
  it("kopian är identisk med src/ – motorn och frågekällornas rena kod", () => {
    assert.deepEqual(driftedFiles(), []);
    const kopior = sharedFiles().map(([, d]) => d);
    for (const f of ["md-motor.js", "md-vanskap.js", "md-config.js", "md-texter.js", "md-sasong.js", "kallor/rakna-core.js", "kallor/mult/generator.js"]) {
      assert.ok(kopior.includes(f), f);
    }
    assert.ok(KALLOR.some((f) => f.startsWith("matte-generator/")));
  });
  it("npm-skriptet, predeploy och servern importerar bara kopian", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.scripts["sync:matchdagen"], "node admin/sync-matchdagen-functions.mjs");
    assert.match(read("firebase.json"), /sync-matchdagen-functions\.mjs/);
    for (const f of ["functions/md-vanskap-fragor.js"]) {
      for (const [, imp] of read(f).matchAll(/from\s+"([^"]+)"/g)) assert.doesNotMatch(imp, /\.\.\/src\//, `${f}: ${imp}`);
    }
  });
});

describe("frågebanken på servern (§11.3)", () => {
  it("samma gränser som provets Hämta från område", () => {
    assert.equal(B.GRANS.fragetext, GRANS.fragetext);
    assert.equal(B.GRANS.alternativ, GRANS.alternativ);
  });

  it("normInst = md-inst.js normalizeInst för källorna och svarssättet", () => {
    for (const raw of [null, {}, { omraden: ["so/a", "so/a", "fel", " so/b "], tabeller: [7, 11, "3", 3], rakna: ["ma/x"], svarssatt: "skriv", klocka: 30 },
      { svarssatt: "konstig", klocka: 45 }]) {
      const c = normalizeInst(raw);
      const s = B.normInst(raw);
      assert.deepEqual({ omraden: s.omraden, tabeller: s.tabeller, rakna: s.rakna, svarssatt: s.svarssatt, klocka: s.klocka },
        { omraden: c.omraden, tabeller: c.tabeller, rakna: c.rakna, svarssatt: c.svarssatt, klocka: c.klocka });
    }
  });

  it("Plugga-området: servern väljer exakt solospelets frågor (omradeKalla)", () => {
    for (const [nyckel, area] of Object.entries(OMRADEN)) {
      const p = B.omradePool(area);
      const server = [...p.quiz.map((i) => `quiz:${i}`), ...p.par.map((i) => `par:${i}`)];
      assert.deepEqual(server, K.omradeKalla(nyckel, area).nycklar, nyckel);
    }
  });

  it("banken: källorna turas om, inget upprepas förrän källan är slut, inget facit i det eleven ser", () => {
    const inst = B.normInst({ omraden: ["so/sverige"], tabeller: [7], rakna: ["ma/addera", "ma/klocka"], lastext: false });
    const kallor = B.byggKallor(inst, OMRADEN, 5);
    assert.equal(kallor.length, 4);
    const r = skapaPrng("bank").tal;
    const bank = B.byggBank(kallor, { antal: 40, rng: r, fro: 9 });
    assert.equal(bank.length, 40);
    for (let v = 0; v < 40; v += 4) assert.equal(new Set(bank.slice(v, v + 4).map((p) => p.kalla.split(":")[0] + (p.kalla.startsWith("rakna") ? p.kalla : ""))).size, 4, `varv ${v / 4}`);
    const so = bank.filter((p) => p.kalla === "omrade:so/sverige").map((p) => p.pub.text);
    assert.equal(new Set(so.slice(0, 5)).size, 5); // 2 quiz + 3 par innan något upprepas
    for (const p of bank) {
      assert.deepEqual(Object.keys(p.pub).filter((k) => !["text", "typ", "alternativ", "inputMode", "tips", "bild"].includes(k)), []);
      assert.ok(p.r.facit !== undefined && p.r.facit !== "");
      if (p.pub.bild) assert.doesNotMatch(p.pub.bild, new RegExp(`"answer"|${p.r.facit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    }
    assert.ok(bank.some((p) => p.pub.bild), "klockan har en bild");
    assert.deepEqual(B.byggKallor(B.normInst({ omraden: ["so/tomt", "so/baraLasning", "so/ettPar"], lastext: false }), OMRADEN), []);
  });

  it("rättningen: multiplikation (flerval och skriv själv), quiz och Räkna", () => {
    const r = skapaPrng("ratta").tal;
    const [mf] = B.byggBank(B.byggKallor(B.normInst({ tabeller: [7] }), {}), { antal: 1, rng: r });
    const ratt = mf.pub.alternativ.indexOf(mf.r.facit);
    assert.deepEqual(B.ratta(mf, ratt), { giltig: true, ratt: true, facit: mf.r.facit });
    assert.equal(B.ratta(mf, (ratt + 1) % 4).ratt, false);
    assert.equal(B.ratta(mf, 9).giltig, false);
    const [ms] = B.byggBank(B.byggKallor(B.normInst({ tabeller: [7], svarssatt: "skriv" }), {}), { antal: 1, rng: r });
    assert.equal(ms.pub.typ, "skriv");
    assert.equal(B.ratta(ms, ` ${ms.r.facit} `).ratt, true);
    assert.equal(B.ratta(ms, "abc").giltig, false);
    const quiz = B.byggBank(B.byggKallor(B.normInst({ omraden: ["so/sverige"] }), OMRADEN), { antal: 5, rng: r });
    for (const q of quiz) {
      assert.equal(B.ratta(q, q.pub.alternativ.indexOf(q.r.facit)).ratt, true);
      assert.equal(B.ratta(q, q.pub.alternativ.findIndex((a) => a !== q.r.facit)).ratt, false);
      assert.equal(B.ratta(q, -1).giltig, false);
    }
    const [add] = B.byggBank(B.byggKallor(B.normInst({ rakna: ["ma/addera"] }), OMRADEN), { antal: 1, rng: r });
    assert.equal(B.ratta(add, add.r.facit).ratt, true);
    assert.equal(B.ratta(add, "1").ratt, false);
    assert.equal(B.ratta(add, "  ").giltig, false);
  });
});
