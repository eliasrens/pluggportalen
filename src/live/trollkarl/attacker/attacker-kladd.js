// ============================================================================
// Trollkarlsduellen (#538): KLADDATTACKERNA 5–7 (§8) – STINKUS MAXIMUS!
// (stinkbomb), BANANUS HALKUS! (bananskal, offret halkar med fall/getUp-
// poserna) och SLEMMUS BLÄÄÄUS! (slemboll, SPLATT). Ren slapstick – allt
// ofarligt och barnvänligt, fullständig återställning efteråt.
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { dur, anim, spawn, fly, poff, burst, upptakt } from "./attack-verktyg.js";

registerAttack({
  id: "stinkus-maximus",
  name: "STINKUS MAXIMUS!",
  durationMs: 7200,
  sounds: ["swisch", "stank"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    const mark = scene.point(to.wizard, "feet");
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), { x: mark.x, y: mark.y - 30 },
      { cls: "tk-bomb", size: 58, ms: 900, arc: 190, spin: 300 });
    await cast;
    if (signal.aborted) return;
    scene.sound("stank");
    poff(scene, a, layer, { x: mark.x, y: mark.y - 60 }, { size: 170, text: "PFFT!", cls: "tk-stank-poff" });
    scene.state(to.side, "HIT");
    to.wizard.play("hit");
    // Tre gröna moln bubblar upp runt offret och driver sakta bort.
    for (const [dx, dy, s] of [[-70, -40, 150], [60, -90, 180], [-10, -170, 140]]) {
      const m = spawn(layer, "tk-stankmoln", { x: mark.x + dx, y: mark.y + dy }, s, "div");
      anim(m, [
        { transform: "scale(.3)", opacity: 0 },
        { transform: "scale(1)", opacity: 0.9, offset: 0.25 },
        { transform: `translate(${dx / 2}px,-90px) scale(1.25)`, opacity: 0 },
      ], { duration: dur(scene, a, 2700), easing: "ease-out" }).then(() => m.remove());
    }
    await a.wait(500);
    if (signal.aborted) return;
    // Offret håller för näsan, viftar undan luften och vinglar.
    to.wizard.setExpression("sad");
    await to.wizard.play("worried");
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await to.wizard.play("stagger");
  },
});

registerAttack({
  id: "bananus-halkus",
  name: "BANANUS HALKUS!",
  durationMs: 7600,
  sounds: ["poff", "halk", "duns"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    // Ett magiskt bananskal POFFar fram på golvet framför offret.
    const mitten = to.side === "left" ? 1 : -1; // riktning in mot arenans mitt
    const fotter = scene.point(to.wizard, "feet");
    const plats = { x: fotter.x + mitten * 120, y: fotter.y - 6 };
    scene.sound("poff");
    poff(scene, a, layer, plats, { size: 90 });
    const banan = spawn(layer, "tk-banan", plats, 74, "div");
    banan.innerHTML = `<svg viewBox="0 0 74 74"><path d="M8 50 Q20 28 37 26 Q54 28 66 50 Q52 44 37 44 Q22 44 8 50Z" fill="#f5d442" stroke="#b98f12" stroke-width="3"/><path d="M30 28 Q37 20 44 28 L40 34 Q37 31 34 34Z" fill="#b98f12"/></svg>`;
    await anim(banan, [{ transform: "scale(0)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
      { duration: dur(scene, a, 350), easing: "ease-out", fill: "forwards" });
    await a.wait(420);
    if (signal.aborted) return;
    // Några ofrivilliga steg … och HALK! Benen i luften, komisk landning.
    to.wizard.setExpression("surprised");
    await to.wizard.play("stagger");
    if (signal.aborted) return;
    scene.sound("halk");
    anim(banan, [
      { transform: "scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${mitten * 260}px,-180px) rotate(${mitten * 540}deg) scale(.7)`, opacity: 0 },
    ], { duration: dur(scene, a, 700), easing: "ease-out" }).then(() => banan.remove());
    scene.state(to.side, "HIT");
    const fall = to.wizard.play("fall");
    await a.wait(430);
    scene.sound("duns");
    poff(scene, a, layer, { x: fotter.x, y: fotter.y - 40 }, { size: 110, text: "DUNS!" });
    burst(scene, a, layer, { x: fotter.x, y: fotter.y - 30 }, { count: 7, cls: "tk-stjarna", dist: 110, ms: 900, rise: -50 });
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await fall;
    await a.wait(700);
    if (signal.aborted) return;
    // Reser sig förvirrat och rättar till hatten (ligger i getUp-posen).
    scene.state(to.side, "RECOVERING");
    await to.wizard.play("getUp");
  },
});

registerAttack({
  id: "slemmus-blaaus",
  name: "SLEMMUS BLÄÄÄUS!",
  durationMs: 7200,
  sounds: ["swisch", "splatt"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    const kropp = scene.point(to.wizard, "body");
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), kropp,
      { cls: "tk-slemboll", size: 72, ms: 850, arc: 150, spin: 160 });
    await cast;
    if (signal.aborted) return;
    // SPLATT! Offret täcks av färgglatt slime som sakta glider av.
    scene.sound("splatt");
    poff(scene, a, layer, kropp, { size: 150, text: "SPLATT!", cls: "tk-splatt-poff" });
    burst(scene, a, layer, kropp, { count: 12, cls: "tk-slemstank", dist: 150, ms: 800, rise: -30 });
    const slem = spawn(layer, "tk-slem", { x: kropp.x, y: kropp.y - 20 }, 230, "div");
    slem.innerHTML = "<i></i><i></i><i></i>";
    anim(slem, [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: dur(scene, a, 260), easing: "ease-out", fill: "forwards" });
    scene.state(to.side, "HIT");
    to.wizard.setExpression("sad");
    await to.wizard.play("hit");
    if (signal.aborted) { slem.remove(); return; }
    // Torkar slem ur ansiktet medan det droppar.
    for (const dx of [-60, 10, 55]) {
      const d = spawn(layer, "tk-slemdroppe", { x: kropp.x + dx, y: kropp.y + 30 }, 18);
      anim(d, [{ transform: "translate(0,0)", opacity: 0.95 }, { transform: "translate(0,190px) scale(.6)", opacity: 0 }],
        { duration: dur(scene, a, 900 + a.rng() * 400), easing: "ease-in" }).then(() => d.remove());
    }
    await to.wizard.play("worried");
    if (signal.aborted) { slem.remove(); return; }
    // Slemmet glider av – allt blir normalt igen.
    scene.state(to.side, "RECOVERING");
    await anim(slem, [
      { transform: "scale(1)", opacity: 1 },
      { transform: "translate(0,170px) scale(.9,.5)", opacity: 0 },
    ], { duration: dur(scene, a, 900), easing: "ease-in", fill: "forwards" });
    slem.remove();
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("taunt");
    await to.wizard.play("stagger");
  },
});
