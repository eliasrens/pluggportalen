// ============================================================================
// Trollkarlsduellen (#540): VINNARFINALERNA (spec §14.2–14.3) – tre varianter,
// deterministiskt valda ur seedet (pickFinale). Alla följer samma dramaturgi:
// arenan har mörknat (vyn), båda har stannat → vinnaren laddar en gigantisk
// slutförtrollning → spektakulär slutattack → förloraren förvandlas/besegras
// barnvänligt → segerpose, konfetti, fyrverkeri och segermusik. Resultatet
// ("🏆 5E VINNER!" + exakta matchpoäng) visar vyn direkt efter run().
// ============================================================================

import { registerFinale } from "../trollkarl-register.js";
import { dur, spawn, anim, fly, poff, burst, riggaOverlay } from "../attacker/attack-verktyg.js";
import { grodaSvg, potatisSvg } from "../attacker/attack-figurer.js";
import { blixt, cirklar, energikula, fyrverkeri, konfettiRegn, sota } from "./final-verktyg.js";

// Gemensam upptakt: tyst mörker, båda samlar sig, vinnaren höjer staven.
async function upptakt(scene, f) {
  scene.sound("final-mork");
  f.winner.wizard.setExpression("happy");
  f.loser.wizard.setExpression("surprised");
  f.loser.wizard.play("worried");
  await scene.wait(600, f.signal);
  scene.state(f.winner.side, "CHARGING");
  scene.sound("final-laddning");
  return f.winner.wizard.play("charge");
}

// Gemensamt firande: segerpose, fanfar, jubel, fyrverkeri och konfettiregn.
async function firande(scene, f, layer) {
  scene.state(f.winner.side, "VICTORY");
  scene.state(f.loser.side, "DEFEAT");
  f.winner.wizard.setExpression("happy");
  scene.sound("segerfanfar");
  scene.sound("jubel");
  fyrverkeri(scene, f, layer, { n: 4 });
  konfettiRegn(scene, f, layer, {});
  f.winner.wizard.play("victory");
  await scene.wait(2400, f.signal);
  await f.winner.wizard.play("cheer");
}

registerFinale({
  id: "energikula",
  kind: "win",
  name: "Den gigantiska energikulan",
  async run(scene, f) {
    const layer = scene.layer();
    const charge = upptakt(scene, f);
    const p = scene.point(f.winner.wizard, "wandTip");
    const kula = await energikula(scene, f, layer, p, { size: 240, ms: 2300 });
    await charge;
    if (f.signal.aborted) return;
    scene.state(f.winner.side, "CASTING");
    f.winner.wizard.play("cast");
    scene.sound("final-skott");
    const mal = scene.point(f.loser.wizard, "body");
    scene.state(f.loser.side, "ANTICIPATING_HIT");
    await anim(kula, [
      { transform: "scale(1) translate(0,0)" },
      { transform: `scale(.92) translate(${mal.x - p.x}px,${mal.y - p.y}px)` },
    ], { duration: dur(scene, f, 520), easing: "ease-in", fill: "forwards" });
    kula.remove();
    if (f.signal.aborted) return;
    blixt(scene, f, layer);
    scene.sound("final-explosion");
    poff(scene, f, layer, mal, { size: 420, text: "KABOOM!" });
    burst(scene, f, layer, mal, { count: 20, cls: "tk-stjarna", dist: 320, ms: 1200 });
    scene.state(f.loser.side, "HIT");
    await scene.wait(450, f.signal);
    // Förloraren förvandlas till en snurrig groda (§14.2 steg 9).
    scene.sound("forvandling");
    scene.state(f.loser.side, "TRANSFORMED");
    const groda = riggaOverlay(f.loser.wizard.transform(grodaSvg(f.loser.who)));
    scene.sound("kvack");
    anim(groda, [
      { transform: "rotate(0) scale(1)" },
      { transform: "rotate(-8deg) scale(1.04)", offset: 0.3 },
      { transform: "rotate(8deg) scale(.98)", offset: 0.7 },
      { transform: "rotate(0) scale(1)" },
    ], { duration: dur(scene, f, 1600), easing: "ease-in-out" });
    await firande(scene, f, layer);
  },
});

registerFinale({
  id: "potatis-gigantus",
  kind: "win",
  name: "Den enorma gråtande potatisen",
  async run(scene, f) {
    const layer = scene.layer();
    const charge = upptakt(scene, f);
    const p = scene.point(f.winner.wizard, "wandTip");
    cirklar(scene, f, layer, p, { size: 300, ms: 1800 });
    await charge;
    if (f.signal.aborted) return;
    scene.state(f.winner.side, "CASTING");
    f.winner.wizard.play("cast");
    scene.state(f.loser.side, "ANTICIPATING_HIT");
    // Tre snabba förtrollningsklot i rad – sedan den stora smällen.
    for (let i = 0; i < 3; i++) {
      scene.sound("final-skott");
      await fly(scene, f, layer, scene.point(f.winner.wizard, "wandTip"), scene.point(f.loser.wizard, "body"),
        { cls: "tk-orb tk-orb-potatis", size: 46 + i * 18, ms: 420, arc: 60 + i * 50, spin: 360 });
      if (f.signal.aborted) return;
    }
    blixt(scene, f, layer);
    scene.sound("final-explosion");
    const mal = scene.point(f.loser.wizard, "body");
    poff(scene, f, layer, mal, { size: 380, text: "POTATIS!" });
    scene.state(f.loser.side, "TRANSFORMED");
    scene.sound("forvandling");
    // GIGANTISK uppgiven potatis som studsar in i format (§14.3 B).
    const potatis = riggaOverlay(f.loser.wizard.transform(potatisSvg(f.loser.who)));
    scene.sound("grat");
    await anim(potatis, [
      { transform: "scale(.3)" },
      { transform: "scale(1.75)", offset: 0.55 },
      { transform: "scale(1.45)", offset: 0.8 },
      { transform: "scale(1.55)" },
    ], { duration: dur(scene, f, 1100), easing: "ease-out", fill: "forwards" });
    if (f.signal.aborted) return;
    const tar = potatis.querySelector('[data-del="tar"] path');
    if (tar) anim(tar, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1 }], { duration: dur(scene, f, 2400), fill: "forwards" });
    burst(scene, f, layer, { x: mal.x, y: mal.y + 60 }, { count: 8, cls: "tk-droppe", dist: 110, ms: 900, rise: 60 });
    f.winner.wizard.play("laugh");
    await scene.wait(900, f.signal);
    await firande(scene, f, layer);
  },
});

