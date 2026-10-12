// ============================================================================
// Hitta rätt! (#635): togglen "Skoltopplista / Gör till skolutmaning" –
// functions/hitta-ratt-egna.js sattTopplista (callable hittaRattSattTopplista),
// direkt mot Firestore-emulatorn med Admin SDK (som functions-hitta-ratt-egna).
//
//   PÅ: återuppbygger topplistan ur personbästa med rätt v (gammal version och
//       elever utanför packens klasser räknas inte), klass ur packens classIds,
//       ledare med scope
//   kapplopp: omgångar som sparas samtidigt som påslaget – inget går förlorat,
//       och återuppbyggnaden skriver aldrig över en nyare post
//   PÅ två gånger: idempotent, fyller bara på det som saknas
//   AV: topplistan och ledarna bort, personbästa kvar, katalogen följer med
//   radera med topplistan PÅ, fel ägare och ogiltig indata nekas
//
// Pack-id e-hrt… och uid hrt-* krockar inte med andra sviter. Körs av
// `npm run test:functions` (kör i en FÄRSK emulator).
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { submit, HrFel } from "../functions/hitta-ratt-core.js";
import { sparaPack, raderaPack, sattTopplista } from "../functions/hitta-ratt-egna.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `hr-topp-${process.pid}`);
const db = app.firestore();
const { FieldValue, FieldPath, Timestamp } = admin.firestore;
after(() => app.delete());

const ctl = { clock: Date.now() };
const deps = (nar) => ({ db, FieldValue, FieldPath, Timestamp, now: () => nar ?? ctl.clock });
const TIMME = 3_600_000;
const ID = "e-hrtpunkt0001";
const LARARE = "hrt-larare1";
const KATALOG = db.doc("hittaRattMeta/egnaPack");
const LEDARE = db.doc("hittaRattMeta/ledare");
const BOARD = db.doc(`hittaRattBoards/${ID}`);
const PACK = db.doc(`hittaRattPacks/${ID}`);

