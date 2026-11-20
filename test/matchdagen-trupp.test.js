// ============================================================================
// Matchdagen 2b (#871): truppen, reserverna, marknaden och träningslägret – den rena
// modulen md-trupp.js (spec §8, §15 Motorn: "marknaden, priserna och reserverna
// (grundpelarna säljs aldrig), träningslägret (100 poäng ger en stjärna, taket 5),
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
import { laggIKo, lasLager, lasOsparad, rensaLager, sparaLager } from "../src/matchdagen/md-lokal.js";
import { konsPengar, ovanpaServern, sparaKon } from "../src/matchdagen/md-spara.js";
import { pengarFor } from "../src/matchdagen/delat/md-sasong.js";
import { lagdelarHtml, marknadKort, reservKort, startKort, traningsStapel } from "../src/matchdagen/vy/md-vy-marknad.js";
import { firaText, lagerStangtText } from "../src/matchdagen/vy/md-vy-lager.js";

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
  it("stjärnorna kl(avrunda(slump(2; 3,2 + div × 0,3)); 2; 5) – högre upp i stegen, bättre spelare", () => {
    for (let div = 0; div < C.DIVISIONER.length; div++) {
      const r = rng(`st${div}`);
      const st = Array.from({ length: 400 }, () => T.marknadStjarnor(div, r));
      assert.ok(st.every((s) => s >= 2 && s <= T.marknadMaxSt(div)), `div ${div}`);
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
    assert.equal(T.kopInfo(med([salu({ st: 2 })]), "kny").orsak, "inteBattre");
    assert.equal(T.kopInfo(med([salu()], { kassa: 1209 }), "kny").orsak, "kassa");
    assert.equal(T.kopInfo(med([salu()], { kassa: 1210 }), "kny").kan, true);
    assert.equal(T.kopInfo(med([]), "kny").orsak, "saknas");
    assert.throws(() => T.kop(med([salu({ st: 2 })]), "kny"), /inteBattre/);
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
    assert.equal(T.truppFalt(K1), K1);
  });
});

