// ============================================================================
// Pluggportalen – äventyrsmotorn: compass.js  (issue #261)
// ----------------------------------------------------------------------------
// En diskret HUD-kompass som pekar mot NÄRMSTA icke-avklarade frågeobjekt (och,
// när alla klarats och slutmålet aktiverats, mot slutmålet i stället). Delas av
// grid- och scroll-scenen så alla tre teman får den automatiskt.
//
// Två delar, medvetet separerade:
//   • nearestTargetAngle(...)  – REN, sido-effektfri riktnings-matte (enhetstestad).
//     Räknar i samma koordinatsystem den matas med (procent i grid, pixel i scroll);
//     riktningen är koordinat-skala-oberoende så samma funktion funkar i båda lägena.
//   • createCompass()          – bygger overlay-DOM:en och roterar pilen. Lätt DOM,
//     ingen spel-logik.
// ============================================================================

/**
 * Vinkel (radianer) från avatarens position mot NÄRMSTA relevanta mål.
 * Målval: när slutmålet är aktivt (goalActive) → alltid `goal`; annars den
 * icke-avklarade stationen med kortast euklidiskt avstånd. "Närmaste" mäts på
 * råa världskoordinater (kvadrerat avstånd räcker – ingen kollision/räckvidd).
 *
 * Vinkeln är atan2(dy, dx): 0 = mot höger (öster), växer medurs eftersom y pekar
 * nedåt på skärmen – vilket matchar CSS `rotate()` (medurs) direkt.
 *
 * @param {object} o
 * @param {{x:number,y:number}} o.pos     avatarens position
 * @param {Array<{x:number,y:number}>} o.stations  stationspositioner
 * @param {Set<number>|number[]} [o.cleared]  klarade stationsindex
 * @param {boolean} [o.goalActive]         slutmålet framme?
 * @param {{x:number,y:number}} [o.goal]   slutmålets position
 * @returns {{angleRad:number, hasTarget:boolean}} hasTarget=false ⇒ inget mål (dölj)
 */
export function nearestTargetAngle({ pos, stations, cleared, goalActive, goal } = {}) {
  const none = { angleRad: 0, hasTarget: false };
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return none;

  let target = null;
  if (goalActive) {
    target = goal && Number.isFinite(goal.x) && Number.isFinite(goal.y) ? goal : null;
  } else {
    const isCleared =
      cleared instanceof Set
        ? (i) => cleared.has(i)
        : Array.isArray(cleared)
        ? (i) => cleared.includes(i)
        : () => false;
    let bestSq = Infinity;
    const list = Array.isArray(stations) ? stations : [];
    for (let i = 0; i < list.length; i++) {
      if (isCleared(i)) continue;
      const s = list[i];
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
      const dx = s.x - pos.x;
      const dy = s.y - pos.y;
      const sq = dx * dx + dy * dy;
      if (sq < bestSq) {
        bestSq = sq;
        target = s;
      }
    }
  }

  if (!target) return none;
  return { angleRad: Math.atan2(target.y - pos.y, target.x - pos.x), hasTarget: true };
}

/**
 * Bygger kompass-overlayn (fast i övre höger av spelytan). Returnerar elementet +
 * en `set(angleRad|null)`-krok: en vinkel roterar pilen och visar den, `null`
 * döljer den. Elementet är `pointer-events:none` (via CSS) så det aldrig äter tap
 * på spelytan – man kan gå/trycka "under" pilen.
 * @returns {{el:HTMLElement, set:(angleRad:number|null)=>void}}
 */
export function createCompass() {
  const el = document.createElement("div");
  el.className = "adv-compass";
  el.setAttribute("aria-hidden", "true");
  el.hidden = true;
  el.innerHTML =
    `<span class="adv-compass-arrow">` +
    `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">` +
    `<path d="M3 12h13M11 5l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3.2" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  const arrow = el.querySelector(".adv-compass-arrow");

  return {
    el,
    set(angleRad) {
      if (angleRad == null || !Number.isFinite(angleRad)) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      // rad → deg för CSS; pil-SVG:n pekar åt höger (0 rad) i vila.
      arrow.style.transform = `rotate(${(angleRad * 180) / Math.PI}deg)`;
    },
  };
}
