// ============================================================================
// Regel-tester: Matchdagen 3 (#873) – Superligans mästare, Mästarcupen (mastarcup),
// legendklubben (klubbhistorik, klubb.legendStjarnor) och de nya pokaltyperna i matchdagen/{uid}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §10, §15 (Regler):
//   • mastarcup är null eller texten "säsong-rundor(-u)" (md-mastarcup.js MC_MONSTER)
//   • pokalerna får typerna superliga och mastarcup
//   • en legendklubb startar bara när Mästarcupen är vunnen DEN HÄR säsongen: historiken växer med
//     exakt en rad (högst 50), Division 6, nästa säsong, startkassan 600 kr, inga reserver, ingen marknad,
//     sju nya grundpelare och exakt en guldstjärna till
//   • guldstjärnorna ändras aldrig utan en legendklubb; historiken kan inte strykas
//   • läraren rör bara lagnamnet
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-cup.js, md-mastarcup.js, md-legend.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { mcKlar, mcMatch } from "../src/matchdagen/delat/md-mastarcup.js";
import { nyLegendklubb } from "../src/matchdagen/delat/md-legend.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const UID = "e4a";
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [{ min: 4, lag: "oss" }], stat: STAT, ...x });
const kopia = (v) => JSON.parse(JSON.stringify(v));
const r = skapaPrng("regler-873").tal;

