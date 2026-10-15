// ============================================================================
// Tester: klass-lås / fokusläge (issue #436) – ren logik i src/class-lock.js.
// ----------------------------------------------------------------------------
//   • saknat/trasigt/utgånget lås = inget lås (bakåtkompatibelt)
//   • grundlåset: målet nås, övriga inlärnings-rutter (andra områden, Läsresan
//     resp. Plugga) spärras, resten (hus/shop/värld) är öppet
//   • "Dölj allt annat": BARA målet (+ avatarvalet) nås
//   • elev i flera klasser → första klassen med aktivt lås (klasslistans ordning)
//   • klockslag → sluttid (framåt, högst 24 h)
//   • #734: mål-typerna + inlärnings-rutterna härleds ur modulregistret
//     (STUDENT_MODULES) – Ekvationsresan, Hitta rätt!, Mattematchen är mål, och
//     firestore.rules validLockShape speglar exakt samma typer
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDENT_MODULES } from "../src/gamemode-visibility.js";
import {
  LOCK_TARGET_TYPES,
  lockTargetModule,
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

test("mål-typerna härleds ur modulregistret: område + de låsbara modulerna", () => {
  assert.deepEqual(LOCK_TARGET_TYPES, ["omrade", "lasresan", "mattematchen", "hittaratt", "ekvationsresan"]);
  assert.equal(lockTargetModule("omrade").id, "plugga");
  assert.equal(lockTargetModule("ekvationsresan").label, "Ekvationsresan");
  assert.equal(lockTargetModule("shop"), null, "shoppen är ingen inlärningsmodul");
  assert.equal(lockTargetModule("plugga"), null, "Plugga låses per område (typen omrade)");
});

test("firestore.rules validLockShape speglar exakt registrets mål-typer", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const m = /l\.mal\.typ in \[([^\]]*)\]/.exec(rules);
  assert.ok(m, "hittar mal.typ-enumen i validLockShape");
  const iRegler = m[1].split(",").map((t) => t.trim().replace(/^'|'$/g, ""));
  assert.deepEqual(iRegler, LOCK_TARGET_TYPES,
    "ny låsbar modul i STUDENT_MODULES ⇒ lägg typen i validLockShape (+ rules-deploy)");
});

test("varje låsbar modul är en inlärningsmodul med egen route", () => {
  for (const m of STUDENT_MODULES.filter((x) => x.lockable)) {
    assert.ok(m.learning, m.id);
    assert.ok(m.routes.length > 0 && m.routes.every((r) => r.startsWith("/elev/")), m.id);
  }
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

// --- #734: nya låsmål -----------------------------------------------------------

const modulLas = (typ, over = {}) => normalizeLock({ mal: { typ }, till: NU + 30 * 60_000, doljOvrigt: false, ...over });
const INLARNING = {
  plugga: ["/elev/plugga", q("")],
  omrade: ["/elev/omrade", q("subj=so&area=vikingatiden")],
  spela: ["/elev/spela", q("subj=so&area=vikingatiden&mode=quiz")],
  aventyr: ["/elev/aventyr", q("subj=so&area=vikingatiden&tema=gruvan")],
  lasresan: ["/elev/lasresan", q("")],
  mattematchen: ["/elev/mattematchen", q("")],
  hittaratt: ["/elev/hitta-ratt", q("")],
  ekvationsresan: ["/elev/ekvationsresan", q("")],
};
const MODUL_RUTT = {
  lasresan: "/elev/lasresan",
  mattematchen: "/elev/mattematchen",
  hittaratt: "/elev/hitta-ratt",
  ekvationsresan: "/elev/ekvationsresan",
};

test("varje modul-mål: målet nås, ALLA andra inlärningsmoduler spärras, resten öppet", () => {
  for (const [typ, rutt] of Object.entries(MODUL_RUTT)) {
    const l = modulLas(typ);
    assert.ok(l, typ);
    assert.ok(lockIsTarget(l, rutt, q("")), `${typ}: målet`);
    assert.ok(lockAllowsRoute(l, rutt, q("vy=x")), `${typ}: målet med query`);
    assert.equal(lockHomeHash(l), `#${rutt}`);
    for (const [namn, [p, query]] of Object.entries(INLARNING)) {
      if (p === rutt) continue;
      assert.ok(!lockAllowsRoute(l, p, query), `${typ}-lås spärrar ${namn}`);
    }
    for (const p of ["/elev/hus", "/elev/shop", "/elev/profil", "/elev/by", "/elev/live"]) {
      assert.ok(lockAllowsRoute(l, p, q("")), `${typ}: ${p} öppet utan Dölj allt annat`);
      assert.ok(!lockAllowsRoute(modulLas(typ, { doljOvrigt: true }), p, q("")), `${typ}: ${p} dolt`);
    }
    assert.ok(lockAllowsRoute(modulLas(typ, { doljOvrigt: true }), "/elev/avatar", q("")));
    assert.ok(!lockAllowsArea(l, "so", "vikingatiden"));
  }
});

test("etiketter: modulens namn (namn-fältet ignoreras för moduler)", () => {
  assert.equal(lockLabel(modulLas("ekvationsresan")), "Ekvationsresan");
  assert.equal(lockLabel(modulLas("hittaratt")), "Hitta rätt!");
  assert.equal(lockLabel(modulLas("mattematchen")), "Mattematchen");
  assert.equal(lockLabel(modulLas("lasresan", { mal: { typ: "lasresan", namn: "X" } })), "Läsresan");
});

test("områdeslås spärrar de nya modulerna; modul-id utanför registret är inget lås", () => {
  const l = normalizeLock(omrade());
  for (const p of ["/elev/ekvationsresan", "/elev/hitta-ratt", "/elev/mattematchen"]) {
    assert.ok(!lockAllowsRoute(l, p, q("")), p);
  }
  assert.equal(modulLas("shop"), null);
  assert.equal(modulLas("live"), null);
  assert.equal(modulLas("brakresan"), null, "inte registrerad än → inget lås (fail-open)");
  assert.deepEqual(buildLock({ typ: "hittaratt", id: "x/y", till: NU + 1 }), {
    mal: { typ: "hittaratt" }, till: NU + 1, doljOvrigt: false,
  }, "id sparas bara för områden");
});
