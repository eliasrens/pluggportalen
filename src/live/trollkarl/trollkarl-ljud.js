// ============================================================================
// Trollkarlsduellen (#540): LJUDEN (spec §12) – allt syntetiseras med Web Audio
// (inga ljudfiler). Modulen registrerar bara funktioner (registerSound) och
// skapar ALDRIG en egen AudioContext: scene.sound(namn) går via proj-sound.js
// fx(fn), som är helt tyst när ljudknappen är av, inte upplåst (autoplay-
// reglerna) eller tystad (elevskärmen spelar i stället). Ingen DOM vid import.
//
// Kaosskydd (§12 "flera ljud får inte orsaka kaotiskt överlapp"):
//   • per-ljud-spärr: samma namn spelas aldrig tätare än minGap (ms)
//   • globalt tak: max MAX_SAMTIDIGA starter per 300 ms – resten hoppas över
//   • gemensam buss med DynamicsCompressor + volymtak (MAX_VOL) per kontext
// Okända nycklar (t.ex. en ny attack i del D) faller tillbaka på det
// generiska glitterljudet "*" (trollkarl-register.getSound).
//
// API (utöver registreringarna): LJUD_NAMN – alla registrerade nycklar (test)
// ============================================================================

import { registerSound } from "./trollkarl-register.js";

export const MAX_VOL = 0.5; // tak per deltonsvolym, ovanpå proj-sounds master
const MAX_SAMTIDIGA = 6; // ljudstarter per 300 ms-fönster

const senast = new Map();
let fonster = { t: -1e9, n: 0 };
const bussar = new WeakMap();
const brusCache = new WeakMap();

const nu = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Gemensam buss per utgång: volymtak + kompressor (behaglig klassrumsvolym). */
function buss(ac, out) {
  let b = bussar.get(out);
  if (!b) {
    const g = ac.createGain();
    g.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 7;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    g.connect(comp);
    comp.connect(out);
    b = g;
    bussar.set(out, b);
  }
  return b;
}

/** En ton: frekvens, start (s efter t0), längd, våg, volym, ev. glid. */
function ton(ac, out, t0, { f = 440, at = 0, dur = 0.2, typ = "sine", vol = 0.22, glid = 0 } = {}) {
  const t = t0 + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = typ;
  osc.frequency.setValueAtTime(f, t);
  if (glid) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glid), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.min(vol, MAX_VOL), t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Filtrerat brus: typ = lowpass/highpass/bandpass, fc kan glida. */
