// ============================================================================
// Live-design (#571): AVATARREAKTIONER (designspec §4.3) – gemensamt set för
// de nya lägena. Bara transform och opacitet (Web Animations API): hela
// `avatar-figure` animeras, så kläderna alltid följer med. Inga fill:forwards
// på figuren – när en reaktion är klar (eller avbryts) står figuren exakt där
// vyn placerat den, så en reaktion kan aldrig lämna en avatar på fel plats.
// Reducerad rörelse: mjuka toningar i stället för hopp/skak, partiklarna
// tonar på plats. Allt utom pall-jubel är < 1 s.
//
//   ankomst  studsar in från kanten och landar med ett litet damm-moln
//   svarat   lyser upp + liten bock (tillstånd tills vyn tar bort det)
//   glad     liten studs
//   jubel    större hopp + stjärnor ({ big: true } = pallens längre jubel)
//   aj       skakning, några mynt rullar iväg
//   skyddad  lysande bubbla (tillstånd tills vyn tar bort det)
//   vantar   diskret andning/vickning (tillstånd, CSS – idle)
//
// API
//   REACTIONS
//   prefersReducedMotion() → bool
//   react(el, kind, { big?, signal?, reduced?, speed? }) → Promise (klar/avbruten)
//   setAvatarState(el, "svarat"|"skyddad"|"vantar", on)
//   el = elementet från live-avatar-pool (.lav)
// ============================================================================

export const REACTIONS = ["ankomst", "svarat", "glad", "jubel", "aj", "skyddad", "vantar"];
const STATES = new Set(["svarat", "skyddad", "vantar"]);

export function prefersReducedMotion() {
  try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export function setAvatarState(el, state, on) {
  if (el && STATES.has(state)) el.classList.toggle(state, !!on);
}

const EASE_OUT = "cubic-bezier(.2,.8,.3,1)";
// Partiklarnas font-size relativt figuren (måste stämma med .lav-p i CSS:en).
const P_FONT = 0.25;

// Figurens rörelser (transform-origin: fotpunkten, live-design.css).
const MOVES = {
  ankomst: { dur: 760, frames: [
    { transform: "translate(-150%, -60%) rotate(-14deg)", opacity: 0 },
    { offset: 0.15, opacity: 1 },
    { offset: 0.55, transform: "translate(0, -14%) rotate(5deg)" },
    { offset: 0.72, transform: "translate(0, 0) scale(1.1, .88)" },
    { offset: 0.86, transform: "translate(0, -4%) scale(.97, 1.04)" },
    { transform: "none", opacity: 1 },
  ] },
  svarat: { dur: 380, frames: [
    { transform: "none" }, { offset: 0.4, transform: "translateY(-6%) scale(1.06)" }, { transform: "none" },
  ] },
  glad: { dur: 560, frames: [
    { transform: "none" },
    { offset: 0.2, transform: "scale(1.06, .92)" },
    { offset: 0.5, transform: "translateY(-18%) scale(.95, 1.07)" },
    { offset: 0.78, transform: "scale(1.05, .95)" },
    { transform: "none" },
  ] },
  jubel: { dur: 900, frames: [
    { transform: "none" },
    { offset: 0.15, transform: "scale(1.1, .86)" },
    { offset: 0.45, transform: "translateY(-34%) rotate(-7deg) scale(.95, 1.08)" },
    { offset: 0.6, transform: "translateY(-30%) rotate(7deg)" },
    { offset: 0.82, transform: "scale(1.08, .9)" },
    { transform: "none" },
  ] },
  aj: { dur: 460, frames: [
    { transform: "none" },
    { offset: 0.15, transform: "translateX(-7%) rotate(-5deg)" },
    { offset: 0.35, transform: "translateX(7%) rotate(5deg)" },
    { offset: 0.55, transform: "translateX(-5%) rotate(-3deg)" },
    { offset: 0.75, transform: "translateX(3%) rotate(2deg)" },
    { transform: "none" },
  ] },
  skyddad: { dur: 420, frames: [
    { transform: "none" }, { offset: 0.35, transform: "scale(.94, 1.04)" }, { transform: "none" },
  ] },
};

// Pallens jubel: två hopp (längre än 1 s, enda undantaget i §4.3).
const JUBEL_STOR = { dur: 1700, frames: [
  { transform: "none" },
  { offset: 0.1, transform: "scale(1.1, .86)" },
  { offset: 0.25, transform: "translateY(-36%) rotate(-8deg) scale(.95, 1.08)" },
  { offset: 0.42, transform: "scale(1.08, .9)" },
  { offset: 0.6, transform: "translateY(-40%) rotate(8deg) scale(.95, 1.08)" },
  { offset: 0.8, transform: "scale(1.08, .9)" },
  { transform: "none" },
] };

// Partiklar per reaktion: [tecken, antal, klass]. Få – §11 "begränsa partiklar".
const PARTS = {
  ankomst: ["", 4, "lav-p-damm"],
  jubel: ["★", 5, "lav-p-stjarna"],
  aj: ["", 3, "lav-p-mynt"],
};

function particles(fx, kind, { big, reduced, delay, dur }) {
  const spec = PARTS[kind];
  if (!fx || !spec) return [];
  const [ch, base, cls] = spec;
  const n = big ? base + 3 : base;
  const anims = [];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = `lav-p ${cls}`;
    p.textContent = ch;
    fx.appendChild(p);
    const t = (i + 0.5) / n;
    let frames;
    // Förflyttning i figurbredder (em på .lav) – partikelns egen font-size är
    // P_FONT av figurens (live-design.css .lav-p), därav omräkningen.
    const fe = (v) => `${(v / P_FONT).toFixed(2)}em`;
    if (reduced) frames = [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }];
    else if (kind === "ankomst") {
      const dx = (t - 0.5) * 1.1;
      frames = [{ transform: "translate(-50%, 0) scale(.4)", opacity: 0.9 }, { transform: `translate(calc(-50% + ${fe(dx)}), ${fe(-0.2)}) scale(1.3)`, opacity: 0 }];
    } else if (kind === "jubel") {
      const ang = (t * 160 + 190) * (Math.PI / 180); // solfjäder uppåt
      const r = big ? 0.85 : 0.65;
      frames = [{ transform: "translate(-50%, -50%) scale(.3)", opacity: 0 }, { offset: 0.2, opacity: 1 },
        { transform: `translate(calc(-50% + ${fe(Math.cos(ang) * r)}), calc(-50% + ${fe(Math.sin(ang) * r)})) scale(1.4) rotate(${(i % 2 ? 1 : -1) * 90}deg)`, opacity: 0 }];
    } else { // aj: mynten rullar iväg åt sidorna
      const dir = i % 2 ? 1 : -1;
      frames = [{ transform: "translate(-50%, 0) rotate(0)", opacity: 1 },
        { offset: 0.35, transform: `translate(calc(-50% + ${fe(dir * 0.2)}), ${fe(-0.3)}) rotate(${dir * 120}deg)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${fe(dir * (0.6 + i * 0.15))}), ${fe(0.05)}) rotate(${dir * 360}deg)`, opacity: 0 }];
    }
    const a = p.animate(frames, { duration: dur * (reduced ? 1 : 0.9 + t * 0.2), delay, easing: EASE_OUT, fill: "backwards" });
    a.finished.catch(() => {}).finally(() => p.remove());
    anims.push(a);
  }
  return anims;
}