const DRAKE_SVG = `<svg viewBox="0 0 520 320" aria-hidden="true">
  <path d="M60 210 Q20 170 44 128 Q10 120 26 86 L88 112 Q130 70 210 76 L300 90 Q392 96 440 150 L500 134 Q492 176 452 186 Q460 226 430 248 Q360 290 250 276 Q130 262 60 210Z" fill="#4fae5c"/>
  <path d="M210 76 Q196 30 238 18 Q240 52 262 64 Q300 44 330 70 Q302 84 300 90Z" fill="#3c8c49"/>
  <path d="M100 236 Q150 270 250 276 Q220 300 160 292 Q110 282 100 236Z" fill="#3c8c49"/>
  <ellipse cx="398" cy="150" rx="16" ry="18" fill="#fff"/><circle cx="400" cy="154" r="8" fill="#1c1c22"/>
  <path d="M440 150 Q480 160 500 182 Q470 190 444 176Z" fill="#e5534b"/>
  <path d="M452 186 q10 14 2 26 M470 172 q14 10 10 24" stroke="#ffd76b" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g fill="#b6e8a4"><ellipse cx="250" cy="200" rx="110" ry="46"/></g>
  <g fill="#2f6b38"><path d="M150 96 l14 -26 12 26Z M196 84 l14 -26 12 26Z M244 80 l14 -26 12 26Z"/></g>
</svg>`;

registerFinale({
  id: "drakus-finalus",
  kind: "win",
  name: "Jättedraken",
  async run(scene, f) {
    const layer = scene.layer();
    const bak = scene.layer(true);
    const charge = upptakt(scene, f);
    const mitt = { x: scene.W / 2, y: scene.H - 160 };
    cirklar(scene, f, layer, mitt, { size: 420, ms: 2000 });
    await charge;
    if (f.signal.aborted) return;
    scene.state(f.winner.side, "CASTING");
    f.winner.wizard.play("cast");
    scene.sound("drake");
    // Jättedraken stiger ur den magiska cirkeln bakom trollkarlarna (§14.3 C).
    const drake = spawn(bak, "tkf-drake", { x: scene.W / 2, y: scene.H + 180 }, 560, "div");
    if (f.loser.side === "left") drake.classList.add("tkf-drake-flip");
    drake.innerHTML = DRAKE_SVG;
    poff(scene, f, layer, mitt, { size: 300, text: "DRAKUS!" });
    await anim(drake, [
      { transform: "translate(0,0) scale(.5)", opacity: 0 },
      { transform: "translate(0,-520px) scale(1)", opacity: 1 },
    ], { duration: dur(scene, f, 1100), easing: "ease-out", fill: "forwards" });
    if (f.signal.aborted) return;
    scene.state(f.loser.side, "ANTICIPATING_HIT");
    f.loser.wizard.setExpression("surprised");
    f.loser.wizard.play("worried");
    scene.sound("drake");
    const mal = scene.point(f.loser.wizard, "body");
    // Draken gör ett svep mot förloraren och fräser till – barnvänligt POFF.
    await anim(drake, [
      { transform: "translate(0,-520px) scale(1)" },
      { transform: `translate(${(mal.x - scene.W / 2) * 0.7}px,${mal.y - scene.H - 60}px) scale(1.08)` },
    ], { duration: dur(scene, f, 800), easing: "ease-in-out", fill: "forwards" });
    if (f.signal.aborted) return;
    scene.sound("final-explosion");
    blixt(scene, f, layer, 350);
    poff(scene, f, layer, mal, { size: 300, text: "FRÄS!" });
    burst(scene, f, layer, mal, { count: 12, cls: "tk-gnista", dist: 220, ms: 900 });
    scene.state(f.loser.side, "HIT");
    sota(scene, f, f.loser.wizard);
    f.loser.wizard.setExpression("sad");
    f.loser.wizard.play("fall");
    // Draken nickar nöjt åt vinnaren och glider upp ur bild.
    anim(drake, [
      { transform: `translate(${(mal.x - scene.W / 2) * 0.7}px,${mal.y - scene.H - 60}px) scale(1.08)`, opacity: 1 },
      { transform: `translate(${(mal.x - scene.W / 2) * 0.7}px,-${scene.H + 400}px) scale(.8)`, opacity: 0 },
    ], { duration: dur(scene, f, 1200), easing: "ease-in", fill: "forwards" }).then(() => drake.remove());
    await scene.wait(500, f.signal);
    await firande(scene, f, layer);
  },
});
