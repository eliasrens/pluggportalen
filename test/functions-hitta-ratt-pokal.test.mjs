// ============================================================================
// Hitta rätt! – Kartmästare-pokalerna på SERVERN (#610, test 12).
// ----------------------------------------------------------------------------
// Pokalen är ingen ägd sak: huset ritar den för de pack där eleven finns i
// hittaRattMeta/ledare (src/hitta-ratt/hr-pokal.js minaPokaler). Här testas
// att functionens transaktion (functions/hitta-ratt-core.js) alltid lämnar
// ledardokumentet i takt med topplistan:
//   • tilldelning (första resultatet), delad etta (punkt och område)
//   • ledarbyte – gamla ettan tappar pokalen, även en utplacerad
//   • samtidiga resultat på samma pack och på två pack
//   • omförsök (samma attemptId) ändrar ingenting
//   • stangTopplista (förberedd toggle, epic 2/2) tar bort pokalen idempotent
// Egna pack-id/uid:er (hrp-*) – krockar inte med de andra Hitta rätt!-filerna
// mot samma emulator. Körs av `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { submit, stangTopplista } from "../functions/hitta-ratt-core.js";
import { PACKS } from "../functions/hitta-ratt/packs.js";
import { ledare } from "../functions/hitta-ratt/rank.js";
import { minaPokaler, pokalNyckel, rensaPokaler } from "../src/hitta-ratt/hr-pokal.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `hr-pokal-${process.pid}`);
const db = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

const PUNKT = { ...PACKS["sverige-stader"], id: "hrp-punkt", titel: "Pokalpunkt" };
const PUNKT2 = { ...PACKS["europa-huvudstader-20"], id: "hrp-punkt2", titel: "Pokalpunkt 2" };
const OMR = { ...PACKS["sverige-landskap"], id: "hrp-omrade", titel: "Pokalområde" };
const packs = { [PUNKT.id]: PUNKT, [PUNKT2.id]: PUNKT2, [OMR.id]: OMR };
const ctl = { clock: Date.now() };
const deps = { db, FieldValue, Timestamp, now: () => ctl.clock, packs };

const UIDS = ["hrp-a", "hrp-b", "hrp-c", "hrp-d", "hrp-e", "hrp-f"];
let nr = 0;
const att = () => `hrpatt${Date.now().toString(36)}${(nr++).toString(36)}`;

async function rensa() {
  for (const c of ["hittaRattBoards", "hittaRattBest", "hittaRattAttempts"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("hrp") || String(d.data().uid || "").startsWith("hrp")).map((d) => d.ref.delete()));
  }
  await db.doc("hittaRattMeta/ledare").set(
    { packs: Object.fromEntries(Object.keys(packs).map((id) => [id, FieldValue.delete()])) },
    { merge: true }
  );
}

beforeEach(async () => {
  ctl.clock = Date.now();
  await rensa();
  await db.doc("classes/hrp5x").set({ name: "5X", studentIds: UIDS, enabledModules: ["hittaratt"] });
  for (const uid of UIDS) {
    await db.doc(`students/${uid}`).set({ namn: uid.slice(4).toUpperCase() });
    await db.doc(`studentData/${uid}`).set({ coins: 0 });
  }
});

async function forsok(uid, packId) {
  const id = att();
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId, startedAt: Timestamp.fromMillis(ctl.clock - 600_000), status: "open" });
  return id;
}
/** Punktsvar: `exakta` frågor exakt rätt, resten `kmFel` km söderut. */
const punktSvar = (pack, exakta, kmFel = 40) =>
  pack.items.map((it, i) => ({ itemId: it.id, lon: it.lon, lat: i < exakta ? it.lat : it.lat - kmFel / 111.2 }));
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
const metaDok = async () => (await db.doc("hittaRattMeta/ledare").get()).data() || {};
const board = async (id) => (await db.doc(`hittaRattBoards/${id}`).get()).data();
/** Vilka elever huset ritar pokalen hos för ett pack (samma väg som klienten). */
async function pokalAgare(packId) {
  const m = await metaDok();
  return UIDS.filter((u) => minaPokaler(m, u).some((p) => p.packId === packId));
}
/** Ledarna i meta ska ALLTID vara exakt topplistans plats 1 (inga spökpokaler). */
async function iTakt(pack) {
  const b = await board(pack.id);
  const m = (await metaDok()).packs?.[pack.id];
  assert.deepEqual(m.uids, ledare(b.entries, pack.typ), `meta i takt med topplistan för ${pack.id}`);
  assert.deepEqual(b.leaders, m.uids);
  return m.uids;
}

