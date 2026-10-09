// ============================================================================
// Trollkarlsduellen (#537): posregister + körning.
// Varje pos är data: en lista steg {part, kf, dur, delay, easing, iter} som
// körs med Web Animations API på figurens delar (bara transform/opacity –
// kompositerbart, inga layoutläsningar). `exp`-steg byter ansiktsuttryck och
// `glow`-steg styr stavspetsens glöd vid en given tidpunkt.
// PRIO används av animationsprioriteringen (§11): final > attack/träff >
// uppladdning > idle.
// Registret är DOM-fritt så det kan enhetstestas i node.
// ============================================================================

export const PRIO = { finale: 4, attack: 3, charge: 2, idle: 1 };

const E_OUT = "cubic-bezier(.22,1,.36,1)";
const E_BACK = "cubic-bezier(.34,1.56,.64,1)";

const r = (deg) => `rotate(${deg}deg)`;
const t = (x, y) => `translate(${x}px,${y}px)`;
const tr = (x, y, deg) => `${t(x, y)} ${r(deg)}`;

// kf: lista av transformsträngar (jämnt fördelade) eller {offset,…}-objekt.
export const POSES = {
  charge: {
    prio: PRIO.charge, dur: 1200, keepGlow: true,
    steps: [
      { exp: "angry", at: 80 },
      { part: "fig", dur: 1200, kf: [t(0, 0), t(-6, 4), t(-6, 4), t(0, 0)], easing: E_OUT },
      { part: "armR", dur: 1100, kf: [r(0), r(-78), r(-72), r(-75)], easing: E_OUT },
      { part: "head", dur: 1100, kf: [r(0), r(-8), r(-6), r(-7)], easing: E_OUT },
      { glow: 1, at: 320 },
    ],
  },
  cast: {
    prio: PRIO.attack, dur: 950,
    steps: [
      { exp: "happy", at: 0 },
      { part: "armR", dur: 950, kf: [r(-75), r(-95), r(44), r(30)], easing: E_BACK },
      { part: "forearmR", dur: 950, kf: [r(0), r(-18), r(22), r(10)], easing: E_BACK },
      { part: "body", dur: 950, kf: [r(0), r(-7), r(9), r(5)], easing: E_OUT },
      { part: "fig", dur: 950, kf: [t(0, 0), t(-8, 0), t(14, 0), t(6, 0)], easing: E_OUT },
      { part: "cape", dur: 950, kf: [r(0), r(4), r(-7), r(-3)], easing: E_OUT },
      { glow: 1, at: 0 }, { glow: 0, at: 700 },
    ],
  },
  hit: {
    prio: PRIO.attack, dur: 850,
    steps: [
      { exp: "surprised", at: 0 }, { exp: "sad", at: 560 },
      { part: "fig", dur: 850, kf: [t(0, 0), t(-26, 0), t(-18, 0), t(0, 0)], easing: E_OUT },
      { part: "body", dur: 850, kf: [r(0), r(-14), r(-9), r(0)], easing: E_OUT },
      { part: "head", dur: 850, kf: [r(0), r(14), r(-10), r(5), r(0)] },
      { part: "hat", dur: 850, kf: [tr(0, 0, 0), tr(-4, -14, -14), tr(-2, -4, -8), tr(0, 0, 0)], easing: E_OUT },
      { part: "armL", dur: 850, kf: [r(0), r(-40), r(-20), r(0)], easing: E_OUT },
    ],
  },
  stagger: {
    prio: PRIO.attack, dur: 1500,
    steps: [
      { exp: "sad", at: 0 },
      { part: "fig", dur: 1500, kf: [t(0, 0), t(-16, 2), t(12, 0), t(-10, 2), t(6, 0), t(0, 0)] },
      { part: "body", dur: 1500, kf: [r(0), r(-8), r(7), r(-5), r(3), r(0)] },
      { part: "head", dur: 1500, kf: [r(0), r(10), r(-10), r(8), r(-6), r(0)] },
    ],
  },
  dizzy: {
    prio: PRIO.attack, dur: 1600,
    steps: [
      { exp: "surprised", at: 0 },
      { part: "head", dur: 1600, kf: [tr(0, 0, 0), tr(6, -3, 10), tr(0, -5, 0), tr(-6, -3, -10), tr(0, 0, 0), tr(5, -3, 8), tr(0, 0, 0)] },
      { part: "hat", dur: 1600, kf: [r(0), r(9), r(-9), r(7), r(-5), r(0)] },
      { part: "body", dur: 1600, kf: [r(0), r(3), r(-3), r(2), r(0)] },
    ],
  },
  fall: {
    prio: PRIO.attack, dur: 1000, stay: true,
    steps: [
      { exp: "surprised", at: 0 }, { exp: "sad", at: 760 },
      { part: "fig", dur: 1000, easing: E_OUT, fill: true,
        kf: [tr(0, 0, 0), tr(-10, -30, -30), tr(-30, 6, -74), tr(-26, 2, -80), tr(-30, 6, -80)] },
      { part: "hat", dur: 1000, fill: true, kf: [tr(0, 0, 0), tr(-14, -20, -30), tr(-30, -6, -46), tr(-28, -2, -44)], easing: E_OUT },
      { part: "armL", dur: 1000, fill: true, kf: [r(0), r(-70), r(-30), r(-36)], easing: E_OUT },
    ],
  },
  getUp: {
    prio: PRIO.attack, dur: 900,
    steps: [
      { exp: "neutral", at: 500 },
      { part: "fig", dur: 900, easing: E_BACK, kf: [tr(-30, 6, -80), tr(-20, -6, -40), tr(4, -10, 6), tr(0, 0, 0)] },
      { part: "hat", dur: 900, easing: E_BACK, kf: [tr(-28, -2, -44), tr(-10, -8, -16), tr(2, -2, 3), tr(0, 0, 0)] },
      { part: "armL", dur: 900, kf: [r(-36), r(-10), r(0)], easing: E_OUT },
    ],
  },
  jump: {
    prio: PRIO.attack, dur: 750,
    steps: [
      { exp: "surprised", at: 0 },
      { part: "fig", dur: 750, kf: [
        { o: 0, tf: "translate(0px,0px) scale(1,1)" },
        { o: 0.18, tf: "translate(0px,6px) scale(1.06,.92)" },
        { o: 0.5, tf: "translate(0px,-64px) scale(.96,1.06)" },
        { o: 0.85, tf: "translate(0px,2px) scale(1.05,.94)" },
        { o: 1, tf: "translate(0px,0px) scale(1,1)" }], easing: E_OUT },
      { part: "hat", dur: 750, kf: [t(0, 0), t(0, 2), t(0, -12), t(0, 2), t(0, 0)], easing: E_OUT },
      { part: "cape", dur: 750, kf: [r(0), r(2), r(-8), r(3), r(0)] },
    ],
  },
  spin: {
    prio: PRIO.attack, dur: 1000,
    steps: [
      { exp: "surprised", at: 0 },
      { part: "flip", dur: 1000, kf: ["scale(1,1)", "scale(-1,1)", "scale(1,1)", "scale(-1,1)", "scale(1,1)"], easing: "ease-in-out" },
      { part: "hat", dur: 1000, kf: [r(0), r(10), r(-10), r(10), r(0)] },
    ],
  },
  laugh: {
    prio: PRIO.charge, dur: 1100,
    steps: [
      { exp: "happy", at: 0, keep: true },
      { part: "head", dur: 1100, kf: [r(0), r(-12), r(-8), r(-13), r(-7), r(0)], easing: E_OUT },
      { part: "body", dur: 1100, kf: ["scale(1,1)", "scale(1.02,.97)", "scale(1,1)", "scale(1.02,.97)", "scale(1,1)"] },
      { part: "armL", dur: 1100, kf: [r(0), r(-22), r(-12), r(-22), r(0)] },
    ],
  },
  taunt: {
    prio: PRIO.charge, dur: 1100,
    steps: [
      { exp: "happy", at: 0 },
      { part: "body", dur: 1100, kf: [r(0), r(8), r(8), r(0)], easing: E_OUT },
      { part: "fig", dur: 1100, kf: [t(0, 0), t(12, 0), t(12, 0), t(0, 0)], easing: E_OUT },
      { part: "forearmR", dur: 1100, kf: [r(0), r(-30), r(10), r(-30), r(10), r(0)] },
      { part: "head", dur: 1100, kf: [r(0), r(6), r(6), r(0)] },
    ],
  },
  cheer: {
    prio: PRIO.charge, dur: 1400,
    steps: [
      { exp: "happy", at: 0, keep: true },
      { part: "armL", dur: 1400, kf: [r(0), r(-160), r(-150), r(-160), r(0)], easing: E_OUT },
      { part: "armR", dur: 1400, kf: [r(0), r(-66), r(-58), r(-66), r(0)], easing: E_OUT },
      { part: "forearmR", dur: 1400, kf: [r(0), r(-26), r(-20), r(-26), r(0)], easing: E_OUT },
      { part: "fig", dur: 1400, kf: [t(0, 0), t(0, -26), t(0, 0), t(0, -20), t(0, 0)], easing: E_OUT },
      { glow: 1, at: 150 }, { glow: 0, at: 1200 },
    ],
  },
  worried: {
    prio: PRIO.charge, dur: 1300,
    steps: [
      { exp: "sad", at: 0, keep: true },
      { part: "head", dur: 1300, kf: [t(0, 0), t(0, 8), t(-3, 8), t(3, 8), t(0, 0)], easing: E_OUT },
      { part: "body", dur: 1300, kf: ["scale(1,1)", "scale(.985,1)", "scale(.985,1)", "scale(1,1)"] },
      { part: "armL", dur: 1300, kf: [r(0), r(-14), r(-10), r(-14), r(0)] },
    ],
  },
  victory: {
    prio: PRIO.finale, dur: 2000,
    steps: [
      { exp: "happy", at: 0, keep: true },
      { glow: 1, at: 0 },
      { part: "fig", dur: 2000, easing: E_OUT, kf: [
        { o: 0, tf: "translate(0px,0px) scale(1,1)" },
        { o: 0.15, tf: "translate(0px,6px) scale(1.05,.93)" },
        { o: 0.35, tf: "translate(0px,-70px) scale(.97,1.05)" },
        { o: 0.55, tf: "translate(0px,0px) scale(1.03,.96)" },
        { o: 0.75, tf: "translate(0px,-34px) scale(1,1)" },
        { o: 1, tf: "translate(0px,0px) scale(1,1)" }] },
      { part: "armR", dur: 2000, kf: [r(0), r(-62), r(-54), r(-62), r(-58), r(0)], easing: E_OUT },
      { part: "forearmR", dur: 2000, kf: [r(0), r(-28), r(-22), r(-28), r(0)], easing: E_OUT },
      { part: "armL", dur: 2000, kf: [r(0), r(-150), r(-140), r(-150), r(0)], easing: E_OUT },
      { part: "hat", dur: 2000, kf: [tr(0, 0, 0), tr(0, -22, 12), tr(0, 0, 0), tr(0, -14, -8), tr(0, 0, 0)], easing: E_OUT },
      { glow: 0, at: 1800 },
    ],
  },
  defeat: {
    prio: PRIO.finale, dur: 1700, stay: true,
    steps: [
      { exp: "sad", at: 0, keep: true },
      { part: "fig", dur: 1700, easing: E_OUT, fill: true, kf: [t(0, 0), t(0, 10), t(0, 26), t(0, 26)] },
      { part: "body", dur: 1700, easing: E_OUT, fill: true, kf: [r(0), r(6), r(10), r(10)] },
      { part: "head", dur: 1700, easing: E_OUT, fill: true, kf: [tr(0, 0, 0), tr(0, 6, 10), tr(0, 12, 16), tr(0, 12, 16)] },
      { part: "hat", dur: 1700, easing: E_OUT, fill: true, kf: [tr(0, 0, 0), tr(0, 4, -8), tr(-4, 10, -20), tr(-4, 10, -20)] },
      { part: "armR", dur: 1700, fill: true, kf: [r(0), r(30), r(44), r(44)], easing: E_OUT },
      { part: "armL", dur: 1700, fill: true, kf: [r(0), r(14), r(22), r(22)], easing: E_OUT },
    ],
  },
  cry: {
    prio: PRIO.charge, dur: 1500,
    steps: [
      { exp: "sad", at: 0, keep: true },
      { part: "head", dur: 1500, kf: [tr(0, 0, 0), tr(0, 6, -6), tr(0, 4, 5), tr(0, 6, -6), tr(0, 0, 0)] },
      { part: "body", dur: 1500, kf: ["scale(1,1)", "scale(1.015,.975)", "scale(1,1)", "scale(1.015,.975)", "scale(1,1)", "scale(1.015,.975)", "scale(1,1)"] },
      { part: "armL", dur: 1500, kf: [r(0), r(-46), r(-40), r(-46), r(0)], easing: E_OUT },
    ],
  },
};

