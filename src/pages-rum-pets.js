// ============================================================================
// Pluggportalen – husdjuren i Mitt rum
// ----------------------------------------------------------------------------
// Husdjursdelen av rumssidan (pages-rum.js): ritar ägg/varelser som flyttbara
// objekt i rumsscenen (petStageNode/petReadonlyNode/petArtThumb) och äger
// klick-leken/humör-uttrycken (petBellyFlop/petPat/setPetMood). Själva PANELEN
// under scenen (kläckning, namngivning, matning, tillväxt, "Stuva undan") bor i
// systermodulen pages-rum-pet-panel.js. Datan bor i studentData.pets via
// data-pet.js. Hålls separat så pages-rum.js stannar under filtaket.
// ============================================================================

import { el } from "./ui.js";
import { getSpecies, creatureSvg } from "./art-pets-creatures.js";
import { spriteRigHtml, SPRITE_MOODS } from "./art-pet-sprites.js";
import { eggSvg } from "./art-pets.js";

/** Visningsnamn: elevens eget namn, annars artnamnet, annars "Ägg". */
export function petDisplayName(pet) {
  if (pet.name) return pet.name;
  const species = pet.speciesId ? getSpecies(pet.speciesId) : null;
  return species ? species.name : "Mystiskt ägg";
}

// --- Uttryck & klick-lek (flyktigt runtime-tillstånd, per djur) -------------
// Uttrycken sparas inte: äter när djuret når ett äpple, glad efter interaktion,
// nyfiken när pekaren är nära djuret. Timers är per djur och rör bara noder som
// fortfarande sitter i DOM:en.

const moodTimers = new Map(); // petId -> timeout (återgång till vilouttryck)
const moodBusy = new Map(); // petId -> tidsstämpel: tidsatt uttryck pågår

// Klappa-lek pågår: promenad-AI:n (rum-promenad.js) ska stå still medan djuret
// klappas, annars går det ifrån sin gulliga reaktion mitt i animationen.
const patBusy = new Map(); // petId -> tidsstämpel (klappa-lek pågår till dess)

/** Klappas djuret just nu (litet skutt/rygg-lek)? Promenad-AI:n pausar då. */
export function isPetBusy(petId) {
  return (patBusy.get(petId) || 0) > Date.now();
}
function markPatBusy(petId, ms) {
  patBusy.set(petId, Date.now() + ms);
}

/** Vilouttryck: neutral (matningen sker via äpplen på golvet, inte här). */
function idleExpression() {
  return "";
}

function findPetNode(petId) {
  return document.querySelector(`.room-pet[data-pet-id="${petId}"]`);
}

/** Är husdjuret en sprite-riggad art (bild-delar) i stället för SVG? */
function isSpritePet(pet) {
  const species = pet.speciesId ? getSpecies(pet.speciesId) : null;
  return !!(species && species.kind === "sprite");
}

/** Figurens HTML: sprite-rigg för sprite-arter, annars procedurell SVG. */
function petArtHtml(pet, expr) {
  if (isSpritePet(pet)) {
    return spriteRigHtml(pet.speciesId, pet.stage || 1, expr) || "🐾";
  }
  return creatureSvg(pet.speciesId, expr) || "🐾";
}

function swapArt(node, pet, expr) {
  const slot = node && node.querySelector(".ri-emoji");
  if (!slot) return;
  // Sprite-arter: rita INTE om riggen (det skulle nollställa animationerna) –
  // uttrycket visas som humör-partikel vid huvudet (💤/❤️/🍎, designdoket).
  if (isSpritePet(pet)) {
    const fx = slot.querySelector(".ps-humor");
    if (fx) fx.textContent = SPRITE_MOODS[expr] || "";
    return;
  }
  slot.innerHTML = creatureSvg(pet.speciesId, expr) || "🐾";
}

/** Visa ett uttryck i ms millisekunder, sedan tillbaka till vilouttrycket. */
export function setPetMood(pet, expr, ms) {
  const node = findPetNode(pet.id);
  if (!node || !pet.hatchedAt) return;
  clearTimeout(moodTimers.get(pet.id));
  moodBusy.set(pet.id, Date.now() + ms);
  swapArt(node, pet, expr);
  moodTimers.set(pet.id, setTimeout(() => {
    moodBusy.delete(pet.id);
    swapArt(findPetNode(pet.id), pet, idleExpression(pet));
  }, ms));
}

// Tajming från design-facit: 700 ms flip + 2600 ms sprattel + 550 ms upp igen.
const RYGG_MS = 3850;

/** Klick-lek: djuret lägger sig på rygg, sprattlar och blir extra glatt. */
export function petBellyFlop(pet) {
  const node = findPetNode(pet.id);
  if (!node || !pet.hatchedAt || node.classList.contains("pet-rygg")) return;
  markPatBusy(pet.id, RYGG_MS);
  setPetMood(pet, "glad", RYGG_MS + 1500); // extra glad en stund efteråt
  node.classList.add("pet-rygg");
  const fx = el('<span class="pet-rygg-fx">💖</span>');
  node.appendChild(fx);
  setTimeout(() => {
    node.classList.remove("pet-rygg");
    fx.remove();
  }, RYGG_MS);
}