describe("Kartmästare-pokalen följer topplistans etta (test 12)", () => {
  it("tilldelning: första resultatet ger pokalen, med packens titel och typ", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 10));
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-a"]);
    const [p] = minaPokaler(await metaDok(), "hrp-a").filter((x) => x.packId === PUNKT.id);
    assert.equal(p.namn, "Kartmästare – Skolrekord Pokalpunkt");
    assert.equal(p.typ, "point");
    await iTakt(PUNKT);
  });

  it("delad etta (punkt): alla ettor har pokalen; trean har den inte", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-b", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-c", PUNKT, punktSvar(PUNKT, 14));
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-a", "hrp-b"]);
    await iTakt(PUNKT);
  });

  it("ledarbyte: den nya ettan får pokalen, båda gamla ettorna tappar den – även utplacerad", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-b", PUNKT, punktSvar(PUNKT, 15));
    // hrp-a har ställt ut sin pokal i rummet.
    const rumA = { soffa: { x: 20, y: 80 }, [pokalNyckel(PUNKT.id)]: { x: 50, y: 80 } };
    await spela("hrp-c", PUNKT, punktSvar(PUNKT, 18));
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-c"]);
    const giltiga = new Set(minaPokaler(await metaDok(), "hrp-a").map((p) => p.nyckel));
    assert.equal(rensaPokaler(rumA, giltiga), 1, "den utplacerade pokalen städas bort");
    assert.deepEqual(Object.keys(rumA), ["soffa"]);
    await iTakt(PUNKT);
  });

  it("delad etta upplöses när en av ettorna slår rekordet; ett sämre försök ändrar inget", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-b", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 12)); // sämre: personbästat står kvar
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-a", "hrp-b"]);
    await spela("hrp-b", PUNKT, punktSvar(PUNKT, 16));
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-b"]);
    await iTakt(PUNKT);
  });

  it("områdespack: rätt först, tid vid lika – exakt lika ger delad etta", async () => {
    const n = OMR.items.length;
    await spela("hrp-a", OMR, omrSvar(n, 990));
    await spela("hrp-b", OMR, omrSvar(n, 990));
    await spela("hrp-c", OMR, omrSvar(n - 1, 500));
    assert.deepEqual(await pokalAgare(OMR.id), ["hrp-a", "hrp-b"]);
    await spela("hrp-c", OMR, omrSvar(n, 980));
    assert.deepEqual(await pokalAgare(OMR.id), ["hrp-c"]);
    assert.equal(minaPokaler(await metaDok(), "hrp-c").find((p) => p.packId === OMR.id).typ, "area");
    await iTakt(OMR);
  });

  it("omförsök med samma attemptId ändrar inte ledarna (idempotent)", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 15));
    const id = await forsok("hrp-b", PUNKT.id);
    await submit(deps, "hrp-b", { attemptId: id, svar: punktSvar(PUNKT, 17) });
    const fore = await metaDok();
    const igen = await submit(deps, "hrp-b", { attemptId: id, svar: punktSvar(PUNKT, 20) });
    assert.equal(igen.coins, 0);
    assert.deepEqual((await metaDok()).packs[PUNKT.id], fore.packs[PUNKT.id]);
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-b"]);
  });
});

describe("samtidiga resultat", () => {
  it("sex samtidiga resultat på samma pack → ledarna = topplistans plats 1, ingen spökpokal", async () => {
    // Två delar toppen (18 exakta), övriga under.
    const exakta = { "hrp-a": 12, "hrp-b": 18, "hrp-c": 14, "hrp-d": 18, "hrp-e": 9, "hrp-f": 16 };
    await Promise.all(UIDS.map((u) => spela(u, PUNKT, punktSvar(PUNKT, exakta[u]))));
    assert.deepEqual(await iTakt(PUNKT), ["hrp-b", "hrp-d"]);
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-b", "hrp-d"]);
    assert.equal(Object.keys((await board(PUNKT.id)).entries).length, 6);

    // Andra vågen: alla förbättrar sig samtidigt, en ny ensam etta.
    const igen = { "hrp-a": 19, "hrp-b": 18, "hrp-c": 17, "hrp-d": 18, "hrp-e": 15, "hrp-f": 17 };
    await Promise.all(UIDS.map((u) => spela(u, PUNKT, punktSvar(PUNKT, igen[u]))));
    assert.deepEqual(await iTakt(PUNKT), ["hrp-a"]);
    assert.deepEqual(await pokalAgare(PUNKT.id), ["hrp-a"]);
  });

  it("samtidiga resultat på två pack (samma ledardokument) → båda packen rätt", async () => {
    await Promise.all([
      spela("hrp-a", PUNKT, punktSvar(PUNKT, 17)),
      spela("hrp-b", PUNKT2, punktSvar(PUNKT2, 17)),
      spela("hrp-c", PUNKT, punktSvar(PUNKT, 12)),
      spela("hrp-d", PUNKT2, punktSvar(PUNKT2, 19)),
    ]);
    assert.deepEqual(await iTakt(PUNKT), ["hrp-a"]);
    assert.deepEqual(await iTakt(PUNKT2), ["hrp-d"]);
    const m = await metaDok();
    assert.deepEqual(minaPokaler(m, "hrp-a").map((p) => p.packId), [PUNKT.id]);
    assert.deepEqual(minaPokaler(m, "hrp-d").map((p) => p.packId), [PUNKT2.id]);
    assert.deepEqual(minaPokaler(m, "hrp-b"), []);
  });
});

describe("stangTopplista (förberedd toggle, epic 2/2)", () => {
  it("tar bort topplistan och pokalen i alla hus – andra pack orörda, idempotent", async () => {
    await spela("hrp-a", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-b", PUNKT, punktSvar(PUNKT, 15));
    await spela("hrp-c", PUNKT2, punktSvar(PUNKT2, 15));
    assert.deepEqual(await stangTopplista(deps, PUNKT.id), { fanns: true });
    assert.equal(await board(PUNKT.id), undefined);
    assert.deepEqual(await pokalAgare(PUNKT.id), []);
    assert.deepEqual(await pokalAgare(PUNKT2.id), ["hrp-c"]);
    assert.deepEqual(await stangTopplista(deps, PUNKT.id), { fanns: false });
    await assert.rejects(stangTopplista(deps, "../x"), (e) => e.code === "invalid-argument");
  });
});
