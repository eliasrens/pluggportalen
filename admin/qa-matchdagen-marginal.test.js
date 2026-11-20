// Matchdagen (#872, #873): mäter marginalen mot 1000-uttrycksgränsen – hur många "(d.div == d.div) &&" (≈ en enhet)
// som får plats i validMatchdagen för olika skrivningar. Kör: MDTEST=admin/qa-matchdagen-marginal.test.js bash admin/qa-matchdagen-marginal.sh
// #874: INB=1 – dokumentet har inbördes möten (servern skrev dem efter en vänskapsmatch) före och efter skrivningen.
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { matchKlar, nyKarriar, nastaMatch, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { bytIn, kop, lagerNyckel, lagerResultat, lagerStart, marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
const tillDok = (D) => Object.fromEntries(Object.entries({ ...D, marknad: marknadTillDok(D.marknad || []), pokaler: pokalerTillDok(D.pokaler || []) }).filter(([, v]) => v !== undefined));
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { nyLiga, nySasong } from "../src/matchdagen/delat/md-sasong.js";
import { mcKlar, mcMatch } from "../src/matchdagen/delat/md-mastarcup.js";
import { nyLegendklubb } from "../src/matchdagen/delat/md-legend.js";
const kopia = (v) => JSON.parse(JSON.stringify(v));
const NU = Date.UTC(2026, 10, 20, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 }, "omrade:a/b": { fragor: 2, ratt: 1 } }, sekunder: 420 };
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT, ...x });
const r = skapaPrng(process.env.FRO || "mät").tal;
const K0 = kopia(nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r }));
const K1 = { ...kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K), kassa: 5000 };
const TRE = K1.marknad.find((p) => p.st === 3) || (K1.marknad[0] = { ...K1.marknad[0], st: 3 });
const LAGER = kopia(lagerResultat(K1, { nyckel: lagerNyckel(K1), spelareId: K1.trupp[3].id, svar: Array(8).fill({ ratt: true }), nu: NU }).K);
const g = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 2, xp: 0, grundpelare: true, kapten: false });
const FULL = { ...kopia(K1), reserver: [g(11, "FÖR"), g(12, "MIT"), g(13, "MIT"), g(14, "ANF"), { id: "kr1", namn: "Köpt Reserv", pos: "ANF", nr: 77, st: 5, xp: 0 }],
  marknad: [...K1.marknad.slice(0, 5), { id: "kfor3", namn: "Test Försvar", pos: "FÖR", nr: 40, st: 3, xp: 0 }] };
