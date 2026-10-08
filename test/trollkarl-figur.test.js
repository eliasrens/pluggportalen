// Enhetstester #537: trollkarlarnas posregister, teman och ansiktslager.
// DOM-fritt (node --test) – själva rörelsen browser-kontrolleras separat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { POSES, POSE_NAMES, PRIO } from "../src/live/trollkarl/trollkarl-poser.js";
import { THEME, FACE, PIVOT, ANCHOR, VIEW } from "../src/live/trollkarl/trollkarl-delar.js";

const KRAVPOSER = [
  "charge", "cast", "hit", "stagger", "dizzy", "fall", "getUp", "jump",
  "spin", "laugh", "taunt", "cheer", "worried", "victory", "defeat", "cry",
];
const UTTRYCK = ["neutral", "happy", "angry", "sad", "surprised"];
const DELAR = ["fig", "flip", "head", "hat", "body", "cape", "armL", "armR", "forearmR", "wand", "face"];

test("posregistret har alla poser issue #537 kräver", () => {
  for (const p of KRAVPOSER) assert.ok(POSES[p], "saknar pos: " + p);
  assert.deepEqual([...POSE_NAMES].sort(), [...KRAVPOSER].sort());
});

test("varje pos är välformad: dur, prio och körbara steg", () => {
  for (const [name, pose] of Object.entries(POSES)) {
    assert.ok(pose.dur > 0 && pose.dur <= 5000, name + ": rimlig dur");
    assert.ok(Object.values(PRIO).includes(pose.prio), name + ": känd prio");
    assert.ok(pose.steps.length > 0, name + ": har steg");
    for (const s of pose.steps) {
      if (s.exp) { assert.ok(UTTRYCK.includes(s.exp), name + ": känt uttryck " + s.exp); continue; }
      if (s.glow !== undefined) continue;
      assert.ok(DELAR.includes(s.part), name + ": känd del " + s.part);
      assert.ok(Array.isArray(s.kf) && s.kf.length >= 2, name + "/" + s.part + ": minst 2 keyframes");
      assert.ok(s.dur > 0, name + "/" + s.part + ": steg-dur");
    }
  }
});

test("prioritetsordningen följer §11: final > attack > uppladdning > idle", () => {
  assert.ok(PRIO.finale > PRIO.attack && PRIO.attack > PRIO.charge && PRIO.charge > PRIO.idle);
  assert.equal(POSES.victory.prio, PRIO.finale);
  assert.equal(POSES.defeat.prio, PRIO.finale);
  assert.equal(POSES.hit.prio, PRIO.attack);
  assert.equal(POSES.charge.prio, PRIO.charge);
});

test("poser som lämnar figuren i låst läge är markerade stay", () => {
  assert.ok(POSES.fall.stay, "fall lämnar figuren liggande");
  assert.ok(POSES.defeat.stay, "defeat lämnar figuren nersjunken");
  assert.ok(!POSES.getUp.stay, "getUp återställer");
});

test("identiteterna hålls isär: båda har eget tema och egna ansiktslager", () => {
  for (const who of ["rasmus", "elias"]) {
    assert.ok(THEME[who] && FACE[who], who + " finns");
    for (const n of ["happy", "angry", "sad"]) {
      const f = new URL(`../src/live/trollkarl/ref/${who}-${n}.webp`, import.meta.url);
      const size = statSync(f).size;
      assert.ok(size > 2000 && size <= 60 * 1024, `${who}-${n}.webp inom budget (≤60 KB): ${size}`);
      // WebP-magi: RIFF....WEBP
      const head = readFileSync(f).subarray(0, 12);
      assert.equal(head.toString("ascii", 0, 4), "RIFF");
      assert.equal(head.toString("ascii", 8, 12), "WEBP");
    }
  }
  assert.notEqual(THEME.rasmus.robe, THEME.elias.robe, "olika mantelfärger så klasserna skiljs åt");
  assert.notEqual(THEME.rasmus.glow, THEME.elias.glow, "olika magifärger");
});

test("pivoter och ankare ligger inom figurens viewBox", () => {
  for (const [n, [x, y]] of Object.entries({ ...PIVOT, ...ANCHOR })) {
    assert.ok(x >= -50 && x <= VIEW.w + 50 && y >= -50 && y <= VIEW.h + 50, n + " inom rimligt område");
  }
});
