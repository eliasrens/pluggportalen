// ============================================================================
// Läsresan – världsregister (src/lasresan/worlds/index.js)
// ----------------------------------------------------------------------------
// Världar är DATA, inte kod (spec §22). En ny värld = en ny fil i worlds/ som
// följer schemat nedan + en rad i WORLDS. Inget annat i Läsresan behöver ändras.
//
// Värld-schema:
//   {
//     id:            string   stabil nyckel, sparas i studentData.lasresa.worldId
//     name:          string   visningsnamn ("Skogen")
//     theme:         string   tema-nyckel för kartvyn ("skog", "okn", …)
//     steps:         number   antal steg (texter) i världen, normalt 20
//     order:         number   ordning i resan (1, 2, …)
//     unlockAfter:   string|null  id på världen som måste vara klar först
//     scene:         { width, height, background?, render? }  kartscenens mått
//                    (koordinatsystem för start/stepPositions/decorations) och
//                    ev. renderare (fylls av kartvyn, issue #400)
//     stepPositions: {x,y}[]  EN position per steg (index 0 = steg 1)
//     start:         {x,y}    där avataren står "före steg 1"
//     decorations:   any[]    fria dekorations-poster för kartvyn
//   }
// ============================================================================

import skogen from "./skogen.js";
import oknen from "./oknen.js";

/** Alla världar, sorterade på `order`. Lägg till nya världar här. */
export const WORLDS = sortWorlds([skogen, oknen]);

function sortWorlds(list) {
  return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** Registret som en lista (accepterar ett eget register i tester). */
function listOf(registry) {
  return Array.isArray(registry) ? sortWorlds(registry) : WORLDS;
}

/** Första världen i resan (där nya elever börjar). */
export function firstWorld(registry = WORLDS) {
  return listOf(registry)[0] || null;
}

/** Värld per id, eller null. */
export function getWorld(id, registry = WORLDS) {
  return listOf(registry).find((w) => w.id === id) || null;
}

/** Världen som kommer efter `id` i ordningen, eller null om `id` är sist. */
export function nextWorld(id, registry = WORLDS) {
  const list = listOf(registry);
  const i = list.findIndex((w) => w.id === id);
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}

/** Är världen öppen givet vilka världar eleven klarat? */
export function isWorldUnlocked(world, completedWorlds = []) {
  if (!world) return false;
  return !world.unlockAfter || completedWorlds.includes(world.unlockAfter);
}

/**
 * Kontrollera att en värld följer schemat. Returnerar en lista med fel
 * (tom = OK). Används av testerna och som skydd när nya världar läggs till.
 */
export function validateWorld(w) {
  const errors = [];
  if (!w || typeof w !== "object") return ["världen saknas"];
  const pt = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!w.id || typeof w.id !== "string") errors.push("id saknas");
  if (!w.name) errors.push(`${w.id}: name saknas`);
  if (!w.theme) errors.push(`${w.id}: theme saknas`);
  if (!Number.isInteger(w.steps) || w.steps < 1) errors.push(`${w.id}: steps måste vara ett heltal ≥ 1`);
  if (!Number.isFinite(w.order)) errors.push(`${w.id}: order saknas`);
  if (w.unlockAfter != null && typeof w.unlockAfter !== "string") errors.push(`${w.id}: unlockAfter ska vara id eller null`);
  if (!w.scene || !Number.isFinite(w.scene.width) || !Number.isFinite(w.scene.height)) {
    errors.push(`${w.id}: scene.width/height saknas`);
  }
  if (!pt(w.start)) errors.push(`${w.id}: start {x,y} saknas`);
  if (!Array.isArray(w.stepPositions) || w.stepPositions.length !== w.steps || !w.stepPositions.every(pt)) {
    errors.push(`${w.id}: stepPositions måste ha exakt ${w.steps} {x,y}`);
  }
  if (!Array.isArray(w.decorations)) errors.push(`${w.id}: decorations ska vara en lista`);
  return errors;
}
