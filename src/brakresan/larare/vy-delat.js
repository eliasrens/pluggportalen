// ============================================================================
// Bråkresan – lärarvyns gemensamma småbitar (src/brakresan/larare/vy-delat.js) · K #716
// ----------------------------------------------------------------------------
// Text- och HTML-hjälpare som klassvyn, matrisen, individvyn och
// rekommendationerna delar, plus lärarvyns lata stilark (larare.css).
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { MAX_STARS_PER_CHALLENGE } from "../schema/regler.js";

let css = null;
/** larare.css en gång (högst en kort väntan – fel = vyn ritas ändå). */
export function laddaLarareCss() {
  if (typeof document === "undefined") return Promise.resolve();
  if (css) return css;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./larare.css", import.meta.url).href;
  link.dataset.brLarareCss = "1";
  css = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return css;
}

export const DASH = `<span class="lrt-dash" aria-label="inga svar än">–</span>`;

/** Procent eller "–" (inga bedömda svar visas aldrig som 0 %). */
export const pctHtml = (v) => (v == null ? DASH : `${v} %`);

/** "★★☆" med text för skärmläsare. */
export function stjarnHtml(n, max = MAX_STARS_PER_CHALLENGE) {
  const s = Math.max(0, Math.min(max, n || 0));
  return `<span class="brl-stj" role="img" aria-label="${s} av ${max} stjärnor">${"★".repeat(s)}<span class="brl-stj-tom">${"☆".repeat(max - s)}</span></span>`;
}

export function datumText(t, { tid = false } = {}) {
  if (t == null) return "–";
  const d = new Date(t);
  return d.toLocaleString("sv-SE", tid
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

/** "Idag", "Igår", "3 dagar sedan", annars datum. */
export function senastText(t, nu = Date.now()) {
  if (t == null) return "–";
  const dagar = Math.floor((new Date(nu).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dagar <= 0) return "Idag";
  if (dagar === 1) return "Igår";
  if (dagar < 7) return `${dagar} dagar sedan`;
  return datumText(t);
}

/** Underlaget som alltid står bredvid en klassindikator (§12). */
export const underlagText = (a) => `${a.students} ${a.students === 1 ? "elev" : "elever"} · ${a.answers} bedömda svar`;

/** Klassindikatorns cell: "Inte tränat", "Litet underlag (x %)" eller "x %". */
export function indikatorHtml(a) {
  if (a.inteTranat) return `<span class="brl-tag brl-tag--inte">Inte tränat</span>`;
  if (a.litetUnderlag) return `<span class="brl-tag brl-tag--litet" title="Under 3 elever eller under 20 bedömda svar">Litet underlag</span> <span class="brl-svag">${a.accuracy} %</span>`;
  return `<b>${a.accuracy} %</b>`;
}

export const namnPa = (s) => s?.namn || s?.username || s?.id || "";
export { esc };
