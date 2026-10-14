// ============================================================================
// Kistspelsmotorn (#651, epic Datakuppen): src/live/kistspel/ ska gå att
// använda med ett ANNAT tema än Guldrushen (valuta, kisttabell, texter) utan
// att logiken kopieras. Guldrushens beteende testas i test/live-guldrush*.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createKistRegler } from "../src/live/kistspel/delat/ks-regler.js";
import { createProjScen, tal } from "../src/live/kistspel/ks-proj-scen.js";
import { createKistElev } from "../src/live/kistspel/ks-elev.js";
import { buildResult, durationError } from "../src/live/kistspel/ks-core.js";

const FILES = Object.freeze([
  { id: "fil", weight: 30, effect: { kind: "gold", amount: 10 }, eventText: "📄 {namn} laddade ner {belopp} MB", feedText: "> {namn} +{belopp} MB" },
  { id: "mapp", weight: 10, effect: { kind: "gold", amount: 25 }, eventText: "📁 {namn} +{belopp} MB" },
  { id: "hack", weight: 40, effect: { kind: "steal", share: 0.5 }, fallback: "fil", eventText: "💻 {namn} hackade {offer}: +{belopp} MB" },
  { id: "virus", weight: 20, effect: { kind: "lose", share: 0.5 }, eventText: "🐛 {namn} fick ett virus: −{belopp} MB" },
  { id: "brandvagg", weight: 0, effect: { kind: "shield" }, eventText: "🧱 {namn} aktiverade brandvägg" },
  { id: "server", weight: 0, effect: { kind: "gold", amount: 100 }, eventText: "🖥️ {namn} +{belopp} MB" },
]);
const RULES = { shieldMs: 60_000, protectionMs: 30_000, maxGold: 500, victimPickMs: 10_000 };
const R = createKistRegler({
  chests: FILES, rules: RULES,
  eventTexts: { lead: "⭐ {namn} leder nätverket!", leadFeed: "> {namn} leder", victimSteal: "💻 {namn} knäckte din kod och tog {belopp} MB!" },
  anon: { namn: "Någon", offer: "en klasskompis" },
  messages: { skyddad: "🧱 {namn} har brandvägg!" },
});

describe("kistspel: regler med ett annat tema (Datakuppen-likt)", () => {
  it("Hackning av → Hack-filens vikt går till datafilerna (gold) i proportion", () => {
    const t = R.chestTable(false);
    assert.deepEqual(t.map((r) => [r.chest.id, r.weight]), [["fil", 60], ["mapp", 20], ["virus", 20], ["brandvagg", 0], ["server", 0]]);
    assert.equal(R.rollChest(true, () => 0.5).id, "hack");
    assert.notEqual(R.rollChest(false, () => 0.5).id, "hack");
  });
  it("tryggheten gäller oavsett tabell: stöld ≤ 15 %, tapp ≤ 10 %, taket", () => {
    assert.deepEqual(R.resolveVictim("steal", { gold: 0 }, { gold: 100 }), { amount: 15, thiefGold: 15, victimGold: 85 });
    assert.equal(R.applySelfEffect(R.chestById("virus"), 100).delta, -10);
    assert.equal(R.applySelfEffect(R.chestById("server"), 450).gold, 500);
    assert.equal(R.applySelfEffect(R.chestById("brandvagg"), 1).protect, true);
  });
  it("skyddet och offerreglerna", () => {
    const T = 1e6;
    const v = { uid: "o", name: "Omar Ali", gold: 90, protectedUntil: T + 5000 };
    assert.equal(R.victimProblem("steal", { uid: "a" }, v, T), "skyddad");
    assert.equal(R.victimMessage("skyddad", v), "🧱 Omar har brandvägg!");
    assert.equal(R.victimProblem("steal", { uid: "a" }, v, T + 5000), null);
    assert.equal(R.victimProblem("steal", { uid: "a", lastVictimUid: "o" }, { ...v, protectedUntil: null }, T), "samma-igen");
    assert.equal(R.hitProtectionUntil({ protectedUntil: null }, T), T + 30_000);
    assert.equal(R.shieldUntil(T), T + 60_000);
  });
  it("händelsetexterna ur temat, namn av → temats anon", () => {
    const ev = { type: "steal", chest: "hack", name: "Alma", victimName: "Omar", amount: 45 };
    assert.equal(R.eventText(ev), "💻 Alma hackade Omar: +45 MB");
    assert.equal(R.eventText(ev, { names: false }), "💻 Någon hackade en klasskompis: +45 MB");
    assert.equal(R.eventText({ type: "chest", chest: "fil", name: "Ines", amount: 10 }, { short: true }), "> Ines +10 MB");
    assert.equal(R.eventText({ type: "lead", name: "Leo" }, { short: true }), "> Leo leder");
  });
});

