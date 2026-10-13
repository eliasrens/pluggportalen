// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.2): TERMINALEN = händelseflödet längs
// högerkanten. Monospace, högst 4 rader, EN rad per händelse (filens
// feedText: "> Alma laddade ner 50 MB", "> Omar hackade Leo: +45 MB",
// "> Ines aktiverade brandvägg", "> Clara fick ett virus: −12 MB"). Lärarens
// "Visa namn" av → "Någon"/"en klasskamrat" och inga avatarer.
// Fast höjd för 4 rader – terminalen växer aldrig ut över något. Tempo och
// gallring som Guldrushen (småfiler gallras först vid trängsel).
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-flode.js – här bara terminalens texter och CSS-prefixet dknf.
//
// API
//   createTerminal(host, { pool, max?, ttlMs? }) → { add(items), el, size(), pending(), destroy() }
// ============================================================================

import { createFlode } from "../../kistspel/ks-flode.js";
import { trimPending } from "./dk-proj-scen.js";

export function createTerminal(host, { pool, max, ttlMs }) {
  return createFlode(host, {
    pool, max, ttlMs,
    cls: "dknf",
    label: "Händelser i nätverket",
    heading: `<span class="dknf-prick" aria-hidden="true"></span>nätverket.log`,
    empty: "> väntar på första filen_",
    icons: (html) => html,
    trim: trimPending,
  });
}
