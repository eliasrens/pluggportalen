// ============================================================================
// Meteorstormen (#821) – TESTARENS fusk-/race-svit mot serverkärnan i
// Firestore-EMULATORN med styrd klocka (samma rigg som -core). En "instans" =
// ett eget minne (deps()), så flera minnen = flera Cloud Functions-instanser.
// Anropen har samma form som elevklienten (ms-klient.js) eller en elev som
// skriver egna anrop i konsolen.
//
// Fynd som inte är rättade står som todo-tester (F-numren i testarens
// rapport till 821-issue-lead) – de visar det ÖNSKADE beteendet och
// rapporteras utan att fälla sviten.
// Körs via:  npm run test:functions  (eller ensam med node --test)
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { agera, avsluta, lage, ratta } from "../functions/meteorstorm-core.js";
import { simulera } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { fragaFor, MS_FEL_TAK } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import {
  ctl, deps, T0, END, makeSession, makeQuiz, events, ev, msPlayer, status, session, att, mult, code, db, Timestamp,
  QUESTIONS, FACIT,
} from "./helpers/meteorstorm-core-rig.js";

const steg = (d, ms = 2000) => { ctl.clock += ms; return d; };
const handla = (d, sid, uid, typ, extra = {}) => agera(d, uid, { sid, attemptId: att(), svar: mult(3, 4), typ, ...extra });
const larare = { uid: "larare1", teacher: true };
/** Som riggens code(), men ett rått Firestore-fel (t.ex. dokumentets storlek) blir "raw:<kod>". */
const kod = async (p) => {
  try {
    await p;
  } catch (e) {
    return e?.constructor?.name === "KsError" ? e.code : `raw:${e?.code ?? e?.message}`;
  }
  return "ok";
};
const somHandling = (h) => ({ id: h.id, t: h.t, classId: h.classId, uid: h.uid, typ: h.typ, ...(h.mal ? { mal: h.mal } : {}) });

beforeEach(() => { ctl.clock = T0 + 60_000; });