describe("kistspel: projektor och elev med eget tema", () => {
  const scen = createProjScen({
    regler: R, milestones: [100, 1000], title: "🏆 Datakuppen – Prispall", unit: "MB",
    feed: {
      lead: { cue: "beep", banner: (who) => ({ icon: "⭐", title: `${who} leder`, sub: "" }) },
      swap: { cue: "x", banner: () => null },
      steal: { cue: "access" },
      bigChests: { server: { cue: "fanfar", tone: "neon", banner: (who) => ({ icon: "🖥️", title: "SERVERHALL!", sub: who }) } },
      small: ["fil"],
    },
  });
  it("totalrad, rubrik och delmål ur temat", () => {
    assert.equal(scen.FINAL_TITLE, "🏆 Datakuppen – Prispall");
    assert.equal(scen.togetherHtml(12400), `Tillsammans: <strong>${tal(12400)} MB</strong>`);
    assert.deepEqual(scen.milestone(550), { prev: 100, next: 1000, frac: 0.5 });
    assert.equal(scen.crossedMilestone(90, 120), 100);
  });
  it("flödet: temats stora fil → banderoll, småfiler gallras först", () => {
    const big = scen.feedItem({ id: "1", type: "chest", chest: "server", uid: "a", name: "Alma", amount: 100 });
    assert.deepEqual([big.big, big.tone, big.cue, big.banner.title], [true, "neon", "fanfar", "SERVERHALL!"]);
    const hack = scen.feedItem({ id: "2", type: "steal", chest: "hack", uid: "a", name: "Alma", victimUid: "o", amount: 9 });
    assert.equal(hack.cue, "access");
    const small = scen.feedItem({ id: "3", type: "chest", chest: "fil", uid: "b", name: "Bo", amount: 10 });
    assert.deepEqual(scen.trimPending([small, hack, big], 2).map((x) => x.id), ["2", "1"]);
  });
  it("elevens texter och nyckel ur temat", () => {
    const E = createKistElev({
      regler: R, rules: RULES, eventTexts: { victimSteal: "💻 {namn} knäckte din kod och tog {belopp} MB!" }, keyPrefix: "pp:dk:fil",
      texts: {
        lead: "Du leder! 💾", leadTie: (n) => `Lika med ${n}`, tie: (n) => `Lika med ${n}`, behind: (d, n) => `${d} MB bakom ${n}`,
        why: {}, gain: (x) => `+${x} MB`, lose: (x) => `−${x} MB`, loseEmpty: "Inget att förlora", empty: "Tom mapp",
        shield: (s) => `Brandvägg ${s} s`, steal: "Hacka!", swap: "", fallback: (x) => `+${x} MB`, swapped: () => "", stole: (x, who) => `+${x} MB från ${who}`,
      },
    });
    assert.equal(E.standingText({ kind: "bakom", diff: 30, name: "Alma" }), "30 MB bakom Alma");
    assert.equal(E.chestView({ chest: "brandvagg" }).caption, "Brandvägg 60 s");
    assert.equal(E.chestKey("s1", "u1"), "pp:dk:fil:s1:u1");
    const w = E.createHitWatcher();
    w.take({});
    assert.equal(w.take({ lastHit: { kind: "steal", byName: "Omar", amount: 45, at: 1 } }).text, "💻 Omar knäckte din kod och tog 45 MB!");
  });
  it("resultatet bär formatets id; speltiden 1–60", () => {
    const r = buildResult("datakuppen", { participatingClassIds: ["4b"] }, [], { grPlayers: [{ uid: "a", gold: 5, correct: 1 }] });
    assert.equal(r.format, "datakuppen");
    assert.equal(r.ranking[0].gold, 5);
    assert.equal(durationError(7), null);
    assert.match(durationError(61), /mellan 1 och 60/);
  });
});

it("kistspel/ beror aldrig på ett format (Guldrushen eller annat) – bara tvärtom", () => {
  const dir = new URL("../src/live/kistspel/", import.meta.url);
  const files = [...readdirSync(dir).filter((f) => f.endsWith(".js")), ...readdirSync(new URL("delat/", dir)).map((f) => `delat/${f}`)];
  assert.ok(files.length >= 10);
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), "utf8");
    const imports = (src.match(/^(?:import|export) .* from .*$/gm) || []).join("\n");
    assert.doesNotMatch(imports, /formats\/(guldrush|datakuppen)/, f);
  }
});
