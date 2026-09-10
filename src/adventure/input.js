// ============================================================================
// Pluggportalen – äventyrsmotorn: input.js
// ----------------------------------------------------------------------------
// Abstraherar STYRNING till en RIKTNINGSVEKTOR som motorn läser i sin rAF-loop,
// plus en "interagera"-signal. Två inmatningssätt bakom exakt samma dir()/onInteract:
//   • Tangentbord (desktop): piltangenter + WASD → riktning, E/Enter/Blanksteg →
//     interagera. Håller reda på TRYCKTA tangenter (inte engångs-events) så rörelsen
//     blir mjuk medan tangenten hålls.
//   • Pekskärm/pekare (mobil, issue #250): håll fingret på spelytan → avataren GÅR
//     MOT FINGRET (riktning = normerad vektor från avatarens skärmpunkt mot fingret).
//     Släpp → stanna. En kort TAP (utan nämnvärd rörelse) = interagera.
//
// Riktningen är i BÅDA fallen samma normaliserade {x,y} (−1..1/axel) så motorn,
// moveStep och kollisionen är HELT oförändrade. input.js är tema-agnostisk: den vet
// inte om spelet kör grid- eller scroll-läge. Engine berättar var avatarens
// skärmpunkt finns via option `getAimOrigin` (grid: #adv-player-centret; scroll:
// null ⇒ spelytans mitt, eftersom avataren då är visuellt centrerad).
//
// FRYSNING (edge case §4 i planen): när frågemodalen är öppen ska varken tangenter
// eller finger röra avataren bakom modalen, och interagera-signalen inte dubbel-
// trigga. setFrozen(true) nollar hållna tangenter OCH släpper aktiv pekning och får
// dir() att ge {0,0} samt stänger av interagera tills motorn tinar igen.
//
// Loopen är självstädande: destroy() plockar bort alla lyssnare (anropas av
// engine.controller.destroy()).
// ============================================================================

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);
const UP_KEYS = new Set(["ArrowUp", "w", "W"]);
const DOWN_KEYS = new Set(["ArrowDown", "s", "S"]);
const INTERACT_KEYS = new Set(["e", "E", "Enter", " ", "Spacebar"]);

// Hur långt fingret måste dras (i CSS-px) innan det räknas som en GÅ-drag i stället
// för en TAP. Under tröskeln rör sig avataren inte alls → en tapp för att svara
// startar aldrig en oavsiktlig promenad.
const TAP_SLOP = 10;
// Dödzon (px): finger i stort sett på avataren ⇒ stå still (undvik jitter/nolldelning).
const DEADZONE = 6;

/**
 * Rå riktning från en pekvektor: normaliserad {x,y} (|dir|≈1) från `origin` mot
 * `point`, eller {0,0} inom dödzonen. REN funktion – enhetstestbar utan DOM.
 * @param {{x:number,y:number}} point   fingerpunkt i skärmkoordinater
 * @param {{x:number,y:number}} origin  avatarens skärmpunkt
 * @param {number} [deadzone=DEADZONE]
 * @returns {{x:number,y:number}}
 */
export function pointerDir(point, origin, deadzone = DEADZONE) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len <= deadzone) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Skapa en input-styrenhet.
 * @param {object} o
 * @param {() => void} [o.onInteract]  kallas vid interagera (tangent eller tap),
 *   bara när INTE fryst.
 * @param {Window|HTMLElement} [o.target=window]  var TANGENT-lyssnarna kopplas.
 * @param {HTMLElement} [o.pointerTarget]  spelytan som PEK-lyssnarna kopplas på
 *   (t.ex. scene.stage). Utelämnas ⇒ ingen touch-styrning (bara tangentbord).
 * @param {() => ({x:number,y:number}|null)} [o.getAimOrigin]  avatarens SKÄRMPUNKT
 *   (grid-läge). null/utelämnad ⇒ pointerTargetens rect-centrum (scroll-läge).
 * @returns {{
 *   dir: () => {x:number,y:number},   // rå riktning (−1..1/axel), {0,0} när fryst
 *   setFrozen: (v:boolean) => void,   // frys/tina rörelse + interaktion
 *   isFrozen: () => boolean,
 *   destroy: () => void,              // plocka bort lyssnarna
 * }}
 */
