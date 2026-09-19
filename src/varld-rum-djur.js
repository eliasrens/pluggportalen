// ============================================================================
// Pluggportalen – vanliga djur i rummet (promenerande, FAST storlek)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear.js/varld-rum-mat.js): äger
// de VANLIGA djuren från shoppen (hund, katt, kanin … – studentData.roomAnimals
// via data-animals.js). De promenerar omkring med samma promenad-AI som
// mystery-djuren (rum-promenad.js) men:
//   * FAST storlek – ingen tillväxt, inga steg.
//   * INGEN mat – isHungry (data-pet.js) är false för dem (ingen sprite-art),
//     så seek-läget mot Mysterymat träffar dem aldrig.
//
// Djur-objekten är pet-FORMADE ({ id, pos, hatchedAt:true }) så de kan gå in i
// samma promenad-loop och drag-pipeline som mystery-djuren; hatchedAt är bara
// ett runtime-flagg (AI:n hoppar över ruvande ägg) och sparas aldrig.
// Rummet (varld-rum.js) äger scenen; den här modulen ger noder, panel och
// positionssparning för just de vanliga djuren.
// ============================================================================

import * as animalData from "./data-animals.js";
import { setAnimalPlacement, saveFarmAnimalPositions, saveFarmAnimalName } from "./data-farm.js";
import { farmFromData, placementFor, moodForTrivsel, trivselNow, giftReadyIn } from "./farm-core.js";
import { el } from "./ui.js";
import { getItem } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import { farmMoodSvg } from "./art-pets.js";

/**
 * Montera de vanliga djuren för rumsscenen.
 * @param {object} o
 * @param {object} o.sd  studentData (roomAnimals + ev. legacy ownedItems-djur)
 * @returns {{ list: () => object[], stowedList: () => object[],
 *   byId: (id: string) => object|undefined, displayName: (a: object) => string,
 *   stageNode: (a: object, selected: boolean) => HTMLElement,
 *   saveName: (id: string, name: string) => Promise<object>,
 *   setStowed: (id: string, stowed: boolean) => void,
 *   scheduleSave: () => void, saveWalkPositions: () => void }}
 */
