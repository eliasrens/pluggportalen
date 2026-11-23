// ============================================================================
// Tester: Matchdagen 1b (#868) – frågekällorna (src/matchdagen/md-fragor.js,
// md-kallor.js). Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §2 och §15:
//   • varje källa ger giltiga frågor (Plugga-område: quiz utan passage + par som
//     "Vad betyder X?", multiplikation begränsad till tabellerna, Räkna)
//   • påsen upprepar inget förrän källan är slut – även över omladdningar
//   • källorna blandas jämnt
//   • inga valda källor ger meddelandet om saknade frågor
// game-shared.js (bootgrafen, drar in Firebase och DOM) byts i node mot en
// modul med de RIKTIGA plainQuizPool/hasPassage, utklippta ur källkoden.
// Ren node: node --test test/matchdagen-fragor.test.js
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const klipp = (src, namn) => {
  const start = src.indexOf(`export function ${namn}(`);
  const slut = src.indexOf("\n}\n", start);
  assert.ok(start >= 0 && slut > start, namn);
  return src.slice(start, slut + 3);
};
const GS = read("src/game-shared.js");
const STUB = `${klipp(GS, "hasPassage")}\n${klipp(GS, "plainQuizPool")}`;
const HOOK = `export async function resolve(spec, ctx, next) {
  if (spec === "../game-shared.js" && ctx.parentURL.endsWith("/src/matchdagen/md-kallor.js")) {
    return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(STUB)}) };
  }
  return next(spec, ctx);
}`;

let F;
let skapaPrng;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  F = await import("../src/matchdagen/md-fragor.js");
  ({ skapaPrng } = await import("../src/matchdagen/delat/md-prng.js"));
});

/** localStorage i minnet. */
const minne = () => {
  const m = new Map();
  return { hamta: (k) => m.get(k) ?? null, spara: (k, v) => m.set(k, v), m };
};

const OMRADE = {
  quiz: [
    { question: "Vad heter Sveriges huvudstad?", options: ["Stockholm", "Göteborg", "Malmö"], answerIndex: 0 },
    { question: "Vilken älv är längst?", options: ["Klarälven", "Torne älv"], answerIndex: 1 },
    { question: "Enligt texten, vad hände?", options: ["A", "B"], answerIndex: 0, passage: "En text." },
    { question: "", options: ["A", "B"], answerIndex: 0 },
    { question: "Två lika?", options: ["Ja", "ja"], answerIndex: 0 },
  ],
  pairs: [
    { term: "landskap", definition: "ett av Sveriges 25 gamla områden" },
    { term: "län", definition: "ett område med en egen region" },
    { term: "kommun", definition: "en ort med eget styre" },
    { term: "socken", definition: "en gammal kyrklig indelning" },
    { term: "stad", definition: "en tätort med stadsrättigheter" },
    { term: "Län", definition: "dubbletten" },
    { termImage: "bild.png", definition: "bara bild" },
  ],
};
const RAKNA = { generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } };
const KLOCKA = { generator: { topic: "klocka", variants: ["las-av"], grade: "ak4" } };
const AREAS = { "so/sverige": OMRADE, "ma/addera": RAKNA, "ma/klocka": KLOCKA, "so/lasning": { quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0, passage: "P" }] } };
const hamtaOmrade = async (s, a) => AREAS[`${s}/${a}`] ?? null;
const strom = (inst, o = {}) => F.skapaFragestrom({ inst, uid: "elev1", hamtaOmrade, lagring: o.lagring || minne(), rng: skapaPrng(o.seed || "f").tal });

function giltig(f) {
  assert.ok(f.text && typeof f.text === "string", "text");
  assert.ok(f.id && f.kalla && f.facit !== undefined, "id/kalla/facit");
  if (f.typ === "flerval") {
    assert.ok(f.alternativ.length >= 2 && f.alternativ.length <= 6, "2–6 alternativ");
    assert.equal(new Set(f.alternativ.map((a) => a.toLowerCase())).size, f.alternativ.length, "unika alternativ");
    assert.equal(f.alternativ[f.ratt], f.facit);
  } else assert.equal(f.typ, "skriv");
}

describe("inga frågor (§2)", () => {
  it("inga valda källor → \"Din lärare behöver välja frågor till Matchdagen\"", async () => {
    assert.equal(F.INGA_FRAGOR, "Din lärare behöver välja frågor till Matchdagen");
    for (const inst of [null, {}, { omraden: [], tabeller: [], rakna: [] }]) {
      assert.deepEqual(await strom(inst), { tom: true, meddelande: F.INGA_FRAGOR });
    }
  });
  it("valda områden som saknas eller inte har några frågor → eget meddelande, ingen match", async () => {
    const s = await strom({ omraden: ["so/finnsinte", "so/lasning"], rakna: ["so/sverige"], lastext: false });
    assert.deepEqual(s, { tom: true, meddelande: F.SAKNADE_FRAGOR });
    const fel = await F.skapaFragestrom({ inst: { omraden: ["so/sverige"] }, uid: "u", hamtaOmrade: async () => { throw new Error("nät"); }, lagring: minne() });
    assert.equal(fel.tom, true);
  });
});

