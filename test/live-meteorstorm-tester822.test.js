// Testaren #822 (e2e mot emulatorn, epic #819): "Skriv själv" i multiplikationen
// – fel svar → SAMMA fråga visas igen → rätt svar på den nekas av servern
// ("Svara på frågan du fick.") och eleven fastnar i handlingsvalet ("📡
// Stationen svarar inte just nu – tryck igen.") tills sidan laddas om.
// Orsak: src/mult/fast-answer.js submit() kör showNext() (= kalla().next())
// FÖRE onAnswer (= svara()), och kalla().next() lämnar ut den obesvarade
// frågan igen (utdelad sätts till null först i svara()). Testet kör samma
// ordning som fast-answer och rättar varje svar som servern gör (multFor(k)).
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
  it("efter ett fel svar visas en NY fråga (inte samma igen)", { todo: "F2: fast-answer visar samma fråga igen" }, async () => {
    const { k } = klientMedServer();
    const fa = fastAnswer(k.kalla(), k);
    const forsta = fa.fraga;
    await fa.svara(false);
    assert.notEqual(`${fa.fraga.a}x${fa.fraga.b}|${fa.fraga.k}`, `${forsta.a}x${forsta.b}|${forsta.k}`);
  });

  it("rätt svar på frågan som visas efter ett fel svar godtas av servern", { todo: "F2: msAgera nekar – eleven fastnar" }, async () => {
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
