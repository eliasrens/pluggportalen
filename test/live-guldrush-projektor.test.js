// ============================================================================
// Enhetstester: Guldrushens Skattkammare (#565) – projektorns rena logik
// (gr-proj-scen.js), händelseflödets tempo/gallring (gr-flode weight/trim),
// händelsesystemet efter omladdning (designtest 10: inga gamla händelser,
// finalen EN gång), pallsteg med delad placering (designtest 9), test 15
// (stöld syns i flödet – utan att offret namnges) och formatets projektor-
// koppling. DOM-delarna provas i preview-guldrush-skattkammare.html.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  matchClock, bergLevel, milestone, crossedMilestone, GR_MILESTONES, feedItem,
  podiumGroups, togetherText, statSummary, goldBuckets, createRate, tal,
} from "../src/live/formats/guldrush/gr-proj-scen.js";
import { weight, trimPending } from "../src/live/formats/guldrush/gr-proj-scen.js";
import { computeStandings } from "../src/live/formats/guldrush/guldrush-core.js";
import { createLiveEventTracker } from "../src/live/design/live-events.js";
import { createSoundGate, CUES } from "../src/live/proj-sound.js";
import { GR_CHESTS } from "../src/live/formats/guldrush/delat/chests-config.js";
import { requireFormat } from "../src/live/formats/index.js";

const T = 1_800_000_000_000;
const sess = (over = {}) => ({
  id: "g1", format: "guldrush", status: "live", startedAt: T, countdownSeconds: 4, durationSeconds: 600,
  participatingClassIds: ["4b"], classNames: { "4b": "4B" }, showNames: true, ...over,
});
const memStore = () => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => m.set(k, v) }; };

test("klockan: serverns matchtid, spänning sista 10 s, 00:00 = ended", () => {
  const s = sess();
  const t0 = T + 4000;
  assert.equal(matchClock(s, t0 + 1000).text, "09:59");
  assert.equal(matchClock(s, t0 + 589_500).tension, false);
  const c = matchClock(s, t0 + 591_000);
  assert.equal(c.secs, 9);
  assert.equal(c.tension, true);
  assert.equal(matchClock(s, t0 + 600_000).phase, "ended");
  assert.equal(matchClock(s, t0 + 600_000).tension, false);
});

test("guldberget: samma skala hela matchen – växer för varje mynt, krymper bara när guld försvinner", () => {
  assert.equal(bergLevel(0), 0.18);
  let prev = 0;
  for (const g of [10, 100, 500, 1000, 2000, 5000, 10000, 30000]) {
    const l = bergLevel(g);
    assert.ok(l > prev, `${g} guld ska ge högre berg`);
    prev = l;
  }
  assert.equal(bergLevel(30000), 1);
  assert.equal(bergLevel(1e7), 1);
  assert.ok(bergLevel(1000) > 0.5 && bergLevel(1000) < 0.6, "en vanlig match hamnar mitt på skalan");
});

test("delmål: nästa skatt + passerade delmål bara uppåt", () => {
  assert.deepEqual(milestone(0), { prev: 0, next: 250, frac: 0 });
  const m = milestone(1500);
  assert.equal(m.prev, 1000);
  assert.equal(m.next, 2000);
  assert.equal(m.frac, 0.5);
  assert.equal(crossedMilestone(900, 1010), 1000);
  assert.equal(crossedMilestone(400, 2100), 2000, "flera på en gång → det högsta");
  assert.equal(crossedMilestone(2100, 1900), null);
  assert.equal(crossedMilestone(1000, 1200), null);
  assert.equal(milestone(GR_MILESTONES.at(-1) + 1).next, null);
});

test("test 15: stöld syns i flödet – tjuven namnges, offret aldrig (ingen uthängning)", () => {
  const ev = { id: "e1", type: "steal", chest: "stold", uid: "omar", name: "Omar", victimUid: "alma", victimName: "Alma", amount: 15 };
  const it = feedItem(ev, { names: true });
  assert.equal(it.text, "🦝 Omar knyckte 15 guld från en klasskamrat!");
  assert.doesNotMatch(it.text, /Alma/);
  assert.equal(it.avatarUid, "omar");
  assert.equal(it.cue, "stold");
  assert.equal(it.banner, null);
  const anon = feedItem(ev, { names: false });
  assert.equal(anon.text, "🦝 Någon knyckte 15 guld från en klasskamrat!");
  assert.equal(anon.avatarUid, null, "namn av → inga avatarer heller (de känns igen)");
});

