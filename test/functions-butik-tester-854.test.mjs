// ============================================================================
// Testarens svit för #854 (epic #851): försök bryta callablen butikKop och kör
// migreringsskriptet admin/migrera-mynt-las.mjs mot EMULATORERNA.
// Komplement till test/functions-butik.test.mjs (Coderns svit) – egna konton.
//
//   konstiga itemId (prototyp-namn, tomt, skiftläge, typer) → inget dras
//   saldo som inte är ett ändligt tal (sträng, NaN, Infinity, negativt) → inget mynt skapas
//   saknat studentData-dokument → ok:false, inget dokument skapas
//   parallella köp: överdrag med flera typer, lådor, lampan, gårdsuppgradering
//   trasiga fält: farm null/sträng, agdaDjur som lista, gammal pet, äldre djur i ownedItems
//   säsong: halloweenUntil passerad/framtida, inget config/season
//   migreringen: torrkörning skriver inget → --commit → torrkörning 0, saldo/varor orörda
//
// Körs:  firebase emulators:exec --only functions,auth,firestore "node --test test/functions-butik-tester-854.test.mjs"
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getItem } from "../src/shop-items.js";
import { MYSTERY_ITEMS } from "../src/mystery-items.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "butik-t854-admin");
const adb = adminApp.firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "butik-t854-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (data) => httpsCallable(fns, "butikKop", { timeout: 60_000 })(data).then((r) => r.data);
const kop = (itemId, extra = {}) => call({ itemId, ...extra });

const PW = "tester854";
const ELEV = "t854elev";
const UTAN = "t854utandok";
const email = (u) => `${u}@elev.pluggportalen.local`;
const som = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const felkod = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^functions\//, "");
  }
  return "ok";
};
const ref = (uid = ELEV) => adb.doc(`studentData/${uid}`);
const sd = async (uid = ELEV) => (await ref(uid).get()).data();
const satt = (data, uid = ELEV) => ref(uid).set(data);
const pris = (id) => getItem(id).price;

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc("config/season").delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: två elever (en utan studentData)", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ELEV, UTAN]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await adb.doc("config/season").set({ season: "host", halloween: false });
});

test("konstiga itemId: prototypnamn, tomt, skiftläge, mellanslag, långt – ok:false och inget dras", async () => {
  await som(ELEV);
  await satt({ coins: 5000, ownedItems: [] });
  const ids = ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__", "", " keps", "KEPS", "keps ",
    "x".repeat(20000), "mysterybox/../keps", "agdaDjur", "coins"];
  for (const id of ids) {
    const r = await kop(id);
    assert.equal(r.ok, false, JSON.stringify(id.slice(0, 30)));
    assert.equal(r.coins, 5000);
  }
  for (const bad of [["keps"], { id: "keps" }, null, true, 7]) {
    assert.equal(await felkod(call({ itemId: bad })), "invalid-argument", JSON.stringify(bad));
  }
  assert.equal(await felkod(call("keps")), "invalid-argument", "data som sträng");
  assert.equal(await felkod(call(null)), "invalid-argument", "data null");
  const d = await sd();
  assert.equal(d.coins, 5000);
  assert.deepEqual(d.ownedItems, []);
});

test("saldo som inte är ett ändligt tal skapar aldrig mynt", async () => {
  await som(ELEV);
  for (const coins of ["5000", Number.NaN, Number.POSITIVE_INFINITY, -50, null]) {
    await satt({ coins, ownedItems: [] });
    for (const id of ["keps", "mysterybox", "hund", "mystery-egg", "apple", "lada-2"]) {
      const r = await kop(id);
      assert.equal(r.ok, false, `${String(coins)} ${id}`);
    }
    const d = await sd();
    assert.deepEqual(d.ownedItems, [], String(coins));
    assert.ok(Object.is(d.coins, coins) || (Number.isNaN(coins) && Number.isNaN(d.coins)), `saldot orört: ${String(coins)}`);
  }
});

test("saknat studentData-dokument → ok:false och inget dokument skapas", async () => {
  await som(UTAN);
  await ref(UTAN).delete();
  for (const id of ["keps", "mysterybox", "hund", "animal_pig", "mystery-egg", "varmelampa", "apple", "odling-2"]) {
    const r = await kop(id);
    assert.equal(r.ok, false, id);
  }
  assert.equal((await ref(UTAN).get()).exists, false);
});

