// ============================================================================
// Bråkresan – inmatningsparser (src/brakresan/math/input.js) · #706
// ----------------------------------------------------------------------------
// Spec §5: "Ogiltig notation, tomt fält eller nämnare 0 ger begriplig
// inmatningshjälp" – och räknas INTE som ett fel svar (låser inte uppgiften).
// Varje parser svarar därför antingen
//   { ok: true,  form }                        (form enligt form.js)
//   { ok: false, error, message }              INMATNINGSFEL, ingen bedömning
// error ∈ "tom" | "ofullstandig" | "ogiltig" | "namnare-noll".
//
// Bråk matas in i SEPARATA fält (täljare/nämnare, blandad form har även ett
// heltalsfält – spec §4 komponent 1). Decimal och procent accepterar både komma
// och punkt samt onödiga slutnollor ("0,50" = 0,5, men formen minns 2 decimaler).
// Modulen har inga negativa tal: ett minustecken är ogiltig inmatning.
// Inga flyttal på vägen – siffersträngar blir heltal direkt.
// ============================================================================

import { q } from "./rational.js";

const MAX_DIGITS = 9;

export const INPUT_MESSAGES = Object.freeze({
  tom: "Skriv ett svar först.",
  ofullstandig: "Fyll i både täljare och nämnare.",
  "namnare-noll": "Nämnaren kan inte vara 0. Den säger hur många lika delar helheten är delad i.",
  ogiltig: "Skriv bara siffror.",
  "ogiltig-decimal": "Skriv ett tal med siffror, till exempel 0,75.",
  "ogiltig-procent": "Skriv ett procenttal med siffror, till exempel 25.",
});

const fail = (error, key = error) => ({ ok: false, error, message: INPUT_MESSAGES[key] });
const clean = (t) => String(t ?? "").replace(/[\s ]+/g, "");

/** Ett naturligt tal ur ett fält: "007" → 7, "" → null (tomt), "3,5"/"−2"/"x" → NaN. */
function natural(text) {
  const t = clean(text);
  if (t === "") return null;
  if (!/^\d+$/.test(t) || t.replace(/^0+(?=\d)/, "").length > MAX_DIGITS) return NaN;
  return Number(t);
}

/** Heltalsfält: "12" → { kind: "integer", v: 12 }. */
export function parseInteger(text) {
  const v = natural(text);
  if (v === null) return fail("tom");
  if (Number.isNaN(v)) return fail("ogiltig");
  return { ok: true, form: { kind: "integer", v } };
}

/** Bråkfälten { n, d }: ("6", "8") → { kind: "fraction", n: 6, d: 8 } (OREDUCERAT). */
export function parseFraction({ n, d } = {}) {
  const t = natural(n);
  const m = natural(d);
  if (t === null && m === null) return fail("tom");
  if (Number.isNaN(t) || Number.isNaN(m)) return fail("ogiltig");
  if (t === null || m === null) return fail("ofullstandig");
  if (m === 0) return fail("namnare-noll");
  return { ok: true, form: { kind: "fraction", n: t, d: m } };
}

/**
 * Blandad form { whole, n, d }. Tomt heltalsfält (eller 0) = vanligt bråk; tomma
 * bråkfält = heltal. Formen sparas som skriven, även "2 5/4" (otillåten blandad
 * form) – det är formkravet (requirements.js) som avgör om skrivsättet duger,
 * inte parsern.
 */
export function parseMixed({ whole, n, d } = {}) {
  const w = natural(whole);
  const fracEmpty = clean(n) === "" && clean(d) === "";
  if (w === null && fracEmpty) return fail("tom");
  if (Number.isNaN(w)) return fail("ogiltig");
  if (fracEmpty) return { ok: true, form: { kind: "integer", v: w } };
  const f = parseFraction({ n, d });
  if (!f.ok) return f;
  if (!w) return f;
  return { ok: true, form: { kind: "mixed", whole: w, n: f.form.n, d: f.form.d } };
}

/** Decimaltal: "0,5" / "0.50" / ",5" / "2" → { kind: "decimal", value, places }. */
export function parseDecimal(text) {
  const t = clean(text);
  if (t === "") return fail("tom");
  const m = /^(\d*)(?:[.,](\d*))?$/.exec(t);
  if (!m || (m[1] === "" && !m[2]) || m[1].length + (m[2] || "").length > MAX_DIGITS) {
    return fail("ogiltig", "ogiltig-decimal");
  }
  const dec = m[2] || "";
  const v = q(Number((m[1] || "0") + dec), 10 ** dec.length);
  return { ok: true, form: { kind: "decimal", value: { n: v.n, d: v.d }, places: dec.length } };
}

/** Procent: "25", "25 %", "12,5%" → { kind: "percent", p }. */
export function parsePercent(text) {
  const t = clean(text).replace(/%$/, "");
  if (t === "") return fail("tom");
  const r = parseDecimal(t);
  if (!r.ok) return fail("ogiltig", "ogiltig-procent");
  return { ok: true, form: { kind: "percent", p: r.form.value } };
}

/**
 * Fritt skrivet tal (lärarverktyg, tester, kortetiketter): "3/4", "2 3/4",
 * "0,75", "75 %", "7". Elevens svarsfält använder i stället de fältvisa
 * parsrarna ovan.
 */
export function parseText(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return fail("tom");
  if (/%\s*$/.test(raw)) return parsePercent(raw);
  const mixedM = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(raw);
  if (mixedM) return parseMixed({ whole: mixedM[1], n: mixedM[2], d: mixedM[3] });
  const fracM = /^(\d*)\s*\/\s*(\d*)$/.exec(raw);
  if (fracM) return parseFraction({ n: fracM[1], d: fracM[2] });
  if (/^\d+$/.test(raw)) return parseInteger(raw);
  return parseDecimal(raw);
}

/** Parsern för en svarstyp (requirements/uppgiftsschemat): "fraction" | "mixed" | … */
export const PARSERS = Object.freeze({
  integer: parseInteger,
  fraction: parseFraction,
  mixed: parseMixed,
  decimal: parseDecimal,
  percent: parsePercent,
  text: parseText,
});
