// ============================================================================
// Regel-tester: Matchdagen 2c (#872) – Silverpokalen (cup), rekorden (rekord) och
// pokalerna (rader) i matchdagen/{uid}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §9, §15 (Regler):
//   • cup är text "säsong-rundor(-u)", rekord är text i REKORD_MONSTER:s form (md-rekord.js),
//     pokalerna är rader "typ|namn|säsong|datum" – inget som kan bli HTML, med tak på längden
//   • prövas bara när fältet ändras (1000-uttrycksgränsen) – ett äldre dokument med pokaler som
//     objekt sparar fortfarande matcher
//   • hela säsongen med cupen och kvalet i EN skrivning (en kö offline) går igenom
//   • mastarcup (Etapp 3) finns inte än; läraren rör bara lagnamnet
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-cup.js, md-kval.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nastaMatch, nyKarriar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const UID = "e4a";
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [{ min: 4, lag: "oss" }], stat: STAT, ...x });
const kopia = (v) => JSON.parse(JSON.stringify(v));

const r = skapaPrng("regler-872").tal;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
const K1 = kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K);
const CUP1 = cupKlar(K1, { res: res(3, 0), nu: NU, matchId: "c1", uid: UID, rng: r });
// Hela säsongen: cupen vunnen (4 rundor), ligan vunnen, kvalet vunnet – tre pokaler och rekorden.
let V = K1;
let FORE_FINAL = null;
for (let i = 1; i < 30 && (nastaMatch(V) || cupMatch(V, UID)); i++) {
  if (cupMatch(V, UID)) {
    if (cupMatch(V, UID).runda === 3) FORE_FINAL = V;
    V = cupKlar(V, { res: res(4, 0), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K;
  } else V = matchKlar(V, { res: res(4 + (i % 3), 0), rng: r, nu: NU, matchId: `m${i}` }).K;
}
const FINAL = cupKlar(FORE_FINAL, { res: res(1, 1, { straffar: [5, 4], vann: true }), nu: NU, matchId: "final", uid: UID, rng: r });
const KV = kopia(kvalKlar(V, { res: res(2, 0), nu: NU, matchId: "kv", rng: r }).K);

const ref = (db, uid = UID) => doc(db, "matchdagen", uid);
const mref = (db, id) => doc(db, "matchdagen", UID, "matcher", id);
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K, over = {}) => tillDok({ ...kopia(K), senast: serverTimestamp(), ...over });
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K)), senast: new Date() }));
const elev = () => env.as(UID, {});

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-872");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: [UID, "kompis"], elevModuler: { [UID]: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – Silverpokalen och rekorden, elevens skrivningar (#872)", () => {
  it("en cupmatch (cup + rekord) och finalen med pokalen sparas; matchdokumentet har typ cup", async () => {
    assert.equal(CUP1.K.cup, "1-1");
    assert.ok(FINAL.vannCupen && FINAL.K.pokaler.some((p) => p.typ === "cup"));
    await seed(K1);
    await assertSucceeds(setDoc(ref(elev()), medTid(CUP1.K)));
    await assertSucceeds(setDoc(mref(elev(), "s1-d0-cup1-x"), { ...CUP1.match, datum: serverTimestamp() }));
    await seed(FORE_FINAL);
    await assertSucceeds(setDoc(ref(elev()), medTid(FINAL.K)));
    await assertSucceeds(setDoc(mref(elev(), "s1-d0-cup4-x"), { ...FINAL.match, datum: serverTimestamp() }));
  });
  it("hela säsongen med cupen och kvalet i EN skrivning (en ny klubb offline) går igenom", async () => {
    await seed(K0);
    assert.equal(KV.cup, "1-4");
    assert.equal(KV.pokaler.length, 3);
    await assertSucceeds(setDoc(ref(elev()), medTid(KV)));
  });
  it("cup: bara texten 'säsong-rundor(-u)' – ingen map, inget tal, ingen HTML, inga fler rundor", async () => {
    await seed(K1);
    for (const cup of [{ sasong: 1, spelade: 1 }, 11, "1-5", "1-0", "<img src=x>", "1-1-v", "1-1 ", "x".repeat(2000), null, ["1-1"]]) {
      await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { cup })), JSON.stringify(cup).slice(0, 30));
    }
    for (const cup of ["1-2", "1-3-u", "12345-4"]) await assertSucceeds(setDoc(ref(elev()), medTid(CUP1.K, { cup })), cup);
  });
  it("rekord: bara texten i REKORD_MONSTER:s form – ingen HTML, ingen map, inga stora strängar", async () => {
    await seed(K1);
    const ok = CUP1.K.rekord;
    assert.match(ok, /^mm/);
    for (const rekord of [{ mm: 5 }, 5, `${ok}<img>`, ok.replace("mm", "mm<b>"), `${ok}|${"x".repeat(5000)}`, ok.replace(/nu.*$/, "nu1.2.3"), ""]) {
      await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { rekord })), String(JSON.stringify(rekord)).slice(0, 40));
    }
    await assertSucceeds(setDoc(ref(elev()), medTid(CUP1.K, { rekord: "mm|ms|ss|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0.0" })));
  });
  it("pokalerna: rader 'typ|namn|säsong|datum' – inget objekt, ingen HTML, högst 300, namnet ≤ 40 tecken", async () => {
    await seed(FORE_FINAL);
    const rader = pokalerTillDok(FINAL.K.pokaler);
    const prova = (pokaler) => setDoc(ref(elev()), { ...medTid(FINAL.K), pokaler });
    await assertSucceeds(prova(rader));
    await assertFails(prova([...rader.slice(0, -1), { typ: "cup", namn: "Silverpokalen", sasong: 1, datum: "2026-11-20" }]), "objekt");
    await assertFails(prova([...rader, "cup|<img src=x onerror=alert(1)>|1|2026-11-20"]), "HTML i namnet");
    await assertFails(prova([...rader, `cup|${"x".repeat(41)}|1|2026-11-20`]), "41 tecken");
    await assertFails(prova([...rader, "mastarcup|Mästarcupen|1|2026-11-20"]), "okänd typ (Etapp 3)");
    await assertFails(prova([...rader, "cup|Silverpokalen|1|20261120"]), "datumet");
    await assertFails(prova(Array.from({ length: 301 }, () => "cup|Silverpokalen|1|2026-11-20")), "301");
    await assertSucceeds(prova(Array.from({ length: 300 }, () => "cup|Silverpokalen|1|2026-11-20")), "300 (≈ 9 kB)");
  });
  it("ett äldre dokument med pokaler som objekt: nästa match sparar dem som rader (appen) – eller lämnar dem orörda", async () => {
    const gamla = [{ typ: "liga", namn: "Vinnare Division 6", sasong: 0, datum: "2026-11-01" }];
    const gammal = () => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K1)), pokaler: gamla, senast: new Date() }));
    const efter = { ...matchKlar(K1, { res: res(1, 0), rng: r, nu: NU, matchId: "m2" }).K, pokaler: gamla };
    await gammal();
    await assertSucceeds(setDoc(ref(elev()), medTid(efter)), "appen: pokalerna blir rader");
    await gammal();
    const { pokaler, ...utan } = medTid(efter);
    void pokaler;
    await assertSucceeds(setDoc(ref(elev()), utan, { mergeFields: Object.keys(utan) }), "utan pokalerna: de prövas inte");
  });
  it("mastarcup (Etapp 3) finns inte än – ett okänt fält nekas", async () => {
    await seed(K1);
    await assertFails(setDoc(ref(elev()), medTid(CUP1.K, { mastarcup: { runda: 1 } })));
  });
  it("läraren kan inte röra cupen, rekorden eller pokalerna – bara lagnamnet", async () => {
    await seed(FINAL.K);
    const larare = env.ak4();
    await assertFails(updateDoc(ref(larare), { cup: "1-1-u" }));
    await assertFails(updateDoc(ref(larare), { rekord: "mm|ms|ss|sv|lt|os|ar|sm|nu1.0.0.0.0.0.0.0" }));
    await assertFails(updateDoc(ref(larare), { pokaler: [] }));
    await assertSucceeds(updateDoc(ref(larare), { "klubb.namn": "Pluggporten FC" }));
  });
});
