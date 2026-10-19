// ============================================================================
// Prov (#738, spec docs/UTVECKLINGSUPPDRAG_PROV.md §2.2–§3 + testlistan):
// normaliseringen och Levenshtein, validateProv, datamodellen (delningen när
// provet öppnas, numrering, obesvarade, statusflödet) och bootgrafen
// (src/prov/ laddas aldrig statiskt). Typerna: test/prov-fragetyper.test.js.
// Ren Node: node --test test/prov-grund.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProv, STANDARD_INSTALLNINGAR, tolkaTidsgrans } from "../src/prov/prov-validera.js";
import { levenshtein, matchaText, normSvar, gruppNyckel } from "../src/prov/prov-rattning.js";
import {
  autoForslag, besvarat, delaUppProv, fragaLista, fragaNummer, maxPoang, rensaSvar, statusOvergangOk, tomtSvar,
} from "../src/prov/prov-modell.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("normaliseringen (§2.2)", () => {
  it("NFC, mellanslag, gemener, en punkt sist", () => {
    assert.equal(normSvar("  Gustav   Vasa. "), "gustav vasa");
    assert.equal(normSvar("é"), "é", "NFC");
    assert.equal(normSvar("slut.."), "slut.", "bara en punkt bort");
    assert.equal(normSvar(null), "");
  });
  it("decimalkomma = decimalpunkt, och 7 är rätt mot 7,0", () => {
    assert.equal(normSvar("7,0"), "7");
    assert.equal(normSvar("3,50"), normSvar("3.5"));
    assert.equal(normSvar("−2,5"), "-2.5");
    assert.equal(normSvar("1 000"), "1000");
    assert.equal(matchaText("7", ["7,0"]), true);
    assert.equal(matchaText("3.5", ["3,5"]), true);
    assert.equal(matchaText("12.", ["12"]), true);
  });
  it("Levenshtein = 1 ger delvis när exakt stavning är av", () => {
    assert.equal(matchaText("Stokholm", ["Stockholm"], { exaktStavning: false }), "delvis");
    assert.equal(matchaText("Stokholm", ["Stockholm"]), false);
    assert.equal(matchaText("Stokhlm", ["Stockholm"], { exaktStavning: false }), false, "två fel");
    assert.equal(matchaText("8", ["7"], { exaktStavning: false }), false, "tal har ingen stavfelstolerans");
    assert.equal(matchaText("ok", ["ek"], { exaktStavning: false }), false, "för kort för stavfel");
    assert.equal(matchaText("", ["a"], { exaktStavning: false }), false);
  });
  it("skiftlägeskänslighet", () => {
    assert.equal(matchaText("stockholm", ["Stockholm"]), true);
    assert.equal(matchaText("stockholm", ["Stockholm"], { skiftlage: true }), false);
    assert.equal(matchaText("Stockholm", ["Stockholm"], { skiftlage: true }), true);
    assert.equal(matchaText("stockholm", ["Stockholm"], { skiftlage: true, exaktStavning: false }), "delvis", "en bokstav fel");
  });
  it("levenshtein", () => {
    assert.equal(levenshtein("kitten", "sitting"), 3);
    assert.equal(levenshtein("", "abc"), 3);
    assert.equal(levenshtein("abc", ""), 3);
    assert.equal(levenshtein("åsa", "äsa"), 1);
    assert.equal(levenshtein("abc", "abc"), 0);
    assert.equal(levenshtein("björk", "bjrök"), 2);
    assert.equal(levenshtein("abcdef", "x", 1), 2, "tidigt avbrott ger max + 1");
    assert.equal(levenshtein("abcdef", "abcxyz", 1), 2);
    assert.equal(levenshtein("😀a", "😀b"), 1, "emoji = ett tecken");
  });
  it("gruppNyckel samlar identiska svar", () => {
    assert.equal(gruppNyckel("Birka"), gruppNyckel(" birka. "));
    assert.notEqual(gruppNyckel("Birka"), gruppNyckel("Bjärka"));
  });
});

