// ============================================================================
// Hitta rätt! (#633): lärarens EGNA pack på servern – functions/hitta-ratt-egna.js
// (sparaPack, raderaPack) och hittaRattSubmit för e-pack, direkt mot
// Firestore-emulatorn med Admin SDK och styrd klocka (som functions-hitta-ratt-core).
//
//   spara: nytt + befintligt, fel ägare, låst geo/typ, okänd klass, katalogtak,
//          ändrad facit → version + 1 och nollställd topplista/ledare (tom
//          topplista med v om den är PÅ), ändrad titel följer med, katalogen
//   radera: allt bort i en transaktion, fel ägare, idempotent
//   submit: klass nekad, borttaget pack, ändrad karta, v på personbästa
//          (gammal version = saknat), AV skriver personbästa men ingen
//          topplista, PÅ → klass ur packens classIds + scope i ledarna
//
// Pack-id e-hrg… och uid hrg-* krockar inte med andra sviter. Körs av
// `npm run test:functions` (kör i en FÄRSK emulator).
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { submit, HrFel } from "../functions/hitta-ratt-core.js";
import { sparaPack, raderaPack } from "../functions/hitta-ratt-egna.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `hr-egna-${process.pid}`);
const db = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

const ctl = { clock: Date.now() };
const deps = (nar) => ({ db, FieldValue, Timestamp, now: () => nar ?? ctl.clock });
const TIMME = 3_600_000;
const ID = "e-hrgpunkt0001";
const ID2 = "e-hrgomrade001";
const KATALOG = db.doc("hittaRattMeta/egnaPack");
const LEDARE = db.doc("hittaRattMeta/ledare");

const ORTER = [["gavle", "Gävle", 60.6749, 17.1413], ["sandviken", "Sandviken", 60.6167, 16.7667], ["hofors", "Hofors", 60.55, 16.2833], ["ockelbo", "Ockelbo", 60.8917, 16.7167]];
const punktPack = (over = {}) => ({
  id: ID, title: "Gästrikland runt", type: "point", geo: "sverige-landskap", ikon: "🏞️", classIds: ["hrg5e"],
  items: ORTER.map(([id, name, lat, lon]) => ({ id, name, lat, lon })), ...over,
});
const omradePack = (over = {}) => ({
  id: ID2, title: "Några landskap", type: "area", geo: "sverige-landskap", classIds: ["hrg5e"],
  items: [{ id: "uppland", name: "Uppland", omrade: "o5" }, { id: "skane", name: "Skåne", omrade: "o9" }], ...over,
});

const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof HrFel, `HrFel väntades, fick ${e?.stack || e}`);
    return `${e.code}: ${e.message}`;
  }
  return "ok";
};
/** Spara som `uid` – som standard en timme bakåt, så att försök (startade 10 min sedan) är nyare än facitAt. */
const spara = (uid, pack, nar = ctl.clock - TIMME) => sparaPack(deps(nar), uid, { pack }, { namn: "Anna L" });
const hamta = async (ref) => ((s) => (s.exists ? s.data() : null))(await ref.get());

async function rensa() {
  for (const c of ["hittaRattPacks", "hittaRattBoards", "hittaRattBest", "hittaRattAttempts"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("e-hrg") || d.id.startsWith("hrg") || String(d.data().uid || "").startsWith("hrg")).map((d) => d.ref.delete()));
  }
  await KATALOG.delete();
  await LEDARE.set({ packs: { [ID]: FieldValue.delete(), [ID2]: FieldValue.delete() } }, { merge: true });
}

beforeEach(async () => {
  ctl.clock = Date.now();
  await rensa();
  // hrg-omar går i 5A OCH 5E; packet delas bara med 5E → topplistan visar 5E.
  await db.doc("classes/hrg5a").set({ name: "5A", studentIds: ["hrg-omar"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrg5e").set({ name: "5E", studentIds: ["hrg-omar", "hrg-alma"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrg6c").set({ name: "6C", studentIds: ["hrg-ute"], enabledModules: ["hittaratt"] });
  for (const [uid, namn] of [["hrg-omar", "Omar"], ["hrg-alma", "Alma"], ["hrg-ute", "Ute"]]) {
    await db.doc(`students/${uid}`).set({ namn });
    await db.doc(`studentData/${uid}`).set({ coins: 10 });
  }
});

let nr = 0;
async function forsok(uid, packId, sekSedan = 600) {
  const id = `hrgatt${Date.now().toString(36)}${(nr++).toString(36)}`;
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId, startedAt: Timestamp.fromMillis(ctl.clock - sekSedan * 1000), status: "open" });
  return id;
}
/** Punktsvar: alla exakt rätt, eller `km` (≈ grader·111) söderut. */
const svar = (fel = 0) => ORTER.map(([itemId, , lat, lon]) => ({ itemId, lat: lat - fel / 111, lon }));
const spela = async (uid, fel = 0, packId = ID) => submit(deps(), uid, { attemptId: await forsok(uid, packId), svar: svar(fel) });
const slaPaTopplista = async (id = ID) => {
  // D bygger callablen hittaRattSattTopplista – här sätts flaggan direkt.
  await db.doc(`hittaRattPacks/${id}`).update({ leaderboard: true });
};

