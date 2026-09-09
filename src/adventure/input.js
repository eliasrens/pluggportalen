// ============================================================================
// Pluggportalen – äventyrsmotorn: input.js
// ----------------------------------------------------------------------------
// Abstraherar tangentbord (piltangenter + WASD) till en RIKTNINGSVEKTOR som
// motorn läser i sin rAF-loop, plus en "interagera"-signal (E / Enter / Blanksteg).
// Håller reda på vilka tangenter som TRYCKS NER (inte engångs-events) så rörelsen
// blir mjuk medan tangenten hålls – samma idé som keyDir i games-sanningsjakt.js,
// generaliserad till fyra väderstreck.
//
// FRYSNING (edge case §4 i planen): när frågemodalen är öppen ska piltangenterna
// INTE röra avataren bakom modalen och interagera-tangenten inte dubbel-trigga.
// setFrozen(true) nollar därför hållna tangenter och får dir() att ge {0,0} samt
// stänger av interagera-signalen tills modalen resolvats och motorn tinar igen.
//
// Loopen är självstädande på samma sätt som resten av spelvärlden: destroy()
// plockar bort alla lyssnare (anropas av engine.controller.destroy()).
// ============================================================================

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);
const UP_KEYS = new Set(["ArrowUp", "w", "W"]);
const DOWN_KEYS = new Set(["ArrowDown", "s", "S"]);
const INTERACT_KEYS = new Set(["e", "E", "Enter", " ", "Spacebar"]);

/**
 * Skapa en input-styrenhet.
 * @param {object} o
 * @param {() => void} [o.onInteract]  kallas när eleven trycker interagera-tangent
 *   (bara när INTE fryst).
 * @param {Window|HTMLElement} [o.target=window]  var lyssnarna kopplas.
 * @returns {{
 *   dir: () => {x:number,y:number},   // rå riktning (−1..1 per axel), {0,0} när fryst
 *   setFrozen: (v:boolean) => void,   // frys/tina rörelse + interaktion
 *   isFrozen: () => boolean,
 *   destroy: () => void,              // plocka bort lyssnarna
 * }}
 */
export function createInput({ onInteract, target = window } = {}) {
  const held = new Set(); // "left"|"right"|"up"|"down"
  let frozen = false;

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

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return {
    dir() {
      if (frozen) return { x: 0, y: 0 };
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
      if (frozen) held.clear(); // släpp alla tangenter så avataren inte "fastnar" i rörelse
    },
    isFrozen() {
      return frozen;
    },
    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      held.clear();
    },
  };
}
