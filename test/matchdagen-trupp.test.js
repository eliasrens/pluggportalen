// ============================================================================
// Matchdagen 2b (#871): truppen, reserverna, marknaden och träningslägret – den rena
// modulen md-trupp.js (spec §8, §15 Motorn: "marknaden, priserna och reserverna
// (grundpelarna säljs aldrig), träningslägret (#883: 50/100/250/500 poäng per stjärna, tre läger per omgång, taket 5),
// lagbonusen används"), det pågående lägret i md-lokal.js och korten i Truppen
// (allt ur dokumentet escapas eller blir tal – eleven skriver dokumentet, #869 G1).
// Reglerna: firestore-rules-matchdagen-trupp.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../src/matchdagen/delat/md-config.js";
import * as T from "../src/matchdagen/delat/md-trupp.js";
import { chansRaddning, chansSkott, lagbonus } from "../src/matchdagen/delat/md-motor.js";
import { forstaDokument, matchKlar, nastaMatch, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { laggIKo, lasLager, lasOsparad, pagaendeLager, rensaLager, sparaLager } from "../src/matchdagen/md-lokal.js";
import { konsPengar, ovanpaServern, sparaKon } from "../src/matchdagen/md-spara.js";
import { pengarFor } from "../src/matchdagen/delat/md-sasong.js";
import { lagdelarHtml, marknadKort, reservKort, startKort, traningsStapel } from "../src/matchdagen/vy/md-vy-marknad.js";
import { firaText, lagerRubrik, lagerStangtText, stangtHtml } from "../src/matchdagen/vy/md-vy-lager.js";

const NU = Date.UTC(2026, 10, 20, 10);
const rng = (f) => skapaPrng(f).tal;
const kopia = (v) => JSON.parse(JSON.stringify(v));
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: {}, sekunder: 420 };
const res = (oss, dem) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT });
const XSS = "<img src=x onerror=alert(1)>";

const K0 = nyKarriar({ namn: "Blixtarna", farg: "#2f6fe8", rng: rng("k0") });
const K1 = matchKlar(K0, { res: res(2, 1), rng: rng("k1"), nu: NU, matchId: "m1" }).K;
const salu = (over = {}) => ({ id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st: 3, xp: 0, ...over });
/** K1 med en bestämd marknad och kassa. */
const med = (marknad, over = {}) => ({ ...kopia(K1), marknad, kassa: 5000, ...over });
const grund = (i, pos) => ({ id: `r${i}`, namn: `Reserv ${i}`, pos, nr: 30 + i, st: 2, xp: 0, grundpelare: true, kapten: false });
const kopt = (i, pos, st = 3) => ({ id: `kr${i}`, namn: `Köpt ${i}`, pos, nr: 60 + i, st, xp: 0 });

