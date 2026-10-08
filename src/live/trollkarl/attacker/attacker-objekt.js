// ============================================================================
// Trollkarlsduellen (#539): FÖREMÅLSATTACKERNA 10, 11, 13 och 14 (§8) –
// HATTUS GIGANTUS! (jättehatt), BUBBLUS FLYGUS! (såpbubbla), NYSUS MEGUS!
// (förkylningsförbannelse) och DRAKUS MINIUS! (mini-drake). Stora rekvisita-
// element är div:ar med inline-SVG i attacklagret; bara transform/opacity
// animeras och allt städas (lagret tas dessutom bort av regin efteråt).
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { THEME } from "../trollkarl-delar.js";
import { dur, anim, spawn, fly, poff, burst, upptakt } from "./attack-verktyg.js";

// Jättehatten i kastarens färger (viewBox 200×170, spetsen uppåt).
function jatteHattSvg(who) {
  const t = THEME[who] || THEME.rasmus;
  return `<svg viewBox="0 0 200 170">
    <path d="M10 140 Q100 118 190 140 L198 154 Q100 176 2 154Z" fill="${t.hat}" stroke="${t.hatBand}" stroke-width="3"/>
    <path d="M52 142 Q100 -100 148 142 Q100 156 52 142Z" fill="${t.hat}"/>
    <path d="M52 142 Q100 124 148 142 L148 118 Q100 104 52 118Z" fill="${t.hatBand}"/>
    <path transform="translate(100 84) scale(1.5)" fill="${t.star || "#ffd76b"}" d="M0 -8 2 -2 8 0 2 2 0 8 -2 2 -8 0 -2 -2Z"/>
  </svg>`;
}

// Liten söt drake (viewBox 140×100, nosen åt vänster).
function drakeSvg() {
  return `<svg viewBox="0 0 140 100">
    <path d="M96 38 Q128 10 132 34 Q134 50 108 54Z" fill="#62c46a"/>
    <path d="M60 30 Q96 18 112 44 Q120 66 92 76 Q60 84 44 66 Q32 48 60 30Z" fill="#7ad483"/>
    <path d="M60 52 Q78 46 92 58 Q84 72 64 70 Q52 64 60 52Z" fill="#d9f7b1"/>
    <path d="M44 56 Q18 52 12 62 Q22 72 44 66Z" fill="#62c46a"/>
    <circle cx="34" cy="44" r="13" fill="#7ad483"/>
    <path d="M24 46 Q12 46 10 52 Q18 56 26 52Z" fill="#5bb763"/>
    <circle cx="31" cy="42" r="5" fill="#fff"/><circle cx="31" cy="43" r="2.4" fill="#1c1c22"/>
    <path d="M36 32 Q40 22 48 26 L44 34Z" fill="#f4a73c"/>
    <path d="M70 26 Q74 10 86 14 L80 30Z" fill="#62c46a"/>
    <path d="M52 76 L48 88 M70 78 L70 90" stroke="#5bb763" stroke-width="6" stroke-linecap="round"/>
  </svg>`;
}

