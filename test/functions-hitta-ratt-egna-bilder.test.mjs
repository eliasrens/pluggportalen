// ============================================================================
// Hitta rätt! (#637, arkitektur §11.4/§11.8): bilderna i lärarens egna pack på
// servern – functions/hitta-ratt-egna.js + hitta-ratt-bilder.js, direkt mot
// Firestore-emulatorn med Admin SDK.
//
//   kontroll: okänt bild-id, bild från fel pack och en annan lärares bild nekas;
//             bredd/höjd tas från bilddokumentet
//   städning: sparaPack raderar packens bilder som ingen fråga använder
//   radering: raderaPack tar bort alla packens bilder (packet borta → bara egna)
//   kopiering: kopieraFran (Duplicera) kopierar källans bilder till nya id;
//             saknad källbild → frågan blir utan bild; utan kopieraFran nekas
//
// Pack-id e-hrgbild… och uid hrg-* krockar inte med andra sviter. Körs av
// `npm run test:functions` (en fil i taget, färsk emulator).
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { HrFel } from "../functions/hitta-ratt-core.js";
import { sparaPack, raderaPack } from "../functions/hitta-ratt-egna.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `hr-bilder-${process.pid}`);
const db = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

const deps = { db, FieldValue, Timestamp, now: () => Date.now() };
const ID = "e-hrgbild00001";
const KALLA = "e-hrgbildkalla";
const KOPIA = "e-hrgbildkopia";
const ALLA = [ID, KALLA, KOPIA];
const LARARE = "hrg-larare";
const ANNAN = "hrg-annan";
const BILDER = db.collection("hittaRattBilder");

const pack = (items, over = {}) => ({
  id: ID, title: "Bildkartan", type: "point", geo: "sverige-landskap", classIds: [],
  items: items.map(([id, bild]) => ({ id, name: id, lat: 60.6749, lon: 17.1413, ...(bild ? { bild } : {}) })), ...over,
});
const commons = (id) => ({ id, kalla: "commons", fil: "Gävle rådhus.jpg", fotograf: "I99pema", licens: "CC BY-SA 4.0",
  licensUrl: "https://creativecommons.org/licenses/by-sa/4.0/", kallaUrl: "https://commons.wikimedia.org/wiki/File:X.jpg", bredd: 1, hojd: 1 });

async function laggBild(id, { packId = id.split("--")[0], ownerUid = LARARE, bredd = 800, hojd = 533 } = {}) {
  await BILDER.doc(id).set({ ownerUid, packId, mime: "image/webp", bredd, hojd, data: Buffer.from(`bild:${id}`), skapad: Timestamp.now() });
}
const finns = async (id) => (await BILDER.doc(id).get()).exists;
const packBilder = async (packId) => (await BILDER.where("packId", "==", packId).get()).docs;
const spara = (uid, p, extra = {}) => sparaPack(deps, uid, { pack: p, ...extra }, { namn: "Anna L" });
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof HrFel, `HrFel väntades, fick ${e?.stack || e}`);
    return `${e.code}: ${e.message}`;
  }
  return "ok";
};

beforeEach(async () => {
  for (const id of ALLA) {
    await Promise.all((await packBilder(id)).map((d) => d.ref.delete()));
    await db.doc(`hittaRattPacks/${id}`).delete();
  }
  await db.doc("hittaRattMeta/egnaPack").set({ packs: Object.fromEntries(ALLA.map((id) => [id, FieldValue.delete()])) }, { merge: true });
});

describe("sparaPack: kontroll av bild.id", () => {
  it("egen bild i packet godtas; bredd/höjd tas från dokumentet", async () => {
    await laggBild(`${ID}--aaaaaaaa`, { bredd: 640, hojd: 480 });
    await spara(LARARE, pack([["gavle", commons(`${ID}--aaaaaaaa`)], ["ockelbo"]]));
    assert.equal(await finns(`${ID}--aaaaaaaa`), true);
    const p = (await db.doc(`hittaRattPacks/${ID}`).get()).data();
    assert.deepEqual([p.items[0].bild.bredd, p.items[0].bild.hojd], [640, 480]);
    assert.equal(p.items[0].bild.licens, "CC BY-SA 4.0");
    assert.equal("bild" in p.items[1], false, "fråga utan bild sparas utan bild");
  });

  it("okänt bild-id nekas – inget sparas", async () => {
    const svar = await code(spara(LARARE, pack([["gavle", commons(`${ID}--saknas00`)]])));
    assert.match(svar, /^invalid-argument: Bilden till "gavle"/);
    assert.equal((await db.doc(`hittaRattPacks/${ID}`).get()).exists, false);
  });

  it("bild från ett annat pack nekas (även med rätt ägare)", async () => {
    await laggBild(`${KALLA}--bbbbbbbb`);
    assert.match(await code(spara(LARARE, pack([["gavle", commons(`${KALLA}--bbbbbbbb`)]]))), /^invalid-argument/);
  });

  it("en annan lärares bild i samma pack nekas", async () => {
    await laggBild(`${ID}--cccccccc`, { ownerUid: ANNAN });
    assert.match(await code(spara(LARARE, pack([["gavle", commons(`${ID}--cccccccc`)]]))), /^invalid-argument/);
  });
});

