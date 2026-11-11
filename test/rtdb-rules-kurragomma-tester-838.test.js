// ============================================================================
// Testarens extra RTDB-tester för Kurragömma (#838): database.rules.json mot
// den RIKTIGA rörelsekanalen (kg-kanal.js med Firebase-klientens modulära
// SDK, inte en falsk). Varje elevs kanal startas (start() → onDisconnect
// på egen pos), sökaren skickar pos, de andra lyssnar.
//   • en GÖMMARE startar kanalen (den lyssnar på sökare/visslingar) – start()
//     får inte nekas av reglerna
//   • sökarens pos når gömmaren och läraren; den som inte är med nekas
//   • gränserna: t långt fram, yaw/x på gränsen, annan session
// Körs av `npm run test:rules:rtdb` (database-emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase/app";
import * as fbdb from "firebase/database";
import { skapaRorelsekanal } from "../src/live/formats/kurragomma/kg-kanal.js";
import { POS_MIN_INTERVALL_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";

const PROJECT = "pluggportalen-rtdb-test-kurragomma-838";
const SID = "match838";
let testEnv;
const appar = [];
const [HOST, PORT] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000").split(":");
const elev = (uid) => testEnv.authenticatedContext(uid).database();
const ref = (db, p) => db.ref(`kg/${SID}/${p}`);
const posOk = (over = {}) => ({ x: 3.5, z: -2, yaw: 1.2, t: Date.now(), ...over });

/** Den riktiga kanalen: modulära SDK:n, inloggad som uid via emulatorns mockUserToken. */
function kanal(uid, claims = {}) {
  const app = initializeApp({ projectId: PROJECT, databaseURL: `http://${HOST}:${PORT}?ns=${PROJECT}` }, `k-${uid}-${Math.random()}`);
  appar.push(app);
  const sdk = {
    ...fbdb,
    connectDatabaseEmulator: (db, h, p) => fbdb.connectDatabaseEmulator(db, h, p, { mockUserToken: { sub: uid, user_id: uid, ...claims } }),
  };
  const k = skapaRorelsekanal({ sid: SID, uid, app, url: URL_NS, sdk, emulator: { host: HOST, port: Number(PORT) } });
  k.db = () => fbdb.getDatabase(app, URL_NS);
  return k;
}
const URL_NS = `http://${HOST}:${PORT}?ns=${PROJECT}`;
const admin = async (p) => { let v; await testEnv.withSecurityRulesDisabled(async (ctx) => { v = (await ctx.database().ref(`kg/${SID}/${p}`).once("value")).val(); }); return v; };
const adminSet = (p, v) => testEnv.withSecurityRulesDisabled((ctx) => ctx.database().ref(`kg/${SID}/${p}`).set(v));
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
async function medTimeout(p, ms = 4000) {
  return Promise.race([p.then(() => "ok", (e) => `fel: ${e?.code || e?.message || e}`), vanta(ms).then(() => "timeout")]);
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    database: { rules: readFileSync(new URL("../database.rules.json", import.meta.url), "utf8") },
  });
});
after(async () => {
  for (const a of appar) await deleteApp(a).catch(() => null);
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled((ctx) => ctx.database().ref(`kg/${SID}`).set({
    roll: { alma: "sokare" },
    med: { alma: true, bo: true },
    pos: { alma: posOk() },
    status: { fas: "leta", lasta: 1, gomda: 1, sokare: 1 },
  }));
});