test("parallellt överdrag med flera typer: summan av lyckade köp = avdraget, aldrig minus", async () => {
  await som(ELEV);
  await satt({ coins: 500, ownedItems: [], roomAnimals: [], pets: [] });
  const ids = ["hund", "animal_pig", "mystery-egg", "soffa", "krona", "hund", "katt", "animal_cow"];
  const svar = await Promise.all(ids.map((id) => kop(id).then((r) => ({ id, r }), (e) => ({ id, e: e.code }))));
  const fel = svar.filter((s) => s.e);
  assert.deepEqual(fel, [], "inga serverfel");
  const ok = svar.filter((s) => s.r.ok);
  const dragit = ok.reduce((s, x) => s + pris(x.id), 0);
  const d = await sd();
  assert.ok(d.coins >= 0, "aldrig minus");
  assert.equal(d.coins, 500 - dragit, `lyckade: ${ok.map((x) => x.id)}`);
  const rum = ok.filter((x) => ["hund", "katt"].includes(x.id)).length;
  const gard = ok.filter((x) => x.id.startsWith("animal_")).length;
  const agg = ok.filter((x) => x.id === "mystery-egg").length;
  assert.equal(d.roomAnimals.length, rum);
  assert.equal((d.farm?.animals || []).length, gard);
  assert.equal(d.pets.length, agg);
  assert.equal(Object.keys(d.agdaDjur || {}).length, rum + gard + agg, "en kartpost per köpt djur");
});

test("parallella köp: 6 hundar för 500 → exakt 3, unika uid, en kartpost var", async () => {
  await som(ELEV);
  await satt({ coins: 500, ownedItems: [], roomAnimals: [] });
  const svar = await Promise.all(Array.from({ length: 6 }, () => kop("hund")));
  assert.equal(svar.filter((r) => r.ok).length, 3);
  const d = await sd();
  assert.equal(d.coins, 500 - 3 * 160);
  const uids = d.roomAnimals.map((a) => a.uid);
  assert.equal(new Set(uids).size, 3);
  assert.deepEqual(Object.keys(d.agdaDjur).sort(), [...uids].sort());
});

test("parallella mysterylådor: avdrag och retur stämmer mot svaren", async () => {
  await som(ELEV);
  await satt({ coins: 1200, ownedItems: [] });
  const svar = await Promise.all(Array.from({ length: 5 }, () => kop("mysterybox", { legendaryChance: 1, price: 0 })));
  const ok = svar.filter((r) => r.ok);
  assert.ok(ok.length >= 2, "minst två lådor ryms");
  const retur = ok.reduce((s, r) => s + (r.refund || 0), 0);
  const d = await sd();
  assert.equal(d.coins, 1200 - 500 * ok.length + retur);
  assert.ok(d.coins >= 0);
  const nya = ok.filter((r) => !r.duplicate).map((r) => r.item.id);
  assert.deepEqual([...d.ownedItems].sort(), [...nya].sort());
  for (const r of ok) assert.ok(MYSTERY_ITEMS.some((it) => it.id === r.item.id));
});

test("parallellt: värmelampan och gårdsuppgraderingen dras bara en gång", async () => {
  await som(ELEV);
  await satt({ coins: 5000, ownedItems: [], pets: [] });
  await Promise.all([kop("varmelampa"), kop("varmelampa"), kop("varmelampa"), kop("lada-2"), kop("lada-2"), kop("lada-2")]);
  const d = await sd();
  assert.equal(d.coins, 5000 - 120 - 450);
  assert.deepEqual(d.ownedItems, ["varmelampa"]);
  assert.equal(d.farm.barnLevel, 2);
});

test("hoppa över nivå / köpa samma nivå igen → inget dras", async () => {
  await som(ELEV);
  await satt({ coins: 2000, ownedItems: [] });
  assert.equal((await kop("odling-3")).ok, false);
  assert.equal((await kop("odling-2")).ok, true);
  assert.equal((await kop("odling-2")).ok, false);
  assert.equal((await kop("odling-3")).ok, true);
  assert.equal((await kop("odling-3")).ok, false);
  const d = await sd();
  assert.equal(d.coins, 2000 - 150 - 350);
  assert.equal(d.farm.gardenTier, 3);
});