describe("Fusk: energin och kedjan", () => {
  it("ett nr som pekar på en gammal länk med hög energi ger ingen extra energi", async () => {
    const sid = await makeSession();
    const d = deps();
    for (let i = 0; i < 3; i++) await handla(steg(d), sid, "alma", "spara"); // energi 3
    const drag = await handla(steg(d), sid, "alma", "drag", { mal: "4d" }); // 3 + 1 − 3 = 1
    assert.equal(drag.typ, "drag");
    assert.equal(drag.energi, 1);
    // Eleven låtsas att en gammal länk (energi 3) är den senaste: energin ska
    // ändå räknas från den VERKLIGA senaste länken.
    for (const nr of [4, 3, 2, 1]) {
      const fore = (await events(sid)).filter((h) => h.uid === "alma").sort((a, b) => b.nr - a.nr)[0];
      const r = await handla(steg(d, 31_000), sid, "alma", "drag", { mal: "4d", nr });
      assert.equal(r.nr, fore.nr + 1, `nr ${nr}`);
      assert.equal(r.energi, Math.min(5, fore.energi + r.vinst - r.kostnad), `nr ${nr}: energin från länk ${fore.nr}`);
      if (r.typ === "drag") assert.ok(fore.energi + r.vinst >= 3, `nr ${nr}: dragstråle utan energi`);
    }
    const lista = (await events(sid)).filter((h) => h.uid === "alma");
    assert.equal(new Set(lista.map((h) => h.nr)).size, lista.length, "en händelse per nr");
    assert.equal(lista.length, 8);
  });

  it("tio samtidiga anrop från tre instanser → en händelse, kedjan hel", async () => {
    const sid = await makeSession();
    const inst = [deps(), deps(), deps()];
    const ut = await Promise.all(Array.from({ length: 10 }, (_, i) => code(handla(inst[i % 3], sid, "alma", "skold"))));
    assert.ok(ut.includes("ok"), ut.join(","));
    assert.ok(ut.every((c) => ["ok", "resource-exhausted", "aborted"].includes(c)), ut.join(","));
    const lista = await events(sid);
    assert.equal(lista.length, 1, `händelser: ${lista.map((h) => h.id)}`);
  });

  it("samtidiga anrop med OLIKA klocka (> 1 s isär) från tre instanser → nr 1, 2, 3 utan hål eller dubbletter", async () => {
    const sid = await makeSession();
    const base = ctl.clock;
    const mk = (off) => ({ ...deps(), now: () => base + off });
    const ut = await Promise.all([0, 1500, 3000].map((off) => code(agera(mk(off), "alma", { sid, attemptId: att(), svar: mult(2, 2), typ: "spara" }))));
    const lista = (await events(sid)).sort((a, b) => a.nr - b.nr);
    assert.deepEqual(lista.map((h) => h.nr), lista.map((_, i) => i + 1), `nr: ${lista.map((h) => h.nr)} (${ut})`);
    // Energin följer kedjan: varje länk = föregående + 1 (spara).
    lista.forEach((h, i) => assert.equal(h.energi, i + 1));
  });

  it("två dragstrålar samtidigt från samma station på två INSTANSER → högst en", async () => {
    const sid = await makeSession();
    const d = deps();
    for (const u of ["alma", "bo"]) {
      for (let i = 0; i < 3; i++) await handla(steg(d, 1100), sid, u, "spara");
    }
    steg(d, 5000);
    const [a, b] = await Promise.all([handla(deps(), sid, "alma", "drag"), handla(deps(), sid, "bo", "drag")]);
    const drag = (await events(sid)).filter((h) => h.typ === "drag");
    assert.equal(drag.length, 1, `${a.typ}/${a.nekad} ${b.typ}/${b.nekad}`);
    const nekad = a.typ === "drag" ? b : a;
    assert.equal(nekad.energi, 4, "den nekade behåller energin (3 + 1)");
  });

  it("elev i en annan sessions klass / annan session → permission-denied för alla anrop", async () => {
    const sid = await makeSession();
    const annan = await makeSession({ participatingClassIds: ["4b", "4c"], classNames: { "4b": "4B", "4c": "4C" } }, ["alma"]);
    assert.equal(await code(handla(deps(), annan, "omar", "skold")), "permission-denied");
    assert.equal(await code(lage(deps(), "omar", { sid: annan })), "permission-denied");
    assert.equal(await code(agera(deps(), "omar", { sid: annan, fel: [mult(2, 2, 5)] })), "permission-denied");
    // Spelardokument med en klass som inte är med i sessionen.
    await db.doc(`liveSessions/${sid}/players/fusk`).set({ uid: "fusk", classId: "4c", name: "Fusk", joinedAt: Timestamp.fromMillis(T0) });
    assert.equal(await code(handla(deps(), sid, "fusk", "skold")), "permission-denied");
  });

  it("ogiltiga fält: nr som text/negativt, typ okänd, attemptId för kort, svar utanför tabellen", async () => {
    const sid = await makeSession();
    const d = deps();
    assert.equal((await handla(d, sid, "alma", "spara", { nr: "1" })).nr, 1);
    assert.equal((await handla(steg(d), sid, "alma", "spara", { nr: -5 })).nr, 2);
    assert.equal(await code(handla(steg(d), sid, "alma", "spara", { nr: 2.5 })), "ok");
    assert.equal(await code(agera(steg(d), "alma", { sid, attemptId: "kort", svar: mult(2, 2), typ: "spara" })), "invalid-argument");
    assert.equal(await code(agera(steg(d), "alma", { sid, attemptId: att(), svar: mult(11, 2), typ: "spara" })), "invalid-argument");
    assert.equal(await code(agera(steg(d), "alma", { sid, attemptId: att(), svar: { factorA: 2, factorB: 2, answer: "4; drop" }, typ: "spara" })), "invalid-argument");
    assert.equal(await code(agera(steg(d), "alma", { sid, attemptId: att(), svar: mult(2, 2), typ: "__proto__" })), "invalid-argument");
    assert.equal((await events(sid)).length, 3);
  });
});

describe("Fusk: idempotens", () => {
  it("F4: samma attemptId igen EFTER en senare handling ger ingen ny händelse", { todo: "F4 – idempotensen ser bara föregående länk" }, async () => {
    const sid = await makeSession();
    const d = deps();
    const forsta = { sid, attemptId: att(), svar: mult(6, 7), typ: "laser" };
    await agera(d, "alma", forsta);
    await handla(steg(d), sid, "alma", "skold");
    const igen = await agera(steg(d), "alma", forsta);
    assert.equal(igen.igen, true);
    assert.equal((await events(sid)).length, 2);
  });
});

