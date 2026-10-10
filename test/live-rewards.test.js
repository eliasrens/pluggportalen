// ============================================================================
// Enhetstester: Pluggmynt efter matchen (#557, spec §7.2) – placeringspris
// (20b/20c/20d), mynt per rätt med trappa + tak (20e), ej deltagit (20h),
// slutskärmens text (20i), lärarens val, demo betalar aldrig och
// Snilleblixtens result. Regel-/emulatorsidan (20f/20g):
// test/firestore-rules-live-rewards.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  placementPrize, perCorrectCoins, rankByScore, parseRewards, validateRewards, rewardSessionFields,
  sessionRewards, computeRewards, withRewards, payoutList, rewardsPreviewText, myReward, rewardSummary,
  placeText, rewardsSetupField,
} from "../src/live/live-rewards.js";
import { LIVE_REWARDS } from "../src/live/rewards-config.js";
import { requireFormat } from "../src/live/formats/index.js";
import { validateSessionInput, buildSessionDoc } from "../src/live/live-core.js";
import { buildResult } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import "../src/live/modes/index.js";

const sess = (rewards, over = {}) => ({ rewards, status: "finished", startedAt: { seconds: 1 }, ...over });
const R300 = { firstPrize: 300, perCorrect: 5, cap: 300 };

describe("Pluggmynt: placeringspris (§7.2.2)", () => {
  it("20b – förstapris 300, 25 deltagare: 300, 255, 217, 184, 157 … 6 på plats 25, alla ≥ 1", () => {
    const priser = Array.from({ length: 25 }, (_, i) => placementPrize(300, i + 1));
    assert.deepEqual(priser.slice(0, 10), [300, 255, 217, 184, 157, 133, 113, 96, 82, 69]);
    assert.equal(priser[24], 6);
    assert.ok(priser.every((p) => p >= 1));
  });

  it("20c – förstapris 100: 100, 85, 72, 61, 52", () => {
    assert.deepEqual([1, 2, 3, 4, 5].map((p) => placementPrize(100, p)), [100, 85, 72, 61, 52]);
  });

  it("räknas alltid ur förstapriset; golv 1; 0 = av", () => {
    assert.equal(placementPrize(300, 3), Math.round(300 * 0.85 ** 2));
    assert.equal(placementPrize(1, 30), 1);
    assert.equal(placementPrize(5, 40), 1);
    assert.equal(placementPrize(0, 1), 0);
    assert.equal(placementPrize("", 1), 0);
  });

  it("20d – två delar 2:a plats → båda 255, nästa är 4:a och får 184", () => {
    const rows = [
      { uid: "a", score: 900, correct: 9, answered: 9 },
      { uid: "b", score: 700, correct: 7, answered: 7 },
      { uid: "c", score: 700, correct: 7, answered: 7 },
      { uid: "d", score: 500, correct: 5, answered: 5 },
    ];
    const rw = computeRewards(sess({ firstPrize: 300, perCorrect: 0, cap: 300 }), rows);
    assert.deepEqual(["a", "b", "c", "d"].map((u) => [rw[u].rank, rw[u].prize]), [[1, 300], [2, 255], [2, 255], [4, 184]]);
    assert.deepEqual(rankByScore(rows).map((r) => r.rank), [1, 2, 2, 4]);
  });
});