describe("priserna och marknaden (§8.3)", () => {
  it("priset avrunda(150 × st^1,9; 10): 560, 1 210, 2 090, 3 190 kr; säljs för halva", () => {
    assert.deepEqual([2, 3, 4, 5].map(T.pris), [560, 1210, 2090, 3190]);
    assert.equal(T.saljPris(3), 605);
  });
  it("reglernas pristabell och stjärntak är desamma som modulens", () => {
    const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const pris = JSON.parse(regler.match(/function mdPris\(st\) \{ return (\[[^\]]+\])/)[1]);
    assert.deepEqual(pris, [0, 1, 2, 3, 4, 5].map((s) => (s ? T.pris(s) : 0)));
    const tak = JSON.parse(regler.match(/n\.st <= (\[[^\]]+\])\[d\.div\]/)[1]);
    assert.deepEqual(tak, C.DIVISIONER.map((_, d) => T.marknadMaxSt(d)));
  });
  it("stjärnorna kl(avrunda(slump(1; 3,2 + div × 0,3)); 1; 5) – högre upp i stegen, bättre spelare (#883: från 1★)", () => {
    for (let div = 0; div < C.DIVISIONER.length; div++) {
      const r = rng(`st${div}`);
      const st = Array.from({ length: 400 }, () => T.marknadStjarnor(div, r));
      assert.ok(st.every((s) => s >= 1 && s <= T.marknadMaxSt(div)), `div ${div}`);
      if (div === 0) assert.ok(st.includes(1) && st.includes(3), "Division 6: 1★–3★");
    }
    assert.equal(T.marknadMaxSt(0), 3);
    assert.equal(T.marknadMaxSt(7), 5);
  });
  it("6 spelare till salu: otränade, giltiga positioner, namn/id/nummer som klubben inte redan har", () => {
    const m = T.nyMarknad(K0, rng("m"));
    assert.equal(m.length, C.MARKNAD.antal);
    const klubb = K0.trupp;
    for (const p of m) {
      assert.equal(p.xp, 0);
      assert.ok(C.LAGDELAR.includes(p.pos));
      assert.ok(!("grundpelare" in p) && !("kapten" in p), "en köpt spelare är aldrig grundpelare");
      assert.ok(Object.keys(p).length <= 6, "reglerna: högst 6 fält");
      assert.ok(!klubb.some((g) => g.id === p.id || g.namn === p.namn));
    }
    assert.equal(new Set(m.map((p) => p.id)).size, 6);
    assert.deepEqual(T.nyMarknad(K0, rng("m")), m, "samma slump → samma marknad");
  });
  it("en ny klubb har ingen marknad; efter varje match (och kvalet) kommer 6 nya", () => {
    assert.deepEqual(K0.marknad, []);
    assert.equal(K1.marknad.length, 6);
    const K2 = matchKlar(K1, { res: res(0, 0), rng: rng("k2"), nu: NU, matchId: "m2" }).K;
    assert.notDeepEqual(K2.marknad.map((p) => p.id), K1.marknad.map((p) => p.id));
    let V = K2;
    for (let i = 0; nastaMatch(V); i++) V = matchKlar(V, { res: res(4, 0), rng: rng(`v${i}`), nu: NU, matchId: `v${i}` }).K;
    const efter = kvalKlar(V, { res: { ...res(2, 0), vann: true }, rng: rng("kv"), nu: NU, matchId: "kv" }).K;
    assert.equal(efter.div, 1);
    assert.equal(efter.marknad.length, 6);
    assert.notDeepEqual(efter.marknad, V.marknad);
  });
});