describe("Fusk: multiplikationens faktorer väljer klienten", () => {
  it("F1: 0 × 0 = 0 varje sekund i en minut → högst ~takten en människa klarar", { todo: "F1 – servern tar valfria faktorer, bara 1 s spärr" }, async () => {
    const sid = await makeSession({ rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } });
    const d = deps();
    let ok = 0;
    for (let i = 0; i < 60; i++) {
      const r = await agera(steg(d, 1000), "alma", { sid, attemptId: att(), svar: mult(0, 0), typ: "laser" });
      if (r.correct && r.typ === "laser") ok++;
    }
    assert.ok(ok <= 20, `${ok} laserskott på 60 s med 0 × 0`);
  });
});

describe("Fusk: quizets facit och dolda fel svar", () => {
  const kFor = (sid, uid, q, fran) => {
    for (let k = fran; k < fran + 100; k++) if (fragaFor(4711, uid, k, QUESTIONS.length) === q) return k;
    throw new Error("ingen k");
  };

  it("F2: msRatta på k långt fram ger inte facit till frågor eleven inte fått", { todo: "F2 – k är fritt uppåt, facit skördas utan spår" }, async () => {
    const sid = await makeQuiz();
    const d = deps();
    const kant = [];
    for (let q = 0; q < QUESTIONS.length; q++) {
      const k = kFor(sid, "alma", q, 500 + q * 10);
      // Medvetet fel alternativ (facit = q, se riggen) → servern visar rätt svar.
      const r = await code(ratta(d, "alma", { sid, svar: { k, q, choiceIndex: (q + 1) % 4 } }));
      kant.push(r);
    }
    assert.ok(kant.every((c) => c !== "ok"), `msRatta på k 500+: ${kant}`);
  });

  it("F2b: ett rätt svar som hoppar över k utan att fel svaren skickas → stoppas", { todo: "F2 – överhoppade k behöver inte redovisas" }, async () => {
    const sid = await makeQuiz();
    const d = deps();
    // Eleven svarar fel på k 0–4 (msRatta, ingen skrivning), skickar aldrig bufferten,
    // och svarar sedan rätt på k 5. Servern ser bara rätt svar.
    for (let k = 0; k < 5; k++) {
      const q = fragaFor(4711, "alma", k, 4);
      await ratta(d, "alma", { sid, svar: { k, q, choiceIndex: (FACIT[q].answerIndex + 1) % 4 } });
    }
    const q5 = fragaFor(4711, "alma", 5, 4);
    const r = await code(agera(d, "alma", { sid, attemptId: att(), svar: { k: 5, q: q5, choiceIndex: FACIT[q5].answerIndex }, typ: "skold", fel: [] }));
    assert.notEqual(r, "ok", "k 0–4 saknas i fel[] men svaret godtas");
  });

  it("samma k: fel i msRatta → rätt alternativ i msAgera nekas (samma instans)", async () => {
    const sid = await makeQuiz();
    const d = deps();
    const q = fragaFor(4711, "alma", 0, 4);
    const r1 = await ratta(d, "alma", { sid, svar: { k: 0, q, choiceIndex: (FACIT[q].answerIndex + 1) % 4 } });
    assert.equal(r1.correct, false);
    const r2 = await agera(d, "alma", { sid, attemptId: att(), svar: { k: 0, q, choiceIndex: FACIT[q].answerIndex }, typ: "laser" });
    assert.equal(r2.correct, false);
    assert.equal((await events(sid)).length, 0);
  });

  it("fel i bufferten (fel-anrop) låser k även för msAgera på samma instans", async () => {
    const sid = await makeQuiz();
    const d = deps();
    const q = fragaFor(4711, "alma", 0, 4);
    await agera(d, "alma", { sid, fel: [{ k: 0, q, choiceIndex: (FACIT[q].answerIndex + 1) % 4, attemptId: att() }] });
    const r = await agera(steg(d), "alma", { sid, attemptId: att(), svar: { k: 0, q, choiceIndex: FACIT[q].answerIndex }, typ: "laser" });
    assert.equal(r.correct, false);
  });
});