// Hela säsongen med cupen (vunnen, 4–0 i varje match: rekord, pokaler) – sedan kvalet.
let V = kopia(K1);
let FORE_FINAL = null;
let EFTER_FINAL = null;
for (let i = 1; nastaMatch(V); i++) {
  if (cupMatch(V, "e4a")) {
    const fore = V;
    V = cupKlar(V, { res: res(4, 0, { mal: [{ min: 3, lag: "oss" }] }), rng: r, nu: NU, matchId: `c${i}`, uid: "e4a" }).K;
    if (V.cup.endsWith("-4")) { FORE_FINAL = fore; EFTER_FINAL = V; }
  } else V = matchKlar(V, { res: res(4 + (i % 2), 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const K1C = cupKlar(K1, { res: res(2, 1), rng: r, nu: NU, matchId: "c1", uid: "e4a" }).K;
const KV = kopia(kvalKlar(V, { res: res(1, 1, { straffar: [16, 15], vann: true }), nu: NU, matchId: "kv", rng: r }).K);
const salu = { id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st: 3, xp: 0 };
const GA = { ...kopia(K1), div: 0, marknad: [salu] };
const NA = { ...kopia(GA), marknad: [], kassa: GA.kassa - 3190, trupp: GA.trupp.map((p, j) => (j === 5 ? salu : p)) };
// #873: Superligans mästare, Mästarcupen, finalen och legendklubben (första och 49:e).
let S = { ...kopia(K0), div: TOPP_DIV, sasong: 12, liga: nyLiga(TOPP_DIV, K0.klubb.farg, r) };
let FORE_MASTARE = null;
for (let i = 0; nastaMatch(S); i++) {
  if (cupMatch(S, "e4a")) { S = cupKlar(S, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: "e4a", rng: r }).K; continue; }
  FORE_MASTARE = S;
  S = matchKlar(S, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const MASTARE = kopia(S);
let W = kopia(nySasong(MASTARE, r));
let MC_FORE = null, MC_EFTER = null, MCF_FORE = null;
for (let i = 0; i < 60 && !MCF_FORE; i++) {
  const mc = mcMatch(W, "e4a");
  if (mc?.final) { MCF_FORE = W; break; }
  if (cupMatch(W, "e4a")) W = cupKlar(W, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: "e4a", rng: r }).K;
  else if (mc) { const e = mcKlar(W, { res: res(2, 1), nu: NU, matchId: `mc${i}`, uid: "e4a", rng: r }).K; if (!MC_FORE) { MC_FORE = W; MC_EFTER = e; } W = e; }
  else W = matchKlar(W, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const MCF_EFTER = kopia(mcKlar(MCF_FORE, { res: res(1, 1, { straffar: [5, 4], vann: true }), nu: NU, matchId: "f", uid: "e4a", rng: r }).K);
const HIST48 = Array.from({ length: 48 }, (_, i) => `Gamla Klubben ${i}|#e8473f|${i + 1}-${i + 1}|1.1.1.1.1`);
const VUNNEN48 = { ...MCF_EFTER, klubb: { ...MCF_EFTER.klubb, legendStjarnor: 48 }, klubbhistorik: HIST48 };
const SCEN0 = {
  mastare: [FORE_MASTARE, MASTARE],
  mc: [MC_FORE, MC_EFTER],
  mcFinal: [MCF_FORE, MCF_EFTER],
  legend: [MCF_EFTER, nyLegendklubb(MCF_EFTER, { namn: "Norrsken FF", farg: "#2ecc71", rng: r })],
  legend49: [VUNNEN48, nyLegendklubb(VUNNEN48, { namn: "Norrsken FF", farg: "#2ecc71", rng: r })],
  skapa: [null, K0],
  match: [K0, matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K],
  lager: [K1, LAGER],
  kop: [K1, kop(K1, TRE.id).K],
  kopFull: [FULL, kop(FULL, "kfor3", { slapp: "kr1" }).K],
  sistaOmg: [K1, V],
  kval: [V, KV],
  sasongKval: [K0, KV],
  cup: [K1, K1C],
  cupFinal: [FORE_FINAL, EFTER_FINAL],
  lagerMatch: [K1, matchKlar(LAGER, { res: res(3, 0), rng: r, nu: NU, matchId: "m2" }).K],
  lagerStart: [K1, lagerStart(K1)],
  byt: [kop(K1, TRE.id).K, bytIn(kop(K1, TRE.id).K, kop(K1, TRE.id).K.reserver[0].id, TRE.id)],
};
const SCEN = process.env.SCEN ? Object.fromEntries(process.env.SCEN.split(",").map((k) => [k, k === "kopAv" ? [GA, NA] : SCEN0[k]])) : SCEN0;
const BAS0 = readFileSync(process.env.RULES_FIL || new URL("../firestore.rules", import.meta.url), "utf8");
const VARIANTER = process.env.VAR ? JSON.parse(readFileSync(process.env.VAR, "utf8")) : { bas: [] };
const ANKARE = "d.senast == request.time &&";
const INB = process.env.INB ? { inbordes: { kompis: { v: 1, o: 2, f: 0, namn: "FC Omar" } } } : {};
let n = 0;
it("marginal", async () => {
 for (const [vnamn, subs] of Object.entries(VARIANTER)) {
  let BAS = BAS0;
  for (const [a, b] of subs) { if (!BAS.includes(a)) throw new Error("saknas: " + a); BAS = BAS.replace(a, b); }
  console.log("VARIANT", vnamn);
  for (const [namn, [fore, efter]] of Object.entries(SCEN)) {
    let senast = -1;
    for (const N of (process.env.NLIST || "0,2,4,6,8,10,12,15,18,22,26,30,35,40,50,60").split(",").map(Number)) {
      const rules = BAS.replace(ANKARE, ANKARE + " " + "(d.div == d.div) && ".repeat(N));
      const env = await initializeTestEnvironment({ projectId: `pp-mat-${n++}`, firestore: { rules } });
      if (fore) await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "matchdagen", "e4a"), tillDok({ ...kopia(fore), ...INB, senast: new Date() })));
      let ok = true;
      try { await setDoc(doc(env.authenticatedContext("e4a", {}).firestore(), "matchdagen", "e4a"), tillDok({ ...kopia(efter), ...(fore ? INB : {}), senast: serverTimestamp() })); }
      catch (e) { ok = false; if (N === 0) console.log("NEKAD", namn, String(e.message).slice(20, 140).replace(/\n/g, " ")); }
      await env.cleanup().catch(() => {});
      if (!ok) break;
      senast = N;
    }
    console.log("MARGINAL", vnamn, namn, senast);
  }
 }
});
