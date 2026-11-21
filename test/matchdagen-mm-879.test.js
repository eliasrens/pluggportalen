// ============================================================================
// Tester: Matchdagens multiplikationssvar räknas in i Mattematchen (#879) – klientens
// rena delar utan emulator:
//   • mmSvar (md-mm.js) på solospelets RIKTIGA tabellfrågor (md-kallor.js tabellKalla):
//     flerval och skriv själv, rätt och fel → Live-lägets record; ogiltigt och andra
//     källor → null,
//   • frågeströmmen (vy/md-strom.js): ratta skickar varje giltigt tabellsvar EN gång till
//     data.mmRaknaIn – inte ogiltiga svar, inte andra källor; rättningen är oförändrad,
//     ett fel i MM-delen märks inte; utan mmRaknaIn (förhandsvisningen) är ratta orörd.
// Regelsidan: test/firestore-rules-matchdagen-mm-879.test.js; servern (vänskapsmatchen):
// test/functions-matchdagen-mm-879.test.mjs. Ren node: node --test test/matchdagen-mm-879.test.js
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

// game-shared.js (bootgrafen) byts mot de riktiga plainQuizPool/hasPassage – som i matchdagen-fragor.test.js.
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

let K, mmSvar, strom, seededRng;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  K = await import("../src/matchdagen/md-kallor.js");
  ({ mmSvar } = await import("../src/matchdagen/md-mm.js"));
  ({ strom } = await import("../src/matchdagen/vy/md-strom.js"));
  ({ seededRng } = await import("../src/mult/generator.js"));
});

const tabellFraga = (svarssatt, nyckel = "7x8", fro = 3) => ({ ...K.tabellKalla([7]).fraga(nyckel, seededRng(fro), svarssatt), kallTyp: "tabell" });

describe("mmSvar (#879)", () => {
  it("flerval: valt alternativ → record med alternativets tal; rätt och fel", () => {
    for (let fro = 1; fro <= 20; fro++) {
      const f = tabellFraga("flerval", "7x8", fro);
      const { a, b } = f.data.q;
      assert.deepEqual(mmSvar(f, f.ratt), { record: { factorA: a, factorB: b, answer: 56, correctAnswer: 56 }, isCorrect: true });
      const fel = (f.ratt + 1) % f.alternativ.length;
      const x = mmSvar(f, fel);
      assert.equal(x.isCorrect, false);
      assert.equal(x.record.answer, f.data.options[fel]);
      assert.equal(K.rattaFraga(f, fel).ratt, x.isCorrect, "samma rättning som spelet");
    }
  });

  it("skriv själv: talet eleven skrev; ogiltigt → null", () => {
    const f = tabellFraga("skriv", "7x0");
    assert.deepEqual(mmSvar(f, " 0 "), { record: { factorA: f.data.q.a, factorB: f.data.q.b, answer: 0, correctAnswer: 0 }, isCorrect: true });
    assert.equal(mmSvar(f, "3").isCorrect, false);
    for (const s of ["", "  ", "abc", "1,5", "-3", "12345", null, undefined]) assert.equal(mmSvar(f, s), null, String(s));
  });

  it("flerval utanför alternativen, andra källor och faktorer utanför 0–10 → null", () => {
    const f = tabellFraga("flerval");
    for (const i of [-1, 4, 1.5, "x", null]) assert.equal(mmSvar(f, i), null, String(i));
    const omrade = { kallTyp: "omrade", typ: "flerval", alternativ: ["a", "b"], data: { ratt: 0 } };
    const rakna = { kallTyp: "rakna", typ: "skriv", data: { problem: {}, answer: 56 } };
    assert.equal(mmSvar(omrade, 0), null);
    assert.equal(mmSvar(rakna, "56"), null);
    const stor = { kallTyp: "tabell", typ: "skriv", data: { q: { a: 12, b: 3, answer: 36 } } };
    assert.equal(mmSvar(stor, "36"), null);
    assert.equal(mmSvar(null, 0), null);
  });
});

describe("frågeströmmen räknar in tabellsvar (vy/md-strom.js, #879)", () => {
  const S = (data, inst = { tabeller: [7], svarssatt: "skriv" }) => ({
    uid: "alma", inst, data, hamtaOmrade: async () => null,
  });

  it("varje giltigt tabellsvar → mmRaknaIn en gång; ogiltigt inte; rättningen oförändrad", async () => {
    const anrop = [];
    const fr = await strom(S({ mmRaknaIn: async (x) => { anrop.push(x); return true; } }));
    const f = fr.nasta();
    assert.equal(f.kallTyp, "tabell");
    assert.deepEqual(fr.ratta(f, "xyz"), { giltig: false, ratt: false, facit: f.facit });
    assert.equal(anrop.length, 0, "ogiltigt svar räknas inte");
    assert.deepEqual(fr.ratta(f, f.facit), { giltig: true, ratt: true, facit: f.facit });
    const g = fr.nasta();
    assert.equal(fr.ratta(g, String(Number(g.facit) + 1)).ratt, false);
    assert.deepEqual(anrop.map((x) => [x.uid, x.isCorrect, x.record.factorA * x.record.factorB]),
      [["alma", true, f.data.q.a * f.data.q.b], ["alma", false, g.data.q.a * g.data.q.b]]);
  });

  it("andra källor räknas inte; ett fel i MM-delen märks inte i spelet", async () => {
    let n = 0;
    const fr = await strom(S({ mmRaknaIn: async () => { n++; throw new Error("nekad"); } }));
    const omrade = { kallTyp: "omrade", typ: "flerval", alternativ: ["a", "b"], facit: "a", data: { ratt: 0 } };
    assert.deepEqual(fr.ratta(omrade, 0), { giltig: true, ratt: true, facit: "a" });
    assert.equal(n, 0);
    const f = fr.nasta();
    assert.equal(fr.ratta(f, f.facit).ratt, true);
    await new Promise((r) => setTimeout(r, 0)); // det avvisade löftet är fångat (ingen unhandledRejection)
    assert.equal(n, 1);
  });

  it("utan mmRaknaIn (förhandsvisningens stubbe) är ratta spelets egen", async () => {
    const fr = await strom(S({}));
    assert.equal(fr.ratta, K.rattaFraga);
  });
});
