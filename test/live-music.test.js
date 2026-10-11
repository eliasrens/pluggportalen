// Live – BAKGRUNDSMUSIKEN (#593): src/live/proj-music.js + proj-sound.js
// output()/onPlay(). Rena funktioner (nivåer, ducking) + createMusic mot en
// låtsas-AudioContext: loop-parametrarna (sömlös skarv), in-/uttoning,
// ducking BARA när effekten hördes, EN delad kontext, valet sparas lokalt.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  musicTarget, duckFor, nextDuck, createMusic, MUSIC_KEY, DEFAULT_LEVEL,
  FADE_IN_S, FADE_OUT_S, LOBBY_LEVEL,
} from "../src/live/proj-music.js";
import { validateFormat } from "../src/live/live-formats.js";
import GULDRUSH from "../src/live/formats/guldrush/index.js";

describe("musicTarget – nivån per fas (ren)", () => {
  const on = { on: true, level: 0.3, lobby: 0 };
  it("lobbyn är tyst (vårt val), 3-2-1-KÖR! tyst", () => {
    assert.equal(LOBBY_LEVEL, 0);
    assert.equal(musicTarget({ ...on, phase: "lobby" }).gain, 0);
    assert.equal(musicTarget({ ...on, phase: "countdown", msLeft: 600_000 }).gain, 0);
  });
  it("formatet kan välja låg lobbymusik (andel av nivån)", () => {
    assert.ok(Math.abs(musicTarget({ ...on, lobby: 0.2, phase: "lobby" }).gain - 0.06) < 1e-9);
  });
  it("matchen: ≈ 30 % av effekterna, tonas in på 1,5 s efter KÖR!", () => {
    assert.equal(DEFAULT_LEVEL, 0.3);
    assert.equal(FADE_IN_S, 1.5);
    assert.deepEqual(musicTarget({ ...on, phase: "live", msLeft: 90_000 }), { gain: 0.3, fade: FADE_IN_S });
  });
  it("00:00 → uttoning (före finalen), även innan servern hunnit sätta finished", () => {
    assert.deepEqual(musicTarget({ ...on, phase: "live", msLeft: 0 }), { gain: 0, fade: FADE_OUT_S });
    assert.deepEqual(musicTarget({ ...on, phase: "ended", msLeft: 0 }), { gain: 0, fade: FADE_OUT_S });
    assert.equal(musicTarget({ ...on, phase: "finished" }).gain, 0);
    assert.equal(musicTarget({ ...on, phase: "cancelled" }).gain, 0);
  });
  it("utan matchklocka (lärarstyrd takt, msLeft null) spelar den under live", () => {
    assert.equal(musicTarget({ ...on, phase: "live", msLeft: null }).gain, 0.3);
  });
  it("musik av eller tystad (elevskärmen spelar) → 0", () => {
    assert.equal(musicTarget({ ...on, on: false, phase: "live", msLeft: 5000 }).gain, 0);
    assert.equal(musicTarget({ ...on, muted: true, phase: "live", msLeft: 5000 }).gain, 0);
  });
  it("nivån kläms till 0–1", () => {
    assert.equal(musicTarget({ on: true, level: 4, phase: "live", msLeft: 1 }).gain, 1);
    assert.equal(musicTarget({ on: true, level: -1, phase: "live", msLeft: 1 }).gain, 0);
  });
});

describe("duckFor / nextDuck – ducking (ren)", () => {
  it("stora effekter (fanfar, gemensam skatt/skattkammare, guldregn) sänker djupt", () => {
    for (const n of ["fanfar", "fanfarKort", "guldregn", "trumvirvel", "grotta"]) {
      assert.equal(duckFor(n).depth, 0.35, n);
    }
  });
  it("stöld, kistor och byte sänker lite; små pling/tick inte alls", () => {
    for (const n of ["stold", "chest", "swoosh", "vosh"]) assert.equal(duckFor(n).depth, 0.7, n);
    for (const n of ["pling", "bock", "tick", "tickSnabb", "okänt"]) assert.equal(duckFor(n), null, n);
  });
  it("hålls effektens längd och återgår mjukt till 1", () => {
    const p = duckFor("fanfar");
    const r = nextDuck(null, p, 10);
    assert.deepEqual(r.points.map((x) => x.v), [0.35, 0.35, 1]);
    assert.ok(Math.abs(r.points[0].t - (10 + p.attack)) < 1e-9);
    assert.ok(Math.abs(r.points[1].t - (10 + p.attack + 1.3)) < 1e-9);
    assert.ok(r.points[2].t - r.points[1].t >= 0.5, "mjuk återgång");
    assert.ok(r.points.every((x) => x.v > 0 && x.v <= 1), "aldrig tyst, aldrig över full");
  });
  it("överlapp: djupaste sänkningen och längsta hållningen vinner", () => {
    const a = nextDuck(null, duckFor("fanfar"), 0); // håller till ≈ 1,38
    const b = nextDuck(a.state, duckFor("stold"), 0.5); // grundare, kortare
    assert.equal(b.state.depth, 0.35);
    assert.ok(Math.abs(b.state.until - a.state.until) < 1e-9);
    const c = nextDuck(b.state, duckFor("guldregn"), 1); // längre
    assert.ok(c.state.until > b.state.until);
  });
  it("efter en avslutad sänkning börjar nästa från början", () => {
    const a = nextDuck(null, duckFor("fanfar"), 0);
    const b = nextDuck(a.state, duckFor("stold"), 5);
    assert.equal(b.state.depth, 0.7);
  });
});

