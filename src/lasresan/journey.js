// ============================================================================
// Läsresan – reseprogression (src/lasresan/journey.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/lasresan-journey.test.js.
// Det här är det eleven SER: 1 färdig text = 1 steg, `steps` steg = färdig
// värld, därefter nästa värld. Progressionen går ALLTID framåt, oavsett
// resultat, och påverkar ALDRIG den dolda läsnivån (level.js).
//
// progress = { worldId, stepInWorld, completedWorlds[] }
//   stepInWorld = antal klarade steg i nuvarande värld (0 = "före steg 1").
//
// Efter SISTA världen (inget nästa i registret): världen markeras klar och
// eleven står kvar på sista steget. Eleven kan fortsätta läsa (texter, pengar
// och nivå fungerar som vanligt), men avataren går inte längre. När en ny
// värld läggs till i registret flyttar normalizeProgress eleven dit
// (se progress.js) – ingen migrering behövs.
// ============================================================================

import { WORLDS, firstWorld, getWorld, nextWorld } from "./worlds/index.js";

/** Antal steg i en värld (fallback 0 om världen saknas). */
function stepsOf(world) {
  return world && Number.isInteger(world.steps) ? world.steps : 0;
}

/**
 * Tvätta ett (ev. gammalt/ofullständigt) progress-objekt mot registret:
 *   * okänd/saknad värld → första ej klarade världen, steg 0
 *   * står eleven på en KLAR värld som har en efterföljare (t.ex. en ny värld
 *     har lagts till efter att eleven klarat den sista) → flytta fram dit
 *   * stepInWorld klämd till 0…steps
 */
export function normalizeProgress(progress, registry = WORLDS) {
  const completedWorlds = Array.isArray(progress && progress.completedWorlds)
    ? [...new Set(progress.completedWorlds.filter((id) => typeof id === "string"))]
    : [];
  let world = getWorld(progress && progress.worldId, registry);
  let step = Math.floor(Number(progress && progress.stepInWorld) || 0);

  if (!world) {
    const list = Array.isArray(registry) ? registry : WORLDS;
    world = list.find((w) => !completedWorlds.includes(w.id)) || firstWorld(registry);
    step = 0;
  }
  // Klar värld med en efterföljare → eleven ska vara i nästa värld.
  while (world && completedWorlds.includes(world.id)) {
    const nxt = nextWorld(world.id, registry);
    if (!nxt) break;
    world = nxt;
    step = 0;
  }
  if (!world) return { worldId: null, stepInWorld: 0, completedWorlds };
  step = Math.min(stepsOf(world), Math.max(0, step));
  return { worldId: world.id, stepInWorld: step, completedWorlds };
}

/**
 * En text är färdig → ett steg framåt (alltid, oavsett resultat).
 * @param {{worldId:string, stepInWorld:number, completedWorlds:string[]}} progress
 * @param {object[]} [worldsRegistry] världslista (default: WORLDS)
 * @returns {{
 *   progress: {worldId, stepInWorld, completedWorlds},
 *   worldCompleted: boolean,        // just den här texten gjorde världen klar
 *   completedWorldId: string|null,  // världen som blev klar (om någon)
 *   unlockedWorldId: string|null,   // nästa värld som öppnades (om någon)
 *   walk: {worldId, fromStep, toStep} // vad kartan ska animera (i den gamla världen)
 * }}
 */
export function completeStep(progress, worldsRegistry = WORLDS) {
  const cur = normalizeProgress(progress, worldsRegistry);
  const world = getWorld(cur.worldId, worldsRegistry);
  const steps = stepsOf(world);
  const fromStep = cur.stepInWorld;
  const result = {
    progress: cur,
    worldCompleted: false,
    completedWorldId: null,
    unlockedWorldId: null,
    walk: { worldId: cur.worldId, fromStep, toStep: fromStep },
  };
  if (!world) return result;

  // Redan på sista steget i en klar sista värld: eleven läser vidare men
  // avataren står still.
  if (fromStep >= steps) return result;

  const toStep = fromStep + 1;
  result.walk = { worldId: world.id, fromStep, toStep };

  if (toStep < steps) {
    result.progress = { ...cur, stepInWorld: toStep };
    return result;
  }

  // Världen klar.
  const completedWorlds = cur.completedWorlds.includes(world.id)
    ? cur.completedWorlds
    : [...cur.completedWorlds, world.id];
  result.worldCompleted = true;
  result.completedWorldId = world.id;
  const nxt = nextWorld(world.id, worldsRegistry);
  if (nxt) {
    result.unlockedWorldId = nxt.id;
    result.progress = { worldId: nxt.id, stepInWorld: 0, completedWorlds };
  } else {
    // Sista världen: står kvar på sista steget, världen markerad klar.
    result.progress = { worldId: world.id, stepInWorld: steps, completedWorlds };
  }
  return result;
}