describe("validateProv (§2.3)", () => {
  const prov = (over = {}) => ({ namn: "Vikingatiden", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)), ...over });
  it("ett giltigt prov med alla typer blandade", () => {
    const r = validateProv(prov({ arskurs: 5, amne: " SO ", installningar: { tidsgransMin: 40 } }));
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
    assert.equal(r.value.fragor.length, 10);
    assert.equal(r.value.arskurs, "ak5");
    assert.equal(r.value.amne, "SO");
    assert.deepEqual(r.value.installningar, { ...STANDARD_INSTALLNINGAR, tidsgransMin: 40, granser: { gul: 60, gron: 85 }, stavfel: "auto" });
  });
  it("svenska fel med plats; textblock numreras för sig", () => {
    const r = validateProv({
      namn: "x".repeat(81),
      fragor: [
        { typ: "text", brodtext: "" },
        { typ: "kortsvar", fraga: "Vad?" },
        { typ: "flerval", fraga: "Vilken?", alternativ: ["a", "b"], ratt: 1 },
        { typ: "gissa", fraga: "?" },
        { typ: "fritext", fraga: "" },
      ],
    });
    assert.equal(r.ok, false);
    assert.equal(r.value, null);
    assert.deepEqual(r.errors, [
      "Provet: namnet är för långt (högst 80 tecken).",
      'Textblock 1 (Textblock): texten ("brodtext") saknas eller är tom.',
      'Fråga 1 (Kort svar): minst ett godkänt svar krävs ("godkanda": ["…"]).',
      'Fråga 3: okänd frågetyp "gissa". Giltiga: "flerval", "flerval-flera", "santfalskt", "kortsvar", "lucktext", "para", "ordna", "fritext", "text", "avsnitt".',
      'Fråga 4 (Fritext): frågetexten ("fraga") saknas eller är tom.',
    ]);
  });
  it("gränser: namn 1–80, högst 60 frågor, tidsgräns 5–240, minst en fråga", () => {
    assert.match(validateProv(prov({ namn: " " })).errors[0], /namnet/);
    assert.equal(validateProv(prov({ namn: "x".repeat(80) })).ok, true);
    const manga = Array.from({ length: 61 }, (_, i) => ({ typ: "santfalskt", fraga: `F${i}`, ratt: true }));
    assert.match(validateProv(prov({ fragor: manga })).errors.join(), /högst 60/);
    assert.equal(validateProv(prov({ fragor: manga.slice(0, 60) })).ok, true);
    assert.match(validateProv(prov({ installningar: { tidsgransMin: 4 } })).errors.join(), /5–240/);
    assert.match(validateProv(prov({ installningar: { tidsgransMin: 241 } })).errors.join(), /5–240/);
    assert.equal(tolkaTidsgrans(""), null);
    assert.match(validateProv(prov({ fragor: [EXEMPEL.text.f] })).errors.join(), /minst en fråga/);
    assert.match(validateProv(prov({ fragor: "nej" })).errors.join(), /lista/);
    assert.match(validateProv([]).errors[0], /objekt/);
    assert.match(validateProv(prov({ installningar: { granser: { gul: 80, gron: 70 } } })).errors.join(), /färggränserna/);
  });
  it("id fylls i, dubbletter och ogiltiga id får nya – givna id byts aldrig", () => {
    const r = validateProv({
      namn: "Id",
      fragor: [
        { typ: "santfalskt", fraga: "a", ratt: true },
        { id: "f1", typ: "santfalskt", fraga: "b", ratt: true },
        { id: "f1", typ: "santfalskt", fraga: "c", ratt: true },
        { id: "har punkt.", typ: "santfalskt", fraga: "d", ratt: true },
      ],
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.fragor.map((f) => f.id), ["f2", "f1", "f3", "f4"]);
    assert.equal(r.warnings.length, 2);
    assert.deepEqual(Object.keys(r.value.fragor[0]).slice(0, 2), ["id", "typ"]);
  });
  it("okänd årskurs ger en varning, inget fel", () => {
    const r = validateProv(prov({ arskurs: "gymnasiet" }));
    assert.equal(r.ok, true);
    assert.match(r.warnings.join(), /årskurs/);
  });
});

