// ============================================================================
// Trollkarlsduellen (#539): EXTRAATTACKERNA 16–17 (§8 "extra kreativ frihet") –
// FÅRUS RAMMUS! (ett magiskt får rusar in och välter offret) och
// DANSUS DISCUS! (dansförbannelse med discoljus och toner). Samma kvalitets-
// krav som 1–15: upptakt → magi → effekt → rolig reaktion → full återställning.
// ============================================================================

import { registerAttack } from "../trollkarl-register.js";
import { dur, anim, spawn, poff, burst, upptakt } from "./attack-verktyg.js";

// Fluffigt får i profil (viewBox 160×120, nosen åt vänster).
function farSvg() {
  return `<svg viewBox="0 0 160 120">
    <ellipse cx="86" cy="58" rx="54" ry="36" fill="#f5f1e6"/>
    <circle cx="48" cy="40" r="18" fill="#f5f1e6"/><circle cx="76" cy="28" r="20" fill="#f5f1e6"/>
    <circle cx="108" cy="30" r="18" fill="#f5f1e6"/><circle cx="130" cy="48" r="16" fill="#f5f1e6"/>
    <path d="M62 102 L60 116 M84 104 L84 118 M106 102 L108 116" stroke="#3a3540" stroke-width="7" stroke-linecap="round"/>
    <circle cx="34" cy="52" r="20" fill="#4a4450"/>
    <path d="M26 36 Q14 30 12 40 Q16 48 28 44Z" fill="#8a8494"/>
    <path d="M44 38 Q52 26 58 34 Q54 42 44 44Z" fill="#8a8494"/>
    <circle cx="28" cy="50" r="5" fill="#fff"/><circle cx="27" cy="51" r="2.4" fill="#1c1c22"/>
    <path d="M18 62 Q24 66 30 62" stroke="#f5f1e6" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M138 52 Q152 54 148 66 Q140 68 134 60Z" fill="#f5f1e6"/>
  </svg>`;
}

registerAttack({
  id: "farus-rammus",
  name: "FÅRUS RAMMUS!",
  durationMs: 8200,
  sounds: ["poff", "faar", "duns"],
  async run(scene, a) {
    const layer = scene.layer();
    const { to, signal } = a;
    await upptakt(scene, a);
    if (signal.aborted) return;
    // Ett magiskt får POFFar fram vid arenakanten bakom kastaren …
    const fotter = scene.point(to.wizard, "feet");
    const fran = to.side === "left" ? -1 : 1; // fåret kommer in från motsatta kanten
    const start = { x: fotter.x - fran * 980, y: fotter.y - 44 };
    scene.sound("poff");
    poff(scene, a, layer, start, { size: 110 });
    const far = spawn(layer, "tk-far", start, 190, "div");
    far.innerHTML = farSvg();
    if (fran > 0) far.classList.add("tk-far-hoger"); // springer åt höger → spegelvänd
    scene.sound("faar");
    poff(scene, a, layer, { x: start.x, y: start.y - 110 }, { size: 90, text: "BÄÄ!", cls: "tk-faa-poff" });
    await a.wait(600);
    if (signal.aborted) { far.remove(); return; }
    // … sänker huvudet och GALOPPERAR rakt mot offret med dammoln bakom sig.
    to.wizard.setExpression("surprised");
    scene.state(to.side, "ANTICIPATING_HIT");
    const dx = (fotter.x - fran * 120) - start.x;
    const rusning = anim(far, [
      { transform: "translate(0,0) rotate(0deg)" },
      { transform: `translate(${dx * 0.3}px,-26px) rotate(${fran * 4}deg)`, offset: 0.3 },
      { transform: `translate(${dx * 0.55}px,0) rotate(0deg)`, offset: 0.55 },
      { transform: `translate(${dx * 0.8}px,-26px) rotate(${fran * 4}deg)`, offset: 0.8 },
      { transform: `translate(${dx}px,0) rotate(0deg)` },
    ], { duration: dur(scene, a, 1300), easing: "ease-in", fill: "forwards" });
    const damm = (async () => {
      for (let i = 0; i < 4; i++) {
        if (signal.aborted) return;
        burst(scene, a, layer, { x: start.x + dx * (0.2 + i * 0.22), y: fotter.y }, { count: 4, cls: "tk-damm", dist: 70, ms: 500, spin: 0 });
        await a.wait(280);
      }
    })();
    await rusning;
    await damm;
    if (signal.aborted) { far.remove(); return; }
    // BONK! Offret vräks omkull – fåret studsar nöjt tillbaka.
    scene.sound("duns");
    scene.state(to.side, "HIT");
    poff(scene, a, layer, { x: fotter.x, y: fotter.y - 120 }, { size: 130, text: "BONK!" });
    burst(scene, a, layer, { x: fotter.x, y: fotter.y - 90 }, { count: 8, cls: "tk-stjarna", dist: 130, ms: 900, rise: -40 });
    const fall = to.wizard.play("fall");
    anim(far, [
      { transform: `translate(${dx}px,0)` },
      { transform: `translate(${dx - fran * 170}px,-70px) rotate(${-fran * 10}deg)`, offset: 0.5 },
      { transform: `translate(${dx - fran * 240}px,0)` },
    ], { duration: dur(scene, a, 700), easing: "ease-out", fill: "forwards" });
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("laugh");
    await fall;
    if (signal.aborted) { far.remove(); return; }
    // Fåret bräker belåtet och POFFar bort igen.
    scene.sound("faar");
    poff(scene, a, layer, { x: fotter.x - fran * 240, y: fotter.y - 150 }, { size: 90, text: "BÄÄ!", cls: "tk-faa-poff" });
    await a.wait(700);
    scene.sound("poff");
    poff(scene, a, layer, { x: fotter.x - fran * 240, y: fotter.y - 44 }, { size: 110 });
    await anim(far, [{ opacity: 1, transform: `translate(${dx - fran * 240}px,0) scale(1)` },
      { opacity: 0, transform: `translate(${dx - fran * 240}px,0) scale(.3)` }],
      { duration: dur(scene, a, 350), easing: "ease-in", fill: "forwards" });
    far.remove();
    if (signal.aborted) return;
    scene.state(to.side, "RECOVERING");
    await to.wizard.play("getUp");
  },
});

