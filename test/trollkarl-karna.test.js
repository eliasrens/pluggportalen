// Trollkarlsduellen (#536): kärnan – trollkarlsval, MagicSystem, matchdata-
// adaptern, registren och regins kö/prioritet. Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultWizards, validWizards, resolveWizards, swapWizards } from "../src/live/trollkarl/trollkarl-val.js";
import {
  magicState, attackSeed, seededRandom, createMagicTracker, ATTACK_THRESHOLD,
} from "../src/live/trollkarl/trollkarl-magi.js";
import { duelData, officialOutcome, FINALE_WAIT_MS } from "../src/live/trollkarl/trollkarl-data.js";
import {
  registerAttack, listAttacks, pickAttack, registerFinale, pickFinale, listFinales,
} from "../src/live/trollkarl/trollkarl-register.js";
import { createDirector, PRIORITY } from "../src/live/trollkarl/trollkarl-regi.js";
import { classStandings, decideWinner, buildSessionDoc, formatClock } from "../src/live/live-core.js";

const memStore = () => {
  const m = new Map();
  return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: (k, v) => m.set(k, JSON.stringify(v)), m };
};

describe("Trollkarlsval (§5)", () => {
  it("default: klass 1 = Rasmus, klass 2 = Elias; bara tvåklassmatcher", () => {
    assert.deepEqual(defaultWizards(["4b", "5e"]), { "4b": "rasmus", "5e": "elias" });
    assert.equal(defaultWizards(["4b", "5e", "3a"]), null);
    assert.equal(defaultWizards(["4b"]), null);
  });
  it("aldrig samma trollkarl på båda, bara deltagande klasser", () => {
    assert.ok(validWizards({ "4b": "elias", "5e": "rasmus" }, ["4b", "5e"]));
    assert.equal(validWizards({ "4b": "elias", "5e": "elias" }, ["4b", "5e"]), false);
    assert.equal(validWizards({ "4b": "elias", "3a": "rasmus" }, ["4b", "5e"]), false);
    assert.equal(validWizards({ "4b": "merlin", "5e": "rasmus" }, ["4b", "5e"]), false);
  });
  it("resolve respekterar sparat val, annars default; byt-knappen byter", () => {
    const s = { participatingClassIds: ["4b", "5e"], wizards: { "4b": "elias", "5e": "rasmus" } };
    assert.deepEqual(resolveWizards(s), { "4b": "elias", "5e": "rasmus" });
    assert.deepEqual(resolveWizards({ ...s, wizards: { "4b": "elias", "5e": "elias" } }), { "4b": "rasmus", "5e": "elias" });
    assert.deepEqual(resolveWizards({ participatingClassIds: ["4b", "5e"] }), { "4b": "rasmus", "5e": "elias" });
    assert.deepEqual(swapWizards({ "4b": "rasmus", "5e": "elias" }), { "4b": "elias", "5e": "rasmus" });
  });
  it("buildSessionDoc sparar valet (eller default) bara för två klasser", () => {
    const input = { name: "x", gameMode: "m", classIds: ["4b", "5e"], classNames: {}, durationMin: 5, divisors: { "4b": 1, "5e": 1 } };
    assert.deepEqual(buildSessionDoc(input, { uid: "u" }).wizards, { "4b": "rasmus", "5e": "elias" });
    assert.deepEqual(buildSessionDoc({ ...input, wizards: { "4b": "elias", "5e": "rasmus" } }, { uid: "u" }).wizards,
      { "4b": "elias", "5e": "rasmus" });
    const tre = { ...input, classIds: ["4b", "5e", "3a"], divisors: { "4b": 1, "5e": 1, "3a": 1 } };
    assert.equal("wizards" in buildSessionDoc(tre, { uid: "u" }), false);
  });
});

