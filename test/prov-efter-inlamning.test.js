// ============================================================================
// Tester: prov – vad eleven får göra efter inlämning (#788), ren logik i
// src/class-lock.js (efter-valet på provlåset + elevens grind).
// ----------------------------------------------------------------------------
//   • efter-valet: fyra lägen, "egna" har modulerna, bara på ett provlås
//   • grinden (gateFor) för inlämnad / ej inlämnad × de fyra valen
//   • "Bara övning" = registrets `ovning`-moduler; Bråkresans server speglar flaggan
//   • routerns regel (sparrMal i app.js) med klassens dolda moduler
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDENT_MODULES } from "../src/gamemode-visibility.js";
import {
  EFTER, EFTER_LAGEN, EFTER_STANDARD, EFTER_VALBARA, OVNING_MODULER,
  buildLock, efterModuler, gateFor, lockBehoverInlamning, lockEfterInlamning, normalizeEfter, normalizeLock,
} from "../src/class-lock.js";

const NU = Date.UTC(2026, 9, 19, 8, 0, 0);
const q = (s = "") => new URLSearchParams(s);
const provLas = (efter) =>
  normalizeLock({ mal: { typ: "prov", id: "tf-123", namn: "Vikingaprovet" }, till: NU + 50 * 60_000, doljOvrigt: true, efter });

// Routerns regel (app.js sparrMal): null = får öppnas.
const RUTT_MODUL = Object.fromEntries(STUDENT_MODULES.filter((m) => m.toggle !== false).flatMap((m) => m.routes.map((r) => [r, m.id])));
function sparrMal(path, query, gate, dolda = []) {
  const modul = RUTT_MODUL[path] || null;
  const modulOk = !modul || !dolda.includes(modul);
  if (gate) return gate.allows(path, query) && (gate.isTarget(path, query) || modulOk) ? null : gate.home;
  return modulOk ? null : "#/elev/hus";
}
const oppen = (gate, path, query = q(), dolda = []) => sparrMal(path, query, gate, dolda) === null;

const RUTTER = {
  provet: ["/elev/prov/skriv", q("t=tf-123")],
  provlistan: ["/elev/prov", q()],
  plugga: ["/elev/plugga", q()],
  spela: ["/elev/spela", q("subj=so&area=vikingatiden&mode=quiz")],
  lasresan: ["/elev/lasresan", q()],
  ekvationsresan: ["/elev/ekvationsresan", q()],
  brakresan: ["/elev/brakresan", q()],
  hittaratt: ["/elev/hitta-ratt", q()],
  mattematchen: ["/elev/mattematchen", q()],
  schack: ["/elev/schack", q()],
  shop: ["/elev/shop", q()],
  hus: ["/elev/hus", q()],
  gard: ["/elev/gard", q()],
  profil: ["/elev/profil", q()],
  live: ["/elev/live", q()],
};
const oppnaFor = (gate, dolda) => Object.entries(RUTTER).filter(([, [p, qq]]) => oppen(gate, p, qq, dolda)).map(([n]) => n).sort();
const ALLA = Object.keys(RUTTER).sort();

test("lägena och förvalet: klassens vanliga läge", () => {
  assert.deepEqual(EFTER_LAGEN, ["prov", "ovning", "klass", "egna"]);
  assert.equal(EFTER_STANDARD, EFTER.KLASS);
});

test("Bara övning = registrets ovning-moduler (Plugga + resorna + Hitta rätt!)", () => {
  assert.deepEqual(OVNING_MODULER, ["plugga", "lasresan", "hittaratt", "ekvationsresan", "brakresan"]);
  for (const id of ["shop", "mattematchen", "schack", "prov"]) assert.ok(!OVNING_MODULER.includes(id), `${id} är ingen övning`);
  assert.deepEqual(EFTER_VALBARA.map((m) => m.id), STUDENT_MODULES.filter((m) => m.id !== "prov").map((m) => m.id),
    "Välj själv: alla moduler utom provet självt");
});

