// ============================================================================
// Regel-tester: dagskvittot myntDag (#853, docs/SAKERHET-MYNT.md §6 B1).
// Skrivningarna byggs med den RIKTIGA planen (mynt-dag.js planTjana) och,
// i sista sviten, med data-mynt.js tjanaMyntMed mot emulatorns SDK. Bevisar:
//   • tillåtet: +n inom taket med coins +n i samma batch, ny dag, xp ihop med
//     ovning, gåva för ett gårdsdjur i agdaDjur (och ett andra ägt djur)
//   • nekat: kvitto utan coins-höjning, coins ≠ senastMynt, över PER_GANG /
//     PER_DAG, fel dag, d.dag ≠ id, lastAt ≠ request.time, annan elev, lärare,
//     sänkt räknare, okänd källa, två källor, XP från lasresa, radering;
//     gåvan: samma djur två gånger, uid bara i farm.animals, uppblåst
//     farm.animals (1 000 fejkade djur), husdjur i agdaDjur, två gavor-nycklar,
//     senastMynt ≠ 8.
// Körs av `npm run test:rules` (kräver emulatorn). agdaDjur sätts med
// reglerna avstängda (B2 skriver den på servern).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { MYNT_DAG_KVITTON, PER_GANG, PER_DAG, myntDag, planTjana } from "../src/mynt-dag.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const IDAG = myntDag(Date.now());
const IGAR = myntDag(Date.now() - 24 * H);
const IMORGON = myntDag(Date.now() + 24 * H);

async function las(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
const seed = (path, data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));

/**
 * En intjäning som batch. Standard = exakt det tjanaMynt skriver (planTjana
 * mot nuvarande dokument); `kv`/`sd` skriver över fält för fuskförsöken.
 */
async function tjana(uid, kalla, mynt, { xp = 0, gardUid = null, dag = IDAG, kv = {}, sd = {}, db = elev(uid), utanSd = false, extra = {} } = {}) {
  const fore = await las(["studentData", uid]);
  const kvFore = await las(["studentData", uid, MYNT_DAG_KVITTON, dag]);
  const p = planTjana({ kalla, mynt, xp, sd: fore, kvitto: kvFore, gardUid });
  const b = writeBatch(db);
  b.set(doc(db, "studentData", uid, MYNT_DAG_KVITTON, dag),
    { ...(p.kvitto || { kalla, senastMynt: 0, senastXp: 0 }), dag, lastAt: serverTimestamp(), ...kv }, { merge: true });
  if (!utanSd) b.update(doc(db, "studentData", uid), { ...(p.sd || {}), ...extra, ...sd });
  return b.commit();
}
async function saldo(uid) {
  const sd = await las(["studentData", uid]);
  const k = await las(["studentData", uid, MYNT_DAG_KVITTON, IDAG]);
  return { coins: sd.coins, xp: sd.xp, k: k || {} };
}

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mynt-dag"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(["classes", "4b"], { name: "4B", studentIds: ["alma", "omar"] });
  await seed(["students", "alma"], { namn: "Alma" });
  await seed(["students", "omar"], { namn: "Omar" });
  await seed(["studentData", "alma"], {
    coins: 250, xp: 100, progress: {},
    agdaDjur: { h1: "animal_horse", k1: "animal_cow", f1: "fisk" },
    farm: { animals: [{ uid: "h1", id: "animal_horse" }, { uid: "k1", id: "animal_cow" }, { uid: "x1", id: "animal_pig" }] },
  });
  await seed(["studentData", "omar"], { coins: 10, xp: 0, progress: {} });
});