registerAttack({
  id: "hattus-gigantus",
  name: "HATTUS GIGANTUS!",
  durationMs: 8400,
  sounds: ["swisch", "duns", "poff"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    scene.sound("swisch");
    const fotter = scene.point(to.wizard, "feet");
    const topp = scene.point(to.wizard, "hat");
    // En ENORM trollkarlshatt faller ner från himlen – stor nog att sluka hela
    // trollkarlen: brättet når nästan marken, bara fötterna sticker fram.
    const hattH = fotter.y - topp.y + 20;
    const hattW = hattH * 200 / 170; // hattens viewBox-proportion
    const kropp = { x: fotter.x, y: topp.y - 30 + hattH / 2 };
    const hatt = spawn(layer, "tk-jattehatt", kropp, hattH, "div");
    hatt.style.width = `${hattW}px`;
    hatt.style.left = `${fotter.x - hattW / 2}px`;
    hatt.innerHTML = jatteHattSvg(a.from.who);
    to.wizard.setExpression("surprised");
    await anim(hatt, [
      { transform: "translate(0,-760px) rotate(-8deg)", opacity: 0.9 },
      { transform: "translate(0,-740px) rotate(-8deg)", opacity: 1, offset: 0.12 },
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
    ], { duration: dur(scene, a, 900), easing: "cubic-bezier(.5,0,.9,.6)", fill: "forwards" });
    if (signal.aborted) { hatt.remove(); return; }
    // … och landar ÖVER offret: bara fötterna sticker fram under brättet.
    scene.sound("duns");
    scene.state(to.side, "TRANSFORMED");
    burst(scene, a, layer, { x: fotter.x, y: fotter.y - 10 }, { count: 10, cls: "tk-damm", dist: 150, ms: 700, spin: 0 });
    poff(scene, a, layer, { x: fotter.x, y: fotter.y - 80 }, { size: 110, text: "DUNS!" });
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    // Hatten skakar och vinglar omkring medan offret bankar inifrån.
    const vingel = hatt.animate([
      { transform: "translate(0,0) rotate(0deg)" },
      { transform: "translate(-26px,-8px) rotate(-5deg)", offset: 0.2 },
      { transform: "translate(20px,0) rotate(4deg)", offset: 0.45 },
      { transform: "translate(-14px,-12px) rotate(-3deg)", offset: 0.7 },
      { transform: "translate(0,0) rotate(0deg)" },
    ], { duration: dur(scene, a, 1400), iterations: 2, easing: "ease-in-out" });
    await a.wait(1500);
    if (signal.aborted) { vingel.cancel(); hatt.remove(); return; }
    poff(scene, a, layer, { x: kropp.x, y: kropp.y - 60 }, { size: 90, text: "HALLÅ?!" });
    await a.wait(1400);
    vingel.cancel();
    if (signal.aborted) { hatt.remove(); return; }
    // Offret lyckas till slut krypa ut – hatten tippar och löses upp i ett POFF.
    scene.state(to.side, "RECOVERING");
    scene.sound("poff");
    const ut = to.wizard.play("getUp");
    await anim(hatt, [
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: "translate(60px,-120px) rotate(24deg)", opacity: 1, offset: 0.55 },
      { transform: "translate(90px,-180px) rotate(38deg) scale(.5)", opacity: 0 },
    ], { duration: dur(scene, a, 900), easing: "ease-in", fill: "forwards" });
    hatt.remove();
    poff(scene, a, layer, { x: kropp.x + 80, y: kropp.y - 160 });
    to.wizard.setExpression("sad");
    await ut;
  },
});

registerAttack({
  id: "bubblus-flygus",
  name: "BUBBLUS FLYGUS!",
  durationMs: 8400,
  sounds: ["bubbla", "plopp", "duns"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    scene.sound("bubbla");
    const kropp = scene.point(to.wizard, "body");
    // En gigantisk skimrande såpbubbla växer fram runt offret.
    const bubbla = spawn(layer, "tk-bubbla", { x: kropp.x, y: kropp.y - 30 }, 420, "div");
    await anim(bubbla, [
      { transform: "scale(.1)", opacity: 0 },
      { transform: "scale(1.06)", opacity: 1, offset: 0.7 },
      { transform: "scale(1)", opacity: 1 },
    ], { duration: dur(scene, a, 700), easing: "ease-out", fill: "forwards" });
    if (signal.aborted) { bubbla.remove(); return; }
    scene.state(to.side, "HIT");
    to.wizard.setExpression("surprised");
    // Bubblan (och trollkarlen i den) svävar sakta upp – han trycker mot väggen.
    const sväv = [
      { transform: "translate(0,0)" },
      { transform: "translate(-24px,-120px)", offset: 0.35 },
      { transform: "translate(22px,-210px)", offset: 0.7 },
      { transform: "translate(-8px,-250px)" },
    ];
    const tid = { duration: dur(scene, a, 2800), easing: "ease-in-out", fill: "forwards" };
    const el = to.wizard.el;
    const lyft = el.animate(sväv, tid);
    anim(bubbla, sväv.map((k) => ({ ...k, transform: `${k.transform} scale(1)` })), tid);
    to.wizard.play("worried");
    await lyft.finished.catch(() => {});
    if (signal.aborted) { bubbla.remove(); return; }
    // PLOPP! Bubblan spricker …
    lyft.cancel(); // fallet nedan börjar i samma läge – ingen synlig hopp-frame
    scene.sound("plopp");
    poff(scene, a, layer, { x: kropp.x - 8, y: kropp.y - 280 }, { size: 150, text: "PLOPP!", cls: "tk-plopp-poff" });
    burst(scene, a, layer, { x: kropp.x - 8, y: kropp.y - 280 }, { count: 14, cls: "tk-bubbelstank", dist: 200, ms: 900, rise: 30, spin: 0 });
    bubbla.remove();
    // … och han landar mjukt och komiskt på baken.
    await anim(el, [
      { transform: "translate(-8px,-250px)" },
      { transform: "translate(0,0) scale(1.06,.9)" },
    ], { duration: dur(scene, a, 480), easing: "cubic-bezier(.4,0,1,.8)" });
    if (signal.aborted) return;
    scene.sound("duns");
    const fotter = scene.point(to.wizard, "feet");
    burst(scene, a, layer, fotter, { count: 6, cls: "tk-damm", dist: 90, ms: 500, spin: 0 });
    const fall = to.wizard.play("fall");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await fall;
    await a.wait(500);
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    await to.wizard.play("getUp");
  },
});

