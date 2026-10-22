// ============================================================================
// Meteorstormen (#821) – TESTARENS fusk-svit, omgång 3 (efter rättningsrunda 2):
// omsynken i elevklienten (omladdning i quiz, med buffert, två flikar) och
// takt-hinken kRum (samtidiga anrop från flera instanser, fel- och svarslänkar
// om vartannat, snabb gissare, paus). Elevskärmen = ms-klient.js bunden till
// serverkärnan; "skript" = egna anrop med samma form som klienten.
// Körs via:  npm run test:functions  (eller ensam med node --test)
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { agera, lage, ratta } from "../functions/meteorstorm-core.js";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import { multFor, fragaFor, MS_FEL_SKICKA, MS_K_TAKT_MS, MS_K_RUM } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import { ctl, deps, T0, END, makeSession, makeQuiz, events, att, code, FACIT } from "./helpers/meteorstorm-core-rig.js";

beforeEach(() => { ctl.clock = T0 + 60_000; });

const lagringNy = () => { const m = new Map(); return { getItem: (x) => m.get(x) ?? null, setItem: (x, v) => m.set(x, v) }; };

/** Elevskärmen (multiplikation eller quiz) bunden till kärnan. */
function skarm(sid, uid, d, lagring, quiz = false) {
  const kar = { msAgera: (x) => agera(d, uid, x), msLage: (x) => lage(d, uid, x), msRatta: (x) => ratta(d, uid, x) };
  const k = createMsKlient({
    sid, uid, seed: 4711, gameMode: quiz ? "plugga_quiz" : "multiplication_0_10", antalFragor: quiz ? 4 : 0, lagring,
    call: (namn, x) => kar[namn](structuredClone(x)), vanta: async (ms) => { ctl.clock += ms; },
  });
  const kalla = quiz ? null : k.kalla();
  let n = 0;
  const id = () => `${uid}-${ctl.clock}-${n++}`.padEnd(12, "x");
  const svara = async (ratt) => {
    if (quiz) {
      const q = k.fraga();
      return k.svara({ attemptId: id(), q, choiceIndex: ratt ? FACIT[q].answerIndex : (FACIT[q].answerIndex + 1) % 4 });
    }
    const f = kalla.next();
    return k.svara({ attemptId: id(), factorA: f.a, factorB: f.b, answer: String(ratt ? f.answer : f.answer + 1) });
  };
  /** Svara rätt och välj handling → "ok" | felkod (fel kastade till skärmen). */
  const rattOchHandla = async (typ = "spara") => {
    const r = await code(svara(true));
    if (r !== "ok") return `svara:${r}`;
    return code(k.agera(typ));
  };
  return { k, svara, rattOchHandla };
}

describe("N1-varianter: omladdning och omsynk i elevklienten", () => {
  it("quiz: omladdning mellan rätt svar (msRatta) och handling → nästa rätta svar godtas", async () => {
    const sid = await makeQuiz();
    const d = deps();
    const lagring = lagringNy();
    const a = skarm(sid, "alma", d, lagring, true);
    assert.equal(await a.rattOchHandla(), "ok");
    ctl.clock += 3000;
    assert.equal((await a.svara(true)).correct, true); // väntar på handling …
    const b = skarm(sid, "alma", d, lagring, true); // … omladdning
    await b.k.lage();
    const ut = [];
    for (let i = 0; i < 5; i++) { ctl.clock += 3000; ut.push(await b.rattOchHandla()); }
    assert.deepEqual(ut, ["ok", "ok", "ok", "ok", "ok"]);
  });

  it("omladdning med fel svar i bufferten: de följer med nästa rätta svar", async () => {
    const sid = await makeSession();
    const d = deps();
    const lagring = lagringNy();
    const a = skarm(sid, "alma", d, lagring);
    assert.equal(await a.rattOchHandla(), "ok");
    for (let i = 0; i < 3; i++) { ctl.clock += 2000; await a.svara(false); }
    ctl.clock += 2000;
    await a.svara(true); // väntar på handling
    const b = skarm(sid, "alma", d, lagring);
    await b.k.lage();
    ctl.clock += 3000;
    assert.equal(await b.rattOchHandla(), "ok");
    const lista = (await events(sid)).sort((x, y) => x.nr - y.nr);
    assert.equal(lista.length, 2);
    assert.equal(lista[1].fel.length, 3, "de tre fel svaren följde med");
  });

  it("omladdning UTAN lage() (skärmen frågar inte servern): första anropet ger omsynk, sedan går det", async () => {
    const sid = await makeSession();
    const d = deps();
    const lagring = lagringNy();
    const a = skarm(sid, "alma", d, lagring);
    assert.equal(await a.rattOchHandla(), "ok");
    ctl.clock += 3000;
    await a.svara(true);
    const b = skarm(sid, "alma", d, lagring);
    const ut = [];
    for (let i = 0; i < 4; i++) { ctl.clock += 3000; ut.push(await b.rattOchHandla()); }
    assert.ok(ut.slice(1).every((c) => c === "ok"), ut.join(","));
  });

  it("två flikar för samma elev: de krockar men ingen av dem låses ute", async () => {
    const sid = await makeSession();
    const d = deps();
    const a = skarm(sid, "alma", d, lagringNy());
    const b = skarm(sid, "alma", d, lagringNy());
    const ut = [];
    for (let i = 0; i < 8; i++) { ctl.clock += 3000; ut.push(await (i % 2 ? b : a).rattOchHandla()); }
    // Efter krockarna: flik A ensam fortsätter utan fel (högst ett omsynk-anrop först).
    const efter = [];
    for (let i = 0; i < 5; i++) { ctl.clock += 3000; efter.push(await a.rattOchHandla()); }
    assert.ok(efter.slice(1).every((c) => c === "ok"), `växlande: ${ut} · efter: ${efter}`);
    const lista = await events(sid);
    assert.equal(new Set(lista.map((h) => h.k)).size, lista.length, "varje k högst en gång");
  });
});

