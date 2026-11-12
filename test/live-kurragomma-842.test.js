// ============================================================================
// Kurragömma G (#842) – rättningsrundan efter slut-QA, ren Node (ingen emulator):
//   1. auto-låsningen skickas LAS_AUTO_FORE_MS (300 ms) FÖRE gömfasens slut
//      (kge-logik autoLasDags) och LAS_MARGINAL_MS är 5 s
//   2. tangentfiltret (scen/kg-styrning.js): W/A/S/D styr i ett sifferfält
//      (bokstäverna skrivs inte in), aldrig pilarna i ett fält, inget i ett textfält
//   3. sidomenyn: body.kge-match bara i fasen "live" (kge-logik sattSidomeny)
//   4. perQuestion ur kgPlayers.fragor (functions/kurragomma-fragor.js) ger EXAKT
//      samma rader som meteorstorm-resultat.js fragestatistik(answers) – slumpade svar
// Serversidan av 1 och 4 mot emulatorn: test/functions-kurragomma-842.test.mjs.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LAS_MARGINAL_MS, LAS_AUTO_FORE_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { autoLasDags, sattSidomeny, SIDOMENY_KLASS } from "../src/live/formats/kurragomma/kge-logik.js";
import { faltTyp, faltMedFokus, styrTangent } from "../src/live/formats/kurragomma/scen/kg-styrning.js";
import { fragaFalt, fragaUrFalt, fragorOkning, fragestatistikUrSpelare } from "../functions/kurragomma-fragor.js";
import { fragestatistik, questionKey } from "../functions/meteorstorm-resultat.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";

describe("#842 1: auto-låsningen före 0:00", () => {
  const gomSlut = 1_800_000_030_000;
  it("LAS_MARGINAL_MS är 5 s och auto-skicket ligger 300 ms före gömslutet", () => {
    assert.equal(LAS_MARGINAL_MS, 5000);
    assert.equal(LAS_AUTO_FORE_MS, 300);
  });
  it("autoLasDags: falskt 301 ms före, sant från 300 ms före och efteråt (tickern är 250 ms – alltid ett slag före 0:00)", () => {
    assert.equal(autoLasDags(gomSlut, gomSlut - 1000), false);
    assert.equal(autoLasDags(gomSlut, gomSlut - LAS_AUTO_FORE_MS - 1), false);
    assert.equal(autoLasDags(gomSlut, gomSlut - LAS_AUTO_FORE_MS), true);
    assert.equal(autoLasDags(gomSlut, gomSlut - 50), true);
    assert.equal(autoLasDags(gomSlut, gomSlut), true);
    assert.equal(autoLasDags(gomSlut, gomSlut + 4000), true, "sent men inom marginalen: skicka ändå");
    assert.ok(LAS_AUTO_FORE_MS >= 250, "ett tickerslag (250 ms) ryms före 0:00");
  });
  it("utan gömslut (tiderna inte lästa än) skickas inget", () => {
    assert.equal(autoLasDags(null, gomSlut), false);
    assert.equal(autoLasDags(undefined, gomSlut), false);
    assert.equal(autoLasDags(NaN, gomSlut), false);
  });
});

