// ============================================================================
// Pluggporten – gården (data-farm.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (samma mönster som data-animals.js/
// data-pet.js, re-exporteras via data.js): allt som rör `studentData.farm` –
// gård-expansionens datalager (laggård, odlingsbädd, skörde-förråd och
// djurplaceringar). INGA UI-beroenden här.
//
// All ren tillståndslogik (validering, slots, tillväxt, skörd, placeringar)
// bor i den BROWSER-FRIA kärnan farm-core.js och anropas inne i
// transaktionerna här – kärnan enhets-testas med `node --test`, den här
// modulen är bara Firestore-wiring (runTransaction + cache-invalidering).
//
// Skrivmönster: varje skrivning läser dokumentet i en transaktion,
// normaliserar med farmFromData (bakåtkompatibel default-merge för gamla
// dokument utan `farm`), kör den rena övergången och skriver ändrade fält med
// DOT-PATH (`farm.gardenSlots` …) så inget annat i farm-objektet – eller
// dokumentet – skrivs över. Saknas dokumentet skapas det som
// defaultStudentData + farm (samma mönster som addCoins i data.js).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  currentStudentId,
  getStudentData,
  defaultStudentData,
  invalidateStudentData,
  ownedCount,
} from "./data.js";
import {
  farmFromData,
  plantCropIn,
  advanceGrowthIn,
  advanceAllGrowthIn,
  harvestFrom,
  adjustInventoryIn,
  setPlacementIn,
  renameFarmAnimalIn,
  withFarmAnimalPositions,
  feedFarmAnimalIn,
  claimGiftIn,
  FARM_GIFT_COINS,
  FARM_MAX_GROWTH_STAGE,
} from "./farm-core.js";
import { getItem } from "./shop-items.js";

/**
 * Hela gårds-tillståndet för inloggad (eller angiven) elev, alltid ett
 * komplett giltigt farm-objekt (gamla dokument utan `farm` → defaultFarm).
 * Läser via getStudentData → session-cachad som allt annat.
 * @returns {Promise<object>} farm-objekt (se farm-core.js/DATAMODELL.md)
 */
export async function getFarm(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return farmFromData(data);
}

/**
 * Gemensam skriv-hjälpare: kör en ren farm-övergång i EN transaktion och
 * skriver de fält övergången ändrade med dot-path. `fn(farm)` är en av
 * farm-core-funktionerna och returnerar `{ ok, farm, ... }`; vid ok:false
 * skrivs inget. `fields` är farm-fälten som ska persisteras vid ok.
 */
async function updateFarm(studentId, fields, fn) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const farm = farmFromData(snap.exists() ? snap.data() : null);
    const res = fn(farm);
    if (!res.ok) return res;
    if (snap.exists()) {
      const write = {};
      for (const f of fields) write["farm." + f] = res.farm[f];
      tx.update(ref, write);
    } else {
      tx.set(ref, { ...defaultStudentData(), farm: res.farm });
    }
    return res;
  });
  if (result.ok) invalidateStudentData(studentId); // farm ändrat → färsk läsning (#274)
  return result;
}

/**
 * Så en gröda i en tom slot i odlingsbädden.
 * @param {number} slotIndex  0-baserat, < slotCountForTier(gardenTier)
 * @param {string} cropId     grödans id (t.ex. "crop_carrot")
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function plantCrop(slotIndex, cropId, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots"], (farm) => plantCropIn(farm, slotIndex, cropId));
}

/**
 * Så ett KÖPT frö (#329): som plantCrop men förbrukar samtidigt ett frö ur
 * elevens shop-innehav. Fröer är multi-saker i shoppen (kategori tradgard,
 * seed:true) så antalet bor i studentData.ownedCounts[cropId] – köpet sker via
 * butikKop (#854), sådden drar av 1 här, i SAMMA transaktion som sloten fylls
 * (inga frön kan försvinna utan att en gröda faktiskt såtts, och tvärtom).
 * Inga frön kvar → ok:false utan ändring.
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export async function plantSeed(slotIndex, cropId, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const farm = farmFromData(data);
    const seeds = ownedCount(data, cropId);
    if (seeds <= 0) return { ok: false, farm, error: "inga frön kvar" };
    const res = plantCropIn(farm, slotIndex, cropId);
    if (!res.ok) return res;
    // Dot-path-skrivning: bara sloten + fröräknaren rörs. ownedCount faller
    // tillbaka på ownedItems för äldre köp utan counts-post – skrivningen här
    // sätter alltid en explicit counts-post, som har företräde vid läsning.
    // lastFro (#854) = markören som B4:s regel för ownedCounts läser: bara fröet som
    // såddes får räknas ned.
    tx.update(ref, {
      "farm.gardenSlots": res.farm.gardenSlots,
      ["ownedCounts." + cropId]: seeds - 1,
      lastFro: cropId,
    });
    return res;
  });
  if (result.ok) invalidateStudentData(studentId);
  return result;
}

/**
 * Avancera en grödas tillväxtsteg (default +1, klamras till färdigvuxen).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function advanceCropGrowth(slotIndex, steps = 1, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots"], (farm) => advanceGrowthIn(farm, slotIndex, steps));
}

/**
 * Låt ALLA växande grödor växa ett steg (#329: tillväxt via plugguppgifter).
 * Färdigvuxna grödor rörs inte. Skriver bara om något faktiskt växte.
 * @returns {Promise<{ok: boolean, farm: object, grew?: number}>}
 */