describe("N2/N3: takt-hinken", () => {
  const fraga = (uid, k, ratt = true) => {
    const { a, b } = multFor(4711, uid, k);
    return { k, factorA: a, factorB: b, answer: ratt ? a * b : a * b + 1 };
  };
  const felBuf = (uid, fran, n) => Array.from({ length: n }, (_, i) => ({ ...fraga(uid, fran + i, false), attemptId: `f-${fran + i}`.padEnd(10, "x") }));

  it("skript mot tre instanser samtidigt varje sekund i 5 min → högst hinken + en fråga per 1,5 s", async () => {
    const sid = await makeSession();
    const inst = [deps(), deps(), deps()];
    let k = 0;
    for (let s = 0; s < 300; s++) {
      ctl.clock = T0 + 60_000 + s * 1000;
      // Tre anrop på en gång med nästa tre k (det första rätt, resten hoppar över via fel[]).
      const svar = await Promise.all(inst.map((d, i) => code(agera(d, "alma", {
        sid, attemptId: att(), svar: fraga("alma", k + i), typ: "laser", fel: felBuf("alma", k, i),
      }))));
      const lista = (await events(sid)).filter((h) => h.uid === "alma");
      k = lista.reduce((m, h) => Math.max(m, h.k), -1) + 1;
      assert.equal(svar.filter((c) => c === "ok").length <= 1, true, `samma sekund: ${svar}`);
    }
    const lista = await events(sid);
    const kMax = Math.max(...lista.map((h) => h.k));
    const tak = MS_K_RUM + 300_000 / MS_K_TAKT_MS + 1;
    assert.ok(kMax <= tak, `k ${kMax} > ${tak.toFixed(0)}`);
    assert.ok(lista.length <= tak, `${lista.length} skrivningar`);
  });

  it("fel-länk och svarslänk om vartannat varje sekund → k och skrivningar inom takten, fel-länkar ≥ 25 s isär", async () => {
    const sid = await makeSession();
    const d = deps();
    let k = 0;
    let skrev = 0;
    for (let s = 0; s < 600; s++) {
      ctl.clock = T0 + 1000 + s * 1000;
      const c = s % 2
        ? await code(agera(d, "alma", { sid, fel: felBuf("alma", k, MS_FEL_SKICKA) }))
        : await code(agera(d, "alma", { sid, attemptId: att(), svar: fraga("alma", k), typ: "spara" }));
      if (c === "ok") {
        skrev++;
        k = Math.max(...(await events(sid)).map((h) => h.k)) + 1;
      }
    }
    const lista = (await events(sid)).sort((a, b) => a.nr - b.nr);
    const felL = lista.filter((h) => h.typ === "fel");
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].typ === "fel") assert.ok(lista[i].t - lista[i - 1].t >= 25_000, `fel-länk ${lista[i].nr} efter ${lista[i].t - lista[i - 1].t} ms`);
    }
    assert.ok(k <= 5 + 600_000 / MS_K_TAKT_MS + 1, `k ${k}`);
    assert.equal(skrev, lista.length);
    assert.ok(skrev <= 600_000 / MS_K_TAKT_MS + 5, `${skrev} skrivningar (${felL.length} fel-länkar)`);
  });

  it("snabb gissare via elevskärmen (ett svar per sekund, var fjärde rätt) i 5 min: aldrig utelåst", async () => {
    const sid = await makeSession();
    const a = skarm(sid, "alma", deps(), lagringNy());
    const fel = {};
    let ok = 0;
    for (let i = 0; i < 300; i++) {
      ctl.clock += 1000;
      if (i % 4 === 3) {
        const c = await a.rattOchHandla();
        if (c === "ok") ok++;
        else fel[c] = (fel[c] || 0) + 1;
      } else {
        await code(a.svara(false));
      }
    }
    // Sista minuten i lugn takt: allt går.
    const sist = [];
    for (let i = 0; i < 10; i++) { ctl.clock += 6000; sist.push(await a.rattOchHandla()); }
    assert.ok(sist.slice(1).every((c) => c === "ok"), `sista: ${sist} · under gissandet ok ${ok}, fel ${JSON.stringify(fel)}`);
  });

  it("paus: efter två minuter utan svar går ett snabbt ryck på MS_K_RUM frågor utan väntan", async () => {
    const sid = await makeSession();
    const a = skarm(sid, "alma", deps(), lagringNy());
    for (let i = 0; i < 10; i++) { ctl.clock += 2000; await a.rattOchHandla(); }
    ctl.clock += 120_000;
    const ut = [];
    for (let i = 0; i < 20; i++) { ctl.clock += 1100; ut.push(await a.rattOchHandla()); }
    assert.ok(ut.every((c) => c === "ok"), ut.join(","));
  });

  it("idempotent omspelning och gammal länk ger ingen ny hink", async () => {
    const sid = await makeSession();
    const d = deps();
    const forsta = { sid, attemptId: att(), svar: fraga("alma", 0), typ: "spara" };
    await agera(d, "alma", forsta);
    ctl.clock += 1100;
    for (let i = 0; i < 5; i++) assert.equal((await agera(d, "alma", { ...forsta, nr: 1 })).igen, true);
    // Gammal länk (nr 1) som "föregående" för en ny länk: create på nr 2 går bara en gång.
    const r = await code(agera(d, "alma", { sid, attemptId: att(), svar: fraga("alma", 1), typ: "spara", nr: 2 }));
    assert.equal(r, "ok");
    const r2 = await code(agera(d, "alma", { sid, attemptId: att(), svar: fraga("alma", 2), typ: "spara", nr: 2 }));
    assert.notEqual(r2, "ok", "inom 1 s och ny länk kräver nr 3");
    assert.equal((await events(sid)).length, 2);
  });
});