// Klappa för fast-storleks-djur (de vanliga djuren): ett litet glädjeskutt med
// hjärtan i stället för rygg-lek (de "lägger sig inte på rygg"). Kort & gulligt.
const KLAPP_MS = 900;

/**
 * Klick-klapp för ett djur med fast storlek (varld-rum-djur.js): litet studs
 * upp + hjärtan, i samma anda som petBellyFlop men utan rygg-vändningen. Tar ett
 * petId (de vanliga djuren delar .room-pet/data-pet-id-noden med mystery-djuren).
 */
export function petPat(petId) {
  const node = findPetNode(petId);
  if (!node || node.classList.contains("pet-klapp")) return;
  markPatBusy(petId, KLAPP_MS);
  node.classList.add("pet-klapp");
  const fx = el('<span class="pet-klapp-fx">💖</span>');
  node.appendChild(fx);
  setTimeout(() => {
    node.classList.remove("pet-klapp");
    fx.remove();
  }, KLAPP_MS);
}

/**
 * DOM-nod för ett husdjur i rumsscenen (samma dra-pipeline som sakerna:
 * klassen room-item + data-pet-id, position i procent).
 */
export function petStageNode(pet, selected) {
  const pos = pet.pos || { x: 50, y: 70 };
  const art = pet.hatchedAt ? petArtHtml(pet, idleExpression(pet)) : eggSvg();
  const stageClass = pet.hatchedAt ? ` pet-vuxen-${pet.stage || 1}` : " pet-agg-i-rum";
  // Kläckt djur: namn-etiketten är en lättviktig döpnings-affordans (klick →
  // liten ✏️-hint → namn-vyn). Ägg går inte att döpa än (ingen art kläckt).
  const label = pet.hatchedAt
    ? `<span class="rp-namn rp-namn-edit" data-rename="${pet.id}" title="Byt namn ✏️">${petDisplayName(pet)}</span>`
    : `<span class="rp-namn rp-agg">🥚 ruvar…</span>`;
  const node = el(`<div class="room-item room-pet${stageClass}${selected ? " selected" : ""}"
    data-pet-id="${pet.id}" style="left:${pos.x}%;top:${pos.y}%" title="${petDisplayName(pet)}">
    <span class="ri-emoji">${art}</span>
    ${label}
  </div>`);
  if (pet.hatchedAt) {
    // Nyfiken när man är nära (hovrar) – men stör inte pågående uttryck/lek.
    const calm = () => !node.classList.contains("pet-rygg") &&
      (moodBusy.get(pet.id) || 0) <= Date.now();
    node.addEventListener("pointerenter", () => {
      if (calm()) swapArt(node, pet, "nyfiken");
    });
    node.addEventListener("pointerleave", () => {
      if (calm()) swapArt(node, pet, idleExpression(pet));
    });
  }
  return node;
}

/**
 * READ-ONLY nod för ett KLÄCKT husdjur (t.ex. i en kompis läs-vy): exakt samma
 * sprite-/SVG-utseende som i eget rum, men helt stilla – inga hover-/klick-/
 * drag-listeners, ingen panel, inga humör-/matningsuttryck. Idle-andningen är
 * gratis via CSS-klasserna. Ägg (ej kläckta) ritas inte här → returnerar null.
 */
export function petReadonlyNode(pet) {
  if (!pet || !pet.hatchedAt) return null;
  const pos = pet.pos || { x: 50, y: 70 };
  const art = petArtHtml(pet, idleExpression(pet));
  return el(`<div class="room-item room-pet readonly pet-vuxen-${pet.stage || 1}"
    style="left:${pos.x}%;top:${pos.y}%" title="${petDisplayName(pet)}">
    <span class="ri-emoji">${art}</span>
    <span class="rp-namn">${petDisplayName(pet)}</span>
  </div>`);
}

/**
 * Liten stillbild av ett husdjur för "Mina djur"-panelen (undanstuvade djur):
 * samma figur som i rummet men utan drag/klick/panel. Sprite-arter wrappas i en
 * fast-höjd-ruta (riggen är höjd-driven), procedurella arter skalar via SVG:n.
 * Okläckta ägg (kan inte stuvas undan) faller tillbaka på ägg-bilden.
 */
export function petArtThumb(pet) {
  if (!pet || !pet.hatchedAt) return eggSvg();
  if (isSpritePet(pet)) {
    return `<span class="tray-pet-sprite">${spriteRigHtml(pet.speciesId, pet.stage || 1, "") || "🐾"}</span>`;
  }
  return creatureSvg(pet.speciesId, idleExpression(pet)) || "🐾";
}

// Husdjurspanelen (under scenen) + de vanliga djurens lätta namn-vy bor i
// systermodulen pages-rum-pet-panel.js (renderPetPanel/animalNamePanel).
