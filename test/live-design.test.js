// Live-design (#571): gemensam grund – avatarläsning via klassprojektionen,
// händelsesystemet, animationskön och ljudkön. Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createAvatarRoster } from "../src/live/design/live-avatars.js";
import { createLiveEventTracker, rankPlayers } from "../src/live/design/live-events.js";
import { createLiveQueue, PRIORITY, rushFor } from "../src/live/design/live-queue.js";
import { createSoundGate, CUES } from "../src/live/proj-sound.js";
import { createClassProjectionStore } from "../src/class-projection.js";
import { DEFAULT_AVATAR } from "../src/avatars.js";

const memStore = () => {
  const m = new Map();
  return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: (k, v) => m.set(k, JSON.stringify(v)), m };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

// --- Avatarer: läsningar (designtest 2 + 3) -----------------------------------

/** Fejk-Firestore som räknar varje getDoc per kollektion (som class-projection.test.js). */
function countingStore(docs) {
  const reads = { classProjections: 0, studentData: 0, students: 0 };
  const store = createClassProjectionStore({
    db: {},
    doc: (_db, ...path) => ({ path }),
    collection: (_db, ...path) => ({ path }),
    getDoc: async (ref) => {
      reads[ref.path[0]] = (reads[ref.path[0]] || 0) + 1;
      const d = docs[ref.path.join("/")];
      return { exists: () => !!d, data: () => d };
    },
    getDocs: async () => { throw new Error("getDocs ska aldrig anropas"); },
    setDoc: async () => { throw new Error("Live skriver aldrig projektionen"); },
    updateDoc: async () => { throw new Error("Live skriver aldrig projektionen"); },
  });
  const load = async (classId, { fresh } = {}) => {
    if (fresh) store.invalidateClassProjection(classId);
    return store.getClassProjection(classId);
  };
  return { reads, load };
}

function klass(n, extra = {}) {
  const members = {};
  for (let i = 0; i < n; i++) {
    members[`e${i}`] = { namn: `Elev ${i}`, avatarId: i % 2 ? "owl" : "cat", avatarItems: i === 0 ? ["trollkarlshatt", "cape"] : [], husLast: false };
  }
  return { members: { ...members, ...extra } };
}