describe("#842 2: tangenterna när svarsfältet har fokus", () => {
  const el = (tagName, extra = {}) => ({ tagName, getAttribute: (n) => extra[n.toLowerCase()] ?? null, ...extra });
  const siffer = el("INPUT", { type: "text", inputMode: "numeric" }); // mult/fast-answer.js: type=text inputmode=numeric
  const sifferAttr = el("INPUT", { type: "text", inputmode: "numeric" }); // bara attributet (ingen property)
  const nummer = el("INPUT", { type: "number" });
  const text = el("INPUT", { type: "text", inputMode: "text" }); // quizets fritext (plugga-quiz inputMode text)
  const vanlig = el("INPUT", { type: "text" });

  it("faltTyp: sifferfält (inputmode numeric/decimal/tel, type number), textfält (annat input, textarea, select, contenteditable), inget", () => {
    assert.equal(faltTyp(siffer), "siffer");
    assert.equal(faltTyp(sifferAttr), "siffer");
    assert.equal(faltTyp(nummer), "siffer");
    assert.equal(faltTyp(el("INPUT", { inputMode: "decimal" })), "siffer");
    assert.equal(faltTyp(el("INPUT", { inputMode: "tel" })), "siffer");
    assert.equal(faltTyp(text), "text");
    assert.equal(faltTyp(vanlig), "text");
    assert.equal(faltTyp(el("TEXTAREA")), "text");
    assert.equal(faltTyp(el("SELECT")), "text");
    assert.equal(faltTyp(el("DIV", { isContentEditable: true })), "text");
    assert.equal(faltTyp(el("DIV")), null);
    assert.equal(faltTyp(el("BUTTON")), null);
    assert.equal(faltTyp(null), null);
    assert.equal(faltMedFokus({ activeElement: siffer }), "siffer");
    assert.equal(faltMedFokus({ activeElement: null }), null);
  });

  it("sifferfält med fokus: W/A/S/D (även versaler) styr, pilarna inte", () => {
    assert.equal(styrTangent("w", "siffer"), "fram");
    assert.equal(styrTangent("W", "siffer"), "fram");
    assert.equal(styrTangent("a", "siffer"), "vanster");
    assert.equal(styrTangent("s", "siffer"), "bak");
    assert.equal(styrTangent("D", "siffer"), "hoger");
    for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) assert.equal(styrTangent(k, "siffer"), null, k);
  });

  it("textfält med fokus (fritext): ingen tangent styr – bokstäverna är svar", () => {
    for (const k of ["w", "a", "s", "d", "W", "ArrowUp", "ArrowLeft"]) assert.equal(styrTangent(k, "text"), null, k);
  });

  it("inget fält: alla styr; andra tangenter styr aldrig", () => {
    assert.equal(styrTangent("w", null), "fram");
    assert.equal(styrTangent("ArrowUp"), "fram");
    assert.equal(styrTangent("ArrowLeft", null), "vanster");
    assert.equal(styrTangent("ArrowRight", null), "hoger");
    for (const k of ["e", " ", "Enter", "1", "Shift", "", undefined]) {
      assert.equal(styrTangent(k, null), null, String(k));
      assert.equal(styrTangent(k, "siffer"), null, String(k));
    }
  });
});

