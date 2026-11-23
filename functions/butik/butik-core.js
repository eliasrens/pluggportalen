// ============================================================================
// Pluggporten – butikens rena kärna (src/butik-core.js, #854, epic #851)
// ----------------------------------------------------------------------------
// Ett köp, utan Firebase: kopVara(data, vara, { nu, rng, sasong }) → { ok, patch,
// result }. Servern (functions/butik-kop.js, callable butikKop) slår upp varan i
// katalogen, läser studentData i en transaktion och skriver `patch` med update();
// `result` går oförändrat tillbaka till klienten (samma form som de gamla
// klientfunktionerna, så pages-shop.js kunde stå kvar). Priset och mysterylådans
// lottning avgörs här – klienten skickar bara varans id.
//
// Kopieras till functions/butik/ av admin/sync-butik-functions.mjs (npm run
// sync:butik, predeploy) – redigera alltid här. Bara relativa importer av andra
// rena filer i listan där (shop-items, mystery-items, season-config, farm-core,
// klass-membership, halloween/hw-kostymer, halloween/hw-djur-katalog, jul/jul-katalog,
// jul/jul-djur-katalog).
//
// Nytt mot de gamla klientköpen: ägg (K3), vanliga djur (K6) och gårdsdjur (K7)
// skriver ägarbeviset agdaDjur.<uid> = <varu-id> i samma skrivning – kartan som
// B4:s läsfunktioner och B1:s gåvoregel läser (docs/SAKERHET-MYNT.md §6 B2).
// ============================================================================

import { getItem, isAnimalItem, isMultiItem } from "./shop-items.js";
import { rollMysteryItem, dupCoins } from "./mystery-items.js";
import { TILLAGG, tillaggAktivt } from "./season-config.js";
import { farmFromData, addFarmAnimalIn } from "./farm-core.js";
import { newPetId, ownedCount, petsFromData } from "./klass-membership.js";
import { HW_KOSTYMER_KATALOG } from "./halloween/hw-kostymer.js";
import { HW_DJUR_VAROR } from "./halloween/hw-djur-katalog.js";
import { JUL_VAROR } from "./jul/jul-katalog.js";
import { JUL_DJUR_VAROR } from "./jul/jul-djur-katalog.js";

export const EGG_ITEM_ID = "mystery-egg";
export const LAMP_ITEM_ID = "varmelampa";

// Halloween-kostymerna och -djuren och Jul-samlingen (#910) och -djuren (#912) slås in i SHOP_ITEMS
// lazy i webbläsaren; servern läser raderna direkt.
const LAZY_VAROR = new Map([...HW_KOSTYMER_KATALOG, ...HW_DJUR_VAROR, ...JUL_VAROR, ...JUL_DJUR_VAROR].map((it) => [it.id, it]));

/** Katalogposten för ett varu-id (statiska katalogen + de lazy samlingsvarorna) eller null. */
export function butikVara(id) {
  if (typeof id !== "string" || !id) return null;
  return getItem(id) || LAZY_VAROR.get(id) || null;
}

/** Är säsongssamlingen öppen (dess tillägg i TILLAGG är på)? `sasong` = config/season (rått eller normaliserat). */
export function samlingOppen(samling, sasong, nu) {
  return TILLAGG.some((t) => t.samling === samling && tillaggAktivt(sasong, t.id, nu));
}

/** Fyra slumpade base36-tecken efter tiden – samma form som klientens id:n. */
const slump = (nu, rng) => nu.toString(36) + Math.floor(rng() * 36 ** 4).toString(36).padStart(4, "0");
/** Slumpad startposition nere på golvet (samma spridning som förut). */
const golvPos = (rng) => ({ x: 30 + Math.round(rng() * 40), y: 70 + Math.round(rng() * 15) });
const lista = (v) => (Array.isArray(v) ? v : []);
const karta = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
/** Ett nytt id som inte redan finns i `upptagna` (krock → löpnummer, aldrig en evig slinga). */
function unikt(skapa, upptagna) {
  const id = skapa();
  let ut = id;
  for (let i = 2; upptagna.has(ut); i++) ut = `${id}${i}`;
  return ut;
}