describe("varje källa ger giltiga frågor", () => {
  it("Plugga-område: quiz utan passage och par som \"Vad betyder X?\" – bara giltiga saker (lästext av, #905)", async () => {
    const s = await strom({ omraden: ["so/sverige"], lastext: false });
    assert.equal(s.tom, false);
    assert.deepEqual(s.kallor, [{ id: "omrade:so/sverige", antal: 7 }], "2 quiz + 5 par (passage, tom, dubblett, bild bort)");
    const sedda = new Set();
    for (let i = 0; i < 7; i++) {
      const f = s.nasta();
      giltig(f);
      assert.equal(f.typ, "flerval");
      assert.equal(f.kalla, "omrade:so/sverige");
      sedda.add(f.text);
      if (f.nyckel.startsWith("par:")) {
        assert.match(f.text, /^Vad betyder .+\?$/);
        assert.equal(f.alternativ.length, 4);
      }
      assert.deepEqual(s.ratta(f, f.ratt), { giltig: true, ratt: true, facit: f.facit });
      assert.equal(s.ratta(f, (f.ratt + 1) % f.alternativ.length).ratt, false);
      assert.equal(s.ratta(f, 9).giltig, false);
    }
    assert.ok(sedda.has("Vad heter Sveriges huvudstad?") && sedda.has("Vad betyder landskap?"));
    assert.ok(!sedda.has("Enligt texten, vad hände?"), "passagefrågor visas aldrig");
  });
  it("Plugga-område med bara passagefrågor ger inga frågor med lästext av (plainQuizPools reserv tas inte med)", async () => {
    assert.equal((await strom({ omraden: ["so/lasning"], lastext: false })).tom, true);
  });
  it("multiplikation: bara de valda tabellerna, flerval med fyra alternativ eller skriv själv", async () => {
    const s = await strom({ tabeller: [3, 7] });
    assert.deepEqual(s.kallor, [{ id: "multiplikation", antal: 22 }]);
    for (let i = 0; i < 22; i++) {
      const f = s.nasta();
      giltig(f);
      const { a, b } = f.data.q;
      const t = Number(f.kalla.split(":")[1]);
      assert.ok([3, 7].includes(t) && (a === t || b === t), `${a}×${b} hör till tabell ${t}`);
      assert.equal(f.text, `${a} × ${b} = ?`);
      assert.equal(f.alternativ.length, 4);
      assert.equal(s.ratta(f, f.ratt).ratt, true);
    }
    const sk = await strom({ tabeller: [6], svarssatt: "skriv" });
    const f = sk.nasta();
    assert.equal(f.typ, "skriv");
    assert.equal(f.inputMode, "numeric");
    assert.deepEqual(sk.ratta(f, ` ${f.facit} `), { giltig: true, ratt: true, facit: f.facit });
    assert.equal(sk.ratta(f, String(Number(f.facit) + 1)).ratt, false);
    assert.equal(sk.ratta(f, "").giltig, false);
    assert.equal(sk.ratta(f, "abc").giltig, false);
  });
  it("Räkna: generatorns uppgifter, skriv själv, rättas som i Räkna-läget", async () => {
    const s = await strom({ rakna: ["ma/addera"], svarssatt: "flerval" });
    assert.equal(s.kallor[0].antal, Infinity);
    for (let i = 0; i < 10; i++) {
      const f = s.nasta();
      giltig(f);
      assert.equal(f.typ, "skriv", "Räkna har bara skriv själv");
      assert.equal(f.kalla, "rakna:ma/addera");
      assert.match(f.text, /\d/);
      assert.equal(s.ratta(f, f.facit).ratt, true);
      assert.equal(s.ratta(f, "-999").ratt, false);
    }
  });
});

describe("Räkna med bild", () => {
  it("de visuella räknesätten får bilden (matte-visuals.js) och ett tips om hur svaret skrivs", async () => {
    const s = await strom({ rakna: ["ma/klocka"] });
    const f = s.nasta();
    giltig(f);
    assert.match(f.bild, /^<svg[\s\S]*<\/svg>$/);
    assert.equal(f.tips, "Svara med klockslag, t.ex. 07:30.");
    assert.equal(f.inputMode, "text");
    assert.equal(s.ratta(f, f.facit).ratt, true);
    const add = (await strom({ rakna: ["ma/addera"] })).nasta();
    assert.equal(add.bild, undefined, "vanliga tal har ingen bild");
  });
});