export function advanceAllCropsGrowth(steps = 1, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots"], (farm) => {
    const res = advanceAllGrowthIn(farm, steps);
    // grew 0 → "ok:false" bara för att hoppa över skrivningen (inget fel).
    return res.grew > 0 ? res : { ...res, ok: false };
  });
}

/**
 * Kroken som awardExercise (game-shared.js) anropar när en övning klarats:
 * växande grödor växer ett steg. Snabb-vägen läser den SESSION-CACHADE
 * studentDatan först och gör INGENTING (ingen transaktion, ingen extra läsning)
 * för elever utan växande grödor – dvs. för alla som inte odlar just nu.
 * Fel propagieras (anroparen kör i icke-kastande try {}).
 * @returns {Promise<number>} antal grödor som växte
 */
export async function growCropsFromExercise(studentId = currentStudentId()) {
  if (!studentId) return 0;
  const farm = farmFromData(await getStudentData(studentId));
  const growing = farm.gardenSlots.some((s) => s.growthStage < FARM_MAX_GROWTH_STAGE);
  if (!growing) return 0;
  const res = await advanceAllCropsGrowth(1, studentId);
  return res && res.grew ? res.grew : 0;
}

/**
 * Skörda en färdigvuxen gröda: sloten töms och grödan läggs i skörde-förrådet
 * (inventoryHarvest). Ej färdig → ok:false utan ändring.
 * @returns {Promise<{ok: boolean, farm: object, cropId?: string, error?: string}>}
 */
export function harvestCrop(slotIndex, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots", "inventoryHarvest"], (farm) => harvestFrom(farm, slotIndex));
}

/**
 * Justera skörde-förrådet med delta (negativt = förbruka, t.ex. mata ett
 * djur). Dras mer än saldot → ok:false utan ändring.
 * @returns {Promise<{ok: boolean, farm: object, count?: number, error?: string}>}
 */
export function adjustHarvestInventory(cropId, delta, studentId = currentStudentId()) {
  return updateFarm(studentId, ["inventoryHarvest"], (farm) => adjustInventoryIn(farm, cropId, delta));
}

/**
 * Sätt var ett djur är placerat: "room" (default-hemmet, posten tas bort),
 * "paddock" eller "barn". petId = djurets instans-id (pets[].id eller
 * roomAnimals[].uid – gården bryr sig inte om vilket).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function setAnimalPlacement(petId, location, studentId = currentStudentId()) {
  return updateFarm(studentId, ["placedAnimals"], (farm) => setPlacementIn(farm, petId, location));
}

// --- Bondgårdsdjuren (farm.animals, issue #330) ------------------------------

/**
 * Samma namn-sanering som husdjuren (cleanPetName i data-pet.js) – dubblerad
 * MEDVETET: data.js re-exporterar den här modulen och data-pet.js importerar
 * data.js, så en import härifrån till data-pet.js skulle sluta en modulcykel.
 */
