// ============================================================================
// Migreringen inför myntlåset – ren kärna (admin/migrera-mynt-las-core.mjs, #854)
// ----------------------------------------------------------------------------
// planeraMigrering(sd) → patch | null för ETT studentData-dokument (spec
// docs/SAKERHET-MYNT.md §6 B2 "Migrering" och §7). Skriptet
// admin/migrera-mynt-las.mjs kör den på alla dokument (torrt som standard).
//
//   xp        saknas fältet (eller är det inte ett tal ≥ 0) → xpFromProgress(progress),
//             samma värde som xpFromStudentData visar i dag.
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
//                            `pet` migreras först till pets[0] (petsFromData) och
//                            skrivs tillbaka.
// Saldon och varor rörs aldrig. Idempotent: en andra körning ger null.
// ============================================================================

import { xpFromProgress } from "../src/leveling.js";
import { isAnimalItem, isFarmAnimalItem } from "../src/shop-items.js";
import { farmFromData } from "../src/farm-core.js";
import { petsFromData } from "../src/klass-membership.js";
import { rumsdjurMedAldre, EGG_ITEM_ID } from "../src/butik-core.js";
import { HW_DJUR_VAROR } from "../src/halloween/hw-djur-katalog.js";

const HW_AGG = new Set(HW_DJUR_VAROR.map((v) => v.id));

/** Kartans värde för ett husdjur: Halloween-ägget med sin art, annars det vanliga ägget. */
export function agdaVardeForPet(pet) {
  const hw = "hw-djur-" + pet.eggSpecies;
  return typeof pet.eggSpecies === "string" && HW_AGG.has(hw) ? hw : EGG_ITEM_ID;
}

const okXp = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const nyckelOk = (k) => typeof k === "string" && k.length > 0;

/**
 * Migreringen för ett dokument. `rakna` (valfri) får antalet per åtgärd:
 * xp, aldreDjur, rumsdjur, gardsdjur, husdjur, gammaltPet.
 * @returns {object|null} patch för update(), eller null om inget behövs
 */
export function planeraMigrering(sd, rakna = {}) {
  const d = sd && typeof sd === "object" ? sd : {};
  const plus = (k, n = 1) => { rakna[k] = (rakna[k] || 0) + n; };
  const patch = {};
  if (!okXp(d.xp)) {
    patch.xp = xpFromProgress(d.progress || {});
    plus("xp");
  }

  const befintlig = d.agdaDjur && typeof d.agdaDjur === "object" && !Array.isArray(d.agdaDjur) ? d.agdaDjur : {};
  const nya = new Map();
  const satt = (k, v, vad) => {
    if (!nyckelOk(k) || Object.hasOwn(befintlig, k) || nya.has(k)) return;
    nya.set(k, v);
    plus(vad);
  };

  const sparade = Array.isArray(d.roomAnimals) ? d.roomAnimals : [];
  const rum = rumsdjurMedAldre(d);
  if (rum.length > sparade.length) {
    patch.roomAnimals = rum;
    plus("aldreDjur", rum.length - sparade.length);
  }
  for (const a of rum) if (a && isAnimalItem(a.id)) satt(a.uid || a.id, a.id, "rumsdjur");
  for (const a of farmFromData(d).animals) if (isFarmAnimalItem(a.id)) satt(a.uid, a.id, "gardsdjur");
  const pets = petsFromData(d);
  if (!Array.isArray(d.pets) && pets.length) {
    patch.pets = pets;
    plus("gammaltPet");
  }
  for (const p of pets) if (p && typeof p === "object") satt(p.id, agdaVardeForPet(p), "husdjur");

  if (nya.size) patch.agdaDjur = Object.fromEntries([...Object.entries(befintlig), ...nya]);
  return Object.keys(patch).length ? patch : null;
}
