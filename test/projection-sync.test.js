// ============================================================================
// Enhetstest för skriv-sidan av klass-projektionen (src/projection-sync.js, #233)
//
// Kärnan är Firebase-fri: skriv-funktionen injiceras. Här bevisar vi att
//   * award-patchen härleds EXAKT som by-översikten (projectionEntryFrom),
//   * mirrorStudentProjection skickar rätt patch vidare till skriv-API:t, och
//   * en fallerad projektions-skrivning ALDRIG kastar (fäller inte sparet).
// Vi bevisar också att varje data-room-/award-mutators patch-fält är en giltig
// projektions-entry-nyckel (skydd mot fält-namns-drift).
//   node --test test/projection-sync.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  awardProjectionPatch,
  mirrorStudentProjection,
} from "../src/projection-sync.js";
import { projectionEntryFrom } from "../src/class-projection.js";

// --- awardProjectionPatch: samma siffror som översikten annars räknar --------

test("awardProjectionPatch härleder stars/xp/completed EXAKT som projectionEntryFrom", () => {
  const shapes = [
    // Sparat xp-fält + progress med best-star per läge.
    {
      xp: 240,
      progress: {
        vikingatiden: { quiz: { completed: true, stars: 3 }, para: { completed: true, stars: 2 } },
        stenaldern: { quiz: { completed: true, stars: 1 } },
      },
    },
    // Inget xp-fält → härlett ur progress (migrering).
    { progress: { a: { quiz: { completed: true, stars: 2 } } } },
    // Tomt/nytt konto.
    {},
    // Trasiga noder ska hoppas tyst (robusthet).
    { xp: 10, progress: { a: { quiz: null }, b: { m: { completed: true } } } },
  ];
  for (const sd of shapes) {
    const patch = awardProjectionPatch(sd);
    const entry = projectionEntryFrom({}, sd);
    assert.deepEqual(
      patch,
      { stars: entry.stars, xp: entry.xp, completed: entry.completed },
      `patch matchar entryn för ${JSON.stringify(sd)}`
    );
  }
});

test("awardProjectionPatch tål saknad/ogiltig studentData", () => {
  assert.deepEqual(awardProjectionPatch(), { stars: 0, xp: 0, completed: 0 });
  assert.deepEqual(awardProjectionPatch(null), { stars: 0, xp: 0, completed: 0 });
});

// --- mirrorStudentProjection: rätt patch vidare, aldrig kastande -------------

test("mirrorStudentProjection skickar (studentId, patch) vidare till skriv-API:t", async () => {
  const calls = [];
  const update = async (id, patch) => calls.push([id, patch]);
  const patch = { husLast: true };
  await mirrorStudentProjection(update, "elev1", patch);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "elev1");
  assert.deepEqual(calls[0][1], { husLast: true });
});

test("mirrorStudentProjection väntar in skrivningen (await)", async () => {
  let done = false;
  const update = () =>
    new Promise((res) => setTimeout(() => { done = true; res(); }, 5));
  await mirrorStudentProjection(update, "elev1", { stars: 1 });
  assert.equal(done, true, "mirror ska ha inväntat den asynkrona skrivningen");
});

test("mirrorStudentProjection kastar ALDRIG när skrivningen rejectar", async () => {
  const errs = [];
  const update = async () => { throw new Error("permission-denied"); };
  await assert.doesNotReject(
    mirrorStudentProjection(update, "elev1", { xp: 5 }, (e) => errs.push(e))
  );
  assert.equal(errs.length, 1, "onError ska ha anropats med felet");
  assert.match(errs[0].message, /permission-denied/);
});

test("mirrorStudentProjection kastar ALDRIG vid ett synkront kast", async () => {
  const update = () => { throw new Error("boom"); };
  await assert.doesNotReject(mirrorStudentProjection(update, "elev1", { xp: 1 }, () => {}));
});

test("mirrorStudentProjection är en no-op utan studentId eller patch", async () => {
  const calls = [];
  const update = async (...a) => calls.push(a);
  await mirrorStudentProjection(update, "", { xp: 1 });
  await mirrorStudentProjection(update, "elev1", {});
  await mirrorStudentProjection(update, "elev1", null);
  await mirrorStudentProjection(update, null, { xp: 1 });
  assert.equal(calls.length, 0, "ingen skrivning ska ske för tom input");
});

// --- Fält-namns-drift: alla mutators skriver GILTIGA entry-nycklar -----------
// Speglar de patch-fält skriv-punkterna i game-shared.js/data-room.js/
// data-content.js faktiskt skickar. Alla MÅSTE vara nycklar i en projektions-
// entry, annars skulle by-översikten aldrig se värdet (en tyst bugg).

test("varje skriv-punkts patch-fält är en giltig projektions-entry-nyckel", () => {
  const entryKeys = new Set(Object.keys(projectionEntryFrom({}, {})));
  const mutatorPatchKeys = [
    ["awardExercise", ["stars", "xp", "completed"]],
    ["saveAvatarItems", ["avatarItems"]],
    ["saveRoom (paletteId)", ["paletteId"]],
    ["saveHusSkal", ["husSkalId"]],
    ["setHusLast", ["husLast"]],
    ["setAvatar", ["avatarId"]],
    ["upsertStudent", ["namn", "avatarId"]],
  ];
  for (const [name, keys] of mutatorPatchKeys) {
    for (const k of keys) {
      assert.ok(entryKeys.has(k), `${name}: "${k}" måste finnas i projektions-entryn`);
    }
  }
});