registerAttack({
  id: "dansus-discus",
  name: "DANSUS DISCUS!",
  durationMs: 8400,
  sounds: ["swisch", "dans", "suck"],
  async run(scene, a) {
    const layer = scene.layer();
    const bak = scene.layer(true);
    const { to, signal } = a;
    const cast = upptakt(scene, a);
    scene.sound("swisch");
    const kropp = scene.point(to.wizard, "body");
    await cast;
    if (signal.aborted) return;
    // Discoljus tänds bakom offret – förbannelsen tar tag i benen!
    scene.sound("dans");
    scene.state(to.side, "HIT");
    const ljus = [];
    for (const [i, farg] of ["#ff5fa2", "#4cc3ff", "#ffd76b"].entries()) {
      const l = spawn(bak, "tk-disco", { x: kropp.x + (i - 1) * 180, y: kropp.y - 120 }, 300, "div");
      l.style.setProperty("--tk-disco", farg);
      ljus.push(l);
      anim(l, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 0.6, transform: "scale(1)" }],
        { duration: dur(scene, a, 500), easing: "ease-out", fill: "forwards" });
      l.animate([
        { transform: `translate(0,0) scale(1)` },
        { transform: `translate(${(i - 1) * -70}px,-40px) scale(1.15)` },
        { transform: `translate(0,0) scale(1)` },
      ], { duration: dur(scene, a, 1600 + i * 300), iterations: Infinity, easing: "ease-in-out", composite: "add" });
    }
    to.wizard.setExpression("surprised");
    // Offret MÅSTE dansa: gungar, snurrar och hoppar i takt – toner överallt.
    const el = to.wizard.el;
    el.style.transformOrigin = "50% 85%";
    const gunga = el.animate([
      { transform: "rotate(0deg) translate(0,0)" },
      { transform: "rotate(-7deg) translate(-16px,-10px)", offset: 0.25 },
      { transform: "rotate(0deg) translate(0,0)", offset: 0.5 },
      { transform: "rotate(7deg) translate(16px,-10px)", offset: 0.75 },
      { transform: "rotate(0deg) translate(0,0)" },
    ], { duration: dur(scene, a, 900), iterations: 3, easing: "ease-in-out" });
    for (let i = 0; i < 4; i++) {
      if (signal.aborted) { gunga.cancel(); return; }
      const not = spawn(layer, "tk-not", { x: kropp.x + (a.rng() - 0.5) * 260, y: kropp.y - 60 }, 50, "div");
      not.textContent = a.rng() < 0.5 ? "♪" : "♫";
      anim(not, [
        { transform: "translate(0,0) rotate(-10deg) scale(.6)", opacity: 0 },
        { transform: "translate(10px,-90px) rotate(8deg) scale(1)", opacity: 1, offset: 0.4 },
        { transform: "translate(-6px,-200px) rotate(-12deg) scale(1.1)", opacity: 0 },
      ], { duration: dur(scene, a, 1400), easing: "ease-out" }).then(() => not.remove());
      await a.wait(640);
    }
    await gunga.finished.catch(() => {});
    if (signal.aborted) return;
    await to.wizard.play("spin");
    if (signal.aborted) return;
    await to.wizard.play("jump");
    if (signal.aborted) return;
    // Ljuset slocknar – dansen släpper och offret står kvar, generad och yr.
    scene.sound("suck");
    for (const l of ljus) {
      anim(l, [{ opacity: 0.6 }, { opacity: 0 }], { duration: dur(scene, a, 500), fill: "forwards" }).then(() => l.remove());
    }
    scene.state(to.side, "RECOVERING");
    to.wizard.setExpression("sad");
    a.from.wizard.setExpression("happy");
    a.from.wizard.play("taunt");
    await to.wizard.play("dizzy");
  },
});
