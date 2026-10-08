// ============================================================================
// Trollkarlsduellen (#536): PLATSHÅLLAR-ATTACK och PLATSHÅLLAR-FINALER – så att
// hela flödet (mätare full → kö → attack → återställning, matchslut → final →
// resultatskärm) går att testa innan del C (attacker) och E (final) landat.
// Markerade placeholder: true → används bara tills riktiga är registrerade.
// Fungerar också som exempel på kontraktet (scene + a/f, se arkitekturnotisen).
// ============================================================================

import { registerAttack, registerFinale } from "./trollkarl-register.js";

/** En lysande kula från p0 till p1 i lagret, WAAPI. */
function orb(scene, layer, p0, p1, { size = 46, ms = 700, cls = "" } = {}) {
  const o = document.createElement("i");
  o.className = `tk-orb ${cls}`;
  o.style.cssText = `left:${p0.x - size / 2}px;top:${p0.y - size / 2}px;width:${size}px;height:${size}px`;
  layer.appendChild(o);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const a = o.animate([
    { transform: "translate(0,0) scale(.4)", opacity: 0.6 },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 90}px) scale(1)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) scale(.8)`, opacity: 1 },
  ], { duration: scene.reducedMotion ? 200 : ms, easing: "ease-in", fill: "forwards" });
  return a.finished.catch(() => {}).then(() => o);
}

function poof(layer, p, { size = 160, text = "POFF!" } = {}) {
  const b = document.createElement("div");
  b.className = "tk-poof";
  b.style.cssText = `left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px`;
  b.innerHTML = `<span>${text}</span>`;
  layer.appendChild(b);
  return b;
}

registerAttack({
  id: "platshallare",
  name: "MAGIUS PLATSUS!",
  durationMs: 3800,
  placeholder: true,
  async run(scene, a) {
    const layer = scene.layer();
    const { from, to, signal } = a;
    scene.state(from.side, "CASTING");
    from.wizard.setExpression("angry");
    const cast = from.wizard.play("cast");
    scene.state(to.side, "ANTICIPATING_HIT");
    to.wizard.setExpression("surprised");
    scene.sound("platshallare-swisch");
    const o = await orb(scene, layer, scene.point(from.wizard, "wandTip"), scene.point(to.wizard, "body"));
    await cast;
    if (signal.aborted) return;
    o.remove();
    poof(layer, scene.point(to.wizard, "body"));
    scene.state(to.side, "HIT");
    to.wizard.setExpression("sad");
    from.wizard.setExpression("happy");
    await to.wizard.play("hit");
    await scene.wait(500, signal);
    scene.state(to.side, "RECOVERING");
    from.wizard.play("laugh");
    await to.wizard.play("stagger");
  },
});

registerFinale({
  id: "platshallare-vinst",
  kind: "win",
  placeholder: true,
  async run(scene, f) {
    const layer = scene.layer();
    const { winner, loser, signal } = f;
    scene.state(winner.side, "CASTING");
    winner.wizard.setExpression("happy");
    loser.wizard.setExpression("surprised");
    loser.wizard.play("worried");
    await winner.wizard.play("charge");
    const top = scene.point(winner.wizard, "wandTip");
    const big = await orb(scene, layer, top, { x: top.x, y: top.y - 60 }, { size: 120, ms: 900, cls: "tk-orb-big" });
    if (signal.aborted) return;
    winner.wizard.play("cast");
    big.remove();
    await orb(scene, layer, { x: top.x, y: top.y - 60 }, scene.point(loser.wizard, "body"), { size: 120, ms: 800, cls: "tk-orb-big" })
      .then((o) => o.remove());
    poof(layer, scene.point(loser.wizard, "body"), { size: 320, text: "KABOOM!" });
    scene.state(loser.side, "DEFEAT");
    loser.wizard.setExpression("sad");
    loser.wizard.play("defeat");
    await scene.wait(700, signal);
    scene.state(winner.side, "VICTORY");
    await winner.wizard.play("victory");
  },
});

registerFinale({
  id: "platshallare-oavgjort",
  kind: "draw",
  placeholder: true,
  async run(scene, f) {
    const layer = scene.layer();
    const [l, r] = f.sides;
    l.wizard.play("charge");
    await r.wizard.play("charge");
    l.wizard.play("cast");
    r.wizard.play("cast");
    const mid = { x: scene.W / 2, y: 430 };
    await Promise.all([
      orb(scene, layer, scene.point(l.wizard, "wandTip"), mid, { size: 70 }),
      orb(scene, layer, scene.point(r.wizard, "wandTip"), mid, { size: 70 }),
    ]).then((os) => os.forEach((o) => o.remove()));
    if (f.signal.aborted) return;
    poof(layer, mid, { size: 360, text: "POFF!" });
    for (const s of f.sides) { s.wizard.setExpression("surprised"); s.wizard.play("dizzy"); }
    await scene.wait(1700, f.signal);
    for (const s of f.sides) { s.wizard.setExpression("happy"); s.wizard.play("laugh"); }
  },
});
