// ============================================================================
// Meteorstormen (#820): det SERVERN (B) behöver av motorn för att validera en
// handling innan den skrivs i loggen. Ren, delas med servern.
//
//   stormPlan(cfg)                      → { meteorer, handelser } relativt start
//   energiEffekt(cfg, tMs)              → { faktor, bonus, energi, handelse }
//                                         (Solstorm ×2, Kometsvans +1)
//   effektPerTryck(cfg, classId)        → { skold, laser } – "per elev" (enheter)
//   kanAgera(input, tMs, classId, typ)  → { ok, kostnad, orsak?, redoMs? }
//
// Energin (1 per rätt svar, tak ENERGI_TAK) räknas och dras på servern; motorn
// ser bara handlingar som faktiskt utförts. Fel svar påverkar inte spelet.
// ============================================================================

import { STEG_MS, MILLI, KOSTNAD, HANDLINGAR, HANDELSE, ENERGI_PER_RATT, DRAG_STOPP_FORE_SLUT_MS, SKOLD_KLASSVARV, LASER_KLASSVARV, perElevMilli } from "./ms-balans.js";
import { skapaPlan, aktivHandelse } from "./ms-storm.js";
import { normCfg } from "./ms-indata.js";
import { simulera } from "./ms-motor.js";

/** Stormplanen (relativt start) – samma för alla stationer. */
export function stormPlan(input) {
  const cfg = normCfg(input);
  return skapaPlan(cfg.seed, cfg.varaktighetMs);
}

/** Vad ett rätt svar vid tMs ger (servern räknar energin – B). */
export function energiEffekt(input, tMs) {
  const cfg = normCfg(input);
  const rel = Number(tMs) - cfg.startMs;
  const h = rel >= 0 && rel < cfg.varaktighetMs ? aktivHandelse(skapaPlan(cfg.seed, cfg.varaktighetMs).handelser, rel) : null;
  const faktor = h?.typ === "solstorm" ? HANDELSE.solstorm.energiFaktor : 1;
  const bonus = h?.typ === "kometsvans" ? HANDELSE.kometsvans.energiBonus : 0;
  return { faktor, bonus, energi: ENERGI_PER_RATT * faktor + bonus, handelse: h ? h.typ : null };
}

/** "Per elev"-effekten av ett tryck för stationen (utan hjälpens +25 %). */
export function effektPerTryck(input, classId) {
  const cfg = normCfg(input);
  const s = cfg.stationer.find((x) => x.classId === String(classId));
  const aktiva = s ? s.aktiva : 1;
  return { skold: perElevMilli(SKOLD_KLASSVARV, aktiva) / MILLI, laser: perElevMilli(LASER_KLASSVARV, aktiva) / MILLI };
}

/**
 * Får stationen göra typ vid tMs? input.handlingar = allt som redan utförts
 * (t ≤ tMs). Handlingar i samma steg som ännu inte tillämpats räknas också
 * (två dragstrålar inom samma 100 ms nekas). Dragstrålen prövas vid samma
 * tid som motorn tillämpar den (nästa steggräns), så servern och motorn är
 * alltid överens. Energin kontrollerar servern.
 *   → { ok, kostnad, orsak?: "tid"|"klass"|"typ"|"av"|"armerad"|"vantetid", redoMs? }
 *   "tid" = före start, efter slut – eller (drag) de sista DRAG_STOPP_FORE_SLUT_MS.
 */
export function kanAgera(input, tMs, classId, typ) {
  const cfg = normCfg(input);
  const i = cfg.stationer.findIndex((s) => s.classId === String(classId));
  if (i < 0) return { ok: false, kostnad: 0, orsak: "klass" };
  if (!HANDLINGAR.includes(typ)) return { ok: false, kostnad: 0, orsak: "typ" };
  const rel = Number(tMs) - cfg.startMs;
  if (!(rel >= 0 && rel < cfg.varaktighetMs)) return { ok: false, kostnad: 0, orsak: "tid" };
  if (typ !== "drag") return { ok: true, kostnad: typ === "spara" ? 0 : KOSTNAD[typ] };
  const tidigare = (input?.handlingar || []).filter((h) => Number(h?.t) <= Number(tMs));
  const st = simulera({ ...input, handlingar: tidigare }, tMs).stationer[i];
  if (!st.drag.tillaten) return { ok: false, kostnad: 0, orsak: "av" };
  const steg = Math.floor(rel / STEG_MS);
  const tillampas = (steg + 1) * STEG_MS; // relativt start – då motorn tillämpar handlingen
  if (tillampas > cfg.varaktighetMs - DRAG_STOPP_FORE_SLUT_MS) return { ok: false, kostnad: st.drag.kostnad, orsak: "tid" };
  const stegStart = cfg.startMs + steg * STEG_MS;
  const vantar = tidigare.some((h) => h.typ === "drag" && String(h.classId) === cfg.stationer[i].classId && Number(h.t) >= stegStart);
  if (st.drag.armerad || vantar) return { ok: false, kostnad: st.drag.kostnad, orsak: "armerad" };
  if (cfg.startMs + tillampas < st.drag.redoMs) return { ok: false, kostnad: st.drag.kostnad, orsak: "vantetid", redoMs: st.drag.redoMs };
  return { ok: true, kostnad: st.drag.kostnad };
}