test("Bråkresans server speglar registrets ovning-flagga (functions/brakresan-core.js)", () => {
  const src = readFileSync(new URL("../functions/brakresan-core.js", import.meta.url), "utf8");
  const m = /export const MODUL_OVNING = (true|false);/.exec(src);
  assert.ok(m, "MODUL_OVNING finns");
  assert.equal(m[1] === "true", OVNING_MODULER.includes("brakresan"));
});

test("normalizeEfter: okänt läge = null, egna har bara kända moduler utan dubbletter", () => {
  assert.equal(normalizeEfter(null), null);
  assert.equal(normalizeEfter({ lage: "allt" }), null);
  assert.deepEqual(normalizeEfter({ lage: "ovning", moduler: ["shop"] }), { lage: "ovning" });
  assert.deepEqual(normalizeEfter({ lage: "egna", moduler: ["plugga", "prov", "hack", "plugga", "shop"] }),
    { lage: "egna", moduler: ["plugga", "shop"] });
  assert.deepEqual(normalizeEfter({ lage: "egna" }), { lage: "egna", moduler: [] });
});

test("efter-valet sparas bara på ett provlås, och 'stanna' = som förr (inget fält)", () => {
  assert.deepEqual(provLas({ lage: "ovning" }).efter, { lage: "ovning" });
  assert.ok(!("efter" in provLas({ lage: "prov" })));
  assert.ok(!("efter" in provLas(undefined)));
  assert.ok(!("efter" in provLas({ lage: "fel" })));
  const lr = normalizeLock({ mal: { typ: "lasresan" }, till: NU + 1, doljOvrigt: false, efter: { lage: "klass" } });
  assert.ok(!("efter" in lr), "bara provlås");
  assert.deepEqual(buildLock({ typ: "prov", id: "tf-123", till: NU + 1, doljOvrigt: true, efter: { lage: "egna", moduler: ["schack"] } }), {
    mal: { typ: "prov", id: "tf-123" }, till: NU + 1, doljOvrigt: true, efter: { lage: "egna", moduler: ["schack"] },
  });
  assert.ok(lockBehoverInlamning(provLas({ lage: "klass" })));
  assert.ok(!lockBehoverInlamning(provLas({ lage: "prov" })));
  assert.ok(!lockBehoverInlamning(null));
});

test("efterModuler per läge", () => {
  assert.deepEqual(efterModuler({ lage: "prov" }), []);
  assert.deepEqual(efterModuler({ lage: "ovning" }), OVNING_MODULER);
  assert.deepEqual(efterModuler({ lage: "egna", moduler: ["shop"] }), ["shop"]);
  assert.deepEqual(efterModuler({ lage: "klass" }), EFTER_VALBARA.map((m) => m.id));
});

// Den som skriver (ej inlämnad) är låst till provet i alla fyra valen.
const LAST = ["provet", "provlistan"];

test("ej inlämnad: låst till provet oavsett val", () => {
  for (const efter of [undefined, { lage: "prov" }, { lage: "ovning" }, { lage: "klass" }, { lage: "egna", moduler: ["plugga", "shop"] }]) {
    const las = provLas(efter);
    const gate = gateFor(lockEfterInlamning(las, false));
    assert.ok(gate && !gate.fri, efter?.lage);
    assert.equal(gate.home, "#/elev/prov/skriv?t=tf-123");
    assert.deepEqual(oppnaFor(gate), LAST, efter?.lage);
  }
});

test("inlämnad + stanna på provsidan: som förr", () => {
  for (const efter of [undefined, { lage: "prov" }]) {
    const gate = gateFor(lockEfterInlamning(provLas(efter), true));
    assert.ok(gate && !gate.fri);
    assert.deepEqual(oppnaFor(gate), LAST);
  }
});

