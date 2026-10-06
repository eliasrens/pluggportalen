// ============================================================================
// Tester: klass-lås / fokusläge (issue #436) – ren logik i src/class-lock.js.
// ----------------------------------------------------------------------------
//   • saknat/trasigt/utgånget lås = inget lås (bakåtkompatibelt)
//   • grundlåset: målet nås, övriga inlärnings-rutter (andra områden, Läsresan
//     resp. Plugga) spärras, resten (hus/shop/värld) är öppet
//   • "Dölj allt annat": BARA målet (+ avatarvalet) nås
//   • elev i flera klasser → första klassen med aktivt lås (klasslistans ordning)
//   • klockslag → sluttid (framåt, högst 24 h)
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCK_TARGET_TYPES,
  normalizeLock,
  activeLock,
  lockForStudent,
  lockAllowsRoute,
  lockIsTarget,
  lockAllowsArea,
  lockHomeHash,
  lockLabel,
  tillFromKlockslag,
  formatKvar,
  buildLock,
  parseAreaKey,
} from "../src/class-lock.js";

const NU = Date.UTC(2026, 9, 6, 8, 0, 0);
const q = (s) => new URLSearchParams(s);
const omrade = (over = {}) => ({
  mal: { typ: "omrade", id: "so/vikingatiden", namn: "Vikingatiden" },
  till: NU + 30 * 60_000,
  doljOvrigt: false,
  ...over,
});
const lasresan = (over = {}) => ({ mal: { typ: "lasresan" }, till: NU + 30 * 60_000, doljOvrigt: false, ...over });

test("mål-typerna är en utbyggbar enum med område + Läsresan", () => {
  assert.deepEqual(LOCK_TARGET_TYPES, ["omrade", "lasresan"]);
});

test("saknat, trasigt eller utgånget lås = inget lås", () => {
  assert.equal(activeLock({}, NU), null);
  assert.equal(activeLock({ lock: null }, NU), null);
  assert.equal(activeLock({ lock: { mal: { typ: "shop" }, till: NU + 1 } }, NU), null);
  assert.equal(activeLock({ lock: { mal: { typ: "omrade" }, till: NU + 1 } }, NU), null);
  assert.equal(activeLock({ lock: omrade({ till: NU }) }, NU), null, "till <= now = slut");
  assert.equal(activeLock({ lock: omrade({ till: "x" }) }, NU), null);
  assert.ok(activeLock({ lock: omrade() }, NU));
});

test("normalizeLock rensar bort okända fält och tvingar doljOvrigt till bool", () => {
  const l = normalizeLock({ ...lasresan({ doljOvrigt: "ja" }), hack: 1 });
  assert.deepEqual(l, { mal: { typ: "lasresan" }, till: NU + 30 * 60_000, doljOvrigt: false });
  assert.deepEqual(parseAreaKey("matte/brak/del"), { subjectId: "matte", areaId: "brak/del" });
  assert.equal(parseAreaKey("utanstreck"), null);
});

test("grundlås på ett område: målet öppet, andra områden + Läsresan stängda, resten öppet", () => {
  const l = normalizeLock(omrade());
  assert.ok(lockAllowsRoute(l, "/elev/omrade", q("subj=so&area=vikingatiden")));
  assert.ok(lockAllowsRoute(l, "/elev/spela", q("subj=so&area=vikingatiden&mode=quiz")));
  assert.ok(lockAllowsRoute(l, "/elev/aventyr", q("subj=so&area=vikingatiden&tema=gruvan")));
  assert.ok(lockAllowsRoute(l, "/elev/plugga", q("")), "listan visar bara målet");
  assert.ok(!lockAllowsRoute(l, "/elev/omrade", q("subj=so&area=stenaldern")));
  assert.ok(!lockAllowsRoute(l, "/elev/spela", q("subj=matte&area=vikingatiden&mode=quiz")));
  assert.ok(!lockAllowsRoute(l, "/elev/lasresan", q("")));
  for (const p of ["/elev/hus", "/elev/rum", "/elev/gard", "/elev/shop", "/elev/profil", "/elev/by"]) {
    assert.ok(lockAllowsRoute(l, p, q("")), p);
  }
  assert.ok(lockAllowsArea(l, "so", "vikingatiden"));
  assert.ok(!lockAllowsArea(l, "so", "stenaldern"));
  assert.equal(lockHomeHash(l), "#/elev/omrade?subj=so&area=vikingatiden");
  assert.equal(lockLabel(l), "Vikingatiden");
});

