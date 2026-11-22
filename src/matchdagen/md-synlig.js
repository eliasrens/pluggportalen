// ============================================================================
// Matchdagen följer det som är synligt (#899, Veckoschema A.1–A.2) – klientens sida.
// ----------------------------------------------------------------------------
// Regeln och snittet är delade med servern (delat/md-synlighet.js); här läses områdena
// för "Samma som Plugga" med Plugga-listans cachade läsningar (data-content.js getArea/
// getAreas/getSubjects, TTL-cache) – och bara när Matchdagen-sidan öppnas. De lästa
// områdena följer med till frågeströmmen (md-fragor.js läser dem inte igen).
//
//   losKallor({ inst, kalla, klasser, uid, hamta }) → { inst, omraden: Map, fler }
//   raderUrBibliotek(library, synliga) → [{ nyckel, plugga, rakna }]   (lärarens panel)
//
// Laddas bara med import() (page-matchdagen.js, lärarens panel) – aldrig i bootgrafen (#271).
// ============================================================================

import { areaContentFlags } from "../gamemode-visibility.js";
import { MAX_OMRADEN, effektivaKallor, pluggaKallor, synligaOmraden, underlag } from "./delat/md-synlighet.js";

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
 * Källorna eleven faktiskt får (A.1–A.2).
 * @param {object} o
 * @param {object} o.inst       normaliserad matchdagenInst (effektivInst)
 * @param {"egen"|"klass"|"standard"} o.kalla
 * @param {Array} o.klasser     getClasses()
 * @param {string} o.uid
 * @param {{getSubjects:Function, getAreas:Function, getArea:Function}} o.hamta
 * @returns {Promise<{inst:object, omraden:Map<string, object|null>, fler:boolean}>}
 */
export async function losKallor({ inst, kalla, klasser, uid, hamta }) {
  const synliga = synligaOmraden(klasser, uid);
  const omraden = new Map();
  let plugga = null;
  if (inst.foljPlugga) {
    let rader;
    if (synliga) {
      // Bara de MAX_OMRADEN första läses – resten får inte plats under taket ändå.
      const med = await Promise.all(synliga.slice(0, MAX_OMRADEN).map(async (k) => {
        const [s, a] = k.split("/");
        const area = await hamta.getArea(s, a).catch(() => null);
        omraden.set(k, area);
        return rad(k, area);
      }));
      rader = [...med, ...synliga.slice(MAX_OMRADEN).map((k) => rad(k, null))];
    } else {
      // Hela biblioteket: ämne för ämne i ordning, tills taket är passerat.
      rader = [];
      for (const s of await hamta.getSubjects()) {
        for (const a of await hamta.getAreas(s.id)) {
          const k = `${s.id}/${a.id}`;
          if (rader.length < MAX_OMRADEN) omraden.set(k, a);
          rader.push(rad(k, a));
        }
        if (rader.length > MAX_OMRADEN) break;
      }
    }
    plugga = pluggaKallor(rader);
  }
  return { inst: effektivaKallor(inst, { synliga, plugga, standard: kalla === "standard" }), omraden, fler: !!plugga?.fler };
}