describe("sparaPack", () => {
  it("nytt pack: ägare, version 1, härledda fält, katalogpost", async () => {
    const r = await spara("hrg-larare1", punktPack());
    assert.deepEqual(r, { id: ID, version: 1, nollstalld: false });
    const p = await hamta(db.doc(`hittaRattPacks/${ID}`));
    assert.equal(p.ownerUid, "hrg-larare1");
    assert.equal(p.ownerNamn, "Anna L");
    assert.equal(p.leaderboard, false);
    assert.equal(p.category, "egna");
    assert.deepEqual(p.scoringConfig, { fullKm: 5, halvKm: 90 });
    assert.match(p.facitNyckel, /^[0-9a-f]{40}$/);
    assert.equal(p.facitAt.toMillis(), ctl.clock - TIMME);
    const k = (await hamta(KATALOG)).packs[ID];
    assert.equal(k.title, "Gästrikland runt");
    assert.equal(k.antal, 4);
    assert.deepEqual(k.classIds, ["hrg5e"]);
    assert.equal(k.version, 1);
    assert.equal(k.leaderboard, false);
    assert.equal(k.ownerUid, "hrg-larare1");
  });

  it("leaderboard i indata ignoreras; okänd klass och ogiltig indata nekas", async () => {
    await spara("hrg-larare1", punktPack({ leaderboard: true }));
    assert.equal((await hamta(db.doc(`hittaRattPacks/${ID}`))).leaderboard, false);
    assert.match(await code(spara("hrg-larare1", punktPack({ classIds: ["hrg5e", "finnsinte"] }))), /^invalid-argument: En av klasserna/);
    assert.match(await code(spara("hrg-larare1", punktPack({ items: [] }))), /^invalid-argument/);
    assert.match(await code(sparaPack(deps(), "hrg-larare1", {})), /^invalid-argument/);
  });

  it("befintligt pack, bara texter/klasser ändrade: samma version, titeln följer med till topplista och ledare", async () => {
    await spara("hrg-larare1", punktPack());
    await slaPaTopplista();
    await spela("hrg-omar");
    const r = await spara("hrg-larare1", punktPack({ title: "Gästrikland!", description: "ny", classIds: ["hrg5e", "hrg5a"] }));
    assert.deepEqual(r, { id: ID, version: 1, nollstalld: false });
    const p = await hamta(db.doc(`hittaRattPacks/${ID}`));
    assert.equal(p.leaderboard, true, "togglen bevaras");
    assert.equal(p.facitAt.toMillis(), ctl.clock - TIMME, "facitAt oförändrad");
    const board = await hamta(db.doc(`hittaRattBoards/${ID}`));
    assert.equal(board.titel, "Gästrikland!");
    assert.ok(board.entries["hrg-omar"], "topplistan ligger kvar");
    assert.equal((await hamta(LEDARE)).packs[ID].titel, "Gästrikland!");
    assert.deepEqual((await hamta(LEDARE)).packs[ID].uids, ["hrg-omar"]);
    assert.deepEqual((await hamta(KATALOG)).packs[ID].classIds, ["hrg5a", "hrg5e"]);
  });

  it("fel ägare nekas; geo och typ är låsta", async () => {
    await spara("hrg-larare1", punktPack());
    assert.match(await code(spara("hrg-larare2", punktPack({ title: "Kapad" }))), /^permission-denied/);
    assert.match(await code(spara("hrg-larare1", punktPack({ geo: "europa" }))), /^failed-precondition: Kartan och frågetypen/);
    assert.match(await code(spara("hrg-larare1", { ...omradePack(), id: ID })), /^failed-precondition/);
    assert.equal((await hamta(db.doc(`hittaRattPacks/${ID}`))).title, "Gästrikland runt", "inget ändrades");
  });

  it("ändrad facit: version + 1, topplista och ledare nollställs (tom topplista med v när PÅ)", async () => {
    await spara("hrg-larare1", punktPack());
    await slaPaTopplista();
    await spela("hrg-omar");
    assert.ok((await hamta(LEDARE)).packs[ID]);
    const flyttad = punktPack({ items: punktPack().items.map((i, n) => (n === 0 ? { ...i, lat: 60.7 } : i)) });
    const r = await spara("hrg-larare1", flyttad, ctl.clock - TIMME / 2);
    assert.deepEqual(r, { id: ID, version: 2, nollstalld: true });
    const p = await hamta(db.doc(`hittaRattPacks/${ID}`));
    assert.equal(p.facitAt.toMillis(), ctl.clock - TIMME / 2);
    const board = await hamta(db.doc(`hittaRattBoards/${ID}`));
    assert.deepEqual({ v: board.v, entries: board.entries, leaders: board.leaders, max: board.max }, { v: 2, entries: {}, leaders: [], max: 400 });
    assert.equal((await hamta(LEDARE)).packs?.[ID], undefined, "pokalen försvinner");
    assert.equal((await hamta(KATALOG)).packs[ID].version, 2);
    // Topplista AV: topplistan raderas i stället.
    await db.doc(`hittaRattPacks/${ID}`).update({ leaderboard: false });
    await spara("hrg-larare1", punktPack({ items: punktPack().items.slice(1) }));
    assert.equal(await hamta(db.doc(`hittaRattBoards/${ID}`)), null);
    assert.equal((await hamta(db.doc(`hittaRattPacks/${ID}`))).version, 3);
  });

  it("katalogen: två pack, och nya pack nekas när katalogen passerat 800 kB", async () => {
    await spara("hrg-larare1", punktPack());
    await spara("hrg-larare2", omradePack());
    const k = (await hamta(KATALOG)).packs;
    assert.deepEqual(Object.keys(k).sort(), [ID2, ID]);
    assert.equal(k[ID2].type, "area");
    await KATALOG.set({ packs: { "e-hrgfyllnad1": { title: "x".repeat(810_000) } } }, { merge: true });
    assert.match(await code(spara("hrg-larare1", punktPack({ id: "e-hrgnytt00001" }))), /^resource-exhausted/);
    assert.equal(await code(spara("hrg-larare1", punktPack({ title: "Befintligt går bra" }))), "ok");
  });
});

