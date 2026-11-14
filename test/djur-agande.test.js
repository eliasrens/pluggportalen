// ============================================================================
// Tester: djurens ägande via agdaDjur (#856, docs/SAKERHET-MYNT.md §6 B4).
// De tre läsfunktionerna som all ritning går igenom – animalsFromData
// (data-animals.js), farmFromData (farm-core.js) och petsFromData (data-pet.js)
// – visar bara djur med en post i serverkartan agdaDjur, med kartans art:
//   • ett djur utan kartpost syns inte; ett ändrat id ger kartans art
//   • ett vanligt ägg med Halloween-art blir en vanlig art; Halloween-ägget behåller sin
//   • värmelampan utan köp ger ingen effekt
//   • ett migrerat äldre djur syns som förut
//   • ett uid från en annan lista syns inte (regel 1), dubbletter syns en gång (regel 2)
//   • sparningen behåller poster utan kartpost (inget djur försvinner)
// data-pet.js och data-animals.js körs mot en minnes-Firestore via en
// loader-krok (samma som test/halloween-djur.test.js).
// ============================================================================

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { farmFromData, GARDSDJUR, medDoldaPoster } from "../src/farm-core.js";
import { SHOP_ITEMS } from "../src/shop-items.js";
import { HW_SPECIES, getSpecies, vanligArtFor } from "../src/art-pets-creatures.js";
import { SPRITE_SPECIES } from "../src/art-pet-sprites.js";
import { planeraMigrering } from "../admin/migrera-mynt-las-core.mjs";

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
  if (spec === "./data.js" && /\\/src\\/data-(pet|animals)\\.js$/.test(ctx.parentURL)) {
    return stub("export const currentStudentId = () => 'elev1'; export function invalidateStudentData() {}");
  }
  return next(spec, ctx);
}`;

let animalsFromData, petsFromData, pet, djur;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  pet = await import("../src/data-pet.js");
  djur = await import("../src/data-animals.js");
  ({ petsFromData } = pet);
  ({ animalsFromData } = djur);
});

const VANLIGA = new Set(SPRITE_SPECIES.map((s) => s.id));
const agg = (id, extra = {}) => ({ id, eggBoughtAt: 1, hatchedAt: 2, stage: 1, feedCount: 0, speciesId: "blomp", pos: { x: 1, y: 1 }, ...extra });
const ids = (lista, f = "uid") => lista.map((a) => a[f]);

test("gårdsdjurens lista i farm-core = gårdsdjuren i katalogen", () => {
  assert.deepEqual([...GARDSDJUR].sort(), SHOP_ITEMS.filter((it) => it.farmAnimal).map((it) => it.id).sort());
});

test("ett djur utan post i kartan syns inte", () => {
  const sd = {
    roomAnimals: [{ uid: "fisk#1", id: "fisk" }, { uid: "hund#9", id: "hund" }],
    farm: { animals: [{ uid: "gris#1", id: "animal_pig" }, { uid: "ko#9", id: "animal_cow" }] },
    pets: [agg("p1"), agg("p9")],
    agdaDjur: { "fisk#1": "fisk", "gris#1": "animal_pig", p1: "mystery-egg" },
  };
  assert.deepEqual(ids(animalsFromData(sd)), ["fisk#1"]);
  assert.deepEqual(ids(farmFromData(sd).animals), ["gris#1"]);
  assert.deepEqual(ids(petsFromData(sd), "id"), ["p1"]);
  assert.deepEqual([animalsFromData({}), farmFromData({}).animals, petsFromData({})], [[], [], []], "utan karta syns inget");
});

test("ett ändrat id ger kartans art (fisk → dinosaurie, gris → häst)", () => {
  const sd = {
    roomAnimals: [{ uid: "fisk#1", id: "dinosaurie", name: "Nemo", pos: { x: 3, y: 4 } }],
    farm: { animals: [{ uid: "gris#1", id: "animal_horse" }] },
    agdaDjur: { "fisk#1": "fisk", "gris#1": "animal_pig" },
  };
  assert.deepEqual(animalsFromData(sd), [{ uid: "fisk#1", id: "fisk", pos: { x: 3, y: 4 }, name: "Nemo", stowed: false }]);
  assert.equal(farmFromData(sd).animals[0].id, "animal_pig");
});

test("ett vanligt ägg med Halloween-art blir en vanlig art; Halloween-ägget behåller sin", () => {
  const sd = {
    pets: [
      agg("p1", { eggSpecies: "gruffe", speciesId: "gruffe" }),
      agg("p2", { eggSpecies: "spokis", hatchedAt: null, speciesId: null, stage: 0 }),
      agg("p3", { eggSpecies: "pumpis", speciesId: "blomp" }),
      agg("p4", { speciesId: "blomp" }),
    ],
    agdaDjur: { p1: "mystery-egg", p2: "mystery-egg", p3: "hw-djur-uggli", p4: "mystery-egg" },
  };
  const [p1, p2, p3, p4] = petsFromData(sd);
  assert.equal(getSpecies(p1.speciesId).kind === "hw", false);
  assert.ok(VANLIGA.has(p1.speciesId), "en vanlig (äggets) art");
  assert.equal(p1.speciesId, vanligArtFor("p1"), "samma art varje gång");
  assert.equal(p1.eggSpecies, undefined);
  assert.equal(p2.eggSpecies, undefined, "okläckt vanligt ägg kläcks inte till Halloween-arten");
  assert.deepEqual([p3.eggSpecies, p3.speciesId], ["uggli", "uggli"], "kartans art, inte listans");
  assert.equal(p4.speciesId, "blomp", "en vanlig art står kvar (R5)");
  assert.ok(HW_SPECIES.some((s) => s.id === "uggli"));
});

test("värmelampan utan köp ger ingen effekt", () => {
  const sd = { pets: [agg("p1", { hasHeatLamp: true, hatchedAt: null })], agdaDjur: { p1: "mystery-egg" } };
  const [utan] = petsFromData(sd);
  assert.equal(utan.hasHeatLamp, false);
  assert.equal(pet.hatchTimeFor(utan), 1 + pet.HATCH_MS);
  const [med] = petsFromData({ ...sd, ownedItems: ["varmelampa"] });
  assert.equal(med.hasHeatLamp, true);
});

test("ett migrerat äldre djur syns som förut (rumsdjur ur ownedItems, gårdsdjur, husdjur, gamla pet)", () => {
  const fore = {
    xp: 0,
    ownedItems: ["hund", "keps"],
    roomAnimals: [{ id: "katt", pos: { x: 5, y: 6 } }, { uid: "fisk#a", id: "fisk", name: "Nemo" }],
    farm: { animals: [{ uid: "animal_cow#k", id: "animal_cow", trivsel: 50 }] },
    pet: { eggBoughtAt: 7, speciesId: "blomp", hatchedAt: 8, stage: 2, feedCount: 12 },
  };
  assert.deepEqual([animalsFromData(fore), farmFromData(fore).animals, petsFromData(fore)], [[], [], []], "före migreringen");
  const efter = { ...fore, ...planeraMigrering(fore) };
  assert.deepEqual(animalsFromData(efter).map((a) => [a.uid, a.id, a.name]), [["katt", "katt", null], ["fisk#a", "fisk", "Nemo"], ["hund", "hund", null]]);
  assert.deepEqual(animalsFromData(efter)[0].pos, { x: 5, y: 6 });
  assert.deepEqual(farmFromData(efter).animals.map((a) => [a.uid, a.id, a.trivsel]), [["animal_cow#k", "animal_cow", 50]]);
  const [p] = petsFromData(efter);
  assert.deepEqual([p.speciesId, p.stage, p.feedCount], ["blomp", 2, 12]);
});

test("ett uid från en annan lista syns inte (regel 1, egen kategori)", () => {
  const sd = {
    roomAnimals: [
      { uid: "dino#1", id: "dinosaurie" },
      { uid: "hast#1", id: "animal_horse" }, // gårdshästen kopierad till rummet
      { uid: "p1", id: "hund" }, // Halloween-äggets id som uid i rummet
    ],
    farm: { animals: [{ uid: "hast#1", id: "animal_horse" }, { uid: "dino#1", id: "animal_horse" }] },
    pets: [agg("p1"), agg("dino#1"), agg("hast#1")],
    agdaDjur: { "dino#1": "dinosaurie", "hast#1": "animal_horse", p1: "hw-djur-spokis" },
  };
  assert.deepEqual(ids(animalsFromData(sd)), ["dino#1"]);
  assert.deepEqual(ids(farmFromData(sd).animals), ["hast#1"]);
  assert.deepEqual(ids(petsFromData(sd), "id"), ["p1"]);
});

test("en duplicerad uid/id syns en gång (regel 2), första posten gäller", () => {
  const fem = (f) => Array.from({ length: 5 }, (_, i) => f(i));
  const sd = {
    roomAnimals: fem((i) => ({ uid: "fisk#1", id: "fisk", name: `F${i}` })),
    farm: { animals: fem((i) => ({ uid: "hast#1", id: "animal_horse", trivsel: 10 + i })) },
    pets: fem((i) => agg("p1", { feedCount: i })),
    agdaDjur: { "fisk#1": "fisk", "hast#1": "animal_horse", p1: "hw-djur-spokis" },
  };
  assert.deepEqual(animalsFromData(sd).map((a) => [a.uid, a.name]), [["fisk#1", "F0"]]);
  assert.deepEqual(farmFromData(sd).animals.map((a) => a.trivsel), [10]);
  assert.deepEqual(petsFromData(sd).map((p) => p.feedCount), [0]);
  // Äldre rumsdjur utan uid (uid = art) räknas också bara en gång.
  assert.equal(animalsFromData({ roomAnimals: [{ id: "katt" }, { id: "katt" }], agdaDjur: { katt: "katt" } }).length, 1);
});

test("medDoldaPoster: ändrade ägda poster på sin plats, dolda och dubbletter orörda, nya sist", () => {
  const sparade = [{ uid: "a", v: 0 }, { uid: "x", v: 0 }, { uid: "a", v: 9 }, null];
  assert.deepEqual(medDoldaPoster(sparade, [{ uid: "a", v: 1 }, { uid: "n", v: 1 }], (p) => p.uid),
    [{ uid: "a", v: 1 }, { uid: "x", v: 0 }, { uid: "a", v: 9 }, null, { uid: "n", v: 1 }]);
});

test("sparningen behåller djur utan kartpost (inget djur försvinner om migreringen missat)", async () => {
  globalThis.__fsData = {
    elev1: {
      roomAnimals: [{ uid: "fisk#1", id: "fisk", pos: { x: 1, y: 1 } }, { uid: "omigrerad", id: "katt", pos: { x: 2, y: 2 } }],
      pets: [agg("p1"), agg("omigrerat-agg")],
      agdaDjur: { "fisk#1": "fisk", p1: "mystery-egg" },
    },
  };
  const r = await djur.saveAnimalPositions({ "fisk#1": { x: 9, y: 9 } });
  assert.deepEqual(ids(r.animals), ["fisk#1"]);
  assert.deepEqual(globalThis.__fsData.elev1.roomAnimals.map((a) => [a.uid, a.pos.x]), [["fisk#1", 9], ["omigrerad", 2]]);
  const n = await pet.setPetName("p1", "Pip");
  assert.deepEqual(ids(n.pets, "id"), ["p1"]);
  assert.deepEqual(globalThis.__fsData.elev1.pets.map((p) => [p.id, p.name ?? null]), [["p1", "Pip"], ["omigrerat-agg", null]]);
  assert.equal((await djur.saveAnimalName("omigrerad", "X")).ok, false, "ett dolt djur kan inte ändras");
});
