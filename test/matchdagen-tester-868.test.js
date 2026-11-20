// ============================================================================
// Tester-kontroller #868 (Matchdagen 1b), oberoende av Coderns tester:
//   • påsen med FLERA källor och många sessioner: ingen fråga i en källa kommer
//     tillbaka förrän källans alla frågor har kommit, och källorna turas om jämnt
//   • varje fråga ur strömmen går att rätta: facit ger rätt, ett annat svar fel
//   • motorn: samma frö + samma svar → identisk match; en hel match i ~20 lägen
//     per halvlek, halvtid exakt en gång, klockan når 90
//   • F1: fel svar på ett långskott ska inte ge större målchans än rätt
// Ren node: node --test test/matchdagen-tester-868.test.js
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import * as M from "../src/matchdagen/delat/md-motor.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

// game-shared.js drar in Firebase: byt mot de riktiga hasPassage/plainQuizPool (som matchdagen-fragor.test.js).
const GS = readFileSync(new URL("../src/game-shared.js", import.meta.url), "utf8");
const klipp = (namn) => {
  const a = GS.indexOf(`export function ${namn}(`);
  return GS.slice(a, GS.indexOf("\n}\n", a) + 3);
};
const STUB = `${klipp("hasPassage")}\n${klipp("plainQuizPool")}`;
const HOOK = `export async function resolve(spec, ctx, next) {
  if (spec === "../game-shared.js" && ctx.parentURL.endsWith("/src/matchdagen/md-kallor.js")) {
    return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(STUB)}) };
  }
  return next(spec, ctx);
}`;

let F;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  F = await import("../src/matchdagen/md-fragor.js");
});

const minne = () => {
  const m = new Map();
  return { hamta: (k) => m.get(k) ?? null, spara: (k, v) => m.set(k, v) };
};
const quiz = (n, p) => Array.from({ length: n }, (_, i) => ({ question: `${p} fråga ${i}?`, options: [`${p}rätt${i}`, `${p}fel${i}a`, `${p}fel${i}b`], answerIndex: 0 }));
const AREAS = {
  "so/a": { quiz: quiz(5, "A") },
  "no/b": { quiz: quiz(3, "B"), pairs: [{ term: "x", definition: "ett x" }, { term: "y", definition: "ett y" }, { term: "z", definition: "ett z" }] },
  "ma/r": { generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } },
};
const INST = { omraden: ["so/a", "no/b"], tabeller: [3, 7], rakna: ["ma/r"] };
const hamtaOmrade = async (s, a) => AREAS[`${s}/${a}`] ?? null;

describe("frågekällorna (tester #868)", () => {
  it("flera källor, många sessioner: påsen upprepar inget förrän källan är slut", async () => {
    const lagring = minne();
    const perKalla = new Map();
    let n = 0;
    for (let session = 0; session < 30; session++) {
      const s = await F.skapaFragestrom({ inst: INST, uid: "e", hamtaOmrade, lagring, rng: skapaPrng(`s${session}`).tal });
      assert.equal(s.tom, false);
      for (let k = 0; k < 13; k++, n++) {
        const f = s.nasta();
        const id = f.id.split("#")[0];
        if (!perKalla.has(id)) perKalla.set(id, []);
        perKalla.get(id).push(f.nyckel);
      }
    }
    const storlek = { "omrade:so/a": 5, "omrade:no/b": 6, multiplikation: 22 };
    for (const [id, nycklar] of perKalla) {
      if (!(id in storlek)) continue; // Räkna är oändlig
      const N = storlek[id];
      for (let start = 0; start + N <= nycklar.length; start += N) {
        assert.equal(new Set(nycklar.slice(start, start + N)).size, N, `${id} varv ${start / N}`);
      }
    }
    // Jämn blandning: fyra källor, varje källa ~en fjärdedel.
    const andelar = [...perKalla.values()].map((v) => v.length / n);
    assert.equal(andelar.length, 4);
    for (const a of andelar) assert.ok(Math.abs(a - 0.25) < 0.02, `andel ${a}`);
  });

  it("varje fråga går att rätta: facit (eller rätt index) ger rätt, annat svar fel", async () => {
    for (const svarssatt of ["flerval", "skriv"]) {
      const s = await F.skapaFragestrom({ inst: { ...INST, svarssatt }, uid: "e", hamtaOmrade, lagring: minne(), rng: skapaPrng(svarssatt).tal });
      for (let i = 0; i < 80; i++) {
        const f = s.nasta();
        if (f.typ === "flerval") {
          assert.ok(f.alternativ.length >= 2 && f.alternativ.length <= 4, f.text);
          assert.deepEqual(s.ratta(f, f.ratt), { giltig: true, ratt: true, facit: f.facit });
          assert.equal(s.ratta(f, (f.ratt + 1) % f.alternativ.length).ratt, false, f.text);
          assert.equal(s.ratta(f, 9).giltig, false);
        } else {
          assert.equal(s.ratta(f, f.facit).ratt, true, `${f.text} facit ${f.facit}`);
          assert.equal(s.ratta(f, "").giltig, false);
          assert.equal(s.ratta(f, "999999").ratt, false, f.text);
        }
      }
    }
  });

  it("inga källor / bara tomma listor → meddelandet, ingen ström", async () => {
    for (const inst of [undefined, { omraden: [], tabeller: [], rakna: [] }, { tabeller: ["x", 99] }]) {
      const s = await F.skapaFragestrom({ inst, uid: "e", hamtaOmrade, lagring: minne() });
      assert.deepEqual(s, { tom: true, meddelande: "Din lärare har inte valt några frågor än" });
    }
  });
});

/** En hel match: robot som svarar rätt med andelen p. */
function hel(seed, p = 0.6) {
  let m = M.nyMatch({ mot: { styrka: 0.2 } });
  const r = skapaPrng(seed);
  const logg = [];
  let halvtider = 0;
  while (!m.slut) {
    if (m.halvtid) {
      halvtider++;
      assert.equal(m.min, 45);
      m = M.andraHalvlek(m);
      continue;
    }
    const l = M.lage(m);
    const v = l.typ === "anfall" ? (l.d <= 28 ? "skjut" : "kort") : l.typ === "forsvar" ? "tackla" : null;
    const o = M.spela(m, v, Array.from({ length: M.antalFragor(m, v) }, () => r.tal() < p), r.tal);
    m = o.m;
    logg.push(o.h);
  }
  return { m, logg, halvtider };
}

describe("motorn (tester #868)", () => {
  it("samma frö → identisk match; halvtid en gång; klockan till 90", () => {
    for (let i = 0; i < 50; i++) {
      const a = hel(`m${i}`);
      assert.deepEqual(hel(`m${i}`), a);
      assert.equal(a.halvtider, 1);
      assert.equal(a.m.min, 90);
      assert.ok(a.logg.length >= 30 && a.logg.length <= 50, `lägen ${a.logg.length}`);
      const r = M.resultat(a.m);
      assert.equal(r.mal.length, r.oss + r.dem);
      assert.ok(r.mal.every((x, j) => x.min >= 1 && x.min <= 90 && (j === 0 || x.min >= r.mal[j - 1].min)));
    }
  });

  it("F1: fel svar ger aldrig större målchans än rätt svar från samma avstånd", () => {
    for (let d = 0; d <= 45; d++) {
      assert.ok(M.chansSkott(d, false, {}, 0.2) <= M.chansSkott(d, true, {}, 0.2), `d=${d}: fel ${M.chansSkott(d, false, {}, 0.2)} > rätt ${M.chansSkott(d, true, {}, 0.2).toFixed(3)}`);
    }
  });
});
