// ============================================================================
// Matchdagen 3 (#873): Superligan, Mästarcupen, legendklubben och pokalskåpet –
// den rena motorn (src/matchdagen/delat/md-mastarcup.js, md-legend.js, md-sasong.js).
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §10, §15:
//   • mästare i Superligan → pokalen "superliga" och inbjudan till Mästarcupen nästa säsong
//   • Mästarcupens lottning (toppklubbar 0,86–0,95), rundorna (kvart, semi, final), straffar
//   • ingen flyttas någonsin ned – inte av Mästarcupen, inte av ett trasigt dokument
//   • legendklubben: pokaler och rekord följer med, en guldstjärna, klubbhistoriken
//   • texterna i dokumentet (mastarcup, klubbhistorik, pokaler) har reglernas form
// Ren node: node --test test/matchdagen-mastarcup.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../src/matchdagen/delat/md-config.js";
import { cupKlar, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { MC_MONSTER, MC_RUNDOR, mcKlar, mcLage, mcLottning, mcMatch, mcSchema } from "../src/matchdagen/delat/md-mastarcup.js";
import { HISTORIK_MONSTER, guldkant, historikRader, klubbStart, legendErbjudande, nyLegendklubb, pokalSort, skapet } from "../src/matchdagen/delat/md-legend.js";
import { matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong, pokalerFranDok, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { lasRekord } from "../src/matchdagen/delat/md-rekord.js";
import { TOPPKLUBBAR } from "../src/matchdagen/delat/md-namn.js";
import { hamtaKarriar, konsPengar, legender, sparaKon } from "../src/matchdagen/md-spara.js";
import { laggIKo, lasOsparad, sparaPagaende } from "../src/matchdagen/md-lokal.js";
import { hinderMatch } from "../src/matchdagen/vy/md-vy-marknad.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const rng = (f = "t") => skapaPrng(f).tal;
const NU = Date.UTC(2026, 10, 20, 10);
const UID = "elev1";
const TOPP = C.TOPP_DIV;
const stat = (fragor = 28, ratt = 22) => ({ skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1,
  derasSkott: 3, fragor, ratt, perKalla: {}, sekunder: 420 });
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: stat(), ...x });
const superK = (f = "s") => {
  const K = nyKarriar({ namn: "Blixtarna IF", farg: "#2f6fe8", rng: rng(f) });
  return { ...K, div: TOPP, sasong: 12, liga: nyLiga(TOPP, K.klubb.farg, rng(`${f}l`)) };
};
/** Spela fram: Silverpokalen, Mästarcupen och ligan i appens ordning (cupen först) – tills villkoret gäller eller säsongen är slut. */
function spela(K, { liga = () => res(3, 0), cup = () => res(2, 1), mc = () => res(2, 1), tills = () => false } = {}) {
  for (let i = 0; i < 60 && !tills(K); i++) {
    if (cupMatch(K, UID)) K = cupKlar(K, { res: cup(K), nu: NU, matchId: `c${i}`, uid: UID, rng: rng(`c${i}`) }).K;
    else if (mcMatch(K, UID)) K = mcKlar(K, { res: mc(K), nu: NU, matchId: `mc${i}`, uid: UID, rng: rng(`mc${i}`) }).K;
    else if (nastaMatch(K)) K = matchKlar(K, { res: liga(K), rng: rng(`m${i}`), nu: NU, matchId: `m${i}` }).K;
    else break;
  }
  return K;
}
/** En mästare som spelar säsongen efter med inbjudan. */
const inbjuden = (f = "s") => nySasong(spela(superK(f)), rng(`${f}n`));