describe("format.music – det generella fältet", () => {
  const base = { ...GULDRUSH, id: "test_music" };
  it("Guldrushen har music med en befintlig ogg-fil (lat, inte i bootkedjan)", () => {
    assert.equal(GULDRUSH.music.level, 0.3);
    assert.equal(GULDRUSH.music.lobby, 0);
    const path = fileURLToPath(GULDRUSH.music.src);
    assert.ok(path.endsWith("src/live/formats/guldrush/assets/guldrushen-loop.ogg"));
    assert.ok(existsSync(path) && statSync(path).size > 1_000_000);
    assert.deepEqual(validateFormat(GULDRUSH), []);
  });
  it("valideras: src krävs, level/lobby 0–1; utan fält = ingen musik", () => {
    assert.deepEqual(validateFormat({ ...base, music: undefined }), []);
    assert.deepEqual(validateFormat({ ...base, music: { src: "x.ogg" } }), []);
    for (const music of [{}, { src: "" }, { src: "x.ogg", level: 2 }, { src: "x.ogg", lobby: -0.1 }, "x.ogg"]) {
      assert.ok(validateFormat({ ...base, music }).some((e) => e.startsWith("music")), JSON.stringify(music));
    }
  });
});

// --- createMusic mot en låtsas-Web Audio ---------------------------------------

function param(v) {
  const p = {
    value: v, events: [],
    cancelScheduledValues(t) { p.events.push(["cancel", t]); },
    setValueAtTime(x, t) { p.events.push(["set", x, t]); },
    linearRampToValueAtTime(x, t) { p.events.push(["ramp", x, t]); p.value = x; },
    exponentialRampToValueAtTime(x, t) { p.events.push(["exp", x, t]); },
    ramps() { return p.events.filter((e) => e[0] === "ramp"); },
  };
  return p;
}

