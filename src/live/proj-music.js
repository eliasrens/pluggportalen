// ============================================================================
// Live-projektorn: BAKGRUNDSMUSIK (#593) – formatets loop (`format.music`).
// ----------------------------------------------------------------------------
// Spelas bara där Live-ljudet spelas: projektorvyn (skalet, projector.js)
// eller elevskärmsfönstret (#533) – aldrig på elevdatorerna (de monterar
// aldrig projektorn). Samma AudioContext och huvudvolym som effekterna
// (proj-sound.js output()); kontexten hålls vaken när musiken är på, även om
// effekterna är av.
//
// Web Audio, INTE <audio loop> (hack vid skarven): filen hämtas i lobbyn
// (load), avkodas med decodeAudioData när kontexten finns och spelas med en
// AudioBufferSourceNode, loop = true över HELA bufferten (loopStart 0,
// loopEnd 0 = buffertens slut) – sampelexakt skarv.
//
// Kedjan: källa → duck (ducking) → fade (nivå, in/uttoning) → effekternas ut.
// Nivåerna (rena funktioner nedan, testade i test/live-music.test.js):
//   lobby          LOBBY_LEVEL = 0 (tyst – läraren pratar, och ljud får ändå
//                  inte starta före en gest; formatet kan välja `lobby`)
//   3-2-1-KÖR!     tyst; tonas in FADE_IN_S efter KÖR! (fasen blir "live")
//   match          music.level (≈ 0,3 = 30 % av effekternas huvudvolym)
//   00:00          tonas ut FADE_OUT_S – före finalens grottljud/trumvirvel
//   av/tystad      tonas ut FADE_TOGGLE_S
// Ducking: proj-sound onPlay(name) → duckFor(name) – bara effekter som
// FAKTISKT hördes (ljud av → inga anrop → jämn musik). Stora (fanfar,
// skattkammare, gemensam skatt …) sänker till 35 %, mellan (stöld, kistor,
// byte …) till 70 %, små (pling, tick) inte alls.
//
// Musik på/av sparas LOKALT (pp:live:musik, standard PÅ) – som ljud och vyval.
//
// API
//   createMusic({ sound, key? }) → { on, unlocked(), toggle() → on, setOn(on),
//     mute(m), load(music), update({ phase, msLeft }), duck(name), destroy() }
//     load(music)  formatets { src, level?, lobby? } – hämtar filen (lat)
//     update(...)  10 ggr/s ur skalets timer: fas + ms kvar (null = ingen klocka)
//   musicTarget({ on, muted, phase, msLeft, level, lobby }) → { gain, fade }
//   duckFor(name) → { depth, attack, hold, release } | null
//   nextDuck(state, plan, now) → { state, points: [{ t, v }] }
// ============================================================================

export const MUSIC_KEY = "pp:live:musik";
export const DEFAULT_LEVEL = 0.3;
export const LOBBY_LEVEL = 0;
export const FADE_IN_S = 1.5;
export const FADE_OUT_S = 1.2;
export const FADE_TOGGLE_S = 0.4;

// Effekter som sänker musiken. Namnen = proj-sound CUES + "chest" (play()).
const DUCK_BIG = { depth: 0.35, attack: 0.08, release: 0.9 };
const DUCK_MID = { depth: 0.7, attack: 0.05, release: 0.5 };
export const DUCK = Object.freeze({
  fanfar: DUCK_BIG, fanfarKort: DUCK_BIG, guldregn: DUCK_BIG, trumvirvel: DUCK_BIG, grotta: DUCK_BIG,
  stold: DUCK_MID, chest: DUCK_MID, swoosh: DUCK_MID, vosh: DUCK_MID, ding: DUCK_MID,
  blixt: DUCK_MID, klirr: DUCK_MID, tassar: DUCK_MID,
});
// Hur länge sänkningen hålls (s) – effektens längd ur ljudkön, annars 0,4 s.
const DUR_S = {
  fanfar: 1.3, fanfarKort: 0.7, guldregn: 1.4, trumvirvel: 1.2, grotta: 1.0,
  stold: 0.7, chest: 0.5, swoosh: 0.36, vosh: 0.45, ding: 0.7, blixt: 0.3, klirr: 0.3, tassar: 0.5,
};

const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));

/** Musikens målnivå just nu (ren). msLeft null = sessionen saknar matchklocka. */
export function musicTarget({ on, muted = false, phase, msLeft = null, level = DEFAULT_LEVEL, lobby = LOBBY_LEVEL }) {
  if (!on || muted) return { gain: 0, fade: FADE_TOGGLE_S };
  if (phase === "lobby") return { gain: clamp01(level) * clamp01(lobby), fade: FADE_TOGGLE_S };
  if (phase === "live" && (msLeft == null || msLeft > 0)) return { gain: clamp01(level), fade: FADE_IN_S };
  // countdown (3-2-1-KÖR!), ended (00:00), finished, cancelled
  return { gain: 0, fade: phase === "countdown" ? FADE_TOGGLE_S : FADE_OUT_S };
}

/** Sänkningen för en effekt som hördes, eller null (ingen ducking). */
export function duckFor(name) {
  const d = DUCK[name];
  return d ? { ...d, hold: DUR_S[name] ?? 0.4 } : null;
}