describe("påsen och blandningen", () => {
  it("påsen upprepar inget förrän källan är slut – och håller över en ny session", async () => {
    const lagring = minne();
    const a = await strom({ tabeller: [2] }, { lagring, seed: "a" });
    const forsta = Array.from({ length: 4 }, () => a.nasta().nyckel);
    const b = await strom({ tabeller: [2] }, { lagring, seed: "b" });
    const resten = Array.from({ length: 7 }, () => b.nasta().nyckel);
    const varv = [...forsta, ...resten];
    assert.equal(new Set(varv).size, 11, "alla 11 innan någon kommer igen");
    const nasta = Array.from({ length: 11 }, () => b.nasta().nyckel);
    assert.equal(new Set(nasta).size, 11);
    assert.notEqual(nasta[0], varv[10], "inte samma två gånger i rad över påsgränsen");
    assert.ok(lagring.m.has(`${F.PASE_NYCKEL}elev1`));
  });
  it("ändrar läraren området börjar påsen om; trasig lagring gör inget", async () => {
    const lagring = minne();
    const s = await strom({ omraden: ["so/sverige"], lastext: false }, { lagring });
    s.nasta();
    const kvar = JSON.parse(lagring.hamta(`${F.PASE_NYCKEL}elev1`)).kallor["omrade:so/sverige"].kvar;
    assert.equal(kvar.length, 6);
    AREAS["so/sverige"] = { ...OMRADE, quiz: OMRADE.quiz.slice(0, 1) };
    try {
      const t = await strom({ omraden: ["so/sverige"], lastext: false }, { lagring });
      const nycklar = Array.from({ length: 6 }, () => t.nasta().nyckel);
      assert.equal(new Set(nycklar).size, 6, "ny påse med det nya innehållet (1 quiz + 5 par)");
    } finally {
      AREAS["so/sverige"] = OMRADE;
    }
    lagring.spara(`${F.PASE_NYCKEL}elev1`, "{inte json");
    assert.equal((await strom({ tabeller: [1] }, { lagring })).nasta().kalla, "tabell:1");
    const kastar = { hamta() { throw new Error("blockerad"); }, spara() { throw new Error("blockerad"); } };
    assert.equal((await strom({ tabeller: [1] }, { lagring: kastar })).nasta().kalla, "tabell:1", "blockerad lagring: frågorna kommer ändå");
    assert.doesNotThrow(() => F.webbLagring().spara("x", "y"), "webbLagring tål att localStorage saknas");
    assert.equal(F.webbLagring().hamta("x"), null);
  });
  it("Räkna: strömmens position sparas, nästa session får nya uppgifter", async () => {
    const lagring = minne();
    const a = await strom({ rakna: ["ma/addera"] }, { lagring });
    const ta = Array.from({ length: 5 }, () => a.nasta().text);
    assert.equal(JSON.parse(lagring.hamta(`${F.PASE_NYCKEL}elev1`)).kallor["rakna:ma/addera"].n, 5);
    const b = await strom({ rakna: ["ma/addera"] }, { lagring });
    const tb = Array.from({ length: 5 }, () => b.nasta().text);
    assert.notDeepEqual(tb, ta);
  });
  it("källorna blandas jämnt: varje källa en gång per varv", async () => {
    const s = await strom({ omraden: ["so/sverige"], tabeller: [5], rakna: ["ma/addera"] });
    assert.equal(s.kallor.length, 3);
    const typer = Array.from({ length: 30 }, () => s.nasta().kallTyp);
    for (let v = 0; v < 30; v += 3) assert.deepEqual(typer.slice(v, v + 3).sort(), ["omrade", "rakna", "tabell"], `varv ${v / 3}`);
    for (let i = 1; i < typer.length; i++) assert.notEqual(typer[i], typer[i - 1], "aldrig samma källa två gånger i rad");
  });
});

describe("källkod: återanvänd, kopiera inte", () => {
  it("md-kallor.js använder lästexturvalet (Live-regeln, #905), prov-omvandlingen, Live-läget och rakna-core", () => {
    const k = read("src/matchdagen/md-kallor.js");
    assert.match(k, /import \{ quizUrval \} from "\.\/md-lastext\.js"/);
    assert.match(read("src/matchdagen/md-lastext.js"), /import \{ QUIZ_PASSAGE_MAX, passageCheck \} from "\.\.\/live\/modes\/quiz-passage\.js"/);
    assert.match(read("src/live/modes/plugga-quiz-core.js"), /from "\.\/quiz-passage\.js"/, "Live använder samma regel");
    assert.match(k, /import \{ omradetsSaker \} from "\.\.\/prov\/prov-fran-omrade\.js"/);
    assert.match(k, /import MULTIPLICATION_0_10 from "\.\.\/live\/modes\/multiplication-0-10\.js"/);
    assert.match(k, /createProblemSource/);
    assert.match(read("src/matchdagen/md-fragor.js"), /createTopicBag/);
  });
  it("frågekortet (md-svar.js): fel svar visas 1,5 s, tangenterna 1–N, bara md-config.js importeras", async () => {
    const S = await import("../src/matchdagen/md-svar.js");
    assert.equal(S.FEL_MS, 1500);
    assert.ok(S.MAX_TANGENT >= 4);
    const src = read("src/matchdagen/md-svar.js");
    assert.deepEqual(src.match(/^import .*$/gm), ['import { FORKLARING_MS, LASTEXT_EXTRA_S } from "./delat/md-config.js";'], "ingen Firebase, inga appmoduler");
    assert.match(src, /Rätt svar: <b>/);
    assert.match(src, /Tiden är ute/);
    assert.match(read("src/styles/48-matchdagen.css"), /\.md-alt, \.md-skicka \{[^}]*min-height: 56px/, "knappar minst 48 px");
  });
});
