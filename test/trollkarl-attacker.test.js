// Trollkarlsduellen (#538): attackmotorn – registret med attacker 1–8,
// deterministiskt slumpval utan direkt upprepning, burst-komprimering och
// kön under tryck. Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Manifestet registrerar alla attacker (ingen DOM vid import).
import "../src/live/trollkarl/trollkarl-innehall.js";
import { listAttacks, getAttack, pickAttack } from "../src/live/trollkarl/trollkarl-register.js";
import { attackSeed } from "../src/live/trollkarl/trollkarl-magi.js";
import { createDirector, rushFor } from "../src/live/trollkarl/trollkarl-regi.js";

const IDS = [
  "grodifix", "honus-panikus", "potatus-totalus", "regnus-maximus",
  "fjadrus-stormus", "stinkus-maximus", "bananus-halkus", "slemmus-blaaus",
];
const NAMN = {
  grodifix: "GRODIFIX!", "honus-panikus": "HÖNUS PANIKUS!", "potatus-totalus": "POTATUS TOTALUS!",
  "regnus-maximus": "REGNUS MAXIMUS!", "stinkus-maximus": "STINKUS MAXIMUS!",
  "bananus-halkus": "BANANUS HALKUS!", "slemmus-blaaus": "SLEMMUS BLÄÄÄUS!", "fjadrus-stormus": "FJÄDRUS STORMUS!",
};

describe("Attackregistret (§8, §9)", () => {
  it("attack 1–8 är registrerade med unika id, namn, varaktighet, ljud och run()", () => {
    const list = listAttacks();
    assert.deepEqual(new Set(list.map((a) => a.id)), new Set(IDS));
    assert.equal(new Set(list.map((a) => a.id)).size, list.length, "unika id");
    for (const a of list) {
      assert.equal(a.name, NAMN[a.id]);
      assert.ok(a.durationMs >= 2000 && a.durationMs <= 15_000, `${a.id}: rimlig varaktighet`);
      assert.ok(Array.isArray(a.sounds) && a.sounds.length, `${a.id}: ljudnycklar för del E`);
      assert.equal(typeof a.run, "function");
      assert.ok(!a.placeholder, "platshållaren syns inte när riktiga attacker finns");
    }
  });

  it("slumpvalet är deterministiskt ur seedet", () => {
    for (let i = 0; i < 300; i++) {
      const seed = attackSeed("sess", "4b", i);
      assert.equal(pickAttack(seed).id, pickAttack(seed).id);
      assert.equal(pickAttack(seed, "grodifix").id, pickAttack(seed, "grodifix").id);
    }
  });

  it("aldrig samma attack två gånger i rad för samma trollkarl; båda når alla 8", () => {
    for (const cid of ["4b", "5e"]) {
      const traff = new Set();
      let forra = null;
      for (let index = 1; index <= 400; index++) {
        const def = pickAttack(attackSeed("sess", cid, index), forra);
        assert.notEqual(def.id, forra, `${cid} #${index}: direkt upprepning`);
        traff.add(def.id);
        forra = def.id;
      }
      assert.equal(traff.size, IDS.length, `${cid} använder alla attacker`);
    }
  });

  it("avsändare/mottagare följer händelsen (vyn skickar from/to – registret bara väljer)", () => {
    const def = getAttack("grodifix");
    assert.ok(def);
    assert.equal(def.run.length, 2, "run(scene, a)");
  });
});

describe("Burst-komprimering (§11/§16, rushFor)", () => {
  it("tom kö = normaltempo med uppladdning; tryck = snabbare utan uppladdning", () => {
    assert.deepEqual(rushFor(0), { speed: 1, skipCharge: false });
    assert.deepEqual(rushFor(1), { speed: 1.4, skipCharge: false });
    assert.deepEqual(rushFor(2), { speed: 1.4, skipCharge: true });
    assert.deepEqual(rushFor(5), { speed: 2.4, skipCharge: true });
    assert.deepEqual(rushFor(99), { speed: 2.4, skipCharge: true });
    let prev = 0;
    for (let p = 0; p <= 10; p++) {
      const { speed } = rushFor(p);
      assert.ok(speed >= prev, "tempot sjunker aldrig när kön växer");
      prev = speed;
    }
    assert.deepEqual(rushFor(-3), rushFor(0), "aldrig långsammare än normal");
  });
});

describe("Kön under tryck (§11)", () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  it("enorm burst: allt spelas i ordning, en i taget, inget tappas", async () => {
    const ordning = [];
    let samtidiga = 0;
    const d = createDirector({
      async runAttack(evt, signal) {
        samtidiga++;
        assert.equal(samtidiga, 1, "aldrig överlapp");
        await wait(2 / rushFor(d.pending()).speed); // komprimerat tempo
        ordning.push(evt.n);
        samtidiga--;
      },
      runFinale: async () => {},
    });
    for (let n = 1; n <= 12; n++) d.attack({ n });
    await d.whenIdle();
    assert.deepEqual(ordning, Array.from({ length: 12 }, (_, i) => i + 1));
    d.destroy();
  });

  it("finalen under en burst: pågående avbryts, kön töms, finalen spelas en gång", async () => {
    const logg = [];
    const d = createDirector({
      async runAttack(evt, signal) {
        logg.push(`start ${evt.n}`);
        await new Promise((r) => { const t = setTimeout(r, 30); signal.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true }); });
      },
      runFinale: async () => logg.push("final"),
      settle: (kind, evt, aborted) => logg.push(`reset ${kind}${aborted ? " avbrott" : ""}`),
    });
    for (let n = 1; n <= 6; n++) d.attack({ n });
    await wait(5);
    d.finale({ winnerId: "4b", draw: false });
    d.finale({ winnerId: "4b", draw: false });
    await wait(60);
    assert.deepEqual(logg, ["start 1", "reset attack avbrott", "final", "reset finale"]);
    assert.equal(d.pending(), 0);
    d.destroy();
  });
});
