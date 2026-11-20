// ============================================================================
// Tester: Matchdagen 1b (#868) – ligan (src/matchdagen/delat/md-liga.js) och att
// delat/ är ren. Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §0, §5, §15:
//   • schemat för 6, 8, 10 och 12 lag (alla möter alla exakt en gång)
//   • tabellsorteringen (poäng, målskillnad, gjorda mål)
//   • delat/ är ren: ingen DOM, Firebase, three.js, Math.random eller Date.now,
//     bara importer inom delat/, alla speltal i md-config.js, högst 400 rader
// Motorn: test/matchdagen-motor.test.js. Ren node: node --test test/matchdagen-liga.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as C from "../src/matchdagen/delat/md-config.js";
import { schema, styrkaFor, simMal, nyTabell, laggTill, sorteraTabell } from "../src/matchdagen/delat/md-liga.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

describe("ligan (§5, §7.1)", () => {
  for (const n of [6, 8, 10, 12]) {
    it(`schemat för ${n} lag: alla möter alla exakt en gång, en match per lag och omgång`, () => {
      const ids = Array.from({ length: n }, (_, i) => `l${i}`);
      const s = schema(ids);
      assert.equal(s.length, n - 1);
      const moten = new Set();
      for (const omg of s) {
        assert.equal(omg.length, n / 2);
        assert.equal(new Set(omg.flat()).size, n);
        for (const [a, b] of omg) {
          const k = [a, b].sort().join("-");
          assert.ok(!moten.has(k), k);
          moten.add(k);
        }
      }
      assert.equal(moten.size, (n * (n - 1)) / 2);
    });
  }
  it("schemat kräver ett jämnt antal lag", () => assert.throws(() => schema(["a", "b", "c"]), /jämnt/));
  it("tabellen sorteras på poäng, målskillnad och gjorda mål", () => {
    let t = nyTabell(["a", "b", "c", "d"]);
    t = laggTill(t, "a", "b", 1, 0); // a 3p, +1, 1 gjort
    t = laggTill(t, "c", "d", 3, 2); // c 3p, +1, 3 gjorda
    t = laggTill(t, "b", "d", 2, 2); // b 1p −1 (2 gjorda), d 1p −1 (4 gjorda)
    const rader = sorteraTabell(t);
    assert.deepEqual(rader.map((r) => r.id), ["c", "a", "d", "b"], "lika poäng och skillnad → flest gjorda");
    assert.deepEqual(rader[0], { id: "c", s: 1, v: 1, o: 0, f: 0, gm: 3, im: 2, p: 3, md: 1 });
    let u = nyTabell(["x", "y", "z", "w"]);
    u = laggTill(u, "x", "y", 2, 0); // x 3p, +2, 2 gjorda
    u = laggTill(u, "z", "w", 4, 3); // z 3p, +1, 4 gjorda
    assert.deepEqual(sorteraTabell(u).map((r) => r.id).slice(0, 2), ["x", "z"], "målskillnad före gjorda mål");
    u = laggTill(u, "w", "y", 0, 0);
    assert.deepEqual(sorteraTabell(u).map((r) => [r.id, r.p]), [["x", 3], ["z", 3], ["w", 1], ["y", 1]], "poäng först");
    assert.throws(() => laggTill(t, "a", "x", 1, 0), /x/);
  });
  it("styrkan i divisionen och simMal: inom gränserna, deterministiskt", () => {
    const rng = skapaPrng("s").tal;
    for (let i = 0; i < 500; i++) {
      const s = styrkaFor(0, rng);
      assert.ok(s >= C.STYRKA.bas - C.STYRKA.spridning && s <= C.STYRKA.bas + C.STYRKA.spridning);
      assert.ok(styrkaFor(7, rng) <= C.STYRKA.max);
    }
    const a = Array.from({ length: 50 }, (_, i) => simMal(0.2, 0.25, skapaPrng(`m${i}`).tal));
    assert.deepEqual(Array.from({ length: 50 }, (_, i) => simMal(0.2, 0.25, skapaPrng(`m${i}`).tal)), a);
    const snitt = a.flat().reduce((x, y) => x + y, 0) / a.length;
    assert.ok(snitt > 1 && snitt < 4, `${snitt} mål per match`);
  });
});

describe("delat/ är ren och har alla tal i md-config.js", () => {
  const DIR = new URL("../src/matchdagen/delat/", import.meta.url);
  const filer = readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();
  const utanKommentarer = (f) => readFileSync(new URL(f, DIR), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  it("filerna", () => assert.deepEqual(filer, ["md-config.js", "md-cup.js", "md-kval.js", "md-legend.js", "md-liga.js", "md-mastarcup.js", "md-motor.js", "md-namn.js",
    "md-prng.js", "md-rekord.js", "md-sasong.js", "md-straffar.js", "md-texter.js", "md-trupp.js", "md-vanskap.js"]));
  it("ingen DOM, Firebase, three.js, klocka eller Math.random – bara importer inom delat/", () => {
    for (const f of filer) {
      const src = utanKommentarer(f);
      assert.doesNotMatch(src, /Math\.random|Date\.now|new Date|performance\.|document\.|window\.|firebase|three|setTimeout|localStorage|sessionStorage|import\(/i, f);
      for (const [, imp] of src.matchAll(/from\s+"([^"]+)"/g)) assert.match(imp, /^\.\/md-[a-z]+\.js$/, `${f}: ${imp}`);
    }
  });
  it("motorn och ligan har inga speltal – de ligger i md-config.js", () => {
    const tillatna = new Set(["0", "1", "2", "0.5", "15", "7", "14", "61", "1000"]);
    for (const f of ["md-motor.js", "md-liga.js", "md-straffar.js", "md-kval.js", "md-cup.js", "md-mastarcup.js", "md-vanskap.js"]) {
      const src = utanKommentarer(f).replace(/"[^"\n]*"|`[^`\n]*`/g, "\"\"");
      const tal = [...src.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)].map((m) => m[1]);
      assert.deepEqual(tal.filter((t) => !tillatna.has(t)), [], f);
    }
  });
  it("ingen fil över 400 rader", () => {
    for (const f of filer) assert.ok(readFileSync(new URL(f, DIR), "utf8").split("\n").length <= 401, f);
    assert.ok(readFileSync(new URL("../admin/md-balans-sim.mjs", import.meta.url), "utf8").split("\n").length <= 401);
  });
});
