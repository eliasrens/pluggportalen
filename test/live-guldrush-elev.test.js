// Guldrushen (#564): elevskärmens rena logik (src/live/formats/guldrush/gr-elev.js)
// + kistornas utseende/ljud ur kistkonfigen (designtest 6: varje typ eget).
import test from "node:test";
import assert from "node:assert/strict";
import {
  goldStanding, standingText, victimRows, pendingLeftMs, chestView, victimView, createHitWatcher,
  endStanding, stageAction, countUp, formatGold, chestKey,
} from "../src/live/formats/guldrush/gr-elev.js";
import { GR_CHESTS, GR_RULES } from "../src/live/formats/guldrush/delat/chests-config.js";
import { LOOKS } from "../src/live/formats/guldrush/gr-kistfx.js";
import { GR_SOUNDS } from "../src/live/formats/guldrush/gr-ljud.js";

const p = (uid, gold, extra = {}) => ({ uid, name: `${uid[0].toUpperCase()}${uid.slice(1)} Svensson`, classId: "4b", gold, ...extra });

test("toppraden: läget mot närmaste framför, aldrig ett placeringsnummer", () => {
  const list = [p("alma", 120), p("omar", 80), p("leo", 60), p("ines", 10)];
  assert.equal(standingText(goldStanding(list, "alma").rel), "Du leder! 💰");
  assert.equal(standingText(goldStanding(list, "leo").rel), "20 guld bakom Omar");
  assert.equal(goldStanding(list, "ines").gold, 10);
  const tie = [p("alma", 50), p("omar", 50), p("leo", 5)];
  assert.equal(standingText(goldStanding(tie, "omar").rel), "Lika med Alma – ni leder! 💰");
  // Sen anslutning: inget grPlayers-dokument än → 0 guld, bakom alla.
  const late = goldStanding(list, "ny");
  assert.equal(late.gold, 0);
  assert.equal(standingText(late.rel), "10 guld bakom Ines");
  for (const uid of ["alma", "omar", "leo", "ines", "ny"]) {
    assert.doesNotMatch(standingText(goldStanding(list, uid).rel), /\d+:[ae]|sist|plats/i);
  }
});

test("offerväljaren: sorterad på guld, aldrig en själv, sköld/stöldskydd gråade", () => {
  const now = 1_000_000;
  const me = p("omar", 40, { lastVictimUid: "leo" });
  const list = [me, p("ines", 5), p("alma", 100, { protectedUntil: now + 5_000 }), p("leo", 70), p("clara", 90, { shield: true }), p("hussein", 30)];
  const rows = victimRows("steal", me, list, now);
  assert.deepEqual(rows.map((r) => r.uid), ["alma", "clara", "leo", "hussein", "ines"]);
  const by = Object.fromEntries(rows.map((r) => [r.uid, r]));
  assert.equal(by.alma.ok, false);
  assert.equal(by.alma.shield, true);
  assert.match(by.alma.why, /🛡️/);
  assert.equal(by.clara.ok, false);
  assert.match(by.clara.why, /🛡️ Sköld/);
  assert.equal(by.leo.ok, false, "samma offer två gånger i rad");
  assert.equal(by.ines.ok, false, "för lite guld att knycka");
  assert.equal(by.hussein.ok, true);
  assert.equal(by.hussein.first, "Hussein");
});

test("test 17: byte visar bara de med MER guld", () => {
  const now = 5;
  const ines = p("ines", 10);
  const list = [ines, p("alma", 100), p("omar", 10), p("leo", 3), p("clara", 40)];
  const rows = victimRows("swap", ines, list, now);
  assert.deepEqual(rows.map((r) => r.uid), ["alma", "clara"]);
  assert.ok(rows.every((r) => r.gold > ines.gold && r.ok));
  // Har ingen mer guld → tom lista (servern gör det till en guldkista).
  assert.deepEqual(victimRows("swap", p("alma", 100), list, now), []);
});

test("30 elever: alla klasskamrater i listan, inga dubbletter", () => {
  const list = Array.from({ length: 30 }, (_, i) => p(`elev${String(i).padStart(2, "0")}`, i * 7));
  const rows = victimRows("steal", list[3], list, 0);
  assert.equal(rows.length, 29);
  assert.equal(new Set(rows.map((r) => r.uid)).size, 29);
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].gold >= r.gold));
});

test("nedräkningen till automatiskt val", () => {
  assert.equal(pendingLeftMs({ expiresAtMs: 10_000 }, 4_000), 6_000);
  assert.equal(pendingLeftMs({ expiresAt: { seconds: 10, nanoseconds: 0 } }, 12_000), 0);
  assert.equal(pendingLeftMs(null, 0), GR_RULES.victimPickMs);
});

test("designtest 6: varje kisttyp har ett EGET utseende och ljud som finns", () => {
  const looks = GR_CHESTS.map((c) => c.look);
  const sounds = GR_CHESTS.map((c) => c.sound);
  assert.equal(new Set(looks).size, GR_CHESTS.length, "unika utseenden");
  assert.equal(new Set(sounds).size, GR_CHESTS.length, "unika ljud");
  for (const c of GR_CHESTS) {
    assert.ok(LOOKS.includes(c.look), `effekt saknas för ${c.look}`);
    assert.equal(typeof GR_SOUNDS[c.sound], "function", `ljud saknas för ${c.sound}`);
  }
});

