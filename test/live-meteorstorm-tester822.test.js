// Testaren #822 (e2e mot emulatorn, epic #819): "Skriv själv" i multiplikationen
// – fel svar → SAMMA fråga visas igen → rätt svar på den nekas av servern
// ("Svara på frågan du fick.") och eleven fastnar i handlingsvalet ("📡
// Stationen svarar inte just nu – tryck igen.") tills sidan laddas om.
// Orsak: src/mult/fast-answer.js submit() kör showNext() (= kalla().next())
// FÖRE onAnswer (= svara()), och kalla().next() lämnade ut den obesvarade
// frågan igen (utdelad sattes till null först i svara()). Testet kör samma
// ordning som fast-answer och rättar varje svar som servern gör (multFor(k)).
// RÄTTAT (#822 F2, ms-klient.js): next() delar ut en ny fråga när den visade
// redan visats, och svara() hittar frågans k på faktorerna.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import { multFor } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";

const SEED = 8220;
const UID = "b01";

function klientMedServer() {
  const nekade = [];
  const call = async (namn, data) => {
    for (const s of [data.svar, ...(data.fel || [])]) {
      const { a, b } = multFor(SEED, UID, s.k);
      if (s.factorA !== a || s.factorB !== b) {
        nekade.push(s);
        throw Object.assign(new Error("Svara på frågan du fick."), { code: "failed-precondition" });
      }
    }
    return { ok: true, nr: (data.nr || 0) + 1, energi: 0, k: data.svar.k + 1 };
  };
  const k = createMsKlient({ sid: "s1", uid: UID, seed: SEED, gameMode: "multiplication_0_10", call });
  return { k, nekade };
}

/** Som fast-answer.js: submit() → showNext() → onAnswer(attempt). */
function fastAnswer(src, klient) {
  let visad = src.next();
  return {
    get fraga() { return visad; },
    svara(ratt) {
      const q = visad;
      visad = src.next();
      return klient.svara({ attemptId: `a${Math.random()}`, factorA: q.a, factorB: q.b, answer: String(ratt ? q.a * q.b : q.a * q.b + 1) });
    },
  };
}

describe("Meteorstormen – skriv själv efter ett fel svar (testaren #822 F2)", () => {
  it("efter ett fel svar visas en NY fråga (inte samma igen)", async () => {
    const { k } = klientMedServer();
    const fa = fastAnswer(k.kalla(), k);
    const forsta = fa.fraga;
    await fa.svara(false);
    assert.notEqual(`${fa.fraga.a}x${fa.fraga.b}|${fa.fraga.k}`, `${forsta.a}x${forsta.b}|${forsta.k}`);
  });

  it("rätt svar på frågan som visas efter ett fel svar godtas av servern", async () => {
    const { k, nekade } = klientMedServer();
    const fa = fastAnswer(k.kalla(), k);
    await fa.svara(false);
    const r = await fa.svara(true);
    assert.equal(r.correct, true);
    await k.agera("skold");
    assert.deepEqual(nekade, []);
  });

  it("utan fel svar fungerar kedjan (kontroll)", async () => {
    const { k, nekade } = klientMedServer();
    const src = k.kalla();
    for (let i = 0; i < 3; i++) {
      const q = src.next();
      await k.svara({ attemptId: `a${i}`, factorA: q.a, factorB: q.b, answer: String(q.a * q.b) });
      await k.agera("laser");
    }
    assert.deepEqual(nekade, []);
  });
});

