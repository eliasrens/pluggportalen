// ============================================================================
// Matchdagen (#868, Etapp 1b): elevens frågeström (spec §2) ur lärarens val i
// matchdagenInst (md-inst.js). Källorna (md-kallor.js): varje valt Plugga-
// område, multiplikationstabellerna (EN källa för alla valda tabeller) och
// varje valt Räkna-område.
//
//   skapaFragestrom({ inst, uid, hamtaOmrade, lagring?, rng? })
//     → { tom: true, meddelande }                    inga frågor – ingen match kan startas
//     → { tom: false, kallor, nasta(), ratta(fraga, svar) }
//   hamtaOmrade(subjectId, areaId) → Promise<area|null>  (webben: data-content.js getArea,
//                                    som cachar – samma läsning som Plugga gör)
//
// Blandningen: källorna turas om jämnt (createTopicBag ur rakna-core.js – varje
// källa en gång per varv, aldrig samma två gånger i rad). Påsen: samma fråga
// kommer inte tillbaka förrän källans alla frågor har kommit; en påse per källa,
// sparad i localStorage (nyckel PASE_NYCKEL + uid) efter varje fråga, så den
// håller över omladdningar och sessioner. Ändrar läraren innehållet börjar
// källans påse om. Svårigheten är alltid elevens egen – inget hänger på divisionen.
// Laddas bara med import() – aldrig i bootgrafen (#271).
// ============================================================================

import { INGA_FRAGOR, harKallor, normalizeInst } from "./md-inst.js";
import { omradeKalla, raknaKalla, rattaFraga, tabellKalla } from "./md-kallor.js";
import { createTopicBag, hashSeed } from "../rakna-core.js";

export { INGA_FRAGOR };
export const SAKNADE_FRAGOR = "Frågorna din lärare valt går inte att hitta just nu. Säg till din lärare!";
export const PASE_NYCKEL = "matchdagen-pase:";

/** localStorage som tål privata fönster och blockerad lagring. */
export function webbLagring() {
  return {
    hamta(k) {
      try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; }
    },
    spara(k, v) {
      try { globalThis.localStorage?.setItem(k, v); } catch { /* bara bekvämlighet */ }
    },
  };
}

/** Ett kort fingeravtryck av källans nycklar – ändras innehållet börjar påsen om. */
const avtryck = (nycklar) => `${nycklar.length}:${hashSeed(nycklar.join("|"))}`;

function lasPasar(lagring, uid) {
  try {
    const v = JSON.parse(lagring.hamta(PASE_NYCKEL + uid) || "null");
    return v && v.v === 1 && v.kallor && typeof v.kallor === "object" ? v : { v: 1, kallor: {} };
  } catch {
    return { v: 1, kallor: {} };
  }
}

/** Nästa nyckel ur källans påse; fyller på (blandat) när den är tom. */
function dra(kalla, post, rng) {
  const finns = new Set(kalla.nycklar);
  let kvar = (post.av === avtryck(kalla.nycklar) && Array.isArray(post.kvar) ? post.kvar : []).filter((k) => finns.has(k));
  if (!kvar.length) {
    kvar = kalla.nycklar.slice();
    for (let i = kvar.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [kvar[i], kvar[j]] = [kvar[j], kvar[i]];
    }
    // Inte samma fråga två gånger i rad över påsgränsen.
    if (kvar.length > 1 && kvar[0] === post.senast) [kvar[0], kvar[1]] = [kvar[1], kvar[0]];
  }
  const nyckel = kvar.shift();
  return { nyckel, post: { av: avtryck(kalla.nycklar), kvar, senast: nyckel } };
}

/**
 * Elevens frågeström.
 * @param {object} o
 * @param {object} o.inst                 matchdagenInst (normaliseras)
 * @param {string} o.uid                  eleven (påsens nyckel)
 * @param {(s:string, a:string) => Promise<object|null>} o.hamtaOmrade
 * @param {{hamta:Function, spara:Function}} [o.lagring]  standard: localStorage
 * @param {() => number} [o.rng]          standard: Math.random (seedad i testerna)
 */
export async function skapaFragestrom({ inst, uid, hamtaOmrade, lagring = webbLagring(), rng = Math.random }) {
  const i = normalizeInst(inst);
  if (!harKallor(i)) return { tom: true, meddelande: INGA_FRAGOR };

  const omrade = async (nyckel) => {
    const [s, a] = nyckel.split("/");
    try { return await hamtaOmrade(s, a); } catch (err) {
      console.warn("Matchdagen: området kunde inte läsas", nyckel, err);
      return null;
    }
  };
  const [omraden, rakna] = await Promise.all([
    Promise.all(i.omraden.map(async (k) => omradeKalla(k, await omrade(k)))),
    Promise.all(i.rakna.map(async (k) => raknaKalla(k, await omrade(k)))),
  ]);
  const alla = [...omraden, ...(i.tabeller.length ? [tabellKalla(i.tabeller)] : []), ...rakna];
  const kallor = alla.filter((k) => k.nycklar === null || k.nycklar.length > 0);
  if (!kallor.length) return { tom: true, meddelande: SAKNADE_FRAGOR };

  const pasar = lasPasar(lagring, uid);
  const fro = Math.floor(rng() * 2 ** 32);
  for (const k of kallor) if (k.nycklar === null) k.starta(Number(pasar.kallor[k.id]?.n) || 0, uid, fro);
  const blandning = createTopicBag(kallor, Math.floor(rng() * 2 ** 32));
  let nr = 0;

  return {
    tom: false,
    kallor: kallor.map((k) => ({ id: k.id, antal: k.nycklar ? k.nycklar.length : Infinity })),
    /** Nästa fråga (källorna turas om, påsen sparas). */
    nasta() {
      const k = blandning.next();
      let nyckel;
      if (k.nycklar === null) {
        const n = (Number(pasar.kallor[k.id]?.n) || 0) + 1;
        pasar.kallor[k.id] = { n };
        nyckel = `n${n}`;
      } else {
        const r = dra(k, pasar.kallor[k.id] || {}, rng);
        pasar.kallor[k.id] = r.post;
        nyckel = r.nyckel;
      }
      try { lagring.spara(PASE_NYCKEL + uid, JSON.stringify(pasar)); } catch { /* påsen är en bekvämlighet */ }
      const f = k.fraga(nyckel, rng, i.svarssatt);
      return {
        inputMode: "text",
        ...f,
        id: `${k.id}#${nyckel}#${++nr}`,
        nyckel,
        kalla: k.kalla(nyckel),
        kallTyp: k.id === "multiplikation" ? "tabell" : k.id.split(":")[0],
      };
    },
    /** Rätta: index (flerval) eller text (skriv själv) → { giltig, ratt, facit }. */
    ratta: rattaFraga,
  };
}