describe("Live-avatarer: klassprojektionen (§4.2)", () => {
  it("designtest 2: 28 elever ur samma klass → EN läsning av projektionen, 0 studentData", async () => {
    const { reads, load } = countingStore({ "classProjections/4b": klass(28) });
    const r = createAvatarRoster({ load });
    await r.prefetch(["4b"]);
    // Eleverna ansluter en och en, och sedan alla på en gång.
    for (let i = 0; i < 28; i++) await r.ensure([{ uid: `e${i}`, classId: "4b" }]);
    await r.ensure(Array.from({ length: 28 }, (_, i) => ({ uid: `e${i}`, classId: "4b" })));
    await r.whenSettled();
    assert.equal(reads.classProjections, 1);
    assert.equal(reads.studentData, 0);
    assert.equal(reads.students, 0);
    assert.equal(r.reads(), 1);
  });

  it("designtest 1: hatt + mantel följer med ur projektionen", async () => {
    const { load } = countingStore({ "classProjections/4b": klass(3) });
    const r = createAvatarRoster({ load });
    await r.ensure([{ uid: "e0", classId: "4b" }]);
    const i = r.info("e0");
    assert.equal(i.avatarId, "cat");
    assert.deepEqual(i.avatarItems, ["trollkarlshatt", "cape"]);
    assert.equal(i.resolved, true);
  });

  it("två klasser → en läsning per deltagande klass", async () => {
    const { reads, load } = countingStore({ "classProjections/4b": klass(25), "classProjections/5e": klass(25) });
    const r = createAvatarRoster({ load });
    await r.prefetch(["4b", "5e", "4b"]);
    await r.ensure([{ uid: "e1", classId: "4b" }, { uid: "e2", classId: "5e" }]);
    assert.equal(reads.classProjections, 2);
  });

  it("saknad elev → EN omläsning av klassen (även om många saknas), sedan standardavatar", async () => {
    const { reads, load } = countingStore({ "classProjections/4b": klass(3) });
    const r = createAvatarRoster({ load, retryMs: 5 });
    await r.ensure([{ uid: "ny1", classId: "4b" }, { uid: "ny2", classId: "4b" }, { uid: "e1", classId: "4b" }]);
    await r.ensure([{ uid: "ny3", classId: "4b" }]);
    await r.whenSettled();
    assert.equal(reads.classProjections, 2, "första läsningen + en omläsning");
    assert.equal(reads.studentData, 0);
    const i = r.info("ny1");
    assert.equal(i.avatarId, DEFAULT_AVATAR);
    assert.deepEqual(i.avatarItems, []);
    assert.equal(i.resolved, true);
    // Samma saknade elev igen → ingen ny läsning.
    await r.ensure([{ uid: "ny1", classId: "4b" }]);
    await r.whenSettled();
    assert.equal(reads.classProjections, 2);
  });

  it("en elev som publicerat sig efter första läsningen hittas vid omläsningen", async () => {
    const docs = { "classProjections/4b": klass(2) };
    const { reads, load } = countingStore(docs);
    const r = createAvatarRoster({ load, retryMs: 5 });
    await r.prefetch(["4b"]);
    docs["classProjections/4b"] = klass(2, { sen: { avatarId: "frog", avatarItems: ["keps"] } });
    const changed = [];
    r.onChange((u) => changed.push(...u));
    await r.ensure([{ uid: "sen", classId: "4b" }]);
    await r.whenSettled();
    assert.equal(reads.classProjections, 2);
    assert.equal(r.info("sen").avatarId, "frog");
    assert.ok(changed.includes("sen"));
  });

  it("designtest 3: låst hus → samma avatar som byn ritar (projektionens), inget mer läses", async () => {
    // Byn ritar en låst kamrats avatar ur projektionen (entryToBoende) och låser
    // bara rummet. Projektionen bär aldrig låst innehåll.
    const { reads, load } = countingStore({
      "classProjections/4b": { members: { last: { namn: "Låst", avatarId: "fox", avatarItems: [], husLast: true } } },
    });
    const r = createAvatarRoster({ load });
    await r.ensure([{ uid: "last", classId: "4b" }]);
    const i = r.info("last");
    assert.equal(i.locked, true);
    assert.equal(i.avatarId, "fox");
    assert.equal(reads.studentData, 0);
    assert.equal(reads.students, 0);
  });

  it("projektionen kan inte läsas → standardavatar, ingen krasch", async () => {
    const r = createAvatarRoster({ load: async () => { throw new Error("nät"); }, retryMs: 1 });
    await r.ensure([{ uid: "x", classId: "4b" }]);
    await r.whenSettled();
    assert.equal(r.info("x").avatarId, DEFAULT_AVATAR);
  });
});

// --- Händelsesystemet (§9, designtest 10) ------------------------------------

