// ============================================================================
// Prov (#763, spec §2.3.1/§8.1): flytta kort i redigeraren – DOM-fritt och
// testat (test/prov-flytta.test.js). Korten är frågor, textblock och avsnitt;
// numreringen är löpande och räknar bara frågorna (fragaNummer, #762).
//
//   flyttaTillIndex(prov, fran, till)  kortet hamnar på index `till` (dra ⋮⋮)
//   indexForPlats(fragor, fran, plats) "Flytta till…" plats → index (se nedan)
//   platsGrans(fragor, fran)           { max, arFraga } – fältets gräns
//   flyttaTillPlats(prov, fran, plats) båda ovan i ett anrop → nytt prov
// ============================================================================

import { arFraga } from "./prov-fragetyper.js";

/** Flytta kortet på `fran` så att det hamnar på index `till` (inklämt i listan). */
export function flyttaTillIndex(prov, fran, till) {
  const fragor = [...(prov.fragor || [])];
  if (fran < 0 || fran >= fragor.length) return prov;
  const t = Math.max(0, Math.min(Number(till) || 0, fragor.length - 1));
  if (t === fran) return prov;
  const [f] = fragor.splice(fran, 1);
  fragor.splice(t, 0, f);
  return { ...prov, fragor };
}

/**
 * "Flytta till…": `plats` är ett frågenummer (1, 2, 3 … som på korten).
 * En fråga BLIR fråga `plats` och hamnar bredvid frågan som har numret nu,
 * i samma avsnitt: uppåt direkt före den, nedåt direkt efter den. Ett
 * avsnitt eller textblock hamnar direkt före fråga `plats` (avsnittet börjar
 * där); en plats efter den sista frågan = efter alla frågor.
 * @returns {number} index som kortet ska få (efter flytten)
 */
export function indexForPlats(fragor, fran, plats) {
  const ovriga = fragor.filter((_, i) => i !== fran);
  const fragIndex = ovriga.flatMap((f, i) => (arFraga(f) ? [i] : []));
  const p = Math.max(1, Math.min(Math.round(Number(plats) || 1), fragIndex.length + 1));
  if (arFraga(fragor[fran])) {
    const nu = fragor.slice(0, fran + 1).filter(arFraga).length;
    if (p === nu) return fran;
    if (p > nu) return fragIndex[p - 2] + 1;
  }
  if (p <= fragIndex.length) return fragIndex[p - 1];
  return fragIndex.length ? fragIndex[fragIndex.length - 1] + 1 : ovriga.length;
}

/** Högsta platsen fältet tar emot: provets antal frågor (för en fråga) eller ett mer (avsnitt/textblock = sist). */
export function platsGrans(fragor, fran) {
  const fraga = arFraga(fragor[fran]);
  const antal = fragor.filter((f, i) => i !== fran && arFraga(f)).length;
  return { arFraga: fraga, max: Math.max(1, antal + 1) };
}

export function flyttaTillPlats(prov, fran, plats) {
  return flyttaTillIndex(prov, fran, indexForPlats(prov.fragor || [], fran, plats));
}