/**
 * roomAnimals som de är sparade + äldre djur som bara finns i ownedItems (köpta som
 * statiska möbler förr, ett per art) med uid = art-id – samma regel som
 * animalsFromData (data-animals.js) läser dem i dag. Används av köpet (listan som
 * skrivs ner) och av migreringen (admin/migrera-mynt-las-core.mjs).
 */
export function rumsdjurMedAldre(data) {
  const sparade = lista(data && data.roomAnimals);
  const uids = new Set(sparade.map((a) => a && (a.uid || a.id)));
  const arter = new Set(sparade.filter((a) => a && isAnimalItem(a.id)).map((a) => a.id));
  const aldre = [];
  for (const id of lista(data && data.ownedItems)) {
    if (!isAnimalItem(id) || arter.has(id)) continue;
    arter.add(id);
    let uid = id;
    for (let i = 2; uids.has(uid); i++) uid = `${id}#${i}`;
    uids.add(uid);
    aldre.push({ uid, id, pos: { x: 30 + ((aldre.length * 13) % 40), y: 78 }, name: null, stowed: false });
  }
  return [...sparade, ...aldre];
}

/**
 * Ett köp av `vara` (katalogposten, butikVara) för eleven med studentData `data`.
 * Saknas varan, säljs den inte (comingSoon, mystery-vara direkt, pris ≤ 0) eller är
 * samlingen stängd → ok:false. En single-vara som redan ägs → ok:true utan patch.
 * @param {object} data studentData (saknat dokument = {})
 * @param {object|null} vara
 * @param {{ nu?: number, rng?: () => number, sasong?: object|null }} [opt]
 * @returns {{ ok: boolean, patch: object|null, result: object }}
 */