describe("köpet och reserverna – grundpelarna säljs aldrig (§8.2–8.3)", () => {
  it("den köpta ersätter den sämsta på positionen; grundpelaren går till reserverna; kassan minskar med priset", () => {
    const K = med([salu()]);
    const r = T.kop(K, "kny");
    const i = r.K.trupp.findIndex((p) => p.id === "kny");
    assert.equal(K.trupp[i].pos, "ANF");
    assert.equal(r.K.reserver.length, 1);
    assert.equal(r.K.reserver[0].id, K.trupp[i].id);
    assert.equal(r.K.reserver[0].grundpelare, true);
    assert.equal(r.K.kassa, 5000 - 1210);
    assert.deepEqual(r.K.marknad, []);
    assert.deepEqual(r.salda, []);
    assert.equal(K.trupp[i].grundpelare, true, "K ändras inte");
  });
  it("en köpt spelare som ersätts säljs för halva priset (den sämsta först)", () => {
    const K = med([salu({ st: 5 })]);
    const i = K.trupp.findIndex((p) => p.pos === "ANF");
    K.trupp[i] = kopt(1, "ANF", 3);
    const j = K.trupp.findIndex((p, x) => p.pos === "ANF" && x !== i);
    K.trupp[j] = kopt(2, "ANF", 4);
    const r = T.kop(K, "kny");
    assert.equal(r.K.trupp[i].id, "kny", "3★ är sämst och ersätts");
    assert.deepEqual(r.salda, [{ namn: "Köpt 1", belopp: 605 }]);
    assert.equal(r.K.kassa, 5000 - 3190 + 605);
    assert.equal(r.K.reserver.length, 0, "en köpt spelare går inte till reserverna");
  });
  it("inte bättre än den som ersätts, eller kassan räcker inte → går inte", () => {
    assert.equal(T.kopInfo(med([salu({ st: 1 })]), "kny").orsak, "inteBattre");
    assert.equal(T.kopInfo(med([salu()], { kassa: 1209 }), "kny").orsak, "kassa");
    assert.equal(T.kopInfo(med([salu()], { kassa: 1210 }), "kny").kan, true);
    assert.equal(T.kopInfo(med([]), "kny").orsak, "saknas");
    assert.throws(() => T.kop(med([salu({ st: 1 })]), "kny"), /inteBattre/);
  });
  it("fulla reserver: eleven släpper en KÖPT reserv (halva priset) – grundpelare kan aldrig släppas", () => {
    const K = med([salu()], { reserver: [grund(1, "FÖR"), grund(2, "MIT"), grund(3, "MIT"), grund(4, "ANF"), kopt(9, "MV", 4)] });
    const i = T.kopInfo(K, "kny");
    assert.equal(i.masteSlappa, true);
    assert.deepEqual(i.slappbara.map((p) => p.id), ["kr9"]);
    assert.throws(() => T.kop(K, "kny"), /släppa/);
    assert.throws(() => T.kop(K, "kny", { slapp: "r1" }), /släppa/, "en grundpelare går inte att släppa");
    const r = T.kop(K, "kny", { slapp: "kr9" });
    assert.equal(r.K.reserver.length, 5);
    assert.ok(!r.K.reserver.some((p) => p.id === "kr9"));
    assert.equal(r.K.reserver.filter((p) => p.grundpelare).length, 5);
    assert.deepEqual(r.salda, [{ namn: "Köpt 9", belopp: T.saljPris(4) }]);
    assert.equal(r.K.kassa, 5000 - 1210 + T.saljPris(4));
    const alla = med([salu()], { reserver: [grund(1, "FÖR"), grund(2, "MIT"), grund(3, "MIT"), grund(4, "ANF"), grund(5, "MV")] });
    assert.equal(T.kopInfo(alla, "kny").orsak, "reserverFulla", "fem grundpelare i reserven – köpet stoppas");
  });
  it("en reserv byts in för en startspelare på samma position, och tillbaka", () => {
    const r = T.kop(med([salu()]), "kny").K;
    const g = r.reserver[0];
    const B = T.bytIn(r, g.id, "kny");
    assert.ok(B.trupp.some((p) => p.id === g.id));
    assert.deepEqual(B.reserver.map((p) => p.id), ["kny"]);
    assert.deepEqual(T.bytIn(B, "kny", g.id).trupp, r.trupp);
    const mv = r.trupp.find((p) => p.pos === "MV");
    assert.throws(() => T.bytIn(r, g.id, mv.id), /position/);
  });
  it("kaptensbindeln: kaptenen – eller, när kaptenen är reserv, den första grundpelaren ute på planen", () => {
    const k = K0.trupp.findIndex((p) => p.kapten);
    assert.equal(T.kaptenPlats(K0.trupp), k);
    const utan = K0.trupp.map((p) => ({ ...p, kapten: false }));
    assert.equal(T.kaptenPlats(utan), 1);
    assert.equal(T.kaptenPlats(utan.map((p) => ({ ...p, grundpelare: false }))), 1);
  });
  it("ett äldre dokument (Etapp 1–2a) får tomma reserver och tom marknad", () => {
    const { reserver, marknad, ...gammal } = kopia(K0);
    void reserver; void marknad;
    const K = T.truppFalt(gammal);
    assert.deepEqual([K.reserver, K.marknad], [[], []]);
    assert.deepEqual(T.truppFalt(K1), K1);
  });
});