test("grundlås på Läsresan: Plugga (alla områden) stängt, Läsresan + resten öppet", () => {
  const l = normalizeLock(lasresan());
  assert.ok(lockAllowsRoute(l, "/elev/lasresan", q("vy=min")));
  assert.ok(!lockAllowsRoute(l, "/elev/plugga", q("")));
  assert.ok(!lockAllowsRoute(l, "/elev/omrade", q("subj=so&area=vikingatiden")));
  assert.ok(lockAllowsRoute(l, "/elev/hus", q("")));
  assert.ok(lockAllowsRoute(l, "/elev/shop", q("")));
  assert.ok(!lockAllowsArea(l, "so", "vikingatiden"));
  assert.equal(lockHomeHash(l), "#/elev/lasresan");
  assert.equal(lockLabel(l), "Läsresan");
});

test("Dölj allt annat: bara målet (+ avatarvalet) nås", () => {
  const l = normalizeLock(omrade({ doljOvrigt: true }));
  assert.ok(lockAllowsRoute(l, "/elev/omrade", q("subj=so&area=vikingatiden")));
  assert.ok(lockAllowsRoute(l, "/elev/avatar", q("")));
  for (const p of ["/elev/hus", "/elev/rum", "/elev/gard", "/elev/laggard", "/elev/shop",
    "/elev/profil", "/elev/by", "/elev/klasskamrat", "/elev/lasresan"]) {
    assert.ok(!lockAllowsRoute(l, p, q("")), p);
  }
  const lr = normalizeLock(lasresan({ doljOvrigt: true }));
  assert.ok(lockAllowsRoute(lr, "/elev/lasresan", q("")));
  assert.ok(!lockAllowsRoute(lr, "/elev/hus", q("")));
  assert.ok(lockIsTarget(lr, "/elev/lasresan", q("")));
  assert.ok(!lockIsTarget(lr, "/elev/plugga", q("")));
});

test("elev i flera klasser: första klassen (i ordning) med aktivt lås gäller", () => {
  const classes = [
    { id: "4a", studentIds: ["alva"], lock: omrade({ till: NU - 1 }) }, // utgånget
    { id: "spec", studentIds: ["alva", "pia"], lock: lasresan() },
    { id: "5a", studentIds: ["alva"], lock: omrade() },
    { id: "6a", studentIds: ["kim"], lock: omrade() },
  ];
  assert.equal(lockForStudent(classes, "alva", NU).classId, "spec");
  assert.equal(lockForStudent(classes, "kim", NU).classId, "6a");
  assert.equal(lockForStudent(classes, "bo", NU), null);
  assert.equal(lockForStudent(classes, null, NU), null);
  assert.equal(lockForStudent(classes, "alva", NU + 31 * 60_000), null, "tiden ute → återgång");
});

test("klockslag → sluttid: idag, framåt, högst 24 h", () => {
  const nu = new Date(2026, 9, 6, 9, 30).getTime(); // lokal tid
  assert.equal(tillFromKlockslag("10:45", nu), new Date(2026, 9, 6, 10, 45).getTime());
  assert.equal(tillFromKlockslag("09:00", nu), null, "redan passerat");
  assert.equal(tillFromKlockslag("9:30", nu), null, "exakt nu räknas inte");
  assert.equal(tillFromKlockslag("25:00", nu), null);
  assert.equal(tillFromKlockslag("", nu), null);
  assert.equal(formatKvar(45_000), "45 s");
  assert.equal(formatKvar(12 * 60_000), "12 min");
  assert.equal(formatKvar(65 * 60_000), "1 h 05 min");
});

test("buildLock: område kräver id, Läsresan inget", () => {
  assert.equal(buildLock({ typ: "omrade", till: NU + 1 }), null);
  assert.deepEqual(buildLock({ typ: "lasresan", till: NU + 1, doljOvrigt: 1 }), {
    mal: { typ: "lasresan" }, till: NU + 1, doljOvrigt: true,
  });
});
