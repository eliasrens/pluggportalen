// ============================================================================
// Tester: tio Halloween-djur (#695, epic #689, spec §6 + §7 test 14–17)
//   • katalogen: 10 arter med fasta id:n, mystery-flagga, 3 stegnamn; 10 varor
//     i butikens Halloween-flik (500 mynt, undergrupp "djur", inga vanliga djur),
//     inslagna lazy i SHOP_ITEMS (shop-items.js ligger vid filtaket)
//   • test 14: köp Spökis → pumpaägg i pets[] (coins −500) → kläcks till Spökis
//   • test 15: Spökis är hungrig, äter Mysterymat och växer 1 → 2 → 3, sedan mätt
//   • test 16: sprite-arterna har flaggan → isMysteryPet som förut; vanliga ägg
//     slumpar fortfarande bara sprite-arter; gamla SVG-arter är inga mystery-djur
//   • test 17: 10 djur × 3 steg × 4 uttryck (+ vila) ritas utan fel, stegen och
//     uttrycken skiljer sig, före laddning = null (anroparen visar fallback)
// data-pet.js körs på riktigt mot en minnes-Firestore via en loader-krok (de
// https-importerade Firebase-modulerna byts mot små stubbar).
// ============================================================================

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { HW_SPECIES, getSpecies, creatureArt, creatureSvg, randomSpeciesId, EXPRESSIONS } from "../src/art-pets-creatures.js";
import { SPRITE_SPECIES } from "../src/art-pet-sprites.js";
import { eggSvg } from "../src/art-pets.js";
import { itemSvg, loadCollectionArt } from "../src/art-items.js";
import { getItem, itemsInCollection, itemsInCategory, isAnimalItem } from "../src/shop-items.js";

const FS = `
const db = () => globalThis.__fsData;
export const doc = (_db, col, id) => ({ col, id });
export async function getDoc(ref) {
  const d = db()[ref.id];
  return { exists: () => !!d, data: () => structuredClone(d) };
}
export async function runTransaction(_db, fn) {
  return fn({ get: getDoc, update: (ref, patch) => Object.assign(db()[ref.id], structuredClone(patch)) });
}`;
const HOOK = `export async function resolve(spec, ctx, next) {
  const stub = (src) => ({ shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(src) });
  if (/firebase-firestore\\.js$/.test(spec)) return stub(${JSON.stringify(FS)});
  if (spec.endsWith("/firebase-config.js")) return stub("export const db = {};");
  if (spec === "./data.js" && ctx.parentURL.endsWith("/src/data-pet.js")) {
    return stub("export const currentStudentId = () => 'elev1'; export function invalidateStudentData() {}");
  }
  return next(spec, ctx);
}`;

const ID = ["spokis", "pumpis", "fladdis", "gruffe", "svartis", "mumme", "spindis", "skelli", "uggli", "slemmis"];
let pet;

before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  pet = await import("../src/data-pet.js");
});

test("katalogen: tio arter, fasta id:n, mystery-flagga, tre stegnamn", () => {
  assert.deepEqual(HW_SPECIES.map((s) => s.id), ID);
  for (const s of HW_SPECIES) {
    assert.equal(getSpecies(s.id), s);
    assert.equal(s.mystery, true, s.id);
    assert.equal(s.stageNames.length, 3, s.id);
    assert.equal(s.egg, "hw-pumpaagg");
  }
});

test("före laddning: ingen konst → anroparna faller tillbaka (🐾 / mystery-ägget)", () => {
  assert.equal(creatureArt("spokis", "glad", 2), null, "utan konst → anroparen visar 🐾");
  assert.equal(itemSvg("hw-djur-spokis"), null);
  assert.equal(eggSvg("hw-pumpaagg"), eggSvg(), "okänt ägg → mystery-ägget");
});

test("butiken: tio pumpaägg à 500 mynt i Halloween-flikens djur-grupp (lazy)", async () => {
  assert.equal(getItem("hw-djur-spokis"), null, "varorna slås in lazy – shop-items.js orörd (filtak + bootgraf)");
  await loadCollectionArt();
  const varor = itemsInCollection("halloween").filter((it) => it.hatchSpecies);
  assert.deepEqual(varor.map((it) => it.hatchSpecies), ID);
  for (const it of varor) {
    assert.equal(it.id, "hw-djur-" + it.hatchSpecies);
    assert.equal(it.price, 500);
    assert.equal(it.category, "husdjur");
    assert.equal(it.name, getSpecies(it.hatchSpecies).name);
    assert.equal(isAnimalItem(it.id), false, `${it.id} är inget vanligt rumsdjur (roomAnimals)`);
  }
  assert.ok(itemsInCategory("husdjur").every((it) => !it.hatchSpecies), "bara i Halloween-fliken");
  const hw = await import("../src/halloween/hw-butik.js");
  const djur = hw.halloweenSektioner().find((s) => s.id === "djur");
  assert.equal(djur.items.length, 10);
});

