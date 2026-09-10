// ============================================================================
// Pluggportalen – math-generator/prng.js  (INTERN modul-del)
// ----------------------------------------------------------------------------
// Seedbar pseudoslump för mattegeneratorn. Klassrummatte använder rå Math.random
// (icke-reproducerbart); adaptern byter ut den mot en deterministisk PRNG så att
// samma (topic, variant, seed) ALLTID ger samma tal – i linje med
// talsorter-seed-konventionen (mulberry32, se seed/talsorter-generator.mjs).
//
// Exporteras BARA internt: resten av appen ser aldrig detta – bara index.js.
// ============================================================================

/**
 * Blanda ihop godtyckliga delar (topic, variant, seed …) till ett 32-bitars frö.
 * Accepterar både tal och strängar så att seed kan vara valfri identifierare.
 * Bygger på xmur3.
 */
export function hashSeed(...parts) {
  const str = parts.map(String).join("|");
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 – liten, snabb, deterministisk PRNG. Ger tal i [0, 1). */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