describe("Fusk: fel-anropen (utan svar) och kvoten", () => {
  it("F3: fel-anrop varje sekund i en minut → högst ett par skrivningar", { todo: "F3 – en msPlayers-skrivning per sekund och elev" }, async () => {
    const sid = await makeSession();
    const d = deps();
    let skrev = 0;
    for (let i = 0; i < 60; i++) {
      const r = await code(agera(steg(d, 1000), "alma", { sid, fel: [{ ...mult(2, 3, i + 100), attemptId: att() }] }));
      if (r === "ok") skrev++;
    }
    assert.ok(skrev <= 3, `${skrev} msPlayers-skrivningar på 60 s`);
  });

  it("F3b: fel-anrop via nya instanser samma sekund → spärren gäller ändå", { todo: "F3 – spärren finns bara i instansens minne" }, async () => {
    const sid = await makeSession();
    const ut = [];
    for (let i = 0; i < 5; i++) ut.push(await code(agera(deps(), "alma", { sid, fel: [{ ...mult(2, 3, 50 + i), attemptId: att() }] })));
    assert.equal(ut.filter((c) => c === "ok").length, 1, ut.join(","));
  });

  it("F5: msPlayers.fel fylls nära 1 MiB av en elev → msAvsluta ger ändå resultat", { todo: "F5 – en elev kan stoppa resultatet" }, async () => {
    const sid = await makeSession();
    const d = deps();
    await handla(d, sid, "omar", "laser");
    const lang = (i, j) => ({ factorA: 7, factorB: 8, answer: (i * 41 + j) % 9999, attemptId: `x${i}-${j}-`.padEnd(64, "z") });
    let i = 0;
    let fel = "ok";
    while (fel === "ok" && i < 400) {
      fel = await kod(agera(steg(d, 1000), "alma", { sid, fel: Array.from({ length: MS_FEL_TAK }, (_, j) => lang(i, j)) }));
      i++;
    }
    // Finjustera med ett i taget tills dokumentet är fullt.
    let j = 0;
    let fel1 = "ok";
    while (fel1 === "ok" && j < 400) fel1 = await kod(agera(steg(d, 1000), "alma", { sid, fel: [lang(9000 + j++, 0)] }));
    ctl.clock = END + 5000;
    const r = await kod(avsluta(deps(), larare, { sid }));
    assert.equal(r, "ok", `fyllde med ${i} + ${j} anrop (${fel}/${fel1}), msAvsluta → ${r}`);
    assert.ok((await session(sid)).result);
  });
});

