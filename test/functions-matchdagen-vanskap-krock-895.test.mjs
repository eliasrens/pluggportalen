// ============================================================================
// #895: krockar mellan vänskapsmatchens transaktioner (functions/md-vanskap-state.js snabbTx).
//   två svar SAMTIDIGT (transaktionerna läser varandras privat-dokument): läget avgörs exakt en gång
//   snabbTx: ABORTED görs om direkt (SDK:t väntar annars 1 s ± 50 % före andra försöket), MdFel går
//   rakt igenom, nätfel får SDK:ts vanliga omförsök
// Emulatorn löser en krock med en låstimeout (2 s) – i drift avbryter Firestore den yngre direkt
// (wound-wait), så tiden här är inget mått på driften. `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { fraga, svar, snabbTx, MdFel } from "../functions/md-vanskap-spel.js";
import { vLage } from "../src/matchdagen/delat/md-vanskap.js";
import { createMvRig, KLASS, ANNA, BO } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvkrock");
const { deps, ctl } = rig;
before(() => rig.rensa());
after(() => rig.app.delete());
beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-11-20T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
});

async function starta() {
  const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
  return (await svara(deps, BO, { utmaningId, ja: true })).matchId;
}
async function svaret(id, uid, nr) {
  const { bank } = await rig.facit(id, uid);
  const p = bank[(nr - 1) % bank.length];
  return p.pub.typ === "flerval" ? p.pub.alternativ.indexOf(p.r.facit) : p.r.facit;
}
/** Båda väljer; svaren klara att skicka. */
async function forbered(id) {
  const m = await rig.match(id);
  const l = vLage(m.V);
  await fraga(deps, ANNA, { matchId: id, val: l.anf === "a" ? "kort" : "tackla" });
  await fraga(deps, BO, { matchId: id, val: l.anf === "b" ? "kort" : "tackla" });
  return { nr: m.fas.nr, h: m.h?.nr ?? 0, sa: await svaret(id, ANNA, m.fas.nr), sb: await svaret(id, BO, m.fas.nr) };
}

describe("två svar samtidigt (#895)", () => {
  it("läget avgörs exakt en gång, båda svaren räknas", async () => {
    const id = await starta();
    for (let i = 0; i < 3; i++) {
      const f = await forbered(id);
      const [ra, rb] = await Promise.all([svar(deps, ANNA, { matchId: id, svar: f.sa }), svar(deps, BO, { matchId: id, svar: f.sb })]);
      assert.deepEqual([ra.ratt, rb.ratt], [true, true]);
      const m = await rig.match(id);
      assert.equal(m.fas.nr, f.nr + 1, "ett läge framåt");
      assert.equal(m.h.nr, f.h + 1, "en händelse");
      assert.deepEqual([m.h.ratt.a, m.h.ratt.b], [true, true]);
    }
  });
});

describe("snabbTx", () => {
  const falsk = (fel) => {
    const anrop = [];
    return { anrop, c: { db: { runTransaction: async (fn, o) => { anrop.push(o?.maxAttempts ?? "sdk"); const e = fel.shift(); if (e) throw e; return fn("tx"); } } } };
  };
  const grpc = (code) => Object.assign(new Error(`grpc ${code}`), { code });

  it("ABORTED görs om direkt med ett försök i taget", async () => {
    const { c, anrop } = falsk([grpc(10), grpc(10)]);
    assert.equal(await snabbTx(c, async (tx) => `ok ${tx}`), "ok tx");
    assert.deepEqual(anrop, [1, 1, 1]);
  });
  it("efter fem krockar: SDK:ts vanliga omförsök", async () => {
    const { c, anrop } = falsk([grpc(10), grpc(10), grpc(10), grpc(10), grpc(10)]);
    assert.equal(await snabbTx(c, async () => "ok"), "ok");
    assert.deepEqual(anrop, [1, 1, 1, 1, 1, "sdk"]);
  });
  it("nätfel (UNAVAILABLE) → SDK:ts omförsök; MdFel och andra fel går rakt igenom", async () => {
    let f = falsk([grpc(14)]);
    assert.equal(await snabbTx(f.c, async () => "ok"), "ok");
    assert.deepEqual(f.anrop, [1, "sdk"]);
    f = falsk([new MdFel("failed-precondition", "Matchen är slut.")]);
    await assert.rejects(snabbTx(f.c, async () => "ok"), /Matchen är slut/);
    assert.deepEqual(f.anrop, [1]);
    f = falsk([Object.assign(new Error("3 INVALID_ARGUMENT: The referenced transaction has expired"), { code: 3 })]);
    assert.equal(await snabbTx(f.c, async () => "ok"), "ok", "utgången transaktion → SDK:ts omförsök");
    f = falsk([grpc(3)]);
    await assert.rejects(snabbTx(f.c, async () => "ok"), /grpc 3/);
    f = falsk([grpc(7)]);
    await assert.rejects(snabbTx(f.c, async () => "ok"), /grpc 7/);
  });
});
