// ============================================================================
// Hitta rätt! (#609): SERVERKÄRNAN (functions/hitta-ratt-core.js) direkt mot
// Firestore-emulatorn – Admin SDK och styrd klocka, så personbästa, topplista,
// ledare, coins och varje attack går att testa exakt. Callable-lagret
// (inloggning, regler, HttpsError) testas i functions-hitta-ratt.test.mjs.
//
//   test 3   två elever med samma poäng delar plats 1 (och båda leder)
//   test 5   44/44 1:39 före 44/44 1:45; 43/44 1:00 efter båda
//   test 6   ett sämre försök skriver aldrig över personbästat
//   test 10  Top 15 + egen rad i svaret
//   + coins/idempotens, ledarbyte, falsk tid, halv omgång, annans försök,
//     klass utan Hitta rätt!, namn/klass ur servern, taBortElev
//
// Egna pack-id (hrk-*) och uid:er (hrk-*) – krockar inte med e2e-testet som
// kör parallellt mot samma emulator. Körs av `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { submit, taBortElev, HrFel } from "../functions/hitta-ratt-core.js";
import { PACKS } from "../functions/hitta-ratt/packs.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `hr-core-${process.pid}`);
const db = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

// Riktiga facit under egna id:n: 20 städer (punkt) och 25 landskap (område).
const PUNKT = { ...PACKS["sverige-stader"], id: "hrk-punkt", titel: "Testpunkt" };
const OMR = { ...PACKS["sverige-landskap"], id: "hrk-omrade", titel: "Testområde" };
const UTAN = { ...PACKS["sverige-stader"], id: "hrk-utan", leaderboard: false };
const packs = { [PUNKT.id]: PUNKT, [OMR.id]: OMR, [UTAN.id]: UTAN };
const ctl = { clock: Date.now() };
const deps = { db, FieldValue, Timestamp, now: () => ctl.clock, packs };

const ELEVER = { "hrk-omar": ["Omar", "hrk5e"], "hrk-clara": ["Clara", "hrk5a"], "hrk-alma": ["Alma", "hrk5e"], "hrk-deniz": ["Deniz", "hrk5e"], "hrk-rasmus": ["Rasmus", "hrk5a"], "hrk-ute": ["Ute", "hrk6c"] };
let nr = 0;
const att = () => `hrkatt${Date.now().toString(36)}${(nr++).toString(36)}`;
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof HrFel, `HrFel väntades, fick ${e?.stack || e}`);
    return e.code;
  }
  return "ok";
};

async function rensa() {
  for (const c of ["hittaRattBoards", "hittaRattBest", "hittaRattAttempts"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("hrk") || String(d.data().uid || "").startsWith("hrk")).map((d) => d.ref.delete()));
  }
  await db.doc("hittaRattMeta/ledare").set({ packs: { [PUNKT.id]: FieldValue.delete(), [OMR.id]: FieldValue.delete() } }, { merge: true });
}

