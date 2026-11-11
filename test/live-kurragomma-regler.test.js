// ============================================================================
// Kurragömma (#836): spelreglerna – sökningen, rimlighetskontrollen,
// visslingarna (spärrtid, tystnadsregeln, frånkopplad), poängen, placeringen,
// startsökarna, inställningarna, renheten och synken (spec §13.1). Ren node.
// Kartan och geometrin: live-kurragomma-karta.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as R from "../src/live/formats/kurragomma/delat/kg-regler.js";
import * as C from "../src/live/formats/kurragomma/delat/kg-config.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";
import { driftedFiles, kurragommaFiles } from "../admin/sync-guldrush-functions.mjs";

const T0 = 1_700_000_000_000;
const S = 1000;

describe("sökradien (spec §1.6)", () => {
  it("följer tabellen i konfigen – bättre skydd ger mindre radie", () => {
    assert.deepEqual([0, 1, 2, 3].map((n) => R.sokradie(n)), C.SOKRADIE);
    for (let i = 1; i < 4; i++) assert.ok(C.SOKRADIE[i] < C.SOKRADIE[i - 1]);
  });
  it("är 1,5 gånger större de första 10 s efter en vissling", () => {
    assert.equal(C.VISSLING_RADIE_FAKTOR, 1.5);
    assert.equal(C.VISSLING_FONSTER_MS, 10 * S);
    const bas = C.SOKRADIE[2];
    assert.equal(R.sokradie(2, { senastVisslingAt: T0, nu: T0 }), bas * 1.5);
    assert.equal(R.sokradie(2, { senastVisslingAt: T0, nu: T0 + 9999 }), bas * 1.5);
    assert.equal(R.sokradie(2, { senastVisslingAt: T0, nu: T0 + 10 * S }), bas, "fönstret är slut");
    assert.equal(R.sokradie(2, { senastVisslingAt: null, nu: T0 }), bas);
  });
});

describe("sökningen (spec §1.6)", () => {
  const nu = T0;
  it("hittar exakt de gömmare som är inom sin sökradie", () => {
    const gomda = [0, 1, 2, 3].flatMap((n) => [
      { uid: `inne${n}`, x: C.SOKRADIE[n] - 0.01, z: 0, skydd: n },
      { uid: `kant${n}`, x: 0, z: C.SOKRADIE[n], skydd: n },
      { uid: `ute${n}`, x: -(C.SOKRADIE[n] + 0.01), z: 0, skydd: n },
    ]);
    assert.deepEqual(R.sok({ x: 0, z: 0, nu }, gomda), ["inne0", "kant0", "inne1", "kant1", "inne2", "kant2", "inne3", "kant3"]);
  });
  it("en sökning kan hitta flera, och ingen alls", () => {
    const gomda = [{ uid: "a", x: 1, z: 0, skydd: 0 }, { uid: "b", x: 0, z: -1, skydd: 0 }, { uid: "c", x: 20, z: 0, skydd: 0 }];
    assert.deepEqual(R.sok({ x: 0, z: 0, nu }, gomda), ["a", "b"]);
    assert.deepEqual(R.sok({ x: 0, z: 10, nu }, gomda), []);
  });
  it("radien är 1,5 gånger större efter en vissling – och bara de första 10 s", () => {
    const d = C.SOKRADIE[3] * 1.4;
    const g = (senastVisslingAt) => [{ uid: "s", x: d, z: 0, skydd: 3, senastVisslingAt }];
    assert.deepEqual(R.sok({ x: 0, z: 0, nu }, g(null)), []);
    assert.deepEqual(R.sok({ x: 0, z: 0, nu }, g(nu - 3 * S)), ["s"]);
    assert.deepEqual(R.sok({ x: 0, z: 0, nu }, g(nu - 10 * S)), []);
  });
  it("saknas skydd räknas det ur kartan", () => {
    const busk = ON.foremal.find((f) => f.id === "buske-1");
    const g = [{ uid: "i-busken", x: busk.x, z: busk.z }];
    assert.deepEqual(R.sok({ x: busk.x + C.SOKRADIE[3] + 0.1, z: busk.z, nu }, g), [], "skydd 3 → liten radie");
    assert.deepEqual(R.sok({ x: busk.x + C.SOKRADIE[3] - 0.1, z: busk.z, nu }, g), ["i-busken"]);
  });
});

