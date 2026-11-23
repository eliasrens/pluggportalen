// ============================================================================
// Tester: tio Jul-djur + julklappsägget (#912, epic #906, DEL F)
//   • katalogen: 10 arter (JUL_SPECIES) med fasta id:n, mystery-flagga, 3 stegnamn,
//     julklappsägget; 10 varor i 🎄 Jul-fliken (500 mynt, undergrupp "djur"),
//     inslagna lazy i SHOP_ITEMS (shop-items.js ligger vid filtaket)
//   • köp Renis (kopVara, som servern) → julklappsägg i pets[] (coins −500) →
//     kläcks till Renis; Jul av → säljs inte
//   • Renis är hungrig, äter Mysterymat och växer 1 → 2 → 3, sedan mätt
//   • 10 djur × 3 steg × 4 uttryck (+ vila) ritas utan fel, stegen och uttrycken
//     skiljer sig, steg 3 bär en julsak; före laddning = null (anroparen visar fallback)
//   • texterna: julklappsägg/🎁 i köpbekräftelsen (pumpaägget oförändrat);
//     Emoji ≤ 12 för varorna prövas i test/sasong-emoji.test.js
// data-pet.js körs på riktigt mot en minnes-Firestore via samma loader-krok som
// test/halloween-djur.test.js.
// ============================================================================

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { JUL_SPECIES, HW_SPECIES, getSpecies, creatureArt, creatureSvg, EXPRESSIONS } from "../src/art-pets-creatures.js";
import { SPRITE_SPECIES } from "../src/art-pet-sprites.js";
import { eggSvg } from "../src/art-pets.js";
import { itemSvg, loadCollectionArt } from "../src/art-items.js";
import { getItem, itemsInCollection, itemsInCategory, isAnimalItem, isMultiItem } from "../src/shop-items.js";
import { butikVara, kopVara } from "../src/butik-core.js";
import { JUL_DJUR_VAROR } from "../src/jul/jul-djur-katalog.js";

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
  if (spec === "./data.js" && ["/src/data-pet.js", "/src/data-pet-mat.js"].some((f) => ctx.parentURL.endsWith(f))) {
    return stub("export const currentStudentId = () => 'elev1'; export function invalidateStudentData() {}");
  }
  return next(spec, ctx);
}`;

const ID = ["snois", "renis", "pingvis", "pepparis", "isbjornis", "tomtis", "ravis", "snougglis", "glittris", "julklappis"];
const JUL_PA = { season: "vinter", halloween: false, jul: true, julUntil: null };
let pet;

before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  pet = await import("../src/data-pet.js");
});

test("katalogen: tio arter, fasta id:n, mystery-flagga, tre stegnamn, julklappsägget", () => {
  assert.deepEqual(JUL_SPECIES.map((s) => s.id), ID);
  for (const s of JUL_SPECIES) {
    assert.equal(getSpecies(s.id), s);
    assert.equal(s.mystery, true, s.id);
    assert.equal(s.kind, "jul");
    assert.equal(s.stageNames.length, 3, s.id);
    assert.equal(new Set(s.stageNames).size, 3, s.id);
    assert.equal(s.egg, "jul-julklappsagg");
    assert.equal(s.eggName, "julklappsägg");
  }
  const alla = [...HW_SPECIES, ...JUL_SPECIES, ...SPRITE_SPECIES].map((s) => s.id);
  assert.equal(new Set(alla).size, alla.length, "inga id-krockar med Halloween- eller sprite-arterna");
  // Varorna: samma ordning och namn som arterna (servern läser katalogen).
  assert.deepEqual(JUL_DJUR_VAROR.map((v) => [v.id, v.hatchSpecies, v.name]), JUL_SPECIES.map((s) => ["jul-djur-" + s.id, s.id, s.name]));
  for (const v of JUL_DJUR_VAROR) {
    assert.equal(v.price, 500);
    assert.equal(v.collection, "jul");
    assert.equal(butikVara(v.id), v, "servern känner varan (butikVara)");
    assert.equal(isMultiItem(v), false, "ett ägg är ingen multi-vara");
    assert.equal(isAnimalItem(v), false, "inget vanligt rumsdjur");
  }
});

test("före laddning: ingen konst → anroparna faller tillbaka (🐾 / mystery-ägget)", () => {
  assert.equal(creatureArt("renis", "glad", 2), null);
  assert.equal(itemSvg("jul-djur-renis"), null);
  assert.equal(eggSvg("jul-julklappsagg"), eggSvg(), "okänt ägg → mystery-ägget");
});

test("butiken: tio julklappsägg à 500 mynt i Jul-flikens djur-grupp (lazy)", async () => {
  assert.equal(getItem("jul-djur-renis"), null, "varorna slås in lazy – shop-items.js orörd (filtak + bootgraf)");
  await loadCollectionArt();
  const varor = itemsInCollection("jul").filter((it) => it.hatchSpecies);
  assert.deepEqual(varor.map((it) => it.hatchSpecies), ID);
  assert.ok(itemsInCategory("husdjur").every((it) => !it.hatchSpecies), "bara i samlingsflikarna");
  const { JUL_SAMLING } = await import("../src/jul/jul-butik.js");
  const djur = JUL_SAMLING.sektioner().find((s) => s.id === "djur");
  assert.equal(djur.items.length, 10);
  assert.ok(djur.items.every((it) => it.collection === "jul"), "inga Halloween-ägg i Jul-fliken");
});

test("efter laddning 10 × 3 × 4 (+ vila) utan fel, tre steg, julsak i steg 3", async () => {
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
    assert.match(creatureArt(id, "", 3), /hw-glod/, `${id} steg 3 har glöd`);
    assert.match(creatureArt(id, "", 3), /jd-julsak/, `${id} steg 3 bär en julsak`);
    assert.doesNotMatch(creatureArt(id, "", 2), /jd-julsak/, `${id} steg 2 har ingen julsak än`);
    assert.match(creatureArt(id, "ater", 2), /hwd-mums/, `${id} tuggar när den äter`);
    assert.ok(itemSvg("jul-djur-" + id).includes("<svg"), `${id}: butikskortet`);
  }
  assert.match(eggSvg("jul-julklappsagg"), /aria-label="Julklappsägg"/);
  assert.ok(balanserad(eggSvg("jul-julklappsagg")));
});

test("köp Renis för 500 (Jul på) → julklappsägg som kläcks till Renis; Jul av → nej", async () => {
  const kop = (id, sasong = JUL_PA) => {
    const r = kopVara(globalThis.__fsData.elev1, butikVara(id), { sasong });
    if (r.patch) Object.assign(globalThis.__fsData.elev1, structuredClone(r.patch));
    return r.result;
  };
  globalThis.__fsData = { elev1: { coins: 700, ownedItems: [], pets: [] } };
  assert.equal(kop("jul-djur-renis", { jul: false }).ok, false, "Jul av → säljs inte");
  assert.equal(kop("jul-djur-renis", { halloween: true }).ok, false, "Halloween på räcker inte");
  assert.equal(globalThis.__fsData.elev1.coins, 700);
  const res = kop("jul-djur-renis");
  assert.equal(res.ok, true);
  assert.equal(res.coins, 200);
  const agg = res.pets[0];
  assert.equal(agg.eggSpecies, "renis");
  assert.equal(agg.hatchedAt, null);
  assert.deepEqual(globalThis.__fsData.elev1.ownedItems, [], "ägget hamnar aldrig i ownedItems");
  assert.equal(kop("jul-djur-tomtis").ok, false, "för lite pengar");
  assert.equal(globalThis.__fsData.elev1.pets.length, 1);

  assert.deepEqual((await pet.hatchReadyPets()).justHatchedIds, []);
  const nu = Date.now;
  Date.now = () => nu() + pet.HATCH_MS + 1000;
  try {
    const { pets, justHatchedIds } = await pet.hatchReadyPets();
    assert.deepEqual(justHatchedIds, [agg.id]);
    assert.equal(pets[0].speciesId, "renis");
    assert.equal(pets[0].stage, 1);
  } finally {
    Date.now = nu;
  }
});

test("Renis blir hungrig, äter Mysterymat och växer genom alla tre stegen", async () => {
  const p = () => globalThis.__fsData.elev1.pets[0];
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
  assert.equal(pet.isFullGrown(p()), true);
  assert.equal(pet.isHungry(p()), false);
});

test("texterna: julklappsägg 🎁 för Jul-djuren, pumpaägg 🎃 för Halloween som förut", async () => {
  const { kopMeddelande } = await import("../src/pages-shop-kopt.js");
  assert.equal(kopMeddelande(butikVara("jul-djur-renis"), {}), "Du köpte ett julklappsägg med Renis i! 🎁 Det ruvar nu i Mitt rum.");
  assert.equal(kopMeddelande(butikVara("hw-djur-spokis"), {}), "Du köpte ett pumpaägg med Spökis i! 🎃 Det ruvar nu i Mitt rum.");
  // Rummet och panelen tar äggets emoji/namn från arten (ingen hårdkodad 🎃 kvar).
  for (const f of ["src/pages-rum-pets.js", "src/pages-rum-pet-panel.js"]) {
    assert.doesNotMatch(readFileSync(new URL("../" + f, import.meta.url), "utf8"), /🎃/, f);
  }
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
