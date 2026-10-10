// Guldrushen (#564): elevskärmens rena logik (src/live/formats/guldrush/gr-elev.js)
// + kistornas utseende/ljud ur kistkonfigen (designtest 6: varje typ eget).
import test from "node:test";
import assert from "node:assert/strict";
import {
  goldStanding, standingText, victimRows, pendingLeftMs, chestView, victimView, createHitWatcher,
  endStanding, endText, stageAction, countUp, formatGold, chestKey,
} from "../src/live/formats/guldrush/gr-elev.js";
import { GR_CHESTS, GR_RULES } from "../src/live/formats/guldrush/delat/chests-config.js";
import { LOOKS } from "../src/live/formats/guldrush/gr-kistfx.js";
import { GR_SOUNDS } from "../src/live/formats/guldrush/gr-ljud.js";

const p = (uid, gold, extra = {}) => ({ uid, name: `${uid[0].toUpperCase()}${uid.slice(1)} Svensson`, classId: "4b", gold, ...extra });

test("toppraden: diskret placering enligt spec (\"Du ligger 4:a\"), ettan leder", () => {
  const list = [p("alma", 120), p("omar", 80), p("leo", 60), p("ines", 10)];
  assert.equal(standingText(goldStanding(list, "alma").place), "Du leder! 💰");
  assert.equal(standingText(goldStanding(list, "omar").place), "Du ligger 2:a");
  assert.equal(standingText(goldStanding(list, "leo").place), "Du ligger 3:e");
  assert.equal(standingText(goldStanding(list, "ines").place), "Du ligger 4:e");
  assert.equal(goldStanding(list, "ines").gold, 10);
  // Inga namn eller avstånd till andra – bara den egna placeringen.
  for (const uid of ["alma", "omar", "leo", "ines"]) {
    assert.doesNotMatch(standingText(goldStanding(list, uid).place), /bakom|Alma|Omar|Leo|Ines/);
  }
  // Sen anslutning: inget grPlayers-dokument än → 0 guld, sist.
  const late = goldStanding(list, "ny");
  assert.equal(late.gold, 0);
  assert.equal(standingText(late.place), "Du ligger 5:e");
});

test("toppraden: lika guld = DELAD placering (1, 1, 3 som servern)", () => {
  const tie = [p("alma", 50), p("omar", 50), p("leo", 30), p("ines", 30), p("clara", 5)];
  assert.deepEqual(goldStanding(tie, "omar").place, { rank: 1, shared: true });
  assert.equal(standingText(goldStanding(tie, "alma").place), "Ni delar ledningen! 💰");
  assert.equal(standingText(goldStanding(tie, "leo").place), "Du ligger delad 3:e");
  assert.equal(standingText(goldStanding(tie, "clara").place), "Du ligger 5:e");
  // Ingen har guld än → ingen placering (vyn visar "Svara rätt – öppna en kista!").
  const start = [p("alma", 0), p("omar", 0)];
  assert.equal(goldStanding(start, "alma").place, null);
  assert.equal(standingText(goldStanding(start, "alma").place), "");
  assert.equal(standingText(goldStanding([], "ny").place), "");
  // 11:e/12:e och 21:a/22:a.
  const many = Array.from({ length: 22 }, (_, i) => p(`e${String(i).padStart(2, "0")}`, 100 - i));
  assert.equal(standingText(goldStanding(many, "e10").place), "Du ligger 11:e");
  assert.equal(standingText(goldStanding(many, "e11").place), "Du ligger 12:e");
  assert.equal(standingText(goldStanding(many, "e20").place), "Du ligger 21:a");
  assert.equal(standingText(goldStanding(many, "e21").place), "Du ligger 22:a");
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

test("test 20i/§7.2.4: slutskärmen – alla ser sin placering, pall bara topp 3, delad vid lika", () => {
  const result = { ranking: [
    { uid: "alma", name: "Alma", gold: 300, correct: 50, rank: 1 },
    { uid: "omar", name: "Omar", gold: 200, correct: 42, rank: 2 },
    { uid: "clara", name: "Clara", gold: 200, correct: 40, rank: 2 },
    { uid: "leo", name: "Leo", gold: 150, correct: 30, rank: 4 },
    { uid: "ines", name: "Ines", gold: 90, correct: 20, rank: 5 },
    { uid: "noll", name: "Noll", gold: 0, correct: 0, rank: 6 },
  ] };
  assert.equal(endStanding(result, "alma").podium, 1);
  assert.equal(endText(endStanding(result, "alma").place), "Du kom 1:a!");
  const omar = endStanding(result, "omar");
  assert.equal(omar.podium, 2);
  assert.equal(endText(omar.place), "Du kom delad 2:a!");
  const leo = endStanding(result, "leo");
  assert.equal(leo.podium, null);
  assert.equal(endText(leo.place), "Du kom 4:e!");
  assert.equal(endText(endStanding(result, "ines").place), "Du kom 5:e!");
  const noll = endStanding(result, "noll");
  assert.equal(noll.podium, null);
  assert.equal(endText(noll.place), "Du kom 6:e!");
  const x = endStanding(result, "x");
  assert.equal(x.row, null);
  assert.equal(endText(x.place), "");
  // Ingen fick guld → ingen placering, ingen pall.
  const tom = endStanding({ ranking: [{ uid: "a", gold: 0, correct: 0, rank: 1 }, { uid: "b", gold: 0, correct: 0, rank: 1 }] }, "a");
  assert.equal(tom.podium, null);
  assert.equal(tom.place, null);
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
