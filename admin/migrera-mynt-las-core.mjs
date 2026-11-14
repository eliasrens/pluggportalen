// ============================================================================
// Migreringen inför myntlåset – ren kärna (admin/migrera-mynt-las-core.mjs, #854)
// ----------------------------------------------------------------------------
// planeraMigrering(sd) → patch | null för ETT studentData-dokument (spec
// docs/SAKERHET-MYNT.md §6 B2 "Migrering" och §7). Skriptet
// admin/migrera-mynt-las.mjs kör den på alla dokument (torrt som standard).
//
//   xp        saknas fältet (eller är det inte ett tal ≥ 0) → xpFromProgress(progress),
//             samma värde som xpFromStudentData visar i dag, avrundat nedåt (låset
//             godtar bara heltal). Ett decimaltal → Math.floor.
//   coins     måste vara ett heltal ≥ 0 för låset (#855 F2: reglerna godtar bara
//             `int`, annars nekas varje kvitto och eleven får aldrig mer mynt):
//             decimaltal → Math.floor, negativt → 0, en sträng med ett tal
//             ("120") → talet avrundat nedåt, allt annat (text, null, map) → 0.
//             Saknas fältet lämnas det (reglerna räknar det som 0).
//   agdaDjur  ägarbeviset { uid: varu-id } för varje djur som saknar en post:
//             listorna i FAST ordning roomAnimals → äldre djur i ownedItems →
//             farm.animals → pets. Bara FÖRSTA posten per uid (husdjur: id) räknas,
//             ett uid som redan har en post (köp, tidigare lista, tidigare körning)
//             får aldrig en ny eller ändrad post, och bara djur i listans egen
//             kategori får en (B4 regel 1).
//               roomAnimals  agdaDjur[uid || id] = id   (isAnimalItem)
//               äldre djur   skrivs först in som roomAnimals-poster (uid = art-id,
//                            rumsdjurMedAldre i src/butik-core.js) och får en post
//               farm.animals agdaDjur[uid] = id          (isFarmAnimalItem)
//               pets         agdaDjur[id] = "hw-djur-<eggSpecies>" för ett ägg med en
//                            känd Halloween-art, annars "mystery-egg". Den gamla
//                            `pet` migreras först till pets[0] (sparadePets) och
//                            skrivs tillbaka.
//             BARA med { djur: true } (skriptets --djur, #856): listorna är fritt
//             skrivbara för eleven efter låset, så en körning med djur EFTER
//             låsreglerna skulle ge ett inskjutet djur en post. Utan djur skrivs bara
//             xp/coins, och djur som saknar en post räknas (rakna.saknarPost) och
//             listas (rakna.saknadeUid) utan att något skrivs.
// Saldon och varor rörs annars aldrig. Idempotent: en andra körning ger null.
// ============================================================================

import { xpFromProgress } from "../src/leveling.js";
import { isAnimalItem, isFarmAnimalItem } from "../src/shop-items.js";
import { sparadePets } from "../src/klass-membership.js";
import { rumsdjurMedAldre, EGG_ITEM_ID } from "../src/butik-core.js";
import { HW_DJUR_VAROR } from "../src/halloween/hw-djur-katalog.js";

const HW_AGG = new Set(HW_DJUR_VAROR.map((v) => v.id));

/** Kartans värde för ett husdjur: Halloween-ägget med sin art, annars det vanliga ägget. */
export function agdaVardeForPet(pet) {
  const hw = "hw-djur-" + pet.eggSpecies;
  return typeof pet.eggSpecies === "string" && HW_AGG.has(hw) ? hw : EGG_ITEM_ID;
}

const okXp = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const heltalOk = (v) => Number.isInteger(v) && v >= 0;

/** coins som heltal ≥ 0 (se huvudet): tal och talsträngar avrundas nedåt, annat → 0. */
export function myntSomHeltal(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
const nyckelOk = (k) => typeof k === "string" && k.length > 0;

/**
 * Migreringen för ett dokument. `djur` = ge djur utan post en post i agdaDjur
 * (se huvudet). `rakna` (valfri) får antalet per åtgärd:
 * xp, heltal, aldreDjur, rumsdjur, gardsdjur, husdjur, gammaltPet – utan djur i
 * stället saknarPost och listan saknadeUid.
 * @returns {object|null} patch för update(), eller null om inget behövs
 */
export function planeraMigrering(sd, rakna = {}, { djur = false } = {}) {
  const d = sd && typeof sd === "object" ? sd : {};
  const plus = (k, n = 1) => { rakna[k] = (rakna[k] || 0) + n; };
  const patch = {};
  if (!okXp(d.xp)) {
    patch.xp = Math.floor(xpFromProgress(d.progress || {})); // stjärnor kan vara decimaltal (#855 F2)
    plus("xp");
  } else if (!heltalOk(d.xp)) {
    patch.xp = Math.floor(d.xp);
    plus("heltal");
  }
  if ("coins" in d && !heltalOk(d.coins)) {
    patch.coins = myntSomHeltal(d.coins);
    plus("heltal");
  }

  const befintlig = d.agdaDjur && typeof d.agdaDjur === "object" && !Array.isArray(d.agdaDjur) ? d.agdaDjur : {};
  const nya = new Map();
  const satt = (k, v, vad) => {
    if (!nyckelOk(k) || Object.hasOwn(befintlig, k) || nya.has(k)) return;
    nya.set(k, v);
    if (djur) plus(vad);
  };

  const sparade = Array.isArray(d.roomAnimals) ? d.roomAnimals : [];
  const rum = rumsdjurMedAldre(d);
  if (djur && rum.length > sparade.length) {
    patch.roomAnimals = rum;
    plus("aldreDjur", rum.length - sparade.length);
  }
  for (const a of rum) if (a && isAnimalItem(a.id)) satt(a.uid || a.id, a.id, "rumsdjur");
  // Den sparade listan (farmFromData visar bara djur som redan har en kartpost, #856).
  const gard = d.farm && typeof d.farm === "object" ? d.farm.animals : null;
  for (const a of Array.isArray(gard) ? gard : []) if (a && isFarmAnimalItem(a.id)) satt(a.uid, a.id, "gardsdjur");
  const pets = sparadePets(d);
  if (djur && !Array.isArray(d.pets) && pets.length) {
    patch.pets = pets;
    plus("gammaltPet");
  }
  // Det gamla `pet` har inget stabilt id förrän det skrivits till pets[] (bara med djur).
  const petsMedId = djur || Array.isArray(d.pets) ? pets : [];
  for (const p of petsMedId) if (p && typeof p === "object") satt(p.id, agdaVardeForPet(p), "husdjur");
  if (!djur && !Array.isArray(d.pets) && pets.length) nya.set("pet", EGG_ITEM_ID);

  if (djur && nya.size) patch.agdaDjur = Object.fromEntries([...Object.entries(befintlig), ...nya]);
  if (!djur && nya.size) {
    plus("saknarPost", nya.size);
    rakna.saknadeUid = [...(rakna.saknadeUid || []), ...nya.keys()];
  }
  return Object.keys(patch).length ? patch : null;
}
