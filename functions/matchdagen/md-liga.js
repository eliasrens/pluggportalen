// ============================================================================
// Matchdagen (#868, Etapp 1b): ligan – ren (spec §5, §7.1). Schemat (round robin
// med cirkelmetoden), motståndarnas dolda styrka, omgångens övriga matcher
// (simMal) och tabellen. Slumpen skickas in (rng: () → [0, 1)). Testas i node
// (test/matchdagen-motor.test.js), används av balanssimuleringen och av
// säsongen i Etapp 1c.
//
//   schema(ids)                       → omgångar: [[[hemma, borta], …], …] (n − 1 omgångar, jämnt n)
//   styrkaFor(div, rng)               → kl(0,20 + div × 0,09 ± 0,05; 0,12; 0,92)
//   simMal(styrka, motStyrka, rng)    → [mål, motståndarmål]
//   nyTabell(ids)                     → { [id]: { s, v, o, f, gm, im, p } }
//   laggTill(tabell, a, b, malA, malB)→ ny tabell med matchen inräknad
//   sorteraTabell(tabell)             → rader [{ id, s, v, o, f, gm, im, md, p }] i placeringsordning
// ============================================================================

import * as C from "./md-config.js";
import { kl } from "./md-motor.js";

/**
 * Round robin med cirkelmetoden: första laget står still, de andra roterar.
 * Alla möter alla exakt en gång, varje lag spelar en match per omgång.
 * @param {Array<string|number>} ids  jämnt antal lag
 */
export function schema(ids) {
  const n = ids.length;
  if (n < 2 || n % 2) throw new Error("schema: ett jämnt antal lag (minst 2) behövs");
  const rot = ids.slice();
  const omgangar = [];
  for (let r = 0; r < n - 1; r++) {
    const par = [];
    for (let i = 0; i < n / 2; i++) {
      // Växla hemma/borta för det fasta laget så att det inte alltid är hemma.
      const a = rot[i];
      const b = rot[n - 1 - i];
      par.push(i === 0 && r % 2 ? [b, a] : [a, b]);
    }
    omgangar.push(par);
    rot.splice(1, 0, rot.pop());
  }
  return omgangar;
}

/** Ett motståndarlags dolda styrka i divisionen (div 0 = Division 6). */
export function styrkaFor(div, rng) {
  const s = C.STYRKA;
  return kl(s.bas + div * s.perDiv + (rng() * 2 - 1) * s.spridning, s.min, s.max);
}

/** Poisson-fördelat antal (Knuths metod), högst max. */
function poisson(lambda, rng, max) {
  const grans = Math.exp(-lambda);
  let k = 0;
  let p = rng();
  while (p > grans && k < max) {
    k++;
    p *= rng();
  }
  return k;
}

/** En match mellan två datorlag (omgångens övriga matcher, spec §5). */
export function simMal(styrka, motStyrka, rng) {
  const s = C.SIM_MAL;
  const lambda = (a, b) => kl(s.bas * (1 + (a - b) * s.skillnad), s.min, s.max);
  return [poisson(lambda(styrka, motStyrka), rng, s.max), poisson(lambda(motStyrka, styrka), rng, s.max)];
}

/** En tom tabell för lagen. */
export function nyTabell(ids) {
  return Object.fromEntries(ids.map((id) => [id, { s: 0, v: 0, o: 0, f: 0, gm: 0, im: 0, p: 0 }]));
}

/** Tabellen med en spelad match till (ändrar inte den gamla). */
export function laggTill(tabell, a, b, malA, malB) {
  const ut = Object.fromEntries(Object.entries(tabell).map(([id, r]) => [id, { ...r }]));
  const rakna = (id, gjorda, insl) => {
    const r = ut[id];
    if (!r) throw new Error(`laggTill: laget ${id} finns inte i tabellen`);
    r.s++;
    r.gm += gjorda;
    r.im += insl;
    if (gjorda > insl) { r.v++; r.p += C.POANG.vinst; } else if (gjorda < insl) { r.f++; r.p += C.POANG.forlust; } else { r.o++; r.p += C.POANG.oavgjort; }
  };
  rakna(a, malA, malB);
  rakna(b, malB, malA);
  return ut;
}

/** Placeringsordningen: poäng, målskillnad, gjorda mål – sedan lagets id (stabilt). */
export function sorteraTabell(tabell) {
  return Object.entries(tabell)
    .map(([id, r]) => ({ id, ...r, md: r.gm - r.im }))
    .sort((x, y) => y.p - x.p || y.md - x.md || y.gm - x.gm || String(x.id).localeCompare(String(y.id)));
}
