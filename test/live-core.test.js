// Live-kärnan (#460): faser, nedräkning, klassresultat, vinnare, historik.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  phaseAt, sessionTimes, sumCounters, classStandings, decideWinner, topPlayers, buildResult,
  formatScore, formatClock, sessionTitle, defaultSessionName, validateSessionInput, buildSessionDoc,
  LIVE_COUNTDOWN_SECONDS, READY_FRESH_MS,
} from "../src/live/live-core.js";

const T = 1_800_000_000_000;
const base = (over = {}) => ({
  ...buildSessionDoc({
    name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 },
  }, { uid: "rasmus" }),
  ...over,
});

describe("Live: faser och tid (server-korrigerad)", () => {
  it("lobby före start, hela matchtiden kvar", () => {
    assert.deepEqual(phaseAt(base(), T), { phase: "lobby", countdown: null, msLeft: 20 * 60_000 });
  });

  it("3-2-1-KÖR under nedräkningen, sedan live med tid kvar, sedan slut", () => {
    const s = base({ status: "live", startedAt: T });
    assert.equal(LIVE_COUNTDOWN_SECONDS, 4);
    assert.equal(phaseAt(s, T).countdown, 3);
    assert.equal(phaseAt(s, T + 1000).countdown, 2);
    assert.equal(phaseAt(s, T + 2500).countdown, 1);
    assert.equal(phaseAt(s, T + 3999).countdown, 0); // KÖR!
    const live = phaseAt(s, T + 4000);
    assert.equal(live.phase, "live");
    assert.equal(live.msLeft, 20 * 60_000);
    assert.equal(phaseAt(s, T + 4000 + 20 * 60_000 - 1).phase, "live");
    assert.equal(phaseAt(s, T + 4000 + 20 * 60_000).phase, "ended");
    assert.equal(sessionTimes(s).endMs, T + 4000 + 1_200_000);
  });

  it("Timestamp-lika startedAt fungerar; finished vs avbruten lobby", () => {
    const s = base({ status: "live", startedAt: { toMillis: () => T } });
    assert.equal(phaseAt(s, T + 5000).phase, "live");
    assert.equal(phaseAt({ ...s, status: "finished" }, T).phase, "finished");
    assert.equal(phaseAt(base({ status: "finished" }), T).phase, "cancelled");
  });

  it("ingen matchklocka (lärarstyrt format, #558): live tills status finished – aldrig ended", () => {
    const s = { status: "live", startedAt: T, countdownSeconds: 4 };
    assert.equal(sessionTimes(s).endMs, null);
    assert.equal(phaseAt(s, T + 1000).phase, "countdown");
    assert.deepEqual(phaseAt(s, T + 4000), { phase: "live", countdown: null, msLeft: 0 });
    assert.equal(phaseAt(s, T + 6 * 3600_000).phase, "live");
    assert.equal(phaseAt({ ...s, status: "finished" }, T).phase, "finished");
  });

  it("klockan visar 00:00 först när tiden är ute", () => {
    assert.equal(formatClock(12 * 60_000 + 43_000), "12:43");
    assert.equal(formatClock(400), "00:01");
    assert.equal(formatClock(0), "00:00");
  });
});

