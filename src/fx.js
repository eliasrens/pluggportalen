// ============================================================================
// Pluggportalen – effekter (fx.js)
// Glada belöningseffekter som gamemodes delar: konfetti och enkla ljudeffekter.
// Inga externa assets: konfetti är små DOM-element, ljud görs med Web Audio.
// Ljudet går att stänga av (mute), och valet sparas i localStorage.
// ============================================================================

// --- Konfetti ---------------------------------------------------------------

const CONFETTI_COLORS = [
  "#2f80ed", "#27ae60", "#f2c94c", "#f2994a", "#eb5757", "#9b51e0", "#ff6b9d",
];

/**
 * Sprutar glad konfetti över hela skärmen. Rensar upp sig själv.
 * @param {number} count antal konfettibitar
 */
export function confetti(count = 90) {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    bit.className = "confetti-bit";
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    bit.style.background = color;
    bit.style.left = Math.random() * 100 + "vw";
    bit.style.animationDelay = Math.random() * 0.5 + "s";
    bit.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    if (i % 3 === 0) bit.style.borderRadius = "50%";
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

// --- Ljud (Web Audio) -------------------------------------------------------

const MUTE_KEY = "pluggportalen.muted";

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    _ctx = null;
  }
  return _ctx;
}

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

export function toggleMuted() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/** Spela en enkel ton. freqs kan vara ett tal eller en sekvens (arpeggio). */
function tone(freqs, { type = "sine", dur = 0.14, gain = 0.14, gap = 0.09 } = {}) {
  if (isMuted()) return;
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const seq = Array.isArray(freqs) ? freqs : [freqs];
  let t = ac.currentTime;
  for (const f of seq) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += gap;
  }
}

export const sound = {
  correct() {
    tone([660, 880], { type: "triangle", dur: 0.13, gain: 0.13 });
  },
  wrong() {
    tone([200, 150], { type: "sawtooth", dur: 0.16, gain: 0.09 });
  },
  // Stigande pling som följer comboläget (högre combo = ljusare ton).
  combo(level = 1) {
    const base = 520 + Math.min(level, 8) * 70;
    tone([base, base * 1.25], { type: "square", dur: 0.1, gain: 0.11 });
  },
  tick() {
    tone(440, { type: "sine", dur: 0.05, gain: 0.05 });
  },
  finish() {
    tone([523, 659, 784, 1047], { type: "triangle", dur: 0.2, gain: 0.14, gap: 0.12 });
  },
  click() {
    tone(520, { type: "sine", dur: 0.06, gain: 0.06 });
  },
};
