// ============================================================================
// Matchdagen följer det som är synligt (#899, Veckoschema Del A) – DELAD ren kod för
// klienten (md-synlig.js, lärarens panel) och servern (functions/md-vanskap-lobby.js,
// kopian functions/matchdagen/md-synlighet.js – npm run sync:matchdagen). Inga importer.
//
// A.1  Elevens synliga områden = klassens assignedAreas, eller HELA biblioteket när listan
//      är tom eller saknas. Klassen är den Plugga-listan använder (pages-elev.js →
//      data-classes.js getClassForStudent): den FÖRSTA av klasserna i getClasses-ordningen
//      (order, sedan namnet på svenska) som har eleven.
//      Matchdagens effektiva källor = de valda ∩ de synliga (omraden och rakna). Tabellerna rörs inte.
// A.2  "Samma som Plugga" (foljPlugga): källorna är de synliga områdena med underlag –
//      Plugga (quiz eller par) och Räkna (generator), samma grind som panelen
//      (gamemode-visibility.js areaContentFlags). Taket: de MAX_OMRADEN FÖRSTA synliga
//      områdena i klassens ordning (biblioteket: ämnenas, sedan områdenas order) – servern
//      läser alltså aldrig fler än MAX_OMRADEN områden. Utan några inställningar alls
//      (standard) och utan synliga områden med underlag: tabellerna 0–10 som förr.
//
//   elevensKlass(klasser, uid)              → klassen eller null
//   synligaOmraden(klasser, uid)            → ["ämne/område", …] i klassens ordning | null (hela biblioteket)
//   arSynligt(nyckel, synliga)              → bool
//   underlag(flaggor)                       → { plugga, rakna }   (flaggor = areaContentFlags(area))
//   pluggaKallor(rader)                     → { omraden, rakna, fler }   rader = [{ nyckel, plugga, rakna }]
//   effektivaKallor(inst, { synliga, plugga, standard }) → inst med konkreta omraden/rakna/tabeller
//
// Del E (#903, docs/VECKOSCHEMA.md) – under en lektion. `lektion` = elevens schemaläge
// (klass-schema.js schemaForStudent: { amnen, tabeller, label, klockslag }) eller null:
// E.1  omraden/rakna bara i lektionens ämnen; tabellerna bara när matchdagen:tabeller är kopplad
//      till ett av dem (lektion.tabeller).
// E.2  blir det inget kvar: "Samma som Plugga inom ämnet" – de synliga områdena med underlag i
//      lektionens ämnen (inomAmnet = pluggaKallor över dem); har ämnet inga sådana men tabellerna
//      är kopplade: tabellerna 0–10.
// E.3  finns inget alls: spärrad (lektionsBesked säger när Matchdagen öppnar igen).
//
//   klassOrdning(klasser)                   → klasserna i getClasses-ordningen
//   iLektionen(synliga, amnen)              → de synliga i lektionens ämnen (null = hela biblioteket)
//   lektionsFilter(inst, lektion)           → inst med E.1
//   harKonkretaKallor(inst)                 → bool (efter effektivaKallor)
//   lektionsKallor(inst, lektion, inomAmnet) → { inst, reserv, sparrad }
//   lektionsBesked(lektion, kompis?)        → det vänliga beskedet när Matchdagen är spärrad
// ============================================================================

export const MAX_OMRADEN = 60;
/** Reserven för en elev helt utan inställningar och utan synliga områden med underlag. */
export const STANDARD_TABELLER = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const lista = (v) => (Array.isArray(v) ? v : []);

/** Klasserna i getClasses-ordningen (data-classes.js): order, sedan namnet på svenska. */
function sorterade(klasser) {
  return lista(klasser).slice().sort((a, b) =>
    (Number(a?.order) || 0) - (Number(b?.order) || 0) || String(a?.name || "").localeCompare(String(b?.name || ""), "sv"));
}

/** Klasserna i getClasses-ordningen – servern läser dem utan ordning (schemaForStudent tar den första). */
export const klassOrdning = (klasser) => sorterade(klasser);

/** Klassen Plugga-listan använder: den första (getClasses-ordningen) som har eleven. */
export function elevensKlass(klasser, uid) {
  return sorterade(klasser).find((c) => lista(c?.studentIds).includes(uid)) || null;
}

/**
 * Elevens synliga områden: klassens assignedAreas som "ämne/område" i klassens ordning,
 * eller null = hela biblioteket (ingen klass, eller tom/saknad lista).
 */
export function synligaOmraden(klasser, uid) {
  const ut = [];
  for (const a of lista(elevensKlass(klasser, uid)?.assignedAreas)) {
    const s = typeof a?.subjectId === "string" ? a.subjectId.trim() : "";
    const o = typeof a?.areaId === "string" ? a.areaId.trim() : "";
    const k = `${s}/${o}`;
    if (s && o && !ut.includes(k)) ut.push(k);
  }
  return ut.length ? ut : null;
}

export const arSynligt = (nyckel, synliga) => synliga === null || lista(synliga).includes(nyckel);

/** Vilka källor ett område kan ge (flaggor = areaContentFlags). */
export const underlag = (f) => ({ plugga: !!(f?.quiz || f?.pairs), rakna: !!f?.generator });

