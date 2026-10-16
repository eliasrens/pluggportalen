// ============================================================================
// Bråkresan – tal i ord (src/brakresan/math/words.js) · #706
// ----------------------------------------------------------------------------
// Spec §4: "För skärmläsare används exempelvis 'tre fjärdedelar'", och
// utmaning 04 (Bråk med ord) matchar symbol ↔ svensk text med korrekt böjning:
// "en halv", "tre fjärdedelar", "två tredjedelar". fractionWords/speakForm ger
// den texten ur exakta tal – aldrig handskrivna strängar per uppgift.
// ============================================================================

import { decimalText } from "./decimal.js";

const ONES = ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv",
  "tretton", "fjorton", "femton", "sexton", "sjutton", "arton", "nitton"];
const TENS = ["", "", "tjugo", "trettio", "fyrtio", "femtio", "sextio", "sjuttio", "åttio", "nittio"];

/** Grundtal i ord, 0–999 999: 24 → "tjugofyra", 100 → "hundra", 1 → "ett". */
export function numberWords(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 999999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : "");
  if (n < 1000) {
    const h = Math.floor(n / 100);
    return (h === 1 ? "" : ONES[h]) + "hundra" + (n % 100 ? numberWords(n % 100) : "");
  }
  const t = Math.floor(n / 1000);
  return (t === 1 ? "" : numberWords(t)) + "tusen" + (n % 1000 ? numberWords(n % 1000) : "");
}

// Bråkdelens namn i singular (1/n). Egna former för 2–20, tiotalen, 100, 1000.
const PARTS = {
  3: "tredjedel", 4: "fjärdedel", 5: "femtedel", 6: "sjättedel", 7: "sjundedel", 8: "åttondel",
  9: "niondel", 10: "tiondel", 11: "elftedel", 12: "tolftedel", 13: "trettondel", 14: "fjortondel",
  15: "femtondel", 16: "sextondel", 17: "sjuttondel", 18: "artondel", 19: "nittondel", 20: "tjugondel",
  30: "trettiondel", 40: "fyrtiondel", 50: "femtiondel", 60: "sextiondel", 70: "sjuttiondel",
  80: "åttiondel", 90: "nittiondel", 100: "hundradel", 1000: "tusendel",
};
const UNIT_PARTS = { 1: "förstedel", 2: "andradel" };

/** Singularnamnet på delen 1/d: 4 → "fjärdedel", 24 → "tjugofjärdedel". Null om inget namn finns. */
export function partName(d) {
  if (PARTS[d]) return PARTS[d];
  if (d > 20 && d < 100) return TENS[Math.floor(d / 10)] + (UNIT_PARTS[d % 10] || PARTS[d % 10]);
  return null;
}

/**
 * Bråket n/d i ord: (1, 2) → "en halv", (3, 2) → "tre halvor", (3, 4) → "tre
 * fjärdedelar", (1, 3) → "en tredjedel", (0, 5) → "noll femtedelar".
 * Nämnare utan eget namn: "7 delar av 36".
 */
export function fractionWords(n, d) {
  const count = n === 1 ? "en" : numberWords(n);
  if (d === 1) return n === 1 ? "en hel" : `${numberWords(n)} hela`;
  if (d === 2) return n === 1 ? "en halv" : `${count} halvor`;
  const part = partName(d);
  if (!part) return `${numberWords(n)} ${n === 1 ? "del" : "delar"} av ${numberWords(d)}`;
  return n === 1 ? `en ${part}` : `${count} ${part}ar`;
}

/** Hela i ord: 1 → "en hel", 2 → "två hela". */
export const wholeWords = (w) => (w === 1 ? "en hel" : `${numberWords(w)} hela`);

/** Decimaltext i ord: "0,75" → "noll komma sjuttiofem", "0,05" → "noll komma noll fem". */
export function decimalWords(text) {
  const [heltal, dec] = String(text).replace("−", "").split(",");
  const sign = String(text).startsWith("−") ? "minus " : "";
  const head = numberWords(Number(heltal));
  if (!dec) return sign + head;
  const zeros = dec.match(/^0*/)[0];
  const rest = dec.slice(zeros.length);
  const tail = [...zeros].map(() => "noll").concat(rest ? [numberWords(Number(rest))] : []).join(" ");
  return `${sign}${head} komma ${tail}`;
}

/** En form (form.js) uppläst för skärmläsare. */
export function speakForm(f) {
  switch (f?.kind) {
    case "integer": return f.v < 0 ? `minus ${numberWords(-f.v)}` : numberWords(f.v);
    case "fraction": return fractionWords(f.n, f.d);
    case "mixed": return `${wholeWords(f.whole)} och ${fractionWords(f.n, f.d)}`;
    case "decimal": return decimalWords(decimalText(f.value, f.places));
    case "percent": {
      const t = decimalText(f.p);
      return `${t === null ? fractionWords(f.p.n, f.p.d) : decimalWords(t)} procent`;
    }
    default: return "";
  }
}
