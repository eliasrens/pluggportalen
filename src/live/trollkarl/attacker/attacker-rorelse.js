// ============================================================================
// Trollkarlsduellen (#539): RÖRELSEATTACKERNA 9, 12 och 15 (§8) –
// SNURRUS YRUS! (snurrförbannelse), BLIXTUS HOPPUS! (komisk blixt) och
// STUDSUS MAXIMUS! (studsmatta). Offret kastas runt via WAAPI på figurens
// rot-svg (bara transform/opacity, återställs alltid till identitet – regins
// reset() avbryter dessutom allt vid avbrott). Ren slapstick, ingen skada.
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { dur, anim, spawn, fly, poff, burst, upptakt } from "./attack-verktyg.js";

registerAttack({
  id: "snurrus-yrus",
  name: "SNURRUS YRUS!",
  durationMs: 7800,
  sounds: ["swisch", "snurr", "virvel"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    // En magisk spiral skruvar sig fram mot offret.
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), scene.point(to.wizard, "body"),
      { cls: "tk-spiral", size: 70, ms: 760, arc: 60, spin: 1080 });
    await cast;
    if (signal.aborted) return;
    scene.sound("snurr");
    scene.state(to.side, "HIT");
    to.wizard.setExpression("surprised");
    // Offret snurrar allt snabbare runt sin egen axel (hela figuren).
    const el = to.wizard.el;
    el.style.transformOrigin = "50% 72%";
    const snurr = anim(el, [
      { transform: "rotate(0deg)" },
      { transform: "rotate(300deg)", offset: 0.38 },
      { transform: "rotate(1050deg)", offset: 0.78 },
      { transform: "rotate(1800deg)" },
    ], { duration: dur(scene, a, 2500), easing: "ease-in" });
    // Stjärnor och små spiraler kretsar kring huvudet.
    const huvud = scene.point(to.wizard, "head");
    const stopp = Date.now() + dur(scene, a, 2500);
    while (Date.now() < stopp) {
      if (signal.aborted) return;
      burst(scene, a, layer, huvud, { count: 4, cls: a.rng() < 0.5 ? "tk-stjarna" : "tk-spiralmini", dist: 130, ms: 900, rise: -20 });
      await a.wait(380);
    }
    await snurr;
    if (signal.aborted) return;
    // Stannar tvärt, stapplar omkring några steg och återfår balansen.
    scene.state(to.side, "RECOVERING");
    scene.sound("virvel");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await to.wizard.play("dizzy");
    await to.wizard.play("stagger");
  },
});

