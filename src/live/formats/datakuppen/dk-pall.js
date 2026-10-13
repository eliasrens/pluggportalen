// ============================================================================
// Datakuppen – Nätverket (#654, spec §0.2, §4.4): PALLPLATSEN. Spelas EXAKT en
// gång per fönster (regins final), sedan står resultatet kvar:
//   rubriken exakt "🏆 Datakuppen – Prispall", inga klassnamn, pallen
//   centrerad efter placering utan tomma platser (2:an vänster, 1:an mitten,
//   3:an höger – saknade steg byggs inte), data och pluggmyntpriset under
//   varje plats, den lugna totalraden "Tillsammans: 12 400 MB" och ett
//   säkerhetstips (roterar, tipAt).
// Pallen byggs av små serverskåp (piece). Reducerad rörelse: samma ordning,
// toningar, inget regn.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-pall.js – här bara byggstenen, "💾 … MB", färgerna, ljuden, prefixet
// dknp och säkerhetstipset under totalraden.
//
// API
//   createFinal(host, { pool, sound, now? }) → {
//     play(data, signal) → Promise, showResult(data), el, destroy()
//   }   data som ks-pall (groups, prize(rank), title, together, everyone)
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { createFinal as ksCreateFinal } from "../../kistspel/ks-pall.js";
import { tal, tipAt } from "./dk-proj-scen.js";

const FARGER = ["#39ff9f", "#3ee8ff", "#ffb547", "#ff7ad9", "#e6fbff"];

// Ett litet serverskåp (pallens byggsten).
const BLOCK = `<svg viewBox="0 0 60 26" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="57" height="23" rx="4" fill="#0c1d3f" stroke="#3ee8ff" stroke-width="2.5"/><rect x="7" y="9" width="26" height="8" rx="2" fill="#16305e"/><circle cx="42" cy="13" r="3" fill="#39ff9f"/><circle cx="51" cy="13" r="3" fill="#3ee8ff"/></svg>`;

export function createFinal(host, { pool, sound, now = () => Date.now() }) {
  const ks = ksCreateFinal(host, {
    pool, sound,
    cls: "dknp",
    piece: BLOCK,
    amountHtml: (n) => `💾 ${tal(n)} MB`,
    colors: FARGER,
    cues: { open: "dkStart", drum: "trumvirvel", win: "fanfar", rain: "dkRegn" },
  });
  const tips = document.createElement("p");
  tips.className = "dknp-tips";
  ks.el.insertBefore(tips, ks.el.querySelector(".dknp-folk"));
  const visaTips = () => {
    const t = tipAt(now());
    const html = `<span class="dknp-tips-ikon" aria-hidden="true">🔑</span> <b>Säkerhetstips:</b> ${esc(t)}`;
    if (tips.innerHTML !== html) tips.innerHTML = html;
  };
  visaTips();
  const iv = setInterval(visaTips, 1000);
  return {
    ...ks,
    destroy() {
      clearInterval(iv);
      ks.destroy();
    },
  };
}