describe("Superligan: mästare (§10.1)", () => {
  it("vinnaren får mästarpokalen, inget kval, och en inbjudan till nästa säsong", () => {
    const K0 = superK();
    let sista = null;
    let K = K0;
    while (nastaMatch(K)) {
      if (cupMatch(K, UID)) { K = cupKlar(K, { res: res(2, 1), nu: NU, matchId: "c", uid: UID }).K; continue; }
      sista = matchKlar(K, { res: res(3, 0), rng: rng(), nu: NU, matchId: "m" });
      K = sista.K;
    }
    assert.equal(sista.mastare, true);
    const p = K.pokaler.filter((x) => x.typ === "superliga");
    assert.equal(p.length, 1);
    assert.equal(p[0].namn, C.SUPERLIGA.pokal);
    assert.equal(K.kval, null);
    assert.equal(K.mastarcup, "13-0");
    assert.equal(mcLage(K).inbjuden, false, "inbjudan gäller NÄSTA säsong");
    const N = nySasong(K, rng());
    assert.equal(N.div, TOPP, "fortsätter i Superligan");
    assert.deepEqual(mcLage(N), { inbjuden: true, spelade: 0, ute: false, vann: false });
    assert.equal(guldkant(N), true, "guldkant på klubbmärket");
  });
  it("tvåa i Superligan: ingen pokal, ingen inbjudan, ingen guldkant", () => {
    const K = spela(superK(), { liga: () => res(0, 2) });
    assert.equal(K.pokaler.filter((x) => x.typ === "superliga").length, 0);
    assert.equal(K.mastarcup, undefined);
    assert.equal(guldkant(K), false);
  });
  it("ligavinnaren under Superligan blir inte mästare och bjuds inte in", () => {
    const K0 = nyKarriar({ namn: "A", farg: "#2f6fe8", rng: rng() });
    const K = spela({ ...K0, div: 6, liga: nyLiga(6, K0.klubb.farg, rng("e")) });
    assert.ok(K.kval, "kvalet till Superligan");
    assert.equal(K.mastarcup, undefined);
  });
});