test("kistans visning ur serverns svar (eleven avgör aldrig innehållet)", () => {
  const v = chestView({ chest: "skattkammare", kind: "gold", delta: 100, gold: 340 });
  assert.equal(v.look, "guldexplosion");
  assert.equal(v.caption, "+100 guld");
  assert.equal(v.mood, "jubel");
  assert.equal(chestView({ chest: "hal_i_fickan", delta: -12, gold: 108 }).caption, "−12 guld");
  assert.equal(chestView({ chest: "hal_i_fickan", delta: 0, gold: 0 }).mood, "aj");
  assert.equal(chestView({ chest: "tom", delta: 0, gold: 5 }).mood, null);
  assert.equal(chestView({ chest: "skold", delta: 0, gold: 5, shield: true }).mood, "skyddad");
  const steal = chestView({ chest: "stold", kind: "steal", delta: 0, gold: 5, pending: { kind: "steal", expiresAtMs: 9 } });
  assert.equal(steal.look, "tvattbjorn");
  assert.deepEqual(steal.pending, { kind: "steal", expiresAtMs: 9 });
  assert.equal(chestView({ chest: "okand" }).icon, "🎁");
});

test("stöldens/bytets utfall", () => {
  const names = { alma: "Alma" };
  assert.equal(victimView({ result: "steal", chest: "stold", victimUid: "alma", amount: 15, delta: 15, gold: 55 }, names).caption, "🦝 +15 guld från Alma!");
  assert.equal(victimView({ result: "swap", chest: "byte", victimUid: "alma", amount: 60, delta: 60, gold: 100 }, names).caption, "🔄 Du bytte guld med Alma!");
  assert.match(victimView({ result: "blocked", chest: "stold", victimUid: "alma", delta: 0, gold: 40 }, names).caption, /Almas sköld/);
  assert.equal(victimView({ result: "blocked", victimUid: "alma" }, names).run, false);
  assert.match(victimView({ result: "fallback", chest: "guld", delta: 25, gold: 65 }).caption, /\+25 guld/);
});

test("test 15/§6.7: notisen till den bestulna – bara nya stölder, aldrig efter omladdning", () => {
  const w = createHitWatcher();
  const hit = { kind: "steal", byUid: "leo", byName: "Leo Ek", amount: 20, at: { seconds: 100, nanoseconds: 0 } };
  assert.equal(w.take({ uid: "alma", lastHit: hit }), null, "första = baslinjen (omladdning)");
  assert.equal(w.take({ uid: "alma", lastHit: hit }), null);
  const n = w.take({ uid: "alma", lastHit: { ...hit, amount: 12, at: { seconds: 130, nanoseconds: 0 } } });
  assert.equal(n.text, "🦝 Leo knyckte 12 guld från dig!");
  assert.equal(n.byUid, "leo");
  assert.equal(n.mood, "aj");
  const swap = w.take({ uid: "alma", lastHit: { kind: "swap", byUid: "ines", byName: "Ines", amount: 40, at: 140_000 } });
  assert.equal(swap.text, "🔄 Ines bytte guld med dig!");
  const block = w.take({ uid: "alma", lastHit: { kind: "blocked", byUid: "omar", byName: "Omar", amount: 0, at: 150_000 } });
  assert.equal(block.text, "🛡️ Din sköld stoppade Omar!");
  assert.equal(block.mood, "skyddad");
  const fresh = createHitWatcher();
  assert.equal(fresh.take(null), null);
  assert.ok(fresh.take({ lastHit: hit }), "första stölden efter en baslinje utan stöld visas");
});

test("test 20i: slutskärmens underlag – topp 3 pallplats, övriga relativt", () => {
  const result = { ranking: [
    { uid: "alma", name: "Alma", gold: 300, correct: 50, rank: 1 },
    { uid: "omar", name: "Omar", gold: 200, correct: 42, rank: 2 },
    { uid: "leo", name: "Leo", gold: 150, correct: 30, rank: 3 },
    { uid: "ines", name: "Ines", gold: 90, correct: 20, rank: 4 },
    { uid: "noll", name: "Noll", gold: 0, correct: 0, rank: 5 },
  ] };
  assert.equal(endStanding(result, "omar").podium, 2);
  const ines = endStanding(result, "ines");
  assert.equal(ines.podium, null);
  assert.equal(standingText(ines.rel), "60 guld bakom Leo");
  assert.equal(endStanding(result, "noll").podium, null);
  assert.equal(endStanding(result, "x").row, null);
});

test("faser, uppräkning, format", () => {
  assert.equal(stageAction("live"), "spel");
  assert.equal(stageAction("lobby"), "lobby");
  for (const ph of ["ended", "finished", "cancelled"]) assert.equal(stageAction(ph), "slut");
  assert.equal(stageAction("countdown"), null);
  assert.equal(countUp(10, 110, 0), 10);
  assert.equal(countUp(10, 110, 1), 110);
  assert.ok(countUp(10, 110, 0.5) > 60, "bromsar in mot slutet");
  assert.equal(countUp(100, 85, 1), 85);
  assert.equal(formatGold(4380), "4 380");
  assert.equal(chestKey("s1", "u1"), "pp:gr:kista:s1:u1");
});