beforeEach(async () => {
  ctl.clock = Date.now();
  await rensa();
  await db.doc("classes/hrk5e").set({ name: "5E", studentIds: ["hrk-omar", "hrk-alma", "hrk-deniz"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrk5a").set({ name: "5A", studentIds: ["hrk-clara", "hrk-rasmus"], enabledModules: ["hittaratt"] });
  await db.doc("classes/hrk6c").set({ name: "6C", studentIds: ["hrk-ute"] }); // Hitta rätt! inte aktiverad
  for (const [uid, [namn]] of Object.entries(ELEVER)) {
    await db.doc(`students/${uid}`).set({ namn });
    await db.doc(`studentData/${uid}`).set({ coins: 10 });
  }
});

/** Ett öppet försök som startade `sekSedan` sekunder sedan. */
async function forsok(uid, packId, sekSedan = 600) {
  const id = att();
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId, startedAt: Timestamp.fromMillis(ctl.clock - sekSedan * 1000), status: "open" });
  return id;
}

/** Punktsvar: de `exakta` första frågorna exakt rätt, resten ~`km` söderut. */
function punktSvar(exakta, kmFel = 0) {
  return PUNKT.items.map((it, i) => ({ itemId: it.id, lon: it.lon, lat: i < exakta ? it.lat : it.lat - kmFel / 111.2 }));
}
/** Områdessvar: `ratt` rätt, totalt `tiondelar` aktiv tid. */
function omrSvar(ratt, tiondelar) {
  const n = OMR.items.length;
  const per = Math.floor((tiondelar * 100) / n);
  return OMR.items.map((it, i) => ({
    itemId: it.id,
    omrade: i < ratt ? it.omrade : OMR.omraden.find((o) => o !== it.omrade),
    ms: per + (i === 0 ? tiondelar * 100 - per * n : 0),
  }));
}
const spela = async (uid, pack, svar) => submit(deps, uid, { attemptId: await forsok(uid, pack.id), svar });
const board = async (id) => (await db.doc(`hittaRattBoards/${id}`).get()).data();
const best = async (uid) => (await db.doc(`hittaRattBest/${uid}`).get()).data()?.packs || {};
const coins = async (uid) => (await db.doc(`studentData/${uid}`).get()).data().coins;
const meta = async (id) => (await db.doc("hittaRattMeta/ledare").get()).data()?.packs?.[id];

describe("Hitta rätt! – topplista, personbästa och ledare på servern", () => {
  it("test 3: lika totalpoäng → delad plats 1, båda leder; namn + klass från servern", async () => {
    const o = await spela("hrk-omar", PUNKT, punktSvar(18, 40));
    const c = await spela("hrk-clara", PUNKT, punktSvar(18, 40));
    const a = await spela("hrk-alma", PUNKT, punktSvar(17, 40));
    assert.equal(o.result.s, c.result.s);
    assert.ok(a.result.s < o.result.s);
    assert.deepEqual(a.top.map((r) => [r.n, r.k, r.plats]), [["Clara", "5A", 1], ["Omar", "5E", 1], ["Alma", "5E", 2]]);
    assert.ok(a.top.every((r) => !("t" in r)), "ingen tid på punktlistan");
    const b = await board(PUNKT.id);
    assert.deepEqual(b.leaders, ["hrk-clara", "hrk-omar"]);
    assert.deepEqual((await meta(PUNKT.id)).uids, ["hrk-clara", "hrk-omar"]);
    assert.equal(b.entries["hrk-omar"].k, "5E");
  });

  it("test 5: 44/44-regeln – fler rätt först, tid bara vid lika", async () => {
    const n = OMR.items.length;
    await spela("hrk-alma", OMR, omrSvar(n, 1050)); // A: alla rätt 1:45
    await spela("hrk-omar", OMR, omrSvar(n, 990)); // B: alla rätt 1:39
    const c = await spela("hrk-clara", OMR, omrSvar(n - 1, 600)); // C: en fel 1:00
    assert.deepEqual(c.top.map((r) => [r.n, r.r, r.t, r.plats]), [["Omar", n, 990, 1], ["Alma", n, 1050, 2], ["Clara", n - 1, 600, 3]]);
    assert.equal(c.plats, 3);
    assert.deepEqual((await meta(OMR.id)).uids, ["hrk-omar"]);
  });

  it("test 6: sämre försök → rekordet ligger kvar (punkt och område); bättre ersätter", async () => {
    const bra = await spela("hrk-deniz", PUNKT, punktSvar(20));
    assert.equal(bra.nyttRekord, true);
    const samre = await spela("hrk-deniz", PUNKT, punktSvar(5, 60));
    assert.equal(samre.nyttRekord, false);
    assert.equal(samre.pb.s, bra.result.s);
    assert.equal(samre.pb.attempts, 2);
    assert.equal((await board(PUNKT.id)).entries["hrk-deniz"].s, bra.result.s);
    const n = OMR.items.length;
    await spela("hrk-deniz", OMR, omrSvar(n - 1, 900));
    const snabbFel = await spela("hrk-deniz", OMR, omrSvar(n - 2, 200)); // snabbare men färre rätt
    assert.equal(snabbFel.nyttRekord, false);
    const lika = await spela("hrk-deniz", OMR, omrSvar(n - 1, 900)); // exakt lika
    assert.equal(lika.nyttRekord, false);
    const battre = await spela("hrk-deniz", OMR, omrSvar(n - 1, 850));
    assert.equal(battre.nyttRekord, true);
    const pb = (await best("hrk-deniz"))[OMR.id];
    assert.deepEqual([pb.r, pb.t, pb.attempts], [n - 1, 850, 4]);
  });

  it("test 10: Top 15 + egen rad (37:e plats) i svaret – och ingen dubbelrad i Top 15", async () => {
    const entries = {};
    for (let i = 0; i < 36; i++) entries[`hrk-x${i}`] = { n: `X${i}`, k: "5B", s: 2000 - i, at: 1 };
    await db.doc(`hittaRattBoards/${PUNKT.id}`).set({ packId: PUNKT.id, typ: "point", entries, leaders: ["hrk-x0"] });
    const r = await spela("hrk-rasmus", PUNKT, punktSvar(10, 60));
    assert.equal(r.top.length, 15);
    assert.deepEqual([r.egen.plats, r.egen.n, r.egen.k, r.egen.jag], [37, "Rasmus", "5A", true]);
    assert.equal(r.plats, 37);
    assert.equal(r.antal, 37);
    const topp = await spela("hrk-omar", PUNKT, punktSvar(20));
    assert.equal(topp.egen, null);
    assert.equal(topp.top.filter((x) => x.jag).length, 1);
  });

  it("coins = godkända svar; omförsök med samma attemptId → samma svar, 0 nya coins", async () => {
    const id = await forsok("hrk-alma", PUNKT.id);
    const svar = punktSvar(15, 2000); // 15 exakta, 5 långt bort (0 p)
    const r1 = await submit(deps, "hrk-alma", { attemptId: id, svar });
    assert.deepEqual([r1.result.godkanda, r1.coins], [15, 15]);
    assert.equal(await coins("hrk-alma"), 25);
    const r2 = await submit(deps, "hrk-alma", { attemptId: id, svar: punktSvar(20) });
    assert.deepEqual([r2.coins, r2.result.s, r2.nyttRekord], [0, r1.result.s, true]);
    assert.equal(await coins("hrk-alma"), 25, "inga dubbla coins");
    assert.equal((await best("hrk-alma"))[PUNKT.id].attempts, 1);
  });

  it("ledarbyte: pokalen flyttas till den nya ettan", async () => {
    await spela("hrk-alma", PUNKT, punktSvar(18, 40));
    assert.deepEqual((await meta(PUNKT.id)).uids, ["hrk-alma"]);
    await spela("hrk-clara", PUNKT, punktSvar(20));
    assert.deepEqual((await meta(PUNKT.id)).uids, ["hrk-clara"]);
  });

  it("pack utan topplista: personbästa + coins, men ingen topplista", async () => {
    const r = await spela("hrk-alma", UTAN, punktSvar(20));
    assert.deepEqual([r.leaderboard, r.top.length, r.coins], [false, 0, 20]);
    assert.equal((await db.doc(`hittaRattBoards/${UTAN.id}`).get()).exists, false);
    assert.equal((await best("hrk-alma"))[UTAN.id].s, 2000);
  });
});

describe("Hitta rätt! – attacker mot functionen", () => {
  it("annans försök, okänt försök, klass utan Hitta rätt! nekas", async () => {
    const id = await forsok("hrk-omar", PUNKT.id);
    assert.equal(await code(submit(deps, "hrk-alma", { attemptId: id, svar: punktSvar(20) })), "permission-denied");
    assert.equal(await code(submit(deps, "hrk-alma", { attemptId: "finnsInte123", svar: punktSvar(20) })), "not-found");
    assert.equal(await code(spela("hrk-ute", PUNKT, punktSvar(20))), "permission-denied");
    await db.doc("classes/hrk5a").set({ hiddenModules: ["hittaratt"] }, { merge: true });
    assert.equal(await code(spela("hrk-clara", PUNKT, punktSvar(20))), "permission-denied", "dold i klassen");
    assert.equal(await code(submit(deps, "hrk-alma", { attemptId: "x", svar: [] })), "invalid-argument");
  });

  it("påhittad poäng/klass/namn i anropet ignoreras – servern räknar och läser själv", async () => {
    const id = await forsok("hrk-alma", PUNKT.id);
    const r = await submit(deps, "hrk-alma", { attemptId: id, svar: punktSvar(0, 2000), s: 2000, total: 2000, k: "9Z", n: "Omar", uid: "hrk-omar" });
    assert.equal(r.result.s, 0);
    const e = (await board(PUNKT.id)).entries;
    assert.deepEqual([e["hrk-alma"].n, e["hrk-alma"].k, e["hrk-alma"].s], ["Alma", "5E", 0]);
    assert.equal(e["hrk-omar"], undefined, "kan inte skriva någon annans rad");
  });

  it("sänka någon annans rekord går inte – bara anroparens rad skrivs", async () => {
    await spela("hrk-omar", PUNKT, punktSvar(20));
    await spela("hrk-alma", PUNKT, punktSvar(0, 2000));
    assert.equal((await board(PUNKT.id)).entries["hrk-omar"].s, 2000);
  });

  it("halv omgång, dubbla svar, för snabba/falska tider, för gammalt försök nekas – och försöket förblir öppet", async () => {
    assert.equal(await code(spela("hrk-alma", PUNKT, punktSvar(20).slice(0, 10))), "invalid-argument");
    const s = punktSvar(20);
    s[1] = { ...s[0] };
    assert.equal(await code(spela("hrk-alma", PUNKT, s)), "invalid-argument");
    const n = OMR.items.length;
    const id = await forsok("hrk-alma", OMR.id, 30); // startade för 30 s sedan
    assert.equal(await code(submit(deps, "hrk-alma", { attemptId: id, svar: omrSvar(n, 990) })), "failed-precondition", "99 s aktiv tid på 30 s");
    assert.equal((await db.doc(`hittaRattAttempts/${id}`).get()).data().status, "open");
    assert.equal(await code(spela("hrk-alma", OMR, omrSvar(n, 100))), "failed-precondition", "under 700 ms/fråga");
    const gammal = await forsok("hrk-alma", PUNKT.id, 7 * 3600);
    assert.equal(await code(submit(deps, "hrk-alma", { attemptId: gammal, svar: punktSvar(20) })), "deadline-exceeded");
    assert.equal((await db.doc(`hittaRattBoards/${OMR.id}`).get()).exists, false);
    assert.equal(await coins("hrk-alma"), 10);
  });
});

describe("taBortElev (admin/delete-student.mjs)", () => {
  it("tar bort raden, räknar om ledarna och raderar personbästa + försök", async () => {
    await spela("hrk-omar", PUNKT, punktSvar(20));
    await spela("hrk-alma", PUNKT, punktSvar(18, 40));
    const r = await taBortElev(deps, "hrk-omar");
    assert.deepEqual(r.boards, [PUNKT.id]);
    const b = await board(PUNKT.id);
    assert.equal(b.entries["hrk-omar"], undefined);
    assert.deepEqual(b.leaders, ["hrk-alma"]);
    assert.deepEqual((await meta(PUNKT.id)).uids, ["hrk-alma"]);
    assert.equal((await db.doc("hittaRattBest/hrk-omar").get()).exists, false);
    assert.equal((await db.collection("hittaRattAttempts").where("uid", "==", "hrk-omar").get()).size, 0);
  });
});
