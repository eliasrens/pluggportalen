// ============================================================================
// Guldrushen – Skattkammaren (#565): PALLPLATSEN (designspec §6.7). Spelas
// EXAKT en gång per fönster (regins final, live-events.js sparar det i
// sessionStorage – en omladdning visar bara resultatet), ~10 s:
//   tungt grottljud → grottan mörknar, facklorna lyser upp en pall av
//   guldtackor → trumvirvel → 3:an → trumvirvel → 2:an → längre trumvirvel →
//   1:an med guldmyntsregn, konfetti och fanfar → vinnaren jublar → den lugna
//   totalraden "Tillsammans: 4 380 guld 💰" med alla elevernas avatarer som
//   jublar → resultatskärmen (står kvar). Rubriken "🏆 Guldrushen – Prispall";
//   inga klassnamn någonstans på skärmen (#592).
// Pallen visar topp 3 med namn och avatarer (enligt specen, #578). Delad
// placering = samma pallsteg (podiumGroups). Färre än tre steg → bara de
// som finns byggs, så pallen står centrerad utan tomma platser (#592). Pluggmyntpriset för placeringen
// under varje steg (sessionens rewards, #557). Figurerna är avatarpoolens
// egna element (plats "pall"/"jubel") – kläderna följer med. Reducerad rörelse:
// samma ordning, toningar i stället för hopp, inget regn/konfetti.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-pall.js – här bara guldtackan, "💰 … guld", färgerna, grottans ljud och
// prefixet grp.
//
// API
//   createFinal(host, { pool, sound }) → {
//     play(data, signal) → Promise     hela sekvensen, sedan resultatet
//     showResult(data)                 direkt till resultatskärmen
//     el, destroy()
//   }
//   data = { groups, prize(rank) → mynt|0, title, together (betrodd HTML),
//            everyone: [uid] }
// ============================================================================

import { createFinal as ksCreateFinal } from "../../kistspel/ks-pall.js";
import { tal } from "./gr-proj-scen.js";

const FARGER = ["#ffcf3a", "#ff8a1f", "#86d8e8", "#e88fa8", "#fff1c6", "#c58cff"];

// En guldtacka (pallens byggsten).
const TACKA = `<svg viewBox="0 0 60 26" aria-hidden="true" focusable="false"><path d="M8 2 H52 L59 24 H1Z" fill="#ffc928" stroke="#a86f00" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 6 H50" stroke="#fff3b0" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;

export function createFinal(host, { pool, sound }) {
  return ksCreateFinal(host, {
    pool, sound,
    cls: "grp",
    piece: TACKA,
    amountHtml: (n) => `💰 ${tal(n)} guld`,
    colors: FARGER,
    cues: { open: "grotta", drum: "trumvirvel", win: "fanfar", rain: "guldregn" },
  });
}