test("flödet: otur namnges aldrig, sköld lyfter den skyddade, ledningsbyte visas inte", () => {
  const lose = feedItem({ type: "chest", chest: "hal_i_fickan", uid: "leo", name: "Leo", amount: -7 });
  assert.equal(lose.text, "🕳️ Hoppsan! Någon tappade 7 guld.");
  assert.equal(lose.avatarUid, null);
  const tom = feedItem({ type: "chest", chest: "tom", uid: "leo", name: "Leo", amount: 0 });
  assert.doesNotMatch(tom.text, /Leo/);
  const block = feedItem({ type: "shieldBlock", chest: "stold", uid: "omar", name: "Omar", victimUid: "tove", victimName: "Tove" });
  assert.equal(block.text, "🛡️ Toves sköld stoppade en tjuv!");
  assert.equal(block.avatarUid, "tove");
  assert.equal(feedItem({ type: "shieldBlock", victimName: "Tove" }, { names: false }).text, "🛡️ En sköld stoppade en tjuv!");
  assert.equal(feedItem({ type: "lead", uid: "a", name: "A" }), null);
  assert.equal(feedItem({ type: "chest", chest: "hal_i_fickan", name: "Leo", amount: 0 }), null, "tappade 0 guld visas inte");
  assert.equal(feedItem({ type: "chest", chest: "dubbla", name: "Leo", amount: 0 }), null, "dubblade +0 visas inte");
  const gold = feedItem({ type: "chest", chest: "mycket_guld", uid: "clara", name: "Clara", amount: 50 });
  assert.equal(gold.text, "💎 Clara hittade 50 guld!");
  assert.equal(gold.avatarUid, "clara");
});

test("stora händelser: Skattkammare och Byte → banderoll + kort fanfar", () => {
  const sk = feedItem({ type: "chest", chest: "skattkammare", uid: "e", name: "Elias", amount: 100 });
  assert.equal(sk.big, true);
  assert.equal(sk.banner.title, "SKATTKAMMARE!");
  assert.equal(sk.banner.sub, "Elias hittade 100 guld");
  assert.equal(sk.cue, "fanfarKort");
  const by = feedItem({ type: "swap", chest: "byte", uid: "h", name: "Hussein", victimUid: "i", victimName: "Ines", amount: 40 });
  assert.equal(by.big, true);
  assert.doesNotMatch(by.text + by.banner.sub, /Ines/);
  assert.equal(feedItem({ type: "swap", name: "Hussein" }, { names: false }).banner.sub, "Två skattjägare bytte guld");
  // Alla kisttyper ger en text utan mallrester.
  for (const c of GR_CHESTS) {
    const it = feedItem({ type: "chest", chest: c.id, uid: "u", name: "Ali", victimName: "Bo", amount: 12 });
    assert.doesNotMatch(it.text, /[{}]|undefined/);
  }
});

test("designtest 7: storm – kön gallras (småguld först), stora händelser behålls", () => {
  const small = (i) => ({ id: `s${i}`, type: "chest", chest: "lite_guld", big: false });
  const big = { id: "b", type: "chest", chest: "skattkammare", big: true };
  const steal = { id: "st", type: "steal", big: false };
  assert.equal(weight(big), 3);
  assert.equal(weight(steal), 2);
  assert.equal(weight(small(1)), 0);
  const storm = [small(1), big, small(2), steal, small(3), small(4), { id: "g", type: "chest", chest: "guld", big: false }];
  const kept = trimPending(storm, 3);
  assert.deepEqual(kept.map((x) => x.id), ["b", "st", "g"]);
  assert.equal(trimPending(Array.from({ length: 30 }, (_, i) => small(i)), 3).length, 3);
});

test("designtest 10: omladdning – första sync är baslinjen, gamla händelser spelas aldrig", () => {
  const store = memStore();
  const old = [{ id: "a", type: "chest" }, { id: "b", type: "steal" }];
  const t1 = createLiveEventTracker({ sessionId: "g1", store });
  assert.deepEqual(t1.sync({ phase: "live", players: [], ranks: {}, events: old }), []);
  const got = t1.sync({ phase: "live", players: [], ranks: {}, events: [{ id: "c", type: "swap" }, ...old] });
  assert.deepEqual(got.map((e) => e.id), ["c"]);
  // Omladdning: ny tracker, samma lagring – inget gammalt.
  const t2 = createLiveEventTracker({ sessionId: "g1", store });
  assert.deepEqual(t2.sync({ phase: "live", players: [], ranks: {}, events: [{ id: "c" }, ...old] }), []);
});

