// ============================================================================
// Trollkarlsduellen (#540): OAVGJORT-FINALEN (spec §14.4) – en helt egen
// sekvens utan vinnare: båda laddar, besvärjelserna kolliderar i mitten, ett
// stort magiskt POFF, båda blir sotiga och snurriga, tittar på varandra och
// skrattar. Vyn visar sedan resultatskärmen med "OAVGJORT!" och poängen.
// ============================================================================

import { registerFinale } from "../trollkarl-register.js";
import { dur, spawn, anim, fly, poff, burst } from "../attacker/attack-verktyg.js";
import { blixt, cirklar, konfettiRegn, sota } from "./final-verktyg.js";

registerFinale({
  id: "magisk-krock",
  kind: "draw",
  name: "Den stora kollisionen",
  async run(scene, f) {
    const layer = scene.layer();
    const [l, r] = f.sides;
    scene.sound("final-mork");
    for (const s of f.sides) s.wizard.setExpression("angry");
    await scene.wait(500, f.signal);
    // Båda laddar sina stavar samtidigt – ingen är före den andra.
    scene.sound("final-laddning");
    for (const s of f.sides) scene.state(s.side, "CHARGING");
    cirklar(scene, f, layer, scene.point(l.wizard, "wandTip"), { size: 200, ms: 1600 });
    cirklar(scene, f, layer, scene.point(r.wizard, "wandTip"), { size: 200, ms: 1600 });
    await Promise.all([l.wizard.play("charge"), r.wizard.play("charge")]);
    if (f.signal.aborted) return;
    for (const s of f.sides) { scene.state(s.side, "CASTING"); s.wizard.play("cast"); }
    scene.sound("final-skott");
    const mitt = { x: scene.W / 2, y: 400 };
    await Promise.all([
      fly(scene, f, layer, scene.point(l.wizard, "wandTip"), mitt, { cls: "tk-orb tkf-kula", size: 110, ms: 640, arc: 60 }),
      fly(scene, f, layer, scene.point(r.wizard, "wandTip"), mitt, { cls: "tk-orb tkf-kula", size: 110, ms: 640, arc: 60 }),
    ]);
    if (f.signal.aborted) return;
    // Kollisionen: blixt, jättepoff och en tryckvåg som sveper över arenan.
    scene.sound("oavgjort-krock");
    blixt(scene, f, layer);
    poff(scene, f, layer, mitt, { size: 460, text: "POFF!" });
    const vag = spawn(layer, "tkf-tryckvag", mitt, 120, "div");
    anim(vag, [
      { transform: "scale(.2)", opacity: 0.9 },
      { transform: "scale(9)", opacity: 0 },
    ], { duration: dur(scene, f, 900), easing: "ease-out" }).then(() => vag.remove());
    burst(scene, f, layer, mitt, { count: 18, cls: "tk-stjarna", dist: 340, ms: 1100 });
    await scene.wait(300, f.signal);
    // Båda blir sotiga och snurriga av smällen.
    for (const s of f.sides) {
      scene.state(s.side, "HIT");
      sota(scene, f, s.wizard);
      s.wizard.setExpression("surprised");
      s.wizard.play("dizzy");
    }
    await scene.wait(1500, f.signal);
    // De tittar på varandra och skrattar – delad ära, ingen förlorare (§14.4).
    scene.sound("skratt");
    scene.sound("konfetti");
    konfettiRegn(scene, f, layer, { count: 30 });
    for (const s of f.sides) {
      scene.state(s.side, "RECOVERING");
      s.wizard.setExpression("happy");
    }
    await Promise.all([l.wizard.play("laugh"), r.wizard.play("laugh")]);
    await Promise.all([l.wizard.play("cheer"), r.wizard.play("cheer")]);
  },
});
