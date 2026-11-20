// ============================================================================
// Matchdagen 2c (#872): Silverpokalen och rekorden – den rena motorn
// (src/matchdagen/delat/md-cup.js, md-rekord.js, md-sasong.js). Spec
// docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §9, §15:
//   • cupschemat jämnt fördelat för 5, 7, 9 och 11 omgångar
//   • cupen (och kval och uppflyttning) flyttar aldrig ner ett lag
//   • alla rekorden räknas rätt (flest mål i en match och på en säsong, största seger,
//     längsta svit utan förlust, flest ligatitlar i rad, obesegrad säsong, bästa andel
//     rätt på en säsong med minst 3 matcher, snabbaste mål)
//   • texterna i dokumentet (cup, rekord, pokaler) har reglernas form
// Ren node: node --test test/matchdagen-cup.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../src/matchdagen/delat/md-config.js";
import { CUP_RUNDOR, cupKlar, cupLage, cupLottning, cupMatch, cupSchema } from "../src/matchdagen/delat/md-cup.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { forstaDokument, matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong, pokalerFranDok, pokalerTillDok, pokalRad } from "../src/matchdagen/delat/md-sasong.js";
import { lasRekord, REKORD_MONSTER, rekordEfterMatch, rekordEfterSasong, rekordRader, rekordText } from "../src/matchdagen/delat/md-rekord.js";
import { konsPengar } from "../src/matchdagen/md-spara.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const rng = (f = "t") => skapaPrng(f).tal;
const NU = Date.UTC(2026, 10, 20, 10);
const UID = "elev1";
const stat = (fragor = 28, ratt = 20) => ({ skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1,
  derasSkott: 3, fragor, ratt, perKalla: {}, sekunder: 420 });
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: stat(), ...x });
const nyK = (f = "k", div = 0) => {
  const K = nyKarriar({ namn: "Blixtarna IF", farg: "#2f6fe8", rng: rng(f) });
  return div ? { ...K, div, liga: nyLiga(div, K.klubb.farg, rng(`${f}l`)) } : K;
};
/** Spela fram: cupmatcher när de väntar, annars ligan – tills villkoret är uppfyllt eller säsongen slut. */
function spela(K, { liga = () => res(2, 0), cup = () => res(2, 1), tills = () => false } = {}) {
  for (let i = 0; i < 40 && !tills(K); i++) {
    if (cupMatch(K, UID)) K = cupKlar(K, { res: cup(K), nu: NU, matchId: `c${i}`, uid: UID, rng: rng(`c${i}`) }).K;
    else if (nastaMatch(K)) K = matchKlar(K, { res: liga(K), rng: rng(`m${i}`), nu: NU, matchId: `m${i}` }).K;
    else break;
  }
  return K;
}

describe("Silverpokalens schema (§9.1, §15)", () => {
  it("5 omgångar: en cupmatch efter omgång 1, 2, 3 och 4", () => {
    assert.deepEqual(cupSchema(5), [1, 2, 3, 4]);
  });
  for (const antal of [5, 7, 9, 11]) {
    it(`${antal} omgångar: fyra rundor jämnt fördelade, alla före sista ligaomgången`, () => {
      const s = cupSchema(antal);
      assert.equal(s.length, CUP_RUNDOR);
      assert.ok(s.every((o, i) => o >= 1 && o <= antal - 1 && (i === 0 || o > s[i - 1])), `${s}`);
      // Ligaomgångarna före, mellan och efter rundorna: alla lika långa ±1.
      const bitar = [s[0], ...s.slice(1).map((o, i) => o - s[i]), antal - s[3]];
      assert.ok(Math.max(...bitar) - Math.min(...bitar) <= 1, `${antal}: ${bitar}`);
      assert.equal(bitar.reduce((a, b) => a + b, 0), antal);
    });
  }
  it("ligorna i alla divisioner har 5, 7, 9 eller 11 omgångar", () => {
    assert.deepEqual([...new Set(C.LAGANTAL.map((n) => n - 1))], [5, 7, 9, 11]);
  });
});