describe("N4: senaste() via indexet", () => {
  it("msLage ger senaste länken (nr) även när nr inte växer i skrivordning (två instanser)", async () => {
    const sid = await makeSession();
    const [a, b] = [deps(), deps()];
    for (let k = 0; k < 12; k++) {
      ctl.clock += 1600;
      const { a: x, b: y } = multFor(4711, "alma", k);
      await agera(k % 2 ? a : b, "alma", { sid, attemptId: att(), svar: { k, factorA: x, factorB: y, answer: x * y }, typ: "spara" });
    }
    const l = await lage(deps(), "alma", { sid });
    assert.equal(l.nr, 12);
    assert.equal(l.k, 11);
    const tom = await lage(deps(), "bo", { sid });
    assert.equal(tom.nr, 0);
    assert.equal(tom.k, -1);
  });

  it("efter slutet: msAgera nekas, msLage svarar", async () => {
    const sid = await makeSession();
    ctl.clock = END + 500;
    const { a, b } = multFor(4711, "alma", 0);
    assert.equal(await code(agera(deps(), "alma", { sid, attemptId: att(), svar: { k: 0, factorA: a, factorB: b, answer: a * b }, typ: "spara" })), "failed-precondition");
    assert.equal((await lage(deps(), "alma", { sid })).nr, 0);
    assert.equal(typeof fragaFor, "function");
  });
});