test("test 17: efter laddning 10 × 3 × 4 (+ vila) utan fel", async () => {
  await loadCollectionArt();
  for (const id of ID) {
    const perSteg = new Set();
    for (const steg of [1, 2, 3]) {
      const perUttryck = new Set();
      for (const e of [...EXPRESSIONS, ""]) {
        const svg = creatureSvg(id, e, steg);
        assert.ok(svg && svg.startsWith("<svg") && svg.includes(`aria-label="${getSpecies(id).name}"`), `${id} ${steg} ${e}`);
        assert.doesNotMatch(svg, /NaN|undefined|null/, `${id} ${steg} ${e}: trasiga koordinater`);
        assert.ok(balanserad(svg), `${id} ${steg} ${e}: taggarna går ihop`);
        perUttryck.add(svg);
      }
      assert.equal(perUttryck.size, 5, `${id} steg ${steg}: fem olika ansikten`);
      perSteg.add(creatureArt(id, "", steg));
    }
    assert.equal(perSteg.size, 3, `${id}: tre olika steg`);
    assert.match(creatureArt(id, "", 3), /hw-glod|hw-glimt/, `${id} steg 3 har glöd/glitter`);
    assert.match(creatureArt(id, "ater", 2), /hwd-mums/, `${id} tuggar när den äter`);
    assert.ok(itemSvg("hw-djur-" + id).includes("<svg"), `${id}: butikskortet`);
  }
  assert.match(eggSvg("hw-pumpaagg"), /aria-label="Pumpaägg"/);
  // Gamla SVG-arter ritas exakt som förut (steg-parametern ignoreras).
  assert.equal(creatureArt("blomp", "glad", 3), creatureArt("blomp", "glad"));
});

test("test 16: sprite-arterna har mystery-flaggan och beter sig som förut", () => {
  assert.ok(SPRITE_SPECIES.length >= 13);
  for (const s of SPRITE_SPECIES) {
    assert.equal(s.mystery, true, s.id);
    const p = { speciesId: s.id, hatchedAt: 1, feedCount: 0 };
    assert.equal(pet.isMysteryPet(p), true, s.id);
    assert.equal(pet.isHungry(p), true);
    assert.equal(pet.isHungry({ ...p, feedCount: 20 }), false, "fullvuxen söker inte mat");
  }
  // Gamla procedurella arter + vanliga djur är inga mystery-djur.
  assert.equal(pet.isMysteryPet({ speciesId: "blomp", hatchedAt: 1 }), false);
  assert.equal(pet.isMysteryPet({ id: "hund" }), false);
  // Mystiska ägget slumpar fortfarande bara sprite-arter – aldrig Halloween-djur.
  const sprite = new Set(SPRITE_SPECIES.map((s) => s.id));
  for (let i = 0; i < 300; i++) assert.ok(sprite.has(randomSpeciesId()));
});

test("test 14: köp Spökis för 500 → pumpaägg som kläcks till Spökis", async () => {
  globalThis.__fsData = { elev1: { coins: 700, ownedItems: [], pets: [] } };
  const res = await pet.buyEgg(500, undefined, "spokis");
  assert.equal(res.ok, true);
  assert.equal(res.coins, 200);
  const agg = res.pets[0];
  assert.equal(agg.eggSpecies, "spokis");
  assert.equal(agg.hatchedAt, null);
  assert.equal(globalThis.__fsData.elev1.coins, 200, "coins + ägg i samma transaktion");
  assert.deepEqual(globalThis.__fsData.elev1.ownedItems, [], "ägget hamnar aldrig i ownedItems");

  // För lite pengar → inget köp.
  const nej = await pet.buyEgg(500, undefined, "pumpis");
  assert.equal(nej.ok, false);
  assert.equal(globalThis.__fsData.elev1.pets.length, 1);

  // Okänd art ignoreras (vanligt mystery-ägg), samma kläcktid som vanliga ägg.
  globalThis.__fsData.elev1.coins = 1000;
  const okand = await pet.buyEgg(200, undefined, "finnsinte");
  assert.equal(okand.pets[1].eggSpecies, undefined);
  assert.equal(pet.hatchTimeFor(agg), agg.eggBoughtAt + pet.HATCH_MS);

  // Ännu inte kläckt …
  assert.deepEqual((await pet.hatchReadyPets()).justHatchedIds, []);
  // … ett dygn senare kläcks pumpaägget till just Spökis (vanliga flödet).
  const nu = Date.now;
  Date.now = () => nu() + pet.HATCH_MS + 1000;
  try {
    const { pets, justHatchedIds } = await pet.hatchReadyPets();
    assert.equal(justHatchedIds.length, 2);
    assert.equal(pets[0].speciesId, "spokis");
    assert.equal(pets[0].stage, 1);
    assert.ok(new Set(SPRITE_SPECIES.map((s) => s.id)).has(pets[1].speciesId), "vanliga ägget slumpar som förut");
  } finally {
    Date.now = nu;
  }
});

test("test 15: Spökis blir hungrig, äter Mysterymat och växer genom alla tre stegen", async () => {
  const p = () => globalThis.__fsData.elev1.pets[0];
  assert.equal(p().speciesId, "spokis");
  assert.equal(pet.isMysteryPet(p()), true);
  assert.equal(pet.isHungry(p()), true, "söker Mysterymat på golvet");
  const steg = [];
  for (let i = 1; i <= 20; i++) {
    globalThis.__fsData.elev1.floorApples = [{ id: "a" + i, x: 50, y: 80 }];
    const r = await pet.eatApple(p().id, "a" + i);
    assert.equal(r.ok, true);
    if (r.stageUp) steg.push([i, r.pet.stage]);
  }
  assert.deepEqual(steg, [[10, 2], [20, 3]]);
  assert.equal(p().stage, 3);
  assert.equal(pet.isFullGrown(p()), true);
  assert.equal(pet.isHungry(p()), false, "fullvuxen – söker ingen mer mat");
  assert.deepEqual(globalThis.__fsData.elev1.floorApples, []);
});

/** Enkel kontroll att varje öppnad tagg stängs (självstängande räknas). */
function balanserad(svg) {
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (!m[1]) stack.push(m[2]);
    else if (stack.pop() !== m[2]) return false;
  }
  return stack.length === 0;
}

test("efter laddning: getItem känner varorna, en gång (idempotent)", async () => {
  await loadCollectionArt();
  assert.equal(getItem("hw-djur-slemmis").hatchSpecies, "slemmis");
  assert.equal(itemsInCollection("halloween").filter((it) => it.hatchSpecies).length, 10);
});
