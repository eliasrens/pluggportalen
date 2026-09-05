// ============================================================================
// Regressionstest för golv-clampen i husdjurens promenad-AI (#63).
// Buggen: husdjur (t.ex. en hund) gick upp på väggarna igen. Testar den rena
// golv-geometrin (src/rum-promenad-golv.js) utan DOM. Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { FLOOR_TOP } from "../src/art-room.js";
import { petWalkZone, clampRange } from "../src/rum-promenad-golv.js";

// Där ett djur står med fötterna, givet centrum-Y och halva spritehöjden.
const feet = (centerY, halfH) => centerY + halfH;

// --- Grundinvariant: fötterna hålls på golvytan oavsett djurstorlek --------
test("djurets fötter hålls på golvytan (FLOOR_TOP) för alla realistiska storlekar", () => {
  // Små valpar upp till en stor hund/vuxet mystery-djur (halva spritehöjden i %).
  for (const halfH of [3, 5, 8, 10, 12, 16, 20]) {
    const z = petWalkZone(halfH * 0.7, halfH);
    // Högst upp djuret får stå (minsta centrum-Y) → fötterna ändå på golvet.
    assert.ok(
      feet(z.minY, halfH) >= FLOOR_TOP,
      `halfH=${halfH}: fötter ${feet(z.minY, halfH)} hamnade över golvet (${FLOOR_TOP})`
    );
    // Överkanten (centrum − halfH) får inte skjutas av skärmens topp.
    assert.ok(z.minY - halfH >= 0, `halfH=${halfH}: överkant utanför scenen`);
    assert.ok(z.minY <= z.maxY, `halfH=${halfH}: zonen inverterad`);
  }
});

// --- Rotorsaken: mät spriten, inte hela noden (inkl. namn-etiketten) -------
test("uppblåst halfH (hela noden inkl. namn-etikett) släpper fötterna upp på väggen", () => {
  const spriteHalfH = 10; // så stor är själva djur-spriten
  const inflatedHalfH = 16; // så stor blir noden om man mäter med namn-etiketten

  // Rätt: zonen räknas på spritens verkliga höjd → fötterna på golvet.
  const zGood = petWalkZone(spriteHalfH * 0.7, spriteHalfH);
  assert.ok(feet(zGood.minY, spriteHalfH) >= FLOOR_TOP);

  // Fel (den gamla buggen): zonen räknas på den uppblåsta nod-höjden, men
  // fötterna sitter kvar där spriten slutar → centrum släpps för högt och
  // fötterna hamnar OVANFÖR golvet (på väggen).
  const zBad = petWalkZone(inflatedHalfH * 0.7, inflatedHalfH);
  assert.ok(
    feet(zBad.minY, spriteHalfH) < FLOOR_TOP,
    "testet ska visa regressionen: uppblåst halfH → fötter på väggen"
  );
});

// --- Bälte-och-hängslen: den hårda re-clampen i walkStep -------------------
test("clampRange pinnar ett steg som skulle gå upp på väggen tillbaka till golvzonen", () => {
  const halfH = 12;
  const z = petWalkZone(halfH * 0.7, halfH);

  // Ett mål/steg som pekar högt upp på väggen (litet y = högt upp).
  const strayY = 40;
  const clamped = clampRange(strayY, z.minY, z.maxY);
  assert.equal(clamped, z.minY, "steget skulle klampas ner till zonens topp");
  assert.ok(feet(clamped, halfH) >= FLOOR_TOP, "efter clamp: fötter på golvet");

  // Ett giltigt steg mitt på golvet lämnas orört.
  const okY = (z.minY + z.maxY) / 2;
  assert.equal(clampRange(okY, z.minY, z.maxY), okY);
});