function fakeAudio() {
  const made = { contexts: [], sources: [], gains: [], decoded: 0, n: 0 };
  class FakeCtx {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; made.contexts.push(this); }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createGain() {
      const g = { gain: param(1), connect: (n) => n, disconnect() {}, order: made.n++ };
      made.gains.push(g);
      return g;
    }
    createOscillator() {
      return { frequency: param(0), connect: (n) => n, start() {}, stop() {} };
    }
    createBufferSource() {
      const s = { loop: false, loopStart: -1, loopEnd: -1, started: 0, stopped: 0, order: made.n++, connect: (n) => n, start() { s.started++; }, stop() { s.stopped++; } };
      made.sources.push(s);
      return s;
    }
    decodeAudioData() { made.decoded++; return Promise.resolve({ duration: 84.2, fake: true }); }
  }
  return { FakeCtx, made };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createMusic – Web Audio-loopen", () => {
  let store;
  let audio;
  let listeners;
  beforeEach(() => {
    store = new Map();
    audio = fakeAudio();
    listeners = [];
    globalThis.window = {
      addEventListener: (t, fn) => listeners.push(fn),
      removeEventListener() {},
      AudioContext: audio.FakeCtx,
    };
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.fetch;
  });

  async function setup({ soundOff = false } = {}) {
    if (soundOff) store.set("pp:live:ljud", "av");
    const { createSound } = await import("../src/live/proj-sound.js");
    const sound = createSound();
    const music = createMusic({ sound });
    music.load({ src: "/guldrushen-loop.ogg", level: 0.3, lobby: 0 });
    music.update({ phase: "lobby", msLeft: 600_000 });
    await tick(); await tick();
    // STARTA = lärarens gest → kontexten låses upp.
    for (const fn of listeners) fn();
    await tick();
    return { sound, music, ctx: audio.made.contexts[0] };
  }
  // Kedjan källa → duck → fade byggs när musiken startar: gainerna direkt efter källan.
  const chainGain = (i) => audio.made.gains.find((g) => g.order === audio.made.sources[0].order + i);
  const duckGain = () => chainGain(1);
  const fadeGain = () => chainGain(2);

  it("förladdas i lobbyn (en avkodning), tyst – ingen källa startar före KÖR!", async () => {
    const { music } = await setup();
    assert.equal(audio.made.decoded, 1);
    assert.equal(audio.made.sources.length, 0);
    music.update({ phase: "countdown", msLeft: 600_000 });
    assert.equal(audio.made.sources.length, 0);
    music.destroy();
  });

  it("loop-parametrarna: AudioBufferSourceNode, loop = true över hela bufferten (sömlös skarv vid 1:24)", async () => {
    const { music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    const [src] = audio.made.sources;
    assert.equal(src.loop, true);
    assert.equal(src.loopStart, 0);
    assert.equal(src.loopEnd, 0, "0 = buffertens slut – ingen tystnad, ingen avkortning");
    assert.equal(src.buffer.duration, 84.2);
    assert.equal(src.started, 1);
    music.destroy();
  });

  it("tonas in 1,5 s till 30 %, ut vid 00:00 och källan stoppas efteråt", async () => {
    const { music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    assert.deepEqual(fadeGain().gain.ramps().at(-1), ["ramp", 0.3, FADE_IN_S]);
    music.update({ phase: "live", msLeft: 59_000 }); // ingen ny ramp mitt i matchen
    assert.equal(fadeGain().gain.ramps().length, 1);
    music.update({ phase: "ended", msLeft: 0 });
    assert.deepEqual(fadeGain().gain.ramps().at(-1), ["ramp", 0, FADE_OUT_S]);
    await new Promise((r) => setTimeout(r, FADE_OUT_S * 1000 + 300));
    assert.equal(audio.made.sources[0].stopped, 1);
    music.destroy();
  });

  it("EN AudioContext delas med effekterna (även när effekterna är av)", async () => {
    const { music } = await setup({ soundOff: true });
    music.update({ phase: "live", msLeft: 600_000 });
    assert.equal(audio.made.contexts.length, 1);
    assert.equal(audio.made.sources.length, 1, "musiken spelar fast ljudeffekterna är av");
    music.destroy();
  });

  it("stor effekt som hörs (fanfar vid gemensam skatt) → musiken sänks kort och återgår", async () => {
    const { sound, music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    assert.equal(sound.cue("fanfarKort"), true);
    const r = duckGain().gain.ramps();
    assert.deepEqual(r.map((e) => e[1]), [0.35, 0.35, 1]);
    music.destroy();
  });

  it("stöld och kistor (play) duckar också; pling inte", async () => {
    const { sound, music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    sound.cue("pling");
    assert.equal(duckGain().gain.ramps().length, 0);
    sound.cue("stold");
    assert.equal(duckGain().gain.ramps()[0][1], 0.7);
    sound.play((t) => t(440));
    assert.ok(duckGain().gain.ramps().length > 3);
    music.destroy();
  });

  it("test 19b: effekterna AV, musiken på → gemensam skatt sänker INTE musiken", async () => {
    const { sound, music } = await setup({ soundOff: true });
    music.update({ phase: "live", msLeft: 600_000 });
    assert.equal(sound.cue("fanfarKort"), false, "effekten hörs inte");
    assert.equal(duckGain().gain.ramps().length, 0, "jämn volym");
    music.destroy();
  });

  it("tystad panel (elevskärmen spelar) hör inga effekter och duckar inte", async () => {
    const { sound, music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    sound.mute(true);
    music.mute(true);
    assert.deepEqual(fadeGain().gain.ramps().at(-1)[1], 0);
    assert.equal(sound.cue("fanfar"), false);
    assert.equal(duckGain().gain.ramps().length, 0);
    music.destroy();
  });

  it("test 16 + 21: Musik av tystnar (effekterna kvar) och valet sparas lokalt", async () => {
    const { sound, music } = await setup();
    music.update({ phase: "live", msLeft: 600_000 });
    assert.equal(music.toggle(), false);
    assert.equal(store.get(MUSIC_KEY), "av");
    assert.equal(fadeGain().gain.ramps().at(-1)[1], 0);
    assert.equal(sound.cue("ding"), true, "effekterna hörs fortfarande");
    music.destroy();
    // Omladdning: valet är kvar.
    const again = createMusic({ sound });
    assert.equal(again.on, false);
    again.destroy();
  });

  it("standardläge: på", async () => {
    const { createSound } = await import("../src/live/proj-sound.js");
    const m = createMusic({ sound: createSound() });
    assert.equal(m.on, true);
    m.destroy();
  });
});

describe("test 18: aldrig musik på elevdatorerna", () => {
  it("elevens Live-sida och formatens elevvyer når varken proj-music.js eller projektorn statiskt", () => {
    const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const starts = ["live/page-elev-live.js", "live/formats/guldrush/guldrush-student.js",
      "live/formats/snilleblixt/snilleblixt-student.js", "live/formats/klassmatch/klassmatch-student.js"]
      .map((f) => join(SRC, f)).filter((f) => existsSync(f));
    assert.ok(starts.length >= 2);
    const seen = new Set(starts);
    const queue = [...starts];
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
    assert.ok(seen.has(join(SRC, "live/proj-sound.js")), "BFS:en når elevens kistljud (gr-ljud → proj-sound)");
    for (const f of ["live/proj-music.js", "live/projector.js"]) assert.equal(seen.has(join(SRC, f)), false, f);
  });
});
