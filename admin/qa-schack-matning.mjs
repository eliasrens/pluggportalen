#!/usr/bin/env node
// ============================================================================
// Schack (#776): mät motorns tid per drag och nivå i node – samma ställningar
// som preview/preview-schack-matning.html (workern i webbläsaren, gärna med
// CPU-strypning som Chromebook-uppskattning). Skriver en markdown-tabell för
// docs/SCHACK.md.
//
//   node admin/qa-schack-matning.mjs            tidsgränsen från motorn (900 ms)
//   node admin/qa-schack-matning.mjs --faktor 5 simulera en 5× långsammare maskin
//                                               (klockan går 5× fortare → samma
//                                               budget i "Chromebook-ms")
// ============================================================================

import { valjDrag, NIVAER, TIDSGRANS_MS } from "../src/schack/schack-motor.js";
import { STALLNINGAR, tabell } from "../preview/schack/matning.js";

const arg = (namn, std) => {
  const i = process.argv.indexOf(namn);
  return i > 0 ? Number(process.argv[i + 1]) : std;
};
const faktor = arg("--faktor", 1);
const tidsgransMs = arg("--tidsgrans", TIDSGRANS_MS);
const nu = () => performance.now() * faktor;

const rader = [];
for (const n of NIVAER) {
  for (const st of STALLNINGAR) {
    const r = valjDrag(st.fen, { niva: n.id, seed: 1, tidsgransMs, nu });
    rader.push({ niva: n.id, stallning: st.id, ms: r.ms, djup: r.djup, noder: r.noder, drag: `${r.drag.from}${r.drag.to}` });
    console.log(`${n.id.padEnd(10)} ${st.id.padEnd(9)} ${rader.at(-1).drag.padEnd(5)} djup ${r.djup}  ${r.ms.toFixed(0).padStart(5)} ms  ${String(r.noder).padStart(7)} noder`);
  }
}
console.log(`\nTidsgräns ${tidsgransMs} ms, klockfaktor ${faktor}× (${faktor === 1 ? "riktig tid" : "simulerad långsam maskin"}):\n`);
console.log(tabell(rader));