export function kopVara(data, vara, { nu = Date.now(), rng = Math.random, sasong = null } = {}) {
  const d = karta(data);
  const coins = Number.isFinite(d.coins) ? d.coins : 0;
  const nej = (error, extra = {}) => ({ ok: false, patch: null, result: { ok: false, coins, ...extra, error } });
  const kop = (patch, extra) => ({ ok: true, patch: { coins: coins - pris, ...patch }, result: { ok: true, coins: coins - pris, ...extra } });
  if (!vara) return nej("Varan finns inte.");
  const pris = vara.price;
  if (vara.comingSoon || vara.mysteryOnly || !Number.isInteger(pris) || pris <= 0) return nej("Varan säljs inte.");
  if (vara.collection && !samlingOppen(vara.collection, sasong, nu)) return nej("Varan säljs inte just nu.");
  const id = vara.id;
  const owned = lista(d.ownedItems);
  const fattig = coins < pris;
  const agda = (uid) => ({ agdaDjur: { ...karta(d.agdaDjur), [uid]: id } });

  // K2/E6 – mysterylådan: lottningen här, dubbletten blir mynt (dupCoins).
  if (vara.mysteryBox) {
    if (fattig) return nej("För få mynt.");
    const vinst = rollMysteryItem(rng, { legendaryChance: vara.legendaryChance ?? null });
    const duplicate = owned.includes(vinst.id);
    const refund = duplicate ? dupCoins(vinst.rarity) : 0;
    const nextOwned = duplicate ? owned : [...owned, vinst.id];
    const r = kop({ ownedItems: nextOwned }, { item: vinst, duplicate, refund, owned: nextOwned });
    r.patch.coins += refund;
    r.result.coins += refund;
    return r;
  }

  // K3 – ägg (vanligt, pumpaägg eller julklappsägg, arten ur katalogen).
  if (id === EGG_ITEM_ID || vara.hatchSpecies) {
    const pets = petsFromData(d, newPetId(nu, rng));
    if (fattig) return nej("För få mynt.", { pets });
    const eggId = unikt(() => newPetId(nu, rng), new Set(pets.map((p) => p && p.id)));
    const egg = {
      id: eggId, name: null, eggBoughtAt: nu, hasHeatLamp: owned.includes(LAMP_ITEM_ID), speciesId: null,
      hatchedAt: null, stage: 0, feedCount: 0, lastFedAt: null, pos: golvPos(rng),
      ...(vara.hatchSpecies ? { eggSpecies: vara.hatchSpecies } : {}),
    };
    const next = [...pets, egg];
    return kop({ pets: next, ...agda(eggId) }, { pets: next });
  }

  // K4 – värmelampan: en gång, alla okläckta ägg kläcks snabbare.
  if (id === LAMP_ITEM_ID) {
    const pets = petsFromData(d, newPetId(nu, rng));
    if (owned.includes(id)) return { ok: true, patch: null, result: { ok: true, coins, owned, pets } };
    if (fattig) return nej("För få mynt.", { owned, pets });
    const next = pets.map((p) => (!p || p.hatchedAt ? p : { ...p, hasHeatLamp: true }));
    const nextOwned = [...owned, id];
    return kop({ ownedItems: nextOwned, pets: next }, { owned: nextOwned, pets: next });
  }

  // K5 – Mysterymat (förbrukningsvara, aldrig ownedItems).
  if (vara.consumable) {
    const count = Number.isFinite(d.appleCount) ? d.appleCount : 0;
    if (fattig) return nej("För få mynt.", { appleCount: count });
    return kop({ appleCount: count + 1 }, { appleCount: count + 1 });
  }

  // K7 – bondgårdsdjur i farm.animals.
  if (vara.farmAnimal) {
    const farm = farmFromData(d);
    if (fattig) return nej("För få mynt.", { farm });
    const uid = unikt(() => id + "#" + slump(nu, rng), new Set(farm.animals.map((a) => a.uid)));
    const res = addFarmAnimalIn(farm, uid, id);
    if (!res.ok) return nej(res.error, { farm });
    return kop({ "farm.animals": res.farm.animals, ...agda(uid) }, { farm: res.farm, animal: res.animal });
  }

  // K8 – gårdsuppgradering: bara nivån ett steg över den nuvarande.
  if (vara.farmUpgrade) {
    const falt = vara.farmUpgrade === "garden" ? "gardenTier" : "barnLevel";
    const farm = farmFromData(d);
    if (vara.upgradeLevel !== farm[falt] + 1) return nej("fel nivå", { farm });
    if (fattig) return nej("för få coins", { farm });
    return kop({ ["farm." + falt]: vara.upgradeLevel }, { farm: { ...farm, [falt]: vara.upgradeLevel } });
  }

  // K6 – vanliga djur i roomAnimals (äldre djur ur ownedItems följer med som förut).
  // Klassningen tar katalogposten: de lazy varorna (t.ex. Jul, #910) finns inte i
  // servern SHOP_ITEMS, så ett id ensamt hade gjort dem till single-varor.
  if (isAnimalItem(vara)) {
    const animals = rumsdjurMedAldre(d);
    if (fattig) return nej("För få mynt.", { animals });
    const uid = unikt(() => id + "#" + slump(nu, rng), new Set(animals.map((a) => a && (a.uid || a.id))));
    const next = [...animals, { uid, id, pos: golvPos(rng), name: null, stowed: false }];
    return kop({ roomAnimals: next, ...agda(uid) }, { animals: next });
  }

  // K1 – allt annat: single-varor en gång, multi-varor räknas upp i ownedCounts.
  const counts = karta(d.ownedCounts);
  const multi = isMultiItem(vara);
  if (!multi && owned.includes(id)) return { ok: true, patch: null, result: { ok: true, coins, owned, counts } };
  if (fattig) return nej("För få mynt.", { owned, counts });
  const nextOwned = owned.includes(id) ? owned : [...owned, id];
  if (!multi) return kop({ ownedItems: nextOwned }, { owned: nextOwned, counts });
  const nextCounts = { ...counts, [id]: ownedCount(d, id) + 1 };
  return kop({ ownedItems: nextOwned, ownedCounts: nextCounts }, { owned: nextOwned, counts: nextCounts });
}
