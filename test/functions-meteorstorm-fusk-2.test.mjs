// ============================================================================
// Meteorstormen (#821) – TESTARENS fusk-svit, omgång 2 (efter rättningsrunda 1):
// k-ordningen (multFor/fragaFor, fel[] med varje överhoppat k), fel-länkarna
// (typ "fel", ≥ MS_FEL_SKICKA poster) och läsningarna per anrop.
//   • elevklienten (ms-klient.js) bunden till serverkärnan – samma form som
//     elevskärmen – med en omladdning mitt i ett rätt svar
//   • en elev som skriver egna anrop: fel-länkar och rätta svar så fort
//     spärren tillåter, upprepade anrop som slår upp kedjan
// N1–N4 (testarens rapport) rättade i rättningsrunda 2 – vanliga tester.
// Körs via:  npm run test:functions  (eller ensam med node --test)
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { agera, lage, ratta } from "../functions/meteorstorm-core.js";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import { multFor, MS_FEL_SKICKA, MS_FEL_TAK, MS_K_TAKT_MS, MS_K_RUM } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import { ctl, deps, T0, makeSession, events, att, code, db } from "./helpers/meteorstorm-core-rig.js";

beforeEach(() => { ctl.clock = T0 + 60_000; });

/** Elevskärmen: klienten med anropen bundna till kärnan (en instans) och sessionStorage-lik lagring. */
function skarm(sid, uid, d, lagring) {
  const kar = { msAgera: (x) => agera(d, uid, x), msLage: (x) => lage(d, uid, x), msRatta: (x) => ratta(d, uid, x) };
  const k = createMsKlient({
    sid, uid, seed: 4711, gameMode: "multiplication_0_10", lagring,
    call: (namn, x) => kar[namn](structuredClone(x)), vanta: async (ms) => { ctl.clock += ms; },
  });
  const kalla = k.kalla();
  let n = 0;
  /** Eleven svarar på nästa fråga (rätt eller fel). */
  const svara = (ratt) => {
    const q = kalla.next();
    return k.svara({ attemptId: `${uid}-${ctl.clock}-${n++}`.padEnd(12, "x"), factorA: q.a, factorB: q.b, answer: String(ratt ? q.answer : q.answer + 1) });
  };
  return { k, svara };
}
const lagringNy = () => { const m = new Map(); return { getItem: (x) => m.get(x) ?? null, setItem: (x, v) => m.set(x, v) }; };

describe("Elevskärmen: omladdning mitt i ett rätt svar", () => {
  it("N1: efter en omladdning mellan rätt svar och handling godtas elevens nästa rätta svar", async () => {
    const sid = await makeSession();
    const d = deps();
    const lagring = lagringNy();
    const a = skarm(sid, "alma", d, lagring);
    await a.svara(true);
    await a.k.agera("skold");
    ctl.clock += 3000;
    await a.svara(true); // rätt – eleven har inte valt handling än …
    // … och laddar om sidan (sessionStorage finns kvar, det väntande svaret inte).
    const b = skarm(sid, "alma", d, lagring);
    await b.k.lage();
    const utfall = [];
    for (let i = 0; i < 5; i++) {
      ctl.clock += 3000;
      await b.svara(true);
      utfall.push(await code(b.k.agera("laser")));
    }
    const lista = (await events(sid)).filter((h) => h.uid === "alma");
    assert.deepEqual(utfall, ["ok", "ok", "ok", "ok", "ok"], `efter omladdningen: ${utfall} – händelser ${lista.length}`);
  });

  it("utan omladdning: rätt, fel, rätt … från elevskärmen går hela vägen (kontroll av riggen)", async () => {
    const sid = await makeSession();
    const a = skarm(sid, "alma", deps(), lagringNy());
    let ok = 0;
    for (let i = 0; i < 12; i++) {
      ctl.clock += 2500;
      const r = await a.svara(i % 3 !== 1);
      if (r.correct && (await code(a.k.agera("spara"))) === "ok") ok++;
    }
    assert.equal(ok, 8);
    const lista = await events(sid);
    assert.equal(lista.reduce((n, h) => n + (h.fel || []).length, 0), 4);
  });
});

