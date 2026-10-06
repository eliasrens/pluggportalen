// ============================================================================
// Pluggporten – reservpyramidens ambient-pose (#396, F5 #431)
// ----------------------------------------------------------------------------
// En pyramid bakar in lagrets ambient (moln, rök, solstrålar) i den pose som
// gällde när den speglades. Spelas rörelsen på en RESERV (förvärmd i idle, upp
// till 4 s gammal) har DOM:ens ambient hunnit driva vidare (~30 px moln), och
// när canvasen byts mot DOM:en vid slutet skulle molnen hoppa.
//
//   • fangaPose(): vid speglingen (samma task, alltså samma tidslinje-tid som
//     den synkrona genomgången) sparas currentTime per bas-ambient-animation.
//   • sattPose(): när reserven spelas sätts de av vilan pausade animationerna
//     till den sparade posen – i samma task som DOM:en göms (.varld-pixi-
//     spelar), så "tillbakaspolningen" syns aldrig. Vilan släpps sedan med
//     play() och ambienten fortsätter från reservens pose.
// Animationer som tillkommit/försvunnit sedan speglingen lämnas orörda och
// räknas i loggen (borta/nya). Sprites (profilens `sprites`) speglas om vid
// varje handoff i frusen pose och rörs därför aldrig här.
// Inga importer – laddas via varld-motor-textur.js (import(), ej bootgrafen).
// ============================================================================

/**
 * Lagrets bas-ambient bland `anims`: inte transitions, inte lagrets egen
 * animation, inte i profilens sprites (de speglas om varje gång).
 * @param {HTMLElement} el  lagret
 * @param {Animation[]} anims
 * @param {string} [spr]  sprite-selektor
 * @returns {Animation[]}
 */
export function basAmbient(el, anims, spr) {
  return anims.filter((a) => {
    if (globalThis.CSSTransition && a instanceof CSSTransition) return false;
    const t = a.effect?.target;
    return !!t && t !== el && el.contains(t) && !(spr && t.closest(spr));
  });
}

/**
 * Lagrets bas-ambient-pose NU (anropas synkront intill speglingen).
 * @param {HTMLElement} el
 * @param {string} [spr]
 * @returns {{tider: Map<Animation, number>, spr: string, t: number} | null}  null = ingen ambient
 */
export function fangaPose(el, spr = "") {
  let anims;
  try { anims = el.getAnimations({ subtree: true }); } catch { return null; }
  const tider = new Map();
  for (const a of basAmbient(el, anims, spr)) {
    if (a.playState !== "running" && a.playState !== "paused") continue;
    const ct = a.currentTime;
    if (ct != null) tider.set(a, typeof ct === "number" ? ct : Number(ct));
  }
  return tider.size ? { tider, spr, t: performance.now() } : null;
}

/**
 * Sätt lagrets av vilan pausade bas-ambient till `pose`. Bara animationer som
 * finns i både posen och `pausade` (och fortfarande är pausade) rörs.
 * @param {HTMLElement} el
 * @param {ReturnType<typeof fangaPose>} pose
 * @param {Animation[]} pausade  vilans pausade animationer (alla lager)
 * @returns {{satta:number, borta:number, nya:number, alderMs:number} | null}
 *   borta = i posen men inte pausad nu, nya = pausad bas-ambient som saknas i posen
 */
export function sattPose(el, pose, pausade) {
  if (!pose) return null;
  const vara = new Set(pausade);
  let satta = 0, borta = 0;
  for (const [a, t] of pose.tider) {
    if (!vara.has(a) || a.playState !== "paused") { borta++; continue; }
    try {
      a.currentTime = t;
      satta++;
    } catch { borta++; }
  }
  const nya = basAmbient(el, pausade, pose.spr).filter((a) => !pose.tider.has(a)).length;
  return { satta, borta, nya, alderMs: Math.round(performance.now() - pose.t) };
}
