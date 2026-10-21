// ============================================================================
// Meteorstormen (#820): STORMPLANEN – vilka meteorer och händelser som kommer
// när. Bestäms helt av fröet och speltiden (inte av klasserna eller loggen),
// och är spegelvänd: varje station får exakt samma lista. Ren, delas med
// servern (functions/meteorstorm/).
//
//   intensitetVid(andel)            → meteorer/s (per station) ur INTENSITET
//   handelsePlan(seed, varaktighet) → [{ id, typ, startMs, slutMs }] relativt start
//   meteorPlan(seed, varaktighet, handelser)
//                                   → [{ n, spawnMs, ankomstMs, storlek, bana, jatte? }]
//                                     relativt start, sorterad på spawnMs, n = löpnummer
//   skapaPlan(seed, varaktighet)    → { handelser, meteorer } (cachad per frö+tid)
//   aktivHandelse(handelser, relMs) → händelsen som pågår, eller null
//
// Alla tider ligger på motorns stegnät (multiplar av STEG_MS).
// ============================================================================

import {
  STEG_MS, INTENSITET, STORM_FORDROJNING_MS, STORM_SPRIDNING, METEOR_FLYGTID_MS,
  STORLEK_VIKTER_START, STORLEK_VIKTER_SLUT, HANDELSE, HANDELSE_TYPER,
  HANDELSE_FORSTA_MS, HANDELSE_AVSTAND_MS, HANDELSE_PAUS_MS, HANDELSE_SENAST_ANDEL, JATTEMETEOR_TIDIGAST_MS,
} from "./ms-balans.js";
import { skapaPrng } from "./ms-prng.js";

const tillSteg = (ms) => Math.round(ms / STEG_MS) * STEG_MS;

/** Styckvis linjär intensitet (meteorer/s) vid andel ∈ [0,1] av speltiden. */
export function intensitetVid(andel) {
  const a = Math.min(1, Math.max(0, andel));
  for (let i = 1; i < INTENSITET.length; i++) {
    const [x1, y1] = INTENSITET[i];
    const [x0, y0] = INTENSITET[i - 1];
    if (a <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (a - x0)) / (x1 - x0);
  }
  return INTENSITET[INTENSITET.length - 1][1];
}

/**
 * Händelserna: högst en i taget, ungefär en per 90 s. Typerna dras ur en
 * blandad "påse" med alla fyra (ny påse när den är tom, aldrig samma två i rad),
 * så att varje match får ungefär lika många av varje sort – jämnare svårighet.
 */
export function handelsePlan(seed, varaktighetMs) {
  const rng = skapaPrng(seed, "handelser");
  const ut = [];
  let pase = [];
  let t = tillSteg(rng.mellan(...HANDELSE_FORSTA_MS));
  let forra = null;
  while (true) {
    if (!pase.length) {
      pase = HANDELSE_TYPER.filter((typ) => HANDELSE[typ].vikt > 0);
      for (let i = pase.length - 1; i > 0; i--) {
        const j = rng.heltal(0, i);
        [pase[i], pase[j]] = [pase[j], pase[i]];
      }
      if (pase[0] === forra && pase.length > 1) pase.push(pase.shift());
    }
    if (pase[0] === "jattemeteor" && t < JATTEMETEOR_TIDIGAST_MS && pase.length > 1) pase.push(pase.shift());
    const typ = pase.shift();
    const slut = t + HANDELSE[typ].langdMs;
    if (slut > varaktighetMs * HANDELSE_SENAST_ANDEL) break;
    ut.push({ id: `h${ut.length + 1}`, typ, startMs: t, slutMs: slut });
    forra = typ;
    t = tillSteg(Math.max(t + rng.mellan(...HANDELSE_AVSTAND_MS), slut + HANDELSE_PAUS_MS));
  }
  return ut;
}

/**
 * Storleken: "jämn tur" efter vikterna (varje storlek samlar sin vikt, den med
 * mest kommer – med lite slump), så att andelen stora meteorer blir nästan
 * densamma i varje match. Samma frö → samma följd.
 */