registerAttack({
  id: "nysus-megus",
  name: "NYSUS MEGUS!",
  durationMs: 7800,
  sounds: ["swisch", "nys", "poff"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    const huvud = scene.point(to.wizard, "head");
    // Ett rosa magiskt moln seglar fram och lägger sig vid offrets näsa.
    const moln = await fly(scene, a, layer, scene.point(a.from.wizard, "wandTip"), { x: huvud.x, y: huvud.y + 4 },
      { cls: "tk-nysmoln", size: 110, ms: 1000, arc: 60, keep: true });
    await cast;
    if (signal.aborted) { moln.remove(); return; }
    scene.state(to.side, "HIT");
    // Näsan kittlar – han kämpar emot: "Aah … aah …"
    to.wizard.setExpression("surprised");
    const hold = to.wizard.play("worried");
    for (const txt of ["Aah …", "AAH …"]) {
      if (signal.aborted) { moln.remove(); return; }
      poff(scene, a, layer, { x: huvud.x + 60, y: huvud.y - 70 }, { size: 80, text: txt, cls: "tk-atjo" });
      await a.wait(800);
    }
    await hold;
    if (signal.aborted) { moln.remove(); return; }
    // ATJOOO! Hatten flyger av, molnet blåses bort.
    scene.sound("nys");
    poff(scene, a, layer, huvud, { size: 210, text: "ATJOOO!", cls: "tk-atjo" });
    anim(moln, [{ transform: "scale(1)", opacity: 0.95 }, { transform: "translate(140px,-60px) scale(1.6)", opacity: 0 }],
      { duration: dur(scene, a, 500), easing: "ease-out" }).then(() => moln.remove());
    burst(scene, a, layer, huvud, { count: 10, cls: "tk-gnista", dist: 170, ms: 700, rise: -30 });
    const hatt = to.wizard.layer("hat");
    hatt?.animate([
      { transform: "translate(0px,0px) rotate(0deg)" },
      { transform: "translate(-20px,-180px) rotate(-30deg)", offset: 0.3 },
      { transform: "translate(-26px,-170px) rotate(-24deg)", offset: 0.6 },
      { transform: "translate(0px,-8px) rotate(3deg)", offset: 0.9 },
      { transform: "translate(0px,0px) rotate(0deg)" },
    ], { duration: dur(scene, a, 1700), easing: "ease-in-out" });
    await to.wizard.play("jump");
    await a.wait(900);
    if (signal.aborted) return;
    // Hatten har landat igen – allt blir normalt.
    scene.state(to.side, "RECOVERING");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await to.wizard.play("dizzy");
  },
});