describe("Egna anrop: takten", () => {
  const felBuffert = (uid, fran, n) => Array.from({ length: n }, (_, i) => {
    const { a, b } = multFor(4711, uid, fran + i);
    return { k: fran + i, factorA: a, factorB: b, answer: a * b + 1, attemptId: `f-${fran + i}`.padEnd(10, "x") };
  });

  it("N2: fel-länkar med 25 påhittade fel svar varje sekund → högst några skrivningar per minut", async () => {
    const sid = await makeSession();
    const d = deps();
    let k = 0;
    let ok = 0;
    for (let i = 0; i < 60; i++) {
      ctl.clock += 1000;
      if ((await code(agera(d, "alma", { sid, fel: felBuffert("alma", k, MS_FEL_SKICKA) }))) === "ok") ok++;
      k += MS_FEL_SKICKA;
    }
    const skrev = (await events(sid)).length;
    assert.ok(skrev <= 3, `${skrev} fel-länkar (skrivningar) på 60 s, k nu ${k}`);
  });

  it("N3: rätta svar ur multFor varje sekund (skript) i 5 min → högst takten MS_K_TAKT_MS (+ hinken)", async () => {
    const sid = await makeSession();
    const d = deps();
    let ok = 0;
    let k = 0;
    const koder = new Set();
    for (let i = 0; i < 300; i++) {
      ctl.clock += 1000;
      const { a, b } = multFor(4711, "alma", k);
      const c = await code(agera(d, "alma", { sid, attemptId: att(), svar: { k, factorA: a, factorB: b, answer: a * b }, typ: "laser" }));
      koder.add(c);
      if (c === "ok") { ok++; k++; }
    }
    // Hinken (MS_K_RUM) + en fråga per MS_K_TAKT_MS – ett skript klarar inte mer än en snabb människa.
    assert.ok(ok <= MS_K_RUM + 300_000 / MS_K_TAKT_MS, `${ok} rätta svar + laser på 5 min`);
    assert.ok(ok < 300 * 0.85, `${ok}`);
    assert.deepEqual([...koder].sort(), ["ok", "resource-exhausted"]);
  });

  it("N3: en snabb elev (ett svar varannan sekund, var tredje fel) stoppas aldrig av takten", async () => {
    const sid = await makeSession();
    const a = skarm(sid, "alma", deps(), lagringNy());
    let nej = 0;
    for (let i = 0; i < 150; i++) {
      ctl.clock += 2000;
      const r = await a.svara(i % 3 !== 1);
      if (r.correct && (await code(a.k.agera("spara"))) !== "ok") nej++;
    }
    assert.equal(nej, 0);
  });

  it("fel-länken: dubbletter, rätta svar och gamla k räknas inte mot de 25", async () => {
    const sid = await makeSession();
    const d = deps();
    const bas = felBuffert("alma", 0, 20);
    const dubbel = [...bas, ...bas.slice(0, 10)];
    assert.equal(await code(agera(d, "alma", { sid, fel: dubbel })), "failed-precondition", "dubbletter");
    const medRatt = [...bas, ...Array.from({ length: 10 }, (_, i) => {
      const { a, b } = multFor(4711, "alma", 20 + i);
      return { k: 20 + i, factorA: a, factorB: b, answer: a * b, attemptId: `r-${i}`.padEnd(10, "x") };
    })];
    assert.equal(await code(agera(d, "alma", { sid, fel: medRatt })), "failed-precondition", "rätta svar");
    // Fel faktorer (inte elevens fråga k) räknas inte heller.
    const felFaktor = felBuffert("alma", 0, 30).map((f) => ({ ...f, factorA: (f.factorA + 1) % 11 }));
    assert.equal(await code(agera(d, "alma", { sid, fel: felFaktor })), "failed-precondition", "fel faktorer");
    // 25 i följd fr.o.m. k 0 går; samma k igen (nya attemptId) räknas inte.
    assert.equal(await code(agera(d, "alma", { sid, fel: felBuffert("alma", 0, 25) })), "ok");
    ctl.clock += 2000;
    const igen = felBuffert("alma", 0, 25).map((f) => ({ ...f, attemptId: `${f.attemptId}y` }));
    // Samma k-följd igen = samma fel-länk (idempotent på "fel-<kMax>") – ingen ny skrivning.
    assert.equal((await agera(d, "alma", { sid, fel: igen })).igen, true, "samma k igen");
    // Hål i följden → nekas.
    const hal = felBuffert("alma", 26, 30);
    assert.equal(await code(agera(d, "alma", { sid, fel: hal })), "failed-precondition", "hål");
    assert.equal((await events(sid)).length, 1);
  });

  it("msRatta: högst MS_K_FONSTER före senaste länken, ingen skrivning", async () => {
    const sid = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 4 });
    await db.doc(`liveSessions/${sid}/msPublic/questions`).set({ questions: [0, 1, 2, 3].map((i) => ({ id: `q${i}`, text: `F${i}`, options: ["a", "b", "c", "d"] })) });
    await db.doc(`liveSessions/${sid}/msPrivate/snapshot`).set({ facit: [0, 1, 2, 3].map((i) => ({ answerIndex: i })) });
    const { fragaFor } = await import("../src/live/formats/meteorstorm/delat/ms-anrop.js");
    const d = deps();
    const prov = async (k) => code(ratta(d, "alma", { sid, svar: { k, q: fragaFor(4711, "alma", k, 4), choiceIndex: 0 } }));
    assert.equal(await prov(MS_FEL_TAK), "ok");
    assert.equal(await prov(MS_FEL_TAK + 2), "failed-precondition");
    assert.equal(await prov(10_000), "failed-precondition");
    assert.equal((await events(sid)).length, 0);
  });
});