function brus(ac, out, t0, { at = 0, dur = 0.3, vol = 0.18, filter = "lowpass", fc = 800, glid = 0, q = 1 } = {}) {
  let buf = brusCache.get(ac);
  if (!buf) {
    const n = Math.floor((ac.sampleRate || 44100) * 1);
    buf = ac.createBuffer(1, n, ac.sampleRate || 44100);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    brusCache.set(ac, buf);
  }
  const t = t0 + at;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const fl = ac.createBiquadFilter();
  fl.type = filter;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(fc, t);
  if (glid) fl.frequency.exponentialRampToValueAtTime(Math.max(30, glid), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.min(vol, MAX_VOL), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl);
  fl.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Litet glitter: n korta ljusa blippar utspridda över spann sekunder. */
function glitter(ac, out, t0, { n = 5, at = 0, spann = 0.5, vol = 0.07, bas = 1300 } = {}) {
  for (let i = 0; i < n; i++) {
    const f = bas + ((i * 977) % 900);
    ton(ac, out, t0, { f, at: at + (i / Math.max(1, n - 1)) * spann, dur: 0.1, typ: "sine", vol, glid: f * 1.4 });
  }
}

/** Registrering med per-ljud-spärr + globalt tak. */
function reg(name, fn, minGap = 130) {
  registerSound(name, (ac, out, t) => {
    const n = nu();
    if (n - (senast.get(name) ?? -1e9) < minGap) return;
    if (n - fonster.t > 300) fonster = { t: n, n: 0 };
    if (++fonster.n > MAX_SAMTIDIGA) return;
    senast.set(name, n);
    fn(ac, buss(ac, out), t);
  });
  LJUD_NAMN.push(name);
}

export const LJUD_NAMN = [];

// --- Mätare, uppladdning och klockan (§7, §13) -------------------------------

reg("uppladdning", (ac, o, t) => {
  ton(ac, o, t, { f: 220, dur: 0.55, typ: "sine", vol: 0.16, glid: 880 });
  glitter(ac, o, t, { n: 5, at: 0.08, spann: 0.45 });
}, 450);

reg("matare-full", (ac, o, t) => {
  ton(ac, o, t, { f: 1047, dur: 0.12, typ: "triangle", vol: 0.2 });
  ton(ac, o, t, { f: 1568, at: 0.1, dur: 0.22, typ: "triangle", vol: 0.2 });
}, 500);

reg("spanning", (ac, o, t) => {
  ton(ac, o, t, { f: 330, dur: 0.9, typ: "sine", vol: 0.1, glid: 392 });
  ton(ac, o, t, { f: 415, at: 0.1, dur: 0.8, typ: "sine", vol: 0.08 });
}, 2000);

reg("nedrakning", (ac, o, t) => {
  ton(ac, o, t, { f: 740, dur: 0.14, typ: "triangle", vol: 0.22 });
}, 450);

// --- Attackernas ljud (del C/D, §8/§12) --------------------------------------

const swisch = (ac, o, t) => brus(ac, o, t, { dur: 0.32, vol: 0.2, filter: "bandpass", fc: 500, glid: 3200, q: 1.6 });
reg("swisch", swisch);
reg("platshallare-swisch", swisch);

reg("poff", (ac, o, t) => {
  brus(ac, o, t, { dur: 0.3, vol: 0.24, fc: 1400, glid: 220 });
  ton(ac, o, t, { f: 170, dur: 0.22, typ: "sine", vol: 0.18, glid: 60 });
  glitter(ac, o, t, { n: 3, at: 0.1, spann: 0.2, vol: 0.05 });
});

reg("kvack", (ac, o, t) => {
  ton(ac, o, t, { f: 310, dur: 0.16, typ: "sawtooth", vol: 0.14, glid: 150 });
  ton(ac, o, t, { f: 620, dur: 0.1, typ: "square", vol: 0.04, glid: 300 });
}, 220);

reg("virvel", (ac, o, t) => {
  ton(ac, o, t, { f: 400, dur: 0.3, typ: "sine", vol: 0.12, glid: 1100 });
  ton(ac, o, t, { f: 1100, at: 0.3, dur: 0.3, typ: "sine", vol: 0.12, glid: 500 });
  brus(ac, o, t, { dur: 0.6, vol: 0.08, filter: "bandpass", fc: 900, glid: 2200, q: 2 });
});

reg("kackel", (ac, o, t) => {
  [620, 700, 560, 500].forEach((f, i) => ton(ac, o, t, { f, at: i * 0.09, dur: 0.07, typ: "square", vol: 0.07, glid: f * 0.8 }));
}, 320);

reg("suck", (ac, o, t) => {
  ton(ac, o, t, { f: 420, dur: 0.75, typ: "sine", vol: 0.1, glid: 190 });
});

reg("regn", (ac, o, t) => {
  brus(ac, o, t, { dur: 1.0, vol: 0.12, filter: "highpass", fc: 2500 });
  glitter(ac, o, t, { n: 6, at: 0.1, spann: 0.8, vol: 0.03, bas: 2400 });
}, 600);

reg("plask", (ac, o, t) => {
  brus(ac, o, t, { dur: 0.25, vol: 0.2, fc: 1600, glid: 300 });
  ton(ac, o, t, { f: 520, dur: 0.18, typ: "sine", vol: 0.1, glid: 140 });
});

reg("tornado", (ac, o, t) => {
  brus(ac, o, t, { dur: 1.3, vol: 0.16, fc: 300, glid: 1600, q: 0.8 });
  ton(ac, o, t, { f: 90, dur: 1.2, typ: "sawtooth", vol: 0.06, glid: 160 });
}, 700);

reg("nys", (ac, o, t) => {
  ton(ac, o, t, { f: 320, dur: 0.22, typ: "sawtooth", vol: 0.1, glid: 640 });
  brus(ac, o, t, { at: 0.24, dur: 0.28, vol: 0.22, fc: 2000, glid: 400 });
});

reg("stank", (ac, o, t) => {
  ton(ac, o, t, { f: 88, dur: 0.6, typ: "sawtooth", vol: 0.1, glid: 60 });
  ton(ac, o, t, { f: 93, dur: 0.6, typ: "sawtooth", vol: 0.08, glid: 64 });
  ton(ac, o, t, { f: 350, at: 0.1, dur: 0.4, typ: "triangle", vol: 0.06, glid: 190 });
});

reg("halk", (ac, o, t) => {
  ton(ac, o, t, { f: 1500, dur: 0.45, typ: "sine", vol: 0.16, glid: 300 });
});

reg("duns", (ac, o, t) => {
  ton(ac, o, t, { f: 130, dur: 0.28, typ: "sine", vol: 0.26, glid: 45 });
  brus(ac, o, t, { dur: 0.12, vol: 0.12, fc: 500, glid: 120 });
});

reg("splatt", (ac, o, t) => {
  brus(ac, o, t, { dur: 0.3, vol: 0.22, fc: 1100, glid: 180 });
  ton(ac, o, t, { f: 220, dur: 0.2, typ: "square", vol: 0.07, glid: 70 });
});

// Generisk reserv för nycklar som (ännu) saknar eget ljud – mjukt glitter.
reg("*", (ac, o, t) => {
  glitter(ac, o, t, { n: 4, spann: 0.3, vol: 0.06 });
}, 180);

// --- Finalen (§14) -----------------------------------------------------------

reg("final-mork", (ac, o, t) => {
  ton(ac, o, t, { f: 55, dur: 1.4, typ: "sine", vol: 0.22, glid: 50 });
  ton(ac, o, t, { f: 110, dur: 1.3, typ: "triangle", vol: 0.1, glid: 82 });
}, 900);

reg("final-laddning", (ac, o, t) => {
  ton(ac, o, t, { f: 110, dur: 2.2, typ: "sawtooth", vol: 0.1, glid: 1200 });
  ton(ac, o, t, { f: 220, dur: 2.2, typ: "sine", vol: 0.12, glid: 1760 });
  glitter(ac, o, t, { n: 10, at: 0.3, spann: 1.8, vol: 0.06 });
}, 1500);

reg("final-skott", (ac, o, t) => {
  brus(ac, o, t, { dur: 0.5, vol: 0.24, filter: "bandpass", fc: 600, glid: 3600, q: 1.4 });
  ton(ac, o, t, { f: 880, dur: 0.45, typ: "sawtooth", vol: 0.12, glid: 160 });
}, 600);

reg("final-explosion", (ac, o, t) => {
  brus(ac, o, t, { dur: 1.1, vol: 0.3, fc: 2400, glid: 150 });
  ton(ac, o, t, { f: 80, dur: 0.9, typ: "sine", vol: 0.26, glid: 32 });
  glitter(ac, o, t, { n: 8, at: 0.35, spann: 0.8, vol: 0.06 });
}, 900);

reg("forvandling", (ac, o, t) => {
  brus(ac, o, t, { dur: 0.35, vol: 0.2, fc: 1600, glid: 250 });
  ton(ac, o, t, { f: 900, dur: 0.4, typ: "triangle", vol: 0.12, glid: 220 });
  glitter(ac, o, t, { n: 5, at: 0.1, spann: 0.35, vol: 0.06 });
}, 400);

reg("segerfanfar", (ac, o, t) => {
  const mel = [[523, 0, 0.18], [659, 0.16, 0.18], [784, 0.32, 0.18], [1047, 0.48, 0.34], [784, 0.82, 0.16], [1047, 0.98, 0.8]];
  for (const [f, at, dur] of mel) {
    ton(ac, o, t, { f, at, dur, typ: "triangle", vol: 0.22 });
    ton(ac, o, t, { f: f / 2, at, dur, typ: "sine", vol: 0.1 });
  }
  glitter(ac, o, t, { n: 7, at: 1.0, spann: 0.9, vol: 0.05 });
}, 3000);

reg("jubel", (ac, o, t) => {
  for (let i = 0; i < 3; i++) {
    brus(ac, o, t, { at: i * 0.5, dur: 0.7, vol: 0.09, filter: "bandpass", fc: 1000 + i * 280, q: 0.7 });
  }
}, 1200);

reg("fyrverkeri", (ac, o, t) => {
  ton(ac, o, t, { f: 600, dur: 0.4, typ: "sine", vol: 0.08, glid: 1700 });
  for (let i = 0; i < 5; i++) brus(ac, o, t, { at: 0.42 + i * 0.07, dur: 0.07, vol: 0.12, filter: "highpass", fc: 2600 });
  glitter(ac, o, t, { n: 5, at: 0.5, spann: 0.4, vol: 0.06 });
}, 500);

reg("konfetti", (ac, o, t) => {
  glitter(ac, o, t, { n: 6, spann: 0.6, vol: 0.05, bas: 1600 });
}, 500);

reg("oavgjort-krock", (ac, o, t) => {
  ton(ac, o, t, { f: 494, dur: 0.5, typ: "sawtooth", vol: 0.12 });
  ton(ac, o, t, { f: 523, dur: 0.5, typ: "sawtooth", vol: 0.12 });
  brus(ac, o, t, { at: 0.4, dur: 0.6, vol: 0.24, fc: 2000, glid: 200 });
}, 900);

reg("skratt", (ac, o, t) => {
  [300, 260, 230, 300, 260, 230].forEach((f, i) =>
    ton(ac, o, t, { f, at: i * 0.13, dur: 0.1, typ: "triangle", vol: 0.1, glid: f * 0.85 }));
}, 1200);

reg("drake", (ac, o, t) => {
  ton(ac, o, t, { f: 95, dur: 0.9, typ: "sawtooth", vol: 0.16, glid: 55 });
  ton(ac, o, t, { f: 101, dur: 0.9, typ: "sawtooth", vol: 0.12, glid: 60 });
  brus(ac, o, t, { dur: 0.9, vol: 0.12, fc: 420, glid: 130 });
}, 900);

reg("grat", (ac, o, t) => {
  [500, 420, 350].forEach((f, i) => ton(ac, o, t, { f, at: i * 0.3, dur: 0.26, typ: "sine", vol: 0.1, glid: f * 0.78 }));
}, 900);