/**
 * "Samma som Plugga": de första MAX_OMRADEN synliga områdena (i klassens ordning), uppdelade
 * på Plugga och Räkna efter underlaget. fler = det fanns fler synliga områden än taket.
 * @param {Array<{nyckel:string, plugga:boolean, rakna:boolean}>} rader
 */
export function pluggaKallor(rader) {
  const r = lista(rader);
  const med = r.slice(0, MAX_OMRADEN);
  return {
    omraden: med.filter((x) => x.plugga).map((x) => x.nyckel),
    rakna: med.filter((x) => x.rakna).map((x) => x.nyckel),
    fler: r.length > MAX_OMRADEN,
  };
}

/**
 * Källorna som faktiskt används. inst = normaliserad matchdagenInst (foljPlugga, omraden,
 * tabeller, rakna …). Resultatet har foljPlugga: false och konkreta listor.
 * @param {object} inst
 * @param {object} o
 * @param {string[]|null} o.synliga   synligaOmraden(…)
 * @param {{omraden:string[], rakna:string[]}|null} [o.plugga]  pluggaKallor(…) – krävs när inst.foljPlugga
 * @param {boolean} [o.standard]      eleven har inga inställningar alls (varken egna eller klassens)
 */
export function effektivaKallor(inst, { synliga, plugga = null, standard = false }) {
  const ut = { ...inst, foljPlugga: false, tabeller: lista(inst.tabeller).slice() };
  if (inst.foljPlugga) {
    ut.omraden = lista(plugga?.omraden).slice();
    ut.rakna = lista(plugga?.rakna).slice();
    if (standard && !ut.omraden.length && !ut.rakna.length && !ut.tabeller.length) ut.tabeller = STANDARD_TABELLER.slice();
  } else {
    ut.omraden = lista(inst.omraden).filter((k) => arSynligt(k, synliga));
    ut.rakna = lista(inst.rakna).filter((k) => arSynligt(k, synliga));
  }
  return ut;
}

// ---- Del E: under en lektion (#903) ---------------------------------------------

const amneAv = (nyckel) => String(nyckel).split("/")[0];
const iAmnen = (amnen) => (k) => lista(amnen).includes(amneAv(k));

/** De synliga områdena i lektionens ämnen; null (hela biblioteket) förblir null, [] förblir []. */
export function iLektionen(synliga, amnen) {
  return synliga === null ? null : lista(synliga).filter(iAmnen(amnen));
}

/** E.1: omraden/rakna i lektionens ämnen, tabellerna bara om de är kopplade till lektionens ämne. */
export function lektionsFilter(inst, lektion) {
  if (!lektion) return inst;
  return {
    ...inst,
    omraden: lista(inst.omraden).filter(iAmnen(lektion.amnen)),
    rakna: lista(inst.rakna).filter(iAmnen(lektion.amnen)),
    tabeller: lektion.tabeller ? lista(inst.tabeller).slice() : [],
  };
}

/** Finns det någon konkret källa (efter effektivaKallor – foljPlugga är då uträknad)? */
export const harKonkretaKallor = (inst) => lista(inst?.omraden).length + lista(inst?.rakna).length + lista(inst?.tabeller).length > 0;

/**
 * Källorna under en lektion (E.1–E.3). inst = effektivaKallor(…). inomAmnet = pluggaKallor över de
 * synliga områdena i lektionens ämnen – behövs bara när E.1 inte lämnar något (harKonkretaKallor).
 * @returns {{inst:object, reserv:boolean, sparrad:boolean}}
 */
export function lektionsKallor(inst, lektion, inomAmnet = null) {
  if (!lektion) return { inst, reserv: false, sparrad: false };
  const filtrerad = lektionsFilter(inst, lektion);
  if (harKonkretaKallor(filtrerad)) return { inst: filtrerad, reserv: false, sparrad: false };
  const reserv = {
    ...filtrerad,
    omraden: lista(inomAmnet?.omraden).filter(iAmnen(lektion.amnen)),
    rakna: lista(inomAmnet?.rakna).filter(iAmnen(lektion.amnen)),
  };
  if (!reserv.omraden.length && !reserv.rakna.length && lektion.tabeller) reserv.tabeller = STANDARD_TABELLER.slice();
  const sparrad = !harKonkretaKallor(reserv);
  return { inst: reserv, reserv: !sparrad, sparrad };
}

/** "09:00" → "9.00" (svensk skrivning, som lärarens vecka). */
export const svKlocka = (hhmm) => String(hhmm || "").replace(/^0(?=\d)/, "").replace(":", ".");

/** Beskedet när Matchdagen är spärrad under lektionen (E.3) – för eleven själv eller om kompisen. */
export function lektionsBesked(lektion, kompis = false) {
  const amne = String(lektion?.label || "").trim();
  const kl = svKlocka(lektion?.klockslag);
  return kompis
    ? `Kompisen har ${amne}-lektion just nu och kan inte få några frågor till Matchdagen. Prova igen efter klockan ${kl}.`
    : `Just nu är det ${amne}-lektion och Matchdagen har inga frågor i ${amne}. Matchdagen öppnar igen klockan ${kl}.`;
}
