// ============================================================================
// Trollkarlsduellen (#538): VÄDERATTACKERNA 4 och 8 (§8) – REGNUS MAXIMUS!
// (personligt regnmoln) och FJÄDRUS STORMUS! (fjädertornado). Rena
// scenlager-effekter (inga förvandlingar): moln/tromb är div:ar som bara
// animeras med transform/opacity; droppar och fjädrar går via burst-taket.
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { dur, anim, spawn, poff, burst, upptakt } from "./attack-verktyg.js";

registerAttack({
  id: "regnus-maximus",
  name: "REGNUS MAXIMUS!",
  durationMs: 8200,
  sounds: ["swisch", "regn", "plask"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    scene.sound("swisch");
    const hatt = scene.point(to.wizard, "hat");
    const huvud = { x: hatt.x, y: hatt.y + 40 };
    const fotter = scene.point(to.wizard, "feet");
    // Ett litet mörkt moln materialiseras alldeles ovanpå hatten (syns under HUD:en) och guppar.
    const moln = spawn(layer, "tk-moln", { x: hatt.x, y: hatt.y + 14 }, 230, "div");
    moln.innerHTML = "<i></i><i></i><i></i>";
    await anim(moln, [{ transform: "scale(.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: dur(scene, a, 500), easing: "ease-out", fill: "forwards" });
    const gupp = moln.animate([
      { transform: "translate(0,0)" }, { transform: "translate(14px,-6px)" }, { transform: "translate(-12px,4px)" }, { transform: "translate(0,0)" },
    ], { duration: dur(scene, a, 2400), iterations: Infinity, easing: "ease-in-out" });
    scene.state(to.side, "HIT");
    scene.sound("regn");
    to.wizard.play("hit");
    // Kraftigt regn – bara på den trollkarlen. Pölen växer vid fötterna.
    const pol = spawn(layer, "tk-pol", { x: fotter.x, y: fotter.y + 6 }, 190, "div");
    anim(pol, [{ transform: "scale(.1,.1)", opacity: 0 }, { transform: "scale(1,1)", opacity: 0.6 }],
      { duration: dur(scene, a, 2600), easing: "ease-out", fill: "forwards" });
    const slut = Date.now() + dur(scene, a, 3200);
    to.wizard.setExpression("sad");
    to.wizard.play("worried");
    while (Date.now() < slut) {
      if (signal.aborted) return;
      for (let i = 0; i < (scene.reducedMotion ? 3 : 8); i++) {
        const d = spawn(layer, "tk-droppe", { x: huvud.x + (a.rng() - 0.5) * 190, y: huvud.y - 70 }, 16);
        anim(d, [{ transform: "translate(0,0)", opacity: 0.9 }, { transform: `translate(0,${fotter.y - huvud.y + 60}px)`, opacity: 0.7 }],
          { duration: dur(scene, a, 420 + a.rng() * 200), easing: "ease-in" }).then(() => d.remove());
      }
      await a.wait(230);
    }
    // Molnet löses upp; trollkarlen skakar av sig vattnet.
    gupp.cancel();
    scene.sound("plask");
    await anim(moln, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.4)" }],
      { duration: dur(scene, a, 500), fill: "forwards" });
    moln.remove();
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    burst(scene, a, layer, scene.point(to.wizard, "body"), { count: 14, cls: "tk-droppe", dist: 160, ms: 700, rise: 40, spin: 0 });
    await to.wizard.play("spin");
  },
});

registerAttack({
  id: "fjadrus-stormus",
  name: "FJÄDRUS STORMUS!",
  durationMs: 8400,
  sounds: ["tornado", "nys"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    scene.sound("tornado");
    const kropp = scene.point(to.wizard, "body");
    // En liten tornado snurrar in och ställer sig runt offret, fylld av fjädrar.
    const tromb = spawn(layer, "tk-tromb", { x: kropp.x, y: kropp.y + 10 }, 320, "div");
    tromb.innerHTML = "<i></i><i></i><i></i><i></i>";
    await anim(tromb, [
      { transform: `translate(${to.side === "left" ? -500 : 500}px,-80px) scale(.3)`, opacity: 0 },
      { transform: "translate(0,0) scale(1)", opacity: 1 },
    ], { duration: dur(scene, a, 700), easing: "ease-out", fill: "forwards" });
    const vagg = tromb.animate([
      { transform: "translate(0,0) rotate(-3deg)" }, { transform: "translate(10px,-8px) rotate(3deg)" }, { transform: "translate(0,0) rotate(-3deg)" },
    ], { duration: dur(scene, a, 420), iterations: Infinity, easing: "ease-in-out" });
    scene.state(to.side, "HIT");
    to.wizard.play("spin");
    for (let i = 0; i < 4; i++) {
      if (signal.aborted) { vagg.cancel(); return; }
      burst(scene, a, layer, { x: kropp.x, y: kropp.y - 40 + a.rng() * 120 }, { count: 8, cls: "tk-fjader", dist: 170, ms: 1000, rise: -80 });
      await a.wait(620);
    }
    // Trollkarlen nyser av fjädrarna …
    scene.sound("nys");
    poff(scene, a, layer, scene.point(to.wizard, "head"), { size: 120, text: "ATJOO!", cls: "tk-atjo" });
    to.wizard.play("jump");
    vagg.cancel();
    await anim(tromb, [{ transform: "translate(0,0)", opacity: 1 }, { transform: "translate(0,-640px) scale(.5)", opacity: 0 }],
      { duration: dur(scene, a, 800), easing: "ease-in", fill: "forwards" });
    tromb.remove();
    if (signal.aborted) return;
    // … och EN sista fjäder seglar ner och landar på näsan: ATJOO igen!
    scene.state(to.side, "RECOVERING");
    const huvud = scene.point(to.wizard, "head");
    const fjader = spawn(layer, "tk-fjader", { x: huvud.x + 30, y: huvud.y - 260 }, 22);
    await anim(fjader, [
      { transform: "translate(0,0) rotate(0)" },
      { transform: "translate(-44px,90px) rotate(-50deg)", offset: 0.33 },
      { transform: "translate(24px,180px) rotate(40deg)", offset: 0.66 },
      { transform: `translate(-26px,${260 - 10}px) rotate(-25deg)` },
    ], { duration: dur(scene, a, 1500), easing: "ease-in-out", fill: "forwards" });
    if (signal.aborted) { fjader.remove(); return; }
    scene.sound("nys");
    poff(scene, a, layer, huvud, { size: 110, text: "ATJOO!", cls: "tk-atjo" });
    fjader.remove();
    await to.wizard.play("jump");
    await to.wizard.play("dizzy");
  },
});
