// ============================================================================
// Pluggporten – fri tidslinje för Pixi-workern (#424, S6 i epic #396)
// ----------------------------------------------------------------------------
// Kamerans korszoom (varld-render-anim.js) har EN fast timing för alla lager.
// Port → hem (T10) spelar i stället flera spår med egna tider: grindhalvorna
// scaleX 500 ms med egen bezier, zoomen 900 ms med kamera-easing som börjar
// 260 ms in. Den här modulen beskriver sådana rörelser som DATA (går att posta
// till workern) och räknar ut lagrens tillstånd vid tid t.
//
// Per behållare (lagerId i workern):
//   bas    vilomatris [a,b,c,d,e,f]: behållarens lokala px → ytans px
//   yttre  spår i YTANS px   (t.ex. zoomen kring portöppningen)
//   inre   spår i LOKALA px  (t.ex. en grindhalvas scaleX kring gångjärnet)
//   matris(t) = Π yttre(t) · bas · Π inre(t)
// Spår: { typ:"skala"|"skalaX"|"skalaY"|"alpha", origo?:{x,y}, fran, till,
//         delay?:ms, ms, ease:[x1,y1,x2,y2] }  (CSS-semantik: konstant `fran`
//         under delay, sedan cubic-bezier mot `till`, sedan `till`).
//
// Utdata = LagerState (varld-render-anim.js) + `matris`; workern använder
// `matris` i stället för lagerMatris. `scale` = matrisens x-skala, så
// pyramidnivåernas zFran (lagerSyns) fungerar som för kameran.
// REN matte (ingen DOM, ingen Pixi) → node --test. Bara workern och
// varld-profil-port.js läser den (aldrig i bootgrafen).
// ============================================================================

import { cubicBezier } from "./varld-render-anim.js";

/**
 * @typedef {{ typ:"skala"|"skalaX"|"skalaY"|"alpha", origo?:{x:number,y:number},
 *             fran:number, till:number, delay?:number, ms:number, ease?:number[] }} Spar
 * @typedef {{ id:string, bas?:number[], alpha?:number, zFran?:number, yttre?:Spar[], inre?:Spar[] }} TidslinjeLager
 */

const LINJAR = [0, 0, 1, 1];
const easeCache = new Map();
const easing = (e = LINJAR) => {
  const k = e.join(",");
  let f = easeCache.get(k);
  if (!f) easeCache.set(k, (f = cubicBezier(...e)));
  return f;
};

/** Spårets värde vid tMs (CSS-transitionens semantik). */
export function sparVarde(s, tMs) {
  const p = s.ms > 0 ? Math.min(1, Math.max(0, (tMs - (s.delay || 0)) / s.ms)) : tMs >= (s.delay || 0) ? 1 : 0;
  return s.fran + (s.till - s.fran) * easing(s.ease)(p);
}

/** [a,b,c,d,e,f]-matriser (som DOMMatrix 2D): m1 · m2. */
export function mul(m1, m2) {
  const [a, b, c, d, e, f] = m1;
  const [A, B, C, D, E, F] = m2;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

/** Skalning (sx, sy) kring punkten o. */
export const skalaKring = (sx, sy, o = { x: 0, y: 0 }) => [sx, 0, 0, sy, o.x - sx * o.x, o.y - sy * o.y];

const IDENT = [1, 0, 0, 1, 0, 0];

/** Spårens samlade matris + alpha vid tMs. */
function spara(spar = [], tMs) {
  let m = IDENT, alpha = 1;
  for (const s of spar) {
    const v = sparVarde(s, tMs);
    if (s.typ === "alpha") alpha *= v;
    else m = mul(m, skalaKring(s.typ === "skalaY" ? 1 : v, s.typ === "skalaX" ? 1 : v, s.origo));
  }
  return { m, alpha };
}

/**
 * Lagrens tillstånd tMs ms in i tidslinjen (ordningen = ritordningen, underst först).
 * @param {TidslinjeLager[]} lager
 * @param {number} tMs
 */
export function tidslinjeState(lager, tMs) {
  return lager.map((l) => {
    const y = spara(l.yttre, tMs), i = spara(l.inre, tMs);
    const matris = mul(mul(y.m, l.bas || IDENT), i.m);
    return {
      id: l.id,
      box: { x: 0, y: 0, w: 0, h: 0 },
      matris,
      scale: Math.hypot(matris[0], matris[1]),
      originPx: null,
      opacity: (l.alpha ?? 1) * y.alpha * i.alpha,
      synlig: true,
      inert: true,
      ...(l.zFran ? { zFran: l.zFran } : {}),
    };
  });
}