describe("Pluggmynt: per rätt svar med trappa (§7.2.3)", () => {
  it("20e – 5 per rätt, tak 300: 15/50/100/400 rätt → 75/210/300/300", () => {
    assert.deepEqual([15, 50, 100, 400].map((n) => perCorrectCoins(n, 5, 300)), [75, 210, 300, 300]);
  });

  it("trappan block för block (1–20, 21–40 …, 81+ = 20 %)", () => {
    assert.equal(perCorrectCoins(20, 5, 9999), 100);
    assert.equal(perCorrectCoins(40, 5, 9999), 180);
    assert.equal(perCorrectCoins(42, 5, 9999), 186);
    assert.equal(perCorrectCoins(120, 5, 9999), 320);
  });

  it("avrundas uppåt (hellre ett mynt för mycket): 3 per rätt, 21 rätt = 60 + 2,4 → 63", () => {
    assert.equal(perCorrectCoins(21, 3, 300), 63);
    assert.equal(perCorrectCoins(41, 3, 300), 60 + 48 + 2);
  });

  it("0 per rätt = av, 0 rätt = 0", () => {
    assert.equal(perCorrectCoins(50, 0, 300), 0);
    assert.equal(perCorrectCoins(0, 5, 300), 0);
  });

  it("ekonomins rattar ligger i konfigurationsfilen", () => {
    assert.equal(LIVE_REWARDS.blockSize, 20);
    assert.deepEqual([...LIVE_REWARDS.steps], [1, 0.8, 0.6, 0.4, 0.2]);
    assert.equal(LIVE_REWARDS.defaultCap, 300);
    assert.equal(LIVE_REWARDS.defaultPerCorrect, 5);
  });
});

describe("Pluggmynt: per elev och session", () => {
  const rows = [
    { uid: "alma", score: 5000, correct: 50, answered: 55 },
    { uid: "bo", score: 4200, correct: 42, answered: 50 },
    { uid: "cleo", score: 0, correct: 0, answered: 3 },
    { uid: "dag", score: 0, correct: 0, answered: 0 },
  ];

  it("20h – ansluten men aldrig svarat → inget placeringspris och inga mynt", () => {
    const rw = computeRewards(sess(R300), rows);
    assert.equal(rw.dag, undefined);
    assert.equal(myReward({ rewards: rw }, "dag"), null);
    // Svarat (fast allt fel) = deltagit → sista plats, minst 1.
    assert.deepEqual(rw.cleo, { rank: 3, correct: 0, prize: 217, correctCoins: 0, total: 217 });
  });

  it("20i – 2:a med 42 rätt (5 per rätt, förstapris 300) → 255 + 186 = 441 och slutskärmens text", () => {
    const rw = computeRewards(sess(R300), rows);
    assert.deepEqual(rw.bo, { rank: 2, correct: 42, prize: 255, correctCoins: 186, total: 441 });
    assert.deepEqual(rewardSummary(rw.bo), {
      title: "🥈 Du kom 2:a!",
      lines: [{ label: "Placeringspris", coins: 255 }, { label: "42 rätt svar", coins: 186 }],
      total: 441,
    });
  });

  it("utan belöningar på sessionen: inget rewards-fält i result", () => {
    assert.equal(sessionRewards(sess(undefined)), null);
    assert.equal(sessionRewards(sess({ firstPrize: 0, perCorrect: 0, cap: 300 })), null);
    const base = { format: "x" };
    assert.equal(withRewards(sess(undefined), base, rows), base);
    assert.ok("rewards" in withRewards(sess(R300), base, rows));
  });

  it("utbetalningslistan: bara efter slut, aldrig demo, bara total ≥ 1", () => {
    const result = { rewards: { a: { prize: 300, correctCoins: 10, total: 310 }, b: { prize: 0, correctCoins: 0, total: 0 } } };
    assert.deepEqual(payoutList("s1", sess(R300, { result })), [{ uid: "a", prize: 300, correctCoins: 10, total: 310 }]);
    assert.deepEqual(payoutList("s1", sess(R300, { result, status: "live" })), []);
    assert.deepEqual(payoutList("s1", sess(R300, { result, demo: true })), []);
    assert.deepEqual(payoutList("s1", sess(R300)), []);
  });

  it("placeText: 1:a, 2:a, 3:e, 11:e, 12:e, 21:a, 22:a", () => {
    assert.deepEqual([1, 2, 3, 11, 12, 21, 22, 25].map(placeText), ["1:a", "2:a", "3:e", "11:e", "12:e", "21:a", "22:a", "25:e"]);
    assert.equal(rewardSummary({ rank: 1, correct: 0, prize: 300, correctCoins: 0, total: 300 }).title, "🥇 Du kom 1:a!");
  });
});