describe("Egna anrop: läsningar per anrop", () => {
  /** deps med en Firestore som räknar dokumentläsningar (minst 1 per fråga – som debiteringen). */
  function raknande() {
    const n = { las: 0 };
    const lasN = (s) => (s?.docs ? Math.max(1, s.size) : 1);
    const ursprung = new WeakMap();
    const ut = (x) => ursprung.get(x) || x;
    const omslut = (o) => {
      const p = new Proxy(o, {
        get(t, namn) {
          const v = t[namn];
          if (typeof v !== "function") return v;
          if (namn === "get") return async (...a) => { const s = await v.apply(t, a); n.las += lasN(s); return s; };
          if (["collection", "doc", "where", "orderBy", "limit", "select"].includes(namn)) return (...a) => omslut(v.apply(t, a));
          if (["set", "update", "create", "delete"].includes(namn)) return (...a) => v.apply(t, a.map(ut));
          return v.bind(t);
        },
      });
      ursprung.set(p, o);
      return p;
    };
    const rdb = {
      collection: (...a) => omslut(db.collection(...a)),
      doc: (...a) => omslut(db.doc(...a)),
      getAll: (...rs) => { n.las += rs.length; return db.getAll(...rs.map(ut)); },
      runTransaction: (fn) => db.runTransaction((tx) => fn({
        get: async (r) => { const s = await tx.get(ut(r)); n.las += lasN(s); return s; },
        getAll: async (...rs) => { n.las += rs.length; return tx.getAll(...rs.map(ut)); },
        set: (r, ...a) => tx.set(ut(r), ...a), update: (r, ...a) => tx.update(ut(r), ...a),
        create: (r, ...a) => tx.create(ut(r), ...a), delete: (r) => tx.delete(ut(r)),
      })),
    };
    return { d: { ...deps(), db: rdb }, n };
  }

  async function medLankar(antal) {
    const sid = await makeSession();
    const d = deps();
    for (let k = 0; k < antal; k++) {
      ctl.clock += 1100;
      const { a, b } = multFor(4711, "alma", k);
      await agera(d, "alma", { sid, attemptId: att(), svar: { k, factorA: a, factorB: b, answer: a * b }, typ: "spara", nr: k + 1 });
    }
    return sid;
  }

  it("N4: msLage i en loop läser inte hela elevens kedja varje gång", async () => {
    const sid = await medLankar(60);
    const { d, n } = raknande();
    for (let i = 0; i < 20; i++) await lage(d, "alma", { sid });
    assert.ok(n.las / 20 <= 5, `${(n.las / 20).toFixed(1)} läsningar per msLage med 60 länkar`);
  });

  it("N4b: ett msAgera utanför k-fönstret (omsynk) i en loop läser inte hela kedjan varje gång", async () => {
    const sid = await medLankar(60);
    const { d, n } = raknande();
    const ut = [];
    for (let i = 0; i < 20; i++) {
      ctl.clock += 1100;
      const k = 500 + i;
      const { a, b } = multFor(4711, "alma", k);
      ut.push(await code(agera(d, "alma", { sid, attemptId: att(), svar: { k, factorA: a, factorB: b, answer: a * b }, typ: "spara", nr: 3 })));
    }
    assert.ok(ut.every((c) => c === "failed-precondition"), ut.join(","));
    assert.equal((await events(sid)).length, 60, "inga skrivningar");
    assert.ok(n.las / 20 <= 5, `${(n.las / 20).toFixed(1)} läsningar per nekat anrop med 60 länkar`);
  });
});
