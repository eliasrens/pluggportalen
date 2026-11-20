// ============================================================================
// Regel-tester: Matchdagen 3 (#873) – Testerns attackprov på Mästarcupen, legendklubben
// (klubbhistorik, klubb.legendStjarnor) och de nya pokaltyperna. Elev som skriver FÖRBI
// appen (eget dokument), och äldre dokument (1c–2c) som ska fortsätta att sparas.
// Kända gränser (eget spel, inga pluggmynt) prövas med assertSucceeds och står i
// docs/QA-RAPPORT-matchdagen-etapp-3.md (Testern). Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong, nyTrupp, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
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
const r = skapaPrng("tester-873").tal;

// Superligan säsong 20 som mästare → säsong 21 med inbjudan → finalen vunnen → legendklubben.
const K0 = nyKarriar({ namn: "Testarna FK", farg: "#e8473f", rng: r });
let V = { ...K0, div: TOPP_DIV, sasong: 20, liga: nyLiga(TOPP_DIV, K0.klubb.farg, r) };
for (let i = 0; i < 40 && nastaMatch(V); i++) {
  if (cupMatch(V, UID)) V = cupKlar(V, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K;
  else V = matchKlar(V, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
let W = kopia(nySasong(V, r));
let MITT = null; // mitt i Mästarcupen (efter kvartsfinalen), ingen pokal än
let FINAL = null;
for (let i = 0; i < 60 && !FINAL; i++) {
  const mc = mcMatch(W, UID);
  if (mc?.final) { FINAL = mcKlar(W, { res: res(2, 2, { straffar: [4, 3], vann: true }), nu: NU, matchId: "f", uid: UID, rng: r }); break; }
  if (cupMatch(W, UID)) W = cupKlar(W, { res: res(2, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K;
  else if (mc) { W = mcKlar(W, { res: res(2, 1), nu: NU, matchId: `mc${i}`, uid: UID, rng: r }).K; MITT = MITT || kopia(W); }
  else W = matchKlar(W, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const VUNNEN = kopia(FINAL.K);
const LEGEND = nyLegendklubb(VUNNEN, { namn: "Norrsken FF", farg: "#2ecc71", rng: r });

const ref = (db) => doc(db, "matchdagen", UID);
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const utanUndef = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const medTid = (K, over = {}) => utanUndef({ ...tillDok(kopia(K)), senast: serverTimestamp(), ...over });
const seed = (K) => env.seed((db) => setDoc(ref(db), utanUndef({ ...tillDok(kopia(K)), senast: new Date() })));
const elev = () => env.as(UID, {});
const legend = (over = {}) => setDoc(ref(elev()), medTid(LEGEND, over));
const mcPokal = (s) => `mastarcup|Mästarcupen|${s}|2026-11-20`;

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-matchdagen-873-tester"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: [UID, "kompis"], elevModuler: { [UID]: ["matchdagen"] } }, { merge: true }));
});

describe("#873 Tester: legendklubben förbi appen", () => {
  it("fixturen: säsong 21, finalen vunnen på straffar, legendklubben i säsong 22", () => {
    assert.equal(VUNNEN.sasong, 21);
    assert.equal(VUNNEN.mastarcup, "21-3");
    assert.equal(LEGEND.sasong, 22);
    assert.ok(MITT && !MITT.pokaler.some((p) => p.typ === "mastarcup"));
  });
  it("kassan: bara exakt 600 – 0, 599, 601, 100 000, -1, null och 600,5 nekas", async () => {
    await seed(VUNNEN);
    for (const kassa of [0, 599, 601, 100000, -1, null, 600.5, true]) await assertFails(legend({ kassa }), String(kassa));
    await assertSucceeds(legend({ kassa: 600 }));
  });
  it("två legendklubbar i rad (samma Mästarcup) nekas – den andra saknar en pokal från den nya säsongen", async () => {
    await seed(VUNNEN);
    await assertSucceeds(legend());
    const L2 = nyLegendklubb({ ...LEGEND, div: TOPP_DIV, pokaler: [...LEGEND.pokaler, { typ: "mastarcup", namn: "Mästarcupen", sasong: 22, datum: "x" }] },
      { namn: "Tredje IF", farg: "#e8473f", rng: r });
    await assertFails(setDoc(ref(elev()), medTid({ ...L2, pokaler: LEGEND.pokaler })), "andra legenden utan ny pokal");
  });
  it("reserverna, marknaden, historiken eller truppen saknas i legendskrivningen → nekas", async () => {
    await seed(VUNNEN);
    for (const falt of ["reserver", "marknad", "trupp", "kassa", "div", "sasong"]) {
      const d = medTid(LEGEND);
      delete d[falt];
      await assertFails(setDoc(ref(elev()), d), `utan ${falt}`);
    }
  });
  it("säsongen som text, div som text, en stjärna som text nekas", async () => {
    await seed(VUNNEN);
    await assertFails(legend({ sasong: "22" }));
    await assertFails(legend({ div: "0" }));
    await assertFails(legend({ klubb: { ...LEGEND.klubb, legendStjarnor: "1" } }));
  });
  it("den gamla tränade truppen med grundpelar-id:n (g1–g7) men 3★ nekas; nya namn går", async () => {
    await seed(VUNNEN);
    const fel = kopia(LEGEND.trupp).map((p) => ({ ...p, st: 3 }));
    await assertFails(legend({ trupp: fel }), "3★");
    const xp = kopia(LEGEND.trupp).map((p) => ({ ...p, xp: 5 }));
    await assertFails(legend({ trupp: xp }), "xp 5");
    const html = kopia(LEGEND.trupp).map((p, i) => (i === 2 ? { ...p, namn: "<b>x</b>" } : p));
    await assertFails(legend({ trupp: html }), "HTML i ett namn");
    await assertSucceeds(legend({ trupp: nyTrupp(skapaPrng("annan").tal) }), "en annan ny trupp");
  });
  it("historiken: HTML/&/\" i namnet, 4001 tecken och en rad med fel antal pokalsorter nekas", async () => {
    await seed(VUNNEN);
    for (const t of ["A&B|#2f6fe8|1-21|0.0.0.1.1", "A\"B|#2f6fe8|1-21|0.0.0.1.1", "A>B|#2f6fe8|1-21|0.0.0.1.1",
      "AB|#2f6fe8|1-21|0.0.0.1.1.1", "AB|#2f6fe8|1-21|0.0.0.1", "AB|#2f6fe8|21|0.0.0.1.1", "AB|#2f6fe8|1-21|00000.0.0.1.1", "|#2f6fe8|1-21|0.0.0.1.1"]) {
      await assertFails(legend({ klubbhistorik: [t] }), t);
    }
    // ett element med '/' bär flera rader (som pokalerna i #872) – men hela texten tak:as vid 4 000
    const enRad = "Gamla Klubben XYZ|#2f6fe8|1-21|9999.9999.9999.9999.9999";
    const many = Array.from({ length: 200 }, () => enRad).join("/");
    assert.ok(many.length > 4000);
    await assertFails(legend({ klubbhistorik: [many] }), "200 rader i ett element");
    const ryms = Array.from({ length: Math.floor(4000 / (enRad.length + 1)) }, () => enRad).join("/");
    assert.ok(ryms.length <= 4000);
    await assertSucceeds(legend({ klubbhistorik: [ryms] }), "känd gräns: ~70 rader i ett element ≤ 4 000 tecken");
  });
  it("känd gräns: en förfalskad mastarcup-pokal (en skrivning) och sedan en legendklubb (nästa) går – även från Division 3", async () => {
    await seed(MITT);
    const p = [...pokalerTillDok(MITT.pokaler), mcPokal(21)];
    await assertSucceeds(setDoc(ref(elev()), medTid(MITT, { pokaler: p })), "pokalen förfalskad");
    const forfalskad = { ...MITT, pokaler: [...MITT.pokaler, { typ: "mastarcup", namn: "Mästarcupen", sasong: 21, datum: "2026-11-20" }] };
    const L = nyLegendklubb(forfalskad, { namn: "Fusk FC", farg: "#2ecc71", rng: r });
    await assertSucceeds(setDoc(ref(elev()), medTid(L)), "legendklubben efter förfalskningen");
    // samma i en skrivning nekas: reglerna läser den SPARADE pokallistan
    await seed(MITT);
    await assertFails(setDoc(ref(elev()), medTid(L)), "pokal + legend i samma skrivning");
    // från Division 3 (reglerna prövar inte g.div)
    await seed({ ...MITT, div: 3, mastarcup: null, pokaler: [...MITT.pokaler, { typ: "mastarcup", namn: "x", sasong: 21, datum: "2026-11-20" }] });
    await assertSucceeds(setDoc(ref(elev()), medTid(L)), "legendklubb från Division 3");
  });
  it("känd gräns: legendskrivningen utan klubb (ingen stjärna) eller utan stjärnfältet går – stjärnorna kan bara bli färre", async () => {
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 2 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1", "B|#2f6fe8|6-12|0.0.0.1.1"] });
    const L = nyLegendklubb({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 2 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1", "B|#2f6fe8|6-12|0.0.0.1.1"] },
      { namn: "Trean", farg: "#2ecc71", rng: r });
    assert.equal(L.klubb.legendStjarnor, 3);
    await assertSucceeds(setDoc(ref(elev()), medTid(L, { klubb: { ...VUNNEN.klubb, legendStjarnor: 2 } })), "samma klubb, samma stjärnor");
    await seed({ ...VUNNEN, klubb: { ...VUNNEN.klubb, legendStjarnor: 2 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1", "B|#2f6fe8|6-12|0.0.0.1.1"] });
    await assertSucceeds(setDoc(ref(elev()), medTid(L, { klubb: { namn: "Trean", farg: "#2ecc71" } })), "utan stjärnfältet");
    await assertFails(setDoc(ref(elev()), medTid(L, { klubb: { namn: "Trean", farg: "#2ecc71", legendStjarnor: 4 } })), "+2");
  });
  it("känd gräns: en legendklubb via updateDoc behåller Superligans liga (bara formen prövas)", async () => {
    await seed(VUNNEN);
    await assertSucceeds(updateDoc(ref(elev()), {
      klubbhistorik: LEGEND.klubbhistorik, klubb: LEGEND.klubb, div: 0, sasong: 22, kassa: 600, reserver: [], marknad: [],
      trupp: LEGEND.trupp, senast: serverTimestamp(),
    }));
  });
});

describe("#873 Tester: Mästarcupen och pokalerna förbi appen", () => {
  it("mastarcup: fler former nekas (radbrytning, tecken före, -0-u, -u utan runda, två siffror)", async () => {
    await seed(MITT);
    for (const mastarcup of ["21-1\n", "x21-1", "21-0-u", "21-u", "21-12", "21--1", "21-1-U", true, 21.1, { s: 21 }]) {
      await assertFails(setDoc(ref(elev()), medTid(MITT, { mastarcup })), JSON.stringify(mastarcup));
    }
    for (const mastarcup of ["21-3-u", "1-0", "99999-3"]) await assertSucceeds(setDoc(ref(elev()), medTid(MITT, { mastarcup })), mastarcup);
  });
  it("superliga/mastarcup-pokaler: HTML, 41 tecken, sexsiffrig säsong, fel datum nekas; 40 tecken går", async () => {
    await seed(MITT);
    const bas = pokalerTillDok(MITT.pokaler);
    const prova = (rad) => setDoc(ref(elev()), medTid(MITT, { pokaler: [...bas, rad] }));
    for (const rad of ["superliga|<img>|21|2026-11-20", "mastarcup|a&b|21|2026-11-20", `superliga|${"x".repeat(41)}|21|2026-11-20`,
      "mastarcup|Mästarcupen|123456|2026-11-20", "mastarcup|Mästarcupen|21|2026-1-20", "Mastarcup|Mästarcupen|21|2026-11-20",
      "superliga|Mästare|21|2026-11-20|x"]) {
      await assertFails(prova(rad), rad);
    }
    await assertSucceeds(prova(`superliga|${"x".repeat(40)}|21|2026-11-20`));
  });
  it("en vanlig match kan inte lägga till eller ändra klubbhistoriken; stjärnorna kan inte höjas med klubbnamnet", async () => {
    await seed({ ...MITT, klubb: { ...MITT.klubb, legendStjarnor: 1 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1"] });
    await assertFails(setDoc(ref(elev()), medTid(MITT, { klubb: { ...MITT.klubb, legendStjarnor: 2 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1"] })), "+1 utan historik");
    await assertFails(setDoc(ref(elev()), medTid(MITT, { klubb: { ...MITT.klubb, legendStjarnor: 1 }, klubbhistorik: ["A|#2f6fe8|1-5|9.9.9.9.9"] })), "historiken skriven om");
    await assertSucceeds(setDoc(ref(elev()), medTid(MITT, { klubb: { namn: "Nytt Namn", farg: MITT.klubb.farg, legendStjarnor: 1 }, klubbhistorik: ["A|#2f6fe8|1-5|0.0.0.1.1"] })), "nytt namn, samma stjärna");
  });
});

describe("#873 Tester: äldre dokument (1c–2c) sparas fortfarande", () => {
  it("ett 1c-dokument (inga pokaler, rekord, cup, stjärnor) – en match och ett nytt namn", async () => {
    const gammal = kopia(K0);
    for (const k of ["pokaler", "rekord", "cup", "kval", "mastarcup", "klubbhistorik", "reserver", "marknad", "lager"]) delete gammal[k];
    await seed(gammal);
    const M = matchKlar(gammal, { res: res(2, 0), rng: r, nu: NU, matchId: "g1" }).K;
    await assertSucceeds(setDoc(ref(elev()), medTid(M)), "match");
    await seed(gammal);
    await assertSucceeds(setDoc(ref(elev()), medTid({ ...gammal, klubb: { namn: "Nya Namnet", farg: gammal.klubb.farg } })), "nytt namn");
  });
  it("ett 2c-dokument med en gammal 'liga|Vinnare Superligan'-pokal och klubb utan legendStjarnor – match, namn, läraren", async () => {
    const gammal = { ...kopia(MITT), mastarcup: undefined, pokaler: [{ typ: "liga", namn: "Vinnare Superligan", sasong: 19, datum: "2026-11-01" }] };
    delete gammal.klubb.legendStjarnor;
    await seed(gammal);
    const M = matchKlar(utanUndef(gammal), { res: res(1, 0), rng: r, nu: NU, matchId: "g2" }).K;
    await assertSucceeds(setDoc(ref(elev()), medTid(M)), "match");
    await assertSucceeds(setDoc(ref(elev()), medTid({ ...M, klubb: { ...M.klubb, namn: "Nytt", legendStjarnor: 0 } })), "namn med stjärnfältet 0");
    await assertSucceeds(updateDoc(ref(env.ak4()), { "klubb.namn": "Pluggporten FC" }), "läraren");
  });
});