// Säsong 12 i Superligan: spela den sista ligamatchen som mästare (pokalen + inbjudan).
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#2f6fe8", rng: r });
let V = { ...K0, div: TOPP_DIV, sasong: 12, liga: nyLiga(TOPP_DIV, K0.klubb.farg, r) };
let MASTARE = null;
let FORE_MASTARE = null;
for (let i = 0; i < 40 && nastaMatch(V); i++) {
  if (cupMatch(V, UID)) { V = cupKlar(V, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K; continue; }
  FORE_MASTARE = V;
  MASTARE = matchKlar(V, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` });
  V = MASTARE.K;
}
// Säsong 13 med inbjudan: kvartsfinalen, och fram till finalen som vinns.
const INBJUDEN = kopia(nySasong(MASTARE.K, r));
let W = INBJUDEN;
let MC1 = null;
let FORE_FINAL = null;
for (let i = 0; i < 60 && !FORE_FINAL; i++) {
  const mc = mcMatch(W, UID);
  if (mc?.final) { FORE_FINAL = W; break; }
  if (cupMatch(W, UID)) W = cupKlar(W, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K;
  else if (mc) {
    const ut = mcKlar(W, { res: res(2, 1), nu: NU, matchId: `mc${i}`, uid: UID, rng: r });
    if (!MC1) MC1 = { fore: W, ...ut };
    W = ut.K;
  } else W = matchKlar(W, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const FINAL = mcKlar(FORE_FINAL, { res: res(1, 1, { straffar: [5, 4], vann: true }), nu: NU, matchId: "final", uid: UID, rng: r });
const VUNNEN = kopia(FINAL.K);
const LEGEND = nyLegendklubb(VUNNEN, { namn: "Norrsken FF", farg: "#2ecc71", rng: r });

const ref = (db, uid = UID) => doc(db, "matchdagen", uid);
const mref = (db, id) => doc(db, "matchdagen", UID, "matcher", id);
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K, over = {}) => tillDok({ ...kopia(K), senast: serverTimestamp(), ...over });
const seed = (K, over = {}) => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K)), senast: new Date(), ...over }));
const elev = () => env.as(UID, {});
const legend = (over = {}) => setDoc(ref(elev()), medTid(LEGEND, over));
const rad = (n) => `Gamla ${n}|#e8473f|${n}-${n}|1.0.0.0.0`;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-873");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: [UID, "kompis"], elevModuler: { [UID]: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – Superligans mästare och Mästarcupen (#873)", () => {
  it("mästare i Superligan: pokalen 'superliga' och inbjudan sparas; matchdokumentet är en ligamatch", async () => {
    assert.equal(MASTARE.mastare, true);
    assert.equal(MASTARE.K.mastarcup, "13-0");
    assert.ok(MASTARE.K.pokaler.some((p) => p.typ === "superliga"));
    await seed(FORE_MASTARE);
    await assertSucceeds(setDoc(ref(elev()), medTid(MASTARE.K)));
    await assertSucceeds(setDoc(mref(elev(), "s12-d7-o11-x"), { ...MASTARE.match, datum: serverTimestamp() }));
  });
  it("en match i Mästarcupen och finalen med pokalen sparas; matchdokumentet har typ mastarcup", async () => {
    assert.equal(MC1.K.mastarcup, "13-1");
    assert.equal(MC1.match.typ, "mastarcup");
    await seed(MC1.fore);
    await assertSucceeds(setDoc(ref(elev()), medTid(MC1.K)));
    await assertSucceeds(setDoc(mref(elev(), "s13-mc1-x"), { ...MC1.match, datum: serverTimestamp() }));
    assert.ok(FINAL.vannCupen);
    assert.equal(FINAL.K.mastarcup, "13-3");
    await seed(FORE_FINAL);
    await assertSucceeds(setDoc(ref(elev()), medTid(FINAL.K)));
    await assertSucceeds(setDoc(mref(elev(), "s13-mc3-x"), { ...FINAL.match, datum: serverTimestamp() }));
  });
  it("mastarcup: null eller 'säsong-rundor(-u)' – ingen map, inget tal, ingen HTML, inga fler rundor", async () => {
    await seed(MC1.fore);
    for (const mastarcup of [{ runda: 1 }, 13, "13-4", "13-0-u", "13-1-v", "<img src=x>", "13-1 ", "123456-1", "x".repeat(2000), ["13-1"], ""]) {
      await assertFails(setDoc(ref(elev()), medTid(MC1.K, { mastarcup })), JSON.stringify(mastarcup).slice(0, 30));
    }
    for (const mastarcup of ["13-0", "13-2-u", "12345-3", null]) await assertSucceeds(setDoc(ref(elev()), medTid(MC1.K, { mastarcup })), String(mastarcup));
  });
  it("pokalerna: typerna superliga och mastarcup går igenom, en okänd typ nekas", async () => {
    await seed(MC1.fore);
    const rader = pokalerTillDok(MC1.K.pokaler);
    const prova = (pokaler) => setDoc(ref(elev()), { ...medTid(MC1.K), pokaler });
    await assertSucceeds(prova([...rader, "superliga|Mästare i Superligan|13|2026-11-20", "mastarcup|Mästarcupen|13|2026-11-20"]));
    await assertFails(prova([...rader, "legend|Mästarcupen|13|2026-11-20"]), "okänd typ");
    await assertFails(prova([...rader, "mastarcup|<b>|13|2026-11-20"]), "HTML");
  });
});

describe("matchdagen/{uid} – legendklubben (#873, §10.3)", () => {
  it("efter vunnen final: den nya klubben sparas i EN skrivning (historik +1, stjärna +1, Division 6)", async () => {
    assert.equal(LEGEND.div, 0);
    assert.equal(LEGEND.sasong, 14);
    assert.equal(LEGEND.klubb.legendStjarnor, 1);
    assert.equal(LEGEND.klubbhistorik.length, 1);
    await seed(VUNNEN);
    await assertSucceeds(legend());
  });
  it("en andra legendklubb (historik 1 → 2, stjärnor 1 → 2) går igenom", async () => {
    const forra = rad(1);
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 1 }, klubbhistorik: [forra] });
    const L2 = nyLegendklubb({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 1 }, klubbhistorik: [forra] }, { namn: "Tvåan IF", farg: "#e8473f", rng: r });
    assert.deepEqual(L2.klubbhistorik.slice(0, 1), [forra]);
    await assertSucceeds(setDoc(ref(elev()), medTid(L2)));
  });
  it("utan Mästarcupen DEN HÄR säsongen nekas legendklubben", async () => {
    const utan = VUNNEN.pokaler.filter((p) => p.typ !== "mastarcup");
    await seed({ ...VUNNEN, pokaler: utan });
    await assertFails(legend({ pokaler: pokalerTillDok(utan) }), "ingen mastarcup-pokal");
    const forraAret = [...utan, { typ: "mastarcup", namn: "Mästarcupen", sasong: 12, datum: "2026-11-01" }];
    await seed({ ...VUNNEN, pokaler: forraAret });
    await assertFails(legend({ pokaler: pokalerTillDok(forraAret) }), "pokalen är från en annan säsong");
    const fel = [...utan, { typ: "mastarcup", namn: "Mästarcupen", sasong: 130, datum: "2026-11-01" }];
    await seed({ ...VUNNEN, pokaler: fel });
    await assertFails(legend({ pokaler: pokalerTillDok(fel) }), "säsong 130 ≠ 13");
  });
  it("guldstjärnorna: exakt +1 – inte 0, inte +2, inte utan stjärnfältet satt rätt", async () => {
    await seed(VUNNEN);
    await assertFails(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: 2 } }), "+2");
    await assertFails(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: 0 } }), "+0");
    await assertFails(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: 1.5 } }), "1,5");
  });
  it("den nya klubben börjar om: Division 6, nästa säsong, 600 kr, inga reserver, ingen marknad, nya grundpelare", async () => {
    await seed(VUNNEN);
    await assertFails(legend({ div: 1 }), "div 1");
    await assertFails(legend({ sasong: 13 }), "samma säsong");
    await assertFails(legend({ sasong: 15 }), "hoppar en säsong");
    await assertFails(legend({ kassa: 601 }), "kassa 601");
    await assertFails(legend({ kassa: VUNNEN.kassa }), "behåller kassan");
    await assertFails(legend({ reserver: kopia(VUNNEN.trupp).slice(0, 1) }), "reserver kvar");
    assert.ok(VUNNEN.marknad.length > 0);
    await assertFails(legend({ marknad: marknadTillDok(VUNNEN.marknad) }), "marknaden kvar");
    // den gamla truppen är tränad (stjärnor, träningspoäng) – en ny har 2 stjärnor och 0 poäng
    const tranad = kopia(LEGEND.trupp).map((p, i) => (i === 0 ? { ...p, st: 4, xp: 3 } : p));
    await assertFails(legend({ trupp: tranad }), "en tränad trupp");
    await assertFails(legend({ trupp: kopia(LEGEND.trupp).slice(0, 6) }), "sex spelare");
    await assertFails(legend({ trupp: kopia(VUNNEN.trupp) }), "den gamla truppen oförändrad (granskningen: trupp utanför a)");
    await assertFails(legend({ kassa: 0 }), "kassan är exakt startkassan (en likhet – billigast)");
    await assertFails(legend({ kassa: "600" }), "kassan som text");
  });
  it("klubbhistoriken: exakt en ny rad i rätt form, de gamla raderna orörda, högst 50", async () => {
    await seed(VUNNEN);
    const ny = LEGEND.klubbhistorik[0];
    await assertFails(legend({ klubbhistorik: [ny, rad(2)] }), "två rader");
    await assertFails(legend({ klubbhistorik: [] }), "ingen rad");
    await assertFails(legend({ klubbhistorik: ["<img src=x onerror=alert(1)>|#2f6fe8|1-13|0.0.0.1.1"] }), "HTML i namnet");
    await assertFails(legend({ klubbhistorik: [`${"x".repeat(25)}|#2f6fe8|1-13|0.0.0.1.1`] }), "25 tecken");
    await assertFails(legend({ klubbhistorik: ["Blixtarna IF|blå|1-13|0.0.0.1.1"] }), "färgen");
    await assertFails(legend({ klubbhistorik: ["Blixtarna IF|#2f6fe8|1-13|0.0.1"] }), "tre tal");
    await assertFails(legend({ klubbhistorik: [{ namn: "Blixtarna IF" }] }), "objekt");
    await assertFails(legend({ klubbhistorik: ny }), "text i stället för lista");
    const gamla = Array.from({ length: 2 }, (_, i) => rad(i + 1));
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 2 }, klubbhistorik: gamla });
    const st3 = { ...LEGEND.klubb, legendStjarnor: 3 };
    await assertFails(legend({ klubb: st3, klubbhistorik: [rad(9), gamla[1], ny] }), "en gammal rad ändrad");
    await assertFails(legend({ klubb: st3, klubbhistorik: [gamla[1], gamla[0], ny] }), "ordningen ändrad");
    await assertFails(legend({ klubb: st3, klubbhistorik: [ny, ...gamla] }), "den nya raden först");
    await assertSucceeds(legend({ klubb: st3, klubbhistorik: [...gamla, ny] }), "två gamla + en ny");
    const femtio = Array.from({ length: 50 }, (_, i) => rad(i + 1));
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 50 }, klubbhistorik: femtio });
    await assertFails(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: 51 }, klubbhistorik: [...femtio, ny] }), "51 rader");
    const fyrtioatta = Array.from({ length: 48 }, (_, i) => rad(i + 1));
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 48 }, klubbhistorik: fyrtioatta });
    await assertSucceeds(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: 49 }, klubbhistorik: [...fyrtioatta, ny] }), "49 rader");
  });
  it("guldstjärnorna ändras inte utan en legendklubb, och historiken kan inte strykas eller skrivas om", async () => {
    await seed(MC1.fore);
    await assertFails(setDoc(ref(elev()), medTid(MC1.K, { klubb: { ...MC1.K.klubb, legendStjarnor: 1 } })), "+1 i en vanlig match");
    await seed({ ...MC1.fore, klubb: { ...MC1.fore.klubb, legendStjarnor: 2 }, klubbhistorik: [rad(1), rad(2)] });
    const vanlig = { ...MC1.K, klubb: { ...MC1.K.klubb, legendStjarnor: 2 }, klubbhistorik: [rad(1), rad(2)] };
    await assertSucceeds(setDoc(ref(elev()), medTid(vanlig)), "en vanlig match med historiken orörd");
    await assertFails(setDoc(ref(elev()), medTid({ ...vanlig, klubb: { ...vanlig.klubb, legendStjarnor: 0 } })), "stjärnorna nollställda");
    await assertFails(setDoc(ref(elev()), medTid({ ...vanlig, klubbhistorik: [rad(1)] })), "en rad struken");
    const { klubbhistorik, ...utan } = vanlig;
    void klubbhistorik;
    await assertFails(setDoc(ref(elev()), medTid(utan)), "historiken struken");
    await assertFails(updateDoc(ref(elev()), { klubbhistorik: deleteField(), senast: serverTimestamp() }), "deleteField");
  });
  it("en ny karriär (create) börjar utan guldstjärnor och utan historik", async () => {
    await assertFails(setDoc(ref(elev()), medTid({ ...K0, klubb: { ...K0.klubb, legendStjarnor: 1 } })), "stjärna från start");
    await assertFails(setDoc(ref(elev()), medTid({ ...K0, klubbhistorik: [rad(1)] })), "historik från start");
    await assertSucceeds(setDoc(ref(elev()), medTid({ ...K0, klubb: { ...K0.klubb, legendStjarnor: 0 } })), "0 stjärnor");
  });
  it("läraren kan inte röra Mästarcupen, historiken eller stjärnorna – bara lagnamnet", async () => {
    await seed({ ...VUNNEN, klubbhistorik: [rad(1)] });
    const larare = env.ak4();
    await assertFails(updateDoc(ref(larare), { mastarcup: "13-0" }));
    await assertFails(updateDoc(ref(larare), { klubbhistorik: [] }));
    await assertFails(updateDoc(ref(larare), { "klubb.legendStjarnor": 3 }));
    await assertSucceeds(updateDoc(ref(larare), { "klubb.namn": "Pluggporten FC" }));
  });
});