function valjStorlek(acc, vikter, rng) {
  let bast = null;
  for (const k of Object.keys(vikter)) {
    acc[k] += vikter[k] * (0.75 + 0.5 * rng.tal());
    if (bast === null || acc[k] > acc[bast]) bast = k;
  }
  acc[bast] -= 1;
  return bast;
}

function vikterVid(andel) {
  const v = {};
  for (const k of Object.keys(STORLEK_VIKTER_START)) {
    v[k] = STORLEK_VIKTER_START[k] + (STORLEK_VIKTER_SLUT[k] - STORLEK_VIKTER_START[k]) * andel;
  }
  return v;
}

/**
 * Meteorerna. Intensiteten ackumuleras steg för steg; en meteor släpps när
 * ackumulatorn når en tröskel som varierar runt 1 (STORM_SPRIDNING) – jämnare
 * än ren slump, så att två frön blir ungefär lika svåra. Lugnet: inga nya
 * meteorer under händelsen. Jättemeteorn släpps när händelsen börjar och
 * landar när den slutar.
 */
export function meteorPlan(seed, varaktighetMs, handelser = handelsePlan(seed, varaktighetMs)) {
  const rng = skapaPrng(seed, "storm");
  const ut = [];
  const lugn = handelser.filter((h) => h.typ === "lugnet");
  const jatte = handelser.filter((h) => h.typ === "jattemeteor");
  const sista = varaktighetMs - METEOR_FLYGTID_MS;
  let acc = rng.tal();
  let trosk = 1;
  const storlekAcc = Object.fromEntries(Object.keys(STORLEK_VIKTER_START).map((k) => [k, rng.tal()]));
  let j = 0;
  for (let t = STORM_FORDROJNING_MS; t <= sista; t += STEG_MS) {
    while (j < jatte.length && jatte[j].startMs <= t) {
      const h = jatte[j++];
      ut.push({ spawnMs: h.startMs, ankomstMs: h.slutMs, storlek: "jatte", bana: Math.round(rng.tal() * 1000) / 1000, jatte: true });
    }
    const andel = t / varaktighetMs;
    acc += (intensitetVid(andel) * STEG_MS) / 1000;
    if (acc < trosk) continue;
    acc -= trosk;
    trosk = 1 + STORM_SPRIDNING * (rng.tal() * 2 - 1);
    if (lugn.some((h) => t >= h.startMs && t < h.slutMs)) continue;
    ut.push({
      spawnMs: t,
      ankomstMs: t + METEOR_FLYGTID_MS,
      storlek: valjStorlek(storlekAcc, vikterVid(andel), rng),
      bana: Math.round(rng.tal() * 1000) / 1000,
    });
  }
  while (j < jatte.length) {
    const h = jatte[j++];
    ut.push({ spawnMs: h.startMs, ankomstMs: h.slutMs, storlek: "jatte", bana: 0.5, jatte: true });
  }
  ut.sort((a, b) => a.spawnMs - b.spawnMs || (a.jatte ? 1 : 0) - (b.jatte ? 1 : 0));
  return ut.map((m, n) => ({ n, ...m }));
}

const planCache = new Map();

/** Hela planen för ett frö och en speltid – samma objekt vid upprepade anrop (fryst). */
export function skapaPlan(seed, varaktighetMs) {
  const nyckel = `${typeof seed}:${seed}|${varaktighetMs}`;
  let plan = planCache.get(nyckel);
  if (!plan) {
    const handelser = handelsePlan(seed, varaktighetMs).map((h) => Object.freeze(h));
    const meteorer = meteorPlan(seed, varaktighetMs, handelser).map((m) => Object.freeze(m));
    plan = Object.freeze({ handelser: Object.freeze(handelser), meteorer: Object.freeze(meteorer) });
    if (planCache.size > 16) planCache.delete(planCache.keys().next().value);
    planCache.set(nyckel, plan);
  }
  return plan;
}

/** Pågående händelse vid relMs (start inräknad, slut inte), annars null. */
export function aktivHandelse(handelser, relMs) {
  for (const h of handelser) if (relMs >= h.startMs && relMs < h.slutMs) return h;
  return null;
}
