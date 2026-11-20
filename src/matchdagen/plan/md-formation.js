// ============================================================================
// Matchdagen (#869, Etapp 1c): var spelarna står – REN (ingen DOM, ingen three).
// Delas av 3D-planen och 2D-reserven, så båda visar exakt samma match (spec §4).
// Planen ritas i meter: 105 × 68, vi anfaller åt höger (+x). Motorns bollposition
// (x 0–100, y 0–68) räknas om med planX. Ordningen på spelarna följer
// STARTELVA i delat/md-namn.js: 0 = målvakt, 1–2 försvar, 3–4 mittfält, 5–6 anfall.
//
//   planX(x)                              → meter längs planen (2–103)
//   formation({ x, y, innehav, avspark? }) → { vi: [[x, y] × 7], dem: [[x, y] × 7], boll: [x, y], vid: { lag, i } | null }
//   firande(vi, lag, boll)                → lagets spelare samlas kring målskytten
//   straffUppstallning(lag)               → { vi, dem, boll, skytt, malvakt, mallinje } vid en straff (#870, §7.4)
// ============================================================================

import { STRAFFPUNKT_M } from "../delat/md-config.js";

export const PLAN_L = 105;
export const PLAN_B = 68;
/** Grundformationen för laget som anfaller åt höger (sketchens 7-manna 1-2-2-2). */
export const GRUND = [[5, 34], [22, 20], [22, 48], [38, 26], [38, 42], [50, 22], [50, 46]];

const kl = (v, a, b) => Math.max(a, Math.min(b, v));
export const planX = (x) => 2 + kl(Number(x) || 0, 0, 100) * 1.01;

function lagPos(spegel, anfall, bx, by, avspark) {
  const fram = avspark ? 0 : (bx - PLAN_L / 2) * 0.55 * (spegel ? -1 : 1);
  return GRUND.map(([x, y], i) => {
    if (i) {
      if (avspark) x = Math.min(x * 0.92, PLAN_L / 2 - 2);
      else x = x + fram + (anfall ? 8 : -4);
      y = y + (by - PLAN_B / 2) * 0.35;
    } else y = PLAN_B / 2 + (by - PLAN_B / 2) * 0.22;
    if (spegel) x = PLAN_L - x;
    return [kl(x, 3, PLAN_L - 3), kl(y, 3, PLAN_B - 3)];
  });
}

/**
 * Positionerna för ett läge. Den som har bollen springer fram till den (§4),
 * närmaste försvarare går emot. Avspark: båda lagen på egen planhalva.
 */
export function formation({ x, y, innehav = "oss", avspark = false }) {
  const bx = planX(x);
  const by = kl(Number(y) || PLAN_B / 2, 2, PLAN_B - 2);
  const vi = lagPos(false, innehav === "oss", bx, by, avspark);
  const dem = lagPos(true, innehav === "dem", bx, by, avspark);
  let vid = null;
  if (avspark) {
    const lag = innehav === "oss" ? vi : dem;
    lag[5] = [bx + (innehav === "oss" ? -0.8 : 0.8), by];
    vid = { lag: innehav === "oss" ? "vi" : "dem", i: 5 };
  } else if (bx > 6 && bx < PLAN_L - 6) {
    for (const [lag, namn] of [[vi, "vi"], [dem, "dem"]]) {
      let n = 1, nd = Infinity;
      lag.forEach(([px, py], i) => { const d = (px - bx) ** 2 + (py - by) ** 2; if (i && d < nd) { nd = d; n = i; } });
      const har = (namn === "vi") === (innehav === "oss");
      const sida = namn === "vi" ? 1 : -1;
      lag[n] = har ? [bx - 1.2 * sida, by] : [bx + 3.5 * sida, by + 1.5];
      if (har) vid = { lag: namn, i: n };
    }
  }
  return { vi, dem, boll: [bx, by], vid };
}

/** Firandet: målskyttens lag springer ihop runt en punkt nära bollen. */
export function firande(lag, boll) {
  const [bx, by] = boll;
  return lag.map(([x, y], i) => (i === 0 ? [x, y] : [kl(bx - Math.sign(bx - PLAN_L / 2) * (8 + (i % 3) * 2), 4, PLAN_L - 4), kl(by + ((i % 4) - 1.5) * 2.4, 4, PLAN_B - 4)]));
}

/** Mållinjerna i planens meter (2D-ritningen: linjerna vid 2 och 103). */
export const MALLINJE = { vi: 2, dem: PLAN_L - 2 };

/**
 * En straff (§7.4): skytten bakom bollen på straffpunkten, målvakten på mållinjen och
 * alla andra i mittcirkeln. lag = "oss" (vi skjuter mot deras mål, höger) eller "dem".
 * skytt/malvakt = { lag: "vi"|"dem", i } – vilka figurer som rör sig i straffen.
 */
export function straffUppstallning(lag) {
  const hoger = lag !== "dem";
  const mallinje = hoger ? MALLINJE.dem : MALLINJE.vi;
  const punkt = hoger ? mallinje - STRAFFPUNKT_M : mallinje + STRAFFPUNKT_M;
  const mitt = (sida, i) => [PLAN_L / 2 + (sida === "vi" ? -2.2 : 2.2) + (i % 2 ? 1.2 : -1.2), PLAN_B / 2 - 9 + i * 3];
  const vi = GRUND.map((_, i) => mitt("vi", i));
  const dem = GRUND.map((_, i) => mitt("dem", i));
  const skytt = { lag: hoger ? "vi" : "dem", i: 5 };
  const malvakt = { lag: hoger ? "dem" : "vi", i: 0 };
  (skytt.lag === "vi" ? vi : dem)[5] = [punkt + (hoger ? -1.6 : 1.6), PLAN_B / 2 + 0.6];
  (malvakt.lag === "vi" ? vi : dem)[0] = [mallinje + (hoger ? -0.6 : 0.6), PLAN_B / 2];
  return { vi, dem, boll: [punkt, PLAN_B / 2], skytt, malvakt, mallinje };
}
