// ============================================================================
// Guldrushen – Skattkammaren (#565/#578/#579, designspec §6.3): TOPP 10 VID
// SINA GULDHÖGAR. Två lika stora rader i läsordning (pileSlot): plats 1–5 i
// översta raden och 6–10 i nedersta, vänster → höger. Varje plats är elevens
// avatar (avatarpoolens huvudelement – ritad EN gång med kläder) och en
// guldhög som växer/krymper med elevens guld (pileLevel, transform: scale).
// Flytt i listan = platsens transform glider dit (CSS-transition) – ordningen
// sätts alltid direkt ur ställningen, så ingen avatar kan stanna på fel plats
// (designtest 5: 4:an → 1:an glider mjukt längst till vänster överst; en
// plats som byter rad glider också dit).
// Under varje hög en skylt: placering (👑 för ensam ledare), namn och guld
// (Elias 2026-10-10, #578: enligt specen). Skyddad (sköld 60 s/stöldskydd
// 30 s, #588) = liten 🛡️ vid namnet (§6.5) och bubblan runt avataren – BARA
// medan skyddet gäller (prot räknas om varje tick av Skattkammaren).
// Höjden räknas så att båda radernas skyltar får plats: översta radens
// skylt ligger i glappet ovanför nedersta radens figurer – ingen rad skymmer
// den andra.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-hogar.js – här bara guldhögen (SVG), skyltens "guld" och prefixet grh.
//
// API
//   pileSvg()                    guldhögens markup
//   createHogar(host, { pool }) → {
//     update(top [{ uid, rank, name, gold, prot }], { ref, leader })
//                                  ritar om bara det som ändrats
//     bump(uid)                    liten studs på högen (nytt guld)
//     areas()                      alla GR_TOP platsers yta (figur + skylt) i
//                                  skärmkoordinater – även tomma platser, så
//                                  grottans dekor-vakt (#591) inte blinkar
//                                  när en hög dyker upp
//     has(uid), el, destroy()
//   }
// ============================================================================

import { createHogar as ksCreateHogar } from "../../kistspel/ks-hogar.js";
import { tal } from "./gr-proj-scen.js";

// Guldhögen (ritas en gång per plats; höjden = transform).
export function pileSvg() {
  const mynt = [[30, 74], [52, 62], [76, 58], [100, 64], [118, 76], [44, 86], [66, 78], [90, 80], [110, 90], [60, 46], [84, 42], [72, 30]]
    .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="7" fill="${i % 3 ? "#ffd84a" : "#ffe680"}" stroke="#b07800" stroke-width="2"/>`).join("");
  return `<svg class="grh-svg" viewBox="0 0 150 112" aria-hidden="true" focusable="false">
    <ellipse cx="75" cy="106" rx="70" ry="6" fill="#000" opacity=".3"/>
    <path d="M6 106 C14 70 40 30 75 22 C110 30 136 70 144 106Z" fill="url(#grh-g)" stroke="#a86f00" stroke-width="3"/>
    <path d="M30 96 C40 70 56 46 75 38" fill="none" stroke="#fff3b0" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    ${mynt}
    <path d="M100 48 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4Z" class="grh-glimt" fill="#fffbe0"/>
    <path d="M38 64 l8 -8 l8 8 l-8 10Z" fill="#86d8e8" stroke="#2f7f94" stroke-width="2"/>
    <path d="M112 92 l7 -7 l7 7 l-7 9Z" fill="#e88fa8" stroke="#a84a64" stroke-width="2"/>
  </svg>`;
}

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="grh-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#ffc928"/><stop offset="1" stop-color="#d48f00"/></linearGradient>
</defs></svg>`;

export function createHogar(host, { pool }) {
  return ksCreateHogar(host, { pool, cls: "grh", pileHtml: pileSvg, defs: DEFS, amount: (n) => `${tal(n)} guld` });
}
