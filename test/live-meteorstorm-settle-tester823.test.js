// ============================================================================
// #823 G1 (testaren): historikens settle(s) för Meteorstormen – klasspokalerna
// genom den RIKTIGA kedjan (kc-koppling pokalerEfterAvslut → pokalerUrKalla →
// korPokalUtdelning) mot en minnes-Firestore. Läraren öppnar samma match två
// gånger → EN pokal; demo, ej admin, utan result eller oavslutad → ingenting.
// Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";

// meteorstorm-history.js → teacher-shared.js drar in Firebase-SDK:t från CDN.
installeraFirebaseStubbe();
const { settle } = await import("../src/live/formats/meteorstorm/meteorstorm-history.js");
const { pokalerEfterAvslut } = await import("../src/klasscenter/kc-koppling.js");
const { korPokalUtdelning, pokalerUrKalla } = await import("../src/klasscenter/kc-pokal-typer.js");

/** Minnes-Firestore med just det korPokalUtdelning rör. */
function minnesDb() {
  const docs = new Map();
  const sdk = {
    serverTimestamp: () => "ts",
    doc: (_db, ...path) => path.join("/"),
    runTransaction: async (_db, fn) => {
      const skriv = [];
      const tx = {
        get: async (ref) => ({ exists: () => docs.has(ref), data: () => docs.get(ref) }),
        set: (ref, data) => skriv.push([ref, data]),
      };
      const ut = await fn(tx);
      for (const [ref, data] of skriv) docs.set(ref, data);
      return ut;
    },
  };
  return { docs, sdk };
}

function rig({ admin = true } = {}) {
  const { docs, sdk } = minnesDb();
  const anrop = { pokaler: 0, pris: 0 };
  const dela = async (kalla, kallaId, kallaDoc) => {
    const ut = [];
    for (const p of pokalerUrKalla(kalla, kallaId, kallaDoc)) {
      ut.push({ classId: p.classId, typ: p.typ, ...(await korPokalUtdelning(sdk, null, { classId: p.classId, typ: p.typ, kallaId, detalj: p.detalj, uid: "larare" })) });
    }
    return ut;
  };
  const klass = async () => ({
    pokalerEfterAvslut: async (k, id, d) => { anrop.pokaler++; return pokalerEfterAvslut(k, id, d, { dela }); },
    livePrisEfterAvslut: async () => { anrop.pris++; return []; },
    liveKlassBonus: async () => { throw new Error("klassbonusen får inte delas ut i historiken"); },
  });
  return { docs, anrop, deps: { admin: () => admin, klass } };
}

const SESSION = {
  id: "sessMS1", name: "Meteorstormen 4B mot 4D", format: "meteorstorm", status: "finished",
  startedAt: { seconds: 1 }, participatingClassIds: ["4b", "4d"],
  result: {
    format: "meteorstorm", lage: "klass-mot-klass", winner: "4b", draw: false,
    placering: [{ classId: "4b", skrov: 48, plats: 1 }, { classId: "4d", skrov: 0, plats: 2 }],
    perClass: { "4b": { players: 20 }, "4d": { players: 19 } },
  },
};

describe("#823 G1: meteorstorm-history settle(s) – klasspokalerna i historiken", () => {
  it("öppna matchen två gånger → EN Live-segrare-pokal till vinnaren, ingen klassbonus", async () => {
    const r = rig();
    await settle(SESSION, r.deps);
    await settle(SESSION, r.deps);
    assert.equal(r.anrop.pokaler, 2);
    assert.equal(r.anrop.pris, 2);
    const nycklar = [...r.docs.keys()];
    assert.equal(nycklar.length, 1, JSON.stringify(nycklar));
    assert.match(nycklar[0], /^classCenters\/4b\/trophies\//);
  });

  it("oavgjort → ingen pokal", async () => {
    const r = rig();
    await settle({ ...SESSION, result: { ...SESSION.result, winner: null, draw: true } }, r.deps);
    assert.equal(r.docs.size, 0);
  });

  it("demo, ej admin, utan result, inte avslutad → klasscentret rörs inte", async () => {
    for (const [s, admin] of [
      [{ ...SESSION, demo: true }, true],
      [SESSION, false],
      [{ ...SESSION, result: null }, true],
      [{ ...SESSION, status: "live" }, true],
    ]) {
      const r = rig({ admin });
      await settle(s, r.deps);
      assert.deepEqual(r.anrop, { pokaler: 0, pris: 0 });
      assert.equal(r.docs.size, 0);
    }
  });

  it("aldrig kastande – ett fel i klasscentret sväljs", async () => {
    await assert.doesNotReject(settle(SESSION, { admin: () => true, klass: async () => { throw new Error("nere"); } }));
  });
});
