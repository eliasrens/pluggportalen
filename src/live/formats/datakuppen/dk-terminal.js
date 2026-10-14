// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.2): TERMINALEN = händelseflödet längs
// högerkanten. Monospace, högst 4 rader, EN rad per händelse (filens
// feedText: "> Alma laddade ner 50 MB", "> Omar hackade Leo: +45 MB",
// "> Ines aktiverade brandvägg", "> Clara fick ett virus: −12 MB"). Lärarens
// "Visa namn" av → "Någon"/"en klasskamrat" och inga avatarer.
// Fast höjd för 4 rader – terminalen växer aldrig ut över något. Tempo och
// gallring som Guldrushen (småfiler gallras först vid trängsel). En rad som
// inte ryms krymps (ner till MIN_FIT av storleken) innan den kortas med "…",
// så att beloppet i slutet ("+100 MB") syns.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-flode.js – här bara terminalens texter och CSS-prefixet dknf.
//
// API
//   createTerminal(host, { pool, max?, ttlMs? }) → { add(items), el, size(), pending(), destroy() }  (ks-flode)
// ============================================================================

import { createFlode } from "../../kistspel/ks-flode.js";
import { trimPending } from "./dk-proj-scen.js";

const MIN_FIT = 0.75;

/** Krymp radens text så att den ryms (ellipsen tar resten). */
function fit(li) {
  const t = li.querySelector?.(".dknf-text");
  if (!t || !t.clientWidth || t.scrollWidth <= t.clientWidth) return;
  const nu = parseFloat(t.style.fontSize) || 1;
  t.style.fontSize = `${Math.max(MIN_FIT, (nu * t.clientWidth) / t.scrollWidth).toFixed(3)}em`;
}

export function createTerminal(host, { pool, max, ttlMs }) {
  const flode = createFlode(host, {
    pool, max, ttlMs,
    cls: "dknf",
    label: "Händelser i nätverket",
    heading: `<span class="dknf-prick" aria-hidden="true"></span>nätverket.log`,
    empty: "> väntar på första filen_",
    icons: (html) => html,
    trim: trimPending,
  });
  const mo = new MutationObserver((recs) => {
    // Direkt och en gång till när avataren ritats (den tar plats från texten).
    for (const r of recs) r.addedNodes.forEach((li) => { fit(li); setTimeout(() => fit(li), 400); });
  });
  mo.observe(flode.el.querySelector(".dknf-lista"), { childList: true });
  return {
    ...flode,
    destroy() {
      mo.disconnect();
      flode.destroy();
    },
  };
}
