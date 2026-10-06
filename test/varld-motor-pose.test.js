// ============================================================================
// Reservpyramidens ambient-pose (#396, F5 #431): fangaPose vid speglingen,
// sattPose när reserven spelas. Fejkade WAAPI-animationer och element.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { basAmbient, fangaPose, sattPose } from "../src/varld-motor-pose.js";

/** Minimal nod: contains() via förälderkedja, closest() på klassnamn. */
function nod(namn, foralder = null) {
  return {
    namn, foralder,
    contains(n) { for (let x = n; x; x = x.foralder) if (x === this) return true; return false; },
    closest(s) { for (let x = this; x; x = x.foralder) if (s.split(",").includes(`.${x.namn}`)) return x; return null; },
  };
}
const anim = (target, currentTime, playState = "running") => ({
  effect: { target }, currentTime, playState,
  pause() { this.playState = "paused"; },
});

function scen() {
  const lager = nod("lager");
  const moln = nod("moln", lager), rok = nod("rok", lager), djur = nod("djur", lager), annat = nod("annat");
  const a = { moln: anim(moln, 1000), rok: anim(rok, 2500), djur: anim(djur, 400), egen: anim(lager, 50), annat: anim(annat, 9) };
  lager.getAnimations = () => [a.moln, a.rok, a.djur, a.egen];
  return { lager, a };
}

test("basAmbient: utan lagrets egen, sprites och noder utanför lagret", () => {
  const { lager, a } = scen();
  assert.deepEqual(basAmbient(lager, Object.values(a), ".djur"), [a.moln, a.rok]);
  assert.deepEqual(basAmbient(lager, Object.values(a), ""), [a.moln, a.rok, a.djur]);
});

test("fangaPose sparar currentTime per bas-ambient-animation (spelande eller pausad)", () => {
  const { lager, a } = scen();
  a.rok.playState = "paused";
  const p = fangaPose(lager, ".djur");
  assert.equal(p.tider.size, 2);
  assert.equal(p.tider.get(a.moln), 1000);
  assert.equal(p.tider.get(a.rok), 2500);
  assert.equal(p.tider.has(a.djur), false);
});

test("fangaPose: ingen ambient → null; getAnimations saknas → null", () => {
  const { lager, a } = scen();
  a.moln.playState = "finished";
  a.rok.playState = "idle";
  assert.equal(fangaPose(lager, ".djur"), null);
  assert.equal(fangaPose({}, ""), null);
});

test("sattPose spolar de PAUSADE animationerna tillbaka till reservens pose", () => {
  const { lager, a } = scen();
  const pose = fangaPose(lager, ".djur");
  // Ambienten driver vidare (~4 s) innan klicket; vilan pausar allt.
  a.moln.currentTime = 5000; a.rok.currentTime = 6500; a.djur.currentTime = 4400;
  const pausade = [a.moln, a.rok, a.djur, a.egen];
  pausade.forEach((x) => x.pause());
  const r = sattPose(lager, pose, pausade);
  assert.equal(a.moln.currentTime, 1000);
  assert.equal(a.rok.currentTime, 2500);
  assert.equal(a.djur.currentTime, 4400, "sprites (speglas om) rörs inte");
  assert.equal(a.egen.currentTime, 50, "lagrets egen animation rörs inte");
  assert.equal(a.moln.playState, "paused", "förblir pausad – vilans slapp() kör play()");
  assert.deepEqual({ satta: r.satta, borta: r.borta, nya: r.nya }, { satta: 2, borta: 0, nya: 0 });
});

test("sattPose: tillkomna/försvunna animationer lämnas orörda och räknas", () => {
  const { lager, a } = scen();
  const pose = fangaPose(lager, ".djur");
  const ny = anim(nod("ny-rok", lager), 7777);
  a.rok.currentTime = 9999;
  a.moln.currentTime = 5000;
  const pausade = [a.moln, ny]; // röken spelar inte längre (vilan pausade den inte)
  pausade.forEach((x) => x.pause());
  const r = sattPose(lager, pose, pausade);
  assert.equal(a.moln.currentTime, 1000);
  assert.equal(a.rok.currentTime, 9999, "inte pausad av vilan → orörd");
  assert.equal(ny.currentTime, 7777, "saknas i posen → orörd");
  assert.deepEqual({ satta: r.satta, borta: r.borta, nya: r.nya }, { satta: 1, borta: 1, nya: 1 });
});

test("sattPose: animation som någon annan återupptagit rörs inte; pose null → null", () => {
  const { lager, a } = scen();
  const pose = fangaPose(lager, ".djur");
  a.moln.pause();
  a.moln.playState = "running"; // återupptagen av någon annan
  a.moln.currentTime = 3000;
  assert.equal(sattPose(lager, pose, [a.moln]).borta, 2);
  assert.equal(a.moln.currentTime, 3000);
  assert.equal(sattPose(lager, null, [a.moln]), null);
});