test("trasiga fält: farm null / sträng, agdaDjur som lista – köpet går eller nekas, aldrig halvt", async () => {
  await som(ELEV);
  for (const farm of [null, "trasig", 5]) {
    await satt({ coins: 1000, ownedItems: [], farm });
    let r;
    const kod = await felkod(kop("animal_pig").then((x) => (r = x)));
    const d = await sd();
    if (kod === "ok" && r.ok) {
      assert.equal(d.coins, 820, `farm=${JSON.stringify(farm)}`);
      assert.equal(d.farm.animals.length, 1);
      assert.equal(d.agdaDjur[d.farm.animals[0].uid], "animal_pig");
    } else {
      assert.equal(d.coins, 1000, `nekat utan avdrag: farm=${JSON.stringify(farm)} kod=${kod}`);
    }
  }
  await satt({ coins: 1000, ownedItems: [], roomAnimals: [], agdaDjur: ["skräp"] });
  const r = await kop("hund");
  assert.equal(r.ok, true);
  const d = await sd();
  assert.deepEqual(d.agdaDjur, { [d.roomAnimals[0].uid]: "hund" });
  // En befintlig kartpost behålls när ett nytt djur köps.
  await satt({ coins: 1000, ownedItems: [], roomAnimals: [{ uid: "katt#x", id: "katt" }], agdaDjur: { "katt#x": "katt" } });
  await kop("hund");
  const e = await sd();
  assert.equal(e.agdaDjur["katt#x"], "katt");
  assert.equal(Object.keys(e.agdaDjur).length, 2);
});

test("äldre data: gammal pet och äldre djur i ownedItems följer med och tappas inte", async () => {
  await som(ELEV);
  const pet = { eggBoughtAt: 1700000000000, hatchedAt: 1700000500000, speciesId: "katt", stage: 2, feedCount: 3 };
  await satt({ coins: 1000, ownedItems: ["katt", "keps"], pet });
  const agg = await kop("mystery-egg");
  assert.equal(agg.ok, true);
  const hund = await kop("hund");
  assert.equal(hund.ok, true);
  const d = await sd();
  assert.equal(d.pets.length, 2, "gamla pet + nya ägget");
  assert.equal(d.pets[0].speciesId, "katt");
  assert.equal(d.pets[0].stage, 2);
  assert.deepEqual(d.roomAnimals.map((a) => a.id), ["katt", "hund"]);
  assert.equal(d.roomAnimals[0].uid, "katt");
  assert.equal(d.coins, 1000 - 200 - 160);
  // Köpen ger bara de NYA djuren en kartpost – resten är migreringens jobb.
  assert.deepEqual(Object.values(d.agdaDjur).sort(), ["hund", "mystery-egg"]);
});

test("säsong: halloweenUntil passerad → nekas, framtida → köps; inget config/season → nekas", async () => {
  await som(ELEV);
  await satt({ coins: 2000, ownedItems: [] });
  await adb.doc("config/season").set({ season: "host", halloween: true, halloweenUntil: admin.firestore.Timestamp.fromMillis(Date.now() - 60_000) });
  assert.equal((await kop("hw-av-spoke")).ok, false);
  await adb.doc("config/season").delete();
  assert.equal((await kop("hw-av-spoke")).ok, false);
  assert.equal((await kop("hw-djur-pumpis")).ok, false);
  await adb.doc("config/season").set({ season: "host", halloween: true, halloweenUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 3_600_000) });
  const av = await kop("hw-av-spoke");
  assert.deepEqual([av.ok, av.coins], [true, 1600]);
  await adb.doc("config/season").set({ season: "host", halloween: false });
  const d = await sd();
  assert.deepEqual(d.ownedItems, ["hw-av-spoke"]);
  assert.equal(d.coins, 1600);
});

// --- Migreringen mot emulatorn -------------------------------------------------

