// ============================================================================
// Migreringen inför myntlåset (#854, docs/SAKERHET-MYNT.md §6 B2 + §7) – den rena
// kärnan admin/migrera-mynt-las-core.mjs planeraMigrering(sd) → patch | null.
//   xp: saknas → xpFromProgress, finns → orört, "x"/negativt → rättas
//   agdaDjur: roomAnimals, äldre djur i ownedItems, farm.animals, pets, gamla `pet`
//   duplicerat uid → en post; uid i två listor → den första listans; befintlig post
//   skrivs aldrig över; bara listans egen kategori; andra körningen ändrar inget
//   utan djur (#856): ingen agdaDjur-/list-patch, djuren utan post bara räknas
// Körs med: node --test test/migrera-mynt-las.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planeraMigrering, agdaVardeForPet, myntSomHeltal } from "../admin/migrera-mynt-las-core.mjs";
import { xpFromProgress, xpFromStudentData } from "../src/leveling.js";
import { kopVara, butikVara } from "../src/butik-core.js";

const PROGRESS = { vikingar: { quiz: { completed: true, stars: 3 }, para: { completed: true, stars: 1 } } };
// Djurens poster kommer bara med { djur: true } (skriptets --djur, #856).
const kor = (sd) => planeraMigrering(sd, {}, { djur: true });
/** Patchen som update() skriver den (bara toppfält här). */
const efter = (sd, patch) => ({ ...structuredClone(sd), ...structuredClone(patch || {}) });

describe("xp", () => {
  it("ett dokument utan xp får det härledda värdet (samma som visas i dag)", () => {
    const sd = { progress: PROGRESS };
    const p = kor(sd);
    assert.equal(p.xp, xpFromProgress(PROGRESS));
    assert.equal(p.xp, xpFromStudentData(sd), "ingen elev tappar eller får XP");
    assert.ok(p.xp > 0);
    assert.deepEqual(kor({}), { xp: 0 }, "inget progress → 0");
  });
  it("ett dokument med xp lämnas orört", () => {
    assert.equal(kor({ xp: 0, progress: PROGRESS }), null);
    assert.equal(kor({ xp: 1234, progress: PROGRESS }), null);
  });
  it("xp som inte är ett tal ≥ 0 rättas", () => {
    for (const xp of ["x", -5, null, NaN, Infinity, "100"]) {
      assert.equal(kor({ xp, progress: PROGRESS }).xp, xpFromProgress(PROGRESS), String(xp));
    }
  });
});

// #855 F2: låset godtar bara heltal – ett decimaltal eller en sträng skulle neka
// varje kvitto för alltid.
describe("coins och xp blir heltal (#855 F2)", () => {
  it("xp som decimaltal avrundas nedåt, heltal lämnas", () => {
    const r = {};
    assert.deepEqual(planeraMigrering({ xp: 12.7, coins: 5 }, r), { xp: 12 });
    assert.equal(r.heltal, 1);
    assert.equal(kor({ xp: 12, coins: 5 }), null);
  });
  it("coins: decimal, negativt, talsträng och skräp normaliseras; saknat lämnas", () => {
    const fall = [[12.9, 12], [-3, 0], [-0.5, 0], ["120", 120], [" 7.8 ", 7], ["abc", 0], ["", 0], [null, 0], [NaN, 0],
      [Infinity, 0], [{ n: 5 }, 0], [true, 0]];
    for (const [coins, vantat] of fall) {
      assert.equal(myntSomHeltal(coins), vantat, String(coins));
      assert.deepEqual(kor({ xp: 0, coins }), { coins: vantat }, String(coins));
    }
    assert.equal(kor({ xp: 0 }), null, "saknat saldo rörs inte");
    assert.equal(kor({ xp: 0, coins: 0 }), null);
  });
  it("xp härlett ur progress med decimalstjärnor avrundas nedåt", () => {
    const progress = { so: { quiz: { stars: 2.55 } }, ma: { match: { stars: 1.3, completed: true } } };
    const p = kor({ progress });
    assert.ok(Number.isInteger(p.xp), String(p.xp));
    assert.equal(p.xp, Math.floor(xpFromProgress(progress)));
    assert.notEqual(xpFromProgress(progress), p.xp, "testet ska ha ett decimalvärde att avrunda");
  });
  it("idempotent: det normaliserade dokumentet ger null", () => {
    const sd = { xp: 3.5, coins: "40.2", progress: PROGRESS };
    assert.equal(kor({ ...sd, ...kor(sd) }), null);
  });
});

