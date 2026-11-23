// ============================================================================
// Matchdagen följer det som är synligt (#899, Veckoschema A.1–A.2) – klientens sida.
// ----------------------------------------------------------------------------
// Regeln och snittet är delade med servern (delat/md-synlighet.js); här läses områdena
// för "Samma som Plugga" med Plugga-listans cachade läsningar (data-content.js getArea/
// getAreas/getSubjects, TTL-cache) – och bara när Matchdagen-sidan öppnas. De lästa
// områdena följer med till frågeströmmen (md-fragor.js läser dem inte igen).
//
//   losKallor({ inst, kalla, klasser, uid, hamta, lektion? }) → { inst, omraden: Map, fler, sparrad }
//   Del E (#903): under en lektion (lektion = grindens schemaläge) bara lektionens ämnen, med
//   reserven "Samma som Plugga inom ämnet" och spärren (delat/md-synlighet.js lektionsKallor).
//   Bara lektionens ämnen läses (synliga områden i ämnet, eller ämnets områdeslista).
//   raderUrBibliotek(library, synliga) → [{ nyckel, plugga, rakna }]   (lärarens panel)
//
// Laddas bara med import() (page-matchdagen.js, lärarens panel) – aldrig i bootgrafen (#271).
// ============================================================================

import { areaContentFlags } from "../gamemode-visibility.js";
import {
  MAX_OMRADEN, effektivaKallor, harKonkretaKallor, iLektionen, lektionsFilter, lektionsKallor, pluggaKallor, synligaOmraden, underlag,
} from "./delat/md-synlighet.js";

const rad = (nyckel, area) => ({ nyckel, ...(area ? underlag(areaContentFlags(area)) : { plugga: false, rakna: false }) });

/**
 * "Samma som Plugga"-raderna ur ett redan laddat bibliotek ([{ id, areas: [area] }] i ämnenas
 * och områdenas ordning – teacher-classes-store.js loadLibraryFrom).
 * @param {Array} library
 * @param {string[]|null} synliga  synligaOmraden(…) – null = hela biblioteket
 */
export function raderUrBibliotek(library, synliga) {
  const karta = new Map();
  for (const s of library || []) for (const a of s.areas || []) karta.set(`${s.id}/${a.id}`, a);
  return synliga ? synliga.map((k) => rad(k, karta.get(k) || null)) : [...karta].map(([k, a]) => rad(k, a));
}

/**
 * "Samma som Plugga"-raderna: de MAX_OMRADEN första synliga områdena (biblioteket: ämne för ämne,
 * bara `amnen` om de ges). De lästa områdena läggs i `omraden`.
 */
async function pluggaUr(synliga, hamta, omraden, amnen = null) {
  if (synliga) {
    // Bara de MAX_OMRADEN första läses – resten får inte plats under taket ändå.
    const med = await Promise.all(synliga.slice(0, MAX_OMRADEN).map(async (k) => {
      const [s, a] = k.split("/");
      const area = await hamta.getArea(s, a).catch(() => null);
      omraden.set(k, area);
      return rad(k, area);
    }));
    return pluggaKallor([...med, ...synliga.slice(MAX_OMRADEN).map((k) => rad(k, null))]);
  }
  // Hela biblioteket: ämne för ämne i ordning, tills taket är passerat.
  const rader = [];
  for (const s of await hamta.getSubjects()) {
    if (amnen && !amnen.includes(s.id)) continue;
    for (const a of await hamta.getAreas(s.id)) {
      const k = `${s.id}/${a.id}`;
      if (rader.length < MAX_OMRADEN) omraden.set(k, a);
      rader.push(rad(k, a));
    }
    if (rader.length > MAX_OMRADEN) break;
  }
  return pluggaKallor(rader);
}

/**
 * Källorna eleven faktiskt får (A.1–A.2, under en lektion E.1–E.3).
 * @param {object} o
 * @param {object} o.inst       normaliserad matchdagenInst (effektivInst)
 * @param {"egen"|"klass"|"standard"} o.kalla
 * @param {Array} o.klasser     getClasses()
 * @param {string} o.uid
 * @param {{getSubjects:Function, getAreas:Function, getArea:Function}} o.hamta
 * @param {string[]|null} [o.synliga]  i stället för klassernas (sidan: [] när klasslistan inte gick att läsa)
 * @param {{amnen:string[], tabeller:boolean}|null} [o.lektion]  schemaläget (grindens .schema) eller null
 * @returns {Promise<{inst:object, omraden:Map<string, object|null>, fler:boolean, sparrad:boolean}>}
 */
export async function losKallor({ inst, kalla, klasser, uid, hamta, synliga = synligaOmraden(klasser, uid), lektion = null }) {
  const amnen = lektion ? lektion.amnen : null;
  const syn = lektion ? iLektionen(synliga, amnen) : synliga;
  const omraden = new Map();
  const plugga = inst.foljPlugga ? await pluggaUr(syn, hamta, omraden, amnen) : null;
  const ut = effektivaKallor(inst, { synliga: syn, plugga, standard: kalla === "standard" });
  if (!lektion) return { inst: ut, omraden, fler: !!plugga?.fler, sparrad: false };
  // E.2: reserven läses bara när filtret inte lämnar något (och "Samma som Plugga" redan är den).
  const inom = harKonkretaKallor(lektionsFilter(ut, lektion)) ? null : plugga || await pluggaUr(syn, hamta, omraden, amnen);
  const e = lektionsKallor(ut, lektion, inom);
  return { inst: e.inst, omraden, fler: !!plugga?.fler, sparrad: e.sparrad };
}
