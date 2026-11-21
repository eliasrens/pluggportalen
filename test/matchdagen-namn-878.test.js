// ============================================================================
// Tester: Matchdagens spelarnamn (#878) – src/matchdagen/delat/md-namn.js.
//   • ~120 förnamn och ~100 efternamn, inga dubbletter (inte heller med annan versal)
//   • bara bokstäver – reglerna nekar | / < > & " i spelarnamn (mdNyTruppOk, marknadens rader)
//   • de gamla namnen står kvar först i samma ordning (listorna växer bara i slutet)
//   • serverns kopia (functions/matchdagen/md-namn.js) är identisk
//   • en sparad trupp med gamla namn och en ny trupp/marknad med de nya fungerar
// Ren node: node --test test/matchdagen-namn-878.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EFTERNAMN, FORNAMN } from "../src/matchdagen/delat/md-namn.js";
import { nyKarriar, nyTrupp } from "../src/matchdagen/delat/md-sasong.js";
import { nyMarknad } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// Namnen före #878 (de 36 + 32 första) – får inte flyttas eller tas bort.
const GAMLA_FOR = ["Alvin", "Selma", "Omar", "Wilma", "Leo", "Nora", "Ali", "Alva", "Hugo", "Juni", "Sami", "Ines",
  "Liam", "Maja", "Noah", "Saga", "Adam", "Ebba", "Theo", "Lova", "Isak", "Tilde", "Melvin", "Siri",
  "Yusuf", "Elsa", "Vincent", "Hedda", "Malte", "Ronja", "Aron", "Leah", "Edvin", "Mira", "Jonatan", "Amira"];
const GAMLA_EFTER = ["Berg", "Ek", "Lind", "Ström", "Holm", "Sund", "Dahl", "Falk", "Nyberg", "Ahmadi", "Kaya", "Nilsson",
  "Virtanen", "Hassan", "Lund", "Kovač", "Sandberg", "Björk", "Hedlund", "Öberg", "Mohammed", "Lindqvist",
  "Ali", "Engström", "Fors", "Wikström", "Nyström", "Åberg", "Berglund", "Sjöberg", "Yilmaz", "Hammar"];

describe("Matchdagens spelarnamn (#878)", () => {
  it("~120 förnamn × ~100 efternamn (≈ 12 000 kombinationer)", () => {
    assert.ok(FORNAMN.length >= 115 && FORNAMN.length <= 130, `förnamn: ${FORNAMN.length}`);
    assert.ok(EFTERNAMN.length >= 95 && EFTERNAMN.length <= 110, `efternamn: ${EFTERNAMN.length}`);
    assert.ok(FORNAMN.length * EFTERNAMN.length >= 11000);
  });
  it("inga dubbletter i listorna (även med annan versal)", () => {
    for (const [namn, lista] of [["FORNAMN", FORNAMN], ["EFTERNAMN", EFTERNAMN]]) {
      const sedda = new Map();
      for (const n of lista) {
        const k = n.toLocaleLowerCase("sv");
        assert.ok(!sedda.has(k), `${namn}: ${n} finns två gånger`);
        sedda.set(k, n);
      }
    }
  });
  it("bara bokstäver, 2–15 tecken, stor bokstav först – inget reglerna nekar", () => {
    for (const n of [...FORNAMN, ...EFTERNAMN]) {
      assert.match(n, /^\p{Lu}\p{Ll}+$/u, n);
      assert.ok(n.length >= 2 && n.length <= 15, n);
      assert.doesNotMatch(n, /[|/<>&"\s]/, n);
    }
    // Hela namnet ryms i reglernas 1–40 tecken (mdNyTruppOk).
    const langst = Math.max(...FORNAMN.map((f) => f.length)) + 1 + Math.max(...EFTERNAMN.map((e) => e.length));
    assert.ok(langst <= 40, `längsta möjliga namn: ${langst}`);
  });
  it("de gamla namnen står kvar först, i samma ordning", () => {
    assert.deepEqual(FORNAMN.slice(0, GAMLA_FOR.length), GAMLA_FOR);
    assert.deepEqual(EFTERNAMN.slice(0, GAMLA_EFTER.length), GAMLA_EFTER);
  });
  it("serverns kopia är densamma (npm run sync:matchdagen)", () => {
    assert.equal(read("functions/matchdagen/md-namn.js"), read("src/matchdagen/delat/md-namn.js"));
  });
  it("en ny trupp och marknad lottar ur de nya listorna; en sparad trupp med gamla namn fungerar vidare", () => {
    const anvanda = new Set();
    for (let i = 0; i < 200; i++) {
      for (const p of nyTrupp(skapaPrng(`namn-${i}`).tal)) {
        const [f, e] = p.namn.split(" ");
        assert.ok(FORNAMN.includes(f) && EFTERNAMN.includes(e), p.namn);
        anvanda.add(f);
      }
    }
    assert.ok([...anvanda].some((f) => !GAMLA_FOR.includes(f)), "de nya förnamnen lottas");
    // En karriär från före #878: truppen har gamla namn – marknaden undviker dem och ger giltiga namn.
    const K = nyKarriar({ namn: "Gamla FC", farg: "#2f6fe8", rng: skapaPrng("gammal").tal });
    K.trupp = K.trupp.map((p, i) => ({ ...p, namn: `${GAMLA_FOR[i]} ${GAMLA_EFTER[i]}` }));
    const m = nyMarknad(K, skapaPrng("marknad").tal);
    assert.equal(m.length, 6);
    for (const p of m) {
      assert.ok(!K.trupp.some((t) => t.namn === p.namn));
      assert.match(p.namn, /^\p{L}+ \p{L}+$/u);
    }
  });
});