const MIG = ["t854m1", "t854m2", "t854m3", "t854m4"];
const migrera = (...args) =>
  execFileSync(process.execPath, [join(ROOT, "admin/migrera-mynt-las.mjs"), ...args], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, FIRESTORE_EMULATOR_HOST: FS_HOST, GCLOUD_PROJECT: PROJECT_ID },
  });
const attSkriva = (ut) => Number(/att skriva: (\d+)/.exec(ut)?.[1]);
const alla = async () => Object.fromEntries(await Promise.all(MIG.map(async (u) => [u, await sd(u)])));

test("migreringen: torrkörning skriver inget → --commit → ny torrkörning 0; saldo och varor orörda", async () => {
  const progress = { matte: { m1: { completed: true, stars: 3 }, m2: { completed: true, stars: 1 } } };
  await satt({
    coins: 777, progress, ownedItems: ["katt", "keps"], ownedCounts: { soffa: 2 },
    roomAnimals: [{ uid: "hund#a", id: "hund", pos: { x: 1, y: 2 } }, { id: "kanin" }],
    farm: { barnLevel: 2, animals: [{ uid: "animal_cow#1", id: "animal_cow" }, { uid: "hund#a", id: "animal_pig" }] },
    pet: { eggBoughtAt: 1700000000000, speciesId: "hund", stage: 1 },
  }, "t854m1");
  await satt({ coins: 5, xp: 40, roomAnimals: [{ uid: "r1", id: "hund" }], agdaDjur: { r1: "katt" } }, "t854m2");
  await satt({ coins: 9, xp: "x", pets: [{ id: "p1", eggSpecies: "spokis" }, { id: "p2" }, { id: "p1", eggSpecies: "pumpis" }] }, "t854m3");
  await satt({ coins: 3, xp: -4, agdaDjur: { p9: "mystery-egg" }, pets: [{ id: "p9", eggSpecies: "spokis" }] }, "t854m4");

  const fore = await alla();
  const torr = migrera();
  assert.ok(attSkriva(torr) >= 3, torr);
  assert.deepEqual(await alla(), fore, "torrkörningen skrev inget");

  const skarp = migrera("--commit");
  assert.match(skarp, /Klart: \d+ dokument uppdaterade/);
  const efter = await alla();
  for (const u of MIG) {
    for (const f of ["coins", "ownedItems", "ownedCounts"]) assert.deepEqual(efter[u][f], fore[u][f], `${u}.${f}`);
  }
  const m1 = efter.t854m1;
  const { xpFromProgress } = await import("../src/leveling.js");
  assert.equal(m1.xp, xpFromProgress(progress));
  assert.equal(m1.agdaDjur["hund#a"], "hund", "första listan (roomAnimals) vinner över farm.animals");
  assert.equal(m1.agdaDjur.kanin, "kanin", "roomAnimals-post utan uid → art-id");
  assert.equal(m1.agdaDjur.katt, "katt", "äldre djur ur ownedItems");
  assert.ok(m1.roomAnimals.some((a) => a.uid === "katt" && a.id === "katt"), "äldre djur inskrivet i roomAnimals");
  assert.equal(m1.agdaDjur["animal_cow#1"], "animal_cow");
  assert.equal(m1.pets.length, 1, "gamla pet → pets[0]");
  assert.equal(m1.agdaDjur[m1.pets[0].id], "mystery-egg");
  assert.equal(Object.keys(m1.agdaDjur).length, 5);
  assert.deepEqual(efter.t854m2, fore.t854m2, "redan migrerad – befintlig (felaktig) post skrivs aldrig över");
  assert.equal(efter.t854m3.xp, 0);
  assert.deepEqual(efter.t854m3.agdaDjur, { p1: "hw-djur-spokis", p2: "mystery-egg" }, "dubblett-id → första posten");
  assert.equal(efter.t854m4.xp, 0);
  assert.deepEqual(efter.t854m4.agdaDjur, { p9: "mystery-egg" }, "befintlig post orörd");

  const igen = migrera();
  assert.equal(attSkriva(igen), 0, igen);
  assert.match(igen, /\b0\s+xp härlett/);
  migrera("--commit");
  assert.deepEqual(await alla(), efter, "en andra --commit ändrar inget");
});
