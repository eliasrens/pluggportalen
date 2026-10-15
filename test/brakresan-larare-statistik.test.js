// Bråkresan – lärarvyns statistik (K #716): spec §12 "Exakta definitioner".
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aktivSedan, elevRad, elevUtmaningar, forslagElev, idLista, klassSumma, matrisCell, momentOversikt, ms,
  omgangRad, recDokument, stjarnkurva, svaraOchLatta, utmaningsAggregat,
} from "../src/brakresan/larare/statistik.js";

const e = (o = {}) => ({ stars: 0, firstCorrect: 0, firstTotal: 0, roundsCompleted: 0, roundsAborted: 0, helpBefore: 0, helpAfter: 0, ...o });
const state = (challenges, extra = {}) => {
  const totals = { roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 };
  for (const c of Object.values(challenges)) for (const k of Object.keys(totals)) totals[k] += c[k] || 0;
  const totalStars = Object.values(challenges).reduce((s, c) => s + (c.stars || 0), 0);
  return { schema: 1, totalStars, mastered: Object.values(challenges).filter((c) => c.stars === 3).length, challenges, totals, ...extra };
};

describe("elevRad och klassSumma", () => {
  it("träffsäkerhet = rätta första svar / bedömda; inga svar = null (aldrig 0 %)", () => {
    const r = elevRad({ id: "a", namn: "A" }, state({ "03": e({ firstCorrect: 7, firstTotal: 10, helpBefore: 4 }) }));
    assert.equal(r.accuracy, 70);
    assert.equal(r.helpBeforePct, 40);
    const tom = elevRad({ id: "b", namn: "B" }, state({}));
    assert.equal(tom.accuracy, null);
    assert.equal(tom.helpBeforePct, null);
    assert.equal(tom.started, false);
  });

  it("räknar avslutade, avbrutna och aktiva omgångar var för sig", () => {
    const r = elevRad({ id: "a" }, state({
      "01": e({ roundsCompleted: 2, roundsAborted: 1, firstTotal: 24, firstCorrect: 20 }),
      "02": e({ activeRoundId: "x", activeAnswered: 4, firstTotal: 4, firstCorrect: 2 }),
    }));
    assert.deepEqual([r.roundsCompleted, r.roundsAborted, r.activeRounds], [2, 1, 1]);
    assert.equal(r.firstTotal, 28); // även delvis genomförda omgångar räknas
  });

  it("en elev som inte kan läsas märks som saknad och räknas inte i summan", () => {
    const rader = [
      elevRad({ id: "a" }, state({ "01": e({ firstCorrect: 9, firstTotal: 10, stars: 1 }) })),
      elevRad({ id: "b" }, state({ "01": e({ firstCorrect: 1, firstTotal: 30 }) })),
      elevRad({ id: "c" }, null),
    ];
    const s = klassSumma(rader);
    assert.equal(s.elever, 2);
    assert.equal(s.saknas, 1);
    assert.equal(s.stars, 1);
    assert.equal(s.maxStars, 300);
    // Klassens träffsäkerhet = (9+1)/(10+30) = 25 %, inte elevmedel (90+3)/2 = 47 %.
    assert.equal(s.accuracy, 25);
  });
});

