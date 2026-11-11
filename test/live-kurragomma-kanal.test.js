// ============================================================================
// Kurragömma (#838): rörelsekanalen kg-kanal.js – ren Node, ingen emulator.
//   • posfiltret: högst 5/s, bara vid flytt > 0,15 m eller vridning, men pulsen
//     minst var POS_PULS_MS
//   • RTDB-implementationen mot en falsk SDK (injicerad): start() skriver inget
//     (gömmare/projektor har ingen skrivrätt), första skickaPos armerar
//     onDisconnect().remove() på egen pos, t och åldersgränsen följer serverns
//     klocka (.info/serverTimeOffset), egna positioner filtreras bort i paPos,
//     händelser äldre än 10 s ignoreras, limitToLast(HAND_LIMIT), stang() tar
//     bort egen pos bara om den skrivits
//   • den lokala bussen: samma gränssnitt, bara sökare skriver pos
//   • SDK:n nås bara via import() (ingen statisk import av gstatic/firebase)
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  skapaPosFilter, skapaRorelsekanal, skapaLokalBuss, KG_DATABASE_URL,
} from "../src/live/formats/kurragomma/kg-kanal.js";
import {
  POS_MIN_INTERVALL_MS, POS_MIN_FLYTT_M, POS_PULS_MS, HAND_MAX_ALDER_MS, HAND_LIMIT,
} from "../src/live/formats/kurragomma/delat/kg-config.js";

const klocka = (start = 1_000_000) => { let t = start; return { nu: () => t, ga: (ms) => { t += ms; } }; };

/** En falsk modulär database-SDK som bokför skrivningar och låter testet skjuta in händelser. */
function falskSdk() {
  const skrivet = [];
  const lyss = { added: new Map(), changed: new Map(), removed: new Map(), value: new Map() };
  const nyckel = (q) => q.path;
  const snap = (key, val) => ({ key, val: () => val });
  return {
    skrivet, lyss,
    getDatabase: (app, url) => ({ app, url }),
    connectDatabaseEmulator: () => {},
    ref: (db, path) => ({ path }),
    query: (r, ...c) => ({ path: r.path, constraints: c }),
    orderByChild: (k) => ({ orderByChild: k }),
    limitToLast: (n) => ({ limitToLast: n }),
    set: async (r, v) => { skrivet.push(["set", r.path, v]); },
    remove: async (r) => { skrivet.push(["remove", r.path]); },
    onDisconnect: (r) => ({ remove: async () => { skrivet.push(["onDisconnect.remove", r.path]); } }),
    onChildAdded: (q, cb) => { lyss.added.set(nyckel(q), { q, cb }); return () => lyss.added.delete(nyckel(q)); },
    onChildChanged: (q, cb) => { lyss.changed.set(nyckel(q), { q, cb }); return () => lyss.changed.delete(nyckel(q)); },
    onChildRemoved: (q, cb) => { lyss.removed.set(nyckel(q), { q, cb }); return () => lyss.removed.delete(nyckel(q)); },
    onValue: (q, cb) => { lyss.value.set(nyckel(q), { q, cb }); return () => lyss.value.delete(nyckel(q)); },
    skjutIn: (typ, path, key, val) => lyss[typ].get(path).cb(snap(key, val)),
  };
}

describe("posfiltret", () => {
  it("första alltid; sedan högst var 200 ms och bara vid flytt > 0,15 m eller vridning", () => {
    const k = klocka();
    const f = skapaPosFilter({ nu: k.nu });
    assert.equal(f.prova({ x: 0, z: 0, yaw: 0 }), true);
    k.ga(POS_MIN_INTERVALL_MS - 50);
    assert.equal(f.prova({ x: 5, z: 5, yaw: 0 }), false, "för tätt");
    k.ga(60);
    assert.equal(f.prova({ x: 0.1, z: 0, yaw: 0 }), false, "för kort flytt");
    assert.equal(f.prova({ x: POS_MIN_FLYTT_M, z: 0, yaw: 0 }), true);
    k.ga(POS_MIN_INTERVALL_MS);
    assert.equal(f.prova({ x: POS_MIN_FLYTT_M, z: 0, yaw: 0.01 }), false, "för liten vridning");
    assert.equal(f.prova({ x: POS_MIN_FLYTT_M, z: 0, yaw: 0.1 }), true, "vridning räcker");
  });
  it("pulsen: stillastående skickas ändå var POS_PULS_MS", () => {
    const k = klocka();
    const f = skapaPosFilter({ nu: k.nu });
    f.prova({ x: 1, z: 1, yaw: 0 });
    k.ga(POS_PULS_MS - 1);
    assert.equal(f.prova({ x: 1, z: 1, yaw: 0 }), false);
    k.ga(1);
    assert.equal(f.prova({ x: 1, z: 1, yaw: 0 }), true);
  });
});