describe("Mästarcupen: lottningen och rundorna (§10.2, §15)", () => {
  it("rundorna spelas efter Superligans omgång 3, 6 och 8 – före sista omgången, aldrig samtidigt som Silverpokalen", () => {
    assert.deepEqual(mcSchema(11), [3, 6, 8]);
    assert.equal(MC_RUNDOR, 3);
    assert.deepEqual(C.MASTARCUP.rundor, ["Kvartsfinal", "Semifinal", "Final"]);
  });
  it("tre påhittade toppklubbar med styrkan 0,86–0,95, svagast först, samma vid omladdning", () => {
    const K = inbjuden();
    const l = mcLottning(K, UID);
    assert.equal(l.length, 3);
    assert.ok(l.every((t) => TOPPKLUBBAR.includes(t.namn) && t.styrka >= 0.86 && t.styrka <= 0.95), JSON.stringify(l));
    assert.ok(l[0].styrka <= l[1].styrka && l[1].styrka <= l[2].styrka);
    assert.equal(new Set(l.map((t) => t.namn)).size, 3);
    assert.deepEqual(mcLottning(K, UID), l);
    assert.ok(l.every((t) => t.farg !== K.klubb.farg));
  });
  it("hela vägen: kvartsfinal → semifinal → final → pokalen och prispengarna; divisionen ändras aldrig", () => {
    let K = inbjuden();
    const rundor = [];
    let fin = null;
    for (let i = 0; i < 40 && !mcLage(K).vann; i++) {
      const mc = mcMatch(K, UID);
      if (mc) {
        rundor.push([mc.namn, K.liga.omg, mc.final]);
        fin = mcKlar(K, { res: res(2, 1), nu: NU, matchId: `x${i}`, uid: UID, rng: rng(`r${i}`) });
        assert.equal(fin.match.typ, "mastarcup");
        assert.equal(fin.match.omg, mc.runda + 1);
        assert.equal(fin.K.div, TOPP);
        K = fin.K;
      } else if (cupMatch(K, UID)) K = cupKlar(K, { res: res(2, 1), nu: NU, matchId: "c", uid: UID }).K;
      else K = matchKlar(K, { res: res(1, 0), rng: rng(`l${i}`), nu: NU, matchId: "m" }).K;
    }
    assert.deepEqual(rundor, [["Kvartsfinal", 3, false], ["Semifinal", 6, false], ["Final", 8, true]]);
    assert.equal(fin.vannCupen, true);
    assert.equal(K.mastarcup, `${K.sasong}-3`);
    assert.equal(K.pokaler.at(-1).typ, "mastarcup");
    const pris = Math.round(C.MASTARCUP.seger * (1 + TOPP * C.KASSA.perDiv));
    assert.ok(fin.pengar >= pris);
    assert.equal(konsPengar([{ match: fin.match }]), fin.pengar, "kön räknar prispengarna");
    assert.equal(mcMatch(K, UID), null);
  });
  it("oavgjort avgörs på straffar: straffvinst = vidare, straffförlust = ute (och en straffförlust bryter sviten)", () => {
    const K = spela(inbjuden(), { tills: (x) => !!mcMatch(x, UID) });
    const vinst = mcKlar(K, { res: res(1, 1, { straffar: [5, 4], vann: true }), nu: NU, matchId: "a", uid: UID });
    assert.equal(vinst.vann, true);
    assert.deepEqual(vinst.match.straffar, [5, 4]);
    assert.equal(vinst.K.mastarcup, `${K.sasong}-1`);
    const ute = mcKlar(K, { res: res(2, 2, { straffar: [3, 4], vann: false }), nu: NU, matchId: "b", uid: UID });
    assert.equal(ute.vann, false);
    assert.equal(ute.K.mastarcup, `${K.sasong}-1-u`);
    assert.equal(lasRekord(ute.K.rekord).nu.svit, 0);
    assert.equal(mcMatch(ute.K, UID), null, "utslagna: ingen mer match");
    assert.throws(() => mcKlar(K, { res: res(1, 1, { vann: null }), nu: NU, matchId: "c", uid: UID }), /utan straffar/);
  });
  it("utan inbjudan, i fel säsong eller under Superligan: ingen Mästarcup", () => {
    const K = spela(superK(), { tills: (x) => x.liga.omg >= 3 });
    assert.equal(mcMatch(K, UID), null);
    assert.equal(mcMatch({ ...K, mastarcup: `${K.sasong - 1}-0` }, UID), null);
    assert.ok(mcMatch({ ...K, mastarcup: `${K.sasong}-0` }, UID));
    assert.equal(mcMatch({ ...K, mastarcup: `${K.sasong}-0`, div: 5 }, UID), null, "en legendklubb i Division 6 spelar aldrig Mästarcupen");
    assert.equal(mcMatch({ ...K, mastarcup: "trasig" }, UID), null);
    assert.throws(() => mcKlar(K, { res: res(1, 0), nu: NU, matchId: "x", uid: UID }), /ingen match/);
  });
  it("ingen flyttas ned: en hel karriär i Superligan med Mästarcupen ändrar aldrig divisionen", () => {
    let K = superK("lang");
    const r = rng("utfall");
    const slump = () => { const a = Math.floor(r() * 4); const b = Math.floor(r() * 4); return a === b ? res(a, b, { straffar: [4, 3], vann: r() < 0.5 }) : res(a, b); };
    for (let s = 0; s < 8; s++) {
      K = spela(K, { liga: () => res(Math.floor(r() * 4), Math.floor(r() * 3)), cup: slump, mc: slump });
      assert.equal(K.div, TOPP);
      K = nySasong(K, rng(`n${s}`));
    }
    assert.match(K.mastarcup ?? "1-0", new RegExp(`^${MC_MONSTER}$`));
  });
  it("mastarcup-texten har reglernas form (MC_MONSTER = firestore.rules)", () => {
    for (const t of ["13-0", "13-2", "13-3", "13-1-u"]) assert.match(t, new RegExp(`^${MC_MONSTER}$`));
    for (const t of ["13-4", "x-1", "13-1-v", "", "13-0-u", "13-4-u"]) assert.doesNotMatch(t, new RegExp(`^${MC_MONSTER}$`));
    // granskningen: "13-0-u" (utslagna utan spelad runda) fick vyerna att läsa rundor[-1] – nekas, och mcLage tål det
    assert.equal(mcLage({ div: TOPP, sasong: 13, mastarcup: "13-0-u" }).inbjuden, false);
    const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    assert.ok(regler.includes(`'${MC_MONSTER}'`), "samma uttryck i reglerna");
    assert.ok(regler.includes(`'${HISTORIK_MONSTER}`), "klubbhistorikens uttryck i reglerna");
  });
});