describe("myntDag (#853): tillåtet", () => {
  it("+n inom taket med coins +n i samma batch, två gånger i rad", async () => {
    await assertSucceeds(tjana("alma", "lasresa", 12));
    await assertSucceeds(tjana("alma", "lasresa", 9));
    const s = await saldo("alma");
    assert.equal(s.coins, 271);
    assert.equal(s.k.lasresa, 21);
    assert.equal(s.k.senastMynt, 9);
  });
  it("alla fyra takade källor, var för sig", async () => {
    await assertSucceeds(tjana("alma", "ovning", 50));
    await assertSucceeds(tjana("alma", "amnes", 35));
    await assertSucceeds(tjana("alma", "ekv", 7));
    await assertSucceeds(tjana("alma", "lasresa", 27));
    const s = await saldo("alma");
    assert.equal(s.coins, 250 + 50 + 35 + 7 + 27);
    assert.deepEqual([s.k.ovning, s.k.amnes, s.k.ekv, s.k.lasresa], [50, 35, 7, 27]);
  });
  it("xp ihop med ovning: saldo och XP höjs lika mycket som kvittot", async () => {
    await assertSucceeds(tjana("alma", "ovning", 50, { xp: 50 }));
    const s = await saldo("alma");
    assert.deepEqual([s.coins, s.xp, s.k.ovning, s.k.xp, s.k.senastXp], [300, 150, 50, 50, 50]);
  });
  it("xp utan mynt (myntaket nått, XP-taket inte)", async () => {
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "ovning", ovning: PER_DAG.ovning, senastMynt: 1, senastXp: 0, lastAt: Timestamp.now() });
    await assertSucceeds(tjana("alma", "ovning", 50, { xp: 40 }));
    const s = await saldo("alma");
    assert.deepEqual([s.coins, s.xp, s.k.senastMynt], [250, 140, 0]);
  });
  it("ny dag: gårdagens fulla kvitto påverkar inte dagens", async () => {
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IGAR], { dag: IGAR, kalla: "ekv", ekv: PER_DAG.ekv, senastMynt: 7, senastXp: 0, lastAt: Timestamp.now() });
    await assertSucceeds(tjana("alma", "ekv", 7));
  });
  it("gåvan för ett gårdsdjur i agdaDjur, och ett andra ägt djur samma dag", async () => {
    await assertSucceeds(tjana("alma", "gard", 8, { gardUid: "h1" }));
    await assertSucceeds(tjana("alma", "gard", 8, { gardUid: "k1" }));
    const s = await saldo("alma");
    assert.equal(s.coins, 266);
    assert.deepEqual(s.k.gavor, { h1: true, k1: true });
    assert.equal(s.k.gard, 16);
  });
  it("gåvan ihop med farm.animals i samma skrivning (extra)", async () => {
    await assertSucceeds(tjana("alma", "gard", 8, { gardUid: "h1", extra: { "farm.animals": [{ uid: "h1", id: "animal_horse", lastGiftAt: 1 }] } }));
  });
  it("läsning: eleven själv och läraren, inte en klasskamrat", async () => {
    await assertSucceeds(tjana("alma", "ekv", 3));
    await assertSucceeds(getDoc(doc(elev("alma"), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
    await assertFails(getDoc(doc(elev("omar"), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
  });
});

describe("myntDag (#853): nekat", () => {
  it("kvitto utan coins-höjning, och coins-höjning ≠ senastMynt", async () => {
    await assertFails(tjana("alma", "lasresa", 12, { utanSd: true }));
    await assertFails(tjana("alma", "lasresa", 12, { sd: { coins: 250 } }));
    await assertFails(tjana("alma", "lasresa", 12, { sd: { coins: 263 } }));
    await assertFails(tjana("alma", "lasresa", 12, { sd: { coins: 99999 } }));
    assert.equal((await saldo("alma")).coins, 250);
  });
  it("över PER_GANG och över PER_DAG", async () => {
    for (const k of ["ovning", "lasresa", "amnes", "ekv"]) {
      const m = PER_GANG[k] + 1;
      await assertFails(tjana("alma", k, 1, { kv: { senastMynt: m, [k]: m }, sd: { coins: 250 + m } }));
    }
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "ekv", ekv: PER_DAG.ekv - 3, senastMynt: 1, senastXp: 0, lastAt: Timestamp.now() });
    await assertFails(tjana("alma", "ekv", 1, { kv: { senastMynt: 4, ekv: PER_DAG.ekv + 1 }, sd: { coins: 254 } }));
    await assertSucceeds(tjana("alma", "ekv", 3));
    await assertFails(tjana("alma", "ekv", 1, { kv: { senastMynt: 1, ekv: PER_DAG.ekv + 1 }, sd: { coins: 254 } }));
  });
  it("gårdagens och morgondagens id, d.dag ≠ id, lastAt ≠ request.time", async () => {
    await assertFails(tjana("alma", "ekv", 3, { dag: IGAR }));
    await assertFails(tjana("alma", "ekv", 3, { dag: IMORGON }));
    await assertFails(tjana("alma", "ekv", 3, { kv: { dag: IGAR } }));
    await assertFails(tjana("alma", "ekv", 3, { kv: { lastAt: Timestamp.fromMillis(Date.now() - 60000) } }));
  });
  it("en annan elevs kvitto, och läraren", async () => {
    await assertFails(tjana("omar", "ekv", 3, { db: elev("alma") }));
    await assertFails(tjana("alma", "ekv", 3, { db: teacher() }));
  });
  it("sänkt räknare, okänd källa, två källor, XP från lasresa", async () => {
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "lasresa", lasresa: 30, ekv: 5, senastMynt: 3, senastXp: 0, lastAt: Timestamp.now() });
    await assertFails(tjana("alma", "lasresa", 3, { kv: { lasresa: 20, senastMynt: -10 }, sd: { coins: 240 } }));
    await assertFails(tjana("alma", "lasresa", 3, { kv: { kalla: "bonus", bonus: 3 } }));
    await assertFails(tjana("alma", "lasresa", 3, { kv: { ekv: 8 } }));
    await assertFails(tjana("alma", "lasresa", 3, { kv: { senastXp: 20, xp: 20 }, sd: { xp: 120 } }));
    await assertFails(tjana("alma", "ekv", 3, { kv: { lasresa: 0 } }));
    await assertSucceeds(tjana("alma", "lasresa", 3));
  });
  it("XP över taket per gång, och ett kvitto utan mynt och XP", async () => {
    await assertFails(tjana("alma", "ovning", 10, { kv: { senastXp: 51, xp: 51 }, sd: { xp: 151 } }));
    await assertFails(tjana("alma", "ovning", 0, { sd: { coins: 250 } }));
  });
  it("radering: eleven nekas, admin får", async () => {
    await assertSucceeds(tjana("alma", "ekv", 3));
    await assertFails(deleteDoc(doc(elev("alma"), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
    await assertSucceeds(deleteDoc(doc(teacher(), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
  });
});

describe("myntDag (#853): gåvan är knuten till ägda gårdsdjur", () => {
  it("samma djur två gånger samma dag nekas", async () => {
    await assertSucceeds(tjana("alma", "gard", 8, { gardUid: "h1" }));
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { kalla: "gard", senastMynt: 8, gard: 16, gardUid: "h1", gavor: { h1: true } }, sd: { coins: 266 } }));
  });
  it("ett gardUid som bara finns i farm.animals nekas", async () => {
    await assertFails(tjana("alma", "gard", 8, { gardUid: "x1" }));
  });
  it("uppblåst farm.animals (1 000 fejkade djur, 1 ägt): bara en gåva går igenom", async () => {
    const animals = Array.from({ length: 1000 }, (_, i) => ({ uid: `fejk${i}`, id: "animal_horse" }));
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "studentData", "omar"),
      { coins: 10, xp: 0, agdaDjur: { egen: "animal_pig" }, farm: { animals: [...animals, { uid: "egen", id: "animal_pig" }] } }));
    let ok = 0;
    for (const uid of ["fejk0", "fejk1", "egen", "fejk999", "egen"]) {
      try { await tjana("omar", "gard", 8, { gardUid: uid }); ok++; } catch {}
    }
    assert.equal(ok, 1);
    assert.equal((await las(["studentData", "omar"])).coins, 18);
  });
  it("ett gardUid vars agdaDjur-värde är ett husdjur nekas", async () => {
    await assertFails(tjana("alma", "gard", 8, { gardUid: "f1" }));
  });
  it("två gavor-nycklar i samma skrivning nekas", async () => {
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { gavor: { h1: true, k1: true } } }));
  });
  it("senastMynt ≠ 8 nekas (även med matchande saldo)", async () => {
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { senastMynt: 16, gard: 16 }, sd: { coins: 266 } }));
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { senastMynt: 4, gard: 4 }, sd: { coins: 254 } }));
  });
  it("gårdskvitto med XP eller utan gardUid nekas", async () => {
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { senastXp: 5, xp: 5 }, sd: { xp: 105 } }));
    await assertFails(tjana("alma", "gard", 8, { gardUid: "h1", kv: { gardUid: null } }));
  });
});

