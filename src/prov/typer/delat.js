// ============================================================================
// Prov (#738): det som alla frågetyper delar – gränserna (§2.3), de gemensamma
// fälten (id, typ, fraga, poang, hjalptext) och en stabil blandning.
// Varje typfil (src/prov/typer/<typ>.js) anropar valideraGemensamt först och
// lägger sina egna fält ovanpå; utanFacit utgår från elevFalt.
// ============================================================================

import { POANG_MAX, POANG_MIN, POANG_STANDARD, arGiltigMaxpoang, poangTal } from "../prov-poang.js";

export const GRANS = Object.freeze({
  fragor: 60,          // frågor + textblock i ett prov
  fragetext: 1000,     // fraga
  textblock: 6000,     // text-blockets brodtext
  titel: 200,          // text-blockets titel
  hjalptext: 500,
  alternativ: 300,     // ett flervalsalternativ, ett par-led, en sak att ordna
  kortsvar: 100,       // elevens kortsvar / en lucka
  fritext: 4000,       // elevens fritextsvar
  bedomningsstod: 4000,
  lucktext: 3000,      // lucktextens text inklusive [[…]]
  luckor: 30,
  poang: POANG_MAX,    // högsta poäng på en fråga (0,5–20 i steg om 0,5, #762)
  instruktion: 1000,   // avsnittets instruktion (#762)
  kriterier: 20,       // poängkriterier på en fritextfråga (#762)
});

// Fråge-id blir nycklar i svar/rättning (Firestore-fältnamn) → enkla tecken.
export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export const arText = (v) => typeof v === "string" && v.trim().length > 0;
export const trimmad = (v) => (typeof v === "string" ? v.trim() : "");

/** Antal tecken som eleven ser dem (kodpunkter). */
export const tecken = (s) => Array.from(String(s ?? "")).length;

/** Klipp en sträng till högst n tecken (kodpunkter). */
export const klipp = (s, n) => Array.from(String(s ?? "")).slice(0, n).join("");

/**
 * De gemensamma fälten (§2.1 "Alla frågor"). `arFraga: false` = textblock
 * (ingen frågetext, ingen poäng).
 * @returns {{ fel: string[], varningar: string[], value: object }}
 */
export function valideraGemensamt(f, { arFraga = true } = {}) {
  const fel = [];
  const varningar = [];
  const value = {};
  if (f.id !== undefined && f.id !== null && f.id !== "") value.id = String(f.id).trim();
  if (!arFraga) return { fel, varningar, value };

  if (!arText(f.fraga)) fel.push('frågetexten ("fraga") saknas eller är tom');
  else if (tecken(f.fraga.trim()) > GRANS.fragetext) fel.push(`frågetexten är för lång (högst ${GRANS.fragetext} tecken)`);
  value.fraga = trimmad(f.fraga);

  // Halvpoäng (#762, §2.2): 0,5–20 i steg om 0,5. Text med decimalkomma ("3,5") går också.
  let poang = POANG_STANDARD;
  if (f.poang !== undefined && f.poang !== null && f.poang !== "") {
    const n = typeof f.poang === "string" ? Number(f.poang.trim().replace(",", ".")) : f.poang;
    if (!arGiltigMaxpoang(n)) fel.push(`poängen ("poang") måste vara ${poangTal(POANG_MIN)}–${poangTal(POANG_MAX)} i steg om ${poangTal(0.5)}`);
    else poang = n;
  }
  value.poang = poang;

  if (f.hjalptext !== undefined && f.hjalptext !== null && f.hjalptext !== "") {
    if (typeof f.hjalptext !== "string") fel.push('"hjalptext" måste vara en text');
    else if (tecken(f.hjalptext.trim()) > GRANS.hjalptext) fel.push(`hjälptexten är för lång (högst ${GRANS.hjalptext} tecken)`);
    else if (f.hjalptext.trim()) value.hjalptext = f.hjalptext.trim();
  }
  return { fel, varningar, value };
}

/** Det eleven får se av de gemensamma fälten (inget facit finns här). */
export function elevFalt(f) {
  const out = { id: f.id, typ: f.typ, fraga: f.fraga, poang: f.poang };
  if (f.hjalptext) out.hjalptext = f.hjalptext;
  return out;
}

/**
 * En lista med texter (alternativ, par-led, saker): 1–gräns tecken var.
 * Felen säger vilken post ("alternativ 3: …").
 */
export function textLista(v, { namn, min, max, unika = false }) {
  const fel = [];
  if (!Array.isArray(v)) return { fel: [`"${namn}" måste vara en lista`], value: [] };
  const value = v.map((x) => (typeof x === "number" ? String(x) : trimmad(x)));
  if (value.length < min || value.length > max) fel.push(`${min}–${max} ${namn} krävs (nu ${value.length})`);
  value.forEach((x, i) => {
    if (!x) fel.push(`${namn} ${i + 1} är tomt`);
    else if (tecken(x) > GRANS.alternativ) fel.push(`${namn} ${i + 1} är för långt (högst ${GRANS.alternativ} tecken)`);
  });
  if (unika) {
    const sett = new Set();
    value.forEach((x, i) => {
      const k = x.toLowerCase();
      if (x && sett.has(k)) fel.push(`${namn} ${i + 1} finns redan ("${x}") – alla måste vara olika`);
      sett.add(k);
    });
  }
  return { fel, value };
}

/** Ett frö (32 bitar) ur en sträng – FNV-1a. */
function fro(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Blanda en lista stabilt (samma frö → samma ordning, så att elevens vy och
 * rättningen ser likadana ut). Blir blandningen ändå samma ordning som
 * facit roteras den ett steg – ordningen får aldrig avslöja facit.
 */
export function blanda(lista, frö) {
  const ut = [...lista];
  let s = fro(frö) || 1;
  const slump = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = ut.length - 1; i > 0; i--) {
    const j = Math.floor(slump() * (i + 1));
    [ut[i], ut[j]] = [ut[j], ut[i]];
  }
  if (ut.length > 1 && ut.every((x, i) => x === lista[i])) ut.push(ut.shift());
  return ut;
}

/** Svaret som en lista med strängar (klippta), för luckor/par/ordna. */
export function strangLista(v, n, maxTecken) {
  const lista = Array.isArray(v) ? v : [];
  return Array.from({ length: n }, (_, i) => klipp(typeof lista[i] === "string" ? lista[i] : "", maxTecken));
}
