// ============================================================================
// Live-projektorn: ljud (#461) – syntetiserat med Web Audio, inga ljudfiler.
// ----------------------------------------------------------------------------
// Ljud på/av sparas LOKALT per webbläsare (localStorage pp:live:ljud) precis
// som vyvalet. AV = helt tyst: ingen AudioContext skapas och en befintlig
// stängs av (suspend). Autoplay-regler: webbläsaren låter bara ljud starta
// efter en användargest – kontexten skapas/väcks vid första klick/tangent i
// sidan (STARTA-knappen, ljudknappen …). unlocked() säger om det skett, så
// knappen kan be om ett klick ("Klicka för ljud").
//
// API
//   createSound()  → { on, unlocked(), toggle() → on, unlock(), setOn(on), mute(m), fx(fn), cue(name),
//                      tick(n), go(), blip(), lead(), end(), win(), destroy() }
//   setOn(on)  elevskärmen (#533) följer kontrollpanelens val (sparar inget)
//   mute(m)    kontrollpanelen tystnar medan en elevskärm spelar ljudet (#533)
//   fx(fn)     egna ljud (Trollkarlsduellen, #536): fn(audioCtx, ut) bara när ljudet
//              är på, upplåst och inte tystat – samma kontext och volym som resten
//
// LJUDKÖN (#571, designspec §8) – för de nya lägena (Snilleblixten, Guldrushen):
//   cue(name) → bool   spela ett namngivet ljud ur CUES via grinden nedan
//   createSoundGate({ now? }) → { allow(name, { prio, dur, gap }) → bool, stats() }
//     • samma ljud inom sitt gap → slås ihop (spelas inte igen)
//     • ett starkare ljud låter → svagare hoppas över tills det är klart
//     • högst MAX_VOICES samtidiga; fullt → bara ett starkare ljud får plats
//   Allt är tyst om ljudet är av, inte upplåst (autoplay nekat) eller tystat –
//   inget fel, inget väntar. Ljud spelas bara här (projektorn/elevskärms-
//   fönstret), aldrig på elevdatorerna.
// ============================================================================

const KEY = "pp:live:ljud";

function readPref() {
  try {
    return localStorage.getItem(KEY) !== "av";
  } catch {
    return true;
  }
}

const MAX_VOICES = 2;

/** Ljudkönas grind (ren, testbar): ska `name` spelas nu? */
export function createSoundGate({ now = () => performance.now(), maxVoices = MAX_VOICES } = {}) {
  let voices = []; // { name, prio, end }
  const last = new Map(); // name → senaste start
  const counts = { played: 0, merged: 0, skipped: 0 };
  return {
    allow(name, { prio = 1, dur = 300, gap = Math.max(120, dur * 0.6) } = {}) {
      const t = now();
      voices = voices.filter((v) => v.end > t);
      if (t - (last.get(name) ?? -Infinity) < gap) { counts.merged++; return false; }
      if (voices.some((v) => v.prio > prio)) { counts.skipped++; return false; }
      if (voices.length >= maxVoices && !voices.some((v) => v.prio < prio)) { counts.skipped++; return false; }
      last.set(name, t);
      voices.push({ name, prio, end: t + dur });
      counts.played++;
      return true;
    },
    stats: () => ({ ...counts }),
  };
}

