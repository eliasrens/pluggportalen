// ============================================================================
// Meteorstormen – projektorns ANPASSADE RENDERINGSBUFFERT (#822 F1). Ren, node-
// testad. Projektorn ritar nu − buffert. Bufferten börjar på
// RENDER_FORDROJNING_MS (3 s) och VÄXER när händelserna når just den här
// projektorn sent: varje händelses leveranstid mäts (ankomst på den
// server-korrigerade klockan − händelsens serverstämpel t) och bufferten blir
// ≈ p95 + marginal, högst BUFFERT_MAX_MS. Den krymper aldrig under en match –
// så blir en ruta som visats aldrig fel i efterhand så länge leveranserna
// ryms under taket. Renderingsklockan (stegaKlocka) saktar in mjukt (fart ≥ 0,8)
// när bufferten växer; t går aldrig bakåt.
// Priset: på ett dåligt nät ligger bilden längre efter elevernas tryck, och
// över taket (8 s) kan en sen händelse fortfarande ändra en visad ruta.
//
//   skapaBuffert({ bas?, max?, marginal? }) → {
//     matt(leveransMs)   en uppmätt leveranstid
//     varde()            bufferten just nu (ms) – växer bara
//     stat()             { buffertMs, n, median, p95, max } (leveranstiderna)
//   }
// ============================================================================

import { RENDER_FORDROJNING_MS } from "./delat/ms-balans.js";

export const BUFFERT_MAX_MS = 8000;
export const BUFFERT_MARGINAL_MS = 500;
const FONSTER = 400; // de senaste leveranserna
const MIN_PROV = 8; // färre prov än så: den största, inte p95

const kvantil = (sorterad, q) => sorterad[Math.min(sorterad.length - 1, Math.floor(sorterad.length * q))];

export function skapaBuffert({ bas = RENDER_FORDROJNING_MS, max = BUFFERT_MAX_MS, marginal = BUFFERT_MARGINAL_MS } = {}) {
  const prov = [];
  let varde = bas;
  return {
    matt(ms) {
      if (!Number.isFinite(ms)) return varde;
      prov.push(Math.max(0, ms));
      if (prov.length > FONSTER) prov.shift();
      const s = [...prov].sort((a, b) => a - b);
      const hog = s.length >= MIN_PROV ? kvantil(s, 0.95) : s[s.length - 1];
      varde = Math.min(max, Math.max(varde, hog + marginal));
      return varde;
    },
    varde: () => varde,
    stat() {
      const s = [...prov].sort((a, b) => a - b);
      return { buffertMs: Math.round(varde), n: s.length, median: s.length ? Math.round(kvantil(s, 0.5)) : null,
        p95: s.length ? Math.round(kvantil(s, 0.95)) : null, max: s.length ? Math.round(s[s.length - 1]) : null };
    },
  };
}
