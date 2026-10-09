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
//   createSound()  → { on, unlocked(), toggle() → on, unlock(), setOn(on), mute(m), fx(fn),
//                      tick(n), go(), blip(), lead(), end(), win(), destroy() }
//   setOn(on)  elevskärmen (#533) följer kontrollpanelens val (sparar inget)
//   mute(m)    kontrollpanelen tystnar medan en elevskärm spelar ljudet (#533)
//   fx(fn)     egna ljud (Trollkarlsduellen, #536): fn(audioCtx, ut) bara när ljudet
//              är på, upplåst och inte tystat – samma kontext och volym som resten
// ============================================================================

const KEY = "pp:live:ljud";

function readPref() {
  try {
    return localStorage.getItem(KEY) !== "av";
  } catch {
    return true;
  }
}

export function createSound() {
  let on = readPref();
  let ctx = null;
  let master = null;
  let lastBlip = 0;
  let muted = false;

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
    destroy() {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