registerAttack({
  id: "drakus-minius",
  name: "DRAKUS MINIUS!",
  durationMs: 8600,
  sounds: ["poff", "drake", "stank"],
  async run(scene, a) {
    const layer = scene.layer();
    const { from, to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    // En liten söt drake POFFar fram vid kastarens sida …
    const start = scene.point(from.wizard, "wandTip");
    scene.sound("poff");
    poff(scene, a, layer, start, { size: 90 });
    const drake = spawn(layer, "tk-drake", start, 150, "div");
    drake.innerHTML = drakeSvg();
    if (to.side === "right") drake.classList.add("tk-drake-hoger");
    scene.sound("drake");
    const huvud = scene.point(to.wizard, "head");
    const dx = huvud.x - start.x;
    const dy = huvud.y - start.y;
    const flax = drake.animate([
      { transform: "translate(0,0)" }, { transform: "translate(0,-12px)" }, { transform: "translate(0,0)" },
    ], { duration: dur(scene, a, 450), iterations: Infinity, easing: "ease-in-out", composite: "add" });
    // … flyger fram och cirklar runt offret.
    await anim(drake, [
      { transform: "translate(0,0)" },
      { transform: `translate(${dx * 0.5}px,${dy - 160}px)`, offset: 0.35 },
      { transform: `translate(${dx + 150}px,${dy - 40}px)`, offset: 0.6 },
      { transform: `translate(${dx}px,${dy + 90}px)`, offset: 0.8 },
      { transform: `translate(${dx - 170}px,${dy}px)` },
    ], { duration: dur(scene, a, 2200), easing: "ease-in-out", fill: "forwards" });
    if (signal.aborted) { flax.cancel(); drake.remove(); return; }
    scene.state(to.side, "ANTICIPATING_HIT");
    to.wizard.setExpression("surprised");
    // Den andas in … och blåser en ÖVERDRIVET stor rökring rakt i ansiktet.
    await a.wait(350);
    scene.sound("stank");
    const ring = spawn(layer, "tk-rokring", { x: huvud.x - 120, y: huvud.y }, 60, "div");
    await anim(ring, [
      { transform: "translate(0,0) scale(.4)", opacity: 0.95 },
      { transform: `translate(${110}px,0) scale(2.6)`, opacity: 0.9, offset: 0.7 },
      { transform: `translate(${150}px,0) scale(3.2)`, opacity: 0 },
    ], { duration: dur(scene, a, 1100), easing: "ease-out" });
    ring.remove();
    if (signal.aborted) { flax.cancel(); drake.remove(); return; }
    // Offret hostar komiskt och blir lite sotig i ansiktet.
    scene.state(to.side, "HIT");
    const sot = spawn(layer, "tk-sot", { x: huvud.x, y: huvud.y + 6 }, 120, "div");
    anim(sot, [{ opacity: 0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0.55, offset: 0.75 }, { opacity: 0 }],
      { duration: dur(scene, a, 2600) }).then(() => sot.remove());
    for (let i = 0; i < 3; i++) {
      if (signal.aborted) { flax.cancel(); drake.remove(); return; }
      burst(scene, a, layer, { x: huvud.x, y: huvud.y + 20 }, { count: 4, cls: "tk-rok", dist: 90, ms: 700, rise: -50, spin: 0 });
      await a.wait(380);
    }
    to.wizard.setExpression("sad");
    const host = to.wizard.play("worried");
    // Draken gör en nöjd liten piruett och flyger iväg.
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await anim(drake, [
      { transform: `translate(${dx - 170}px,${dy}px) rotate(0deg)` },
      { transform: `translate(${dx - 190}px,${dy - 60}px) rotate(-14deg)`, offset: 0.3 },
      { transform: `translate(${dx * 0.4}px,${dy - 420}px) rotate(-8deg)`, offset: 0.7 },
      { transform: "translate(-460px,-640px) scale(.6)", opacity: 0 },
    ], { duration: dur(scene, a, 1500), easing: "ease-in", fill: "forwards" });
    flax.cancel();
    drake.remove();
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    await host;
    await to.wizard.play("stagger");
  },
});