describe("Live-händelser", () => {
  const P = (uid, correct, extra = {}) => ({ uid, name: uid.toUpperCase(), correct, ...extra });

  it("placering: lika poäng delar plats (1, 2, 2, 4), 0 poäng utan plats", () => {
    assert.deepEqual(rankPlayers([P("a", 5), P("b", 3), P("c", 3), P("d", 1), P("e", 0)]), { a: 1, b: 2, c: 2, d: 4 });
    assert.deepEqual(rankPlayers([{ uid: "a", score: 10, correct: 1 }, { uid: "b", score: 20, correct: 9 }]), { b: 1, a: 2 });
  });

  it("första sync = nuläget utan händelser (omladdning mitt i matchen)", () => {
    const t = createLiveEventTracker({ sessionId: "s", store: memStore() });
    assert.deepEqual(t.sync({ phase: "live", players: [P("a", 4), P("b", 9)], events: [{ id: "k1", type: "kista" }] }), []);
    assert.equal(t.baseline(), true);
  });

  it("ankomst, svar, rätt, fel, flytt och ny ledare kommer ur datan", () => {
    const t = createLiveEventTracker({ sessionId: "s", store: memStore() });
    t.sync({ phase: "lobby", players: [P("a", 0)] });
    assert.deepEqual(t.sync({ phase: "lobby", players: [P("a", 0), P("b", 0)] }), [{ type: "join", uid: "b" }]);
    const ev = t.sync({ phase: "live", players: [P("a", 0, { answerKey: "x1", incorrect: 1 }), P("b", 1, { answerKey: "y1" })] });
    const types = ev.map((e) => `${e.type}:${e.uid || ""}`);
    assert.deepEqual(types, ["answered:a", "wrong:a", "answered:b", "correct:b", "rank:", "leader:b"]);
    // a går om b: flytt + ny ledare
    const ev2 = t.sync({ phase: "live", players: [P("a", 3, { answerKey: "x2" }), P("b", 1, { answerKey: "y1" })] });
    const rank = ev2.find((e) => e.type === "rank");
    assert.deepEqual(rank.order, ["a", "b"]);
    assert.deepEqual(rank.moves.find((m) => m.uid === "b"), { uid: "b", from: 1, to: 2 });
    assert.deepEqual(ev2.find((e) => e.type === "leader"), { type: "leader", uid: "a", prev: "b" });
  });

  it("oavgjort i toppen ger ingen ny ledare; samma ledare tillbaka ger ingen banderoll", () => {
    const t = createLiveEventTracker({ sessionId: "s", store: memStore() });
    t.sync({ phase: "live", players: [P("a", 2), P("b", 1)] });
    assert.ok(!t.sync({ phase: "live", players: [P("a", 2), P("b", 2)] }).some((e) => e.type === "leader"));
    assert.ok(!t.sync({ phase: "live", players: [P("a", 3), P("b", 2)] }).some((e) => e.type === "leader"));
  });

  it("serverhändelser dedupliceras på id och spelas inte efter omladdning", () => {
    const store = memStore();
    const t = createLiveEventTracker({ sessionId: "s", store });
    t.sync({ phase: "live", players: [], events: [{ id: 1, type: "kista" }] });
    const ev = t.sync({ phase: "live", players: [], events: [{ id: 1, type: "kista" }, { id: 2, type: "stold", uid: "a" }] });
    assert.deepEqual(ev, [{ id: 2, type: "server", serverType: "stold", uid: "a" }]);
    assert.deepEqual(t.sync({ phase: "live", players: [], events: [{ id: 2, type: "stold" }] }), []);
    const t2 = createLiveEventTracker({ sessionId: "s", store });
    assert.deepEqual(t2.sync({ phase: "live", players: [], events: [{ id: 1 }, { id: 2 }] }), []);
  });

  it("designtest 10: finalen exakt en gång – även efter omladdning", () => {
    const store = memStore();
    const t = createLiveEventTracker({ sessionId: "s", store });
    t.sync({ phase: "live", players: [P("a", 2)] });
    const ev = t.sync({ phase: "finished", players: [P("a", 2)], outcome: { winner: "a" } });
    assert.deepEqual(ev, [{ type: "final", outcome: { winner: "a" } }]);
    assert.deepEqual(t.sync({ phase: "finished", players: [P("a", 2)] }), []);
    const reloaded = createLiveEventTracker({ sessionId: "s", store });
    assert.deepEqual(reloaded.sync({ phase: "finished", players: [P("a", 2)] }), []);
    assert.equal(reloaded.finalSeen(), true);
    // Annan session i samma fönster påverkas inte.
    const other = createLiveEventTracker({ sessionId: "s2", store });
    assert.equal(other.sync({ phase: "finished", players: [] }).length, 1);
  });

  it("nytt fönster precis efter slutet spelar finalen; långt efter (> 3 min) bara resultatet", () => {
    const fresh = createLiveEventTracker({ sessionId: "s", store: memStore() });
    assert.equal(fresh.sync({ phase: "finished", players: [], finishedAt: 1000, now: 5000 }).length, 1);
    const stale = createLiveEventTracker({ sessionId: "s", store: memStore() });
    assert.deepEqual(stale.sync({ phase: "finished", players: [], finishedAt: 0, now: 4 * 60_000 }), []);
    assert.equal(stale.finalSeen(), true);
  });

  it("efter finalen: inga flyttar/svar spelas (bara nya anslutningar som tyst ankomst)", () => {
    const t = createLiveEventTracker({ sessionId: "s", store: memStore() });
    t.sync({ phase: "live", players: [P("a", 1)] });
    t.sync({ phase: "finished", players: [P("a", 1)] });
    const ev = t.sync({ phase: "finished", players: [P("a", 5, { answerKey: "z" })] });
    assert.deepEqual(ev, []);
  });
});