describe("MagicSystem (§7)", () => {
  it("attacker = floor(rätt/100), mätare = rätt % 100", () => {
    assert.equal(ATTACK_THRESHOLD, 100);
    assert.deepEqual(magicState(0), { correct: 0, attacks: 0, meter: 0, fraction: 0, near: false });
    assert.equal(magicState(99).attacks, 0);
    assert.equal(magicState(99).near, true);
    assert.equal(magicState(100).attacks, 1);
    assert.equal(magicState(100).meter, 0);
    assert.equal(magicState(257).attacks, 2);
    assert.equal(magicState(257).meter, 57);
  });

  it("98 → 103 ger exakt 1 ny attack och mätaren 3/100", () => {
    const t = createMagicTracker({ sessionId: "s", classIds: ["a", "b"], store: memStore() });
    t.sync({ a: 98, b: 0 });
    const r = t.sync({ a: 103, b: 0 });
    assert.equal(r.events.length, 1);
    assert.deepEqual({ classId: r.events[0].classId, index: r.events[0].index }, { classId: "a", index: 1 });
    assert.equal(r.meters.a.meter, 3);
    assert.equal(t.sync({ a: 103, b: 0 }).events.length, 0, "samma läge igen = ingen dubblett");
  });

  it("100 → attack 1, 200 → attack 2; stora hopp tappar inget", () => {
    const t = createMagicTracker({ sessionId: "s", classIds: ["a", "b"], store: memStore() });
    t.sync({ a: 0, b: 0 });
    assert.deepEqual(t.sync({ a: 100, b: 0 }).events.map((e) => e.index), [1]);
    assert.deepEqual(t.sync({ a: 200, b: 0 }).events.map((e) => e.index), [2]);
    assert.deepEqual(t.sync({ a: 420, b: 0 }).events.map((e) => e.index), [3, 4]);
  });

  it("båda klasserna fulla samtidigt → båda attackerna, varannan", () => {
    const t = createMagicTracker({ sessionId: "s", classIds: ["a", "b"], store: memStore() });
    t.sync({ a: 99, b: 99 });
    const ev = t.sync({ a: 201, b: 100 }).events.map((e) => `${e.classId}${e.index}`);
    assert.deepEqual(ev, ["a1", "b1", "a2"]);
  });

  it("omladdning: första sync hoppar till nuläget, inga gamla attacker spelas", () => {
    const store = memStore();
    const t1 = createMagicTracker({ sessionId: "s", classIds: ["a", "b"], store });
    t1.sync({ a: 0, b: 0 });
    t1.sync({ a: 150, b: 40 });
    // "Omladdning" medan klass a hann till 310 (två attacker missades).
    const t2 = createMagicTracker({ sessionId: "s", classIds: ["a", "b"], store });
    const r = t2.sync({ a: 310, b: 40 });
    assert.equal(r.events.length, 0);
    assert.equal(r.meters.a.meter, 10);
    assert.deepEqual(t2.skipped(), { a: 2, b: 0 });
    assert.deepEqual(t2.sync({ a: 400, b: 40 }).events.map((e) => e.index), [4]);
    // Ny vy utan sparat läge (t.ex. vybyte mitt i matchen) hoppar också.
    const t3 = createMagicTracker({ sessionId: "annan", classIds: ["a", "b"], store });
    assert.equal(t3.sync({ a: 900, b: 900 }).events.length, 0);
  });

  it("quiet (matchen slut) uppdaterar utan nya attacker", () => {
    const t = createMagicTracker({ sessionId: "s", classIds: ["a"], store: memStore() });
    t.sync({ a: 90 });
    assert.equal(t.sync({ a: 105 }, { quiet: true }).events.length, 0);
    assert.equal(t.sync({ a: 150 }).events.length, 0, "attack 1 räknas som sedd");
  });

  it("finalen markeras en gång per session och överlever omladdning", () => {
    const store = memStore();
    const t = createMagicTracker({ sessionId: "s", classIds: ["a"], store });
    assert.equal(t.finaleSeen(), false);
    t.markFinale();
    assert.equal(createMagicTracker({ sessionId: "s", classIds: ["a"], store }).finaleSeen(), true);
  });

  it("attack-seed är deterministiskt (session + klass + index) och seededRandom likaså", () => {
    assert.equal(attackSeed("s1", "4b", 3), attackSeed("s1", "4b", 3));
    assert.notEqual(attackSeed("s1", "4b", 3), attackSeed("s1", "4b", 4));
    assert.notEqual(attackSeed("s1", "4b", 3), attackSeed("s1", "5e", 3));
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = [a(), a(), a()];
    assert.deepEqual(xs, [b(), b(), b()]);
    assert.ok(xs.every((x) => x >= 0 && x < 1));
  });
});