test("inlämnad + bara övning: Plugga och resorna – inte spel, butik, hus, Live, schack, Mattematchen", () => {
  const gate = gateFor(lockEfterInlamning(provLas({ lage: "ovning" }), true));
  assert.equal(gate.fri, "ovning");
  assert.equal(gate.label, "Övning efter provet");
  assert.equal(gate.home, "#/elev/prov/skriv?t=tf-123", "hem = kvittensen med vägen vidare");
  assert.deepEqual(oppnaFor(gate), ["brakresan", "ekvationsresan", "hittaratt", "lasresan", "plugga", "provet", "provlistan", "spela"]);
  assert.ok(gate.allowsArea("so", "vikingatiden"), "alla områden");
  assert.ok(gate.allows("/elev/avatar", q()));
  // Klassens dolda moduler gäller fortfarande (opt-in som inte slagits på likaså).
  assert.deepEqual(oppnaFor(gate, ["brakresan", "hittaratt", "ekvationsresan"]),
    ["lasresan", "plugga", "provet", "provlistan", "spela"]);
});

test("inlämnad + klassens vanliga läge: inget lås alls (gate null)", () => {
  const eff = lockEfterInlamning(provLas({ lage: "klass" }), true);
  assert.equal(eff.fri, "klass");
  assert.equal(gateFor(eff), null);
  assert.deepEqual(oppnaFor(null), ALLA);
  assert.deepEqual(oppnaFor(null, ["shop"]), ALLA.filter((n) => n !== "shop"), "klassens grind som vanligt");
});

test("inlämnad + välj själv: bara de valda modulerna", () => {
  const gate = gateFor(lockEfterInlamning(provLas({ lage: "egna", moduler: ["lasresan", "shop", "schack"] }), true));
  assert.equal(gate.fri, "egna");
  assert.deepEqual(oppnaFor(gate), ["lasresan", "provet", "provlistan", "schack", "shop"]);
  assert.ok(!gate.allowsArea("so", "vikingatiden"), "Plugga inte vald");
  const tom = gateFor(lockEfterInlamning(provLas({ lage: "egna", moduler: [] }), true));
  assert.deepEqual(oppnaFor(tom), LAST, "inget valt = bara provet");
});

test("läraren stänger / låset går ut: inget lås för någon", () => {
  assert.equal(gateFor(lockEfterInlamning(null, true)), null);
  assert.equal(gateFor(lockEfterInlamning(null, false)), null);
});

test("ett annat lås (inte prov) påverkas inte av inlämnat", () => {
  const lr = normalizeLock({ mal: { typ: "lasresan" }, till: NU + 1, doljOvrigt: false });
  assert.equal(lockEfterInlamning(lr, true), lr);
});

test("kvittensens väg vidare (prov-vidare.js) följer valet", async () => {
  const { vidareHtml } = await import("../src/prov/prov-vidare.js");
  const gate = (efter, inl) => gateFor(lockEfterInlamning(provLas(efter), inl));
  assert.match(vidareHtml(null, "tf-123"), /Till startsidan/, "klassens vanliga läge / inget lås");
  assert.match(vidareHtml(gate({ lage: "ovning" }, false), "tf-123"), /Stanna kvar/, "inte inlämnat än");
  assert.match(vidareHtml(gate({ lage: "prov" }, true), "tf-123"), /Stanna kvar/);
  const ovning = vidareHtml(gate({ lage: "ovning" }, true), "tf-123", ["hittaratt"]);
  assert.match(ovning, /Fortsätt öva/);
  for (const r of ["/elev/plugga", "/elev/lasresan", "/elev/ekvationsresan", "/elev/brakresan"]) assert.ok(ovning.includes(`#${r}"`), r);
  assert.ok(!ovning.includes("hitta-ratt"), "dold modul syns inte");
  const egna = vidareHtml(gate({ lage: "egna", moduler: ["shop", "mattematchen"] }, true), "tf-123");
  assert.ok(egna.includes("#/elev/shop") && !egna.includes("mattematchen"), "villkorad modul bara i menyn");
  assert.equal(vidareHtml(gate({ lage: "ovning" }, true), "annat-prov"), "", "låset gäller ett annat prov");
});