export function mountRumDjur({ sd }) {
  // Runtime-objekt: `id` = INSTANSENS uid (unikt, matchar DOM:ens data-pet-id och
  // delas med promenad-AI:n/drag-pipen som nyckel), `art` = shop-sakens id (styr
  // emoji/storlek/artnamn). Flera exemplar av samma art får därför olika id.
  const animals = animalData.animalsFromData(sd).map((a) => ({
    id: a.uid,
    art: a.id,
    pos: a.pos,
    name: a.name,
    stowed: !!a.stowed,
    hatchedAt: true,
  }));

  // Bondgårdsdjuren (#330) bor i farm.animals + farm.placedAnimals (data-farm)
  // – helt skilda från roomAnimals ovan. `location` styr var djuret vistas:
  // "room" promenerar här bland de andra, "paddock"/"barn" ritas av gårds-
  // grenen (gard-djur.js). Placeringen väljs i "Mina djur" (farmList/setLocation).
  const farm = farmFromData(sd);
  const farmAnimals = farm.animals.map((a) => ({
    id: a.uid,
    art: a.id,
    pos: a.pos || { x: 30 + Math.round(Math.random() * 40), y: 70 + Math.round(Math.random() * 15) },
    name: a.name,
    location: placementFor(farm, a.uid),
    farmAnimal: true,
    trivsel: a.trivsel, //     0–100 (sparad; effektiv trivsel via trivselNow)
    lastFedAt: a.lastFedAt, //  matnings-loopen #332: decay + dagsgate
    lastGiftAt: a.lastGiftAt, // … och gåvo-gaten (🎁-badgen)
    stowed: false,
    hatchedAt: true,
  }));

  /** Visningsnamn: elevens eget namn om satt, annars artnamnet. */
  function displayName(a) {
    const item = getItem(a.art);
    return a.name || (item ? item.name : "Djuret");
  }

  // Spara positioner (debounce vid drag – samma mönster som scheduleSavePets).
  // Vanliga djur → roomAnimals (data-animals), bondgårdsdjur → farm.animals
  // (data-farm) – två skilda skrivningar eftersom datamodellerna är åtskilda.
  // De SEKVENSERAS (inte parallellt): båda transaktionerna rör samma studentData-
  // dokument, och samtidiga commits ger onödiga precondition-retries i konsolen.
  let saveTimer = null;
  function savePositions() {
    let forst = Promise.resolve();
    if (animals.length > 0) {
      const positions = {};
      for (const a of animals) positions[a.id] = { x: a.pos.x, y: a.pos.y };
      forst = animalData.saveAnimalPositions(positions).catch(() => {});
    }
    const inRoom = farmAnimals.filter((a) => a.location === "room");
    if (inRoom.length > 0) {
      const positions = {};
      for (const a of inRoom) positions[a.id] = { x: a.pos.x, y: a.pos.y };
      forst.then(() => saveFarmAnimalPositions(positions)).catch(() => {});
    }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePositions, 250);
  }

  // Promenad-AI:ns "djuret stannade"-sparning: glest (Firestore-skrivningar är
  // inte gratis) – som mest en gång per minut, precis som mystery-djuren.
  let lastWalkSave = 0;
  function saveWalkPositions() {
    const now = Date.now();
    if (now - lastWalkSave < 60000) return;
    lastWalkSave = now;
    savePositions();
  }

  /**
   * DOM-nod i rumsscenen. Samma klasser/drag-pipeline som mystery-djuren
   * (room-pet + data-pet-id → promenad-AI:ns tass-animation och spegling
   * följer med gratis), men storleken är FAST (itemSize – som när djuret var
   * en statisk sak) och det finns inga humör-/matningsuttryck.
   */
  function stageNode(a, selected) {
    const item = getItem(a.art);
    if (!item) return el("<span></span>");
    const size = itemSize(a.art);
    const namn = displayName(a);
    // Bondgårdsdjur bär en liten mood-min (glad/nöjd/less ur EFFEKTIV trivsel –
    // decay vid läsning, #332) + 🎁-badge när dagens gåva väntar (hämtas i
    // matnings-sektionen i djurets namn-panel, varld-foder.js).
    const mood = a.farmAnimal
      ? `<span class="fdjur-mood" aria-hidden="true">${farmMoodSvg(moodForTrivsel(trivselNow(a)))}</span>${giftReadyIn(a) ? '<span class="fdjur-gava" title="En gåva väntar!">🎁</span>' : ""}`
      : "";
    // Namn-etiketten är en lättviktig döpnings-affordans (klick → inline-namnfält),
    // precis som mystery-djuren. ✏️-pennan visas BARA innan djuret fått ett eget
    // namn; ett namngivet djur får en penn-lös men klickbar etikett (rp-namn-tap)
    // så namn-vyn (och namnbyte) fortfarande nås. Ingen inforuta poppar vid klick
    // på djuret självt – det ger bara en klappa-effekt (petPat).
    return el(`<div class="room-item room-pet room-djur${selected ? " selected" : ""}"
      data-pet-id="${a.id}" style="left:${a.pos.x}%;top:${a.pos.y}%" title="${namn}">
      <span class="ri-emoji" style="width:calc(${size.w} * min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px)));height:calc(${size.h} * min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px)))">${itemSvg(a.art) || item.emoji}</span>${mood}
      <span class="rp-namn ${a.name ? "rp-namn-tap" : "rp-namn-edit"}" data-rename="${a.id}" title="${a.name ? "Öppna namn-vyn" : "Döp mig ✏️"}">${namn}</span>
    </div>`);
  }

  /**
   * Döp djuret (Firestore) och uppdatera det in-memory så namn-etiketten kan
   * ritas om direkt. Returnerar transaktionsresultatet ({ ok, animal, animals }).
   */
  async function saveName(id, name) {
    // Bondgårdsdjur döps i farm.animals (data-farm), övriga i roomAnimals.
    const fa = farmAnimals.find((x) => x.id === id);
    if (fa) {
      const res = await saveFarmAnimalName(id, name);
      if (res.ok) fa.name = res.animal ? res.animal.name : null;
      return res;
    }
    const res = await animalData.saveAnimalName(id, name);
    if (res.ok) {
      const a = animals.find((x) => x.id === id);
      if (a) a.name = res.animal ? res.animal.name : null;
    }
    return res;
  }

  /**
   * Stuva undan (stowed=true) eller lägg tillbaka (false) ett djur. Uppdaterar
   * in-memory direkt (så scenen/panelen kan ritas om utan väntan) och sparar i
   * bakgrunden. Djuret tappas aldrig – bara flaggan flyttas.
   */
  function setStowed(id, stowed) {
    const a = animals.find((x) => x.id === id);
    if (a) a.stowed = !!stowed;
    animalData.setAnimalStowed(id, stowed).catch(() => {});
  }

  /**
   * Flytta ett bondgårdsdjur: "room" | "paddock" | "barn". Uppdaterar in-memory
   * direkt (rummet kan ritas om utan väntan) och sparar i bakgrunden
   * (farm.placedAnimals via setAnimalPlacement). Gårds-grenen läser placeringen
   * färskt vid varje besök, så hagen/ladan ser flytten nästa gång man går dit.
   */
  function setLocation(id, location) {
    const a = farmAnimals.find((x) => x.id === id);
    if (!a) return;
    a.location = location;
    setAnimalPlacement(id, location).catch(() => {});
  }

  return {
    // list() = djur som är I RUMMET (promenerar/ritas): icke-undanstuvade
    // vanliga djur + bondgårdsdjur placerade i rummet. stowedList() = de
    // undanstuvade (visas i "Mina djur"). byId() hittar oavsett – rummet ritar
    // ändå bara de icke-undanstuvade, så drag/klick träffar aldrig ett stuvat.
    list: () => [...animals.filter((a) => !a.stowed), ...farmAnimals.filter((a) => a.location === "room")],
    stowedList: () => animals.filter((a) => a.stowed),
    // Bondgårdsdjuren (alla, oavsett plats) – för placerings-väljaren i Mina djur.
    farmList: () => farmAnimals,
    byId: (id) => animals.find((a) => a.id === id) || farmAnimals.find((a) => a.id === id),
    displayName,
    stageNode,
    saveName,
    setStowed,
    setLocation,
    scheduleSave,
    saveWalkPositions,
  };
}