describe("utmaningsAggregat och svaraOchLatta", () => {
  const fem = (fc) => Array.from({ length: 5 }, () => state({ "12": e({ firstCorrect: fc, firstTotal: 10, roundsCompleted: 1 }) }));

  it("Inte tränat är en egen status, aldrig 0 %", () => {
    const agg = utmaningsAggregat([state({})]);
    assert.equal(agg.get("40").inteTranat, true);
    assert.equal(agg.get("40").accuracy, null);
  });

  it("under 3 elever eller 20 svar = Litet underlag, ingen slutsats", () => {
    const agg = utmaningsAggregat([state({ "12": e({ firstCorrect: 1, firstTotal: 30 }) }), state({ "12": e({ firstCorrect: 1, firstTotal: 30 }) })]);
    const s = svaraOchLatta(agg);
    assert.equal(agg.get("12").litetUnderlag, true);
    assert.deepEqual(s.svara, []);
    assert.deepEqual(s.litet.map((a) => a.id), ["12"]);
    const fa = utmaningsAggregat(Array.from({ length: 3 }, () => state({ "12": e({ firstCorrect: 1, firstTotal: 6 }) })));
    assert.equal(fa.get("12").litetUnderlag, true); // 3 elever men 18 svar
  });

  it("låg träffsäkerhet → svåra, hög → lätta, med underlag", () => {
    const svar = svaraOchLatta(utmaningsAggregat(fem(4)));
    assert.equal(svar.svara[0].id, "12");
    assert.equal(svar.svara[0].students, 5);
    assert.equal(svar.svara[0].answers, 50);
    const latt = svaraOchLatta(utmaningsAggregat(fem(9)));
    assert.equal(latt.latta[0].id, "12");
    assert.deepEqual(latt.svara, []);
  });

  it("momentöversikten grupperar på kunskapstaggar och räknar unika elever", () => {
    const m = momentOversikt([
      state({ "11": e({ firstCorrect: 8, firstTotal: 10 }), "12": e({ firstCorrect: 2, firstTotal: 10 }) }),
      state({}),
      null,
    ]);
    const lik = m.find((x) => x.tag === "likvardighet");
    assert.ok(lik.challengeIds.includes("11") && lik.challengeIds.includes("12"));
    assert.equal(lik.students, 1);
    assert.equal(lik.answers, 20);
    assert.equal(lik.accuracy, 50);
    assert.equal(lik.litetUnderlag, true);
    assert.equal(m.find((x) => x.tag === "procent").inteTranat, true);
  });
});

describe("matrisCell och elevUtmaningar", () => {
  it("status går att läsa utan färg (symbol + text)", () => {
    assert.equal(matrisCell(undefined).symbol, "–");
    assert.equal(matrisCell(e({ firstTotal: 10, firstCorrect: 5 })).symbol, "↻");
    assert.equal(matrisCell(e({ activeRoundId: "x", activeAnswered: 3 })).symbol, "◔");
    const m = matrisCell(e({ stars: 3, firstTotal: 30, firstCorrect: 27 }));
    assert.equal(m.symbol, "✓");
    assert.match(m.label, /Bemästrad · 27 av 30 första svar rätt/);
    assert.equal(matrisCell(e({ stars: 2 })).stars, 2);
  });

  it("alla 50, med kategori försökt utan stjärna / inte försökt / bemästrad", () => {
    const lista = elevUtmaningar(state({ "01": e({ stars: 3 }), "02": e({ firstTotal: 6, firstCorrect: 2 }), "03": e({ stars: 1, best: 8, last: 8 }) }));
    assert.equal(lista.length, 50);
    assert.deepEqual(lista.slice(0, 4).map((u) => u.kategori), ["bemastrad", "forsokt-utan-stjarna", "stjarnor", "inte-forsokt"]);
    assert.equal(lista[2].best, 8);
    assert.equal(lista[3].best, null);
  });
});

describe("forslagElev", () => {
  it("bygger tydligt på resultaten (spec-exemplet)", () => {
    const f = forslagElev(state({ "12": e({ firstCorrect: 2, firstTotal: 6 }), "14": e({ firstCorrect: 3, firstTotal: 6 }) }));
    const lik = f.ova.find((x) => x.tag === "likvardighet");
    assert.equal(lik.text, "Öva likvärdiga bråk: 5 av 12 första svar rätt i 12 och 14");
  });
  it("för lite underlag ger inga förslag; stöd nämns som information", () => {
    assert.deepEqual(forslagElev(state({ "12": e({ firstCorrect: 1, firstTotal: 5 }) })).ova, []);
    const f = forslagElev(state({ "31": e({ firstCorrect: 2, firstTotal: 10, helpBefore: 4 }) }));
    assert.match(f.ova[0].text, /stöd före svar i 4 av 10 uppgifter/);
    assert.doesNotMatch(f.ova.map((x) => x.text).join(" "), /diagnos|betyg|svag/i);
  });
  it("idLista skriver svenska", () => {
    assert.equal(idLista(["12"]), "12");
    assert.equal(idLista(["12", "14", "21"]), "12, 14 och 21");
  });
});