describe("träningslägret (§8.4, #883)", () => {
  /** K med `n` spelade omgångar (alla vunna). */
  const efter = (n) => {
    let V = K0;
    for (let i = 0; i < n && nastaMatch(V); i++) V = matchKlar(V, { res: res(4, 0), rng: rng(`e${i}`), nu: NU, matchId: `e${i}` }).K;
    return V;
  };
  const atta = Array(8).fill({ ratt: true });
  it("en stjärna kostar 50, 100, 250 och 500 poäng (nyckeln = stjärnan man når); reglerna har samma tabell", () => {
    assert.deepEqual(C.TRANING.xpTillStjarna, { 2: 50, 3: 100, 4: 250, 5: 500 });
    assert.deepEqual([1, 2, 3, 4, 5].map(T.xpTill), [50, 100, 250, 500, 0]);
    assert.deepEqual([1, 2, 3, 4, 5].map((st) => T.traningsVarde({ st, xp: 0 })), [0, 50, 150, 400, 900]);
    const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const varde = JSON.parse(regler.match(/function mdTranVarde\(p\) \{ return (\[[^\]]+\])\[p\.st\]/)[1]);
    assert.deepEqual(varde, [0, 1, 2, 3, 4, 5].map((st) => (st ? T.traningsVarde({ st, xp: 0 }) : 0)));
    const tak = JSON.parse(regler.match(/n\.xp < (\[[^\]]+\])\[n\.st\]/)[1]);
    assert.deepEqual(tak, [0, 50, 100, 250, 500, 1], "xp under poängen till nästa stjärna; vid 5★ bara 0");
  });
  it("12 poäng per rätt, vid 50/100/250/500 en stjärna till (resten följer med), fel ger inget, taket 5★", () => {
    const p = { ...K0.trupp[1], st: 1, xp: 0 };
    assert.deepEqual(T.tranaSpelare(p, false), { p, nyStjarna: false });
    assert.equal(T.tranaSpelare(p, true).p.xp, 12);
    const r = T.tranaSpelare({ ...p, xp: 48 }, true);
    assert.deepEqual([r.p.st, r.p.xp, r.nyStjarna], [2, 10, true], "1★ → 2★ vid 50");
    assert.deepEqual([T.tranaSpelare({ ...p, st: 2, xp: 96 }, true).p.st, T.tranaSpelare({ ...p, st: 2, xp: 96 }, true).p.xp], [3, 8], "2★ → 3★ vid 100");
    assert.deepEqual([T.tranaSpelare({ ...p, st: 3, xp: 237 }, true).p.st, T.tranaSpelare({ ...p, st: 3, xp: 237 }, true).p.xp], [3, 249], "249 är inte 250");
    assert.deepEqual([T.tranaSpelare({ ...p, st: 3, xp: 240 }, true).p.st, T.tranaSpelare({ ...p, st: 3, xp: 240 }, true).p.xp], [4, 2], "3★ → 4★ vid 250");
    const fem = T.tranaSpelare({ ...p, st: 4, xp: 495 }, true);
    assert.deepEqual([fem.p.st, fem.p.xp], [5, 0], "4★ → 5★ vid 500, vid 5★ nollas poängen");
    assert.equal(T.tranaSpelare(fem.p, true).p.xp, 0);
    assert.equal(T.tranaSpelare({ ...p, st: 4, xp: 480 }, true).p.st, 4);
  });
  it("hur många rätt svar det tar från 1★: 2★ efter 5, 3★ efter 13, 4★ efter 34, 5★ efter 75 (900 poäng, ~10 fulla läger)", () => {
    let p = { ...K0.trupp[1], st: 1, xp: 0 };
    const nar = {};
    for (let n = 1; p.st < 5; n++) {
      const r = T.tranaSpelare(p, true);
      p = r.p;
      if (r.nyStjarna) nar[p.st] = n;
    }
    assert.deepEqual(nar, { 2: 5, 3: 13, 4: 34, 5: 75 });
  });
  it("en ny karriär börjar med 1★; en äldre spelare (2★, 0–99 poäng) tränar vidare utan att flyttas", () => {
    assert.ok(K0.trupp.every((p) => p.st === 1 && p.xp === 0));
    const gammal = { ...K0.trupp[2], st: 2, xp: 99 };
    assert.equal(T.xpTill(2), 100, "99 < 100: fortfarande giltig träning mot 3★");
    assert.deepEqual([T.tranaSpelare(gammal, true).p.st, T.tranaSpelare(gammal, true).p.xp], [3, 11]);
    const g3 = T.tranaSpelare({ ...gammal, st: 3, xp: 60 }, true).p;
    assert.deepEqual([g3.st, g3.xp], [3, 72], "3★ med 60 poäng: mot 250 nu");
  });
  it("tre läger per spelad omgång ('säsong-omgång-1…3'), ett fjärde nekas; inget före första matchen", () => {
    assert.equal(T.lagerNyckel(K0), null);
    assert.equal(T.lagerKvar(K0), 0);
    assert.equal(T.lagerNyckel(K1), "1-1-1");
    assert.equal(T.lagerKvar(K1), 3);
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1-1" }), "1-1-2");
    assert.equal(T.lagerKvar({ ...K1, lager: "1-1-1" }), 2);
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1-2" }), "1-1-3");
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1-3" }), null, "det fjärde lägret nekas");
    assert.equal(T.lagerKvar({ ...K1, lager: "1-1-3" }), 0);
    const id = K1.trupp[3].id;
    let K = K1;
    for (const n of [1, 2, 3]) K = T.lagerResultat(K, { nyckel: T.lagerNyckel(K), spelareId: id, svar: atta, nu: NU }).K;
    assert.equal(K.lager, "1-1-3");
    assert.throws(() => T.lagerResultat(K, { nyckel: "1-1-4", spelareId: id, svar: atta, nu: NU }), /ledigt/);
    assert.deepEqual([K.trupp[3].st, K.trupp[3].xp], [3, 288 - 150], "3 × 96 = 288 poäng: 1★ → 3★ och 138 mot 250");
    // Nästa match nollar räknaren.
    const K2 = matchKlar(K, { res: res(1, 0), rng: rng("x"), nu: NU, matchId: "x" }).K;
    assert.deepEqual([T.lagerNyckel(K2), T.lagerKvar(K2)], ["1-2-1", 3]);
  });
  it("lägrets nummer och rubriken 'Träningsläger 2/3'", () => {
    assert.deepEqual(["1-1-1", "1-4-3", "12-10-2-p", "1-3", "1-k", null].map(T.lagerNummer), [1, 3, 2, 1, null, null]);
    assert.equal(lagerRubrik("1-1-2"), "Träningsläger 2/3");
    assert.equal(lagerRubrik("1-3"), "Träningsläger 1/3");
    assert.equal(lagerRubrik("1-k"), "Träningsläger");
  });
  it("äldre nycklar (före #883): 'säsong-omgång' = det första lägret, påbörjat fortsätter; 'säsong-k' = slut", () => {
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1" }), "1-1-2", "ett läger använt – två kvar");
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1-p" }), "1-1", "ett påbörjat läger i gamla formen fortsätter med samma nyckel");
    const id = K1.trupp[3].id;
    const ut = T.lagerResultat({ ...K1, lager: "1-1-p" }, { nyckel: "1-1", spelareId: id, svar: atta, nu: NU }).K;
    assert.deepEqual([ut.lager, T.lagerNyckel(ut)], ["1-1", "1-1-2"]);
    const V = efter(99);
    assert.ok(V.kval && !V.kval.spelad);
    assert.equal(T.lagerNyckel({ ...V, lager: "1-k" }), null);
    assert.equal(T.lagerNyckel({ ...V, lager: "1-k-p" }), "1-k");
  });
  it("före kvalet: omgångens tre läger – inget extra; efter kvalet inga fler", () => {
    const V = efter(99);
    const sista = `1-${V.liga.omg}`;
    assert.equal(T.lagerNyckel(V), `${sista}-1`);
    assert.equal(T.lagerNyckel({ ...V, lager: `${sista}-2` }), `${sista}-3`);
    assert.equal(T.lagerNyckel({ ...V, lager: `${sista}-3` }), null, "inget extra läger före kvalet (#883: tre räcker)");
    const spelat = kvalKlar(V, { res: { ...res(0, 1), vann: false }, rng: rng("kq"), nu: NU, matchId: "kq" }).K;
    assert.equal(T.lagerNyckel(spelat), null, "kvalet är en match – säsongens läger är slut");
    assert.match(lagerStangtText(spelat), /Kvalet är spelat/);
  });
  it("8 rätt: +96 poäng, frågorna räknas som källan 'träning' i statistiken och dagarna", () => {
    const id = K1.trupp[3].id;
    const ut = T.lagerResultat(K1, { nyckel: "1-1-1", spelareId: id, svar: atta, sekunder: 95, nu: NU });
    assert.equal(ut.K.lager, "1-1-1");
    assert.deepEqual([ut.spelare.st, ut.spelare.xp, ut.stjarnor], [2, 46, 1], "1★ + 96 → 2★ och 46 mot 100");
    assert.equal(ut.K.summa.fragor, K1.summa.fragor + 8);
    assert.equal(ut.K.summa.ratt, K1.summa.ratt + 8);
    assert.deepEqual(ut.K.summa.perKalla.traning, { fragor: 8, ratt: 8, namn: "Träning" });
    assert.equal(ut.K.summa.matcher, K1.summa.matcher, "lägret är ingen match");
    assert.equal(Object.values(ut.K.dagar).reduce((s, d) => s + d.fragor, 0), Object.values(K1.dagar).reduce((s, d) => s + d.fragor, 0) + 8);
    assert.equal(K1.lager, undefined, "K ändras inte");
  });
  it("inget ledigt läger, eller en spelare med 5★ → nekas", () => {
    const id = K1.trupp[3].id;
    assert.throws(() => T.lagerResultat(K0, { nyckel: "1-0-1", spelareId: id, svar: [], nu: NU }), /ledigt/);
    assert.throws(() => T.lagerResultat({ ...K1, lager: "1-1-1" }, { nyckel: "1-1-1", spelareId: id, svar: [], nu: NU }), /ledigt/);
    const fem = { ...kopia(K1) };
    fem.trupp[3].st = 5;
    assert.throws(() => T.lagerResultat(fem, { nyckel: "1-1-1", spelareId: id, svar: [], nu: NU }), /5 stjärnor/);
  });
  it("det pågående lägret sparas lokalt och fortsätter – bara för klubbens lediga läger och en spelare i startelvan", () => {
    const m = new Map();
    const L = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
    const id = K1.trupp[2].id;
    sparaLager(L, "u", { nyckel: "1-1-1", spelareId: id, svar: [{ ratt: true }, { ratt: "ja" }], sek: 12 });
    assert.deepEqual(lasLager(L, "u", K1), { v: 1, nyckel: "1-1-1", spelareId: id, svar: [{ ratt: true }, { ratt: false }], sek: 12 });
    assert.equal(lasLager(L, "annan", K1), null);
    assert.equal(lasLager(L, "u", { ...K1, lager: "1-1-1" }), null, "lägret är redan sparat");
    assert.equal(lasLager(L, "u", T.bytIn({ ...kopia(K1), reserver: [{ ...K1.trupp[2], id: "r" }] }, "r", id)), null, "spelaren är inte kvar");
    rensaLager(L, "u");
    assert.equal(lasLager(L, "u", K1), null);
  });
  it("påbörjat läger ('-p'): samma läger gäller tills det sparas eller räknas som använt – aldrig ett nytt", () => {
    const S1 = T.lagerStart(K1);
    assert.equal(S1.lager, "1-1-1-p");
    assert.equal(K1.lager, undefined, "K ändras inte");
    assert.equal(T.lagerNyckel(S1), "1-1-1");
    assert.equal(T.lagerKvar(S1), 3, "det påbörjade räknas med");
    assert.equal(T.lagerPaborjat(S1), true);
    assert.equal(T.lagerPaborjat(K1), false);
    const id = K1.trupp[3].id;
    const ut = T.lagerResultat(S1, { nyckel: "1-1-1", spelareId: id, svar: atta, nu: NU });
    assert.equal(ut.K.lager, "1-1-1", "klart – lägret byts från det påbörjade");
    assert.equal(T.lagerNyckel(ut.K), "1-1-2");
    const A = T.lagerAvbrutet(S1);
    assert.deepEqual([A.lager, T.lagerNyckel(A), A.trupp], ["1-1-1", "1-1-2", K1.trupp], "avbrutet: använt, ingen träning");
    const S3 = T.lagerStart({ ...K1, lager: "1-1-2" });
    assert.deepEqual([S3.lager, T.lagerNyckel(T.lagerAvbrutet(S3))], ["1-1-3-p", null], "det tredje avbrutet: alla använda");
    // Ett påbörjat läger i en gammal omgång gäller inte: nästa match öppnar nya.
    const K2 = matchKlar(S1, { res: res(1, 0), rng: rng("p"), nu: NU, matchId: "p" }).K;
    assert.deepEqual([T.lagerNyckel(K2), T.lagerPaborjat(K2)], ["1-2-1", false]);
  });
  it("utan lokal lagring (privat fönster) gäller lägret i minnet – ett flikbyte startar inget nytt", () => {
    const id = K1.trupp[2].id;
    const S1 = T.lagerStart(K1);
    const minne = { v: 1, nyckel: "1-1-1", spelareId: id, svar: [{ ratt: false }], sek: 3 };
    assert.deepEqual(pagaendeLager({ lagring: null, uid: "u", K: S1, lagerMinne: minne }), minne);
    assert.equal(pagaendeLager({ lagring: null, uid: "u", K: S1, lagerMinne: null }), null);
    assert.equal(pagaendeLager({ lagring: null, uid: "u", K: { ...S1, lager: "1-1-1" }, lagerMinne: minne }), null, "sparat");
  });
});

