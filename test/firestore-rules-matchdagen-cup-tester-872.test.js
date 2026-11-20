// ============================================================================
// Regel-tester: Matchdagen 2c (#872) – Testerns attackprov på cup, rekord,
// pokaler och den omskrivna summan (mdSummaOk med ett reguljärt uttryck).
// Elev som skriver FÖRBI appen (eget dokument). Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar } from "../src/matchdagen/delat/md-cup.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const UID = "e4a";
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [{ min: 4, lag: "oss" }], stat: STAT });
const kopia = (v) => JSON.parse(JSON.stringify(v));
const r = skapaPrng("tester-872").tal;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
const K1 = kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K);
const CUP1 = cupKlar(K1, { res: res(3, 0), nu: NU, matchId: "c1", uid: UID, rng: r });

const ref = (db) => doc(db, "matchdagen", UID);
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K, over = {}) => ({ ...tillDok(kopia(K)), senast: serverTimestamp(), ...over });
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K)), senast: new Date() }));
const elev = () => env.as(UID, {});

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-matchdagen-872-tester"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: [UID, "kompis"], elevModuler: { [UID]: ["matchdagen"] } }, { merge: true }));
});

describe("#872 Tester: cup, rekord och pokaler förbi appen", () => {
  it("cup: andra former nekas (tal, bool, mellanslag, radbrytning, ledande text)", async () => {
    await seed(K1);
    for (const cup of [true, 1.5, "1-1\n", " 1-1", "a1-1", "1-1-uu", "123456-1", "1--1", "-1-1", "1-1-U"]) {
      await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { cup })), JSON.stringify(cup));
    }
  });
  it("cup kan inte tas bort när den finns (fältet saknas i en full skrivning)", async () => {
    await seed(CUP1.K);
    const { cup, ...utan } = medTid(CUP1.K);
    void cup;
    await assertFails(setDoc(ref(elev()), utan));
  });
  it("rekord: XSS och för långa tal nekas, alla nycklar i fel ordning nekas", async () => {
    await seed(K1);
    const ok = "mm5.1|ms|ss|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0.0";
    await assertSucceeds(setDoc(ref(elev()), medTid(CUP1.K, { rekord: ok })));
    for (const rekord of [
      ok.replace("mm5.1", "mm123456.1"), ok.replace("nu1.0", "nu1.1234567890"), ok.replace("ms|", "ms\"><img src=x onerror=alert(1)>|"),
      "ms|mm5.1|ss|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0.0", ok.replace("ss|", "ss100-0.1|"), ok.replace("ss|", "ss5.1|"),
      `${ok}\n`, ok.replace("|nu", "|xx|nu"), ok.replace("nu1.0.0.0.0.0.0.0", "nu1.0.0.0.0.0.0.0.0"), null,
    ]) {
      await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { rekord })), String(rekord).slice(0, 50));
    }
  });
  it("pokaler: XSS-tecken, fel typ, tal, nästlade listor nekas", async () => {
    await seed(K1);
    const p = (pokaler) => setDoc(ref(elev()), medTid(CUP1.K, { pokaler }));
    await assertSucceeds(p(["cup|Silverpokalen|1|2026-11-20"]));
    for (const pokaler of [
      ["cup|<script>|1|2026-11-20"], ["cup|a&amp;|1|2026-11-20"], ['cup|"x|1|2026-11-20'], ["cup||1|2026-11-20"],
      ["superliga|x|1|2026-11-20"], [5], [{ typ: "cup" }], "cup|x|1|2026-11-20", { a: "cup|x|1|2026-11-20" },
      ["cup|x|123456|2026-11-20"], ["cup|x|1|2026-11-20|extra"],
    ]) {
      await assertFails(p(pokaler), JSON.stringify(pokaler).slice(0, 50));
    }
  });
  it("pokaler: EN rad med '/' inuti bär flera pokaler – hur stort kan listan bli? (storlekstaket)", async () => {
    await seed(K1);
    const rad = "cup|Silverpokalen|1|2026-11-20";
    // 300 element, vart och ett med 90 'pokaler' sammanfogade med '/'
    const stor = Array.from({ length: 300 }, () => Array.from({ length: 90 }, () => rad).join("/"));
    const bytes = stor.reduce((s, x) => s + x.length, 0);
    let gick = true;
    try { await assertSucceeds(setDoc(ref(elev()), medTid(CUP1.K, { pokaler: stor }))); } catch { gick = false; }
    console.log(`# pokaler med '/' i elementen: ${bytes} byte → ${gick ? "GODKÄND" : "nekad"}`);
    // Dokumenterat i docs/MATCHDAGEN.md §16.4: "namn utan / … högst 300. Det stänger storleksgapet".
    // F1 (#872, rättat): ett element fick innehålla '/' och bära flera rader – nu tak:ar
    // join('/').size() <= 20000 hela listan (appens största: 300 × 62 tecken + avgränsare).
    assert.equal(gick, false, `pokaler med ${bytes} byte`);
  });
  it("summa: flyttal, negativt, text, för många siffror och ratt > fragor nekas; gräns-heltal godkänns", async () => {
    const s0 = { ...kopia(CUP1.K.summa), matcher: 9999998 };
    await seed({ ...CUP1.K, summa: s0 });
    const prova = (over) => setDoc(ref(elev()), medTid(CUP1.K, { summa: { ...s0, ...over } }));
    await assertSucceeds(prova({ matcher: 9999999 }), "7 siffror");
    for (const over of [{ matcher: 10000000 }, { v: -1 }, { o: 1.5 }, { f: "1" }, { gjorda: null }, { ratt: s0.fragor + 1 },
      { fragor: 1e9 }, { perKalla: [] }, { perKalla: "x" }, { spelminuter: -1 }, { extra: 1 }]) {
      await assertFails(prova(over), JSON.stringify(over));
    }
    const { spelminuter, ...utan } = s0;
    void spelminuter;
    await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { summa: utan })), "summa utan spelminuter");
  });
});
