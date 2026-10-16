// ============================================================================
// Bråkresan – seedad slump (src/brakresan/schema/prng.js) · #706
// ----------------------------------------------------------------------------
// Spec §6: "Samma parametrar ger samma problem". Generatorer får BARA använda
// denna slump (aldrig Math.random): createRng("seed") ger samma följd i
// webbläsaren, i Node och i Cloud Functions. mulberry32 med strängseed – samma
// familj som Ekvationsresan (src/ekvationsresan/generator.js seededRng).
// Själva seeden för en elevomgång väljs på servern med node:crypto (C).
// ============================================================================

function hashSeed(seed) {
  const s = String(seed);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Seedad slumpkälla.
 *   rng()            flyttal i [0, 1) – bara för val, aldrig för matematik
 *   rng.int(a, b)    heltal a..b (inklusive båda)
 *   rng.pick(list)   ett element
 *   rng.shuffle(l)   ny blandad kopia (Fisher–Yates)
 *   rng.sample(l,k)  k olika element
 *   rng.chance(p)    true med sannolikhet p
 *   rng.fork(label)  oberoende delström (samma seed + label = samma följd)
 */
export function createRng(seed) {
  let a = hashSeed(seed);
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = String(seed);
  rng.int = (lo, hi) => {
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi < lo) {
      throw new RangeError(`Bråkresan: rng.int(${lo}, ${hi})`);
    }
    return lo + Math.floor(rng() * (hi - lo + 1));
  };
  rng.pick = (list) => {
    if (!list.length) throw new RangeError("Bråkresan: rng.pick på tom lista");
    return list[Math.floor(rng() * list.length)];
  };
  rng.shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  rng.sample = (list, k) => rng.shuffle(list).slice(0, k);
  rng.chance = (p) => rng() < p;
  rng.fork = (label) => createRng(`${rng.seed}/${label}`);
  return rng;
}