describe("RTDB-kanalen (falsk SDK)", () => {
  async function rigg() {
    const k = klocka();
    const sdk = falskSdk();
    const kanal = skapaRorelsekanal({ sid: "m1", uid: "alma", app: { namn: "app" }, sdk, nu: k.nu });
    await kanal.start();
    return { k, sdk, kanal };
  }
  it("start: databasen i europe-west1, inget skrivs (gömmare/projektor saknar skrivrätt), klockskillnaden lyssnas", async () => {
    const { sdk, kanal } = await rigg();
    assert.deepEqual(sdk.skrivet, []);
    assert.ok(sdk.lyss.value.has(".info/serverTimeOffset"));
    assert.ok(KG_DATABASE_URL.includes("europe-west1"));
    kanal.stang();
    assert.deepEqual(sdk.skrivet, [], "ingen remove av en pos som aldrig skrivits");
  });
  it("skickaPos skriver egen pos filtrerat, med t = nu; första skicket armerar onDisconnect().remove()", async () => {
    const { k, sdk, kanal } = await rigg();
    assert.equal(kanal.skickaPos({ x: 1, z: 2, yaw: 0.5 }), true);
    assert.deepEqual(sdk.skrivet[0], ["onDisconnect.remove", "kg/m1/pos/alma"]);
    assert.equal(sdk.skrivet.filter((s) => s[0] === "onDisconnect.remove").length, 1);
    assert.equal(kanal.skickaPos({ x: 1, z: 2, yaw: 0.5 }), false);
    k.ga(POS_MIN_INTERVALL_MS);
    assert.equal(kanal.skickaPos({ x: 1.01, z: 2, yaw: 0.5 }), false);
    assert.equal(kanal.skickaPos({ x: 3, z: 2, yaw: 0.5 }), true);
    const sets = sdk.skrivet.filter((s) => s[0] === "set");
    assert.deepEqual(sets, [["set", "kg/m1/pos/alma", { x: 1, z: 2, yaw: 0.5, t: 1_000_000 }], ["set", "kg/m1/pos/alma", { x: 3, z: 2, yaw: 0.5, t: 1_000_000 + POS_MIN_INTERVALL_MS }]]);
  });
  it("serverns klocka: t = nu + serverTimeOffset, och åldersgränsen för händelser följer den", async () => {
    const { k, sdk, kanal } = await rigg();
    sdk.skjutIn("value", ".info/serverTimeOffset", "serverTimeOffset", 20_000);
    kanal.skickaPos({ x: 1, z: 2, yaw: 0 });
    assert.deepEqual(sdk.skrivet.at(-1), ["set", "kg/m1/pos/alma", { x: 1, z: 2, yaw: 0, t: k.nu() + 20_000 }]);
    const sett = [];
    kanal.paHandelse((h) => sett.push(h.id));
    sdk.skjutIn("added", "kg/m1/hand", "h1", { typ: "vissling", x: 1, z: 2, plats: "x", t: k.nu() + 20_000 - 500 });
    sdk.skjutIn("added", "kg/m1/hand", "h2", { typ: "vissling", x: 1, z: 2, plats: "x", t: k.nu() + 500 });
    assert.deepEqual(sett, ["h1"], "klienten 20 s efter servern: serverns färska händelse tas, den 'gamla' (klientens klocka) inte");
  });
  it("paPos ger andras positioner och borttagningar – aldrig den egna", async () => {
    const { sdk, kanal } = await rigg();
    const sett = [];
    kanal.paPos((uid, p) => sett.push([uid, p]));
    sdk.skjutIn("added", "kg/m1/pos", "bo", { x: 1, z: 1, yaw: 0, t: 1 });
    sdk.skjutIn("added", "kg/m1/pos", "alma", { x: 9, z: 9, yaw: 0, t: 1 });
    sdk.skjutIn("changed", "kg/m1/pos", "bo", { x: 2, z: 1, yaw: 0, t: 2 });
    sdk.skjutIn("removed", "kg/m1/pos", "bo", null);
    assert.deepEqual(sett, [["bo", { x: 1, z: 1, yaw: 0, t: 1 }], ["bo", { x: 2, z: 1, yaw: 0, t: 2 }], ["bo", null]]);
  });
  it("paHandelse lyssnar på de HAND_LIMIT senaste och struntar i händelser äldre än 10 s", async () => {
    const { k, sdk, kanal } = await rigg();
    const sett = [];
    kanal.paHandelse((h) => sett.push(h));
    const q = sdk.lyss.added.get("kg/m1/hand").q;
    assert.deepEqual(q.constraints, [{ orderByChild: "t" }, { limitToLast: HAND_LIMIT }]);
    sdk.skjutIn("added", "kg/m1/hand", "h1", { typ: "vissling", x: 1, z: 2, plats: "vid ladan", t: k.nu() - HAND_MAX_ALDER_MS - 1 });
    sdk.skjutIn("added", "kg/m1/hand", "h2", { typ: "hittad", x: 1, z: 2, plats: "vid ladan", t: k.nu() - 500 });
    assert.deepEqual(sett.map((h) => h.id), ["h2"]);
    assert.equal(sett[0].typ, "hittad");
  });
  it("paStatus ger statusen; stang() slutar lyssna och tar bort egen pos", async () => {
    const { sdk, kanal } = await rigg();
    const st = [];
    kanal.paStatus((s) => st.push(s));
    kanal.paPos(() => {});
    sdk.skjutIn("value", "kg/m1/status", "status", { fas: "leta", lasta: 3, gomda: 3, sokare: 1 });
    assert.deepEqual(st, [{ fas: "leta", lasta: 3, gomda: 3, sokare: 1 }]);
    kanal.skickaPos({ x: 1, z: 1, yaw: 0 });
    kanal.stang();
    assert.equal(sdk.lyss.value.size + sdk.lyss.added.size + sdk.lyss.changed.size + sdk.lyss.removed.size, 0);
    assert.deepEqual(sdk.skrivet.at(-1), ["remove", "kg/m1/pos/alma"]);
  });
  it("SDK:n nås bara via import() från gstatic – ingen statisk import", () => {
    const src = readFileSync(new URL("../src/live/formats/kurragomma/kg-kanal.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /^import .*firebase/m);
    assert.match(src, /await import\([^)]*SDK_URL\)/);
    assert.match(src, /gstatic\.com\/firebasejs\/10\.12\.2\/firebase-database\.js/);
  });
});

describe("den lokala bussen", () => {
  it("samma gränssnitt: bara sökare skriver pos, händelser och status når alla kanaler", async () => {
    const k = klocka();
    const buss = skapaLokalBuss({ nu: k.nu });
    const alma = skapaRorelsekanal({ sid: "demo", uid: "alma", lage: "lokal", buss });
    const bo = skapaRorelsekanal({ sid: "demo", uid: "bo", lage: "lokal", buss });
    await alma.start();
    await bo.start();
    buss.server.roll("alma", "sokare");
    const settAvBo = [];
    bo.paPos((uid, p) => settAvBo.push([uid, p?.x ?? null]));
    assert.equal(bo.skickaPos({ x: 1, z: 1 }), false, "gömmaren skriver inte");
    assert.equal(alma.skickaPos({ x: 1, z: 1 }), true);
    assert.equal(alma.skickaPos({ x: 1, z: 1 }), false, "takten gäller lokalt också");
    const hand = [];
    bo.paHandelse((h) => hand.push(h.typ));
    buss.server.handelse({ typ: "vissling", x: 0, z: 0, plats: "vid brunnen" });
    const st = [];
    alma.paStatus((s) => st.push(s.gomda));
    buss.server.status({ fas: "leta", lasta: 2, gomda: 2, sokare: 1 });
    buss.server.status({ gomda: 1 });
    assert.deepEqual(settAvBo, [["alma", 1]]);
    assert.deepEqual(hand, ["vissling"]);
    assert.deepEqual(st, [2, 1]);
    alma.stang();
    assert.deepEqual(settAvBo.at(-1), ["alma", null]);
    assert.throws(() => skapaRorelsekanal({ sid: "demo", uid: "x", lage: "lokal" }), /buss/);
  });
  it("gamla händelser (> 10 s) ges inte vid anslutning", async () => {
    const k = klocka();
    const buss = skapaLokalBuss({ nu: k.nu });
    buss.server.handelse({ typ: "vissling", x: 0, z: 0, plats: "vid brunnen" });
    k.ga(HAND_MAX_ALDER_MS + 1);
    buss.server.handelse({ typ: "hittad", x: 0, z: 0, plats: "vid brunnen" });
    const sett = [];
    buss.kanalFor("cleo").paHandelse((h) => sett.push(h.typ));
    assert.deepEqual(sett, ["hittad"]);
  });
});
