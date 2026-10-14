// ============================================================================
// Guldrushen (#564): VÄLJ EN KLASSKAMRAT efter en Stöld- eller Byte-kista
// (funktionsspec §6.4, designspec §6.5).
//   • klasskamraterna som stora avatarknappar med namn + guld, sorterade på
//     guld (gr-elev.js victimRows); byte visar bara de med MER guld
//   • skyddad → gråad med "🛡️ 0:04"; listan är LEVANDE (ritas om varje tick)
//     och kompisen blir valbar när nedräkningen når noll. Väljartimern pausas
//     aldrig. Servern prövar skyddet i valets ögonblick: hann offret skaffa en
//     sköld nekas valet ("🛡️ Alma hann skaffa en sköld!") och tjuven väljer
//     om på tiden som är kvar
//   • synlig nedräkning (~10 s, serverns expiresAt) → servern slumpar
//     (choose(null)); valet ligger kvar vid omladdning (grPlayers.pending)
//   • vid val springer tvättbjörnen över skärmen med guldpåsen (byte: guld-
//     pilarna snurrar), guldet räknas upp av vyn (onResult)
//   • 30 elever ryms utan scroll på 1366×768 (rutnätet krymper avatarerna)
// Tangentbord: Tab/pilar mellan knapparna, ENTER väljer.
// Stilar: guldrush-elev.css (gro-*).
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-offer.js – här bara tvättbjörnen/guldpilarna, texterna och prefixet gro.
//
// API
//   pickVictim(host, { kind, me, players, pending, now, pool, roster, choose,
//                      onResult?, stage?, reduced? }) → { done, update(me, players), destroy() }
//     choose(uid | null) → Promise<chooseVictim-svar>  (null = "slumpa åt mig")
//     onResult(view)  när servern svarat (vyn räknar upp guldet, reagerar)
//     stage           elementet tvättbjörnen springer över (default host)
//     done → Promise<view> (victimView) när animationen är klar
// ============================================================================

import { pickVictim as ksPickVictim } from "../../kistspel/ks-offer.js";
import { GR_ELEV } from "./gr-elev.js";
import { svgOf } from "./gr-kistfx.js";
import { GR_RULES } from "./delat/chests-config.js";

const THEME = {
  cls: "gro",
  elev: GR_ELEV,
  rules: GR_RULES,
  warn: "Guldrushen",
  texts: {
    steal: { rubrik: "🦝 Vem ska tvättbjörnen knycka guld från?", tom: "Ingen har tillräckligt med guld att knycka just nu." },
    swap: { rubrik: "🔄 Vem vill du byta guld med?", tom: "Ingen har mer guld än du just nu." },
    amount: (x) => `💰 ${x}`,
    ariaAmount: (x) => `${x} guld`,
  },
  runnerHtml: (kind) => (kind === "swap" ? svgOf("pilar") : `${svgOf("tvattbjorn")}<span class="gro-pase">💰</span>`),
};

export function pickVictim(host, opts) {
  return ksPickVictim(host, { ...opts, theme: THEME });
}
