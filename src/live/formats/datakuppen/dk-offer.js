// ============================================================================
// Datakuppen 💾 (#653): HACKET STEG 1 – välj vem du hackar (spec §1.4, §4.3).
// Kistspelsmotorns offerväljare (src/live/kistspel/ks-offer.js, samma som
// Guldrushens) i Datakuppens stil (prefix dko, datakuppen-hack.css):
//   • klasskamraterna som avatarknappar med namn + data, sorterade på data
//   • skyddade (brandvägg / nyss hackade) gråade med "🛡️ 0:04" – listan är
//     levande och kompisen blir valbar när skyddet går ut; servern prövar
//     skyddet i valets ögonblick
//   • inte samma kompis två gånger i rad, ingen med för lite data
//   • ~10 s att välja (serverns expiresAt), sedan slumpar servern
// Valet ger { result: "target", options } → vyn byter direkt till kodkorten
// (dk-kodkort.js); ingen kunde väljas → filens fallback (Mapp) visas.
//
// API
//   pickTarget(host, { me, players, pending, now, pool, roster, choose,
//                      onResult?, stage?, reduced? }) → { done, update(me, players), destroy() }
//     choose(uid | null) → Promise<chooseTarget-svar>
//     onResult(view)  view = targetView(svar): { hack } eller fallback-filen
// ============================================================================

import { pickVictim as ksPickVictim } from "../../kistspel/ks-offer.js";
import { DK_ELEV, targetView } from "./dk-elev.js";
import { DK_RULES } from "./delat/files-config.js";
import { fileIcon } from "./dk-ikoner.js";

const THEME = {
  cls: "dko",
  elev: { ...DK_ELEV, victimView: targetView },
  rules: DK_RULES,
  warn: "Datakuppen",
  texts: {
    steal: { rubrik: "💻 Vem vill du hacka?", tom: "Ingen har tillräckligt med data att hacka just nu." },
    amount: (x) => `${x} MB`,
    ariaAmount: (x) => `${x} MB data`,
  },
  runnerHtml: () => fileIcon("hack", "100%"),
};

export function pickTarget(host, opts) {
  return ksPickVictim(host, { ...opts, kind: "steal", theme: THEME });
}
