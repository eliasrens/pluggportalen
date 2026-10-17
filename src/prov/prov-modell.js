// ============================================================================
// Prov (#738, spec §3): datamodellen som ren logik – statusflödet, vägarna,
// delningen av ett prov i elevens frågor + lärarens facit när provet öppnas,
// numreringen och "obesvarade". Ingen Firebase/DOM; B–E bygger på den här.
//
//   prov/{provId}                          provet (med facit), ägaren skriver
//   provTillfallen/{t}                     ett prov i en klass (UTAN facit)
//   provTillfallen/{t}/privat/facit        facit + bedömningsstöd (lärare)
//   provTillfallen/{t}/svar/{elevUid}      elevens svar
//   provTillfallen/{t}/rattning/{elevUid}  lärarens rättning
// Fälten: docs/DATAMODELL.md "Prov". Reglerna: firestore.rules "PROV".
// ============================================================================

import { arFraga, fragetyp } from "./prov-fragetyper.js";

export const SAMLING_PROV = "prov";
export const SAMLING_TILLFALLEN = "provTillfallen";
export const FACIT_DOK = ["privat", "facit"]; // under provTillfallen/{t}
export const SVAR = "svar";
export const RATTNING = "rattning";

export const STATUS = Object.freeze({ FORBERETT: "forberett", OPPET: "oppet", STANGT: "stangt" });
export const STATUS_NAMN = Object.freeze({ forberett: "Förberett", oppet: "Öppet", stangt: "Stängt" });

// Tillåtna övergångar (§4) – speglas i firestore.rules provStatusOk.
const OVERGANGAR = { forberett: ["oppet"], oppet: ["stangt"], stangt: ["oppet"] };

/** Får tillfället gå från status `fore` till `efter`? Samma status = ja. */
export function statusOvergangOk(fore, efter) {
  return fore === efter || (OVERGANGAR[fore] || []).includes(efter);
}

// Elevens svar får vara inlämnat på tre sätt (§3, svar.inlamnadNar).
export const INLAMNAD_NAR = Object.freeze(["elev", "tid", "stangt"]);

// Reglernas marginal efter tidsgränsen (§4): sparningar i 2 minuter till.
export const TIDSMARGINAL_MS = 2 * 60 * 1000;

// Nivåerna (§6.2) – frivilliga, null = ingen nivå.
export const NIVAER = Object.freeze([
  { id: "EG", namn: "Ej godtagbart" },
  { id: "G", namn: "Godtagbart" },
  { id: "MG", namn: "Mer än godtagbart" },
]);

/**
 * Dela ett validerat prov när det öppnas (§5.2): elevens frågor (utanFacit)
 * till tillfället, facit + bedömningsstöd till privat/facit.
 * @param {{ fragor: object[] }} prov value från validateProv / prov-dokumentet
 * @returns {{ fragor: object[], facit: Record<string, any>, bedomningsstod: Record<string, string> }}
 */
export function delaUppProv(prov) {
  const fragor = [];
  const facit = {};
  const bedomningsstod = {};
  for (const f of prov?.fragor || []) {
    const typ = fragetyp(f.typ);
    if (!typ) continue;
    fragor.push(typ.utanFacit(f));
    const fa = typ.facit(f);
    if (fa !== null && fa !== undefined) facit[f.id] = fa;
    const stod = typ.bedomningsstod?.(f);
    if (stod) bedomningsstod[f.id] = stod;
  }
  return { fragor, facit, bedomningsstod };
}

/** Frågornas nummer som eleven ser dem: { [fragaId]: 1, … } (textblock saknas). */
export function fragaNummer(fragor) {
  const nr = {};
  let n = 0;
  for (const f of fragor || []) if (arFraga(f)) nr[f.id] = ++n;
  return nr;
}

/** Startvärdena för elevens svar-map (tillfällets frågor). */
export function tomtSvar(fragor) {
  const svar = {};
  for (const f of fragor || []) {
    const typ = fragetyp(f.typ);
    if (typ && arFraga(f)) svar[f.id] = typ.tomtSvar(f);
  }
  return svar;
}

/**
 * Svar-mapen i giltig form innan den sparas: bara tillfällets frågor,
 * varje svar rensat av sin typ (klippt, okända val bort).
 */
export function rensaSvar(svar, fragor) {
  const ut = {};
  for (const f of fragor || []) {
    const typ = fragetyp(f.typ);
    if (typ && arFraga(f) && svar && Object.prototype.hasOwnProperty.call(svar, f.id)) ut[f.id] = typ.rensaSvar(svar[f.id], f);
  }
  return ut;
}

/**
 * Besvarade/obesvarade frågor (§5.5 "Du har svarat på 10 av 12 frågor.
 * Fråga 4 och 9 är obesvarade.").
 * @returns {{ besvarade: number, antal: number, obesvarade: number[] }} obesvarade = frågenummer
 */
export function besvarat(fragor, svar) {
  const nr = fragaNummer(fragor);
  const obesvarade = [];
  let besvarade = 0;
  for (const f of fragor || []) {
    if (!arFraga(f)) continue;
    const typ = fragetyp(f.typ);
    if (typ && typ.arBesvarad(svar?.[f.id], f)) besvarade++;
    else obesvarade.push(nr[f.id]);
  }
  return { besvarade, antal: besvarade + obesvarade.length, obesvarade };
}

/** "Fråga 4 och 9" / "Fråga 2, 5 och 7" / "Fråga 3" ("" om inga). */
export function fragaLista(nummer) {
  if (!nummer?.length) return "";
  if (nummer.length === 1) return `Fråga ${nummer[0]}`;
  return `Fråga ${nummer.slice(0, -1).join(", ")} och ${nummer[nummer.length - 1]}`;
}

/** Högsta möjliga poäng på tillfällets frågor. */
export function maxPoang(fragor) {
  return (fragor || []).filter(arFraga).reduce((s, f) => s + (Number(f.poang) || 0), 0);
}

/**
 * Automatiska rättningsförslag för en elev (§6.1): en post per fråga som kan
 * rättas automatiskt, i rattning.fragor-form med auto: true. Frågor utan
 * förslag (fritext, och stavfel när läraren rättar dem själv) saknas – dem
 * rättar läraren.
 * @param {object[]} fragor tillfällets frågor (utan facit)
 * @param {Record<string, any>} svar elevens svar-map
 * @param {Record<string, any>} facit privat/facit.facit
 * @param {{ stavfel?: "auto"|"sjalv" }} [opt] provets stavfelsval (#759, standard auto)
 */
export function autoForslag(fragor, svar, facit, opt = {}) {
  const ut = {};
  for (const f of fragor || []) {
    const typ = fragetyp(f.typ);
    if (!typ?.autoratt || !(f.id in (facit || {}))) continue;
    const r = typ.forslag(svar?.[f.id] ?? typ.tomtSvar(f), facit[f.id], f, opt);
    if (r) ut[f.id] = { poang: r.poang, ratt: r.ratt, auto: true };
  }
  return ut;
}