/**
 * Nästa duck-kurva (ren). state = { depth, until } (pågående sänkning, until =
 * när återgången börjar, s). Överlapp: djupaste sänkningen, längsta hållningen.
 * points = automationspunkter för duck-gainen (linjära ramper), sista = 1.
 */
export function nextDuck(state, plan, now) {
  const active = state && state.until > now;
  const depth = active ? Math.min(state.depth, plan.depth) : plan.depth;
  const until = Math.max(active ? state.until : 0, now + plan.attack + plan.hold);
  return {
    state: { depth, until, end: until + plan.release },
    points: [{ t: now + plan.attack, v: depth }, { t: until, v: depth }, { t: until + plan.release, v: 1 }],
  };
}

function readPref(key) {
  try { return localStorage.getItem(key) !== "av"; } catch { return true; }
}

export function createMusic({ sound, key = MUSIC_KEY }) {
  let on = readPref(key);
  let muted = false;
  let music = null; // formatets { src, level, lobby }
  let bytes = null; // Promise<ArrayBuffer>
  let buffer = null;
  let decoding = false;
  let chain = null; // { ctx, src, duck, fade }
  let last = { phase: "lobby", msLeft: null };
  let target = 0;
  let duckState = null;
  let stopT = 0;
  let dead = false;

  const off = sound.onPlay((name) => duck(name));

  // Kontexten (delad med effekterna) – bara när musiken behövs.
  const out = () => (music && on && !dead ? sound.output({ hold: true }) : null);

  function decode(o) {
    if (buffer || decoding || !bytes || !o) return;
    decoding = true;
    bytes.then((ab) => o.ctx.decodeAudioData(ab.slice(0)))
      .then((b) => { buffer = b; decoding = false; apply(); })
      .catch((e) => { decoding = false; bytes = null; console.warn("Live-musik:", e?.message || e); });
  }

  function build(o) {
    const { ctx } = o;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = 0; // 0 = hela bufferten
    const dk = ctx.createGain();
    const fade = ctx.createGain();
    fade.gain.value = 0;
    src.connect(dk).connect(fade).connect(o.out);
    src.start();
    return { ctx, src, duck: dk, fade };
  }

  function stop() {
    if (!chain) return;
    try { chain.src.stop(); } catch {}
    try { chain.fade.disconnect(); } catch {}
    chain = null;
    duckState = null;
    if (!on) sound.output({ hold: false }); // effekterna av → kontexten får somna igen
  }

  // Av utan spelande källa → släpp kontexten direkt (annars när uttoningen är klar).
  function release() {
    if (!on && !chain && music) sound.output({ hold: false });
  }

  // Målnivån → mjuk ramp. Tyst en stund → källan stoppas (startar om vid behov).
  function apply() {
    const t = musicTarget({ on, muted, ...last, level: music?.level ?? DEFAULT_LEVEL, lobby: music?.lobby ?? LOBBY_LEVEL });
    if (t.gain > 0) {
      clearTimeout(stopT);
      stopT = 0;
      const o = out();
      if (!o) return;
      decode(o);
      if (!buffer || o.ctx.state !== "running") return;
      if (!chain) chain = build(o);
    }
    if (t.gain === target && (chain || t.gain === 0)) return;
    target = t.gain;
    if (!chain) return;
    const g = chain.fade.gain;
    const now = chain.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + t.fade);
    if (target === 0 && !stopT) stopT = setTimeout(() => { stopT = 0; if (target === 0) stop(); }, t.fade * 1000 + 200);
  }

  function duck(name) {
    const plan = duckFor(name);
    if (!plan || !chain || target === 0) return;
    const g = chain.duck.gain;
    const now = chain.ctx.currentTime;
    const r = nextDuck(duckState, plan, now);
    duckState = r.state;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    for (const p of r.points) g.linearRampToValueAtTime(p.v, p.t);
  }

  return {
    get on() { return on; },
    /** Musiken kan låta (på + kontexten igång) – elevskärmens "audio" för musiken. */
    unlocked: () => !!(on && music && sound.running()),
    toggle() {
      on = !on;
      try { localStorage.setItem(key, on ? "pa" : "av"); } catch {}
      release();
      apply();
      return on;
    },
    setOn(v) {
      if (on === !!v) return;
      on = !!v;
      release();
      apply();
    },
    mute(m) {
      if (muted === !!m) return;
      muted = !!m;
      apply();
    },
    /** Formatets musik – filen hämtas direkt (lobbyn), avkodas när kontexten finns. */
    load(m) {
      if (!m?.src || music?.src === m.src) return;
      music = { level: DEFAULT_LEVEL, lobby: LOBBY_LEVEL, ...m };
      bytes = fetch(m.src).then((r) => {
        if (!r.ok) throw new Error(`${m.src}: ${r.status}`);
        return r.arrayBuffer();
      });
      bytes.catch(() => {});
      if (on) decode(out());
    },
    update(state) {
      last = { phase: state.phase, msLeft: state.msLeft ?? null };
      apply();
    },
    duck,
    destroy() {
      dead = true;
      off();
      clearTimeout(stopT);
      stop();
    },
  };
}