describe("Matchdata-adaptern (§19) – ingen egen poänglogik", () => {
  const session = {
    participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" },
    classDivisors: { "4b": 17, "5e": 22 }, wizards: { "4b": "elias", "5e": "rasmus" },
  };
  const st = (correct, extra = {}) => {
    const classes = classStandings(session, correct);
    const w = decideWinner(classes);
    return { sessionId: "s", session, phase: "live", status: "live", msLeft: 125_000, clock: formatClock(125_000),
      classes, leaderIds: w.leaderIds, winnerId: w.winnerId, draw: w.draw, result: null, ...extra };
  };

  it("poäng = classStandings (snitt, en decimal), trollkarlen följer klassen", () => {
    const d = duelData(st({ "4b": 340, "5e": 440 }));
    assert.deepEqual(d.sides.map((s) => [s.classId, s.who, s.wizardName, s.side, s.scoreText, s.correct]), [
      ["4b", "elias", "Elias", "left", "20,0", 340],
      ["5e", "rasmus", "Rasmus", "right", "20,0", 440],
    ]);
    assert.equal(d.leaderId, null, "lika snitt = ingen ensam ledare");
    assert.equal(d.clock, "02:05");
  });

  it("ledare ur leaderIds; ingen ledare innan någon fått poäng", () => {
    assert.equal(duelData(st({ "4b": 345, "5e": 433 })).leaderId, "4b");
    assert.equal(duelData(st({ "4b": 0, "5e": 0 })).leaderId, null);
  });

  it("spänning 30 s / 10 s bara under live", () => {
    assert.equal(duelData(st({}, { msLeft: 25_000 })).tension, "high");
    assert.equal(duelData(st({}, { msLeft: 9_000 })).tension, "final");
    assert.equal(duelData(st({}, { phase: "ended", msLeft: 0 })).tension, "");
  });

  it("officiell vinnare: result.winner först, annars live-ställningen efter väntan", () => {
    assert.equal(officialOutcome(st({}, { phase: "ended" })), null);
    const fin = st({ "4b": 345, "5e": 433 }, { phase: "finished" });
    assert.equal(officialOutcome(fin, 1000, 1000 + FINALE_WAIT_MS - 1), null);
    assert.deepEqual(officialOutcome(fin, 1000, 1000 + FINALE_WAIT_MS), { winnerId: "4b", draw: false, settled: false });
    assert.deepEqual(officialOutcome({ ...fin, result: { winner: "5e" } }, 1000, 1001), { winnerId: "5e", draw: false, settled: true });
    assert.deepEqual(officialOutcome({ ...fin, result: { winner: "draw" } }), { winnerId: null, draw: true, settled: true });
  });
});

describe("Registren", () => {
  it("platshållaren används bara tills riktiga attacker finns; aldrig samma två gånger i rad", () => {
    registerAttack({ id: "ph-test", placeholder: true, run() {} });
    assert.deepEqual(listAttacks().map((a) => a.id), ["ph-test"]);
    for (const id of ["a1", "a2", "a3"]) registerAttack({ id, run() {} });
    assert.deepEqual(listAttacks().map((a) => a.id), ["a1", "a2", "a3"]);
    for (let seed = 0; seed < 200; seed++) {
      const first = pickAttack(seed);
      assert.equal(pickAttack(seed).id, first.id, "deterministiskt");
      assert.notEqual(pickAttack(seed, first.id).id, first.id);
    }
    const hit = new Set(Array.from({ length: 300 }, (_, i) => pickAttack(attackSeed("s", "a", i)).id));
    assert.equal(hit.size, 3, "alla attacker kan väljas");
  });
  it("finaler per sort", () => {
    registerFinale({ id: "f-win", kind: "win", run() {} });
    registerFinale({ id: "f-draw", kind: "draw", run() {} });
    assert.equal(pickFinale(7, "draw").id, "f-draw");
    assert.ok(listFinales("win").some((f) => f.id === "f-win"));
    assert.throws(() => registerFinale({ id: "x", kind: "lose", run() {} }));
  });
});