// --- Animationskön (§9) --------------------------------------------------------

function recorder(ms = 5) {
  const log = [];
  const settled = [];
  const play = (job, signal) => new Promise((resolve) => {
    log.push(job.name || job.kind);
    const t = setTimeout(resolve, job.ms ?? ms);
    signal.addEventListener("abort", () => clearTimeout(t));
  });
  const settle = (job, info) => settled.push([job.name || job.kind, info]);
  return { log, settled, play, settle };
}

describe("Live-animationskön", () => {
  it("prioritet: banderoll före flytt, final avbryter allt och spelas en gång", async () => {
    const r = recorder();
    const q = createLiveQueue({ play: r.play, settle: r.settle });
    q.push({ kind: "rank", name: "flytt" });
    q.push({ kind: "banner", name: "b1" });
    q.push({ kind: "banner", name: "b2" });
    assert.equal(q.priority(), PRIORITY.BANNER);
    await q.whenIdle();
    // Flytten startade först (kön var tom); därefter banderollerna i tur och ordning.
    assert.deepEqual(r.log, ["flytt", "b1", "b2"]);

    const r2 = recorder(50);
    const q2 = createLiveQueue({ play: r2.play, settle: r2.settle });
    q2.push({ kind: "banner", name: "b1" });
    q2.push({ kind: "rank", name: "flytt" });
    q2.push({ kind: "banner", name: "b2" });
    await tick();
    assert.equal(q2.final({ name: "final" }), true);
    assert.equal(q2.final({ name: "final" }), false, "bara en final");
    assert.equal(q2.push({ kind: "banner", name: "sen" }), false, "inga nya jobb efter finalen");
    await q2.whenIdle();
    assert.deepEqual(r2.log, ["b1", "final"]);
    assert.equal(q2.priority(), PRIORITY.FINAL);
    const names = r2.settled.map(([n]) => n);
    assert.ok(names.includes("b2") && names.includes("flytt") && names.includes("b1"), "allt avbrutet settle:as");
  });

  it("banderoller köas en i taget och väntande banderoll köar bakom flytt som pågår", async () => {
    let concurrent = 0;
    let max = 0;
    const q = createLiveQueue({
      play: () => new Promise((res) => { concurrent++; max = Math.max(max, concurrent); setTimeout(() => { concurrent--; res(); }, 3); }),
    });
    for (let i = 0; i < 5; i++) q.push({ kind: i % 2 ? "banner" : "rank" });
    await q.whenIdle();
    assert.equal(max, 1);
  });

  it("designtest 7: storm – 30 kistor samtidigt slås ihop, vyn ligger aldrig efter", async () => {
    const r = recorder(5);
    const q = createLiveQueue({ play: r.play, settle: r.settle });
    for (let i = 0; i < 30; i++) q.push({ kind: "banner", mergeKey: "kista", name: "kista" });
    for (let i = 0; i < 30; i++) q.push({ kind: "banner", name: `unik${i}` });
    assert.ok(q.pending() <= 3, `väntande ${q.pending()}`);
    await q.whenIdle();
    assert.ok(r.log.length <= 5, `spelade ${r.log.length}`);
    const s = q.stats();
    // Den första kistan startar direkt; de 29 andra blir EN väntande (28 ihopslagna).
    assert.equal(s.merged, 28);
    assert.equal(s.played + s.skipped, 32);
  });

  it("för gamla banderoller hoppas över när de står på tur", async () => {
    let t = 0;
    const r = recorder();
    const q = createLiveQueue({ play: (job, sig) => { t += 10_000; return r.play(job, sig); }, settle: r.settle, now: () => t });
    q.push({ kind: "banner", name: "a" });
    q.push({ kind: "banner", name: "b" });
    await q.whenIdle();
    assert.deepEqual(r.log, ["a"]);
    assert.deepEqual(r.settled.find(([n]) => n === "b")[1], { aborted: false, skipped: true });
  });

  it("flyttar slås ihop: bara den senaste väntande spelas", async () => {
    const r = recorder();
    const q = createLiveQueue({ play: r.play, settle: r.settle });
    q.push({ kind: "banner", name: "b" });
    q.push({ kind: "rank", name: "f1" });
    q.push({ kind: "rank", name: "f2" });
    q.push({ kind: "rank", name: "f3" });
    await q.whenIdle();
    assert.deepEqual(r.log, ["b", "f3"]);
  });

  it("reaktioner väntar aldrig på huvudspåret; samma avatar ersätts; tak för samtidiga", async () => {
    const r = recorder(30);
    const q = createLiveQueue({ play: r.play, settle: r.settle, maxReactions: 3 });
    q.push({ kind: "banner", name: "lång", ms: 200 });
    q.push({ kind: "reaction", uid: "a", name: "ra1" });
    await tick();
    assert.ok(r.log.includes("ra1"), "reaktionen startar direkt trots banderoll");
    q.push({ kind: "reaction", uid: "a", name: "ra2" });
    await tick();
    assert.deepEqual(r.settled.find(([n]) => n === "ra1")[1], { aborted: true, skipped: false });
    q.push({ kind: "reaction", uid: "b", name: "rb" });
    q.push({ kind: "reaction", uid: "c", name: "rc" });
    assert.equal(q.push({ kind: "reaction", uid: "d", name: "rd" }), false, "över taket");
    assert.equal(q.reactions(), 3);
    q.destroy();
  });

  it("ett jobb som kraschar eller hänger stoppar inte kön", async () => {
    const log = [];
    const q = createLiveQueue({
      play: (job) => { log.push(job.name); if (job.name === "krasch") throw new Error("x"); if (job.name === "häng") return new Promise(() => {}); },
      guardMs: 20,
    });
    q.push({ kind: "banner", name: "krasch" });
    q.push({ kind: "banner", name: "häng" });
    q.push({ kind: "banner", name: "ok" });
    await q.whenIdle();
    assert.deepEqual(log, ["krasch", "häng", "ok"]);
  });

  it("rush: tempot ökar med kön", () => {
    assert.equal(rushFor(0).speed, 1);
    assert.ok(rushFor(4).speed > rushFor(1).speed);
    assert.equal(rushFor(3).short, true);
  });
});

