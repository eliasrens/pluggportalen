// ============================================================================
// Pixi-profilen för byn + tomternas kamerafokus (#396, S2 #420)
//   • varld-profil-by.js har profilformatet (§2.4) med malSelektor som träffar
//     tomterna och ignorerar 🔒-bubblan.
//   • Varje .by-tomt bär data-fokus-x/y = EXAKT layout.fokusFor = fokusById
//     (förvärmningens fokus måste vara kamerans, annars byggs fel pyramid).
//   • Boot-säkerhet: profilen ligger utanför den statiska bootgrafen.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import profil from "../src/varld-profil-by.js";
import { mountByScen } from "../src/varld-by-scen.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

test("profil by: format och selektorer", () => {
  assert.equal(profil.id, "by");
  assert.equal(profil.objekt, ".by-tomt");
  assert.equal(profil.ignorera, ".by-last-bubbla");
  assert.equal(profil.malSelektor, ".by-tomt[data-fokus-x]");
  assert.equal(profil.fangst, "stage");
  assert.ok(Array.isArray(profil.ambient));
  assert.deepEqual(profil.sprites, [".hus-rok"]);
});

test("25-husbyn: data-fokus-x/y på varje tomt = fokusById (exakt)", () => {
  const students = Array.from({ length: 25 }, (_, i) => ({
    id: `e${i}`, namn: `Elev ${i}`, locked: i === 6,
  }));
  const lager = { innerHTML: "" };
  const { fokus, fokusById } = mountByScen({ lager, meId: "e0", students });
  const tomter = [...lager.innerHTML.matchAll(/<div class="by-tomt[^"]*"[^>]*?data-id="([^"]+)" data-fokus-x="([^"]+)" data-fokus-y="([^"]+)"/g)];
  assert.equal(tomter.length, 25);
  for (const [, id, x, y] of tomter) {
    // parseFloat av attributet ger tillbaka EXAKT samma tal (ingen avrundning).
    assert.deepEqual({ x: parseFloat(x), y: parseFloat(y) }, fokusById[id], id);
  }
  assert.deepEqual(fokus, fokusById.e0);
});

test("boot-säkerhet: varld-profil-by.js importeras inte statiskt", () => {
  for (const f of ["varld-by-scen.js", "varld-kompis.js", "pages-varld.js", "app.js"]) {
    const s = readFileSync(resolve(SRC, f), "utf8");
    assert.ok(!/^\s*import[^;]*varld-profil-by/m.test(s), f);
  }
});