describe("#842 3: sidomenyn under matchen", () => {
  const body = () => {
    const set = new Set();
    return { classList: { toggle: (c, on) => { if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }, set };
  };
  it("klassen sätts bara i fasen live och tas bort i alla andra faser och när vyn lämnas (null)", () => {
    const b = body();
    assert.equal(SIDOMENY_KLASS, "kge-match");
    assert.equal(sattSidomeny(b, "lobby"), false);
    assert.equal(b.classList.contains("kge-match"), false);
    assert.equal(sattSidomeny(b, "countdown"), false);
    assert.equal(sattSidomeny(b, "live"), true);
    assert.equal(b.classList.contains("kge-match"), true);
    assert.equal(sattSidomeny(b, "live"), true, "idempotent");
    assert.equal(b.classList.contains("kge-match"), true);
    assert.equal(sattSidomeny(b, "ended"), false);
    assert.equal(b.classList.contains("kge-match"), false);
    sattSidomeny(b, "live");
    assert.equal(sattSidomeny(b, null), false, "destroy");
    assert.equal(b.classList.contains("kge-match"), false);
  });
  it("tål en saknad body (förhandsvisning utan dokument)", () => {
    assert.equal(sattSidomeny(null, "live"), true);
    assert.equal(sattSidomeny(undefined, "ended"), false);
  });
});

describe("#842 4: perQuestion ur kgPlayers.fragor = fragestatistik(answers)", () => {
  it("fältnamnet: faktorerna sorterade, utan kolon; omvändningen ger samma nyckel", () => {
    assert.equal(fragaFalt({ factorA: 7, factorB: 3 }), "m3x7");
    assert.equal(fragaFalt({ factorA: 3, factorB: 7 }), "m3x7");
    assert.equal(fragaFalt({ q: 12 }), "q12");
    assert.equal(fragaFalt({}), null);
    assert.equal(fragaFalt(null), null);
    assert.deepEqual(fragaUrFalt("m3x7"), { factorA: 3, factorB: 7 });
    assert.deepEqual(fragaUrFalt("q12"), { q: 12 });
    assert.equal(fragaUrFalt("x"), null);
    assert.equal(fragaUrFalt(""), null);
    for (const a of [{ factorA: 0, factorB: 10 }, { factorA: 10, factorB: 10 }, { q: 0 }, { q: 149 }]) {
      assert.equal(questionKey(fragaUrFalt(fragaFalt(a))), questionKey(a));
    }
  });

  it("fragorOkning: a +1 och r +1/+0 på fältet; inget utan nyckel", () => {
    const FieldValue = { increment: (n) => ({ inc: n }) };
    assert.deepEqual(fragorOkning({ factorA: 4, factorB: 2, isCorrect: true }, FieldValue), { "fragor.m2x4.a": { inc: 1 }, "fragor.m2x4.r": { inc: 1 } });
    assert.deepEqual(fragorOkning({ q: 3, isCorrect: false }, FieldValue), { "fragor.q3.a": { inc: 1 }, "fragor.q3.r": { inc: 0 } });
    assert.deepEqual(fragorOkning({ answer: "x" }, FieldValue), {});
  });

  /** Svaren aggregerade per elev som kgSvara gör det (fragor.{fält}.a/r). */
  function spelareUr(answers, klasser) {
    const by = new Map();
    for (const a of answers) {
      const p = by.get(a.uid) || { uid: a.uid, classId: a.classId, fragor: {} };
      by.set(a.uid, p);
      const f = fragaFalt(a);
      if (!f) continue;
      const v = (p.fragor[f] ||= { a: 0, r: 0 });
      v.a++;
      if (a.isCorrect) v.r++;
    }
    for (const [uid, classId] of klasser) if (!by.has(uid)) by.set(uid, { uid, classId }); // deltagare utan svar (inget fragor-fält)
    return [...by.values()];
  }
  const QUESTIONS = Array.from({ length: 12 }, (_, i) => ({ text: `Fråga ${i}`, statKeys: i % 3 ? [`k${i % 3}`] : [] }));

  it("multiplikation: slumpade svar från 25 elever i två klasser – samma rader, siffror, ordning och byClass", () => {
    const prng = skapaPrng(842);
    const uids = Array.from({ length: 25 }, (_, i) => `e${i + 1}`);
    const klass = (u) => (Number(u.slice(1)) % 2 ? "4a" : "4b");
    const answers = [];
    for (let i = 0; i < 1500; i++) {
      const uid = uids[Math.floor(prng.tal() * uids.length)];
      answers.push({ uid, classId: klass(uid), factorA: Math.floor(prng.tal() * 11), factorB: Math.floor(prng.tal() * 11), isCorrect: prng.tal() < 0.65 });
    }
    const fore = fragestatistik(answers, null);
    const efter = fragestatistikUrSpelare(spelareUr(answers, uids.map((u) => [u, klass(u)])), null);
    assert.ok(fore.length > 50, `${fore.length} uppgifter`);
    assert.deepEqual(efter, fore);
    assert.equal(efter.reduce((n, r) => n + r.answered, 0), 1500);
  });

  it("quiz: text och statKeys ur frågorna, samma rader; tomma fragor/avsaknad hoppas över", () => {
    const prng = skapaPrng(7);
    const answers = [];
    for (let i = 0; i < 400; i++) {
      const uid = `e${1 + Math.floor(prng.tal() * 10)}`;
      answers.push({ uid, classId: "4b", q: Math.floor(prng.tal() * QUESTIONS.length), isCorrect: prng.tal() < 0.5 });
    }
    const fore = fragestatistik(answers, QUESTIONS);
    const spelare = [...spelareUr(answers, []), { uid: "tom", classId: "4b", fragor: {} }, { uid: "utan", classId: "4b" }, { uid: "skrap", classId: "4b", fragor: { x: { a: 3, r: 3 } } }];
    const efter = fragestatistikUrSpelare(spelare, QUESTIONS);
    assert.deepEqual(efter, fore);
    assert.equal(efter[1].text, "Fråga 1");
    assert.deepEqual(efter[1].statKeys, ["k1"]);
    assert.equal(efter[0].index, 0);
  });

  it("utan svar: tom lista (historiken visar 'Inga svar sparades')", () => {
    assert.deepEqual(fragestatistikUrSpelare([{ uid: "a", classId: "4b" }], null), []);
    assert.deepEqual(fragestatistikUrSpelare([], null), []);
  });

  it("r kan aldrig överstiga a och negativa räknare räknas som 0 (skadat dokument)", () => {
    const [r] = fragestatistikUrSpelare([{ uid: "a", classId: "4b", fragor: { m2x3: { a: 2, r: 5 } } }, { uid: "b", classId: "4b", fragor: { m2x3: { a: -1, r: -1 } } }], null);
    assert.deepEqual({ answered: r.answered, correct: r.correct }, { answered: 2, correct: 2 });
  });
});
