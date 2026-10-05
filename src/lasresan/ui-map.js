// ============================================================================
// Läsresan – kartvyn (src/lasresan/ui-map.js)  ·  STUB (issue #399)
// ----------------------------------------------------------------------------
// KONTRAKT (byggs ut på riktigt i issue #400 – behåll signaturen):
//
//   renderJourneyMap(container, {
//     world,            // värld ur worlds/index.js (scene, stepPositions, start, …)
//     progress,         // { worldId, stepInWorld, completedWorlds } (ALDRIG nivån)
//     avatar,           // { avatarId, avatarItems } – rita med avatars.avatarMarkup
//     animateFromStep,  // number|null: gå avataren från detta steg till
//                       //   progress.stepInWorld (efter en färdig text); null = stå still
//     onStartNext,      // () => void: eleven klickar på nästa tillgängliga steg
//   }) → { destroy() }
//
// Stegstatus: steg ≤ stepInWorld = klara, stepInWorld+1 = nästa (klickbart),
// resten = kommande (synliga men låsta). stepInWorld === world.steps = världen klar.
// Stubben ritar en enkel lista så flödet går att köra innan kartan finns.
// ============================================================================

import { avatarMarkup } from "../avatars.js";

export function renderJourneyMap(container, { world, progress, avatar, onStartNext } = {}) {
  const steps = (world && world.steps) || 0;
  const at = (progress && progress.stepInWorld) || 0;
  const done = at >= steps;
  container.innerHTML = `
    <div class="panel lasresan-map-stub" data-world="${world ? world.id : ""}">
      <h2>${world ? world.name : "Läsresan"}</h2>
      <div class="lasresan-avatar" style="font-size:64px">${avatar ? avatarMarkup(avatar.avatarId, avatar.avatarItems || []) : ""}</div>
      <p>Steg ${Math.min(at, steps)} av ${steps}</p>
      ${done ? "<p>🎉 Världen är klar!</p>" : ""}
      <button class="btn" type="button" data-lr-next>${done ? "Läs en text till" : `Starta steg ${at + 1}`}</button>
    </div>`;
  const btn = container.querySelector("[data-lr-next]");
  const onClick = () => onStartNext && onStartNext();
  btn.addEventListener("click", onClick);
  return { destroy: () => btn.removeEventListener("click", onClick) };
}