describe("agdaDjur – varje lista får sina poster", () => {
  it("roomAnimals: agdaDjur[uid] = art (uid saknas → art-id, som animalsFromData)", () => {
    const p = kor({ xp: 0, roomAnimals: [{ uid: "hund#a", id: "hund" }, { id: "fisk" }] });
    assert.deepEqual(p, { agdaDjur: { "hund#a": "hund", fisk: "fisk" } });
  });
  it("äldre djur i ownedItems blir roomAnimals-poster (uid = art-id) och får en post", () => {
    const sd = { xp: 0, ownedItems: ["keps", "katt", "hund"], roomAnimals: [{ uid: "hund#a", id: "hund" }] };
    const p = kor(sd);
    assert.deepEqual(p.roomAnimals.map((a) => [a.uid, a.id]), [["hund#a", "hund"], ["katt", "katt"]], "hunden finns redan som art");
    assert.deepEqual(p.roomAnimals[1], { uid: "katt", id: "katt", pos: { x: 30, y: 78 }, name: null, stowed: false });
    assert.deepEqual(p.agdaDjur, { "hund#a": "hund", katt: "katt" });
  });
  it("ett äldre djur vars art-id redan är ett uid får ett eget uid", () => {
    const p = kor({ xp: 0, ownedItems: ["hund"], roomAnimals: [{ uid: "hund", id: "fisk" }] });
    assert.deepEqual(p.roomAnimals.map((a) => a.uid), ["hund", "hund#2"]);
    assert.deepEqual(p.agdaDjur, { hund: "fisk", "hund#2": "hund" });
  });
  it("farm.animals: agdaDjur[uid] = art", () => {
    const p = kor({ xp: 0, farm: { animals: [{ uid: "animal_pig#1", id: "animal_pig" }, { uid: "h", id: "animal_horse" }] } });
    assert.deepEqual(p, { agdaDjur: { "animal_pig#1": "animal_pig", h: "animal_horse" } });
  });
  it("pets: mystery-egg, eller hw-djur-<art> för ett Halloween-ägg med känd art", () => {
    const p = kor({ xp: 0, pets: [{ id: "p1" }, { id: "p2", eggSpecies: "spokis" }, { id: "p3", eggSpecies: "finnsinte" },
      { id: "p4", speciesId: "spokis" }] });
    assert.deepEqual(p, { agdaDjur: { p1: "mystery-egg", p2: "hw-djur-spokis", p3: "mystery-egg", p4: "mystery-egg" } });
    assert.equal(agdaVardeForPet({ eggSpecies: "slemmis" }), "hw-djur-slemmis");
  });
  it("den gamla `pet` migreras till pets[0], skrivs tillbaka och får en post", () => {
    const sd = { xp: 0, pet: { eggBoughtAt: 5, hatchedAt: 6, speciesId: "blomp", stage: 2, feedCount: 12 } };
    const p = kor(sd);
    assert.equal(p.pets.length, 1);
    assert.equal(p.pets[0].speciesId, "blomp");
    assert.equal(p.pets[0].feedCount, 12);
    assert.deepEqual(p.agdaDjur, { [p.pets[0].id]: "mystery-egg" });
    assert.equal(kor(efter(sd, p)), null, "andra körningen: pets finns, kartan har posten");
    assert.equal(kor({ xp: 0, pet: { stage: 1 } }), null, "pet utan ägg = inget djur (som sparadePets)");
  });
  it("djur utanför listans kategori får ingen post (B4 regel 1)", () => {
    const p = kor({
      xp: 0,
      roomAnimals: [{ uid: "a", id: "animal_horse" }, { uid: "b", id: "keps" }, { uid: "c", id: "mystery-egg" }],
      farm: { animals: [{ uid: "d", id: "dinosaurie" }, { uid: "e", id: "hw-djur-spokis" }] },
    });
    assert.equal(p, null);
  });
});

describe("agdaDjur – första posten vinner, inget skrivs över", () => {
  it("en duplicerad uid ger en enda post (första posten)", () => {
    const p = kor({ xp: 0, roomAnimals: [{ uid: "x", id: "fisk" }, { uid: "x", id: "dinosaurie" }],
      farm: { animals: [{ uid: "g", id: "animal_pig" }, { uid: "g", id: "animal_horse" }] },
      pets: [{ id: "p" }, { id: "p", eggSpecies: "gruffe" }] });
    assert.deepEqual(p.agdaDjur, { x: "fisk", g: "animal_pig", p: "mystery-egg" });
  });
  it("ett uid i två listor får bara den första listans post (roomAnimals → farm.animals → pets)", () => {
    const p = kor({ xp: 0, roomAnimals: [{ uid: "delad", id: "dinosaurie" }],
      farm: { animals: [{ uid: "delad", id: "animal_horse" }, { uid: "p9", id: "animal_cow" }] },
      pets: [{ id: "p9", eggSpecies: "spokis" }] });
    assert.deepEqual(p.agdaDjur, { delad: "dinosaurie", p9: "animal_cow" });
  });
  it("en befintlig post skrivs aldrig över – och behålls när nya läggs till", () => {
    const sd = { xp: 0, agdaDjur: { "hund#a": "fisk", p1: "hw-djur-uggli" },
      roomAnimals: [{ uid: "hund#a", id: "dinosaurie" }, { uid: "k", id: "katt" }], pets: [{ id: "p1" }] };
    assert.deepEqual(kor(sd).agdaDjur, { "hund#a": "fisk", p1: "hw-djur-uggli", k: "katt" });
    assert.equal(kor({ ...sd, roomAnimals: [{ uid: "hund#a", id: "dinosaurie" }] }), null, "alla har redan en post");
  });
  it("ett köpt djur (butikKop) behåller köpets post", () => {
    const sd = { xp: 0, coins: 500 };
    const r = kopVara(sd, butikVara("dinosaurie"), { nu: 1, rng: () => 0.5 });
    const kopt = { ...sd, ...r.patch };
    assert.equal(kor(kopt), null, "köpet skrev redan agdaDjur");
    kopt.roomAnimals[0].id = "fisk";
    assert.equal(kor(kopt), null, "ett senare artbyte i listan ändrar inte kartan");
  });
});