function cleanFarmAnimalName(name) {
  const s = String(name || "").replace(/[<>&"'`]/g, "").trim().slice(0, 16); // = NAME_MAX_LEN
  return s || null;
}

// Köpet av ett bondgårdsdjur och av gårds-uppgraderingarna (#333) går via
// butikKop på servern (#854, butik-core.js) – nivåerna skrivs aldrig härifrån.

/**
 * Spara bondgårdsdjurens positioner: { [uid]: { x, y } } (procent av scenen).
 * Okända uid/ogiltiga positioner ignoreras; ingen ändring → ingen skrivning.
 * @returns {Promise<{ok: boolean, farm: object}>}
 */
export function saveFarmAnimalPositions(positions, studentId = currentStudentId()) {
  return updateFarm(studentId, ["animals"], (farm) => {
    const res = withFarmAnimalPositions(farm, positions);
    // Oförändrat → rapportera ok utan skrivning (updateFarm skriver bara vid ok).
    return res.changed ? res : { ok: false, farm, error: "inget att spara" };
  });
}

/**
 * Döp (eller döp om) ett bondgårdsdjur. Namnet saneras som husdjurens
 * (cleanFarmAnimalName ovan); tomt namn nollställer.
 * @returns {Promise<{ok: boolean, farm: object, animal?: object, error?: string}>}
 */
export function saveFarmAnimalName(uid, name, studentId = currentStudentId()) {
  return updateFarm(studentId, ["animals"], (farm) =>
    renameFarmAnimalIn(farm, uid, cleanFarmAnimalName(name)));
}

/**
 * Mata ett bondgårdsdjur med en gröda ur skörde-förrådet (#332): förbrukar
 * grödan och uppdaterar trivsel/lastFedAt i EN transaktion (ren logik i
 * feedFarmAnimalIn – +25 bara för dagens första rätta matning, fel gröda →
 * ok:false utan att något förbrukas).
 * @returns {Promise<{ok: boolean, farm: object, animal?: object, gavTrivsel?: boolean, error?: string}>}
 */
export function feedFarmAnimal(uid, cropId, studentId = currentStudentId()) {
  return updateFarm(studentId, ["animals", "inventoryHarvest"], (farm) =>
    feedFarmAnimalIn(farm, uid, cropId));
}

/**
 * Hämta djurets dagliga gåva (#332): sätter lastGiftAt OCH ökar coins i SAMMA
 * transaktion (gåvan kan aldrig hämtas utan mynt eller tvärtom). Sedan #853
 * via data-mynt.js tjanaMynt med dagskvittot: reglerna betalar bara för ett
 * ÄGT gårdsdjur (studentData.agdaDjur) och en gång per djur och svensk dag.
 * Ej redo → ok:false. Nekat kvitto (djuret saknar kartpost) → ok:false och
 * ingenting skrivs. Redan hämtad i dag enligt kvittot → ok:true, coins 0, tak.
 * data-mynt.js laddas dynamiskt (den här filen ligger i bootgrafen, #271).
 * @returns {Promise<{ok: boolean, farm: object, coins?: number, coinsTotal?: number, tak?: boolean, error?: string}>}
 */
export async function claimFarmAnimalGift(uid, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const { tjanaMynt } = await import("./data-mynt.js");
  let res = null;
  const r = await tjanaMynt("gard", FARM_GIFT_COINS, {
    gardUid: uid,
    studentId,
    extra: (sd) => {
      res = claimGiftIn(farmFromData(sd || {}), uid);
      return res.ok ? { "farm.animals": res.farm.animals } : null;
    },
  });
  if (!res || !res.ok) return res || { ok: false, farm: farmFromData({}), error: "saknas" };
  if (r.nekad || r.avbrutet) return { ok: false, farm: res.farm, error: "nekad" };
  return { ...res, coins: r.mynt, coinsTotal: r.saldo, tak: r.tak };
}

/**
 * Välj laggårdens UTSEENDE (#353): ett skin-id ur shop-katalogen (barnSkin-
 * saker, köps till ownedItems precis som husskalen) eller null = den klassiska
 * nivå-fasaden. Rent kosmetiskt – kapacitet/spiltor styrs fortfarande av
 * farm.barnLevel (#333). Okänt id → ok:false utan ändring (samma anda som
 * saveHusSkal: ägandet upprätthålls av väljar-UI:t, som bara visar ägda skins).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function setBarnSkin(skinId, studentId = currentStudentId()) {
  return updateFarm(studentId, ["barnSkin"], (farm) => {
    const id = skinId || null;
    if (id && !(getItem(id) || {}).barnSkin) return { ok: false, farm, error: "okänt skin" };
    return { ok: true, farm: { ...farm, barnSkin: id } };
  });
}
