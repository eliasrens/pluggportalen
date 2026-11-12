// ============================================================================
// Kurragömma G (#842) – serverkärnan mot emulatorerna (functions-kurragomma-core-
// riggen: styrd klocka/slump, eget minne per deps()):
//   1. LAS_MARGINAL_MS 5 s: kgLas 4 s efter kgGomSlut tas emot, 6 s efter nekas
//      (failed-precondition) och servern placerar gömmaren (autoPlacerad) i kgTick
//   4. perQuestion ur kgPlayers.fragor: kgSvara räknar per fråga i samma update,
//      kgAvsluta ger SAMMA siffror som fragestatistik(answers) gav – multiplikation
//      och quiz (text/statKeys) – och läser INTE answers (räknande Firestore ur
//      admin/kvot-raknare.mjs); ett upprepat attemptId (klientens omförsök) räknas inte två gånger.
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, las, svara, tick, avsluta } from "../functions/kurragomma-core.js";
import { fragestatistik } from "../functions/meteorstorm-resultat.js";
import { skapaRaknandeFirestore } from "../admin/kvot-raknare.mjs";
import { LAS_MARGINAL_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";
import {
  ctl, deps, T0, GOMSLUT, END, ELEVER, makeSession, makeQuiz, QUESTIONS, kgPlayer, secret, session, answers, puls, att, mult, code, db,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const svar = (d, sid, uid, a, b, ratt) => svara(d, uid, { sid, attemptId: att(), ...mult(a, b, ratt ? a * b : a * b + 1) });

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

/** Letfasen med alla gömmare låsta (alma sökare); klockan strax efter placeringen. */
async function letfas(sid, d) {
  await starta(d, LARARE, { sid });
  for (const [u, x, z] of [["bo", 5, 5], ["cleo", -10, 8], ["dina", -10, 10], ["emil", 12, 14]]) await las(d, u, { sid, x, z });
  ctl.clock = GOMSLUT + LAS_MARGINAL_MS + 1000;
  for (const u of ELEVER) await puls(sid, u, ctl.clock);
  await tick(d, LARARE, { sid });
}

describe("Kurragömma #842 (1): låsmarginalen 5 s", () => {
  it("kgLas 4 s efter gömslutet tas emot (egen plats), 6 s efter nekas och servern placerar", async () => {
    assert.equal(LAS_MARGINAL_MS, 5000);
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    ctl.clock = GOMSLUT + 4000;
    const r = await las(d, "bo", { sid, x: 5, z: 5 });
    assert.equal(r.redan, false);
    assert.equal((await kgPlayer(sid, "bo")).harLast, true);
    assert.equal((await secret(sid, "bo")).auto, undefined, "egen plats, inte serverns");
    assert.equal((await session(sid)).kgPlacerade, undefined, "ingen placering före marginalen");
    ctl.clock = GOMSLUT + 6000;
    assert.equal(await code(las(deps(), "cleo", { sid, x: -10, z: 8 })), "failed-precondition");
    for (const u of ELEVER) await puls(sid, u, ctl.clock);
    await tick(deps(), LARARE, { sid });
    assert.equal((await session(sid)).kgPlacerade, true);
    const cleo = await kgPlayer(sid, "cleo");
    assert.deepEqual({ harLast: cleo.harLast, auto: cleo.autoPlacerad }, { harLast: true, auto: true });
    assert.equal((await secret(sid, "cleo")).auto, true);
    assert.equal((await secret(sid, "bo")).auto, undefined, "bo:s egna plats står kvar");
  });

  it("precis före marginalen (4,9 s) tas emot, precis vid (5,0 s) nekas", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS - 100;
    assert.equal(await code(las(d, "bo", { sid, x: 5, z: 5 })), "ok");
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS;
    assert.equal(await code(las(d, "cleo", { sid, x: -10, z: 8 })), "failed-precondition");
  });
});

describe("Kurragömma #842 (4): perQuestion ur kgPlayers.fragor", () => {
  it("multiplikation: en fast serie svar ger samma perQuestion som fragestatistik(answers), räknarna ligger i kgPlayers, ett upprepat attemptId räknas en gång och kgAvsluta läser inte answers", async () => {
    const sid = await makeSession();
    const d = deps();
    await letfas(sid, d);
    // Fast serie: 3×4 (alma rätt, bo fel, cleo rätt), 4×3 (samma nyckel: dina rätt), 7×8 (alma fel ×2), 0×0 (emil rätt).
    const serie = [["alma", 3, 4, true], ["bo", 3, 4, false], ["cleo", 3, 4, true], ["dina", 4, 3, true], ["alma", 7, 8, false], ["alma", 7, 8, false], ["emil", 0, 0, true]];
    for (const [u, a, b, ratt] of serie) { ctl.clock += 3000; await svar(d, sid, u, a, b, ratt); }
    const igen = att();
    ctl.clock += 3000;
    await svara(d, "emil", { sid, attemptId: igen, ...mult(0, 0, 1) });
    ctl.clock += 3000;
    assert.equal((await svara(d, "emil", { sid, attemptId: igen, ...mult(0, 0, 1) })).igen, true, "samma svar igen");
    assert.deepEqual((await kgPlayer(sid, "emil")).fragor, { m0x0: { a: 2, r: 1 } });
    const alma = await kgPlayer(sid, "alma");
    assert.deepEqual(alma.fragor, { m3x4: { a: 1, r: 1 }, m7x8: { a: 2, r: 0 } });
    assert.deepEqual((await kgPlayer(sid, "bo")).fragor, { m3x4: { a: 1, r: 0 } });
    assert.deepEqual((await kgPlayer(sid, "dina")).fragor, { m3x4: { a: 1, r: 1 } }, "4×3 räknas på samma nyckel som 3×4");
    const fore = fragestatistik(await answers(sid), null);
    assert.equal(fore.length, 3);
    const { db: raknande, server } = skapaRaknandeFirestore(db, (p) => String(p).replace(/^.*\//, ""));
    ctl.clock = END + 1000;
    const { result } = await avsluta({ ...deps(), db: raknande }, LARARE, { sid });
    assert.deepEqual(result.perQuestion, fore);
    assert.deepEqual(result.perQuestion.map((q) => [q.text, q.answered, q.correct]), [["0 × 0", 2, 1], ["3 × 4", 4, 3], ["7 × 8", 2, 0]]);
    assert.deepEqual(result.perQuestion[1].byClass, { "4b": { answered: 4, correct: 3 } });
    assert.deepEqual({ totalAnswered: result.totalAnswered, totalCorrect: result.totalCorrect }, { totalAnswered: 8, totalCorrect: 4 });
    const lasta = Object.keys(server.perSort).filter((k) => k.startsWith("läs"));
    assert.ok(lasta.some((k) => k.includes("kgPlayers")), lasta.join(", "));
    assert.ok(!lasta.some((k) => k.includes("answers")), `answers lästes: ${lasta.join(", ")}`);
  });

  it("quiz: text och statKeys ur frågorna, byClass, samma som förr (första frågan är fri, sedan nextQ)", async () => {
    const sid = await makeQuiz();
    const d = deps();
    await letfas(sid, d);
    const q = (u, i, choiceIndex) => svara(d, u, { sid, attemptId: att(), q: i, choiceIndex });
    ctl.clock += 3000; await q("alma", 0, 0); // rätt
    ctl.clock += 3000; await q("bo", 0, 1); // fel
    ctl.clock += 3000; await q("cleo", 1, 1); // rätt
    ctl.clock += 3000;
    const r1 = await q("dina", 2, 0); // fel
    ctl.clock += 3000;
    const r2 = await q("dina", r1.nextQ, r1.nextQ); // frågan servern gav, rätt (facit = index)
    assert.equal(r2.correct, true);
    assert.deepEqual((await kgPlayer(sid, "dina")).fragor, { q2: { a: 1, r: 0 }, [`q${r1.nextQ}`]: { a: 1, r: 1 } });
    const fore = fragestatistik(await answers(sid), QUESTIONS);
    ctl.clock = END + 1000;
    const { result } = await avsluta(d, LARARE, { sid });
    assert.deepEqual(result.perQuestion, fore);
    const vantat = [["q:0", "Fråga 0", ["k0"], 2, 1], ["q:1", "Fråga 1", [], 1, 1], ["q:2", "Fråga 2", [], 1, 0]];
    vantat[r1.nextQ][3]++;
    vantat[r1.nextQ][4]++;
    assert.deepEqual(result.perQuestion.map((x) => [x.key, x.text, x.statKeys, x.answered, x.correct]), vantat);
  });
});