describe("Silverpokalen: lottningen och matcherna (§9.1)", () => {
  it("fyra motståndare utanför ligan, från divisioner inom ±2, de svagaste först – samma vid omladdning", () => {
    for (const div of [0, 1, 3, 6, 7]) {
      const K = nyK(`l${div}`, div);
      const lott = cupLottning(K, UID);
      assert.equal(lott.length, 4);
      const liga = new Set(K.liga.lag.map((l) => l.namn));
      assert.ok(lott.every((m) => !liga.has(m.namn) && m.div >= Math.max(0, div - 2) && m.div <= Math.min(C.TOPP_DIV, div + 2)), `div ${div}`);
      assert.deepEqual(lott.map((m) => m.div), lott.map((m) => m.div).slice().sort((a, b) => a - b));
      assert.equal(new Set(lott.map((m) => m.namn)).size, 4);
      assert.deepEqual(cupLottning(K, UID), lott, "samma frö");
      assert.notDeepEqual(cupLottning({ ...K, sasong: 2 }, UID).map((m) => m.namn), lott.map((m) => m.namn), "ny säsong, ny lottning");
    }
  });
  it("skrällar är möjliga: ibland ett lag från en högre division", () => {
    const hogre = Array.from({ length: 30 }, (_, i) => cupLottning({ ...nyK("s"), sasong: i + 1 }, UID)).flat().filter((m) => m.div > 0);
    assert.ok(hogre.length > 10);
    assert.ok(hogre.every((m) => m.styrka > C.STYRKA.bas + C.STYRKA.spridning - 0.0001 - C.STYRKA.perDiv), "starkare lag högre upp");
  });
  it("ingen cupmatch före första omgången; efter omgång 1 väntar sextondelsfinalen före nästa ligamatch", () => {
    const K0 = nyK();
    assert.equal(cupMatch(K0, UID), null);
    const K1 = matchKlar(K0, { res: res(1, 0), rng: rng(), nu: NU, matchId: "m1" }).K;
    const c = cupMatch(K1, UID);
    assert.equal(c.runda, 0);
    assert.equal(c.namn, "Sextondelsfinal");
    assert.equal(c.mot.namn, cupLottning(K1, UID)[0].namn);
  });
  it("vinst → nästa runda efter nästa ligaomgång; finalen ger pokalen och prispengarna", () => {
    let K = spela(nyK(), { tills: (x) => cupMatch(x, UID)?.runda === 3 });
    assert.equal(K.cup, "1-3");
    const fore = cupMatch(K, UID);
    assert.equal(fore.namn, "Final");
    const ut = cupKlar(K, { res: res(3, 1), nu: NU, matchId: "final", uid: UID, rng: rng() });
    assert.equal(ut.K.cup, "1-4");
    assert.ok(ut.vannCupen && cupLage(ut.K).vann);
    assert.deepEqual(ut.K.pokaler.at(-1), { typ: "cup", namn: "Silverpokalen", sasong: 1, datum: "2026-11-20" });
    const utan = cupKlar({ ...K, cup: "1-2" }, { res: res(3, 1), nu: NU, matchId: "semi", uid: UID }).pengar;
    assert.equal(ut.pengar - utan, C.CUP.seger, "finalen: + 200 × (1 + 0 × 0,25)");
    assert.equal(cupMatch(ut.K, UID), null, "cupen är slut för säsongen");
    assert.equal(ut.match.typ, "cup");
    assert.equal(ut.match.omg, 4, "omg = rundan");
  });
  it("prispengarna följer multiplikatorn och ingår i köns pengar (md-spara.js konsPengar)", () => {
    const K = { ...spela(nyK("d4", 4), { tills: (x) => cupMatch(x, UID)?.runda === 3 }) };
    const ut = cupKlar(K, { res: res(2, 0), nu: NU, matchId: "f", uid: UID });
    assert.equal(konsPengar([{ match: ut.match }]), ut.pengar, "Division 2: 200 × 2");
    const forlust = cupKlar(K, { res: res(0, 1), nu: NU, matchId: "f", uid: UID });
    assert.equal(konsPengar([{ match: forlust.match }]), forlust.pengar);
  });
  it("förlust → ute för säsongen; oavgjort avgörs av straffarna (res.vann)", () => {
    const K = spela(nyK(), { tills: (x) => !!cupMatch(x, UID) });
    const ute = cupKlar(K, { res: res(0, 2), nu: NU, matchId: "c", uid: UID });
    assert.equal(ute.K.cup, "1-1-u");
    assert.ok(cupLage(ute.K).ute);
    assert.equal(spela(ute.K, { tills: () => false }).cup, "1-1-u", "inga fler cupmatcher den säsongen");
    const str = cupKlar(K, { res: res(1, 1, { straffar: [4, 3], vann: true }), nu: NU, matchId: "c", uid: UID });
    assert.equal(str.K.cup, "1-1");
    assert.deepEqual(str.match.straffar, [4, 3]);
    assert.equal(cupKlar(K, { res: res(1, 1, { straffar: [2, 4], vann: false }), nu: NU, matchId: "c", uid: UID }).K.cup, "1-1-u");
    assert.throws(() => cupKlar(K, { res: res(1, 1), nu: NU, matchId: "c", uid: UID }), /straffar/);
  });
  it("en hel säsong: fyra cupmatcher mellan ligaomgångarna, ligan i ordning", () => {
    for (const div of [0, 2, 4, 6]) {
      const ordning = [];
      let K = nyK(`h${div}`, div);
      for (let i = 0; i < 40; i++) {
        if (cupMatch(K, UID)) { ordning.push(`c${K.liga.omg}`); K = cupKlar(K, { res: res(2, 0), nu: NU, matchId: `c${i}`, uid: UID }).K; }
        else if (nastaMatch(K)) { K = matchKlar(K, { res: res(1, 1), rng: rng(`${i}`), nu: NU, matchId: `m${i}` }).K; ordning.push("l"); }
        else break;
      }
      const antal = C.LAGANTAL[div] - 1;
      assert.deepEqual(ordning.filter((x) => x !== "l"), cupSchema(antal).map((o) => `c${o}`));
      assert.equal(ordning.filter((x) => x === "l").length, antal);
      assert.equal(ordning.at(-1), "l", "sista ligaomgången efter finalen");
    }
  });
  it("cupen flyttar aldrig ner ett lag – inte heller med kval och nya säsonger", () => {
    for (const div of [0, 3, 7]) {
      let K = nyK(`n${div}`, div);
      for (let s = 0; s < 3; s++) {
        const fore = K.div;
        K = spela(K, { cup: (x) => res(cupLage(x).spelade % 2, 1), liga: () => res(4, 0) });
        assert.equal(K.div, fore, "cup och liga rör inte divisionen");
        if (K.kval && !K.kval.spelad) K = kvalKlar(K, { res: res(0, 1), nu: NU, matchId: `k${s}` }).K;
        assert.ok(K.div >= fore);
        K = nySasong(K, rng(`s${s}`));
      }
      // Ett trasigt dokument (div som text) → cupen rör den ändå inte.
      const T = spela({ ...nyK("t", div) }, { tills: (x) => !!cupMatch(x, UID) });
      assert.equal(cupKlar(T, { res: res(0, 3), nu: NU, matchId: "x", uid: UID }).K.div, div);
    }
  });
  it("en annan säsongs cup räknas inte; trasig text → ingen runda spelad", () => {
    const K = nyK();
    for (const cup of ["0-2", "2-3-u", "1-9", "1-0", "x", 12, null, "<img>", "1-2-x"]) assert.deepEqual(cupLage({ ...K, cup }), { spelade: 0, ute: false, vann: false }, String(cup));
    assert.deepEqual(cupLage({ ...K, cup: "1-2-u" }), { spelade: 2, ute: true, vann: false });
  });
});