describe("myntDag (#853): data-mynt.js tjanaMyntMed mot reglerna", () => {
  let tjanaMyntMed;
  before(async () => {
    installeraFirebaseStubbe();
    ({ tjanaMyntMed } = await import("../src/data-mynt.js"));
  });
  const sdk = (uid) => ({ db: elev(uid), doc, runTransaction, serverTimestamp, nu: Date.now });

  it("övning med XP, sedan klippning mot dagstaket", async () => {
    let r = await tjanaMyntMed(sdk("alma"), "ovning", 50, { xp: 50, studentId: "alma" });
    assert.deepEqual([r.mynt, r.xp, r.tak, r.saldo, r.xpTotal], [50, 50, false, 300, 150]);
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "ovning", ovning: PER_DAG.ovning - 20, xp: 50, senastMynt: 50, senastXp: 50, lastAt: Timestamp.now() });
    r = await tjanaMyntMed(sdk("alma"), "ovning", 50, { xp: 50, studentId: "alma" });
    assert.deepEqual([r.mynt, r.xp, r.tak, r.saldo], [20, 50, true, 320]);
  });
  it("dokument utan xp: mynten betalas, xp skrivs inte", async () => {
    await seed(["studentData", "omar"], { coins: 10, progress: { a: { quiz: { completed: true, stars: 3 } } } });
    const r = await tjanaMyntMed(sdk("omar"), "ovning", 30, { xp: 40, studentId: "omar" });
    assert.deepEqual([r.mynt, r.xp, r.saldo, r.xpTotal], [30, 0, 40, 50]);
    const sd = await las(["studentData", "omar"]);
    assert.equal(sd.coins, 40);
    assert.ok(!("xp" in sd));
  });
  it("gåvan via en extra-funktion; utan kartpost nekas den och ingenting skrivs", async () => {
    const extra = (sd) => ({ "farm.animals": sd.farm.animals.map((a) => ({ ...a, lastGiftAt: 1 })) });
    let r = await tjanaMyntMed(sdk("alma"), "gard", 8, { gardUid: "h1", extra, studentId: "alma" });
    assert.deepEqual([r.mynt, r.saldo], [8, 258]);
    r = await tjanaMyntMed(sdk("alma"), "gard", 8, { gardUid: "x1", extra, studentId: "alma" });
    assert.equal(r.mynt, 0);
    assert.equal(r.nekad, true);
    assert.equal((await las(["studentData", "alma"])).coins, 258);
  });
});
