// ============================================================================
// Trollkarlsduellen (#540): VERKTYG för finalsekvenserna (spec §14) – delade
// byggstenar ovanpå scenen och attack-verktygen. Ingen DOM vid import.
// Finalens f saknar speed (dur/a.wait-komprimering gäller bara attacker) men
// delar rng/signal – attack-verktygen tar f rakt av.
// ============================================================================

import { dur, spawn, anim, burst } from "../attacker/attack-verktyg.js";

/** Kort vit urladdningsblixt över hela arenan (barnvänlig, mjuk). */
export function blixt(scene, f, layer, ms = 500) {
  const el = document.createElement("div");
  el.className = "tkf-blixt";
  layer.appendChild(el);
  anim(el, [{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0 }],
    { duration: dur(scene, f, ms), easing: "ease-out" }).then(() => el.remove());
}

/** Roterande magiska cirklar kring en punkt (§14.2 steg 6). */
export function cirklar(scene, f, layer, p, { n = 3, size = 260, ms = 2400 } = {}) {
  for (let i = 0; i < n; i++) {
    const s = size * (0.55 + i * 0.35);
    const el = spawn(layer, "tkf-cirkel", p, s, "div");
    anim(el, [
      { transform: `rotate(${i * 50}deg) scale(.3)`, opacity: 0 },
      { transform: `rotate(${i * 50 + 120}deg) scale(1)`, opacity: 0.9, offset: 0.25 },
      { transform: `rotate(${i * 50 + (i % 2 ? -360 : 360)}deg) scale(1.05)`, opacity: 0.7, offset: 0.85 },
      { transform: `rotate(${i * 50 + (i % 2 ? -420 : 420)}deg) scale(1.3)`, opacity: 0 },
    ], { duration: dur(scene, f, ms), easing: "linear" }).then(() => el.remove());
  }
}

/** Den gigantiska energikulan: växer vid p under ms. Löser med elementet kvar. */
export async function energikula(scene, f, layer, p, { size = 240, ms = 2200 } = {}) {
  const el = spawn(layer, "tkf-kula", p, size, "div");
  cirklar(scene, f, layer, p, { size: size * 1.5, ms });
  const puls = setInterval(() => {
    if (!el.isConnected) return clearInterval(puls);
    burst(scene, f, layer, p, { count: 6, cls: "tk-stjarna", dist: size, ms: 700, rise: -30 });
  }, scene.reducedMotion ? 400 : 450);
  await anim(el, [
    { transform: "scale(.1)", opacity: 0.4 },
    { transform: "scale(.6)", opacity: 1, offset: 0.45 },
    { transform: "scale(1.06)", opacity: 1, offset: 0.9 },
    { transform: "scale(1)", opacity: 1 },
  ], { duration: dur(scene, f, ms), easing: "ease-out", fill: "forwards" });
  clearInterval(puls);
  return el;
}

/** Magiskt fyrverkeri: raketer som stiger och brister i gnist-/stjärnskurar. */
export function fyrverkeri(scene, f, layer, { n = 4, spannMs = 2600 } = {}) {
  const rng = f.rng || Math.random;
  const antal = scene.reducedMotion ? Math.min(2, n) : n;
  for (let i = 0; i < antal; i++) {
    const x = 240 + rng() * (scene.W - 480);
    const topp = 120 + rng() * 240;
    const t = setTimeout(() => {
      if (f.signal?.aborted) return;
      const r = spawn(layer, "tkf-raket", { x, y: scene.H - 120 }, 14);
      scene.sound("fyrverkeri");
      anim(r, [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${(rng() - 0.5) * 120}px,${topp - (scene.H - 120)}px)`, opacity: 0.9 },
      ], { duration: dur(scene, f, 650), easing: "ease-out" }).then(() => {
        r.remove();
        burst(scene, f, layer, { x, y: topp }, { count: 14, cls: i % 2 ? "tk-stjarna" : "tk-gnista", dist: 190, ms: 1000 });
      });
    }, (i / antal) * (scene.reducedMotion ? 600 : spannMs));
    f.signal?.addEventListener?.("abort", () => clearTimeout(t), { once: true });
  }
}

/** Konfettiregn över arenan under ca ms (§14.2 steg 11). */
export function konfettiRegn(scene, f, layer, { ms = 3200, count = 46 } = {}) {
  const rng = f.rng || Math.random;
  const antal = scene.reducedMotion ? Math.ceil(count / 4) : count;
  scene.sound("konfetti");
  for (let i = 0; i < antal; i++) {
    const el = spawn(layer, "tkf-konfetti", { x: rng() * scene.W, y: -30 }, 10 + rng() * 10);
    el.style.background = `hsl(${Math.floor(rng() * 360)} 85% 62%)`;
    anim(el, [
      { transform: "translate(0,-20px) rotate(0)", opacity: 1 },
      { transform: `translate(${(rng() - 0.5) * 220}px,${scene.H + 60}px) rotate(${(rng() - 0.5) * 900}deg)`, opacity: 0.9 },
    ], { duration: dur(scene, f, ms * (0.6 + rng() * 0.6)), delay: rng() * (scene.reducedMotion ? 100 : 900), easing: "ease-in" })
      .then(() => el.remove());
  }
}

/** Sotig trollkarl (krokig hatt-känsla via lätt lutning) – ligger kvar efteråt. */
export function sota(scene, f, wizard) {
  wizard?.el?.classList.add("tkf-sotig");
  scene.sound("forvandling");
}