// --- #822 F2: fler fall (kodaren) ------------------------------------------------
// En låtsasserver som msAgera: faktorerna måste vara multFor(k), varje k mellan
// förra länkens k och svarets måste finnas bland fel[], energin räknas på servern.
function server() {
  const logg = { nekade: 0, energi: 0, lank: { nr: 0, k: -1 } };
  const call = async (namn, data) => {
    if (namn === "msLage") return { nr: logg.lank.nr, energi: logg.energi, k: logg.lank.k, status: null };
    const svar = data.svar;
    const fel = data.fel || [];
    for (const f of [...(svar ? [svar] : []), ...fel]) {
      const { a, b } = multFor(SEED, UID, f.k);
      if (f.factorA !== a || f.factorB !== b) { logg.nekade++; throw Object.assign(new Error("Svara på frågan du fick."), { code: "failed-precondition" }); }
    }
    if (!svar) return { ok: true, nr: logg.lank.nr };
    const fk = new Set(fel.map((f) => f.k));
    for (let k = logg.lank.k + 1; k < svar.k; k++) {
      if (!fk.has(k)) { logg.nekade++; throw Object.assign(new Error("Ordningen stämmer inte."), { code: "failed-precondition", details: { omsynk: true } }); }
    }
    const kostnad = data.typ === "spara" ? 0 : 1;
    logg.energi = Math.min(5, logg.energi + 1 - kostnad);
    logg.lank = { nr: logg.lank.nr + 1, k: svar.k };
    return { correct: true, nr: logg.lank.nr, energi: logg.energi, k: svar.k, typ: data.typ };
  };
  return { call, logg };
}
const ny = (call, lagring = null) => createMsKlient({ sid: "s1", uid: UID, seed: SEED, gameMode: "multiplication_0_10", call, lagring });

describe("Meteorstormen – skriv själv och flerval efter #822 F2", () => {
  it("fast-answer: fel, fel, rätt, handling, rätt, handling – inget nekas, energin räknas", async () => {
    const { call, logg } = server();
    const k = ny(call);
    const fa = fastAnswer(k.kalla(), k);
    for (const ratt of [false, false, true]) await fa.svara(ratt);
    await k.agera("spara");
    // efter handlingen slår flödet på svarsfältet igen: nästa fråga hämtas på nytt
    const fb = fastAnswer(k.kalla(), k);
    await fb.svara(false);
    assert.equal((await fb.svara(true)).correct, true);
    const r = await k.agera("skold");
    assert.equal(logg.nekade, 0);
    assert.equal(r.correct, true);
    assert.equal(k.energi, 1, "spara behöll energin (1), sköld kostade 1 av nästa (1)");
  });

  it("flerval (en next() per fråga) fungerar som förut", async () => {
    const { call, logg } = server();
    const k = ny(call);
    const src = k.kalla();
    for (let i = 0; i < 6; i++) {
      const q = src.next();
      const r = await k.svara({ attemptId: `c${i}`, factorA: q.a, factorB: q.b, answer: String(q.a * q.b + (i % 2)), choiceIndex: 0 });
      if (r.correct) await k.agera("laser");
    }
    assert.equal(logg.nekade, 0);
  });

  it("nekar servern ändå (failed-precondition) synkar klienten om – knapparna fastnar inte och ingen energi går förlorad", async () => {
    const { call, logg } = server();
    let stor = true;
    const k = ny(async (n, d) => {
      if (n === "msAgera" && d.svar && stor) { stor = false; throw Object.assign(new Error("Svara på frågan du fick."), { code: "failed-precondition" }); }
      return call(n, d);
    });
    const src = k.kalla();
    let q = src.next();
    await k.svara({ attemptId: "x1", factorA: q.a, factorB: q.b, answer: String(q.a * q.b) });
    await assert.rejects(k.agera("spara"), /frågan du fick/);
    assert.equal(k.vantar(), false, "vyn ser att inget väntar och visar nästa fråga i stället för att fastna");
    q = src.next();
    await k.svara({ attemptId: "x2", factorA: q.a, factorB: q.b, answer: String(q.a * q.b) });
    const r = await k.agera("spara");
    assert.equal(r.correct, true);
    assert.equal(logg.nekade, 0);
    assert.equal(k.energi, 1, "energin från det godkända svaret finns kvar");
  });

  it("en omladdning visar den obesvarade frågan igen (samma k), sedan nya", async () => {
    const { call, logg } = server();
    const minne = new Map();
    const lagring = { getItem: (x) => minne.get(x) ?? null, setItem: (x, v) => minne.set(x, v) };
    const k1 = ny(call, lagring);
    const forsta = k1.kalla().next();
    const k2 = ny(call, lagring); // sidan laddas om
    const igen = k2.kalla().next();
    assert.equal(igen.k, forsta.k);
    const fa = fastAnswer({ next: (() => { let f = true; const s = k2.kalla(); return () => (f ? (f = false, igen) : s.next()); })() }, k2);
    await fa.svara(true);
    await k2.agera("laser");
    assert.equal(logg.nekade, 0);
  });
});