registerAttack({
  id: "blixtus-hoppus",
  name: "BLIXTUS HOPPUS!",
  durationMs: 7400,
  sounds: ["uppladdning", "blixt", "nys"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    // Kastaren höjer staven mot skyn – det mullrar till i luften.
    scene.state(a.from.side, "CASTING");
    scene.state(to.side, "ANTICIPATING_HIT");
    scene.sound("uppladdning");
    await a.from.wizard.play("cast");
    if (signal.aborted) return;
    const fotter = scene.point(to.wizard, "feet");
    const mitten = to.side === "left" ? 1 : -1;
    const nedslag = { x: fotter.x + mitten * 110, y: fotter.y };
    // En liten tecknad blixt slår ner ALLDELES intill – hela arenan blinkar till.
    scene.sound("blixt");
    const flash = document.createElement("div");
    flash.className = "tk-blixt-flash";
    layer.appendChild(flash);
    anim(flash, [{ opacity: 0 }, { opacity: 0.85, offset: 0.12 }, { opacity: 0, offset: 0.4 }, { opacity: 0.4, offset: 0.55 }, { opacity: 0 }],
      { duration: dur(scene, a, 700), easing: "linear" }).then(() => flash.remove());
    const blixt = spawn(layer, "tk-blixt", { x: nedslag.x, y: nedslag.y - 240 }, 90, "div");
    blixt.style.height = "480px";
    blixt.style.top = `${nedslag.y - 480}px`;
    blixt.style.transformOrigin = "50% 0";
    await anim(blixt, [
      { transform: "scaleY(0)", opacity: 1 },
      { transform: "scaleY(1)", opacity: 1, offset: 0.25 },
      { transform: "scaleY(1)", opacity: 0.6, offset: 0.7 },
      { transform: "scaleY(1)", opacity: 0 },
    ], { duration: dur(scene, a, 600), easing: "ease-out" });
    blixt.remove();
    if (signal.aborted) return;
    burst(scene, a, layer, nedslag, { count: 10, cls: "tk-gnista", dist: 150, ms: 700, rise: -40 });
    // Offret hoppar rakt upp av förvåning – hatten lyfter och det ryker ur den.
    scene.state(to.side, "HIT");
    to.wizard.setExpression("surprised");
    const hopp = to.wizard.play("jump");
    const hatt = to.wizard.layer("hat");
    hatt?.animate([
      { transform: "translate(0px,0px) rotate(0deg)" },
      { transform: "translate(0px,-34px) rotate(-10deg)", offset: 0.4 },
      { transform: "translate(0px,3px) rotate(4deg)", offset: 0.8 },
      { transform: "translate(0px,0px) rotate(0deg)" },
    ], { duration: dur(scene, a, 900), easing: "cubic-bezier(.34,1.56,.64,1)" });
    const hattP = scene.point(to.wizard, "hat");
    for (const dx of [-16, 8, 22]) {
      const rok = spawn(layer, "tk-rok", { x: hattP.x + dx, y: hattP.y - 6 }, 34 + a.rng() * 22, "div");
      anim(rok, [
        { transform: "translate(0,0) scale(.4)", opacity: 0.85 },
        { transform: `translate(${dx * 2}px,-130px) scale(1.3)`, opacity: 0 },
      ], { duration: dur(scene, a, 1400 + a.rng() * 500), easing: "ease-out" }).then(() => rok.remove());
    }
    await hopp;
    await a.wait(300);
    if (signal.aborted) return;
    // Skakar på huvudet och hämtar sig – bara stolheten fick en stöt.
    scene.state(to.side, "RECOVERING");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await to.wizard.play("dizzy");
  },
});

registerAttack({
  id: "studsus-maximus",
  name: "STUDSUS MAXIMUS!",
  durationMs: 8600,
  sounds: ["swisch", "studs", "duns"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    scene.sound("swisch");
    const fotter = scene.point(to.wizard, "feet");
    // Golvet under offret börjar lysa som en magisk studsmatta.
    const platta = spawn(layer, "tk-studsplatta", { x: fotter.x, y: fotter.y + 4 }, 300, "div");
    await anim(platta, [{ transform: "scale(.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: dur(scene, a, 500), easing: "ease-out", fill: "forwards" });
    const puls = platta.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }],
      { duration: dur(scene, a, 600), iterations: Infinity, easing: "ease-in-out" });
    scene.state(to.side, "HIT");
    to.wizard.setExpression("surprised");
    const el = to.wizard.el;
    const hatt = to.wizard.layer("hat");
    // Varje studs blir högre – hatten hänger kvar i luften ett ögonblick.
    for (const h of [90, 160, 240, 330]) {
      if (signal.aborted) { puls.cancel(); return; }
      scene.sound("studs");
      hatt?.animate([
        { transform: "translate(0px,0px)" },
        { transform: "translate(0px,22px)", offset: 0.35 },
        { transform: "translate(0px,-10px)", offset: 0.75 },
        { transform: "translate(0px,0px)" },
      ], { duration: dur(scene, a, 620), easing: "ease-in-out" });
      await anim(el, [
        { transform: "translate(0,0) scale(1.05,.92)" },
        { transform: `translate(0,${-h}px) scale(.97,1.05)`, offset: 0.5 },
        { transform: "translate(0,0) scale(1.08,.88)" },
      ], { duration: dur(scene, a, 620), easing: "cubic-bezier(.3,.1,.7,.9)" });
      burst(scene, a, layer, fotter, { count: 5, cls: "tk-damm", dist: 80, ms: 450, spin: 0 });
    }
    if (signal.aborted) { puls.cancel(); return; }
    // Plattan slocknar och offret landar mjukt – yr och förvirrad.
    puls.cancel();
    scene.sound("duns");
    poff(scene, a, layer, { x: fotter.x, y: fotter.y - 50 }, { size: 120, text: "BOING!" });
    await anim(platta, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.3)" }],
      { duration: dur(scene, a, 450), fill: "forwards" });
    platta.remove();
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("taunt");
    await to.wizard.play("dizzy");
    await to.wizard.play("stagger");
  },
});