describe("Live: poäng = rätt / lärarens nämnare (spec Live-test 6)", () => {
  it("340/17 = 20,0 mot 418/22 = 19,0 → 4B leder", () => {
    const counters = [
      { classId: "4b", shard: 0, correct: 200 }, { classId: "4b", shard: 3, correct: 140 },
      { classId: "5e", shard: 1, correct: 418 },
    ];
    const st = classStandings(base(), sumCounters(counters));
    assert.deepEqual(st.map((c) => [c.name, c.correct, c.divisor, formatScore(c.score)]),
      [["4B", 340, 17, "20,0"], ["5E", 418, 22, "19,0"]]);
    assert.deepEqual(decideWinner(st), { winnerId: "4b", draw: false, leaderIds: ["4b"] });
  });

  it("exakt lika poäng = oavgjort; nämnare saknas → 1 (aldrig division med 0)", () => {
    const st = classStandings(base({ classDivisors: { "4b": 10, "5e": 20 } }), { "4b": 100, "5e": 200 });
    assert.equal(decideWinner(st).draw, true);
    assert.equal(classStandings(base({ classDivisors: {} }), { "4b": 5 })[0].score, 5);
  });

  it("redo per klass = spelare med färsk puls i lobbyn (spec Live-test 2)", () => {
    const players = [
      ...Array.from({ length: 15 }, (_, i) => ({ uid: `a${i}`, classId: "4b", lastSeenAt: T - 1000 })),
      ...Array.from({ length: 18 }, (_, i) => ({ uid: `b${i}`, classId: "5e", lastSeenAt: T - 2000 })),
      { uid: "gammal", classId: "4b", lastSeenAt: T - READY_FRESH_MS - 1 },
    ];
    const st = classStandings(base(), {}, players, T);
    assert.deepEqual(st.map((c) => [c.classId, c.ready, c.joined]), [["4b", 15, 16], ["5e", 18, 18]]);
  });

  it("topplista + historik-ögonblicksbild", () => {
    const players = [
      { uid: "a", name: "Alma", classId: "4b", correct: 30, incorrect: 2 },
      { uid: "o", name: "Omar", classId: "4b", correct: 41, incorrect: 5 },
      { uid: "c", name: "Clara", classId: "5e", correct: 30, incorrect: 1 },
    ];
    assert.deepEqual(topPlayers(players, 2).map((p) => p.name), ["Omar", "Clara"]);
    const st = classStandings(base(), { "4b": 340, "5e": 418 }, players);
    const r = buildResult(base(), st, players);
    assert.equal(r.winner, "4b");
    assert.equal(r.totalCorrect, 758);
    assert.equal(r.perClass["5e"].score, 19);
    assert.equal(r.players, 3);
    assert.equal(r.cooperative, undefined);
    assert.equal(r.goalReached, undefined);
  });

  it("kooperativt läge (#495): result.cooperative + goalReached ur lägets mål", () => {
    const st = classStandings(base({ gameMode: "koop_test" }), { "4b": 340, "5e": 418 }, []);
    const koop = (mal) => ({ id: "koop_test", cooperative: true, goalReached: (s) => s.reduce((n, c) => n + c.correct, 0) >= mal });
    const nadd = buildResult(base({ gameMode: "koop_test" }), st, [], koop(700));
    assert.deepEqual([nadd.cooperative, nadd.goalReached], [true, true]);
    assert.equal(buildResult(base({ gameMode: "koop_test" }), st, [], koop(800)).goalReached, false);
    // Tävlingsläge eller läge som inte är sessionens → inga koop-fält.
    assert.equal(buildResult(base(), st, [], koop(700)).cooperative, undefined);
    assert.equal(buildResult(base({ gameMode: "koop_test" }), st, [], { id: "koop_test" }).cooperative, undefined);
  });
});

describe("Live: skapa session", () => {
  it("validerar formuläret", () => {
    const ok = { name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"], durationMin: 20, divisors: { "4b": 17, "5e": 22 } };
    assert.deepEqual(validateSessionInput(ok, { knownModes: ["multiplication_0_10"] }), []);
    assert.ok(validateSessionInput({ ...ok, classIds: ["4b"] }).length);
    assert.ok(validateSessionInput({ ...ok, durationMin: 7 }).length);
    assert.ok(validateSessionInput({ ...ok, divisors: { "4b": 0, "5e": 22 } }).length);
    assert.ok(validateSessionInput({ ...ok, gameMode: "okänt" }, { knownModes: ["multiplication_0_10"] }).length);
  });

  it("dokumentet: lobby, sekunder, nedräkning 4, 10 shards, klassnamn denormaliserade", () => {
    const d = base();
    assert.equal(d.status, "lobby");
    assert.equal(d.durationSeconds, 1200);
    assert.equal(d.countdownSeconds, 4);
    assert.equal(d.counterShards, 10);
    assert.deepEqual(d.classDivisors, { "4b": 17, "5e": 22 });
    assert.equal(sessionTitle(d), "4B MOT 5E");
    assert.equal(defaultSessionName(["4B", "5E"]), "4B mot 5E");
    assert.ok(!("startedAt" in d) && !("endsAt" in d));
  });
});