// Namngivna ljud för de nya lägena: prio (1 litet – 5 final), längd (ms) och tonerna.
// tone(f, start, längd, typ, volym, glid) – samma syntes som resten av Live.
export const CUES = {
  pling: { prio: 1, dur: 160, gap: 140, play: (t) => t(1568, 0, 0.14, "sine", 0.12, 2093) },
  bock: { prio: 1, dur: 120, gap: 150, play: (t) => t(1175, 0, 0.1, "triangle", 0.07) },
  ding: { prio: 3, dur: 700, play: (t) => { t(1319, 0, 0.6, "sine", 0.22); t(2637, 0, 0.35, "sine", 0.06); } },
  swoosh: { prio: 3, dur: 360, play: (t) => t(300, 0, 0.32, "sawtooth", 0.05, 1400) },
  blixt: { prio: 3, dur: 300, play: (t) => { t(2400, 0, 0.08, "square", 0.05, 600); t(180, 0.02, 0.25, "sawtooth", 0.08, 60); } },
  klirr: { prio: 2, dur: 300, play: (t) => [2637, 3136, 2349].forEach((f, i) => t(f, i * 0.06, 0.12, "triangle", 0.07)) },
  tassar: { prio: 2, dur: 500, play: (t) => [0, 0.12, 0.24, 0.36].forEach((a) => t(220, a, 0.06, "triangle", 0.08, 160)) },
  trumvirvel: { prio: 4, dur: 1200, play: (t) => { for (let i = 0; i < 18; i++) t(140 + (i % 2) * 12, i * 0.06, 0.05, "square", 0.025 + i * 0.002); } },
  // Snilleblixtens nedräkning (#559): tick sista 10 s, snabbare (två per sekund) sista 5 s.
  tick: { prio: 1, dur: 60, gap: 300, play: (t) => t(1046, 0, 0.045, "square", 0.035) },
  tickSnabb: { prio: 2, dur: 60, gap: 200, play: (t) => t(1397, 0, 0.05, "square", 0.045) },
  fanfar: { prio: 4, dur: 1300, play: (t) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => t(f, [0, 0.14, 0.28, 0.42, 0.62, 0.76][i], i === 5 ? 0.5 : 0.18, "triangle", 0.26)) },
};

export function createSound() {
  let on = readPref();
  let ctx = null;
  let master = null;
  let lastBlip = 0;
  let muted = false;
  const gate = createSoundGate();

  function ensure() {
    if (!on) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // Första gesten i sidan låser upp ljudet (autoplay-reglerna).
  const onGesture = () => { if (on) ensure(); };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);

  /** En ton: frekvens, start (s från nu), längd, typ, volym. */
  function tone(freq, at = 0, dur = 0.18, type = "sine", vol = 0.35, slideTo = null) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== "running") return;
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    get on() { return on; },
    unlocked: () => !on || ctx?.state === "running",
    unlock: () => { ensure(); },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? "pa" : "av"); } catch {}
      if (on) ensure();
      else ctx?.suspend().catch(() => {});
      return on;
    },
    setOn(v) {
      if (on === !!v) return;
      on = !!v;
      if (on) ensure();
      else ctx?.suspend().catch(() => {});
    },
    mute(m) { muted = !!m; },
    fx(fn) {
      if (muted) return;
      const c = ensure();
      if (!c || c.state !== "running") return;
      try { fn(c, master); } catch (e) { console.warn("Live-ljud:", e); }
    },
    /** 3 · 2 · 1 */
    tick(n) {
      tone(n === 1 ? 740 : 587, 0, 0.22, "triangle", 0.4);
    },
    /** KÖR! */
    go() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.45, "triangle", 0.32));
    },
    /** Diskret "poäng" – högst ett per 400 ms. */
    blip() {
      const now = performance.now();
      if (now - lastBlip < 400) return;
      lastBlip = now;
      tone(1320, 0, 0.09, "sine", 0.08, 1760);
    },
    /** Ny ledare. */
    lead() {
      tone(880, 0, 0.16, "sine", 0.16);
      tone(1175, 0.12, 0.24, "sine", 0.16);
    },
    /** Slutsignal. */
    end() {
      tone(392, 0, 0.9, "sawtooth", 0.12);
      tone(523, 0, 0.9, "square", 0.06);
    },
    /** Vinnarfanfar. */
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      const at = [0, 0.14, 0.28, 0.42, 0.62, 0.76];
      notes.forEach((f, i) => tone(f, at[i], i === notes.length - 1 ? 0.9 : 0.2, "triangle", 0.3));
    },
    /** Namngivet ljud via ljudkön (#571): slås ihop/hoppas över vid trängsel. */
    cue(name) {
      const c = CUES[name];
      if (!c || !on || muted || !ctx || ctx.state !== "running") return false;
      if (!gate.allow(name, c)) return false;
      c.play(tone);
      return true;
    },
    destroy() {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