describe("Regin: kö + prioritet (§11, §14.1, §16)", () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function rig() {
    const log = [];
    const d = createDirector({
      runAttack: async (evt, signal) => {
        log.push(`start ${evt.id}`);
        await new Promise((r) => { const t = setTimeout(r, 20); signal.addEventListener("abort", () => { clearTimeout(t); r(); }); });
        log.push(`${signal.aborted ? "avbruten" : "klar"} ${evt.id}`);
      },
      runFinale: async (o) => { log.push(`final ${o.draw ? "oavgjort" : o.winnerId}`); },
      settle: (kind, evt, aborted) => log.push(`reset ${kind}${aborted ? " (avbrott)" : ""}`),
    });
    return { d, log };
  }

  it("attacker spelas en i taget i ordning – ingen tappas", async () => {
    const { d, log } = rig();
    d.attack({ id: "A1" });
    d.attack({ id: "B1" });
    assert.equal(d.priority(), PRIORITY.ATTACK);
    await d.whenIdle();
    assert.deepEqual(log, ["start A1", "klar A1", "reset attack", "start B1", "klar B1", "reset attack"]);
    assert.equal(d.priority(), PRIORITY.IDLE);
  });

  it("finalen avbryter pågående attack, tömmer kön och spelas EXAKT en gång", async () => {
    const { d, log } = rig();
    let finals = 0;
    d.on("finale:start", () => finals++);
    d.attack({ id: "A1" });
    d.attack({ id: "B1" });
    await wait(5);
    assert.equal(d.finale({ winnerId: "4b", draw: false }), true);
    assert.equal(d.finale({ winnerId: "4b", draw: false }), false, "dubbla uppdateringar ignoreras");
    assert.equal(d.attack({ id: "C1" }), false, "inga nya attacker efter slut");
    await wait(40);
    assert.equal(finals, 1);
    assert.deepEqual(log, ["start A1", "avbruten A1", "reset attack (avbrott)", "final 4b", "reset finale"]);
  });

  it("stop() vid 00:00: inga nya attacker", async () => {
    const { d, log } = rig();
    d.stop();
    assert.equal(d.attack({ id: "A1" }), false);
    await wait(5);
    assert.deepEqual(log, []);
  });

  it("en attack som kraschar släpper kön ändå", async () => {
    const log = [];
    const d = createDirector({
      runAttack: async (evt) => { if (evt.id === "bad") throw new Error("pang"); log.push(evt.id); },
      runFinale: async () => {},
      settle: () => log.push("reset"),
    });
    const warn = console.warn;
    console.warn = () => {};
    d.attack({ id: "bad" });
    d.attack({ id: "ok" });
    await d.whenIdle();
    console.warn = warn;
    assert.deepEqual(log, ["reset", "ok", "reset"]);
  });
});

describe("Bootgrafen: Trollkarlsduellen bara dynamiskt (#271)", () => {
  it("ingen fil i src/live/trollkarl/ nås statiskt från app.js, och projector.js laddar vyn med import()", () => {
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const seen = new Set([join(SRC, "app.js")]);
    const queue = [...seen];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try { src = readFileSync(file, "utf8"); } catch { continue; }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    assert.equal([...seen].filter((f) => f.includes(`${join("live", "trollkarl")}`)).length, 0);
    const proj = readFileSync(join(SRC, "live", "projector.js"), "utf8");
    assert.match(proj, /import\("\.\/trollkarl\/trollkarl-vy\.js"\)/);
    assert.doesNotMatch(proj, /from\s+["']\.\/trollkarl\/trollkarl-vy\.js["']/);
  });
});
