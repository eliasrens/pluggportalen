// ============================================================================
// Kurragömma – HISTORIKEN på lärarsidan, grundversionen (#839). E (#840) bygger
// den fulla historiken och statistiken (pall, topplista med pluggmynt, andel
// rätt per fråga, hur många som klarade sig, visslingar, den som hittade
// flest) ovanpå ks-historik.js. Här finns bara det kärnan kräver
// (historyRenderer-kontraktet: winnerText, detailHtml, classStats) och
// settle, så att pluggmynten alltid betalas ut (teacher-live-history.js
// försöker igen om lärarfliken stängdes vid slutet).
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { avslutaOchBetala } from "./kg-avslut.js";

export function winnerText(_s, result) {
  if (!result) return "Kurragömma";
  const k = Number(result.klaradeSig) || 0;
  return k ? `${k} klarade sig gömda hela matchen` : "Sökarna hittade alla";
}

export function detailHtml(_s, result) {
  if (!result?.ranking?.length) return "";
  const topp = result.ranking.slice(0, 3)
    .map((r) => `<li>${r.rank}. ${esc(r.name || "Någon")} – ${r.poang} p</li>`).join("");
  return `<ol class="kgh-topp">${topp}</ol>`;
}

export const classStats = {
  cols: 3,
  head: `<th class="num">Klarade sig</th><th class="num">Hittade</th><th class="num">Visslingar</th>`,
  cells(_s, result) {
    if (!result?.ranking) return `<td class="num">–</td><td class="num">–</td><td class="num">–</td>`;
    return `<td class="num">${result.klaradeSig | 0}</td><td class="num">${result.hittade | 0}</td><td class="num">${result.visslingar | 0}</td>`;
  },
};

/** Historikens nya försök (lärarfliken stängdes vid slutet): kgAvsluta + pluggmynten. */
export async function settle(s) {
  return avslutaOchBetala(s);
}