describe("raderaPack", () => {
  it("packen, katalogposten, topplistan och ledarna försvinner; fel ägare nekas; idempotent", async () => {
    await spara("hrg-larare1", punktPack());
    await spara("hrg-larare1", omradePack());
    await slaPaTopplista();
    await spela("hrg-omar");
    assert.match(await code(raderaPack(deps(), "hrg-larare2", { packId: ID })), /^permission-denied/);
    assert.deepEqual(await raderaPack(deps(), "hrg-larare1", { packId: ID }), { fanns: true });
    assert.equal(await hamta(db.doc(`hittaRattPacks/${ID}`)), null);
    assert.equal(await hamta(db.doc(`hittaRattBoards/${ID}`)), null);
    assert.equal((await hamta(LEDARE)).packs?.[ID], undefined);
    const k = (await hamta(KATALOG)).packs;
    assert.equal(k[ID], undefined);
    assert.ok(k[ID2], "andra pack orörda");
    assert.ok((await hamta(db.doc("hittaRattBest/hrg-omar"))).packs[ID], "personbästa ligger kvar (ofarligt)");
    assert.deepEqual(await raderaPack(deps(), "hrg-larare1", { packId: ID }), { fanns: false });
    assert.match(await code(raderaPack(deps(), "hrg-larare1", { packId: "sverige-stader" })), /^invalid-argument/);
  });
});