describe("Fusk: msAvsluta", () => {
  async function spel({ klasser = ["4b", "4d"], lage: l = "klass-mot-klass", extra = {} } = {}) {
    const KL = { "4b": ["alma", "bo", "cleo"], "4d": ["omar", "dina"], "4c": ["eva", "fia"] };
    const uids = klasser.flatMap((c) => KL[c]);
    const sid = await makeSession({
      participatingClassIds: klasser, classNames: Object.fromEntries(klasser.map((c) => [c, c.toUpperCase()])),
      msInstallningar: { lage: l, attacker: "vilda" }, rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, ...extra,
    }, []);
    for (const c of klasser) {
      for (const uid of KL[c]) {
        await db.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId: c, name: uid, joinedAt: Timestamp.fromMillis(T0 - 5000) });
      }
    }
    // Slumpad men deterministisk logg: alla handlingar, dragstråle med mål.
    let x = 7;
    const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const typer = ["skold", "laser", "spara", "drag", "skold", "laser"];
    const inst = [deps(), deps()];
    for (let v = 0; v < 120; v++) {
      ctl.clock = T0 + 2000 + v * 4800;
      const uid = uids[Math.floor(rnd() * uids.length)];
      const typ = typer[Math.floor(rnd() * typer.length)];
      const egen = klasser.find((c) => KL[c].includes(uid));
      const mal = typ === "drag" && klasser.length > 2 ? klasser.find((c) => c !== egen) : undefined;
      await code(handla(inst[v % 2], sid, uid, typ, mal ? { mal } : {}));
    }
    return { sid, uids };
  }

  for (const [namn, opt] of [
    ["Klass mot klass, 3 stationer", { klasser: ["4b", "4d", "4c"] }],
    ["En klass", { klasser: ["4b"], lage: "en-klass" }],
  ]) {
    it(`${namn}: msAvsluta = motorn på klienten för samma logg`, async () => {
      const { sid } = await spel(opt);
      ctl.clock = END + 5000;
      const { result } = await avsluta(deps(), larare, { sid });
      const s = await session(sid);
      const lista = await events(sid);
      const klient = simulera({
        seed: s.msSeed, startMs: T0, varaktighetMs: 600_000, stationer: s.msStationer, installningar: s.msInstallningar,
        handlingar: lista.map(somHandling),
      }, END);
      assert.deepEqual(result.placering, klient.resultat.placering);
      if (opt.lage === "en-klass") assert.equal(result.stjarnor, klient.resultat.stjarnor);
      else assert.equal(result.winner, klient.resultat.vinnare);
      assert.equal(result.totalCorrect, lista.length);
      assert.ok(lista.some((h) => h.typ === "drag") || opt.lage === "en-klass", "loggen har dragstrålar");
    });
  }

  it("tre samtidiga msAvsluta (lärare + två elever, egna instanser) → ett result, samma för alla", async () => {
    const { sid } = await spel();
    ctl.clock = END + 5000;
    const ut = await Promise.all([
      avsluta(deps(), larare, { sid }), avsluta(deps(), { uid: "alma" }, { sid }), avsluta(deps(), { uid: "omar" }, { sid }),
    ]);
    const s = await session(sid);
    for (const r of ut) assert.deepEqual(JSON.parse(JSON.stringify(r.result.placering)), s.result.placering);
    assert.equal(ut.filter((r) => !r.redan).length >= 1, true);
    const rewards = ut.map((r) => JSON.stringify(r.result.rewards));
    assert.equal(new Set(rewards).size, 1, "samma mynt i alla svar");
  });

  it("lärare för en annan klass räknas som elev (nekas före slutet); icke-deltagare nekas efter", async () => {
    const sid = await makeSession();
    const fel = { ...deps(), roll: async () => ({ role: "grade", classIds: ["9x"] }) };
    assert.equal(await code(avsluta(fel, { uid: "larare9" }, { sid })), "permission-denied");
    const ratt = { ...deps(), roll: async () => ({ role: "grade", classIds: ["4d"] }) };
    ctl.clock = END - 60_000;
    assert.equal(await code(avsluta(deps(), { uid: "alma" }, { sid })), "failed-precondition");
    ctl.clock = END + 5000;
    assert.equal(await code(avsluta(deps(), { uid: "okand" }, { sid })), "permission-denied");
    assert.equal(await code(avsluta(ratt, { uid: "larare4d" }, { sid })), "ok");
  });

  it("efter lärarens avslut: en varm instans (sessionen i minnet) godtar inte nya handlingar som räknas", async () => {
    const sid = await makeSession({ rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } });
    const varm = deps();
    await handla(varm, sid, "alma", "laser");
    ctl.clock += 2000;
    await avsluta(deps(), larare, { sid });
    ctl.clock += 1000; // sessionen fortfarande i varm-instansens minne (TTL 5 s)
    const r = await code(handla(varm, sid, "alma", "laser"));
    const s = await session(sid);
    const efter = (await events(sid)).filter((h) => h.t > s.result.slutMs);
    // Antingen nekas anropet, eller så räknas händelsen inte i resultatet.
    assert.ok(r !== "ok" || efter.length === 1, r);
    assert.equal(s.result.rewards.alma.correct, 1);
    assert.equal(s.result.totalCorrect, 1);
  });
});

describe("Fusk: status-throttle mellan instanser", () => {
  it("fem instanser inom 10 s → en statusskrivning; efter 10 s en till", async () => {
    const sid = await makeSession();
    const elever = ["alma", "bo", "cleo", "omar", "dina"];
    await handla(deps(), sid, "alma", "skold");
    const s1 = (await status(sid)).tMs;
    for (const u of elever.slice(1)) await handla(steg(deps(), 1500), sid, u, "laser");
    assert.equal((await status(sid)).tMs, s1);
    ctl.clock = s1 + 10_000;
    await handla(deps(), sid, "alma", "laser");
    assert.equal((await status(sid)).tMs, ctl.clock);
    // msLage skriver aldrig status.
    ctl.clock += 15_000;
    await lage(deps(), "bo", { sid });
    assert.equal((await status(sid)).tMs, s1 + 10_000);
  });
});
