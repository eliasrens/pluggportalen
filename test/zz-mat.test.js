// Mäter marginalen mot 1000-uttrycksgränsen: hur många "(d.div == d.div) &&" (≈ en enhet)
// som får plats i validMatchdagen för olika skrivningar. RULES_FIL kan peka på en variant.
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { matchKlar, nyKarriar, nastaMatch } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { kop, lagerNyckel, lagerResultat } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
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
let V = kopia(K1);
for (let i = 1; nastaMatch(V); i++) V = matchKlar(V, { res: res(4, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
const KV = kopia(kvalKlar(V, { res: res(1, 1, { straffar: [16, 15], vann: true }), nu: NU, matchId: "kv", rng: r }).K);
const salu = { id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st: 3, xp: 0 };
const GA = { ...kopia(K1), div: 0, marknad: [salu] };
const NA = { ...kopia(GA), marknad: [], kassa: GA.kassa - 3190, trupp: GA.trupp.map((p, j) => (j === 5 ? salu : p)) };
const SCEN0 = {
  skapa: [null, K0],
  match: [K0, matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K],
  lager: [K1, LAGER],
  kop: [K1, kop(K1, TRE.id).K],
  kopFull: [FULL, kop(FULL, "kfor3", { slapp: "kr1" }).K],
  sistaOmg: [K1, V],
  kval: [V, KV],
  lagerMatch: [K1, matchKlar(LAGER, { res: res(3, 0), rng: r, nu: NU, matchId: "m2" }).K],
};
const SCEN = process.env.SCEN ? Object.fromEntries(process.env.SCEN.split(",").map((k) => [k, k === "kopAv" ? [GA, NA] : SCEN0[k]])) : SCEN0;
const BAS = readFileSync(process.env.RULES_FIL || new URL("../firestore.rules", import.meta.url), "utf8");
const ANKARE = "d.senast == request.time &&";
let n = 0;
it("marginal", async () => {
  for (const [namn, [fore, efter]] of Object.entries(SCEN)) {
    let senast = -1;
    for (const N of [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 35, 40, 50, 60]) {
      const rules = BAS.replace(ANKARE, ANKARE + " " + "(d.div == d.div) && ".repeat(N));
      const env = await initializeTestEnvironment({ projectId: `pp-mat-${n++}`, firestore: { rules } });
      if (fore) await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "matchdagen", "e4a"), { ...kopia(fore), senast: new Date() }));
      let ok = true;
      try { await setDoc(doc(env.authenticatedContext("e4a", {}).firestore(), "matchdagen", "e4a"), { ...kopia(efter), senast: serverTimestamp() }); }
      catch (e) { ok = false; if (N === 0) console.log("NEKAD", namn, String(e.message).slice(20, 140).replace(/\n/g, " ")); }
      await env.cleanup().catch(() => {});
      if (!ok) break;
      senast = N;
    }
    console.log("MARGINAL", namn, senast);
  }
});