/** En klubb som just vunnit Mästarcupen (säsong 13, Superligan). */
function mastarcupVinnare(f = "s") {
  return spela(inbjuden(f), { tills: (x) => mcLage(x).vann });
}

describe("Legendklubben (§10.3, §15)", () => {
  it("erbjudandet gäller efter en vunnen Mästarcup, resten av säsongen – inte efter en förlorad", () => {
    const K = mastarcupVinnare();
    assert.equal(legendErbjudande(K), true);
    const slut = spela(K);
    assert.equal(legendErbjudande(slut), true, "också när säsongen är slut");
    assert.equal(legendErbjudande(nySasong(slut, rng())), false, "inte nästa säsong");
    const forlorad = spela(inbjuden(), { mc: () => res(0, 1), tills: (x) => mcLage(x).ute });
    assert.equal(legendErbjudande(forlorad), false);
    assert.throws(() => nyLegendklubb(forlorad, { namn: "X", farg: "#e8473f", rng: rng() }), /inte vunnen/);
  });
  it("ny klubb i Division 6: nytt namn, nya grundpelare, nollställd kassa och marknad, nästa säsong", () => {
    const K = mastarcupVinnare();
    const N = nyLegendklubb(K, { namn: "Legenderna FC", farg: "#e8473f", rng: rng("leg") });
    assert.equal(N.div, 0);
    assert.equal(N.sasong, K.sasong + 1);
    assert.equal(N.kassa, C.KASSA.start);
    assert.equal(C.KASSA.start, 600, "firestore.rules mdLegendOk: d.kassa == 600");
    assert.deepEqual([N.klubb.namn, N.klubb.farg], ["Legenderna FC", "#e8473f"]);
    assert.deepEqual(N.trupp.map((p) => [p.id, p.st, p.xp, p.grundpelare]), [1, 2, 3, 4, 5, 6, 7].map((i) => [`g${i}`, 1, 0, true]));
    assert.deepEqual([N.reserver, N.marknad, N.kval, N.mastarcup], [[], [], null, null]);
    assert.equal(N.liga.lag.length, C.LAGANTAL[0]);
    assert.equal(N.liga.omg, 0);
    assert.equal(mcMatch(N, UID), null);
    assert.ok(nastaMatch(N));
  });
  it("pokalskåpet och rekorden följer med; en guldstjärna; den gamla klubben i klubbhistoriken", () => {
    const K = mastarcupVinnare();
    const N = nyLegendklubb(K, { namn: "Legenderna FC", farg: "#e8473f", rng: rng("leg") });
    assert.deepEqual(N.pokaler, K.pokaler);
    assert.deepEqual(skapet(N.pokaler), skapet(K.pokaler));
    const [r0, r1] = [lasRekord(K.rekord), lasRekord(N.rekord)];
    for (const k of ["mm", "ms", "ss", "sv", "lt", "os", "ar", "sm"]) assert.deepEqual(r1[k], r0[k], k);
    assert.deepEqual(r1.nu, { s: N.sasong, mal: 0, fragor: 0, ratt: 0, matcher: 0, svit: 0, lt: 0, svBas: r0.sv?.v || 0 });
    assert.deepEqual(N.summa, K.summa, "lärarens statistik finns kvar");
    assert.deepEqual(N.senaste, K.senaste);
    assert.equal(N.klubb.legendStjarnor, 1);
    assert.equal(N.klubbhistorik.length, 1);
    assert.match(N.klubbhistorik[0], new RegExp(`^${HISTORIK_MONSTER}$`));
    const [h] = historikRader(N.klubbhistorik);
    assert.equal(h.namn, "Blixtarna IF");
    assert.deepEqual([h.fran, h.till], [1, K.sasong]);
    assert.equal(h.pokaler.superliga, 1);
    assert.equal(h.pokaler.mastarcup, 1);
    assert.equal(klubbStart(N), K.sasong + 1);
    assert.equal(guldkant(N), false, "guldkanten hör till den gamla klubben");
  });
  it("en andra legendklubb: två stjärnor, två rader, säsongerna räknas från den förra", () => {
    let K = nyLegendklubb(mastarcupVinnare(), { namn: "Andra", farg: "#2ecc71", rng: rng("a") });
    // Snabbspola: den nya klubben i Superligan, mästare och Mästarcupen igen.
    K = { ...K, div: TOPP, liga: nyLiga(TOPP, K.klubb.farg, rng("b")) };
    K = nySasong(spela(K), rng("c"));
    K = spela(K, { tills: (x) => mcLage(x).vann });
    const N = nyLegendklubb(K, { namn: "Tredje & <b>", farg: "#8e5cf7", rng: rng("d") });
    assert.equal(N.klubb.legendStjarnor, 2);
    const h = historikRader(N.klubbhistorik);
    assert.deepEqual(h.map((x) => [x.fran, x.till]), [[1, 13], [14, 15]]);
    assert.deepEqual([h[1].pokaler.superliga, h[1].pokaler.mastarcup], [1, 1]);
    assert.ok(N.klubbhistorik.every((r) => new RegExp(`^${HISTORIK_MONSTER}$`).test(r)));
    assert.ok(!/[<>]/.test(N.klubb.namn), "lagnamnet utan vinkelparenteser");
    const N2 = nyLegendklubb({ ...K, klubb: { ...K.klubb, namn: "A & B / C" } }, { namn: "X", farg: "#8e5cf7", rng: rng("e") });
    assert.equal(historikRader(N2.klubbhistorik).at(-1).namn, "A  B  C", "reglernas tecken | / < > & \" tas bort i historiken");
  });
  it("klubbhistoriken har ett tak (LEGEND.max) som håller dokumentet litet", () => {
    const K = mastarcupVinnare();
    const full = { ...K, klubbhistorik: Array.from({ length: C.LEGEND.max }, (_, i) => `Klubb ${i}|#2f6fe8|${i + 1}-${i + 1}|0.0.0.0.1`) };
    assert.equal(legendErbjudande(full), false);
    const langst = Array.from({ length: C.LEGEND.max }, () => `${"x".repeat(24)}|#2f6fe8|99999-99999|9999.9999.9999.9999.9999`).join("/");
    assert.ok(langst.length <= C.LEGEND.tecken, `${langst.length}`);
  });
  it("trasiga rader i klubbhistoriken hoppas över", () => {
    assert.deepEqual(historikRader(["", "bara text", 5, null, "A|#zzzzzz|1-2|0.0.0.0.0"]), []);
    assert.equal(klubbStart({ klubbhistorik: ["A|#112233|1-9|1.0.0.0.0"] }), 10);
  });
});

