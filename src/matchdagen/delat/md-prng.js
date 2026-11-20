// ============================================================================
// Matchdagen (#868): seedad slump för motorn, testerna och balanssimuleringen.
// Samma frö ger samma följd i node och webbläsare. Motorn tar slumpen som en
// funktion () → [0, 1) – klienten kan skicka Math.random, testerna och
// simuleringen skapaPrng(frö).tal. Samma algoritm som Kurragömmas kg-prng.js
// (FNV-1a + mulberry32), men en egen fil: delat/ importerar bara inom delat/,
// så att mappen kan synkas till functions/ som den är (Etapp 4).
//
//   skapaPrng(seed, strom?) → { tal(), mellan(a, b), heltal(a, b), valj(lista) }
// ============================================================================

/** FNV-1a över strängformen → 32-bitars osignerat heltal. */
function hashFro(seed) {
  const s = String(seed ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32. strom = namn på en egen följd, så att delar inte flyttar varandra. */
export function skapaPrng(seed, strom = "") {
  let a = hashFro(`${seed}|${strom}`);
  const tal = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    tal,
    /** Flyttal i [a, b). */
    mellan: (lo, hi) => lo + (hi - lo) * tal(),
    /** Heltal i [a, b]. */
    heltal: (lo, hi) => lo + Math.floor((hi - lo + 1) * tal()),
    /** Ett element ur en lista. */
    valj: (lista) => lista[Math.floor(tal() * lista.length)],
  };
}