describe("träningslägret (§8.4)", () => {
  it("12 poäng per rätt, vid 100 en stjärna till (resten följer med), fel ger inget, taket 5★", () => {
    const p = { ...K0.trupp[1], st: 2, xp: 0 };
    assert.deepEqual(T.tranaSpelare(p, false), { p, nyStjarna: false });
    assert.equal(T.tranaSpelare(p, true).p.xp, 12);
    const r = T.tranaSpelare({ ...p, xp: 96 }, true);
    assert.deepEqual([r.p.st, r.p.xp, r.nyStjarna], [3, 8, true]);
    const fem = T.tranaSpelare({ ...p, st: 4, xp: 90 }, true);
    assert.deepEqual([fem.p.st, fem.p.xp], [5, 0], "vid 5★ nollas poängen");
    assert.equal(T.tranaSpelare(fem.p, true).p.xp, 0);
  });
  it("ett läger per spelad omgång och ett extra före kvalet; inget före första matchen", () => {
    assert.equal(T.lagerNyckel(K0), null);
    assert.equal(T.lagerNyckel(K1), "1-1");
    assert.equal(T.lagerNyckel({ ...K1, lager: "1-1" }), null);
    let V = K1;
    for (let i = 0; nastaMatch(V); i++) V = matchKlar(V, { res: res(4, 0), rng: rng(`l${i}`), nu: NU, matchId: `l${i}` }).K;
    const sista = `1-${V.liga.omg}`;
    assert.equal(T.lagerNyckel(V), sista);
    assert.equal(T.lagerNyckel({ ...V, lager: sista }), "1-k", "kvalet väntar – ett extra läger");
    assert.equal(T.lagerNyckel({ ...V, lager: "1-k" }), null);
  });
  it("8 rätt: +96 poäng, frågorna räknas som källan 'träning' i statistiken och dagarna", () => {
    const id = K1.trupp[3].id;
    const ut = T.lagerResultat(K1, { nyckel: "1-1", spelareId: id, svar: Array(8).fill({ ratt: true }), sekunder: 95, nu: NU });
    assert.equal(ut.K.lager, "1-1");
    assert.deepEqual([ut.spelare.st, ut.spelare.xp, ut.stjarnor], [2, 96, 0]);
    assert.equal(ut.K.summa.fragor, K1.summa.fragor + 8);
    assert.equal(ut.K.summa.ratt, K1.summa.ratt + 8);
    assert.deepEqual(ut.K.summa.perKalla.traning, { fragor: 8, ratt: 8, namn: "Träning" });
    assert.equal(ut.K.summa.matcher, K1.summa.matcher, "lägret är ingen match");
    assert.equal(Object.values(ut.K.dagar).reduce((s, d) => s + d.fragor, 0), Object.values(K1.dagar).reduce((s, d) => s + d.fragor, 0) + 8);
    assert.equal(K1.lager, undefined, "K ändras inte");
  });
  it("100 poäng ger en stjärna – två läger med 96+12 → 3★", () => {
    const id = K1.trupp[3].id;
    const a = T.lagerResultat(K1, { nyckel: "1-1", spelareId: id, svar: Array(8).fill({ ratt: true }), nu: NU }).K;
    const K2 = matchKlar(a, { res: res(1, 0), rng: rng("x"), nu: NU, matchId: "x" }).K;
    const b = T.lagerResultat(K2, { nyckel: "1-2", spelareId: id, svar: [{ ratt: true }, { ratt: false }], nu: NU });
    assert.deepEqual([b.spelare.st, b.spelare.xp, b.stjarnor], [3, 8, 1]);
  });
  it("inget ledigt läger, eller en spelare med 5★ → nekas", () => {
    const id = K1.trupp[3].id;
    assert.throws(() => T.lagerResultat(K0, { nyckel: "1-0", spelareId: id, svar: [], nu: NU }), /ledigt/);
    assert.throws(() => T.lagerResultat({ ...K1, lager: "1-1" }, { nyckel: "1-1", spelareId: id, svar: [], nu: NU }), /ledigt/);
    const fem = { ...kopia(K1) };
    fem.trupp[3].st = 5;
    assert.throws(() => T.lagerResultat(fem, { nyckel: "1-1", spelareId: id, svar: [], nu: NU }), /5 stjärnor/);
  });
  it("det pågående lägret sparas lokalt och fortsätter – bara för klubbens lediga läger och en spelare i startelvan", () => {
    const m = new Map();
    const L = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
    const id = K1.trupp[2].id;
    sparaLager(L, "u", { nyckel: "1-1", spelareId: id, svar: [{ ratt: true }, { ratt: "ja" }], sek: 12 });
    assert.deepEqual(lasLager(L, "u", K1), { v: 1, nyckel: "1-1", spelareId: id, svar: [{ ratt: true }, { ratt: false }], sek: 12 });
    assert.equal(lasLager(L, "annan", K1), null);
    assert.equal(lasLager(L, "u", { ...K1, lager: "1-1" }), null, "lägret är redan sparat");
    assert.equal(lasLager(L, "u", T.bytIn({ ...kopia(K1), reserver: [{ ...K1.trupp[2], id: "r" }] }, "r", id)), null, "spelaren är inte kvar");
    rensaLager(L, "u");
    assert.equal(lasLager(L, "u", K1), null);
  });
});

describe("lagbonusen används (§8.1)", () => {
  it("en tränad lagdel ger högre chans: anfallet skotten, målvakten räddningarna", () => {
    const tranad = K0.trupp.map((p) => ({ ...p, st: 4 }));
    const [start, b] = [lagbonus(K0.trupp), lagbonus(tranad)];
    assert.deepEqual(start, { MV: 0, "FÖR": 0, MIT: 0, ANF: 0 });
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
    assert.match(startKort({ ...ond, st: 3, xp: 40 }), /40\/100 träning/);
    assert.match(startKort({ ...ond, st: 9 }), /Fullt tränad/);
    assert.match(startKort(ond), /Nr 0/);
    assert.equal(firaText({ namn: XSS }), "&lt;img src=x onerror=alert(1)&gt; fick en stjärna till!");
  });
  it("marknadskortet: köpknappen med priset och vem som ersätts – annars varför det inte går", () => {
    const K = med([salu(), salu({ id: "kb", st: 2 })]);
    assert.match(marknadKort(K, K.marknad[0]), /data-kop="kny">Köp för 1\s210 kr<\/button>[\s\S]*grundpelaren går till reserverna/);
    assert.match(marknadKort(K, K.marknad[1]), /disabled>[\s\S]*Inte bättre än/);
  });
  it("lägrets texter", () => {
    assert.match(lagerStangtText(K0), /första matchen/);
    assert.match(lagerStangtText({ ...K1, lager: "1-1" }), /tränat den här omgången/);
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