describe("rimlighetskontrollen och kgLeta:s kontroller (spec §1.6)", () => {
  const bas = { roll: "sokare", laddningar: 1, nu: T0 + 10 * S, startpunkt: { x: 1, z: 1, at: T0 } };
  it("nekar en sökning för långt bort – maxFart × tid + 2 m", () => {
    const max = C.MAX_FART * 10 + C.RIMLIG_MARGINAL_M;
    assert.equal(C.MAX_FART, 6);
    assert.equal(R.rimligPlats({ x: 1 + max - 0.01, z: 1, nu: T0 + 10 * S }, { x: 1, z: 1, at: T0 }), true);
    assert.equal(R.rimligPlats({ x: 1 + max + 0.01, z: 1, nu: T0 + 10 * S }, { x: 1, z: 1, at: T0 }), false);
    assert.equal(R.rimligPlats({ x: 3.5, z: 1, nu: T0 }, { x: 1, z: 1, at: T0 }), false, "2,5 m på 0 s");
    assert.equal(R.rimligPlats({ x: 2.9, z: 1, nu: T0 }, { x: 1, z: 1, at: T0 }), true, "marginalen 2 m");
  });
  it("räknar från förra sökningen, annars från startpunkten", () => {
    const sok = { x: 20, z: 0, at: T0 + 7 * S };
    assert.deepEqual(R.kontrolleraSokning({ ...bas, x: 20, z: 5, senasteSok: sok }), { ok: true });
    assert.deepEqual(R.kontrolleraSokning({ ...bas, x: -5, z: 5, senasteSok: sok }), { ok: false, skal: "orimlig" }, "25 m på 3 s");
    assert.deepEqual(R.kontrolleraSokning({ ...bas, x: 25, z: 1 }), { ok: true }, "24 m på 10 s från startpunkten");
    assert.deepEqual(R.kontrolleraSokning({ ...bas, x: 1, z: -29.9, nu: T0 + 2 * S }), { ok: false, skal: "orimlig" });
  });
  it("nekar den som inte är sökare, saknar laddning, är inom spärrtiden eller utanför ön", () => {
    assert.equal(R.kontrolleraSokning({ ...bas, roll: "gomd", x: 1, z: 1 }).skal, "inte-sokare");
    assert.equal(R.kontrolleraSokning({ ...bas, laddningar: 0, x: 1, z: 1 }).skal, "ingen-laddning");
    const sok = { x: 1, z: 1, at: bas.nu - C.LETA_SPARR_MS + 1 };
    assert.equal(R.kontrolleraSokning({ ...bas, x: 1, z: 1, senasteSok: sok }).skal, "sparr");
    assert.equal(R.kontrolleraSokning({ ...bas, x: 1, z: 1, senasteSok: { ...sok, at: bas.nu - C.LETA_SPARR_MS } }).ok, true);
    assert.equal(R.kontrolleraSokning({ ...bas, x: 31, z: 0, nu: T0 + 60 * S }).skal, "utanfor");
    assert.equal(C.LETA_SPARR_MS, 2000);
  });
  it("missraden i flödet högst var 15:e s per sökare", () => {
    assert.equal(R.missFlodeTillats(null, T0), true);
    assert.equal(R.missFlodeTillats(T0, T0 + 14_999), false);
    assert.equal(R.missFlodeTillats(T0, T0 + 15_000), true);
  });
});

