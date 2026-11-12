// ============================================================================
// Kurragömma F (#841, kvoten §5.5): kgLeta sållar kandidater ur instansens
// MINNE av gömställena (gomstallenFor) i stället för att läsa alla gömdas
// kgSecret per sökning. Här visas att minnet aldrig kan ge fel utfall:
//   • en gömmare som blivit sökare på en ANNAN instans (hittad / befordrad av
//     kgTick) hittas inte igen från den gamla instansens minne
//   • den som låser sent (inom LAS_MARGINAL_MS) finns med – minnet fylls först
//     när kgPlacerade är satt, och efter det nekas kgLas
//   • visslingsfönstret (1,5× radie) avgörs ur färsk kgSecret, inte ur minnet
//   • minnet rensas vid slutet och är begränsat till MINNE_SESSIONER matcher
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, anslut, las, svara, leta, tick, avsluta } from "../functions/kurragomma-core.js";
import { gomstallenFor, nyttMinne, MINNE_SESSIONER } from "../functions/kurragomma-sess.js";
import { LAS_MARGINAL_MS, LETA_SPARR_MS, FRANKOPPLAD_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { maxSokradie } from "../src/live/formats/kurragomma/delat/kg-regler.js";
import {
  ctl, deps, T0, GOMSLUT, END, ELEVER, makeSession, kgPlayer, secret, session, kanal, puls, pos, att, mult, code, LADA, db,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const ANGEN = { x: 8, z: -12 };
const BO = { x: LADA.x + LADA.r + 0.3, z: LADA.z }; // skydd 2 → sökradie 1,3 m
const svar = (d, sid, uid, ratt = true) => svara(d, uid, { sid, attemptId: att(), ...mult(3, 4, ratt ? 12 : 13) });

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

/** Som leta-testets letfas: alma sökare, bo vid ladan, cleo på ängen; letfasen 5 s gammal (kgPlacerade satt). */
async function letfas({ laddningar = 3, lasCleo = true } = {}) {
  ctl.clock = T0 + 1000;
  const sid = await makeSession();
  const d = deps();
  await starta(d, LARARE, { sid });
  await las(d, "bo", { sid, ...BO });
  if (lasCleo) await las(d, "cleo", { sid, ...ANGEN });
  await las(d, "dina", { sid, x: -10, z: 10 });
  await las(d, "emil", { sid, x: 12, z: 14 });
  for (let i = 0; i < laddningar; i++) await svar(d, sid, "alma");
  ctl.clock = GOMSLUT + 5000;
  for (const u of ELEVER) await puls(sid, u, ctl.clock);
  await tick(d, LARARE, { sid });
  return { sid, d };
}

describe("Kurragömma #841: gömställena i instansens minne", () => {
  it("fylls vid första sökningen efter kgPlacerade med alla gömda, och en ny instans läser själv", async () => {
    const { sid, d } = await letfas();
    assert.equal(d.minne.gomstallen.has(sid), false);
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    const g = d.minne.gomstallen.get(sid);
    assert.deepEqual([...g.keys()].sort(), ["bo", "cleo", "dina", "emil"]);
    assert.deepEqual(g.get("bo"), { x: BO.x, z: BO.z });
    const d2 = deps();
    const s = await session(sid);
    const g2 = await gomstallenFor(d2, sid, s);
    assert.notEqual(g2, g, "egen Map per instans");
    assert.deepEqual([...g2.keys()].sort(), ["bo", "cleo", "dina", "emil"]);
    assert.equal(await gomstallenFor(d2, sid, { ...s, kgPlacerade: false }), null, "före placeringen: inget minne, alla gömda läses");
  });

  it("en gömmare som hittats på en ANNAN instans hittas inte igen ur det gamla minnet (kgPlayers avgör)", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 }); // fyller instans 1:s minne – bo är gömd där
    // Gus blir sökare och hittar bo via instans 2.
    await db.doc(`liveSessions/${sid}/players/gus`).set({ uid: "gus", classId: "4b", name: "Gus", correct: 0, incorrect: 0 });
    const d2 = deps();
    await anslut(d2, "gus", { sid });
    ctl.clock = GOMSLUT + 30_000;
    const r2 = await leta(d2, "gus", { sid, x: BO.x + 1, z: BO.z });
    assert.deepEqual(r2.hittade.map((h) => h.uid), ["bo"]);
    assert.equal(d.minne.gomstallen.get(sid).has("bo"), true, "instans 1 vet inget om det");
    // Alma letar på samma ställe från instans 1: bo är sökare – ingen träff, inga poäng, ingen händelse till.
    ctl.clock = GOMSLUT + 50_000;
    const almaFore = await kgPlayer(sid, "alma");
    const r1 = await leta(d, "alma", { sid, x: BO.x + 1, z: BO.z });
    assert.deepEqual(r1.hittade, []);
    const alma = await kgPlayer(sid, "alma");
    assert.deepEqual({ hittade: alma.hittade, poang: alma.poang }, { hittade: almaFore.hittade, poang: almaFore.poang });
    const bo = await kgPlayer(sid, "bo");
    assert.deepEqual({ roll: bo.roll, hittadAv: bo.hittadAv }, { roll: "sokare", hittadAv: "gus" });
    assert.equal(Object.values((await kanal(sid)).hand).filter((h) => h.typ === "hittad").length, 1);
    assert.equal(r1.flode, true, "en miss är en miss");
  });

  it("en gömmare som kgTick gjort till sökare (ingen sökare ansluten) hittas inte heller ur minnet", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    // Ingen sökare pulsar i RTDB → kgTick på instans 2 gör bo (rng 0 → första i sorteringen) till sökare.
    ctl.clock = GOMSLUT + 10_000 + FRANKOPPLAD_MS + 1000;
    for (const u of ELEVER) await puls(sid, u, ctl.clock);
    const t = await tick(deps(), LARARE, { sid });
    assert.equal(t.nySokare, "bo");
    assert.equal((await kgPlayer(sid, "bo")).roll, "sokare");
    ctl.clock += 10_000;
    await pos(sid, "alma", { x: BO.x + 1, z: BO.z, t: ctl.clock });
    const r = await leta(d, "alma", { sid, x: BO.x + 1, z: BO.z });
    assert.deepEqual(r.hittade, []);
    assert.equal((await kgPlayer(sid, "alma")).hittade, 0);
  });

  it("den som låser sent (inom marginalen) finns i minnet – det fylls först när kgPlacerade är satt; efter det nekas kgLas", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...BO });
    for (let i = 0; i < 3; i++) await svar(d, sid, "alma");
    // Letfasen har börjat men marginalen har inte gått: cleo är fortfarande olåst.
    ctl.clock = GOMSLUT + 500;
    for (const u of ELEVER) await puls(sid, u, ctl.clock);
    await tick(d, LARARE, { sid });
    assert.equal((await session(sid)).kgPlacerade, undefined);
    const r0 = await leta(d, "alma", { sid, x: 1, z: 1 });
    assert.deepEqual(r0.hittade, []);
    assert.equal(d.minne.gomstallen.has(sid), false, "inget minne före placeringen");
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS - 500;
    const l = await las(deps(), "cleo", { sid, ...ANGEN }); // sent, på en annan instans
    assert.equal(l.redan, false);
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS + 100;
    await tick(deps(), LARARE, { sid }); // placerar dina och emil, sätter kgPlacerade
    assert.equal((await session(sid)).kgPlacerade, true);
    assert.equal(await code(las(deps(), "dina", { sid, x: 0, z: 0 })), "failed-precondition", "ingen lås efter marginalen");
    // Alma går från brunnen mot ängen – rimligt på 20 s (startpunkten sattes vid letStart).
    ctl.clock = GOMSLUT + 25_000;
    const r = await leta(d, "alma", { sid, x: ANGEN.x + 1, z: ANGEN.z });
    assert.deepEqual(r.hittade.map((h) => h.uid), ["cleo"]);
    const g = d.minne.gomstallen.get(sid);
    assert.deepEqual([...g.keys()].sort(), ["bo", "dina", "emil"], "cleo är hittad och struken ur minnet; de auto-placerade finns med");
    assert.equal((await kgPlayer(sid, "dina")).autoPlacerad, true);
  });

  it("visslingsfönstret avgörs ur färsk kgSecret: en vissling på en annan instans ger 1,5× radie även med minnet", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    ctl.clock = GOMSLUT + 20_000;
    await svar(deps(), sid, "cleo", false); // cleo visslar: ×1,5 på radien – 2,5 m räcker bara då
    const r = await leta(d, "alma", { sid, x: ANGEN.x + 2.5, z: ANGEN.z });
    assert.deepEqual(r.hittade.map((h) => h.uid), ["cleo"]);
    assert.ok(2.5 <= maxSokradie() && maxSokradie() === 3, "kandidatsållningen använder största radien");
  });

  it("utanför maxSokradie läses inga gömda alls; strax innanför läses bara kandidaten – och radien utan vissling gäller", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    ctl.clock = GOMSLUT + 20_000;
    const r = await leta(d, "alma", { sid, x: ANGEN.x + 2.5, z: ANGEN.z }); // kandidat (≤ 3 m) men utanför radien utan vissling
    assert.deepEqual(r.hittade, []);
    ctl.clock += LETA_SPARR_MS;
    const r2 = await leta(d, "alma", { sid, x: ANGEN.x + 1.5, z: ANGEN.z });
    assert.deepEqual(r2.hittade.map((h) => h.uid), ["cleo"]);
  });

  it("två samtidiga sökningar på samma elev från två instanser med varsitt minne: bara en får poängen", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    await db.doc(`liveSessions/${sid}/players/gus`).set({ uid: "gus", classId: "4b", name: "Gus", correct: 0, incorrect: 0 });
    const d2 = deps();
    await anslut(d2, "gus", { sid });
    await gomstallenFor(d2, sid, await session(sid)); // instans 2:s eget minne (gus har bara en laddning)
    ctl.clock = GOMSLUT + 30_000;
    const ut = await Promise.all([leta(d, "alma", { sid, x: BO.x + 1, z: BO.z }), leta(d2, "gus", { sid, x: BO.x + 1, z: BO.z })]);
    assert.equal(ut.filter((r) => r.hittade.length).length, 1);
    assert.equal((await kgPlayer(sid, "alma")).hittade + (await kgPlayer(sid, "gus")).hittade, 1);
  });

  it("rensas vid slutet och tar högst MINNE_SESSIONER matcher", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await leta(d, "alma", { sid, x: 1, z: 1 });
    assert.equal(d.minne.gomstallen.has(sid), true);
    ctl.clock = END + 1000;
    await avsluta(d, LARARE, { sid });
    assert.equal(d.minne.gomstallen.has(sid), false);
    const m = nyttMinne();
    for (let i = 0; i < MINNE_SESSIONER + 5; i++) {
      await gomstallenFor({ db, minne: m, now: () => ctl.clock }, `kg-fejk-${i}`, { kgPlacerade: true });
    }
    assert.equal(m.gomstallen.size, MINNE_SESSIONER);
    assert.equal(m.gomstallen.has("kg-fejk-0"), false, "äldst ut först");
  });
});
