// ============================================================================
// Trollkarlsduellen (#538): FÖRVANDLINGSATTACKERNA 1–3 (§8) – GRODIFIX!,
// HÖNUS PANIKUS! och POTATUS TOTALUS!. Offret byts mot en figur ur
// attack-figurer.js via wizard.transform(); regin kör alltid reset() efteråt,
// men varje attack återställer själv (POOF + reaktionspos) så förloppet syns.
// Ljudnycklarna byggs av del E (registerSound) – här refereras de bara.
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { dur, anim, fly, poff, burst, upptakt, riggaOverlay } from "./attack-verktyg.js";
import { grodaSvg, honaSvg, potatisSvg } from "./attack-figurer.js";

// Förvandla offret (POOF + overlay) och ge tillbaka riggad overlay-grupp.
function forvandla(scene, a, layer, svg, { text = "POFF!" } = {}) {
  const p = scene.point(a.to.wizard, "body");
  scene.sound("poff");
  poff(scene, a, layer, p, { text });
  scene.state(a.to.side, "TRANSFORMED");
  return riggaOverlay(a.to.wizard.transform(svg));
}

// Tillbaka till trollkarl + rolig efterreaktion.
async function aterstall(scene, a, layer, reaktion = "stagger") {
  if (a.signal.aborted) return;
  scene.sound("poff");
  poff(scene, a, layer, scene.point(a.to.wizard, "body"));
  a.to.wizard.reset();
  scene.state(a.to.side, "RECOVERING");
  a.to.wizard.setExpression("sad");
  a.from.wizard.setExpression("happy");
  a.from.wizard.play("laugh");
  await a.to.wizard.play(reaktion);
}

registerAttack({
  id: "grodifix",
  name: "GRODIFIX!",
  durationMs: 7200,
  sounds: ["swisch", "poff", "kvack"],
  async run(scene, a) {
    const layer = scene.layer();
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), scene.point(a.to.wizard, "body"),
      { cls: "tk-orb tk-orb-grodd", ms: 680, arc: 70 });
    await cast;
    if (a.signal.aborted) return;
    const groda = forvandla(scene, a, layer, grodaSvg(a.to.who));
    a.from.wizard.play("laugh");
    for (let i = 0; i < 3; i++) {
      if (a.signal.aborted) return;
      scene.sound("kvack");
      await anim(groda, [
        { transform: "translate(0,0) scale(1,1)" },
        { transform: "translate(0,10px) scale(1.1,.88)", offset: 0.18 },
        { transform: "translate(0,-95px) scale(.94,1.1)", offset: 0.55 },
        { transform: "translate(0,4px) scale(1.08,.9)", offset: 0.88 },
        { transform: "translate(0,0) scale(1,1)" },
      ], { duration: dur(scene, a, 560), easing: "ease-in-out" });
      burst(scene, a, layer, scene.point(a.to.wizard, "feet"), { count: 5, cls: "tk-damm", dist: 60, ms: 450, spin: 0 });
    }
    await a.wait(260);
    await aterstall(scene, a, layer, "stagger");
  },
});

registerAttack({
  id: "honus-panikus",
  name: "HÖNUS PANIKUS!",
  durationMs: 7600,
  sounds: ["virvel", "poff", "kackel"],
  async run(scene, a) {
    const layer = scene.layer();
    const cast = upptakt(scene, a);
    scene.sound("virvel");
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), scene.point(a.to.wizard, "body"),
      { cls: "tk-virvel", size: 64, ms: 760, arc: 40, spin: 720 });
    await cast;
    if (a.signal.aborted) return;
    const hona = forvandla(scene, a, layer, honaSvg(a.to.who));
    const vingar = riggaOverlay(hona.querySelector('[data-del="vingar"]'), "200px 440px");
    anim(vingar, [
      { transform: "scaleY(1)" }, { transform: "scaleY(.55) rotate(2deg)" }, { transform: "scaleY(1)" },
    ], { duration: dur(scene, a, 130), iterations: scene.reducedMotion ? 2 : 24 });
    // Panikspringande fram och tillbaka med fjädrar åt alla håll.
    const spring = anim(hona, [
      { transform: "translate(0,0)" },
      { transform: "translate(-70px,0) rotate(-5deg)", offset: 0.22 },
      { transform: "translate(60px,0) rotate(5deg)", offset: 0.5 },
      { transform: "translate(-45px,0) rotate(-4deg)", offset: 0.76 },
      { transform: "translate(0,0)" },
    ], { duration: dur(scene, a, 2800), easing: "ease-in-out" });
    for (let i = 0; i < 3; i++) {
      if (a.signal.aborted) return;
      scene.sound("kackel");
      burst(scene, a, layer, scene.point(a.to.wizard, "body"), { count: 9, cls: "tk-fjader", dist: 150, ms: 1100, rise: -40 });
      await a.wait(820);
    }
    await spring;
    await aterstall(scene, a, layer, "dizzy");
  },
});

registerAttack({
  id: "potatus-totalus",
  name: "POTATUS TOTALUS!",
  durationMs: 7200,
  sounds: ["swisch", "poff", "suck"],
  async run(scene, a) {
    const layer = scene.layer();
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), scene.point(a.to.wizard, "body"),
      { cls: "tk-orb tk-orb-potatis", size: 54, ms: 700, arc: 110, spin: 360 });
    await cast;
    if (a.signal.aborted) return;
    const potatis = forvandla(scene, a, layer, potatisSvg(a.to.who), { text: "POTATIS!" });
    a.from.wizard.play("taunt");
    const tar = potatis.querySelector('[data-del="tar"] path');
    scene.sound("suck");
    // Vaggar uppgivet från sida till sida; en liten tår rinner.
    anim(tar, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
      { duration: dur(scene, a, 2600) });
    await anim(potatis, [
      { transform: "rotate(0)" },
      { transform: "rotate(-7deg)", offset: 0.18 },
      { transform: "rotate(7deg)", offset: 0.42 },
      { transform: "rotate(-6deg)", offset: 0.66 },
      { transform: "rotate(5deg)", offset: 0.86 },
      { transform: "rotate(0)" },
    ], { duration: dur(scene, a, 2900), easing: "ease-in-out" });
    if (a.signal.aborted) return;
    await aterstall(scene, a, layer, "cry");
  },
});