describe("visslingen: spärrtid, tystnadsregeln och frånkopplad (spec §1.3, §1.5)", () => {
  const sp = C.VISSLING_SPARR_MS;
  it("fel svar visslar – men inte inom spärrtiden", () => {
    assert.equal(R.visslarVidFel({ roll: "gomd", nu: T0 }), true, "första gången");
    assert.equal(R.visslarVidFel({ roll: "gomd", senastVisslingAt: T0, nu: T0 + sp - 1 }), false);
    assert.equal(R.visslarVidFel({ roll: "gomd", senastVisslingAt: T0, nu: T0 + sp }), true);
  });
  it("en sökares fel svar visslar aldrig, och ingen visslar under gömfasen", () => {
    assert.equal(R.visslarVidFel({ roll: "sokare", nu: T0 }), false);
    assert.equal(R.visslarVidFel({ roll: "gomd", fas: "gom", nu: T0 }), false);
  });
  it("svarsEffekt: gömd rätt +10, gömd fel → vissling, sökare rätt +10 och +1 laddning (tak 3), sökare fel → inget", () => {
    assert.deepEqual(R.svarsEffekt({ roll: "gomd", ratt: true, nu: T0 }), { poang: 10, laddningar: 0, vissling: false });
    assert.deepEqual(R.svarsEffekt({ roll: "gomd", ratt: false, nu: T0 }), { poang: 0, laddningar: 0, vissling: true });
    assert.deepEqual(R.svarsEffekt({ roll: "gomd", ratt: false, senastVisslingAt: T0, nu: T0 + 5 * S }),
      { poang: 0, laddningar: 0, vissling: false });
    assert.deepEqual(R.svarsEffekt({ roll: "sokare", ratt: true, laddningar: 1, nu: T0 }), { poang: 10, laddningar: 2, vissling: false });
    assert.deepEqual(R.svarsEffekt({ roll: "sokare", ratt: true, laddningar: 3, nu: T0 }), { poang: 10, laddningar: 3, vissling: false });
    assert.deepEqual(R.svarsEffekt({ roll: "sokare", ratt: false, laddningar: 2, nu: T0 }), { poang: 0, laddningar: 2, vissling: false });
    assert.equal(C.POANG.ratt, 10);
    assert.equal(C.LADDNING_MAX, 3);
  });
  it("laddningar: startsökarna 1 + det som laddades under blundandet (tak 3), ny sökare 1", () => {
    assert.equal(R.laddningarVidLetStart(0), 1);
    assert.equal(R.laddningarVidLetStart(1), 2);
    assert.equal(R.laddningarVidLetStart(3), 3);
    assert.equal(R.laddningarNySokare(), 1);
  });

  const tyst = { roll: "gomd", letStartAt: T0, pulsAt: T0 + 44 * S };
  it("tystnadsregeln: inget svar på 45 s → vissling", () => {
    assert.equal(C.TYSTNAD_MS, 45 * S);
    assert.equal(R.tystnadVisslar({ ...tyst, nu: T0 + 44_999 }), false);
    assert.equal(R.tystnadVisslar({ ...tyst, nu: T0 + 45 * S }), true);
    assert.equal(R.tystnadVisslar({ ...tyst, senastSvarAt: T0 + 20 * S, nu: T0 + 45 * S }), false, "svarade för 25 s sedan");
    assert.equal(R.tystnadVisslar({ ...tyst, senastSvarAt: T0 + 20 * S, pulsAt: T0 + 64 * S, nu: T0 + 65 * S }), true);
  });
  it("tystnadsregeln räknas om från visslingen – högst en vissling per 45 s", () => {
    assert.equal(R.tystnadVisslar({ ...tyst, senastVisslingAt: T0 + 45 * S, pulsAt: T0 + 80 * S, nu: T0 + 89 * S }), false);
    assert.equal(R.tystnadVisslar({ ...tyst, senastVisslingAt: T0 + 45 * S, pulsAt: T0 + 80 * S, nu: T0 + 90 * S }), true);
  });
  it("tystnadsregeln gäller inte en frånkopplad elev (ingen puls på 30 s)", () => {
    assert.equal(C.FRANKOPPLAD_MS, 30 * S);
    assert.equal(R.tystnadVisslar({ ...tyst, pulsAt: T0 + 15 * S + 1, nu: T0 + 45 * S }), true, "puls för 29,999 s sedan");
    assert.equal(R.tystnadVisslar({ ...tyst, pulsAt: T0 + 15 * S, nu: T0 + 45 * S }), false, "puls för 30 s sedan");
    assert.equal(R.tystnadVisslar({ ...tyst, pulsAt: null, nu: T0 + 45 * S }), false, "ingen puls alls");
    assert.equal(R.arFrankopplad(T0, T0 + 29_999), false);
    assert.equal(R.arFrankopplad(T0, T0 + 30_000), true);
  });
  it("tystnadsregeln: av, sökare, gömfasen", () => {
    const nu = T0 + 50 * S;
    const p = { ...tyst, pulsAt: nu };
    assert.equal(R.tystnadVisslar({ ...p, nu }), true);
    assert.equal(R.tystnadVisslar({ ...p, tystnadPa: false, nu }), false);
    assert.equal(R.tystnadVisslar({ ...p, roll: "sokare", nu }), false);
    assert.equal(R.tystnadVisslar({ ...p, fas: "gom", nu }), false);
  });
  it("visslingsplatsen är ungefärlig: inom osäkerheten, på ön, likformig över cirkeln", () => {
    const rng = skapaPrng("vissling");
    let inreHalva = 0;
    for (let i = 0; i < 4000; i++) {
      const g = { x: rng.mellan(-29, 29) * 0.7, z: rng.mellan(-29, 29) * 0.7 };
      const v = R.visslingsplats(g.x, g.z, rng.tal(), rng.tal());
      const d = Math.hypot(v.x - g.x, v.z - g.z);
      assert.ok(d <= C.VISSLING_OSAKERHET_M + 1e-9);
      assert.ok(Math.hypot(v.x, v.z) <= ON.radie + 1e-9);
      if (d <= C.VISSLING_OSAKERHET_M / Math.SQRT2) inreHalva++;
    }
    assert.ok(Math.abs(inreHalva / 4000 - 0.5) < 0.04, "halva ytan → halva träffarna");
    const kant = R.visslingsplats(29.9, 0, 0.99, 0);
    assert.ok(Math.hypot(kant.x, kant.z) <= ON.radie + 1e-9, "hålls på ön");
    assert.ok(Math.hypot(kant.x - 29.9, kant.z) <= C.VISSLING_OSAKERHET_M);
  });
  it("hjärtslaget: en sökare inom 6 m", () => {
    assert.equal(C.HJARTSLAG_M, 6);
    assert.equal(R.hjartslag({ x: 0, z: 0 }, [{ x: 6, z: 0 }]), true);
    assert.equal(R.hjartslag({ x: 0, z: 0 }, [{ x: 6.01, z: 0 }, { x: -10, z: 3 }]), false);
    assert.equal(R.hjartslag({ x: 0, z: 0 }, []), false);
  });
});

