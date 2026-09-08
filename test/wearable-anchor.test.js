// ============================================================================
// Enhetstest för ansikts-ankaret (issue #131: felplacerade kläder):
//   • mustaschen ankras på munlinjen ("mun"), inte över ögonen
//   • ögon-plagg (glasögon m.fl.) behåller standard-ankaret (null)
//   • avatarMarkup lägger på af-anchor-mun så CSS flyttar boxen på ALLA figurer
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { wearableAnchor } from "../src/art-wearables.js";
import { AVATARS, avatarMarkup } from "../src/avatars.js";

test("mustaschen ankras på munlinjen", () => {
  assert.equal(wearableAnchor("mustasch"), "mun");
});

test("ögon-plagg använder slotens standard-ankare (inget extra)", () => {
  for (const id of ["glasogon", "pilotglasogon", "ogonlapp", "monokel", "hjartglasogon", "snorkelmask", "glad-mask"]) {
    assert.equal(wearableAnchor(id), null, `${id} ska inte ha eget ankare`);
  }
});

test("avatarMarkup lägger på af-anchor-mun för mustaschen på alla avatarer", () => {
  for (const avatarId of Object.keys(AVATARS)) {
    const html = avatarMarkup(avatarId, ["mustasch"]);
    assert.ok(
      html.includes("af-wear af-ansikte af-anchor-mun"),
      `mustaschen saknar mun-ankare på ${avatarId}`,
    );
  }
});

test("avatarMarkup lägger INTE på af-anchor för ögon-plagg", () => {
  const html = avatarMarkup("fox", ["glasogon"]);
  assert.ok(html.includes("af-wear af-ansikte"), "glasögon ska vara i ansikte-sloten");
  assert.ok(!html.includes("af-anchor"), "glasögon ska inte få något ankar-klass");
});