describe("datamodellen (§3)", () => {
  const v = validateProv({ namn: "P", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
  const { fragor, facit, bedomningsstod } = delaUppProv(v);
  it("delaUppProv: elevens frågor utan facit, facit och bedömningsstöd för sig", () => {
    for (const e of Object.values(EXEMPEL)) {
      const json = JSON.stringify(fragor.find((f) => f.id === e.f.id));
      for (const s of e.hemligt) assert.ok(!json.includes(s), `${e.f.id}: ${s}`);
    }
    assert.deepEqual(Object.keys(facit), ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    assert.deepEqual(bedomningsstod, { q8: "Nämner djur, hus och arbete" });
    assert.deepEqual(facit.q5.luckor, [{ godkanda: ["Miklagård", "Konstantinopel"] }, { godkanda: ["Bagdad"] }]);
    // Firestore: inga listor i listor någonstans.
    const nastlad = (x) => Array.isArray(x) ? x.some((y) => Array.isArray(y) || nastlad(y))
      : x && typeof x === "object" ? Object.values(x).some(nastlad) : false;
    assert.equal(nastlad({ fragor, facit, bedomningsstod }), false);
  });
  it("numrering, tomma svar, besvarat och maxpoäng", () => {
    assert.deepEqual(fragaNummer(fragor), { q1: 1, q2: 2, q3: 3, q4: 4, q5: 5, q6: 6, q7: 7, q8: 8 });
    const svar = tomtSvar(fragor);
    assert.ok(!("t1" in svar));
    assert.deepEqual(besvarat(fragor, svar), { besvarade: 0, antal: 8, obesvarade: [1, 2, 3, 4, 5, 6, 7, 8] });
    const nagra = { ...svar, q1: 0, q3: true, q4: "Birka", q5: ["x", ""], q6: ["Åska", "", ""], q7: [...fragor[6].saker], q8: "Text" };
    const b = besvarat(fragor, nagra);
    assert.deepEqual(b, { besvarade: 7, antal: 8, obesvarade: [2] });
    assert.equal(fragaLista([4, 9]), "Fråga 4 och 9");
    assert.equal(fragaLista([2, 5, 7]), "Fråga 2, 5 och 7");
    assert.equal(fragaLista([3]), "Fråga 3");
    assert.equal(fragaLista([]), "");
    assert.equal(maxPoang(fragor), 1 + 2 + 1 + 1 + 2 + 3 + 4 + 4);
  });
  it("rensaSvar på hela mapen: bara tillfällets frågor", () => {
    assert.deepEqual(rensaSvar({ q4: "Birka", okand: "x", t1: "y" }, fragor), { q4: "Birka" });
  });
  it("autoForslag: förslag med auto: true för allt utom fritext", () => {
    const a = autoForslag(fragor, { q1: 0, q4: "birka", q2: [0] }, facit);
    assert.deepEqual(Object.keys(a), ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    assert.deepEqual(a.q1, { poang: 1, ratt: true, auto: true });
    assert.deepEqual(a.q2, { poang: 1, ratt: "delvis", auto: true });
    assert.deepEqual(a.q3, { poang: 0, ratt: false, auto: true }, "obesvarad = förslag fel");
    assert.equal(a.q4.ratt, true);
  });
  it("statusflödet: forberett → oppet → stangt → oppet", () => {
    assert.ok(statusOvergangOk("forberett", "oppet"));
    assert.ok(statusOvergangOk("oppet", "stangt"));
    assert.ok(statusOvergangOk("stangt", "oppet"));
    assert.ok(statusOvergangOk("oppet", "oppet"));
    assert.ok(!statusOvergangOk("forberett", "stangt"));
    assert.ok(!statusOvergangOk("stangt", "forberett"));
    assert.ok(!statusOvergangOk("oppet", "forberett"));
  });
  it("speglar firestore.rules: statusövergångarna och gränserna", () => {
    const rules = readFileSync(join(SRC, "..", "firestore.rules"), "utf8");
    assert.match(rules, /fore == 'forberett' && efter == 'oppet'/);
    assert.match(rules, /fore == 'oppet' && efter == 'stangt'/);
    assert.match(rules, /fore == 'stangt' && efter == 'oppet'/);
    assert.match(rules, /d\.tidsgransMin >= 5 && d\.tidsgransMin <= 240/);
    assert.match(rules, /d\.svar\.size\(\) <= 60/);
    assert.match(rules, /d\.namn\.size\(\) <= 80/);
  });
});

describe("bootgrafen (#271)", () => {
  it("src/prov/ laddas aldrig statiskt från app.js", () => {
    const start = join(SRC, "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const prov = [...seen].filter((f) => f.startsWith(join(SRC, "prov") + "/"));
    assert.deepEqual(prov, [], "src/prov/ i den statiska bootgrafen");
    assert.equal(seen.size, 107, "bootgrafen ska vara kvar på 107 filer");
  });
});