describe("poängen och placeringen (spec §1.3, §1.4, §1.7)", () => {
  it("rätt svar 10, hittad 40 till sökaren", () => {
    assert.equal(C.POANG.ratt, 10);
    assert.equal(R.poangForHittad(), 40);
  });
  it("överlevnad: +2 per HELA 10 s som gömd under letfasen", () => {
    assert.equal(R.overlevnadsPoang(0), 0);
    assert.equal(R.overlevnadsPoang(9_999), 0);
    assert.equal(R.overlevnadsPoang(10_000), 2);
    assert.equal(R.overlevnadsPoang(95_000), 18);
    assert.equal(R.overlevnadsPoang(-5000), 0);
    assert.equal(R.poangVidHittad({ letStartAt: T0, hittadAt: T0 + 61 * S }), 12);
  });
  it("gömd när tiden tar slut: överlevnaden + 50", () => {
    assert.equal(R.poangGomdVidSlut({ letStartAt: T0, slutAt: T0 + 8 * 60 * S }), 96 + 50);
    assert.equal(C.POANG.gomdVidSlut, 50);
  });
  it("delad placering: 1, 1, 3", () => {
    const p = R.placering([{ uid: "c", poang: 30 }, { uid: "b", poang: 50 }, { uid: "a", poang: 50 }, { uid: "d", poang: 10 }]);
    assert.deepEqual(p.map((r) => [r.uid, r.plats]), [["a", 1], ["b", 1], ["c", 3], ["d", 4]]);
    assert.deepEqual(R.placering([{ uid: "x", poang: 5 }, { uid: "y", poang: 5 }, { uid: "z", poang: 5 }]).map((r) => r.plats), [1, 1, 1]);
    assert.deepEqual(R.placering([{ uid: "x", poang: 9 }, { uid: "y", poang: 5 }, { uid: "z", poang: 5 }]).map((r) => r.plats), [1, 2, 2]);
    assert.deepEqual(R.placering([]), []);
  });
  it("raderna till live-rewards (spec §10)", () => {
    assert.deepEqual(R.rewardRader([{ uid: "a", poang: 120, ratt: 9, besvarade: 12, roll: "gomd" }]),
      [{ uid: "a", score: 120, correct: 9, answered: 12 }]);
  });
  it("matchen slutar när tiden är ute eller alla gömda är hittade", () => {
    assert.equal(R.arSlut({ fas: "leta", nu: T0, slutAt: T0 + 1, gomdaKvar: 3 }), false);
    assert.equal(R.arSlut({ fas: "leta", nu: T0 + 1, slutAt: T0 + 1, gomdaKvar: 3 }), true);
    assert.equal(R.arSlut({ fas: "leta", nu: T0, slutAt: T0 + 1, gomdaKvar: 0 }), true);
    assert.equal(R.arSlut({ fas: "gom", nu: T0, slutAt: T0 + 1, gomdaKvar: 0 }), false, "gömfasen: ingen har låst än");
  });
});

