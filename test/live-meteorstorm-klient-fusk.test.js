// ============================================================================
// Meteorstormen (#821) – TESTARENS race-test av elevklienten (ms-klient.js):
// felbufferten när ett ensamt fel-anrop (bufferten blev MS_FEL_SKICKA lång)
// fortfarande är på väg och ett rätt svar + handling skickas under tiden.
// Fynd som inte är rättade står som todo-tester (F-numren i testarens rapport).
// Körs via:  node --test test/live-meteorstorm-klient-fusk.test.js
// ============================================================================

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import { MS_FEL_SKICKA } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";

function rigg() {
  const skickade = new Set();
  const vantande = [];
  const call = (namn, d) => {
    for (const f of d.fel || []) skickade.add(f.attemptId);
    if (namn === "msAgera" && !d.svar) {
      // Det ensamma fel-anropet hänger kvar tills testet släpper det.
      return new Promise((res) => vantande.push(() => res({ ok: true, fel: d.fel.length })));
    }
    return Promise.resolve({ correct: true, nr: (d.nr || 1), energi: 1, typ: d.typ });
  };
  const k = createMsKlient({ sid: "s", uid: "alma", seed: 1, gameMode: "multiplication_0_10", call, vanta: async () => {} });
  let n = 0;
  const fel = (namn = `f${n++}`) => k.svara({ attemptId: namn, factorA: 2, factorB: 3, answer: "7" }).then(() => namn);
  return { k, skickade, vantande, fel };
}

describe("elevklienten: felbufferten under ett pågående fel-anrop", () => {
  it("F7: inget fel svar tappas när agera och det ensamma fel-anropet korsar varandra", { todo: "F7 – skickaFel tar bort de första N posterna, inte de den skickade" }, async () => {
    const { k, skickade, vantande, fel } = rigg();
    const alla = [];
    for (let i = 0; i < MS_FEL_SKICKA; i++) alla.push(await fel()); // → fel-anropet startar och hänger
    assert.equal(vantande.length, 1);
    alla.push(await fel(), await fel());
    await k.svara({ attemptId: "ratt-1", factorA: 2, factorB: 3, answer: "6" });
    await k.agera("laser"); // skickar hela bufferten (27) och tömmer den
    alla.push(await fel(), await fel(), await fel()); // tre nya fel svar i bufferten
    vantande.shift()(); // nu kommer fel-anropets svar
    await new Promise((r) => setTimeout(r, 0));
    const kvar = k.buffert.map((f) => f.attemptId);
    const tappade = alla.filter((a) => !skickade.has(a) && !kvar.includes(a));
    assert.deepEqual(tappade, [], `tappade fel svar: ${tappade}`);
  });
});
