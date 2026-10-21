// ============================================================================
// Meteorstormen (#820): seedad PRNG – den ENDA slumpen i motorn. Samma frö ger
// samma följd i node och webbläsare (bara 32-bitars heltalsoperationer).
// Aldrig Math.random() eller Date.now() i delat/.
//
//   hashFro(seed)            → 32-bitars heltal ur ett tal eller en sträng (FNV-1a)
//   skapaPrng(seed, strom?)  → { tal() ∈ [0,1), mellan(a,b), heltal(a,b), valj(vikter) }
//                              strom = namn på en egen följd ("storm", "handelser" …),
//                              så att en ändring i en del inte flyttar en annan
// ============================================================================

/** FNV-1a över strängformen → 32-bitars osignerat heltal. */
export function hashFro(seed) {
  const s = String(seed ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 – liten, snabb och helt deterministisk. */
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
    /** Heltal i [a, b] (båda inräknade). */
    heltal: (lo, hi) => lo + Math.floor((hi - lo + 1) * tal()),
    /** Nyckel ur { nyckel: vikt } – nycklarnas ordning är objektets, alltid samma. */
    valj(vikter) {
      const nycklar = Object.keys(vikter);
      const summa = nycklar.reduce((s, k) => s + vikter[k], 0);
      let r = tal() * summa;
      for (const k of nycklar) {
        r -= vikter[k];
        if (r < 0) return k;
      }
      return nycklar[nycklar.length - 1];
    },
  };
}