const ORTER = [["gavle", "Gävle", 60.6749, 17.1413], ["sandviken", "Sandviken", 60.6167, 16.7667], ["hofors", "Hofors", 60.55, 16.2833], ["ockelbo", "Ockelbo", 60.8917, 16.7167]];
const punktPack = (over = {}) => ({
  id: ID, title: "Gästrikland runt", type: "point", geo: "sverige-landskap", ikon: "🏞️", classIds: ["hrt5e"],
  items: ORTER.map(([id, name, lat, lon]) => ({ id, name, lat, lon })), ...over,
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
const spara = (pack = punktPack(), nar = ctl.clock - TIMME) => sparaPack(deps(nar), LARARE, { pack }, { namn: "Anna L" });
const toggla = (pa, uid = LARARE, packId = ID) => sattTopplista(deps(), uid, { packId, pa });
const hamta = async (ref) => ((s) => (s.exists ? s.data() : null))(await ref.get());

const ELEVER = [["hrt-omar", "Omar"], ["hrt-alma", "Alma"], ["hrt-sara", "Sara"], ["hrt-ute", "Ute"]];

async function rensa() {
  for (const c of ["hittaRattPacks", "hittaRattBoards", "hittaRattBest", "hittaRattAttempts"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("e-hrt") || d.id.startsWith("hrt") || String(d.data().uid || "").startsWith("hrt")).map((d) => d.ref.delete()));
  }
  await KATALOG.set({ packs: { [ID]: FieldValue.delete() } }, { merge: true });
  await LEDARE.set({ packs: { [ID]: FieldValue.delete() } }, { merge: true });
}

beforeEach(async () => {
  ctl.clock = Date.now();
  await rensa();
  // Omar går i 5A OCH 5E; packet delas bara med 5E → topplistan visar 5E.
  await db.doc("classes/hrt5a").set({ name: "5A", studentIds: ["hrt-omar"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrt5e").set({ name: "5E", studentIds: ["hrt-omar", "hrt-alma", "hrt-sara"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrt6c").set({ name: "6C", studentIds: ["hrt-ute"], enabledModules: ["hittaratt"] });
  for (const [uid, namn] of ELEVER) {
    await db.doc(`students/${uid}`).set({ namn });
    await db.doc(`studentData/${uid}`).set({ coins: 0 });
  }
});

let nr = 0;
async function forsok(uid, sekSedan = 600) {
  const id = `hrtatt${Date.now().toString(36)}${(nr++).toString(36)}`;
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId: ID, startedAt: Timestamp.fromMillis(ctl.clock - sekSedan * 1000), status: "open" });
  return id;
}
/** Punktsvar: alla exakt rätt, eller `km` (≈ grader·111) söderut. */
const svar = (fel = 0) => ORTER.map(([itemId, , lat, lon]) => ({ itemId, lat: lat - fel / 111, lon }));
const spela = async (uid, fel = 0) => submit(deps(), uid, { attemptId: await forsok(uid), svar: svar(fel) });

describe("sattTopplista PÅ", () => {
  it("återuppbygger topplistan ur personbästa med rätt v; ledare med scope; katalogen följer med", async () => {
    await spara();
    await spela("hrt-omar"); // 400 p
    await spela("hrt-alma", 50);
    // Sara hann spela version 1 – sedan flyttas en punkt (version 2) och Sara spelar inte om.
    await spela("hrt-sara");
    const flyttad = punktPack({ items: punktPack().items.map((i, n) => (n === 0 ? { ...i, lat: 60.7 } : i)) });
    await spara(flyttad, ctl.clock - TIMME / 2);
    await spela("hrt-omar", 40);
    await spela("hrt-alma", 15);
    // Ett personbästa i ett annat pack med samma v räknas inte.
    await db.doc("hittaRattBest/hrt-ute").set({ packs: { "e-hrtannat00001": { typ: "point", s: 999, v: 2 } } });
    assert.equal(await hamta(BOARD), null, "AV: ingen topplista");

    const r = await toggla(true);
    assert.deepEqual(r, { leaderboard: true, tillagda: 2 });
    assert.equal((await hamta(PACK)).leaderboard, true);
    assert.equal((await hamta(KATALOG)).packs[ID].leaderboard, true);
    const board = await hamta(BOARD);
    assert.equal(board.v, 2);
    assert.equal(board.max, 400);
    assert.deepEqual(Object.keys(board.entries).sort(), ["hrt-alma", "hrt-omar"], "Sara (version 1) är inte med");
    assert.equal(board.entries["hrt-omar"].k, "5E", "klass ur packens classIds");
    assert.equal(board.entries["hrt-omar"].n, "Omar");
    assert.ok(board.entries["hrt-alma"].s > board.entries["hrt-omar"].s);
    assert.deepEqual(board.leaders, ["hrt-alma"]);
    assert.deepEqual((await hamta(LEDARE)).packs[ID], { uids: ["hrt-alma"], titel: "Gästrikland runt", typ: "point", scope: "sverige" });

    // Nästa omgång efter påslaget går rakt in i topplistan.
    const ny = await spela("hrt-omar");
    assert.equal(ny.leaderboard, true);
    assert.equal(ny.top[0].n, "Omar");
    assert.deepEqual((await hamta(LEDARE)).packs[ID].uids, ["hrt-omar"]);
  });

  it("elever som inte längre går i packens klasser hoppas över; tomt = tom topplista utan ledare", async () => {
    await spara();
    await spela("hrt-alma");
    await db.doc("classes/hrt5e").update({ studentIds: ["hrt-omar", "hrt-sara"] }); // Alma har bytt klass
    assert.deepEqual(await toggla(true), { leaderboard: true, tillagda: 0 });
    const board = await hamta(BOARD);
    assert.deepEqual([board.entries, board.leaders, board.v], [{}, [], 1]);
    assert.equal((await hamta(LEDARE))?.packs?.[ID], undefined);
  });

  it("PÅ två gånger: idempotent och fyller bara på det som saknas", async () => {
    await spara();
    await spela("hrt-omar", 10);
    assert.equal((await toggla(true)).tillagda, 1);
    const forst = await hamta(BOARD);
    assert.deepEqual(await toggla(true), { leaderboard: true, tillagda: 0 });
    const igen = await hamta(BOARD);
    assert.deepEqual(igen.entries, forst.entries);
    assert.deepEqual(igen.leaders, ["hrt-omar"]);
    // Ett personbästa som saknas i listan (t.ex. sparat medan servern var nere) fylls på.
    await db.doc("hittaRattBest/hrt-sara").set({ packs: { [ID]: { typ: "point", s: 399, max: 400, n: 4, attempts: 1, at: 5, v: 1 } } });
    assert.equal((await toggla(true)).tillagda, 1);
    const b = await hamta(BOARD);
    assert.equal(b.entries["hrt-sara"].s, 399);
    assert.equal(b.entries["hrt-omar"].s, forst.entries["hrt-omar"].s, "befintlig post orörd");
    assert.deepEqual(b.leaders, ["hrt-sara"]);
  });

  it("kapplopp med submit: omgångar under påslaget går inte förlorade och skrivs aldrig över", async () => {
    await spara();
    await spela("hrt-omar", 30);
    await spela("hrt-alma", 30);
    const forsoken = await Promise.all(["hrt-omar", "hrt-alma", "hrt-sara"].map((uid) => forsok(uid)));
    const [, ...omgangar] = await Promise.all([
      toggla(true),
      submit(deps(), "hrt-omar", { attemptId: forsoken[0], svar: svar() }), // nytt rekord 400
      submit(deps(), "hrt-alma", { attemptId: forsoken[1], svar: svar(60) }), // sämre – rekordet står kvar
      submit(deps(), "hrt-sara", { attemptId: forsoken[2], svar: svar(15) }), // första omgången
    ]);
    assert.equal(omgangar[0].result.s, 400);
    const board = await hamta(BOARD);
    const best = async (uid) => (await hamta(db.doc(`hittaRattBest/${uid}`))).packs[ID];
    assert.deepEqual(Object.keys(board.entries).sort(), ["hrt-alma", "hrt-omar", "hrt-sara"]);
    for (const uid of ["hrt-omar", "hrt-alma", "hrt-sara"]) {
      assert.equal(board.entries[uid].s, (await best(uid)).s, `${uid}: topplistan = personbästa`);
    }
    assert.equal(board.entries["hrt-omar"].s, 400);
    assert.deepEqual(board.leaders, ["hrt-omar"]);
    assert.deepEqual((await hamta(LEDARE)).packs[ID].uids, ["hrt-omar"]);
  });

  it("ändrat facit mellan påslag och återuppbyggnad: inga gamla poster i den nya versionen", async () => {
    await spara();
    await spela("hrt-omar");
    await toggla(true);
    const flyttad = punktPack({ items: punktPack().items.map((i, n) => (n === 0 ? { ...i, lat: 60.7 } : i)) });
    await spara(flyttad, ctl.clock - TIMME / 2); // version 2, tom topplista med v 2
    assert.deepEqual(await toggla(true), { leaderboard: true, tillagda: 0 });
    const board = await hamta(BOARD);
    assert.deepEqual([board.v, board.entries], [2, {}]);
  });
});

describe("sattTopplista AV", () => {
  it("topplistan och ledarna bort, personbästa kvar, katalogen följer med; idempotent; PÅ igen återställer", async () => {
    await spara();
    await toggla(true);
    await spela("hrt-omar");
    await spela("hrt-alma", 40);
    assert.ok((await hamta(LEDARE)).packs[ID]);
    assert.deepEqual(await toggla(false), { leaderboard: false, tillagda: 0 });
    assert.equal(await hamta(BOARD), null);
    assert.equal((await hamta(LEDARE)).packs?.[ID], undefined, "pokalen försvinner");
    assert.equal((await hamta(PACK)).leaderboard, false);
    assert.equal((await hamta(KATALOG)).packs[ID].leaderboard, false);
    assert.equal((await hamta(db.doc("hittaRattBest/hrt-omar"))).packs[ID].s, 400, "personbästa kvar");
    assert.deepEqual(await toggla(false), { leaderboard: false, tillagda: 0 });

    // AV: nya omgångar skriver personbästa men ingen topplista.
    const r = await spela("hrt-sara", 10);
    assert.equal(r.leaderboard, false);
    assert.equal(await hamta(BOARD), null);

    // PÅ igen: alla tre ur personbästa.
    assert.equal((await toggla(true)).tillagda, 3);
    assert.deepEqual((await hamta(LEDARE)).packs[ID].uids, ["hrt-omar"]);
  });
});

describe("behörighet och radering", () => {
  it("fel ägare, okänt pack och ogiltig indata nekas – inget ändras", async () => {
    await spara();
    assert.match(await code(toggla(true, "hrt-larare2")), /^permission-denied/);
    assert.match(await code(toggla(false, "hrt-larare2")), /^permission-denied/);
    assert.equal((await hamta(PACK)).leaderboard, false);
    assert.equal(await hamta(BOARD), null);
    assert.match(await code(toggla(true, LARARE, "e-hrtfinnsinte")), /^not-found/);
    assert.match(await code(toggla(true, LARARE, "sverige-stader")), /^invalid-argument/);
    assert.match(await code(sattTopplista(deps(), LARARE, { packId: ID, pa: "ja" })), /^invalid-argument/);
    assert.match(await code(sattTopplista(deps(), LARARE, {})), /^invalid-argument/);
  });

  it("radera med topplistan PÅ tar bort topplista och ledare; sparaPack rör inte togglen", async () => {
    await spara();
    await toggla(true);
    await spela("hrt-omar");
    await spara(punktPack({ title: "Gästrikland!", leaderboard: false }));
    assert.equal((await hamta(PACK)).leaderboard, true, "leaderboard i sparaPack ignoreras");
    assert.equal((await hamta(LEDARE)).packs[ID].titel, "Gästrikland!");
    assert.deepEqual(await raderaPack(deps(), LARARE, { packId: ID }), { fanns: true });
    assert.equal(await hamta(BOARD), null);
    assert.equal((await hamta(LEDARE)).packs?.[ID], undefined);
    assert.equal((await hamta(KATALOG)).packs?.[ID], undefined);
    assert.match(await code(toggla(true)), /^not-found/);
  });
});