/**
 * Spela en reaktion på en avatar. Ersätter en pågående reaktion på samma
 * avatar. Löses när den är klar eller avbruten (signal) – aldrig ett fel.
 */
export function react(el, kind, { big = false, signal, reduced = prefersReducedMotion(), speed = 1 } = {}) {
  if (!el || !REACTIONS.includes(kind)) return Promise.resolve();
  if (kind === "vantar") { setAvatarState(el, "vantar", true); return Promise.resolve(); }
  if (kind === "svarat" || kind === "skyddad") setAvatarState(el, kind, true);
  const fig = el.querySelector(".avatar-figure");
  if (!fig || typeof fig.animate !== "function") return Promise.resolve();
  el._lavAnims?.forEach((a) => a.cancel());
  const move = kind === "jubel" && big ? JUBEL_STOR : MOVES[kind];
  const dur = move.dur / Math.max(0.5, speed);
  const anims = [];
  if (reduced) {
    // Mjuk toning på plats – ingen förflyttning, ingen skakning.
    const frames = kind === "ankomst" ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }];
    anims.push(fig.animate(frames, { duration: Math.min(dur, 600), easing: "ease-in-out" }));
  } else {
    anims.push(fig.animate(move.frames, { duration: dur, easing: "ease-out" }));
  }
  if (kind === "svarat") {
    const glow = el.querySelector(".lav-glow");
    if (glow) anims.push(glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.55 }], { duration: dur * 1.4, easing: "ease-out" }));
  }
  const pDelay = kind === "ankomst" && !reduced ? dur * 0.68 : kind === "jubel" ? dur * 0.3 : 0;
  anims.push(...particles(el.querySelector(".lav-fx"), kind, { big, reduced, delay: pDelay, dur: Math.min(900, dur) }));
  el._lavAnims = anims;
  const stop = () => anims.forEach((a) => a.cancel());
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  return Promise.allSettled(anims.map((a) => a.finished)).then(() => {
    signal?.removeEventListener("abort", stop);
    if (el._lavAnims === anims) el._lavAnims = null;
  });
}
