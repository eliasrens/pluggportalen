// ============================================================================
// Bråkresan #709 D: omgångsvyns testomgång (demoBackend) och resultathjälpare.
// demoBackend följer serverns regler (§5): första giltiga svaret låser,
// inmatningsfel låser inte, bearbetning ändrar aldrig poängen, ingen
// avslutning före tio svar – och lovar aldrig stjärnor eller mynt.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { demoBackend } from "../src/brakresan/omgang-backend.js";
import { forslag, svarText } from "../src/brakresan/omgang-resultat.js";

test("demoBackend: tio publika uppgifter utan facit, återupptagning ger samma omgång", async () => {
  const b = demoBackend("03", { seed: "t1" });
  const { roundId, round, resumed } = await b.start();
  assert.equal(resumed, false);
  assert.equal(round.tasks.length, 10);
  for (const t of round.tasks) for (const k of ["key", "feedback", "review", "params", "values", "core"]) assert.ok(!(k in t), k);
  const igen = await b.start();
  assert.equal(igen.resumed, true);
  assert.equal(igen.roundId, roundId);
  assert.equal((await b.state()).activeRoundId, roundId);
});

test("demoBackend: första giltiga svaret låser, inmatningsfel låser inte, bearbetning ändrar inte poängen", async () => {
  const b = demoBackend("03", { seed: "t2" });
  const { roundId } = await b.start();
  const t0 = b.fullTask(0);
  const tom = await b.answer(roundId, 0, { selected: [] }, []);
  assert.equal(tom.status, "invalid");
  const fel = await b.answer(roundId, 0, t0.key.examples.wrong[0], ["orientering"]);
  assert.equal(fel.correct, false);
  assert.ok(fel.reveal.feedback.wrong);
  const igen = await b.answer(roundId, 0, t0.key.examples.right[0], []);
  assert.equal(igen.correct, false, "låst första svar");
  assert.equal(igen.already, true);
  const rw = await b.rework(roundId, 0, { answer: t0.key.examples.right[0] });
  assert.equal(rw.correct, true);
  assert.equal(igen.correctCount, 0);
  await assert.rejects(() => b.finish(roundId), /tio/);
});

test("demoBackend: hela omgången 8/10 → resultat utan stjärna och mynt", async () => {
  const b = demoBackend("12", { seed: "t3" });
  const { roundId } = await b.start();
  for (let i = 0; i < 10; i++) {
    const t = b.fullTask(i);
    await b.answer(roundId, i, i === 2 || i === 6 ? t.key.examples.wrong[0] : t.key.examples.right[0], []);
  }
  const fin = await b.finish(roundId);
  assert.equal(fin.correctCount, 8);
  assert.equal(fin.reward.coins, 0);
  assert.equal(fin.reward.kind, "ingen");
  assert.match(fin.message, /Inga stjärnor eller mynt sparas/);
});

test("forslag: två tidigare utmaningar, helst med samma kunskapstagg", () => {
  assert.deepEqual(forslag("19").map((f) => f.id).length, 2);
  assert.equal(forslag("19")[0].id, "18");
  assert.equal(forslag("01").length, 0);
});

test("svarText beskriver elevens eget svar utan facit", () => {
  assert.equal(svarText({ answer: { type: "paint", parts: ["p0", "p1", "p2"] } }, { selected: ["p1"] }), "Du markerade 1 av 3 delar.");
  assert.equal(svarText({ answer: { type: "point" }, view: { ticks: 8 } }, { value: { n: 3, d: 4 } }), "Du placerade punkten på streck 6 av 8 från 0.");
  assert.equal(svarText({ answer: { type: "multi", parts: { a: {}, b: {}, summa: {} } } },
    { parts: { a: { fields: { n: "2", d: "4" } }, b: { fields: { n: "1", d: "4" } }, summa: { fields: { n: "3", d: "8" } } } }),
  "Du skrev 2/4, 1/4, 3/8.");
});
