// ============================================================================
// Kurragömma 🙈 – projektorns LJUD (#839, spec §8): korta, mjuka ljud via
// skalets proj-sound.js (samma AudioContext, ljud av/på, elevskärmens tystnad).
//   vissling(p)   RIKTAD: StereoPannerNode efter var platsen syns i bilden
//                 (vänster/höger) och svagare ju längre från bildens mitt – en
//                 glad, kort vissling (två toner som glider uppåt), inte gäll.
//   hittad()      mjukt pling.     gomSlut()  lugnt ljud när gömfasen slutar.
//   nySokare()    två toner.        final()   skalets fanfar via ljudkön.
// Ducking (§0.2 "bara när effekten hörs"): music.duck(...) anropas bara när
// fx faktiskt körde (ljud på, upplåst, inte tystat). Varje sort högst en gång
// per GAP_MS så täta händelser blir ett sorl, inte en kakofoni.
// Inget ljud på elevdatorerna – den här modulen laddas bara av projektorvyn.
//
//   createKgLjud(sound, music?) → { vissling(skarm), hittad(), gomSlut(), nySokare(), final(), destroy() }
//     skarm = scen.skarm(p): { sx, w, inne, framfor? } → pan −1..1 och volym 0,35–1
//   visslingPan(skarm) → { pan, vol } (ren, testad)
// ============================================================================

const GAP_MS = { vissling: 350, hittad: 250, gomSlut: 3000, nySokare: 1200, final: 5000 };

/** Riktning och styrka ur var platsen syns (ren). Utanför bilden: ut mot kanten, svagare. */
export function visslingPan(skarm) {
  const w = Number(skarm?.w) || 0;
  if (!w || !Number.isFinite(skarm?.sx)) return { pan: 0, vol: 0.7 };
  let rel = (skarm.sx / w) * 2 - 1; // −1 vänster … 1 höger
  if (skarm.framfor === false) rel = -rel;
  const pan = Math.max(-1, Math.min(1, rel));
  const bort = Math.min(1, Math.abs(rel)); // 0 i mitten, 1 i kanten (eller utanför)
  const vol = (skarm.inne ? 1 : 0.6) * (1 - 0.45 * bort);
  return { pan, vol: Math.max(0.35, Math.min(1, vol)) };
}

/** En ton genom en panner: f0 → f1 (Hz), start (s), längd (s), volym. */
function ton(ctx, ut, { f0, f1, at, dur, vol, typ = "sine" }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = typ;
  osc.frequency.setValueAtTime(f0, t);
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ut);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function createKgLjud(sound, music = null) {
  const sist = new Map();
  const far = (namn) => {
    const nu = performance.now();
    if (nu - (sist.get(namn) ?? -Infinity) < GAP_MS[namn]) return false;
    sist.set(namn, nu);
    return true;
  };
  /** Kör fn(ctx, ut) via skalet; sant bara om ljudet faktiskt hördes → ducking. */
  const spela = (namn, fn, duck = null) => {
    if (!sound || !far(namn)) return false;
    let hordes = false;
    sound.fx((ctx, ut) => { hordes = true; fn(ctx, ut); });
    if (hordes && duck) music?.duck?.(duck);
    return hordes;
  };
  return {
    vissling(skarm) {
      const { pan, vol } = visslingPan(skarm);
      return spela("vissling", (ctx, master) => {
        let ut = master;
        if (typeof ctx.createStereoPanner === "function") {
          const p = ctx.createStereoPanner();
          p.pan.value = pan;
          p.connect(master);
          ut = p;
        }
        ton(ctx, ut, { f0: 880, f1: 1480, at: 0, dur: 0.16, vol: 0.16 * vol, typ: "sine" });
        ton(ctx, ut, { f0: 1175, f1: 1760, at: 0.17, dur: 0.22, vol: 0.14 * vol, typ: "sine" });
      }, "swoosh");
    },
    hittad: () => spela("hittad", (ctx, ut) => {
      ton(ctx, ut, { f0: 1319, f1: null, at: 0, dur: 0.18, vol: 0.12, typ: "sine" });
      ton(ctx, ut, { f0: 1760, f1: null, at: 0.1, dur: 0.3, vol: 0.09, typ: "sine" });
    }, "ding"),
    gomSlut: () => spela("gomSlut", (ctx, ut) => {
      [392, 494, 587].forEach((f, i) => ton(ctx, ut, { f0: f, f1: null, at: i * 0.22, dur: 0.6, vol: 0.09, typ: "triangle" }));
    }, "ding"),
    nySokare: () => spela("nySokare", (ctx, ut) => {
      ton(ctx, ut, { f0: 659, f1: null, at: 0, dur: 0.14, vol: 0.1, typ: "triangle" });
      ton(ctx, ut, { f0: 988, f1: null, at: 0.14, dur: 0.24, vol: 0.1, typ: "triangle" });
    }),
    final() { if (far("final")) sound?.cue?.("fanfar"); },
    destroy() { sist.clear(); },
  };
}