export const POSE_NAMES = Object.keys(POSES);

// Kör en pos på en delkarta {fig,flip,head,hat,body,cape,armL,armR,forearmR,wand}.
// api: { setExpression, setGlow, baseExpression() }. Returnerar { done, cancel }.
export function runPose(parts, api, name, opts = {}) {
  const pose = POSES[name];
  if (!pose) return { done: Promise.reject(new Error("okänd pos: " + name)), cancel() {} };
  const speed = opts.speed || 1;
  const anims = [];
  const timers = [];
  let keepExp = null;
  for (const s of pose.steps) {
    if (s.exp) {
      timers.push(setTimeout(() => api.setExpression(s.exp), (s.at || 0) / speed));
      if (s.keep) keepExp = s.exp;
      continue;
    }
    if (s.glow !== undefined) {
      timers.push(setTimeout(() => api.setGlow(s.glow), (s.at || 0) / speed));
      continue;
    }
    const el = parts[s.part];
    if (!el) continue;
    const kf = s.kf.map((k) =>
      typeof k === "string" ? { transform: k } : { offset: k.o, transform: k.tf });
    anims.push(el.animate(kf, {
      duration: s.dur / speed, delay: (s.delay || 0) / speed,
      easing: s.easing || "ease-in-out",
      fill: s.fill ? "forwards" : "none", composite: "replace",
    }));
  }
  let cancelled = false;
  const done = new Promise((resolve) => {
    timers.push(setTimeout(() => {
      if (cancelled) return;
      if (!pose.keepGlow) api.setGlow(0);
      api.setExpression(keepExp || api.baseExpression());
      if (!pose.stay) for (const a of anims) a.cancel();
      resolve();
    }, pose.dur / speed + 30));
  });
  return {
    done,
    cancel() {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
      for (const a of anims) a.cancel();
      api.setGlow(0);
    },
  };
}