describe("Pluggmynt: lärarens val", () => {
  it("förhandsvisning: \"En elev som får 50 rätt får 210 pluggmynt. Högst 300 per elev.\"", () => {
    const t = rewardsPreviewText({ firstPrize: "", perCorrect: "5", cap: "300" });
    assert.equal(t, "En elev som får 50 rätt får 210 pluggmynt. Högst 300 per elev.");
    assert.match(rewardsPreviewText({ firstPrize: "300", perCorrect: "0", cap: "300" }), /300, 255, 217/);
    assert.equal(rewardsPreviewText({ firstPrize: "", perCorrect: "0", cap: "" }), "Inga pluggmynt delas ut.");
  });

  it("validering: förstapris 0–1000 (tomt = av), per rätt 0–50, tak 1–1000 (tomt = förval)", () => {
    assert.deepEqual(validateRewards({ firstPrize: "", perCorrect: "5", cap: "" }), []);
    assert.deepEqual(parseRewards({ firstPrize: "", perCorrect: "5", cap: "" }), { firstPrize: 0, perCorrect: 5, cap: 300 });
    assert.equal(validateRewards({ firstPrize: "1001" }).length, 1);
    assert.equal(validateRewards({ firstPrize: "2.5" }).length, 1);
    assert.equal(validateRewards({ perCorrect: "-1" }).length, 1);
    assert.equal(validateRewards({ cap: "0" }).length, 1);
    assert.deepEqual(validateRewards(undefined), []);
    assert.deepEqual(rewardSessionFields({ firstPrize: "300", perCorrect: "5", cap: "300" }), { rewards: R300 });
    assert.deepEqual(rewardSessionFields(undefined), {});
  });

  it("Snilleblixten: fältet i setupFields, validering och sessionsfältet", () => {
    const SB = requireFormat("snilleblixt");
    assert.ok(SB.setupFields.some((f) => f.key === "rewards" && f.kind === "custom"));
    assert.equal(rewardsSetupField().kind, "custom");
    const input = {
      name: "SB", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
      classIds: ["4b"], classNames: { "4b": "4B" }, questionCount: 10, questionSeconds: 20,
      rewards: { firstPrize: "300", perCorrect: "5", cap: "300" },
    };
    assert.deepEqual(validateSessionInput(input), []);
    assert.deepEqual(buildSessionDoc(input, { uid: "l" }).rewards, R300);
    assert.equal(validateSessionInput({ ...input, rewards: { firstPrize: "5000" } }).length, 1);
    // Klassmatchen har kvar sitt mynt-pris (#526) – inga Pluggmynt-fält.
    assert.ok(!requireFormat("klassmatch").setupFields.some((f) => f.key === "rewards"));
  });

  it("Snilleblixtens result: rewards ur poängställningen, bara deltagare", () => {
    const s = sess(R300, { participatingClassIds: ["4b"], classNames: { "4b": "4B" } });
    const players = ["alma", "bo", "dag"].map((uid) => ({ uid, name: uid, classId: "4b" }));
    const scores = [
      { index: 0, skipped: false, points: { alma: 900, bo: 800 }, correct: { alma: true, bo: true } },
      { index: 1, skipped: false, points: { alma: 0, bo: 700 }, correct: { alma: false, bo: true } },
    ];
    const r = buildResult(s, [], players, null, { scores });
    assert.deepEqual(Object.keys(r.rewards).sort(), ["alma", "bo"]);
    assert.deepEqual(r.rewards.bo, { rank: 1, correct: 2, prize: 300, correctCoins: 10, total: 310 });
    assert.deepEqual(r.rewards.alma, { rank: 2, correct: 1, prize: 255, correctCoins: 5, total: 260 });
    assert.equal(r.winner, null); // inga klasspokaler (§7.2.6)
  });
});