describe("historik och progression", () => {
  it("stjarnkurva = kumulativa stjärnor, äldst först; bara stjärnhändelser", () => {
    const k = stjarnkurva([
      { type: "stjarna", challengeId: "02", createdAt: { seconds: 200 } },
      { type: "uppmuntran", createdAt: { seconds: 100 } },
      { type: "stjarna", challengeId: "01", createdAt: { seconds: 100 } },
    ]);
    assert.deepEqual(k.map((p) => [p.challengeId, p.total]), [["01", 1], ["02", 2]]);
  });

  it("omgangRad: resultat, stöd före kontroll och bearbetning ur de tio svaren", () => {
    const ans = (correct, help = [], rework = []) => ({ first: { correct }, helpBefore: help, helpAfter: [], rework });
    const r = omgangRad({ roundId: "r", challengeId: "12", status: "avslutad", version: 2, startedAt: { seconds: 5 },
      answers: [ans(true, ["orientering"]), ans(false, [], [{ correct: true }]), ...Array.from({ length: 8 }, () => ans(true))],
      reward: { kind: "stjarna", starOrdinal: 2 } });
    assert.equal(r.resultat, "9 av 10 rätt");
    assert.deepEqual([r.stodFore, r.bearbetning, r.version, r.beloning, r.startedAt], [1, 1, 2, "Stjärna 2", 5000]);
    const avbr = omgangRad({ status: "avbruten", answers: [ans(true), { first: null }] });
    assert.equal(avbr.resultat, "1/10 besvarade, 1 rätt");
  });

  it("ms läser Timestamp, { seconds }, tal och null", () => {
    assert.equal(ms({ toMillis: () => 7 }), 7);
    assert.equal(ms({ seconds: 2, nanoseconds: 5e6 }), 2005);
    assert.equal(ms(9), 9);
    assert.equal(ms(null), null);
  });

  it("periodfiltret utgår från senaste sparade aktivitet", () => {
    const nu = 100 * 86_400_000;
    assert.equal(aktivSedan({ lastActivity: nu - 3 * 86_400_000 }, 7, nu), true);
    assert.equal(aktivSedan({ lastActivity: nu - 9 * 86_400_000 }, 7, nu), false);
    assert.equal(aktivSedan({ lastActivity: null }, 7, nu), false);
    assert.equal(aktivSedan({ lastActivity: null }, 0, nu), true);
  });
});

describe("recDokument (reglernas form)", () => {
  it("exakt ett mål, kända unika id, kommentar ≤ 200 tecken", () => {
    const d = recDokument({ classId: "4a", challengeIds: ["14", "03", "03", "51"], comment: `  ${"x".repeat(250)} ` }, "t1");
    assert.deepEqual(d.challengeIds, ["03", "14"]);
    assert.equal(d.comment.length, 200);
    assert.deepEqual([d.teacherId, d.classId, d.studentId, d.active], ["t1", "4a", null, true]);
    assert.equal(recDokument({ studentId: "e1", challengeIds: ["01"], comment: "  " }, "t1").comment, null);
    assert.throws(() => recDokument({ classId: "4a", studentId: "e1", challengeIds: ["01"] }, "t1"));
    assert.throws(() => recDokument({ challengeIds: ["01"] }, "t1"));
    assert.throws(() => recDokument({ classId: "4a", challengeIds: ["99"] }, "t1"));
  });
});

describe("testläget och lärarvyn skriver aldrig elevdata", () => {
  const src = (p) => readFileSync(new URL(`../src/brakresan/larare/${p}`, import.meta.url), "utf8");
  it("testläget använder bara demo-backend/demo.js – aldrig data.js eller callables", () => {
    const t = src("testlage.js");
    assert.doesNotMatch(t, /data\.js|serverBackend|httpsCallable|firebase-functions/);
    assert.match(t, /demoBackend\(id, \{ seed \}\)/);
    assert.match(t, /demoRound\(id, seed\)/);
  });
  it("lärarens enda skrivningar gäller brakresaRecommendations", () => {
    const d = src("data-larare.js");
    for (const m of d.matchAll(/(addDoc|updateDoc|deleteDoc|setDoc)\(([^;]*)/g)) {
      assert.match(m[2], /^recs\(|brakresaRecommendations/, `${m[0]} skriver utanför rekommendationerna`);
    }
    assert.doesNotMatch(d, /setDoc|runTransaction|writeBatch|httpsCallable/);
  });
  it("lärarvyn laddas lat från teacher-class.js och teacher-shared.js", () => {
    const klass = readFileSync(new URL("../src/teacher-class.js", import.meta.url), "utf8");
    const shared = readFileSync(new URL("../src/teacher-shared.js", import.meta.url), "utf8");
    assert.match(klass, /import\("\.\/brakresan\/larare\/klass\.js"\)/);
    assert.match(shared, /import\("\.\/brakresan\/larare\/testlage\.js"\)/);
    assert.doesNotMatch(klass + shared, /^import .*brakresan/m);
  });
});
