// ============================================================================
// Enhetstest för data-lagrets session-cache (createTtlCache) – #274.
//
// createTtlCache är den rena, Firebase-fria cache-kärnan som data.js/
// data-content.js/data-classes.js använder INLINE för getStudentData/
// getSubjects/getAreas/getArea/getClasses. Här bevisas cache-LOGIKEN isolerat
// med en injicerad klocka (now) och en FEJK-läsare som RÄKNAR läsningar:
//   • hit/miss: andra anropet inom TTL läser inte om (0 nya läsningar)
//   • TTL: efter TTL hämtas färskt
//   • invalidering: efter en skriv-väg (invalidate) läses färskt nästa gång
//   • färskhet: en ändrad lärar-hiddenModes syns efter invalidering/TTL
//   • nyckel-isolering: olika nycklar (t.ex. per studentId) delar inte värde
// Körs browser-fritt:  node --test test/data-cache.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { createTtlCache } from "../src/class-projection-entries.js";

/** En fejk-läsare som RÄKNAR anrop och returnerar det aktuella `box.value`. */
function counter(box) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    loader: async () => {
      calls++;
      return box.value;
    },
  };
}

test("hit inom TTL: andra anropet läser inte om (0 nya läsningar)", async () => {
  let clock = 1000;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  const box = { value: "A" };
  const c = counter(box);

  assert.equal(await cache.read("k", c.loader), "A");
  assert.equal(c.calls, 1);

  clock += 10_000; // fortfarande inom TTL
  assert.equal(await cache.read("k", c.loader), "A");
  assert.equal(c.calls, 1, "andra anropet inom TTL ska INTE köra loadern");
});

test("miss efter TTL: färskt värde hämtas på nytt", async () => {
  let clock = 1000;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  const box = { value: "gammal" };
  const c = counter(box);

  assert.equal(await cache.read("k", c.loader), "gammal");
  assert.equal(c.calls, 1);

  clock += 30_001; // precis över TTL
  box.value = "färsk";
  assert.equal(await cache.read("k", c.loader), "färsk");
  assert.equal(c.calls, 2, "efter TTL ska loadern köra igen");
});

test("invalidering (egen skrivning): nästa läsning är färsk direkt", async () => {
  let clock = 5000;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  const box = { value: { coins: 100 } };
  const c = counter(box);

  assert.deepEqual(await cache.read("elev1", c.loader), { coins: 100 });
  assert.equal(c.calls, 1);

  // Simulera en egen skrivning (t.ex. buyItem drar coins) + invalidering.
  box.value = { coins: 40 };
  cache.invalidate("elev1");

  // Ingen tid har gått, men cachen är invaliderad → färskt saldo läses.
  assert.deepEqual(await cache.read("elev1", c.loader), { coins: 40 });
  assert.equal(c.calls, 2, "efter invalidate ska loadern köra igen");
});

test("färskhet: ändrad lärar-hiddenModes syns efter TTL utan hård-omladdning", async () => {
  let clock = 0;
  const cache = createTtlCache({ now: () => clock, ttlMs: 20_000 });
  const area = { value: { id: "vikingatiden", hiddenModes: [] } };
  const c = counter(area);

  const first = await cache.read("area/so/vikingatiden", c.loader);
  assert.deepEqual(first.hiddenModes, []);

  // Läraren döljer ett läge (skriver i EN ANNAN session → ingen invalidering här).
  area.value = { id: "vikingatiden", hiddenModes: ["memory"] };

  // Inom TTL ser eleven fortfarande gammalt (cachat) – men snappigt.
  clock += 5_000;
  assert.deepEqual((await cache.read("area/so/vikingatiden", c.loader)).hiddenModes, []);
  assert.equal(c.calls, 1);

  // Vid nästa navigering efter TTL hämtas färskt automatiskt (ingen hard-refresh).
  clock += 20_000;
  assert.deepEqual(
    (await cache.read("area/so/vikingatiden", c.loader)).hiddenModes,
    ["memory"]
  );
  assert.equal(c.calls, 2);
});

test("nyckel-isolering: olika studentId delar inte cachad studentData", async () => {
  let clock = 100;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  const loadA = async () => ({ coins: 1 });
  const loadB = async () => ({ coins: 2 });

  assert.deepEqual(await cache.read("elevA", loadA), { coins: 1 });
  assert.deepEqual(await cache.read("elevB", loadB), { coins: 2 });
  // Andra anropet per nyckel serverar RÄTT elevs värde ur cachen.
  assert.deepEqual(await cache.read("elevA", loadB), { coins: 1 });
  assert.deepEqual(await cache.read("elevB", loadA), { coins: 2 });
});

test("clear() tömmer allt (in-/utloggning)", async () => {
  let clock = 0;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  const c = counter({ value: "x" });

  await cache.read("k", c.loader);
  assert.equal(c.calls, 1);
  cache.clear();
  await cache.read("k", c.loader);
  assert.equal(c.calls, 2, "efter clear ska loadern köra igen");
});

test("set() skriver in ett färskt värde utan loader (t.ex. transaktions-saldo)", async () => {
  let clock = 0;
  const cache = createTtlCache({ now: () => clock, ttlMs: 30_000 });
  cache.set("elev1", { coins: 999 });
  const c = counter({ value: { coins: 0 } });
  assert.deepEqual(await cache.read("elev1", c.loader), { coins: 999 });
  assert.equal(c.calls, 0, "ett färskt set-värde ska serveras utan att loadern körs");
});

test("has()/getFresh() speglar TTL-fönstret", async () => {
  let clock = 0;
  const cache = createTtlCache({ now: () => clock, ttlMs: 10_000 });
  cache.set("k", 42);
  assert.equal(cache.has("k"), true);
  assert.equal(cache.getFresh("k"), 42);
  clock += 10_001;
  assert.equal(cache.has("k"), false);
  assert.equal(cache.getFresh("k"), undefined);
});
