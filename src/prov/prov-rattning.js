// ============================================================================
// Prov (#738, spec docs/UTVECKLINGSUPPDRAG_PROV.md §2.2): normalisering av
// fria svar, Levenshtein och byggstenarna för rättningsförslagen. Ren logik,
// ingen Firebase/DOM. Frågetyperna (src/prov/typer/) använder den här filen;
// rättningsvyn (D) grupperar kortsvar med gruppNyckel.
//
//   normSvar(s, { skiftlage })        → jämförelseform
//   levenshtein(a, b, max?)           → redigeringsavstånd (tidigt avbrott > max)
//   matchaText(svar, godkanda, opt)   → true | "delvis" | false
//   delpoang(andel, max)              → poäng avrundade NEDÅT till halva (#762, prov-poang.js)
//   forslagAv(andel, max)             → { poang, maxPoang, ratt }
//   gruppNyckel(svar, opt)            → nyckeln som grupperar identiska svar
//
// Automatiken ger alltid ett FÖRSLAG, aldrig ett beslut (§2.2) – läraren kan
// ändra allt i rättningen.
// ============================================================================

import { delpoangNed } from "./prov-poang.js";

// Ett tal med decimalkomma eller -punkt ("7", "7,0", "-3.50", "1 000,5").
const TAL = /^-?(\d+|\d{1,3}( \d{3})+)([.,]\d+)?$/;

/**
 * Jämförelseformen för ett kortsvar/en lucka (§2.2): NFC, trimmat, mellanslag
 * hopslagna, gemener (utom med skiftlage), en punkt sist bort. Tal skrivs om
 * till kanonisk form så att "7" = "7,0" = "7.0" och "3,50" = "3.5".
 */
export function normSvar(s, { skiftlage = false } = {}) {
  let t = String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!skiftlage) t = t.toLowerCase();
  if (t.endsWith(".")) t = t.slice(0, -1).trimEnd();
  const tal = t.replace(/^[−–]/, "-");
  if (TAL.test(tal)) {
    const n = Number(tal.replace(/ /g, "").replace(",", "."));
    if (Number.isFinite(n)) return String(n);
  }
  return t;
}

/** Är den normaliserade formen ett tal? */
export function arTal(norm) {
  return norm !== "" && Number.isFinite(Number(norm)) && /^-?\d/.test(norm);
}

/**
 * Levenshtein-avståndet (insättning, borttagning, byte) räknat på tecken
 * (kodpunkter, så å/ä/ö och emoji räknas som ett). Med `max` avbryts
 * räkningen så fort avståndet säkert är större – då returneras max + 1.
 */
export function levenshtein(a, b, max = Infinity) {
  const s = Array.from(String(a ?? ""));
  const t = Array.from(String(b ?? ""));
  if (Math.abs(s.length - t.length) > max) return max + 1;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    let minst = i;
    for (let j = 1; j <= t.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < minst) minst = v;
    }
    if (minst > max) return max + 1;
    prev = cur;
  }
  return prev[t.length];
}

// Kortare godkända svar än så här får ingen stavfelstolerans: "ek" och "ok"
// är olika ord, inte ett stavfel. Tal får det aldrig ("7" mot "8").
export const STAVFEL_MIN_LANGD = 4;

/**
 * Jämför ett fritt svar mot listan med godkända svar.
 * @param {string} svar elevens svar
 * @param {string[]} godkanda lärarens godkända svar
 * @param {{ exaktStavning?: boolean, skiftlage?: boolean }} opt
 *   exaktStavning (standard true): av → ett svar som skiljer sig med EN
 *   bokstav från ett godkänt svar ger "delvis". skiftlage (standard false):
 *   på → stor och liten bokstav spelar roll.
 * @returns {true|"delvis"|false}
 */
export function matchaText(svar, godkanda, { exaktStavning = true, skiftlage = false } = {}) {
  const n = normSvar(svar, { skiftlage });
  if (!n) return false;
  const lista = (Array.isArray(godkanda) ? godkanda : []).map((g) => normSvar(g, { skiftlage })).filter(Boolean);
  if (lista.includes(n)) return true;
  if (exaktStavning || arTal(n)) return false;
  const nara = lista.some((g) => !arTal(g) && Array.from(g).length >= STAVFEL_MIN_LANGD && levenshtein(n, g, 1) === 1);
  return nara ? "delvis" : false;
}

/** Andelen (0–1) av maxpoängen, avrundad NEDÅT till halva poäng (§2.2, #762). */
export const delpoang = delpoangNed;

/**
 * Förslaget för en andel rätt: 1 → rätt, 0 → fel, annars delvis.
 * Poängen följer andelen (nedåt till halva poäng); en fråga med 0 poäng får ändå
 * rätt/delvis/fel efter andelen.
 */
export function forslagAv(andel, max) {
  const a = Math.min(1, Math.max(0, Number(andel) || 0));
  return { poang: delpoang(a, max), maxPoang: Number(max) || 0, ratt: a >= 1 ? true : a <= 0 ? false : "delvis" };
}

// "Exakt stavning krävs" av och svaret är ett stavfel ifrån → hur stor del av
// poängen förslaget ger. Läraren ändrar i rättningen om det ska bli mer/mindre.
export const DELVIS_STAVFEL_ANDEL = 0.5;

/**
 * Nyckeln som grupperar identiska kortsvar/luckor i rättningsvyn (§6.1):
 * samma normalisering som jämförelsen, så "Birka", "birka." och " BIRKA"
 * hamnar i samma grupp ("" = obesvarat).
 */
export function gruppNyckel(svar, { skiftlage = false } = {}) {
  return normSvar(svar, { skiftlage });
}