describe("städning och radering", () => {
  it("sparaPack raderar packens bilder som ingen fråga använder längre", async () => {
    await laggBild(`${ID}--aaaaaaaa`);
    await laggBild(`${ID}--bbbbbbbb`);
    await laggBild(`${ID}--skrap000`, { ownerUid: ANNAN }); // skräp under packets id
    await spara(LARARE, pack([["gavle", commons(`${ID}--aaaaaaaa`)]]));
    assert.deepEqual([await finns(`${ID}--aaaaaaaa`), await finns(`${ID}--bbbbbbbb`), await finns(`${ID}--skrap000`)], [true, false, false]);
    // Byt bild → den gamla raderas; ta bort bilden → packet saknar bilder.
    await laggBild(`${ID}--dddddddd`);
    await spara(LARARE, pack([["gavle", commons(`${ID}--dddddddd`)]]));
    assert.equal(await finns(`${ID}--dddddddd`), true);
    assert.equal(await finns(`${ID}--aaaaaaaa`), false);
    await spara(LARARE, pack([["gavle"]]));
    assert.equal((await packBilder(ID)).length, 0);
  });

  it("andra pack och fel ägare påverkas inte av städningen", async () => {
    await laggBild(`${KALLA}--bbbbbbbb`, { ownerUid: ANNAN });
    await spara(LARARE, pack([["gavle"]]));
    await laggBild(`${ID}--aaaaaaaa`);
    assert.match(await code(spara(ANNAN, pack([["gavle"]]))), /^permission-denied/);
    assert.equal(await finns(`${ID}--aaaaaaaa`), true, "nekad sparning raderar inget");
    assert.equal(await finns(`${KALLA}--bbbbbbbb`), true);
  });

  it("raderaPack tar bort alla packens bilder; packet borta → bara anroparens egna", async () => {
    await laggBild(`${ID}--aaaaaaaa`);
    await spara(LARARE, pack([["gavle", commons(`${ID}--aaaaaaaa`)]]));
    await laggBild(`${ID}--bbbbbbbb`); // uppladdad men aldrig sparad
    assert.deepEqual(await raderaPack(deps, LARARE, { packId: ID }), { fanns: true });
    assert.equal((await packBilder(ID)).length, 0);
    await laggBild(`${ID}--egen0000`);
    await laggBild(`${ID}--annan000`, { ownerUid: ANNAN });
    assert.deepEqual(await raderaPack(deps, LARARE, { packId: ID }), { fanns: false });
    assert.deepEqual((await packBilder(ID)).map((d) => d.id), [`${ID}--annan000`]);
  });

  it("fel ägare kan inte radera packet eller dess bilder", async () => {
    await laggBild(`${ID}--aaaaaaaa`);
    await spara(LARARE, pack([["gavle", commons(`${ID}--aaaaaaaa`)]]));
    assert.match(await code(raderaPack(deps, ANNAN, { packId: ID })), /^permission-denied/);
    assert.equal(await finns(`${ID}--aaaaaaaa`), true);
  });
});

describe("kopieraFran (Duplicera)", () => {
  it("källans bilder kopieras till nya id i kopian; källan är orörd", async () => {
    await laggBild(`${KALLA}--aaaaaaaa`, { ownerUid: ANNAN, bredd: 700, hojd: 466 });
    await spara(ANNAN, pack([["gavle", commons(`${KALLA}--aaaaaaaa`)], ["ockelbo", { id: `${KALLA}--aaaaaaaa`, kalla: "egen" }]], { id: KALLA }));
    const kopia = pack([["gavle", commons(`${KALLA}--aaaaaaaa`)], ["ockelbo", { id: `${KALLA}--aaaaaaaa`, kalla: "egen" }], ["hofors"]], { id: KOPIA, title: "Bildkartan (kopia)" });
    await spara(LARARE, kopia, { kopieraFran: KALLA });
    const p = (await db.doc(`hittaRattPacks/${KOPIA}`).get()).data();
    const nyttId = p.items[0].bild.id;
    assert.match(nyttId, /^e-hrgbildkopia--[a-z0-9]{8}$/);
    assert.equal(p.items[1].bild.id, nyttId, "samma källbild kopieras en gång");
    assert.equal(p.items[0].bild.licens, "CC BY-SA 4.0", "attributionen följer med");
    const ny = (await BILDER.doc(nyttId).get()).data();
    assert.deepEqual([ny.ownerUid, ny.packId, ny.bredd, ny.hojd, ny.mime], [LARARE, KOPIA, 700, 466, "image/webp"]);
    assert.equal(Buffer.from(ny.data).toString(), `bild:${KALLA}--aaaaaaaa`);
    assert.equal(await finns(`${KALLA}--aaaaaaaa`), true);
    assert.equal((await packBilder(KALLA)).length, 1);
  });

  it("saknad källbild → frågan sparas utan bild", async () => {
    await spara(LARARE, pack([["gavle", commons(`${KALLA}--borta000`)]], { id: KOPIA }), { kopieraFran: KALLA });
    const p = (await db.doc(`hittaRattPacks/${KOPIA}`).get()).data();
    assert.equal("bild" in p.items[0], false);
  });

  it("utan kopieraFran nekas källans bild-id (fel pack)", async () => {
    await laggBild(`${KALLA}--aaaaaaaa`, { ownerUid: ANNAN });
    assert.match(await code(spara(LARARE, pack([["gavle", commons(`${KALLA}--aaaaaaaa`)]], { id: KOPIA }))), /^invalid-argument/);
    assert.equal((await packBilder(KOPIA)).length, 0);
  });
});