describe("Pokalskåpet (§10.4)", () => {
  it("fem sorter med antal och säsonger; gamla 'Vinnare Superligan' räknas som Superligan", () => {
    const p = [
      { typ: "liga", namn: "Vinnare Division 6", sasong: 1 }, { typ: "kval", namn: "Kvalade upp till Division 5", sasong: 1 },
      { typ: "liga", namn: "Vinnare Division 5", sasong: 3 }, { typ: "cup", namn: "Silverpokalen", sasong: 2 },
      { typ: "liga", namn: "Vinnare Superligan", sasong: 9 }, { typ: "superliga", namn: "Mästare i Superligan", sasong: 10 },
      { typ: "mastarcup", namn: "Mästarcupen", sasong: 11 }, { typ: "okand", namn: "x", sasong: 4 },
    ];
    assert.deepEqual(skapet(p).map((s) => [s.id, s.antal, s.sasonger]), [
      ["liga", 2, [1, 3]], ["kval", 1, [1]], ["cup", 1, [2]], ["superliga", 2, [9, 10]], ["mastarcup", 1, [11]],
    ]);
    assert.equal(pokalSort({ typ: "liga", namn: "Vinnare Superligan" }), "superliga");
    assert.equal(pokalSort(null), null);
  });
  it("de nya pokalerna sparas som rader i reglernas form och läses tillbaka", () => {
    const p = [{ typ: "superliga", namn: "Mästare i Superligan", sasong: 12, datum: "2026-11-20" }, { typ: "mastarcup", namn: "Mästarcupen", sasong: 13, datum: "2026-11-21" }];
    const rader = pokalerTillDok(p);
    const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const m = /function mdPokalerOk\(t\) \{\s*return t\.size\(\) <= (\d+) && t\.matches\('([^']+)'\)/.exec(regler);
    assert.ok(m, "mdPokalerOk i reglerna");
    assert.match(rader.join("/"), new RegExp(`^${m[2]}$`));
    assert.deepEqual(pokalerFranDok(rader), p);
  });
});