describe("idempotens", () => {
  it("en andra körning ändrar ingenting", () => {
    const sd = {
      progress: PROGRESS, xp: "x", ownedItems: ["hund", "kanin", "keps"],
      roomAnimals: [{ uid: "fisk#1", id: "fisk" }, { uid: "fisk#1", id: "papegoja" }],
      farm: { barnLevel: 2, animals: [{ uid: "h1", id: "animal_horse" }] },
      pet: { eggBoughtAt: 1 }, agdaDjur: { gammal: "katt" },
    };
    const p = kor(sd);
    assert.ok(p.xp > 0 && p.roomAnimals && p.pets && p.agdaDjur);
    const rakna = {};
    planeraMigrering(sd, rakna, { djur: true });
    assert.deepEqual(rakna, { xp: 1, aldreDjur: 2, rumsdjur: 3, gardsdjur: 1, husdjur: 1, gammaltPet: 1 });
    assert.equal(kor(efter(sd, p)), null);
    assert.deepEqual(efter(sd, p).agdaDjur.gammal, "katt");
  });
  it("saldon och varor rörs aldrig", () => {
    const sd = { coins: 77, ownedItems: ["katt"], ownedCounts: { soffa: 2 }, appleCount: 3, roomAnimals: [] };
    const p = kor(sd);
    for (const k of ["coins", "ownedItems", "ownedCounts", "appleCount", "farm"]) assert.ok(!(k in p), k);
  });
  it("tåliga mot trasiga dokument", () => {
    assert.deepEqual(kor(null), { xp: 0 });
    assert.deepEqual(kor({ xp: 0, roomAnimals: "x", farm: "y", pets: [null, 5, { id: "" }], agdaDjur: [1] }), null);
  });
});

describe("utan djur (#856, skriptet utan --djur)", () => {
  const SD = {
    progress: PROGRESS, ownedItems: ["hund", "keps"],
    roomAnimals: [{ uid: "fisk#1", id: "fisk" }, { uid: "katt#1", id: "katt" }],
    farm: { animals: [{ uid: "h1", id: "animal_horse" }] },
    pets: [{ id: "p1", eggBoughtAt: 1 }], agdaDjur: { "katt#1": "katt" },
  };
  it("ingen patch för agdaDjur, roomAnimals eller pets – bara xp", () => {
    const r = {};
    const p = planeraMigrering(SD, r);
    assert.deepEqual(p, { xp: xpFromProgress(PROGRESS) });
    assert.equal(r.saknarPost, 4);
    assert.deepEqual(r.saknadeUid, ["fisk#1", "hund", "h1", "p1"]);
    assert.equal(planeraMigrering({ ...SD, xp: 5 }), null, "med xp: inget att skriva alls");
  });
  it("med djur blir det samma patch som förut", () => {
    const p = kor(SD);
    assert.deepEqual(p.agdaDjur, { "katt#1": "katt", "fisk#1": "fisk", hund: "hund", h1: "animal_horse", p1: "mystery-egg" });
    assert.ok(p.roomAnimals.some((a) => a.uid === "hund"));
  });
  it("det gamla `pet` rapporteras men skrivs inte om utan djur", () => {
    const r = {};
    assert.deepEqual(planeraMigrering({ xp: 0, pet: { eggBoughtAt: 1 } }, r), null);
    assert.deepEqual(r.saknadeUid, ["pet"]);
  });
  it("ett djur med post räknas inte som saknat", () => {
    const r = {};
    planeraMigrering({ xp: 0, roomAnimals: [{ uid: "katt#1", id: "katt" }], agdaDjur: { "katt#1": "katt" } }, r);
    assert.equal(r.saknarPost, undefined);
  });
});
