// ============================================================================
// Enhetstester: Snilleblixtens elevskärm (#558) – lägena i designspec §5.8
// ur verifierad data: test 6 (fel → ❌ först vid avslöjandet, 0 poäng),
// test 11 (omladdning efter svar → "Svar inskickat"), sen anslutning (§5.7),
// placering med delad plats. Vyn: src/live/formats/snilleblixt/snilleblixt-student.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  elevLage, myStanding, formatPoints, relativeStanding, relativeText, endStanding,
} from "../src/live/formats/snilleblixt/snilleblixt-elev.js";
import { scoreQuestion } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";

const T0 = 1_700_000_000_000;
const question = { key: "0:7x8", text: "7 × 8", options: ["54", "56", "64", "48"] };
const facit = { answerIndex: 1, correctAnswer: "56" };
const sess = (q, over = {}) => ({ status: "live", questionCount: 10, questionSeconds: 20, answerKind: "choice", q, ...over });
const open = (over = {}) => ({ index: 0, phase: "open", openedAt: T0, question, ...over });
const me = { uid: "alma", joinedAt: T0 - 60_000 };
const answer = (uid, choiceIndex, atS) => ({ uid, q: 0, choiceIndex, at: T0 + atS * 1000 });

describe("Snilleblixten elev: lägen före avslöjandet", () => {
  it("ingen spelare = ansluter; ingen fråga än = gör dig redo", () => {
    assert.equal(elevLage({ s: sess(null), player: null, uid: "alma" }).kind, "ansluter");
    assert.equal(elevLage({ s: sess(null), player: me, uid: "alma" }).kind, "forsta");
  });

  it("öppen fråga utan svar → fraga med svarsfönstret; 'Fråga 1 av 10'", () => {
    const l = elevLage({ s: sess(open()), player: me, uid: "alma", now: T0 + 3000 });
    assert.equal(l.kind, "fraga");
    assert.equal(l.endMs, T0 + 20_000);
    assert.equal(l.number, 1);
    assert.equal(l.total, 10);
    assert.equal(l.question, question);
  });

  it("test 11: eget svarsdokument finns (omladdning) → svarat, även när frågan stängts", () => {
    const mine = { choiceIndex: 2 };
    assert.equal(elevLage({ s: sess(open()), player: me, uid: "alma", mine, now: T0 + 3000 }).kind, "svarat");
    assert.equal(elevLage({ s: sess(open({ phase: "closed", closedAt: T0 + 9000 })), player: me, uid: "alma", mine }).kind, "svarat");
  });

  it("tiden ute utan svar (även innan läraren stängt) → tid-ute", () => {
    assert.equal(elevLage({ s: sess(open()), player: me, uid: "alma", now: T0 + 20_000 }).kind, "tid-ute");
    assert.equal(elevLage({ s: sess(open({ phase: "closed", closedAt: T0 + 5000 })), player: me, uid: "alma" }).kind, "tid-ute");
  });

  it("§5.7 sen anslutning: anslöt efter att frågan öppnade → sen (in från nästa fråga)", () => {
    const late = { uid: "omar", joinedAt: T0 + 2000 };
    assert.equal(elevLage({ s: sess(open()), player: late, uid: "omar", now: T0 + 3000 }).kind, "sen");
    // Nästa fråga öppnas efter anslutningen → får svara.
    const q2 = open({ index: 1, openedAt: T0 + 30_000 });
    assert.equal(elevLage({ s: sess(q2), player: late, uid: "omar", now: T0 + 31_000 }).kind, "fraga");
  });

  it("överhoppad fråga → hoppad", () => {
    assert.equal(elevLage({ s: sess(open({ phase: "skipped" })), player: me, uid: "alma" }).kind, "hoppad");
  });
});

describe("Snilleblixten elev: avslöjandet ur sbScores", () => {
  const answers = [answer("alma", 1, 4), answer("leo", 0, 2), answer("ines", 1, 10)];
  const sc = scoreQuestion({ q: open({ closedAt: T0 + 12_000 }), facit, answers, questionSeconds: 20, answerKind: "choice" });
  const revealed = sess(open({ phase: "revealed", closedAt: T0 + 12_000, facit }));

  it("rätt → +900 (4 s av 20) och 'Du leder! ⚡' (ingen placering som nummer)", () => {
    const l = elevLage({ s: revealed, player: me, uid: "alma", mine: { choiceIndex: 1 }, scores: [sc] });
    assert.equal(l.kind, "ratt");
    assert.equal(l.points, 900);
    assert.equal(l.rank, undefined);
    assert.equal(relativeText(l.rel), "Du leder! ⚡");
    assert.equal(l.totalPoints, 900);
  });

  it("test 6: fel → fel, 0 poäng, rätt svar med; placering efter dem med poäng", () => {
    const l = elevLage({ s: revealed, player: { uid: "leo", joinedAt: T0 - 1 }, uid: "leo", mine: { choiceIndex: 0 }, scores: [sc] });
    assert.equal(l.kind, "fel");
    assert.equal(l.points, 0);
    assert.deepEqual(l.facit, facit);
    // Leo har 0 → bakom den närmaste med poäng (Ines), namnet ur projektionen.
    const named = elevLage({ s: revealed, player: { uid: "leo", joinedAt: T0 - 1 }, uid: "leo", mine: { choiceIndex: 0 }, scores: [sc], names: { ines: "Ines", alma: "Alma" } });
    assert.match(relativeText(named.rel), /^\d[\d ]* poäng bakom Ines$/);
  });

  it("test 6: före avslöjandet syns inget omdöme (facit saknas, svarat)", () => {
    const l = elevLage({ s: sess(open({ phase: "closed", closedAt: T0 + 12_000 })), player: me, uid: "alma", mine: { choiceIndex: 1 }, scores: [] });
    assert.equal(l.kind, "svarat");
    assert.equal(l.facit, undefined);
  });

  it("avslöjad men poängen inte framme än → stannar på svarat (ingen gissning)", () => {
    assert.equal(elevLage({ s: revealed, player: me, uid: "alma", mine: { choiceIndex: 1 }, scores: [] }).kind, "svarat");
  });

  it("inget svar → inget-svar; sen anslutning → visa-svar (inget omdöme)", () => {
    assert.equal(elevLage({ s: revealed, player: { uid: "bo", joinedAt: T0 - 1 }, uid: "bo", scores: [sc] }).kind, "inget-svar");
    assert.equal(elevLage({ s: revealed, player: { uid: "sen", joinedAt: T0 + 1 }, uid: "sen", scores: [sc] }).kind, "visa-svar");
  });
});

