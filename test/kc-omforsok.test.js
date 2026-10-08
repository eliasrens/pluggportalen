// Tester för kc-omforsok.js (#493): krock körs om med backoff, oförändrat
// läge = verkligt nekad, försöken tar slut, andra fel kastas direkt.
// Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE, vantetid } from "../src/klasscenter/kc-omforsok.js";

const krock = (code = "permission-denied") => Object.assign(new Error(code), { code });
const vanta = async () => {};

describe("medKrockOmforsok", () => {
  it("krock med nytt läge varje gång körs om tills det går", async () => {
    let n = 0;
    const r = await medKrockOmforsok((ctx) => {
      if (sammaSomNekat(ctx, `v${n}`)) return SAMMA_LAGE;
      if (++n < 6) throw krock(n % 2 ? "permission-denied" : "aborted");
      return "ok";
    }, { forsok: 10, vanta });
    assert.equal(r, "ok");
    assert.equal(n, 6);
  });
  it("samma läge efter nekat försök → verkligt nekad (krock=false), inga fler varv", async () => {
    let varv = 0;
    await assert.rejects(medKrockOmforsok((ctx) => {
      varv++;
      if (sammaSomNekat(ctx, "samma")) return SAMMA_LAGE;
      throw krock();
    }, { forsok: 10, vanta }), (e) => e.krock === false && e.code === "permission-denied");
    assert.equal(varv, 2);
  });
  it("försöken tar slut → krock=true", async () => {
    let varv = 0;
    await assert.rejects(medKrockOmforsok((ctx) => {
      sammaSomNekat(ctx, `v${++varv}`);
      throw krock();
    }, { forsok: 4, vanta }), (e) => e.krock === true);
    assert.equal(varv, 4);
  });
  it("andra fel (unavailable) kastas direkt och orörda", async () => {
    let varv = 0;
    await assert.rejects(medKrockOmforsok(() => { varv++; throw krock("unavailable"); }, { forsok: 10, vanta }),
      (e) => e.code === "unavailable" && e.krock === undefined);
    assert.equal(varv, 1);
  });
  it("väntetiderna: exponentiell med full jitter och tak", async () => {
    const tider = [];
    let n = 0;
    await assert.rejects(medKrockOmforsok((ctx) => { sammaSomNekat(ctx, n++); throw krock(); },
      { forsok: 4, vanta: async (ms) => tider.push(ms) }));
    assert.equal(tider.length, 3);
    assert.equal(vantetid(1, () => 0), 30);
    assert.equal(vantetid(1, () => 1), 60);
    assert.equal(vantetid(3, () => 1), 240);
    assert.equal(vantetid(20, () => 1), 1500);
    for (let v = 1; v < 12; v++) assert.ok(vantetid(v) >= 30 && vantetid(v) <= 1500);
  });
});