// --- Ljudkön (§8) ----------------------------------------------------------------

describe("Live-ljudkön", () => {
  it("samma ljud inom sitt gap slås ihop; 30 samtidiga pling → ett", () => {
    let t = 0;
    const g = createSoundGate({ now: () => t });
    let n = 0;
    for (let i = 0; i < 30; i++) if (g.allow("pling", CUES.pling)) n++;
    assert.equal(n, 1);
    t += 500;
    assert.equal(g.allow("pling", CUES.pling), true);
    assert.equal(g.stats().merged, 29);
  });

  it("starkare ljud tystar svagare; högst två samtidigt", () => {
    let t = 0;
    const g = createSoundGate({ now: () => t });
    assert.equal(g.allow("fanfar", CUES.fanfar), true);
    assert.equal(g.allow("pling", CUES.pling), false, "pling under fanfaren hoppas över");
    t += 1400;
    assert.equal(g.allow("klirr", CUES.klirr), true);
    assert.equal(g.allow("tassar", CUES.tassar), true);
    assert.equal(g.allow("bock", CUES.bock), false, "fullt – svagare får inte plats");
    assert.equal(g.allow("ding", CUES.ding), true, "starkare får plats");
  });

  it("alla ljud har prio, längd och en spelfunktion", () => {
    for (const [name, c] of Object.entries(CUES)) {
      assert.ok(c.prio >= 1 && c.prio <= 5, name);
      assert.ok(c.dur > 0, name);
      assert.equal(typeof c.play, "function", name);
    }
  });
});