describe("rekorden (§9.2, §15)", () => {
  const K = (rekord, sasong = 1) => ({ sasong, rekord });
  it("flest mål i en match, största seger och snabbaste mål – första gången tyst, sedan 'Nytt rekord'", () => {
    const k = K(undefined);
    assert.deepEqual(rekordEfterMatch(k, res(2, 1, { mal: [{ min: 30, lag: "oss" }, { min: 10, lag: "dem" }, { min: 70, lag: "oss" }] })), []);
    let R = lasRekord(k.rekord);
    assert.deepEqual([R.mm, R.ss, R.sm], [{ v: 2, s: 1 }, { oss: 2, dem: 1, s: 1 }, { v: 30, s: 1 }]);
    assert.deepEqual(rekordEfterMatch(k, res(5, 0, { mal: [{ min: 4, lag: "oss" }] })), [
      "Nytt rekord: 5 mål i en match!", "Nytt rekord: största segern någonsin, 5–0!", "Nytt rekord: snabbaste målet någonsin – redan i minut 4!"]);
    assert.deepEqual(rekordEfterMatch(k, res(5, 0, { mal: [{ min: 4, lag: "oss" }] })), [], "lika är inget nytt rekord");
    assert.deepEqual(rekordEfterMatch(k, res(6, 1)), ["Nytt rekord: 6 mål i en match!"], "6–1 är inte större än 5–0");
    assert.deepEqual(rekordEfterMatch(k, res(6, 0)), ["Nytt rekord: största segern någonsin, 6–0!"]);
    R = lasRekord(k.rekord);
    assert.deepEqual([R.mm.v, `${R.ss.oss}-${R.ss.dem}`, R.sm.v], [6, "6-0", 4]);
    assert.deepEqual(rekordEfterMatch(k, res(0, 0)), [], "0–0 ger inga målrekord");
  });
  it("längsta svit utan förlust: oavgjort och straffar räknas som inte förlorat; annonseras EN gång när den slår det gamla", () => {
    const k = K(undefined);
    const nya = [];
    const serie = [[1, 0], [1, 1], [2, 0], [0, 1], [1, 0], [1, 1], [3, 3], [1, 0], [2, 0], [2, 0], [0, 4], [1, 0]];
    for (const [a, b] of serie) nya.push(...rekordEfterMatch(k, res(a, b)).filter((t) => /i rad/.test(t)));
    assert.deepEqual(nya, ["Nytt rekord: 4 matcher i rad utan förlust!"], "3 i rad (tyst, första sviten), sedan 5 slår 3 vid 4");
    const R = lasRekord(k.rekord);
    assert.equal(R.sv.v, 6);
    assert.equal(R.nu.svit, 1);
  });
  it("en straffförlust (utslagna ur cupen, förlorat kval) bryter sviten; en straffvinst gör det inte (Testern F3)", () => {
    const k = K(undefined);
    for (const [a, b] of [[1, 0], [2, 0], [1, 0]]) rekordEfterMatch(k, res(a, b));
    rekordEfterMatch(k, res(1, 1, { vann: true, straffar: [4, 3] }));
    assert.equal(lasRekord(k.rekord).nu.svit, 4, "straffvinst: sviten lever");
    rekordEfterMatch(k, res(1, 1, { vann: false, straffar: [3, 4] }));
    assert.equal(lasRekord(k.rekord).nu.svit, 0, "straffförlust: sviten bryts");
    assert.equal(lasRekord(k.rekord).sv.v, 4);
  });
  it("sviten annonseras också när det gamla svitrekordet är 1 – vid 3 matcher, inte vid 2 (granskningen)", () => {
    const k = K(undefined);
    const nya = [];
    for (const [a, b] of [[0, 1], [1, 0], [0, 1], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0]]) nya.push(...rekordEfterMatch(k, res(a, b)).filter((t) => /i rad/.test(t)));
    assert.deepEqual(nya, ["Nytt rekord: 3 matcher i rad utan förlust!"]);
    assert.equal(lasRekord(k.rekord).sv.v, 5);
  });
  it("säsongens rekord: flest mål, bästa andel rätt (minst 3 matcher), ligatitlar i rad och obesegrad säsong", () => {
    const k = K(undefined, 1);
    for (const [a, b] of [[3, 0], [2, 2], [4, 1]]) rekordEfterMatch(k, { ...res(a, b), stat: stat(20, 15) });
    assert.deepEqual(rekordEfterSasong(k, { plac: 1, forlust: 0 }), ["Nytt rekord: en obesegrad säsong!"]);
    let R = lasRekord(k.rekord, 1);
    assert.deepEqual([R.ms, R.ar, R.lt, R.os], [{ v: 9, s: 1 }, { v: 75, s: 1 }, { v: 1, s: 1 }, { v: 1, s: 1 }]);
    // Säsong 2: fler mål, bättre andel, ettan igen (2 i rad), en förlust.
    k.sasong = 2;
    for (const [a, b] of [[5, 0], [0, 1], [5, 2]]) rekordEfterMatch(k, { ...res(a, b), stat: stat(20, 18) });
    assert.deepEqual(rekordEfterSasong(k, { plac: 1, forlust: 1 }), [
      "Nytt rekord: 10 mål på en säsong!", "Nytt rekord: 90 % rätt svar på en säsong!", "Nytt rekord: 2 ligatitlar i rad!"]);
    // Säsong 3: tvåa – sviten av titlar bryts; två matcher räcker inte för andelen.
    k.sasong = 3;
    for (const [a, b] of [[1, 0], [1, 0]]) rekordEfterMatch(k, { ...res(a, b), stat: stat(10, 10) });
    assert.deepEqual(rekordEfterSasong(k, { plac: 2, forlust: 0 }), ["Nytt rekord: 2 obesegrade säsonger!"]);
    R = lasRekord(k.rekord, 3);
    assert.deepEqual([R.ms.v, R.ar.v, R.lt.v, R.nu.lt, R.os.v], [10, 90, 2, 0, 2], "100 % på 2 matcher räknas inte");
  });
  it("säsongens räknare börjar om i en ny säsong – sviterna fortsätter", () => {
    const k = K(undefined, 1);
    rekordEfterMatch(k, res(2, 0));
    k.sasong = 2;
    rekordEfterMatch(k, res(1, 0));
    const R = lasRekord(k.rekord, 2);
    assert.deepEqual([R.nu.s, R.nu.mal, R.nu.matcher, R.nu.svit], [2, 1, 1, 2]);
  });
  it("i spelet: matchKlar, kvalKlar och cupKlar ger de nya rekorden; säsongens rekord efter sista ligaomgången", () => {
    let K = nyK();
    const alla = [];
    for (let i = 0; i < 20; i++) {
      if (cupMatch(K, UID)) { const u = cupKlar(K, { res: res(1, 0), nu: NU, matchId: `c${i}`, uid: UID }); alla.push(...u.rekord); K = u.K; continue; }
      if (!nastaMatch(K)) break;
      const u = matchKlar(K, { res: res(i === 4 ? 7 : 1, 0, { mal: [{ min: 90 - i, lag: "oss" }] }), rng: rng(`${i}`), nu: NU, matchId: `m${i}` });
      alla.push(...u.rekord);
      K = u.K;
    }
    assert.ok(alla.includes("Nytt rekord: 7 mål i en match!"));
    assert.ok(alla.includes("Nytt rekord: en obesegrad säsong!"));
    const R = lasRekord(K.rekord, 1);
    assert.equal(R.ms.v, 4 + 7 + 4, "liga 1+1+1+1+7, cup 4 × 1");
    assert.equal(R.lt.v, 1);
    const kv = kvalKlar(K, { res: res(8, 0), nu: NU, matchId: "k" });
    assert.deepEqual(kv.rekord, ["Nytt rekord: 8 mål i en match!", "Nytt rekord: största segern någonsin, 8–0!"]);
  });
  it("texten har reglernas form (REKORD_MONSTER står ordagrant i firestore.rules) och läses tåligt", () => {
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    assert.ok(rules.includes(`d.rekord.matches('${REKORD_MONSTER}')`));
    const re = new RegExp(`^${REKORD_MONSTER}$`);
    const k = { sasong: 3, rekord: undefined };
    rekordEfterMatch(k, res(40, 0, { mal: [{ min: 1, lag: "oss" }] }));
    rekordEfterSasong(k, { plac: 1, forlust: 0 });
    assert.match(k.rekord, re);
    assert.match(rekordText(lasRekord("")), re);
    assert.match(rekordText(lasRekord("mm<img>.1|ss9-x|nu1.2.3")), re, "trasigt → giltigt");
    const stor = rekordText({ ...lasRekord(""), mm: { v: 1e9, s: 1e9 }, ss: { oss: 500, dem: -3, s: 2 }, nu: { s: 1e7, mal: 1e12, fragor: 5, ratt: 9, matcher: 1, svit: 2, lt: 3, svBas: 4 } });
    assert.match(stor, re, "taken håller formen");
    assert.doesNotMatch("mm5.1|ms|ss|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0", re, "nu har åtta tal");
  });
  it("raderna i Statistik är bara tal ur texten – aldrig HTML", () => {
    const rader = rekordRader('mm5.3|ms<script>|ss6-0.3|sv"x|lt3.5|os1.2|ar85.2|sm2.1|nu3.1.1.1.1.1.1.0');
    assert.equal(rader.length, 8);
    assert.ok(rader.every((r) => !/[<>"]/.test(`${r.namn}${r.varde}`)));
    assert.deepEqual(rader.map((r) => r.varde), ["5 mål", "0 mål", "6–0", "0 matcher", "3", "Ja", "85 %", "minut 2"]);
    assert.equal(rekordRader("").find((r) => r.id === "os").varde, "Inte än");
    assert.equal(rekordRader("").find((r) => r.id === "mm").varde, null);
  });
});

describe("dokumentets texter: pokalerna som rader, en ny klubb utan cup och rekord", () => {
  it("pokalerna sparas som rader 'typ|namn|säsong|datum' och läses tillbaka; HTML-tecken stryks", () => {
    const pokaler = [{ typ: "liga", namn: "Vinnare Division 6", sasong: 1, datum: "2026-11-20" }, { typ: "cup", namn: "Silverpokalen", sasong: 2, datum: "2026-11-21" }];
    const rader = pokalerTillDok(pokaler);
    assert.deepEqual(rader, ["liga|Vinnare Division 6|1|2026-11-20", "cup|Silverpokalen|2|2026-11-21"]);
    assert.deepEqual(pokalerFranDok(rader), pokaler);
    assert.deepEqual(pokalerFranDok([...pokaler]), pokaler, "äldre dokument med objekt");
    assert.equal(pokalRad({ typ: "liga", namn: '<b>"A|B/C&', sasong: "x", datum: "2026-11-20" }), "liga|bAB/C|1|2026-11-20".replace("/", ""));
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    assert.match(rules, /d\.pokaler\.size\(\) <= 300 && mdPokalerOk\(d\.pokaler\.join\('\/'\)\)/);
    assert.match(rules, /t\.size\(\) <= 20000 && t\.matches/, "hela listan tak:as (Testern F1)");
    const m = rules.match(/function mdPokalerOk\(t\) \{\s*return t\.size\(\) <= 20000 && t\.matches\('([^']+)'\)/);
    assert.ok(m, "reglerna prövar pokalerna med ett uttryck");
    const re = new RegExp(`^${m[1]}$`);
    assert.match(rader.join("/"), re);
    assert.match("", re);
    assert.doesNotMatch(["liga|<img>|1|2026-11-20"].join("/"), re);
  });
  it("cupens text har reglernas form", () => {
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const m = rules.match(/d\.cup\.matches\('([^']+)'\)/);
    const re = new RegExp(`^${m[1]}$`);
    for (const ok of ["1-1", "12-4", "3-2-u"]) assert.match(ok, re);
    for (const nej of ["1-0", "1-5", "1-2-v", "<b>", "123456-1"]) assert.doesNotMatch(nej, re);
  });
  it("en ny klubb (och forstaDokument) har varken cup eller rekord – reglernas nya klubb är oförändrad", () => {
    const K = nyK();
    assert.equal(K.cup, undefined);
    assert.equal(K.rekord, undefined);
    const spelad = spela(K, { tills: (x) => cupLage(x).spelade === 2 });
    const f = forstaDokument(spelad);
    assert.equal(f.cup, undefined);
    assert.equal(f.rekord, undefined);
    assert.deepEqual(f.pokaler, []);
  });
});