test("designtest 10: finalen spelas exakt en gång per fönster, även efter omladdning", () => {
  const store = memStore();
  const a = createLiveEventTracker({ sessionId: "g2", store });
  a.sync({ phase: "live", players: [], ranks: {} });
  const fin = a.sync({ phase: "finished", players: [], ranks: {}, finishedAt: T, now: T + 1000 });
  assert.deepEqual(fin.map((e) => e.type), ["final"]);
  assert.deepEqual(a.sync({ phase: "finished", players: [], ranks: {} }), []);
  const b = createLiveEventTracker({ sessionId: "g2", store });
  assert.deepEqual(b.sync({ phase: "finished", players: [], ranks: {}, finishedAt: T, now: T + 2000 }), []);
});

test("designtest 8/9: pallen ur guldet, delad placering på samma steg, bara guld > 0", () => {
  const s = sess();
  const grPlayers = [
    { uid: "a", name: "Alma", gold: 300 }, { uid: "b", name: "Bo", gold: 200 }, { uid: "c", name: "Cleo", gold: 200 },
    { uid: "d", name: "Dan", gold: 90 }, { uid: "e", name: "Eva", gold: 0 },
  ].map((p) => ({ ...p, classId: "4b" }));
  const st = computeStandings(s, { players: [], grPlayers });
  const g = podiumGroups(st.players);
  assert.deepEqual(g.map((x) => [x.rank, x.players.map((p) => p.uid)]), [[1, ["a"]], [2, ["b", "c"]]]);
  assert.equal(podiumGroups(computeStandings(s, { grPlayers: [{ uid: "z", gold: 0 }] }).players).length, 0);
  assert.equal(togetherText(s, 4380), `Tillsammans samlade 4B ${tal(4380)} guld!`);
  assert.equal(togetherText(sess({ participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" } }), 10), "Tillsammans samlade 4B + 5E 10 guld!");
});

test("statistiken: anonyma klassiffror + fördelning, inga per elev", () => {
  const st = computeStandings(sess(), {
    players: [{ uid: "x", classId: "4b" }],
    grPlayers: [
      { uid: "a", gold: 120, correct: 6, incorrect: 2, chests: 6, classId: "4b" },
      { uid: "b", gold: 30, correct: 2, incorrect: 2, chests: 2, classId: "4b" },
    ],
  });
  const sum = statSummary(st);
  assert.deepEqual([sum.joined, sum.active, sum.totalGold, sum.correct, sum.answered, sum.share, sum.chests], [3, 2, 150, 8, 12, 67, 8]);
  const b = goldBuckets(st.players);
  assert.equal(b.reduce((n, x) => n + x.count, 0), 3);
  assert.equal(b[0].count, 1, "0 guld");
  assert.equal(b.at(-1).to, null);
  const r = createRate();
  r.add(0, 0);
  r.add(30, 30_000);
  assert.equal(r.perMin(30_000), 60);
});

test("designtest 11: ljudkön – en storm av stölder slås ihop, grottljudet tar inte trumvirveln", () => {
  let t = 0;
  const gate = createSoundGate({ now: () => t });
  let played = 0;
  for (let i = 0; i < 30; i++) { if (gate.allow("stold", CUES.stold)) played++; t += 20; }
  assert.ok(played <= 2, `30 stölder på 0,6 s → högst 2 ljud (fick ${played})`);
  t = 10_000;
  assert.equal(gate.allow("grotta", CUES.grotta), true);
  t += 1100; // pallen: trumvirveln 1,1 s efter grottljudet
  assert.equal(gate.allow("trumvirvel", CUES.trumvirvel), true);
  for (const k of ["fanfarKort", "stold", "vosh", "grotta", "guldregn"]) assert.equal(typeof CUES[k].play, "function");
});

test("formatet: Guldrushen har projektorvyer (Skattkammaren + Statistik), egen timer, emitOnPlayers", async () => {
  const f = requireFormat("guldrush");
  assert.equal(f.emitOnPlayers, true);
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../src/live/formats/guldrush/guldrush-projector.js", import.meta.url), "utf8"));
  assert.match(src, /id: "skattkammaren"[^}]*finale: true/);
  assert.match(src, /id: "gr-statistik"[^}]*finale: true/);
  assert.match(src, /export const ownTimer = true/);
});
