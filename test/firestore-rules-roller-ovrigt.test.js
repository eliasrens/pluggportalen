// ============================================================================
// Regel-tester: roller – samlingarna som test 1–25 inte rör (#681).
// ----------------------------------------------------------------------------
// Raderna i docs/BEHORIGHETER.md som saknade ett rolltest: klassprojektioner
// och klassprojekt, Hitta rätt!-katalogerna och egna bilder, Klasscentrets
// inredning och insamlingar, Guldrushens/Datakuppens serverdata, Live-klockan
// och elevkontona. Årskurs 4 (4a, 4b)
// läser men skriver inget av detta, även för sina egna klasser.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { Bytes, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-roller-ovrigt"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classProjections", "4a"), { members: {} });
    await setDoc(doc(db, "classProjects", "4a"), { projects: {} });
    await setDoc(doc(db, "hittaRattPacks", "e-abcdefghijkl"), { titel: "Egen" });
    await setDoc(doc(db, "hittaRattBoards", "sverige"), { rader: [] });
    await setDoc(doc(db, "hittaRattMeta", "egnaPack"), { pack: [] });
    await setDoc(doc(db, "classCenters", "4a", "layout", "current"), { saker: [] });
    await setDoc(doc(db, "classCenters", "4a", "fund", "fontan"), { insamlat: 0 });
    for (const [sid, klasser] of [["dk4a", ["4a", "6a"]], ["dk5a", ["5a", "6a"]]]) {
      await setDoc(doc(db, "liveSessions", sid), { participatingClassIds: klasser, status: "live" });
      for (const c of ["grPlayers", "grEvents", "grMeta", "dkPlayers", "dkEvents", "dkMeta", "dkSelf", "dkSecret"]) {
        await setDoc(doc(db, "liveSessions", sid, c, "e6a"), { x: 1 });
      }
    }
  });
});

const bild = (ownerUid) => ({
  ownerUid, packId: "e-abcdefghijkl", mime: "image/webp", bredd: 100, hojd: 100,
  data: Bytes.fromUint8Array(new Uint8Array(10).fill(7)), skapad: serverTimestamp(),
});

describe("Årskurskonto: klassprojektioner och klassprojekt", () => {
  it("läser, men skriver inte – inte ens för sin egen klass", async () => {
    for (const c of ["classProjections", "classProjects"]) {
      await assertSucceeds(getDoc(doc(env.ak4(), c, "4a")));
      await assertFails(setDoc(doc(env.ak4(), c, "4a"), { members: { x: 1 } }, { merge: true }));
      await assertSucceeds(setDoc(doc(env.admin(), c, "4a"), { members: { x: 1 } }, { merge: true }));
    }
  });
});

describe("Årskurskonto: Hitta rätt!-kataloger och egna bilder", () => {
  it("läser packen, topplistan och katalogen; ingen klient skriver dem", async () => {
    for (const [c, id] of [["hittaRattPacks", "e-abcdefghijkl"], ["hittaRattBoards", "sverige"], ["hittaRattMeta", "egnaPack"]]) {
      await assertSucceeds(getDoc(doc(env.ak4(), c, id)));
      await assertFails(setDoc(doc(env.ak4(), c, id), { x: 1 }));
      await assertFails(setDoc(doc(env.admin(), c, id), { x: 1 }));
    }
  });
  it("skapar inga bilder till egna kartor (bara admin)", async () => {
    await assertFails(setDoc(doc(env.ak4(), "hittaRattBilder", "e-abcdefghijkl--aaaaaaaa"), bild("ak4")));
    await assertSucceeds(setDoc(doc(env.admin(), "hittaRattBilder", "e-abcdefghijkl--bbbbbbbb"), bild("admin1")));
  });
});

describe("Årskurskonto: Klasscentrets inredning och insamlingar", () => {
  it("läser, men skriver inte inredningen eller insamlingen för sin klass", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "classCenters", "4a", "layout", "current")));
    await assertSucceeds(getDoc(doc(env.ak4(), "classCenters", "4a", "fund", "fontan")));
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a", "layout", "current"), { saker: ["x"] }));
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a", "layoutHistory", "0"), { saker: [] }));
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a", "fund", "fontan"), { insamlat: 50 }));
  });
});

describe("Årskurskonto: Guldrushens och Datakuppens serverdata", () => {
  const SERVER = ["grPlayers", "grEvents", "grMeta", "dkPlayers", "dkEvents", "dkMeta"];
  it("läser i en match med sin klass, inte i andras; skriver aldrig", async () => {
    for (const c of SERVER) {
      await assertSucceeds(getDoc(doc(env.ak4(), "liveSessions", "dk4a", c, "e6a")));
      await assertFails(getDoc(doc(env.ak4(), "liveSessions", "dk5a", c, "e6a")));
      await assertFails(setDoc(doc(env.ak4(), "liveSessions", "dk4a", c, "e6a"), { x: 2 }));
    }
  });
  it("elevens hemliga koder läser ingen lärare, inte ens admin", async () => {
    for (const c of ["dkSelf", "dkSecret"]) {
      await assertFails(getDoc(doc(env.ak4(), "liveSessions", "dk4a", c, "e6a")));
      await assertFails(getDoc(doc(env.admin(), "liveSessions", "dk4a", c, "e6a")));
    }
  });
});

describe("Årskurskonto: Live-klockan och elevkonton", () => {
  it("skriver sin egen klocka, läser inte andras", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "liveClock", "ak4"), { t: serverTimestamp() }));
    await assertFails(getDoc(doc(env.ak4(), "liveClock", "admin1")));
  });
  it("läser elevkonton i alla klasser (som alla inloggade), skriver inga", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "students", "e5a")));
    await assertFails(setDoc(doc(env.ak4(), "students", "e4a"), { namn: "Ny" }, { merge: true }));
  });
});

describe("Allt annat nekas", () => {
  it("en samling som inte står i reglerna nekas även admin", async () => {
    for (const db of [env.admin(), env.ak4()]) {
      await assertFails(getDoc(doc(db, "okandSamling", "x")));
      await assertFails(setDoc(doc(db, "okandSamling", "x"), { x: 1 }));
    }
  });
});
