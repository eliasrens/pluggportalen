// ============================================================================
// Matchdagen 2a (#870): kvalet och straffarna i vyerna – den pågående matchen
// (md-lokal.js: ett kval mitt i straffläggningen fortsätter efter omladdning),
// texterna efter säsongen och kvalet (md-vy-match.js), och att lärarens vy och
// elevens statistik bara visar TAL ur de nya fälten (kval, straffar) – eleven
// skriver dokumentet (#869 G1, lagrad XSS). Reglerna: firestore-rules-matchdagen-kval.test.js.
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { matchKlar, nastaMatch, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { nyMatch } from "../src/matchdagen/delat/md-motor.js";
import { straffa } from "../src/matchdagen/delat/md-straffar.js";
import { lasPagaende, sparaPagaende } from "../src/matchdagen/md-lokal.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const XSS = "<img src=x onerror=alert(1)>";
const NU = Date.UTC(2026, 10, 20, 10);
const rng = (f) => skapaPrng(f).tal;
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: {}, sekunder: 420 };
const res = (oss, dem, extra = {}) => ({ oss, dem, utfall: "", mal: [], stat: STAT, ...extra });

function vunnenLiga() {
  let K = nyKarriar({ namn: "Blixtarna", farg: "#2f6fe8", rng: rng("v") });
  for (let i = 0; nastaMatch(K); i++) K = matchKlar(K, { res: res(4, 0), rng: rng(`v${i}`), nu: NU, matchId: `m${i}` }).K;
  return K;
}

let vy;
let elevRad;
before(async () => {
  installeraFirebaseStubbe();
  vy = await import("../src/matchdagen/vy/md-vy-match.js");
  ({ elevRad } = await import("../src/matchdagen/larare/md-larare-stat.js"));
});

describe("den pågående matchen: kvalet och straffläggningen fortsätter (md-lokal.js)", () => {
  const K = vunnenLiga();
  const lagring = new Map();
  const L = { getItem: (k) => lagring.get(k) ?? null, setItem: (k, v) => lagring.set(k, v), removeItem: (k) => lagring.delete(k) };
  const slut = { ...nyMatch({ mot: { namn: "X", styrka: 0.3 }, avgor: true }), slut: true, min: 90, halvlek: 2, oss: 1, dem: 1 };
  it("ett kval efter slutsignalen med straffar kvar är inte klart – det fortsätter", () => {
    sparaPagaende(L, "u", { sasong: K.sasong, omg: K.liga.omg, typ: "kval", matchId: "k", m: slut });
    assert.ok(lasPagaende(L, "u", K, "kval"));
    assert.equal(lasPagaende(L, "u", K, "liga"), null, "fel typ");
    assert.equal(lasPagaende(L, "u", K), null, "en ligamatch är standard");
  });
  it("mitt i straffläggningen fortsätter den; avgjord gör den inte", () => {
    let m = straffa(slut, [true], rng("a")).m;
    sparaPagaende(L, "u", { sasong: K.sasong, omg: K.liga.omg, typ: "kval", matchId: "k", m });
    assert.deepEqual(lasPagaende(L, "u", K, "kval").m.straffar.oss.length, 1);
    for (let i = 0; !m.straffar.klar; i++) m = straffa(m, [i % 2 === 0], rng(`b${i}`)).m;
    sparaPagaende(L, "u", { sasong: K.sasong, omg: K.liga.omg, typ: "kval", matchId: "k", m });
    assert.equal(lasPagaende(L, "u", K, "kval"), null);
  });
});

describe("Match-fliken: nästa match, kvalet och säsongsslutet (md-vy-match.js)", () => {
  it("efter en vunnen liga är nästa match kvalet – sedan ingenting förrän nästa säsong", () => {
    const K = vunnenLiga();
    const n = vy.nastaSpel(K);
    assert.equal(n.typ, "kval");
    assert.match(n.text, /^KVAL till Division 5 · .+ är ett lag från divisionen ovanför$/);
    const efter = kvalKlar(K, { res: res(2, 0), nu: NU, matchId: "k" }).K;
    assert.equal(vy.nastaSpel(efter), null);
    assert.equal(vy.nastaSpel(nyKarriar({ namn: "A", farg: "#2f6fe8", rng: rng("x") })).typ, "liga");
  });
  it("texterna: uppflyttning, nära, mästare och vanligt slut", () => {
    const K = vunnenLiga();
    const upp = kvalKlar(K, { res: res(1, 1, { straffar: [4, 3], vann: true }), nu: NU, matchId: "k" }).K;
    assert.deepEqual(vy.sasongSlutText(upp, 1, 6).rubrik, "Uppflyttning!");
    assert.match(vy.sasongSlutText(upp, 1, 6).text, /1 – 1 \(straffar 4 – 3\)\. Ni går upp till Division 5/);
    const kvar = kvalKlar(K, { res: res(0, 2), nu: NU, matchId: "k" }).K;
    assert.match(vy.sasongSlutText(kvar, 1, 6).text, /Ni stannar i Division 6/);
    assert.equal(vy.sasongSlutText({ ...K, kval: null, div: 7 }, 1, 12).rubrik, "Mästare!");
    assert.match(vy.sasongSlutText({ ...K, kval: null }, 3, 6).text, /plats 3 av 6/);
  });
  it("kvalets resultat är bara tal, även med text i dokumentet", () => {
    assert.equal(vy.kvalResultat({ oss: XSS, dem: 2, straffar: [XSS, 3] }), "0 – 2 (straffar 0 – 3)");
    assert.equal(vy.kvalResultat({ oss: 1, dem: 0 }), "1 – 0");
  });
});

describe("lärarens vy och elevens statistik: bara tal ur kval och straffar", () => {
  it("lärarens rad: 'kval väntar' ur divisionens namn, aldrig text ur dokumentet", () => {
    const K = vunnenLiga();
    assert.equal(elevRad({ id: "e" }, K).kval, "Division 5");
    assert.equal(elevRad({ id: "e" }, { ...K, kval: { ...K.kval, spelad: true } }).kval, "");
    assert.equal(elevRad({ id: "e" }, { ...K, kval: XSS }).kval, "");
    assert.equal(elevRad({ id: "e" }, { ...K, div: XSS }).kval, "Division 5", "trasig division → tal 0");
  });
  it("mallarna skriver straffarna med tal() och typen bara som en jämförelse", () => {
    for (const f of ["../src/matchdagen/larare/md-larare-stat.js", "../src/matchdagen/vy/md-vy-stat.js"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      assert.doesNotMatch(src, /\$\{m\.(straffar|typ)(\[\d\])?\}/, f);
      assert.match(src, /tal\(m\.straffar\[0\]\)/, f);
    }
  });
  it("en avgjord match bokförs i kön FÖRE sista animationen (stängd flik ger inget nytt kval)", () => {
    const src = readFileSync(new URL("../src/matchdagen/vy/md-match-spel.js", import.meta.url), "utf8");
    assert.match(src, /m = ut\.m;\s*sparaLokalt\(\);\s*bokfor\(\);[\s\S]*?await plan\.spela\(ut\.h, m\)/, "ligamatchen/kvalet");
    assert.match(src, /satt: \(x\) => \{ m = x; bokfor\(\); \}/, "straffläggningen");
    const straff = readFileSync(new URL("../src/matchdagen/vy/md-straff-spel.js", import.meta.url), "utf8");
    assert.match(straff, /ctx\.satt\(m\);[\s\S]*?await plan\.straff\(/);
    assert.match(src, /if \(klar \|\| !arKlar\(m\)\) return;/, "bara en gång, bara när matchen är avgjord");
  });
});
