// Trollkarlsduellen (#540): del E – ljud (Web Audio) + finaler. Körs med:
// node --test. Ingen DOM: ljuden testas mot en mockad AudioContext, finalerna
// på registret/regi-nivå (sekvenserna själva kräver webbläsare – demoläget).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

// Manifestet registrerar attacker, finaler och ljud (ingen DOM vid import).
import "../src/live/trollkarl/trollkarl-innehall.js";
import { listAttacks, listFinales, pickFinale, getSound } from "../src/live/trollkarl/trollkarl-register.js";
import { LJUD_NAMN, MAX_VOL } from "../src/live/trollkarl/trollkarl-ljud.js";
import { createDirector } from "../src/live/trollkarl/trollkarl-regi.js";
import { createMagicTracker } from "../src/live/trollkarl/trollkarl-magi.js";
import { officialOutcome } from "../src/live/trollkarl/trollkarl-data.js";

// --- Mockad Web Audio-kontext ------------------------------------------------

function param(v = 0) {
  const p = { value: v, maxRamp: 0 };
  const spar = (x) => { p.maxRamp = Math.max(p.maxRamp, x); };
  p.setValueAtTime = spar;
  p.linearRampToValueAtTime = spar;
  p.exponentialRampToValueAtTime = spar;
  return p;
}

function mockAc() {
  const ac = { currentTime: 0, sampleRate: 8000, noder: [], kopplingar: 0 };
  const nod = (extra) => {
    const n = { ...extra, connect(m) { ac.kopplingar++; return m; } };
    ac.noder.push(n);
    return n;
  };
  ac.createGain = () => nod({ gain: param(1) });
  ac.createOscillator = () => nod({ type: "", frequency: param(440), start() {}, stop() {} });
  ac.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
  ac.createBufferSource = () => nod({ buffer: null, loop: false, start() {}, stop() {} });
  ac.createBiquadFilter = () => nod({ type: "", Q: param(1), frequency: param(350) });
  ac.createDynamicsCompressor = () => nod({
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
  });
  return ac;
}

// --- §12: ljuden ---------------------------------------------------------------

describe("Ljudregistret (§12)", () => {
  it("alla ljudnycklar som attackerna 1–8 använder har riktiga ljud", () => {
    for (const a of listAttacks()) {
      for (const key of a.sounds || []) {
        assert.ok(LJUD_NAMN.includes(key), `${a.id}: ljudnyckeln "${key}" saknar registrerat ljud`);
      }
    }
    // Nycklar som spelas utanför attackdefinitionerna (vyn, platshållaren).
    for (const key of ["uppladdning", "matare-full", "spanning", "nedrakning", "platshallare-swisch"]) {
      assert.ok(LJUD_NAMN.includes(key), `"${key}" saknar registrerat ljud`);
    }
  });

  it("okänd nyckel (t.ex. en ny attack i del D) faller tillbaka på reserven *", () => {
    assert.equal(typeof getSound("helt-okand-attack-nyckel"), "function");
    assert.equal(getSound("helt-okand-attack-nyckel"), getSound("*"));
  });

  it("varje ljud bygger Web Audio-noder utan fel och håller volymtaket", async () => {
    let i = 0;
    for (const namn of LJUD_NAMN) {
      // Kaosskyddet tillåter max ett antal ljudstarter per 300 ms – vänta ut det.
      if (i++ % 5 === 4) await sleep(320);
      const ac = mockAc();
      const out = { connect: () => {} };
      getSound(namn)(ac, out, 0);
      assert.ok(ac.noder.length >= 2, `${namn}: skapade inga noder`);
      assert.ok(ac.kopplingar >= 2, `${namn}: kopplade inga noder`);
      for (const n of ac.noder) {
        if (n.gain) assert.ok(n.gain.maxRamp <= MAX_VOL + 1e-9, `${namn}: volym ${n.gain.maxRamp} över taket`);
      }
    }
  });

  it("samma ljud spelas inte tätare än spärren (inga okontrollerade upprepningar)", async () => {
    await sleep(320);
    const spela = () => {
      const ac = mockAc();
      getSound("poff")(ac, { connect: () => {} }, 0);
      return ac.noder.length;
    };
    assert.ok(spela() > 0, "första gången spelar");
    assert.equal(spela(), 0, "direkt efteråt är den spärrad");
  });

  it("ljud av = inga AudioNode-anrop (fx körs inte, ingen AudioContext skapas)", async () => {
    let skapade = 0;
    globalThis.window = {
      addEventListener() {}, removeEventListener() {},
      AudioContext: class { constructor() { skapade++; } },
    };
    globalThis.localStorage = { getItem: () => "av", setItem() {} };
    try {
      const { createSound } = await import("../src/live/proj-sound.js");
      const s = createSound();
      assert.equal(s.on, false);
      let kord = 0;
      s.fx(() => kord++);
      s.blip();
      s.win();
      assert.equal(kord, 0, "fx-ljud spelas inte när ljudet är av");
      assert.equal(skapade, 0, "ingen AudioContext skapas när ljudet är av");
      s.destroy();
    } finally {
      delete globalThis.window;
      delete globalThis.localStorage;
    }
  });
});

