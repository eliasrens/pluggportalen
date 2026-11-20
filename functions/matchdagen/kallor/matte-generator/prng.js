// ============================================================================
// Matte­generator (issue #278) – deterministisk slump (INTERN modul)
// ----------------------------------------------------------------------------
// Klassrummatte läste global Math.random(); här äger adaptern EN intern
// slumpström som byts per anrop. All slump i plugin-utils/plugins går genom
// rnd() (aldrig Math.random) → samma frö ger samma tal, varje gång. I linje med
// talsorter-seed-konventionen (seed/talsorter-generator.mjs, mulberry32).
//
// Denna fil är privat bakom src/matte-generator.js – importera inte härifrån
// från resten av appen.
// ============================================================================

/** xmur3: vik en sträng till en 32-bitars fröfunktion (för mulberry32). */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32: liten, snabb, reproducerbar PRNG → tal i [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Modul-lokal, delad slumpström. Default är Math.random tills en generering
// sätter ett frö via setRng(). generate() är synkron, så det finns aldrig två
// aktiva strömmar samtidigt.
const state = { next: Math.random };

/** Dra nästa slumptal ur den aktiva strömmen. */
export function rnd() {
  return state.next();
}

/** Byt aktiv slumpström; returnerar den föregående (så anroparen kan återställa). */
export function setRng(fn) {
  const prev = state.next;
  state.next = fn;
  return prev;
}
