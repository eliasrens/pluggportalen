// ============================================================================
// Pluggporten – veckoschemat på lärarsidan (#901, docs/VECKOSCHEMA.md), REN logik
// ----------------------------------------------------------------------------
// Det lärarens sektion "Veckoschema" (teacher-class-schema.js) räknar med: lägga
// till en lektion på flera dagar på en gång, ändra och ta bort, nekandet vid
// krock och texterna på enkel svenska. Ingen Firebase, ingen DOM – testas i Node
// (test/klass-schema-larare.test.mjs). Laddas bara dynamiskt (#271).
// ============================================================================

import {
  DAG_NAMN,
  SCHEMA_MAX_LEKTIONER,
  aktivLektion,
  lektionKrock,
  nyttLektionsId,
  sorteradeLektioner,
  tidTillMinuter,
} from "./klass-schema.js";

/** "08:20" → "8.20" (som man skriver klockslag i Sverige). */
export function visaTid(hhmm) {
  const m = tidTillMinuter(hhmm);
  if (m == null) return String(hhmm || "");
  return `${Math.floor(m / 60)}.${String(m % 60).padStart(2, "0")}`;
}

/** Ämnets namn ur ämneslistan (id:t om det saknas). */
export function amnesNamn(subjects, id) {
  return (subjects || []).find((s) => s?.id === id)?.name || id;
}

/** "NO 9.00–10.00" – texten på ett lektionskort. */
export function lektionText(lektion, subjects) {
  return `${amnesNamn(subjects, lektion.amne)} ${visaTid(lektion.start)}–${visaTid(lektion.slut)}`;
}

/** "HH:MM" `min` minuter efter `hhmm` (klampat till 23:59). */
export function tidEfter(hhmm, min) {
  const m = Math.min((tidTillMinuter(hhmm) ?? 480) + min, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Lägg till (eller ändra) en lektion på en eller flera dagar.
 * @param {Array} lektioner  nuvarande lektioner
 * @param {{amne:string, start:string, slut:string, dagar:number[], id?:string}} val
 *   id = lektionen som ändras: den får den FÖRSTA valda dagen, övriga dagar blir nya lektioner.
 * @param {{subjects?:Array, slump?:Function}} [opts]
 * @returns {{lektioner:Array}|{fel:string}}  nya listan, eller ett besked på enkel svenska
 */
export function laggTillLektioner(lektioner, val, { subjects = [], slump } = {}) {
  const lista = Array.isArray(lektioner) ? lektioner : [];
  if (!val?.amne) return { fel: "Välj ett ämne." };
  const start = tidTillMinuter(val.start);
  const slut = tidTillMinuter(val.slut);
  if (start == null || slut == null) return { fel: "Skriv in både Från och Till." };
  if (start >= slut) return { fel: "Till måste vara senare än Från." };
  const dagar = [...new Set(val.dagar || [])].filter((d) => DAG_NAMN[d]).sort((a, b) => a - b);
  if (!dagar.length) return { fel: "Välj minst en dag." };

  const ovriga = lista.filter((l) => l.id !== val.id);
  const anvanda = new Set(ovriga.map((l) => l.id));
  const nya = dagar.map((dag, i) => {
    let id = i === 0 && val.id ? val.id : null;
    while (!id || anvanda.has(id)) id = nyttLektionsId(slump);
    anvanda.add(id);
    return { id, dag, start: val.start, slut: val.slut, amne: val.amne };
  });
  for (const l of nya) {
    const krock = lektionKrock(ovriga, l);
    if (krock) return { fel: `Lektionen krockar med ${lektionText(krock, subjects)} på ${DAG_NAMN[krock.dag]}.` };
  }
  if (ovriga.length + nya.length > SCHEMA_MAX_LEKTIONER)
    return { fel: `Schemat rymmer högst ${SCHEMA_MAX_LEKTIONER} lektioner.` };
  // Den ändrade lektionen behåller sin plats i listan (ordningen spelar ingen roll för eleven).
  const ut = val.id && lista.some((l) => l.id === val.id)
    ? lista.map((l) => (l.id === val.id ? nya[0] : l)).concat(nya.slice(1))
    : [...lista, ...nya];
  return { lektioner: ut };
}

/** Lektionerna utan lektionen `id`. */
export function taBortLektion(lektioner, id) {
  return (lektioner || []).filter((l) => l.id !== id);
}

/** Lektionerna per dag 1–5, sorterade på tid: { 1: [...], …, 5: [...] }. */
export function veckan(lektioner) {
  const ut = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const l of sorteradeLektioner(lektioner)) ut[l.dag]?.push(l);
  return ut;
}

/**
 * Raden om läget just nu (C.2). `lagesText` får det ämnesnamn eleverna ser;
 * `filtrerarInget(amne)` = lektionens ämne har inget i klassen (allt syns).
 * @returns {{text:string, delar:{fore,amne,efter}|null, aktiv:object|null}}  delar: ämnet i fetstil
 */
export function lageRad(schema, now, { subjects = [], fokus = false, filtrerarInget = () => false } = {}) {
  if (!schema?.pa) return rad("Schemat är inte aktiverat – eleverna ser allt som vanligt.");
  if (!schema.lektioner?.length) return rad("Lägg till lektioner så börjar schemat gälla.");
  if (fokus) return rad("Fokusläget är på – det gäller före schemat just nu.");
  const l = aktivLektion({ schema }, now);
  if (!l) return rad("Ingen lektion just nu – eleverna ser allt som vanligt.");
  const namn = amnesNamn(subjects, l.amne);
  const slutet = filtrerarInget(l.amne)
    ? "inga områden valda, så eleverna ser allt."
    : `eleverna ser ${namn}.`;
  return {
    text: `Nu: ${namn} till ${visaTid(l.slut)} – ${slutet}`,
    delar: { fore: "Nu: ", amne: namn, efter: ` till ${visaTid(l.slut)} – ${slutet}` },
    aktiv: l,
  };
}

const rad = (text) => ({ text, delar: null, aktiv: null });
