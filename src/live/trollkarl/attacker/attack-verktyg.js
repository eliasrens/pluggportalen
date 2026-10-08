// ============================================================================
// Trollkarlsduellen (#538): VERKTYGSLÅDAN för attacker (del C/D).
// Små byggstenar ovanpå scenen: projektiler, POOF-moln, partikelskurar och
// WAAPI-hjälpare. Allt i designrummet 1600 × 900, bara transform/opacity
// (kompositerbart, §17). Partiklar har ett globalt tak (PARTIKEL_TAK) och
// reducedMotion ger färre partiklar + korta tider. Ingen DOM vid import –
// filen kan enhetstestas i node.
//
// Tempo: a.speed ≥ 1 sätts av kön vid burst (trollkarl-regi.rushFor) –
// använd dur(scene, a, ms) för alla tider och a.wait(ms) för pauser, så
// komprimeras attacken automatiskt när kön är lång.
// ============================================================================

export const PARTIKEL_TAK = 120;
let levande = 0;

/** Skalad tid: kö-tempo (a.speed) + reducerad rörelse. */
export function dur(scene, a, ms) {
  const v = ms / (a?.speed || 1);
  return scene?.reducedMotion ? Math.min(v, 250) : v;
}

/** Positionerat element (centrerat på p) i ett attacklager. */
export function spawn(layer, cls, p, size = 40, tag = "i") {
  const el = document.createElement(tag);
  el.className = cls;
  el.style.cssText = `left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px`;
  layer.appendChild(el);
  return el;
}

/** WAAPI-körning → Promise (svalt avbrott: cancel ger aldrig rejection vidare). */
export function anim(el, kf, opts) {
  return el.animate(kf, opts).finished.catch(() => {});
}

/**
 * Projektil p0 → p1 med valfri båge (arc px uppåt) och rotation.
 * Löser vid nedslaget och tar själv bort elementet om keep inte satts.
 */
export async function fly(scene, a, layer, p0, p1, { cls = "tk-orb", size = 46, ms = 700, arc = 90, spin = 0, keep = false } = {}) {
  const el = spawn(layer, cls, p0, size);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const rot = (k) => (spin ? ` rotate(${spin * k}deg)` : "");
  await anim(el, [
    { transform: `translate(0,0) scale(.5)${rot(0)}`, opacity: 0.7 },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - arc}px) scale(1)${rot(0.5)}`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) scale(.9)${rot(1)}`, opacity: 1 },
  ], { duration: dur(scene, a, ms), easing: arc ? "ease-in" : "linear", fill: "forwards" });
  if (!keep) el.remove();
  return el;
}

/** POOF – magiskt moln med ring + text, städar sig självt. */
export function poff(scene, a, layer, p, { size = 150, text = "POFF!", cls = "" } = {}) {
  const el = spawn(layer, `tk-poff ${cls}`, p, size, "div");
  el.innerHTML = `<span>${text}</span>`;
  anim(el, [
    { transform: "scale(.3)", opacity: 0 },
    { transform: "scale(1.06)", opacity: 1, offset: 0.25 },
    { transform: "scale(1)", opacity: 1, offset: 0.7 },
    { transform: "scale(1.15)", opacity: 0 },
  ], { duration: dur(scene, a, 900), easing: "ease-out" }).then(() => el.remove());
  burst(scene, a, layer, p, { count: 10, cls: "tk-gnista", dist: size * 0.9 });
}

/**
 * Partikelskur ut från p. count klipps mot det globala taket och halveras
 * vid reducedMotion. rise < 0 = stiger, > 0 = faller (gravitationskänsla).
 */
export function burst(scene, a, layer, p, { count = 12, cls = "tk-gnista", size = 14, dist = 120, ms = 800, rise = 0, spin = 180 } = {}) {
  let n = Math.min(scene?.reducedMotion ? Math.ceil(count / 3) : count, PARTIKEL_TAK - levande);
  const rng = a?.rng || Math.random;
  for (let i = 0; i < n; i++) {
    const el = spawn(layer, cls, p, size * (0.6 + rng() * 0.8));
    levande++;
    const v = (i / Math.max(1, count)) * Math.PI * 2 + rng() * 0.9;
    const d = dist * (0.5 + rng() * 0.6);
    anim(el, [
      { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${Math.cos(v) * d}px,${Math.sin(v) * d * 0.7 + rise}px) scale(.3) rotate(${(rng() - 0.5) * 2 * spin}deg)`, opacity: 0 },
    ], { duration: dur(scene, a, ms * (0.7 + rng() * 0.6)), easing: "cubic-bezier(.17,.67,.4,1)" })
      .then(() => { el.remove(); levande--; });
  }
}

/** Antal levande partiklar (för test/felsökning). */
export function partiklar() {
  return levande;
}

/** Standardupptakt (§8.1–2): kastaren svingar staven, offret anar oråd.
 *  Returnerar kast-posens promise (väntas in av den som vill). */
export function upptakt(scene, a) {
  scene.state(a.from.side, "CASTING");
  scene.state(a.to.side, "ANTICIPATING_HIT");
  a.to.wizard.setExpression("surprised");
  return a.from.wizard.play("cast");
}

/** Gör figurens förvandlings-overlay animerbar kring fötterna (viewBox 400×560). */
export function riggaOverlay(g, origin = "200px 540px") {
  g.style.transformBox = "view-box";
  g.style.transformOrigin = origin;
  return g;
}
