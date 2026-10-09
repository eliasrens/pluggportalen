// ============================================================================
// Pluggporten – "vilande DOM" under Pixi-rörelsen (#396, F4 #418)
// ----------------------------------------------------------------------------
// Medan workern spelar kamerarörelsen (≈ 900 ms) är DOM-lagren osynliga
// (.varld-pixi-spelar). De ska då inte göra något arbete på main-tråden, och
// när de visas igen ska de stå EXAKT där texturerna visade dem:
//
//   • Ambient-animationer (moln, rök, solstrålar, husdjurens CSS-animationer)
//     fryses med WAAPI pause() och fortsätter med play() – currentTime är
//     kontinuerlig, inget hopp (#374-lärdomen: INTE `.varld-zoomar *
//     {animation-play-state}`, som gav 150–220 ms stil-omräkning).
//   • Lagren får .varld-pixi-vilar: promenad-AI:n sover (rum-promenad.js kollar
//     node.closest(".varld-pixi-vilar") – inte checkVisibility, som tvingar
//     fram layout) och lagrens egna transitions stängs av (styles.css), så att
//     kamerans apply() till slutläget och återvisningen aldrig animeras.
//
// Laddas bara via import() (från varld-motor.js) – aldrig i bootgrafen.
// ============================================================================

const VILAR = "varld-pixi-vilar";

/** Är animationen "ambient" (inte en transition och inte lagrets egen)? */
const arAmbient = (a, lager) => !(globalThis.CSSTransition && a instanceof CSSTransition) && a.effect?.target !== lager;

/**
 * Frys lagren: WAAPI-paus på alla animationer som spelar i delträden +
 * .varld-pixi-vilar. Idempotent släpp-funktion tillbaka.
 * @param {HTMLElement[]} lager
 * @returns {(() => void) & { pausade: Animation[], ambient: (lager:HTMLElement) => boolean }}
 *   ambient(lager) = hade lagret levande ambient-animationer när det frystes
 *   (då står ambienten i en ny pose → speglas om vid handoff).
 */
export function vila(lager) {
  const pausade = [];
  const medAmbient = new Set();
  for (const l of lager) {
    l.classList.add(VILAR);
    let anims = [];
    try { anims = l.getAnimations({ subtree: true }); } catch { /* äldre motor */ }
    for (const a of anims) {
      if (a.playState !== "running") continue;
      if (arAmbient(a, l)) medAmbient.add(l);
      try {
        a.pause();
        pausade.push(a);
      } catch { /* animationen kan ha tagits bort */ }
    }
  }
  let slappt = false;
  const slapp = () => {
    if (slappt) return;
    slappt = true;
    for (const l of lager) l.classList.remove(VILAR);
    for (const a of pausade) {
      // Bara de VI pausade – och bara om ingen annan tagit över dem sedan.
      try { if (a.playState === "paused") a.play(); } catch { /* borttagen */ }
    }
  };
  slapp.pausade = pausade;
  slapp.ambient = (l) => medAmbient.has(l);
  return slapp;
}

/**
 * Har lagret levande ambient-animationer just nu (utan att frysa något)?
 * Används av förvärmningen: sådana lager speglas ändå om vid handoff.
 * @param {HTMLElement} lager
 */
export function harAmbient(lager) {
  try {
    return lager.getAnimations({ subtree: true }).some((a) => a.playState === "running" && arAmbient(a, lager));
  } catch {
    return false;
  }
}