// --- §14: finalerna -------------------------------------------------------------

describe("Finalerna (§14)", () => {
  it("minst 3 vinnarvarianter och en egen oavgjort-final, inga platshållare", () => {
    const win = listFinales("win");
    const draw = listFinales("draw");
    assert.deepEqual(new Set(win.map((f) => f.id)), new Set(["energikula", "potatis-gigantus", "drakus-finalus"]));
    assert.ok(draw.some((f) => f.id === "magisk-krock"));
    for (const f of [...win, ...draw]) {
      assert.ok(!f.placeholder, `${f.id}: platshållare ska inte väljas längre`);
      assert.equal(typeof f.run, "function");
    }
  });

  it("varianten väljs deterministiskt ur seedet och alla varianter förekommer (§14.3)", () => {
    const sedda = new Set();
    for (let seed = 0; seed < 60; seed++) {
      assert.equal(pickFinale(seed, "win").id, pickFinale(seed, "win").id);
      sedda.add(pickFinale(seed, "win").id);
    }
    assert.equal(sedda.size, 3, "alla tre vinnarfinaler används");
    assert.equal(pickFinale(7, "draw").kind, "draw");
  });

  it("finalen spelas EXAKT en gång och avbryter kön (§14.1, §16)", async () => {
    let finaler = 0;
    const d = createDirector({
      runAttack: (evt, signal) => new Promise((r) => signal.addEventListener("abort", r, { once: true })),
      runFinale: async () => { finaler++; },
    });
    d.attack({ from: "a", to: "b", index: 1, seed: 1 });
    d.attack({ from: "b", to: "a", index: 1, seed: 2 });
    d.finale({ winnerId: "a", draw: false });
    d.finale({ winnerId: "b", draw: false }); // dubbel uppdatering – ignoreras
    await d.whenIdle();
    assert.equal(finaler, 1);
    assert.equal(d.attack({ from: "a", to: "b", index: 2, seed: 3 }), false, "inga attacker efter finalen");
    d.destroy();
  });

  it("omladdning efter slutet: finaleSeen består → resultatskärmen direkt (§16)", () => {
    const m = new Map();
    const store = { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
    createMagicTracker({ sessionId: "s540", classIds: ["a", "b"], store }).markFinale();
    assert.equal(createMagicTracker({ sessionId: "s540", classIds: ["a", "b"], store }).finaleSeen(), true);
  });

  it("oavgjort detekteras via befintlig vinnarlogik (§14.4)", () => {
    const likaSt = { phase: "finished", result: { winner: "draw" } };
    assert.deepEqual(officialOutcome(likaSt), { winnerId: null, draw: true, settled: true });
    const vinstSt = { phase: "finished", result: { winner: "4b" } };
    assert.deepEqual(officialOutcome(vinstSt), { winnerId: "4b", draw: false, settled: true });
  });
});