describe("Legendklubben och kön (md-spara.js, granskningen #873)", () => {
  const lagring = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const gammal = () => mastarcupVinnare("ko");
  const ny = (K) => nyLegendklubb(K, { namn: "Norrsken FF", farg: "#2ecc71", rng: rng("ny") });
  it("legender räknar klubbhistorikens rader (tålig)", () => {
    assert.equal(legender(null), 0);
    assert.equal(legender({ klubbhistorik: "x" }), 0);
    assert.equal(legender(ny(gammal())), 1);
  });
  it("en legendklubb på servern (annan dator, sparning efter tidsgränsen): kön för den gamla klubben kastas vid start", async () => {
    const K = gammal();
    const N = ny(K);
    const S = { uid: "u", lagring: lagring(), data: { lasKarriar: async () => N, sparaMatch: async () => { throw new Error("ska inte sparas"); } } };
    laggIKo(S.lagring, "u", { K: { ...K, summa: { ...K.summa, matcher: K.summa.matcher + 1 } }, matchId: "gammal", match: {} });
    const val = await hamtaKarriar(S);
    assert.equal(val.klubb.namn, "Norrsken FF");
    assert.equal(val.div, 0);
    assert.equal(lasOsparad(S.lagring, "u"), null, "kön är kastad");
  });
  it("nekad match för den gamla klubben medan servern har en legendklubb: serverns nya klubb gäller, ingen hybrid", async () => {
    const K = gammal();
    const N = ny(K);
    const sparade = [];
    const S = { uid: "u", lagring: lagring(), K,
      data: { lasKarriar: async () => N, sparaMatch: async (uid, K2, id) => { if (legender(K2) < 1) throw Object.assign(new Error("nej"), { code: "permission-denied" }); sparade.push(id); } } };
    laggIKo(S.lagring, "u", { K, matchId: "gammal", match: {} });
    assert.equal(await sparaKon(S), true, "kön är tom");
    assert.deepEqual(sparade, [], "inget skrivs över den nya klubben");
    assert.equal(S.K.klubb.namn, "Norrsken FF");
    assert.equal(lasOsparad(S.lagring, "u"), null);
  });
});

describe("En pågående match i Mästarcupen (granskningen #873)", () => {
  it("stoppar köp, byten och träningsläger efter en omladdning – som Silverpokalen", () => {
    const m = new Map();
    const L = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    let K = inbjuden("hinder");
    K = spela(K, { tills: (x) => !!mcMatch(x, UID) && !cupMatch(x, UID) });
    const mc = mcMatch(K, UID);
    assert.ok(mc, "en match i Mästarcupen väntar");
    const S = { uid: UID, lagring: L, K };
    assert.equal(hinderMatch(S), null);
    sparaPagaende(L, UID, { sasong: K.sasong, omg: K.liga.omg, typ: "mastarcup", runda: mc.runda, matchId: "x", m: { slut: false, oss: 0 } });
    assert.match(hinderMatch(S), /Spela klart matchen/);
  });
});