describe("marknaden i dokumentet: rader \"id|namn|pos|nr|st\" (#871 F1)", () => {
  it("fram och tillbaka utan förlust; redan rader och äldre objekt går igenom; trasiga rader faller bort", () => {
    const rader = T.marknadTillDok(K1.marknad);
    assert.ok(rader.every((x) => typeof x === "string" && x.split("|").length === 5));
    assert.deepEqual(T.marknadFranDok(rader), K1.marknad);
    assert.deepEqual(T.marknadTillDok(rader), rader, "en gång till ändrar inget");
    assert.deepEqual(T.marknadFranDok([K1.marknad[0], "trasig", null]), [K1.marknad[0]]);
    assert.deepEqual(T.truppFalt({ ...K1, marknad: rader }).marknad, K1.marknad, "appen får objekt");
  });
  it("raden matchar reglernas uttryck för varje lottad marknad (namn, id, nr, stjärnor)", () => {
    const RAD = /^k[0-9a-z]{1,6}[|][^|/<>&"]{1,40}[|](MV|FÖR|MIT|ANF)[|][0-9]{1,2}[|][1-5]$/;
    for (let i = 0; i < 200; i++) {
      const K = { ...K1, div: i % 8 };
      for (const r of T.marknadTillDok(T.nyMarknad(K, rng(`m${i}`)))) assert.match(r, RAD);
    }
  });
});

describe("lagbonusen används (§8.1)", () => {
  it("en tränad lagdel ger högre chans: anfallet skotten, målvakten räddningarna", () => {
    const tranad = K0.trupp.map((p) => ({ ...p, st: 4 }));
    const [start, b] = [lagbonus(K0.trupp), lagbonus(tranad)];
    // #883: startlaget är 1★ – en lagdel under 2★ (LAGBONUS.bas) ger −5 %.
    for (const d of C.LAGDELAR) assert.ok(Math.abs(start[d] + 0.05) < 1e-9, d);
    assert.deepEqual(lagbonus(K0.trupp.map((p) => ({ ...p, st: 2 }))), { MV: 0, "FÖR": 0, MIT: 0, ANF: 0 });
    assert.ok(Math.abs(b.ANF - 0.1) < 1e-9);
    assert.ok(chansSkott(12, true, b, 0.5) > chansSkott(12, true, start, 0.5));
    assert.ok(chansRaddning(true, b, 0.5) > chansRaddning(true, start, 0.5));
  });
});

describe("Truppens kort: allt ur dokumentet escapas eller blir tal", () => {
  const ond = { id: `x"><b>`, namn: XSS, pos: XSS, nr: "7<script>", st: "5<img>", xp: "40<i>", grundpelare: true, kapten: true };
  it("startelvan, reserverna och marknaden", () => {
    const K = { ...med([ond]), reserver: [{ ...ond, pos: "ANF" }] };
    for (const html of [startKort(ond), reservKort(K, K.reserver[0]), marknadKort(K, ond), lagdelarHtml([ond]), traningsStapel(ond)]) {
      assert.ok(!html.includes("<img src=x"), html);
      assert.ok(!html.includes("<script"), html);
      assert.ok(!html.includes(`"><b>`), html);
    }
    assert.match(startKort({ ...ond, st: 3, xp: 143 }), /143 \/ 250 till ★★★★</);
    assert.match(startKort({ ...ond, st: 3, xp: 143 }), /aria-valuemax="250" aria-valuenow="143"><i style="width:57%">/);
    assert.match(startKort({ ...ond, st: 1, xp: 30 }), /30 \/ 50 till ★★</);
    assert.match(startKort({ ...ond, st: 4, xp: 9999 }), /499 \/ 500 till ★★★★★</, "taket: aldrig över poängen till nästa stjärna");
    assert.match(startKort({ ...ond, st: 9 }), /Fullt tränad/);
    assert.match(startKort(ond), /Nr 0/);
    assert.equal(firaText({ namn: XSS }), "&lt;img src=x onerror=alert(1)&gt; fick en stjärna till!");
  });
  it("marknadskortet: köpknappen med priset och vem som ersätts – annars varför det inte går", () => {
    const K = med([salu(), salu({ id: "kb", st: 1 })]);
    assert.match(marknadKort(K, K.marknad[0]), /data-kop="kny">Köp för 1\s210 kr<\/button>[\s\S]*grundpelaren går till reserverna/);
    assert.match(marknadKort(K, K.marknad[1]), /disabled>[\s\S]*Inte bättre än/);
  });
  it("lägrets texter", () => {
    assert.match(lagerStangtText(K0), /första matchen/);
    assert.match(lagerStangtText({ ...K1, lager: "1-1-3" }), /alla 3 träningsläger/);
    assert.match(stangtHtml({ ...K1, lager: "1-1-3" }), /<button type="button" class="md-stor" disabled>Starta träningen<\/button>/, "det fjärde: avstängd knapp");
    assert.ok(!stangtHtml(K0).includes("<button"), "före första matchen: ingen knapp");
  });
});

describe("en klubb vars första sparning aldrig gick fram skapas först från noll (md-data.js)", () => {
  it("forstaDokument: nollad summa, högst startkassan, inga reserver, ingen marknad, inget läger", () => {
    const F = forstaDokument({ ...K1, lager: "1-1" });
    assert.deepEqual(F.summa, K0.summa);
    assert.ok(F.kassa <= C.KASSA.start);
    assert.deepEqual([F.reserver, F.marknad, F.lager, F.kval], [[], [], undefined, null]);
    assert.deepEqual(F.trupp, K1.trupp);
    assert.deepEqual(F.klubb, K1.klubb);
  });
});

describe("kön ovanpå serverns trupp – en kö som ändrats någon annanstans låser inte sparningen (md-spara.js, granskningen)", () => {
  const lagring = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  it("köns pengar: matchernas pengar + uppflyttningen efter ett vunnet kval (också på straffar)", () => {
    const koe = [{ match: { oss: 2, dem: 1, ratt: 20, div: 0 } }, { match: { typ: "kval", oss: 1, dem: 1, straffar: [4, 3], ratt: 18, div: 0 } }];
    assert.equal(konsPengar(koe), pengarFor({ oss: 2, dem: 1 }, 20, 0) + pengarFor({ oss: 1, dem: 1 }, 18, 0) + C.KASSA.uppflyttning);
    assert.equal(konsPengar([{ match: { typ: "kval", oss: 0, dem: 1, ratt: 5, div: 2 } }]), pengarFor({ oss: 0, dem: 1 }, 5, 2));
  });
  it("ovanpaServern: serverns trupp, reserver och läger; kassan högst serverns + köns pengar; köpta tas ur marknaden", () => {
    const G = T.kop(med([salu()]), "kny").K;
    const L = { ...med([salu(), salu({ id: "kb" })]), summa: { ...K1.summa, matcher: K1.summa.matcher + 1 }, kassa: 9000 };
    const koe = [{ match: { oss: 1, dem: 0, ratt: 10, div: 0 } }];
    const U = ovanpaServern(L, { ...G, lager: "1-1" }, koe);
    assert.deepEqual([U.trupp, U.reserver, U.lager], [G.trupp, G.reserver, "1-1"]);
    assert.equal(U.kassa, G.kassa + konsPengar(koe));
    assert.deepEqual(U.marknad.map((p) => p.id), ["kb"]);
    assert.equal(U.summa.matcher, L.summa.matcher, "matcherna är den lokala karriärens");
    assert.equal(ovanpaServern({ ...L, kassa: 10 }, G, koe).kassa, 10, "aldrig mer än den lokala");
  });
  it("en nekad kö läser serverns karriär EN gång, sparas ovanpå den och S.K följer med", async () => {
    // Servern: truppen ändrades på en annan dator (ett köp). Reglerna (förenklat): truppen måste vara serverns.
    const G = T.kop(med([salu()]), "kny").K;
    const srv = { K: G, matcher: [], las: 0 };
    const data = {
      lasKarriar: async () => { srv.las++; return srv.K; },
      sparaMatch: async (uid, K2, id) => {
        if (JSON.stringify(K2.trupp) !== JSON.stringify(srv.K.trupp)) throw Object.assign(new Error("nej"), { code: "permission-denied" });
        srv.K = K2; srv.matcher.push(id);
      },
    };
    const S = { uid: "u", lagring: lagring(), data, K: null };
    const lokal = { ...matchKlar(K1, { res: res(3, 0), rng: rng("q"), nu: NU, matchId: "q1" }).K };
    S.K = lokal;
    laggIKo(S.lagring, "u", { K: lokal, matchId: "q1", match: { oss: 3, dem: 0, ratt: 20, div: 0 } });
    assert.equal(await sparaKon(S, lokal), true);
    assert.deepEqual(srv.matcher, ["q1"]);
    assert.equal(srv.las, 1);
    assert.deepEqual(S.K.trupp, G.trupp);
    assert.equal(S.K.summa.matcher, lokal.summa.matcher);
    assert.equal(lasOsparad(S.lagring, "u"), null);
  });
  it("nekas den också ovanpå servern ligger kön kvar (ingen evig slinga)", async () => {
    const data = { lasKarriar: async () => K1, sparaMatch: async () => { throw Object.assign(new Error("nej"), { code: "permission-denied" }); } };
    const S = { uid: "u", lagring: lagring(), data, K: K1 };
    laggIKo(S.lagring, "u", { K: K1, matchId: "z", match: {} });
    assert.equal(await sparaKon(S), false);
    assert.equal(lasOsparad(S.lagring, "u").koe.length, 1);
  });
});