describe("Snilleblixten elev: ingen placering som nummer (Elias 2026-10-10)", () => {
  const list = [
    { uid: "a", points: 3000, name: "Alma" }, { uid: "b", points: 2500, name: "Bo" }, { uid: "c", points: 2500, name: "Cia" },
    { uid: "d", points: 1800, name: "Dan" }, { uid: "e", points: 0, name: "Eva" },
  ];
  const ingetNummer = (t) => assert.ok(!/\d+:[ae]\b|plats|ligger|sist/i.test(t), `placering läckte: ${t}`);

  it("ledaren: 'Du leder! ⚡'", () => {
    assert.equal(relativeText(relativeStanding(list, "a")), "Du leder! ⚡");
  });

  it("mitten: 'X poäng bakom <närmaste framför>'", () => {
    const t = relativeText(relativeStanding(list, "d"));
    assert.equal(t, "700 poäng bakom Bo");
    ingetNummer(t);
  });

  it("sist: bara avståndet till närmaste framför – ingen placering syns", () => {
    const t = relativeText(relativeStanding(list, "e"));
    assert.equal(t, "1 800 poäng bakom Dan");
    ingetNummer(t);
  });

  it("lika poäng: 'Lika med <Namn>' (delad ledning: '– ni leder!'); flera framför på samma poäng → en av dem", () => {
    assert.equal(relativeText(relativeStanding(list, "c")), "Lika med Bo");
    assert.equal(relativeText(relativeStanding(list, "b")), "Lika med Cia");
    const topp = [{ uid: "x", points: 900, name: "Xena" }, { uid: "y", points: 900, name: "Yan" }];
    assert.equal(relativeText(relativeStanding(topp, "y")), "Lika med Xena – ni leder! ⚡");
    const tva = [{ uid: "p", points: 500, name: "Pia" }, { uid: "o", points: 500, name: "Olle" }, { uid: "m", points: 100, name: "Me" }];
    assert.equal(relativeText(relativeStanding(tva, "m")), "400 poäng bakom Olle");
  });

  it("ingen har poäng → ingen rad; saknat namn → 'en klasskompis'", () => {
    assert.equal(relativeText(relativeStanding([{ uid: "a", points: 0 }, { uid: "b", points: 0 }], "a")), "");
    assert.equal(relativeText(relativeStanding([{ uid: "a", points: 10 }, { uid: "b", points: 30 }], "a")), "20 poäng bakom en klasskompis");
  });

  it("slutskärmen: topp 3 får sin pallplats (även delad), övriga bara läget mot närmaste framför", () => {
    const result = { ranking: [
      { uid: "a", name: "Alma 4B", points: 3000, rank: 1 }, { uid: "b", name: "Bo 4B", points: 2500, rank: 2 },
      { uid: "c", name: "Cia 4B", points: 2500, rank: 2 }, { uid: "d", name: "Dan 4B", points: 1800, rank: 4 },
      { uid: "e", name: "Eva 4B", points: 0, rank: 5 },
    ] };
    assert.equal(endStanding(result, "a").podium, 1);
    assert.equal(endStanding(result, "c").podium, 2);
    const d = endStanding(result, "d");
    assert.equal(d.podium, null);
    assert.equal(relativeText(d.rel), "700 poäng bakom Bo");
    const e = endStanding(result, "e");
    assert.equal(e.podium, null);
    assert.equal(relativeText(e.rel), "1 800 poäng bakom Dan");
    // 0 poäng står aldrig på pallen, även om bara tre spelade.
    assert.equal(endStanding({ ranking: [{ uid: "z", name: "Z", points: 0, rank: 1 }] }, "z").podium, null);
  });
});

describe("Snilleblixten elev: placering och format", () => {
  it("delad placering: lika poäng delar plats, 0 poäng efter alla med poäng", () => {
    const scores = [{ index: 0, skipped: false, points: { a: 900, b: 900, c: 700, d: 0 }, correct: { a: true, b: true, c: true, d: false } }];
    assert.equal(myStanding({}, scores, "b").rank, 1);
    assert.equal(myStanding({}, scores, "c").rank, 3);
    assert.equal(myStanding({}, scores, "d").rank, 4);
    assert.equal(myStanding({}, scores, "ny").rank, 4); // anslöt men inte svarat
  });

  it("formatPoints: '4 230' (vanligt mellanslag)", () => {
    assert.equal(formatPoints(4230), "4 230");
    assert.equal(formatPoints(870), "870");
  });
});