describe("rollerna och inställningarna (spec §1.1, §9, §0.1)", () => {
  it("startsökare Auto: 1 per påbörjat 10-tal, minst 1, högst 4 – och alltid minst en gömmare", () => {
    const auto = (n) => R.antalStartsokare(n, "auto");
    assert.deepEqual([1, 2, 9, 10, 11, 20, 21, 25, 30, 31, 40, 60].map(auto), [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4]);
    assert.equal(R.antalStartsokare(25), 3, "standard är auto");
  });
  it("startsökare 1–4 som läraren valt, klämt", () => {
    assert.equal(R.antalStartsokare(25, 1), 1);
    assert.equal(R.antalStartsokare(25, 4), 4);
    assert.equal(R.antalStartsokare(25, 9), 4);
    assert.equal(R.antalStartsokare(25, 0), 1);
    assert.equal(R.antalStartsokare(3, 4), 2, "minst en gömmare");
  });
  it("dragningen av startsökare: rätt antal, olika elever, samma frö → samma dragning", () => {
    const uids = Array.from({ length: 25 }, (_, i) => `e${i}`);
    const a = R.valjSlumpade(uids, 3, skapaPrng("x").tal);
    assert.equal(a.length, 3);
    assert.equal(new Set(a).size, 3);
    assert.deepEqual(R.valjSlumpade(uids, 3, skapaPrng("x").tal), a);
    assert.equal(R.valjSlumpade(["a"], 3, Math.random).length, 1);
  });
  it("anslutning: under gömfasen gömmare, annars sökare", () => {
    assert.equal(R.rollVidAnslutning("gom"), "gomd");
    assert.equal(R.rollVidAnslutning("leta"), "sokare");
  });
  it("ny sökare behövs när ingen sökare är ansluten i letfasen", () => {
    const nu = T0 + 100 * S;
    assert.equal(R.behoverNySokare({ fas: "leta", sokare: [{ pulsAt: nu - 31 * S }], gomdaKvar: 5, nu }), true);
    assert.equal(R.behoverNySokare({ fas: "leta", sokare: [], gomdaKvar: 5, nu }), true);
    assert.equal(R.behoverNySokare({ fas: "leta", sokare: [{ pulsAt: nu - 31 * S }, { pulsAt: nu - 2 * S }], gomdaKvar: 5, nu }), false);
    assert.equal(R.behoverNySokare({ fas: "gom", sokare: [], gomdaKvar: 5, nu }), false);
    assert.equal(R.behoverNySokare({ fas: "leta", sokare: [], gomdaKvar: 0, nu }), false);
  });
  it("lärarens inställningar normaliseras till specens val", () => {
    assert.deepEqual(R.normInstallningar(), { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    assert.deepEqual(R.normInstallningar({ gomtid: 45, startsokare: 2, tystnad: false, karta: "on" }),
      { gomtid: 45, startsokare: 2, tystnad: false, karta: "on" });
    assert.deepEqual(R.normInstallningar({ gomtid: 33, startsokare: 7, tystnad: "ja", karta: "skolgarden" }),
      { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    assert.deepEqual(C.GOMTIDER_S, [20, 30, 45, 60]);
  });
  it("kärnans matchklocka täcker gömtid + speltid; speltiden 1–60 hela minuter", () => {
    assert.equal(R.matchSekunder({ gomtid: 30, speltidMin: 8 }), 510);
    assert.equal(R.normSpeltidMin(0), 1);
    assert.equal(R.normSpeltidMin(7.6), 8);
    assert.equal(R.normSpeltidMin(99), 60);
    assert.equal(R.normSpeltidMin("x"), null);
    for (const saknas of [undefined, null, "", "  "]) assert.equal(R.normSpeltidMin(saknas), null, JSON.stringify(saknas));
    assert.equal(R.normSpeltidMin("12"), 12);
    assert.deepEqual(C.SPELTIDER_MIN, [3, 5, 10, 15, 20, 30]);
    assert.equal(C.SPELTID_REKOMMENDERAD_MIN, 8);
  });
});

describe("delat/ är ren, har alla tal i kg-config och är synkad till functions/", () => {
  const DIR = new URL("../src/live/formats/kurragomma/delat/", import.meta.url);
  const filer = readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();
  const utanKommentarer = (f) => readFileSync(new URL(f, DIR), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  it("ingen DOM, ingen Firebase, ingen three.js, ingen klocka/slump – bara importer inom delat/", () => {
    for (const f of filer) {
      const src = utanKommentarer(f);
      assert.doesNotMatch(src, /Math\.random|Date\.now|new Date|performance\.|document\.|window\.|firebase|three|setTimeout|localStorage|sessionStorage/i, f);
      for (const [, imp] of src.matchAll(/from\s+"([^"]+)"/g)) assert.match(imp, /^\.\/kg-[a-z]+\.js$/, `${f}: ${imp}`);
    }
  });
  it("geometrin och reglerna har inga speltal – de ligger i kg-config.js", () => {
    const tillatna = new Set(["0", "1", "2", "4", "16", "60", "0.25", "1000", "1e-9"]);
    for (const f of ["kg-geometri.js", "kg-regler.js"]) {
      const src = utanKommentarer(f).replace(/"[^"\n]*"|`[^`\n]*`/g, "\"\"");
      const tal = [...src.matchAll(/(?<![\w.])(\d+(?:\.\d+)?(?:e-?\d+)?)(?![\w.])/g)].map((m) => m[1]);
      assert.deepEqual(tal.filter((t) => !tillatna.has(t)), [], f);
    }
  });
  it("functions/kurragomma/ är en exakt kopia (npm run sync:kurragomma)", () => {
    assert.deepEqual(kurragommaFiles(), filer);
    assert.deepEqual(driftedFiles().filter((f) => f.startsWith("kurragomma/")), [], "kör npm run sync:kurragomma");
    const kopior = readdirSync(new URL("../functions/kurragomma/", import.meta.url)).filter((f) => f.endsWith(".js")).sort();
    assert.deepEqual(kopior, filer, "en fil i functions/kurragomma/ saknar källa i delat/");
  });
  it("ingen fil över 400 rader", () => {
    for (const f of filer) assert.ok(readFileSync(new URL(f, DIR), "utf8").split("\n").length <= 401, f);
    assert.ok(readFileSync(new URL("../admin/kg-balans-sim.mjs", import.meta.url), "utf8").split("\n").length <= 401);
  });
});