describe("hittaRattSubmit för egna pack", () => {
  it("AV: personbästa med v och coins, men ingen topplista eller ledare", async () => {
    await spara("hrg-larare1", punktPack());
    const r = await spela("hrg-omar");
    assert.equal(r.leaderboard, false);
    assert.equal(r.result.s, 400);
    assert.equal(r.coins, 4);
    assert.deepEqual(r.top, []);
    const pb = (await hamta(db.doc("hittaRattBest/hrg-omar"))).packs[ID];
    assert.equal(pb.v, 1);
    assert.equal(pb.s, 400);
    assert.equal(await hamta(db.doc(`hittaRattBoards/${ID}`)), null);
    assert.equal((await hamta(LEDARE))?.packs?.[ID], undefined);
    assert.equal((await hamta(db.doc("studentData/hrg-omar"))).coins, 14);
  });

  it("PÅ: klassen ur packens classIds (5E, inte 5A), v i topplistan, scope i ledarna", async () => {
    await spara("hrg-larare1", punktPack());
    await slaPaTopplista();
    const r = await spela("hrg-omar");
    assert.equal(r.leaderboard, true);
    assert.equal(r.top[0].k, "5E");
    const board = await hamta(db.doc(`hittaRattBoards/${ID}`));
    assert.equal(board.v, 1);
    assert.equal(board.entries["hrg-omar"].k, "5E");
    assert.deepEqual((await hamta(LEDARE)).packs[ID], { uids: ["hrg-omar"], titel: "Gästrikland runt", typ: "point", scope: "sverige" });
  });

  it("elev i en klass som packet inte delas med nekas; borttaget pack = not-found", async () => {
    await spara("hrg-larare1", punktPack());
    assert.match(await code(spela("hrg-ute")), /^permission-denied: Kartan är inte delad med din klass/);
    const a = await forsok("hrg-alma", ID);
    await raderaPack(deps(), "hrg-larare1", { packId: ID });
    assert.match(await code(submit(deps(), "hrg-alma", { attemptId: a, svar: svar() })), /^not-found: Kartan finns inte längre/);
  });

  it("ändrad karta under omgången → failed-precondition innan rättningen; ny omgång går bra", async () => {
    await spara("hrg-larare1", punktPack());
    const a = await forsok("hrg-alma", ID, 600);
    const ny = punktPack({ items: [...punktPack().items, { id: "storvik", name: "Storvik", lat: 60.5833, lon: 16.5333 }] });
    await spara("hrg-larare1", ny, ctl.clock - 60_000); // läraren sparar 1 min sedan
    assert.match(await code(submit(deps(), "hrg-alma", { attemptId: a, svar: svar() })), /^failed-precondition: Läraren har ändrat kartan/);
    const b = await forsok("hrg-alma", ID, 30);
    const r = await submit(deps(), "hrg-alma", { attemptId: b, svar: [...svar(), { itemId: "storvik", lat: 60.5833, lon: 16.5333 }] });
    assert.equal(r.result.n, 5);
    assert.equal(r.pb.v, 2);
  });

  it("v: personbästa från en gammal version räknas som saknat; topplistans nya version börjar om", async () => {
    await spara("hrg-larare1", punktPack());
    await slaPaTopplista();
    await spela("hrg-omar"); // 400 p på version 1
    await spela("hrg-alma", 50);
    const flyttad = punktPack({ items: punktPack().items.map((i, n) => (n === 0 ? { ...i, lat: 60.7 } : i)) });
    await spara("hrg-larare1", flyttad, ctl.clock - TIMME / 2);
    const r = await spela("hrg-omar", 50); // sämre än förut – men första på version 2
    assert.equal(r.nyttRekord, true);
    assert.equal(r.pb.v, 2);
    assert.equal(r.pb.attempts, 1);
    assert.ok(r.pb.s < 400);
    const board = await hamta(db.doc(`hittaRattBoards/${ID}`));
    assert.deepEqual(Object.keys(board.entries), ["hrg-omar"], "Alma (version 1) är borta");
    assert.equal(board.v, 2);
    // Ett sämre försök på samma version ökar bara attempts.
    const igen = await spela("hrg-omar", 50);
    assert.equal(igen.nyttRekord, false);
    assert.equal(igen.pb.attempts, 2);
  });

  it("försvarsrad: en topplista med fel v räknas som tom och skrivs om", async () => {
    await spara("hrg-larare1", punktPack());
    await slaPaTopplista();
    await db.doc(`hittaRattBoards/${ID}`).set({ packId: ID, typ: "point", v: 9, entries: { "hrg-gammal": { n: "Gammal", k: "5E", s: 999 } }, leaders: ["hrg-gammal"] });
    await spela("hrg-alma", 50);
    const board = await hamta(db.doc(`hittaRattBoards/${ID}`));
    assert.deepEqual(Object.keys(board.entries), ["hrg-alma"]);
    assert.equal(board.v, 1);
    assert.deepEqual(board.leaders, ["hrg-alma"]);
  });

  it("områdespack via hittaRattPacks rättas som officiella", async () => {
    await spara("hrg-larare1", omradePack());
    const a = await forsok("hrg-alma", ID2);
    const r = await submit(deps(), "hrg-alma", { attemptId: a, svar: [{ itemId: "uppland", omrade: "o5", ms: 4000 }, { itemId: "skane", omrade: "o1", ms: 3000 }] });
    assert.deepEqual([r.result.r, r.result.max, r.result.t], [1, 2, 70]);
    assert.match(await code(submit(deps(), "hrg-alma", { attemptId: await forsok("hrg-alma", ID2), svar: [{ itemId: "uppland", omrade: "o999", ms: 4000 }, { itemId: "skane", omrade: "o9", ms: 3000 }] })), /^invalid-argument: Okänt område/);
  });
});
