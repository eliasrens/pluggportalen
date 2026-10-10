// Tester för omförsöket i payLiveRewards (#580, QA-fynd F1 i #567): en
// utbetalning som nekas för att en annan match hann ändra saldot körs om och
// går igenom, exakt en gång; oförändrat läge = verkligt nekad (inga fler
// varv); hann en annan lärare betala blir det "redan". Falsk Firestore som
// räknar regeln "saldot ökar med exakt total" mot det SENAST sparade saldot
// vid commit – precis som emulatorn. Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { payLiveRewards, KROCK_FORSOK } from "../src/live/live-rewards-pay.js";

const nekad = (code = "permission-denied") => Object.assign(new Error(code), { code });
const vanta = async () => {};

const session = (rewards) => ({ status: "finished", startedAt: 1, result: { rewards } });
const REWARDS = {
  alma: { prize: 300, correctCoins: 210, total: 510 },
  bo: { prize: 255, correctCoins: 186, total: 441 },
};

/**
 * Minnes-Firestore. fore(path, varv) körs mellan transaktionens läsningar och
 * commit (= en annan klient skriver emellan); neka(path) → regeln säger nej
 * oavsett läge.
 */
function fakeDb(start = {}, { fore = () => {}, neka = () => false, annatFel = null } = {}) {
  const docs = new Map(Object.entries(start));
  const varv = new Map();
  const f = { docs, varv, transaktioner: 0 };
  f.sdk = {
    doc: (_db, ...p) => p.join("/"),
    serverTimestamp: () => "ts",
    getDoc: async (p) => ({ exists: () => docs.has(p), data: () => docs.get(p) }),
    runTransaction: async (_db, fn) => {
      f.transaktioner++;
      const lasta = new Map();
      const skriv = [];
      const tx = {
        get: async (p) => {
          lasta.set(p, docs.get(p));
          return { exists: () => docs.has(p), data: () => docs.get(p) };
        },
        set: (p, d) => skriv.push([p, d]),
        update: (p, d) => skriv.push([p, { ...docs.get(p), ...d }]),
      };
      const res = await fn(tx);
      const elev = skriv.find(([p]) => p.startsWith("studentData/"))?.[0];
      if (elev) {
        const n = (varv.get(elev) || 0) + 1;
        varv.set(elev, n);
        fore(elev, n, docs);
        if (annatFel) throw nekad(annatFel);
        if (neka(elev)) throw nekad();
        const kv = skriv.find(([p]) => p.includes("/coinReceipts/"));
        // Kvittot är create-only och saldot ska öka med exakt total mot SENAST sparat.
        const fore0 = Number(docs.get(elev)?.coins) || 0;
        const ny = skriv.find(([p]) => p === elev)[1].coins;
        if (docs.has(kv[0]) || ny !== fore0 + kv[1].total) throw nekad();
      }
      for (const [p, d] of skriv) docs.set(p, d);
      return res;
    },
  };
  return f;
}

const pay = (f, rewards = REWARDS, extra = {}) =>
  payLiveRewards(f.sdk, {}, { sid: "s1", session: session(rewards), uid: "larare1", vanta, ...extra });

describe("payLiveRewards – omförsök vid krock (#580)", () => {
  it("annan match ändrar saldot före commit → nytt försök, betald exakt en gång", async () => {
    const f = fakeDb({ "studentData/alma": { coins: 100 } }, {
      // Första och andra försöket för alma: en annan match betalar 50 emellan.
      fore: (p, n, docs) => {
        if (p === "studentData/alma" && n <= 2) docs.set(p, { coins: docs.get(p).coins + 50 });
      },
    });
    const ut = await pay(f);
    assert.deepEqual(ut.map((r) => [r.uid, r.status]).sort(), [["alma", "betald"], ["bo", "betald"]]);
    assert.equal(f.docs.get("studentData/alma").coins, 100 + 50 + 50 + 510);
    assert.equal(f.docs.get("studentData/bo").coins, 441);
    assert.equal(f.varv.get("studentData/alma"), 3);
    assert.equal(f.docs.get("liveSessions/s1/coinReceipts/alma").total, 510);
  });

  it("annan lärare hinner betala emellan → \"redan\", ingen dubbelbetalning", async () => {
    const f = fakeDb({ "studentData/bo": { coins: 0 } }, {
      fore: (p, n, docs) => {
        if (p !== "studentData/bo" || n > 1) return;
        docs.set(p, { coins: 441 });
        docs.set("liveSessions/s1/coinReceipts/bo", { uid: "bo", total: 441, by: "larare2" });
      },
    });
    const ut = await pay(f, { bo: REWARDS.bo });
    assert.deepEqual(ut, [{ uid: "bo", total: 441, status: "redan" }]);
    assert.equal(f.docs.get("studentData/bo").coins, 441);
    assert.equal(f.docs.get("liveSessions/s1/coinReceipts/bo").by, "larare2");
  });

  it("samma läge efter nekat försök → verkligt nekad, bara två varv", async () => {
    const f = fakeDb({ "studentData/alma": { coins: 100 } }, { neka: (p) => p === "studentData/alma" });
    const ut = await pay(f, { alma: REWARDS.alma });
    assert.equal(ut[0].status, "nekad");
    assert.equal(ut[0].fel, "permission-denied");
    // Varv 2 läser samma saldo och returnerar utan skrivning.
    assert.equal(f.transaktioner, 2);
    assert.equal(f.varv.get("studentData/alma"), 1);
    assert.equal(f.docs.get("studentData/alma").coins, 100);
  });

  it("krock varje gång → ger upp efter forsok varv", async () => {
    const f = fakeDb({ "studentData/alma": { coins: 100 } }, {
      fore: (p, n, docs) => docs.set(p, { coins: docs.get(p).coins + 1 }),
    });
    const ut = await pay(f, { alma: REWARDS.alma }, { forsok: 3 });
    assert.equal(ut[0].status, "nekad");
    assert.equal(f.varv.get("studentData/alma"), 3);
    assert.ok(KROCK_FORSOK >= 3);
  });

  it("andra fel (unavailable) körs inte om", async () => {
    const f = fakeDb({ "studentData/alma": { coins: 100 } }, { annatFel: "unavailable" });
    const ut = await pay(f, { alma: REWARDS.alma });
    assert.deepEqual([ut[0].status, ut[0].fel], ["nekad", "unavailable"]);
    assert.equal(f.varv.get("studentData/alma"), 1);
  });

  it("utan krock: ett varv per elev, saknat dokument skapas med defaults", async () => {
    const f = fakeDb({});
    const ut = await pay(f, REWARDS, { defaults: () => ({ xp: 0 }) });
    assert.ok(ut.every((r) => r.status === "betald"));
    assert.deepEqual(f.docs.get("studentData/bo"), { xp: 0, coins: 441 });
    assert.deepEqual([...f.varv.values()], [1, 1]);
  });
});
