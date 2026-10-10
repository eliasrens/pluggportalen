// ============================================================================
// Enhetstester: Guldrushens Skattkammare (#565/#578, enligt specen) –
// projektorns rena logik (gr-proj-scen.js): topp 10 vid guldhögarna,
// händelseflödets texter/avatarer (namn på/av), banderoller inkl.
// ledningsbyte (designtest 5), gallring (designtest 7), händelsesystemet
// efter omladdning (designtest 10), pallsteg med delad placering (designtest
// 9), test 15 (stöld syns i flödet) och statistikens exakta ställning.
// DOM-delarna provas i preview-guldrush-skattkammare.html.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  matchClock, topPiles, pileSlot, createPileScale, pileLevel, isProtected, GR_TOP,
  milestone, crossedMilestone, GR_MILESTONES, feedItem,
  podiumGroups, togetherText, statSummary, standingRows, createRate, tal,
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

test("topp 10: de rikaste med guld, rikast i mitten fram, delad plats behålls", () => {
  const ps = Array.from({ length: 14 }, (_, i) => ({ uid: `u${i}`, gold: i === 13 ? 0 : 300 - i * 10, rank: i + 1 }));
  const top = topPiles(ps);
  assert.equal(top.length, GR_TOP);
  assert.deepEqual(top.map((p) => p.uid), ps.slice(0, 10).map((p) => p.uid));
  assert.equal(topPiles([{ uid: "a", gold: 0 }]).length, 0, "0 guld = ingen hög");
  assert.deepEqual(pileSlot(0), { row: 0, col: 0 }, "ettan överst till vänster");
  assert.deepEqual(pileSlot(4), { row: 0, col: 4 }, "femman överst till höger");
  assert.deepEqual(pileSlot(5), { row: 1, col: 0 }, "sexan underst till vänster");
  assert.deepEqual(pileSlot(9), { row: 1, col: 4 }, "tian underst till höger");
  const ordning = Array.from({ length: 10 }, (_, i) => pileSlot(i))
    .map((p, i) => [p.row * 5 + p.col, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  assert.deepEqual(ordning, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "läses som en text");
  const cols = new Set(Array.from({ length: 10 }, (_, i) => `${pileSlot(i).row}:${pileSlot(i).col}`));
  assert.equal(cols.size, 10, "tio olika platser");
});

test("guldhögarna: växer/krymper med elevens guld, taket sänks aldrig", () => {
  const sc = createPileScale(200);
  assert.equal(sc.ref(100), 200);
  const r1 = sc.ref(900);
  assert.ok(r1 >= 990);
  assert.equal(sc.ref(100), r1, "taket sänks inte när ledaren blir bestulen");
  assert.equal(pileLevel(0, r1), 0.18);
  assert.ok(pileLevel(500, r1) > pileLevel(400, r1), "mer guld → högre hög");
  assert.ok(pileLevel(400, r1) < pileLevel(500, r1), "stöld → högen krymper");
  assert.equal(pileLevel(r1 * 3, r1), 1);
});

test("§6.5: sköld eller stöldskydd = liten sköld vid namnet", () => {
  assert.equal(isProtected({ shield: true }, T), true);
  assert.equal(isProtected({ protectedUntil: T + 5000 }, T), true);
  assert.equal(isProtected({ protectedUntil: T - 1 }, T), false);
  assert.equal(isProtected({ protectedUntil: { toMillis: () => T + 1 } }, T), true);
  assert.equal(isProtected({}, T), false);
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

test("test 15: stöld syns i flödet – lekfullt, med båda namnen och små avatarer", () => {
  const ev = { id: "e1", type: "steal", chest: "stold", uid: "alma", name: "Alma", victimUid: "omar", victimName: "Omar", amount: 30 };
  const it = feedItem(ev, { names: true });
  assert.equal(it.text, "🦝 Alma knyckte 30 guld från Omar!");
  assert.deepEqual(it.avatars, ["alma", "omar"]);
  assert.equal(it.cue, "stold");
  assert.equal(it.banner, null);
  assert.deepEqual(it.reactions, [{ uid: "alma", reaction: "glad" }, { uid: "omar", reaction: "aj" }]);
  const anon = feedItem(ev, { names: false });
  assert.equal(anon.text, "🦝 Någon knyckte 30 guld från en klasskamrat!");
  assert.deepEqual(anon.avatars, [], "namn av → inga namn och inga avatarer (#578)");
});

test("flödet: specens exempel, inget hån, tomma fickor visas inte", () => {
  const t = (ev, o) => feedItem(ev, o).text;
  assert.equal(t({ type: "chest", chest: "mycket_guld", uid: "c", name: "Clara", amount: 50 }), "💎 Clara hittade 50 guld!");
  assert.equal(t({ type: "swap", chest: "byte", uid: "h", name: "Hussein", victimUid: "i", victimName: "Ines", amount: 40 }), "🔄 Hussein och Ines bytte guld!");
  assert.equal(t({ type: "chest", chest: "skold", uid: "l", name: "Leo" }), "🛡️ Leo skaffade en sköld!");
  assert.equal(t({ type: "lead", uid: "c", name: "Clara" }), "⭐ Clara tog ledningen!");
  const block = feedItem({ type: "shieldBlock", chest: "stold", uid: "omar", name: "Omar", victimUid: "tove", victimName: "Tove" });
  assert.equal(block.text, "🛡️ Toves sköld stoppade Omar!");
  assert.deepEqual(block.reactions, [{ uid: "tove", reaction: "skyddad" }]);
  assert.equal(feedItem({ type: "chest", chest: "hal_i_fickan", name: "Leo", amount: 0 }), null, "tappade 0 guld visas inte");
  assert.equal(feedItem({ type: "chest", chest: "dubbla", name: "Leo", amount: 0 }), null, "dubblade +0 visas inte");
  // Alla kisttyper ger en text utan mallrester och utan hånfulla ord.
  for (const c of GR_CHESTS) {
    for (const names of [true, false]) {
      const it = feedItem({ type: "chest", chest: c.id, uid: "u", name: "Ali", victimUid: "v", victimName: "Bo", amount: 12 }, { names });
      assert.doesNotMatch(it.text, /[{}]|undefined|förlorare|dålig|sämst|haha/i);
      if (!names) assert.doesNotMatch(it.text, /Ali|Bo\b/);
    }
  }
});

test("stora händelser: Skattkammare, Byte och ledningsbyte → banderoll (designtest 5)", () => {
  const sk = feedItem({ type: "chest", chest: "skattkammare", uid: "e", name: "Elias", amount: 100 });
  assert.equal(sk.big, true);
  assert.equal(sk.banner.title, "SKATTKAMMARE!");
  assert.equal(sk.banner.sub, "Elias hittade 100 guld");
  assert.equal(sk.cue, "fanfarKort");
  const by = feedItem({ type: "swap", chest: "byte", uid: "h", name: "Hussein", victimUid: "i", victimName: "Ines", amount: 40 });
  assert.equal(by.big, true);
  assert.equal(by.banner.sub, "Hussein och Ines bytte guld");
  assert.equal(feedItem({ type: "swap", name: "Hussein" }, { names: false }).banner.sub, "Två skattjägare bytte guld");
  const lead = feedItem({ type: "lead", uid: "c", name: "Clara" });
  assert.equal(lead.big, true);
  assert.equal(lead.cue, "swoosh");
  assert.equal(lead.banner.title, "Ny ledare: Clara!");
  assert.deepEqual(lead.reactions, [{ uid: "c", reaction: "jubel" }]);
  assert.equal(feedItem({ type: "lead", uid: "c", name: "Clara" }, { names: false }).banner.title, "Ny ledare!");
});

test("designtest 7: storm – kön gallras (småguld först), stora händelser behålls", () => {
  const small = (i) => ({ id: `s${i}`, type: "chest", chest: "lite_guld", big: false });
  const big = { id: "b", type: "chest", chest: "skattkammare", big: true };
  const steal = { id: "st", type: "steal", big: false };
  assert.equal(weight(feedItem({ type: "lead", uid: "c", name: "C" })), 3, "ledningsbyte gallras inte bort");
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

test("statistiken: exakt ställning för alla elever + klassens siffror", () => {
  const st = computeStandings(sess(), {
    players: [{ uid: "x", name: "Xena", classId: "4b" }],
    grPlayers: [
      { uid: "a", name: "Alma", gold: 120, correct: 6, incorrect: 2, chests: 6, classId: "4b", shield: true },
      { uid: "b", name: "Bo", gold: 30, correct: 2, incorrect: 2, chests: 2, classId: "4b", protectedUntil: T + 10_000 },
      { uid: "c", name: "Cleo", gold: 30, correct: 1, incorrect: 0, chests: 1, classId: "4b" },
    ],
  });
  const sum = statSummary(st);
  assert.deepEqual([sum.joined, sum.active, sum.totalGold, sum.correct, sum.answered, sum.share, sum.chests], [4, 3, 180, 9, 13, 69, 9]);
  const rows = standingRows(st.players, T);
  assert.equal(rows.length, 4, "alla elever, även den som inte svarat");
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.gold, r.correct, r.share, r.shield]), [
    [1, "Alma", 120, 6, 75, true],
    [2, "Bo", 30, 2, 50, true],
    [2, "Cleo", 30, 1, 100, false],
    [4, "Xena", 0, 0, null, false],
  ]);
  const r = createRate();
  r.add(0, 0);
  assert.equal(r.perMin(5_000), null, "för tidigt att mäta → inget påhittat 0");
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