describe("Rörelsekanalen (riktig SDK) mot reglerna", () => {
  it("sökaren startar kanalen (onDisconnect på egen pos) och skickar pos – gömmaren och läraren ser den", async () => {
    const a = kanal("alma");
    assert.equal(await medTimeout(a.start()), "ok");
    const sett = { bo: [], larare: [] };
    const b = kanal("bo");
    const l = kanal("larare9", { teacher: true });
    await medTimeout(b.start()); // gömmarens start prövas i nästa test
    await medTimeout(l.start());
    b.paPos((uid, p) => sett.bo.push([uid, p]));
    l.paPos((uid, p) => sett.larare.push([uid, p]));
    await vanta(300);
    assert.equal(a.skickaPos({ x: 10, z: 5, yaw: 0.5 }), true);
    await vanta(800);
    assert.ok(sett.bo.some(([u, p]) => u === "alma" && p?.x === 10), `gömmaren ser almas pos: ${JSON.stringify(sett.bo)}`);
    assert.ok(sett.larare.some(([u, p]) => u === "alma" && p?.x === 10), "läraren ser almas pos");
    a.stang(); b.stang(); l.stang();
  });

  it("en GÖMMARE och PROJEKTORN kan starta kanalen (de lyssnar på sökarna) – start() nekas inte av reglerna", async () => {
    const b = kanal("bo");
    const l = kanal("larare9", { teacher: true });
    const ut = { gommare: await medTimeout(b.start()), projektor: await medTimeout(l.start()) };
    b.stang();
    l.stang();
    // onDisconnect().remove() på pos/{uid} kräver skrivrätt, som bara den med roll "sokare" har.
    assert.deepEqual(ut, { gommare: "ok", projektor: "ok" });
  });

  it("gömmarens onDisconnect().remove() på egen (tomma) pos – regelutfallet", async () => {
    const r = await medTimeout(ref(elev("bo"), "pos/bo").onDisconnect().remove());
    assert.equal(r, "ok", `onDisconnect för gömmaren: ${r}`);
  });
});

describe("Gränserna i pos", () => {
  it("t mer än 2 min fram nekas; gränsvärden x=±40, yaw=±7 går; en sökare i en annan match nekas här", async () => {
    const a = elev("alma");
    await assertFails(ref(a, "pos/alma").set(posOk({ t: Date.now() + 180_000 })));
    await assertSucceeds(ref(a, "pos/alma").set(posOk({ x: 40, z: -40, yaw: -7 })));
    await assertFails(ref(a, "pos/alma").set(posOk({ yaw: 7.01 })));
    await assertFails(a.ref("kg/annan/pos/alma").set(posOk()));
  });
  it("sökaren kan inte smuggla in fält på nivån under (x som objekt) eller skriva hela pos-noden", async () => {
    const a = elev("alma");
    await assertFails(ref(a, "pos/alma").set(posOk({ x: { v: 1 } })));
    await assertFails(ref(a, "pos").set({ alma: posOk() }));
    await assertFails(ref(a, "").update({ "pos/alma": posOk(), "status/sokare": 9 }));
  });
  it("en lärare utan klass i matchen läser ändå (claim teacher räcker – spec §5.3)", async () => {
    const d = testEnv.authenticatedContext("annanLarare", { teacher: true }).database();
    await assertSucceeds(ref(d, "pos").once("value"));
  });
});

describe("Rättningsrunda 1: onDisconnect vid första skicket och regeln för borttagning", () => {
  it("en gömmare som BLIR sökare: första skickaPos armerar onDisconnect – pos försvinner när den kopplas från", async () => {
    const b = kanal("bo");
    assert.equal(await medTimeout(b.start()), "ok");
    await vanta(300);
    await adminSet("roll/bo", "sokare"); // servern: bo hittades
    assert.equal(b.skickaPos({ x: 5, z: 5, yaw: 0 }), true);
    await vanta(800);
    assert.equal((await admin("pos/bo"))?.x, 5, "bo:s pos skrevs");
    fbdb.goOffline(b.db());
    await vanta(1500);
    assert.equal(await admin("pos/bo"), null, "onDisconnect tog bort pos/bo");
  });
  it("projektorn (lärare) och en gömmare skriver ingenting: varken pos eller onDisconnect", async () => {
    const fore = JSON.stringify(await admin(""));
    const l = kanal("larare9", { teacher: true });
    const b = kanal("bo");
    assert.equal(await medTimeout(l.start()), "ok");
    assert.equal(await medTimeout(b.start()), "ok");
    l.paPos(() => {}); l.paStatus(() => {}); l.paHandelse(() => {});
    b.paPos(() => {}); b.paStatus(() => {}); b.paHandelse(() => {});
    await vanta(500);
    l.stang(); b.stang();
    fbdb.goOffline(l.db()); fbdb.goOffline(b.db());
    await vanta(1500);
    assert.equal(JSON.stringify(await admin("")), fore, "databasen orörd");
  });
  it("borttagning öppnar inget annat: inte andras pos, inte hela pos/kg, inte ett fält, inte skriva som gömmare", async () => {
    const b = elev("bo");
    await assertFails(ref(b, "pos/alma").remove());
    await assertFails(ref(b, "pos").remove());
    await assertFails(ref(b, "").remove());
    await assertFails(b.ref("kg").remove());
    await assertFails(ref(b, "pos/bo").set(posOk()));
    await assertFails(ref(elev("cleo"), "pos/alma").remove());
    await assertFails(ref(testEnv.unauthenticatedContext().database(), "pos/alma").remove());
    await assertFails(ref(elev("alma"), "pos/alma/x").remove()); // sökaren: pos utan x nekas av validate
    await adminSet("pos/bo", posOk()); // en gammal pos (bo var sökare)
    await assertFails(ref(b, "pos/bo/x").set(null)); // ett fält = noden finns kvar → kräver sokare
    await assertFails(ref(b, "pos/bo").update({ x: 1 }));
    await assertSucceeds(ref(b, "pos/bo").remove()); // egen pos får tas bort
    await assertSucceeds(ref(b, "pos/bo").remove()); // även tom
  });
});

