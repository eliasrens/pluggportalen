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
import { el } from "./ui.js";
import { getItem } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";

/**
 * Montera de vanliga djuren för rumsscenen.
 * @param {object} o
 * @param {object} o.sd  studentData (roomAnimals + ev. legacy ownedItems-djur)
 * @returns {{ list: () => object[], byId: (id: string) => object|undefined,
 *   displayName: (a: object) => string,
 *   stageNode: (a: object, selected: boolean) => HTMLElement,
 *   saveName: (id: string, name: string) => Promise<object>,
 *   scheduleSave: () => void, saveWalkPositions: () => void }}
 */
export function mountRumDjur({ sd }) {
  const animals = animalData
    .animalsFromData(sd)
    .map((a) => ({ ...a, hatchedAt: true }));

  /** Visningsnamn: elevens eget namn om satt, annars artnamnet. */
  function displayName(a) {
    const item = getItem(a.id);
    return a.name || (item ? item.name : "Djuret");
  }

  // Spara positioner (debounce vid drag – samma mönster som scheduleSavePets).
  let saveTimer = null;
  function savePositions() {
    if (animals.length === 0) return;
    const positions = {};
    for (const a of animals) positions[a.id] = { x: a.pos.x, y: a.pos.y };
    animalData.saveAnimalPositions(positions).catch(() => {});
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
    const item = getItem(a.id);
    if (!item) return el("<span></span>");
    const size = itemSize(a.id);
    const namn = displayName(a);
    // Namn-etiketten är en lättviktig döpnings-affordans (klick → liten ✏️-hint
    // → inline-namnfält), precis som mystery-djuren. Ingen inforuta poppar vid
    // klick på djuret självt – det ger bara en klappa-effekt (petPat).
    return el(`<div class="room-item room-pet room-djur${selected ? " selected" : ""}"
      data-pet-id="${a.id}" style="left:${a.pos.x}%;top:${a.pos.y}%" title="${namn}">
      <span class="ri-emoji" style="width:calc(${size.w}rem * var(--rum-skala, 1));height:calc(${size.h}rem * var(--rum-skala, 1))">${itemSvg(a.id) || item.emoji}</span>
      <span class="rp-namn rp-namn-edit" data-rename="${a.id}" title="Byt namn ✏️">${namn}</span>
    </div>`);
  }

  /**
   * Döp djuret (Firestore) och uppdatera det in-memory så namn-etiketten kan
   * ritas om direkt. Returnerar transaktionsresultatet ({ ok, animal, animals }).
   */
  async function saveName(id, name) {
    const res = await animalData.saveAnimalName(id, name);
    if (res.ok) {
      const a = animals.find((x) => x.id === id);
      if (a) a.name = res.animal ? res.animal.name : null;
    }
    return res;
  }

  return {
    list: () => animals,
    byId: (id) => animals.find((a) => a.id === id),
    displayName,
    stageNode,
    saveName,
    scheduleSave,
    saveWalkPositions,
  };
}