export function createInput({ onInteract, target = window, pointerTarget = null, getAimOrigin } = {}) {
  const held = new Set(); // "left"|"right"|"up"|"down"
  let frozen = false;

  // --- Pek-tillstånd --------------------------------------------------------
  let pointerId = null; // aktiv pekares id (pointer capture)
  let point = null; // fingerns aktuella skärmkoordinater {x,y}
  let startPoint = null; // där pekningen började (för TAP-tröskel)
  let dragging = false; // har pekningen passerat TAP_SLOP → styr rörelse?

  function dirOf(key) {
    if (LEFT_KEYS.has(key)) return "left";
    if (RIGHT_KEYS.has(key)) return "right";
    if (UP_KEYS.has(key)) return "up";
    if (DOWN_KEYS.has(key)) return "down";
    return null;
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (INTERACT_KEYS.has(e.key)) {
      if (!frozen) {
        e.preventDefault();
        onInteract && onInteract();
      }
      return;
    }
    const d = dirOf(e.key);
    if (!d) return;
    e.preventDefault();
    if (!frozen) held.add(d);
  }

  function onKeyUp(e) {
    const d = dirOf(e.key);
    if (d) held.delete(d);
  }

  // Avatarens skärmpunkt: från engine (grid) eller pointerTargetens mitt (scroll).
  function aimOrigin() {
    if (getAimOrigin) {
      const o = getAimOrigin();
      if (o) return o;
    }
    const r = pointerTarget.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function clearPointer() {
    pointerId = null;
    point = null;
    startPoint = null;
    dragging = false;
  }

  function onPointerDown(e) {
    if (pointerId !== null) return; // redan en aktiv pekare – ignorera fler fingrar
    pointerId = e.pointerId;
    point = { x: e.clientX, y: e.clientY };
    startPoint = { x: e.clientX, y: e.clientY };
    dragging = false;
    pointerTarget.setPointerCapture && pointerTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId || point == null) return;
    point = { x: e.clientX, y: e.clientY };
    if (!dragging && Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y) > TAP_SLOP) {
      dragging = true; // passerade tröskeln → detta är en gång-drag, inte en tapp
    }
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    const wasTap = !dragging; // rörde sig aldrig nämnvärt ⇒ tapp = interagera
    clearPointer();
    if (wasTap && !frozen && e.type === "pointerup") {
      onInteract && onInteract();
    }
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  if (pointerTarget) {
    pointerTarget.addEventListener("pointerdown", onPointerDown);
    pointerTarget.addEventListener("pointermove", onPointerMove);
    // up/cancel på window: fånga släpp även om fingret hamnat utanför spelytan.
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  return {
    dir() {
      if (frozen) return { x: 0, y: 0 };
      // Aktiv gång-drag styr (gå mot fingret). Annars tangentbord.
      if (dragging && point) return pointerDir(point, aimOrigin());
      let x = 0;
      let y = 0;
      if (held.has("left")) x -= 1;
      if (held.has("right")) x += 1;
      if (held.has("up")) y -= 1;
      if (held.has("down")) y += 1;
      return { x, y };
    },
    setFrozen(v) {
      frozen = !!v;
      if (frozen) {
        held.clear(); // släpp alla tangenter så avataren inte "fastnar" i rörelse
        clearPointer(); // släpp aktiv pekning – finger kvar bakom modal ska ej glida
      }
    },
    isFrozen() {
      return frozen;
    },
    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      if (pointerTarget) {
        pointerTarget.removeEventListener("pointerdown", onPointerDown);
        pointerTarget.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      }
      held.clear();
      clearPointer();
    },
  };
}