describe("Rättningsrunda 2 (F5): onDisconnect armeras om efter ett nätavbrott", () => {
  it("goOffline → goOnline → skickaPos → goOffline ⇒ pos borta", async () => {
    const a = kanal("alma");
    assert.equal(await medTimeout(a.start()), "ok");
    await vanta(300);
    assert.equal(a.skickaPos({ x: 7, z: 7, yaw: 0 }), true);
    await vanta(800);
    assert.equal((await admin("pos/alma"))?.x, 7);
    fbdb.goOffline(a.db());
    await vanta(1500);
    assert.equal(await admin("pos/alma"), null, "första avbrottet: onDisconnect tog bort pos");
    fbdb.goOnline(a.db());
    await vanta(1500);
    await vanta(POS_MIN_INTERVALL_MS);
    assert.equal(a.skickaPos({ x: 9, z: 9, yaw: 0 }), true);
    await vanta(800);
    assert.equal((await admin("pos/alma"))?.x, 9, "pos skrevs igen efter återanslutningen");
    fbdb.goOffline(a.db());
    await vanta(1500);
    assert.equal(await admin("pos/alma"), null, "andra avbrottet: onDisconnect var armerad om");
    a.stang();
  });
});

describe("Testaren runda 2 (F5): flera avbrott, gömmare/projektor, ingen läcka efter stang()", () => {
  const cykel = async (k) => { fbdb.goOffline(k.db()); await vanta(1200); fbdb.goOnline(k.db()); await vanta(1200); };
  it("tre avbrott i rad: varje gång tas sökarens pos bort, och skrivs igen efter återanslutningen", async () => {
    const a = kanal("alma");
    await a.start();
    await vanta(300);
    for (let i = 1; i <= 3; i++) {
      assert.equal(a.skickaPos({ x: i * 3, z: 1, yaw: 0 }), true, `skick ${i}`);
      await vanta(800);
      assert.equal((await admin("pos/alma"))?.x, i * 3, `pos skrevs (varv ${i})`);
      await cykel(a);
      assert.equal(await admin("pos/alma"), null, `avbrott ${i}: pos borta`);
    }
    a.stang();
  });
  it("gömmare och projektor: avbrott och återanslutningar skriver och armerar ingenting", async () => {
    const fore = JSON.stringify(await admin(""));
    const b = kanal("bo");
    const l = kanal("larare9", { teacher: true });
    await b.start();
    await l.start();
    b.paPos(() => {}); l.paStatus(() => {});
    await vanta(300);
    for (let i = 0; i < 2; i++) { await cykel(b); await cykel(l); }
    fbdb.goOffline(b.db()); fbdb.goOffline(l.db());
    await vanta(1200);
    assert.equal(JSON.stringify(await admin("")), fore, "databasen orörd");
  });
  it("efter stang(): en återanslutning armerar inte om – en pos som servern skriver ligger kvar vid nästa avbrott", async () => {
    const a = kanal("alma");
    await a.start();
    await vanta(300);
    a.skickaPos({ x: 4, z: 4, yaw: 0 });
    await vanta(800);
    a.stang();
    await cykel(a); // den gamla anslutningens onDisconnect förbrukas här
    await adminSet("pos/alma", posOk({ x: 11 })); // t.ex. serverns första pos för en ny sökare
    fbdb.goOffline(a.db());
    await vanta(1500);
    assert.equal((await admin("pos/alma"))?.x, 11, "ingen läckt .info/connected-lyssnare armerade om");
  });
});
