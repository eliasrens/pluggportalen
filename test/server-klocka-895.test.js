// ============================================================================
// #895: serverNow()/syncServerClock() (src/data-class-lock.js) mot ett CDN-svar som
// www.pluggporten.se (GitHub Pages/Fastly, max-age=600): Date = när svaret levererades,
// Age = hur länge det legat i cachen. Klockan får INTE räkna in Age – förr blev den
// upp till 10 minuter för snabb (vänskapsmatchens tid "ute" direkt).
// Varje fall laddar modulen på nytt (syncServerClock mäter en gång per session).
// ============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";

installeraFirebaseStubbe();
let nr = 0;
/** Modulen med ett påhittat HEAD-svar: serverns klocka `fore` ms före klientens, Age sekunder. */
async function klocka({ fore = 0, age = null, date = true }) {
  globalThis.location = { href: "https://www.pluggporten.se/#/elev/matchdagen" };
  globalThis.fetch = async (url, opt) => {
    assert.equal(opt.method, "HEAD");
    assert.ok(!String(url).includes("#"));
    const h = new Map();
    if (date) h.set("date", new Date(Date.now() + fore).toUTCString());
    if (age != null) h.set("age", String(age));
    return { headers: { get: (k) => h.get(k.toLowerCase()) ?? null } };
  };
  const m = await import(`../src/data-class-lock.js?k=${nr++}`);
  await m.syncServerClock();
  return m.serverNow() - Date.now();
}

test("ett cachat svar (Age 300 s, Date = nu): klockan går rätt, inte 5 minuter före", async () => {
  const d = await klocka({ age: 300 });
  assert.ok(Math.abs(d) < 5000, `avvikelse ${d} ms`);
});

test("Age 600 s (CDN:ets max-age): fortfarande ingen avvikelse", async () => {
  assert.equal(await klocka({ age: 600 }), 0);
});

test("en klient vars klocka går 2 minuter fel korrigeras fortfarande (Date)", async () => {
  const d = await klocka({ fore: 120_000, age: 45 });
  assert.ok(Math.abs(d - 120_000) < 2000, `avvikelse ${d} ms`);
  const e = await klocka({ fore: -90_000 });
  assert.ok(Math.abs(e + 90_000) < 2000, `avvikelse ${e} ms`);
});

test("under 5 s ignoreras, och utan Date litar klienten på sin klocka", async () => {
  assert.equal(await klocka({ fore: 3000 }), 0);
  assert.equal(await klocka({ date: false, age: 300 }), 0);
});
