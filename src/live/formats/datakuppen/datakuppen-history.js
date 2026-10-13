// ============================================================================
// Datakuppen 💾 – historiken och Statistik → Live (#655, spec §5). Laddas
// LATT av teacher-live-history.js via DATAKUPPEN.historyRenderer(). Vyn är
// kistspelsmallen (src/live/kistspel/ks-historik.js) – samma som
// Guldrushens – med Datakuppens tema; siffrorna ur ks-historik-data.js och
// buildResult (datakuppen-core.js).
//
// En match: 💾-vinnare, pallplats (delad placering), klassens data
// tillsammans, HACKRUTAN (antal hackförsök och andel lyckade för hela
// klassen – aldrig per elev; result.hacks), topplista med rätt/fel/filer/MB
// och Pluggmynt per elev, andel rätt per fråga/uppgift och per spellägets
// statKeys (kategori / tabell) och varje elevs felsvar.
// Statistik → Live: klassens rad får Rätt · Data · Hack (lyckade/försök,
// result.hacksByClass) + sammanfattning per tabell/kategori.
//
// API: som guldrush-history.js – winnerText, detailHtml, ownPlayerTable,
//      playerCounts, classStats, classSummaryHtml
//      + hackHtml(s, result) (hackrutan, exporterad för testerna)
// ============================================================================

import { createKistHistory, tal } from "../../kistspel/ks-historik.js";

const CSS = "src/live/formats/datakuppen/datakuppen-historik.css";
const andel = (h) => (h?.attempts > 0 ? `${Math.round((h.success / h.attempts) * 100)} %` : "–");

/** Hackrutan: hela klassens hackförsök och andel lyckade (null-säker). */
export function hackHtml(s, result) {
  if (s?.hacking === false) return `<p class="dkh-hack dkh-av">💻 Hackning var avstängd i den här matchen.</p>`;
  const h = result?.hacks;
  if (!h) return "";
  return `<ul class="dkh-hack" aria-label="Hack – hela klassen">
      <li><span>💻 Hackförsök</span><b>${tal(h.attempts)}</b><small>hela klassen</small></li>
      <li><span>🔓 Lyckade</span><b>${andel(h)}</b><small>${tal(h.success)} av ${tal(h.attempts)} hack</small></li>
      <li><span>🔒 Misslyckade</span><b>${tal(Math.max(0, h.attempts - h.success))}</b><small>fel kod – strukna</small></li>
    </ul>`;
}

const H = createKistHistory({
  css: [CSS],
  icon: "💾",
  amount: (n) => `${tal(n)} MB`,
  classTotal: "MB data tillsammans",
  balanceHead: "💾 Data (MB)",
  chestsHead: "Filer",
  statsHead: "Data (MB)",
  summaryTitle: "💾 Datakuppen",
  klasserCls: "dkh-klasser",
  loadAnswers: async () => (await import("./datakuppen-data.js")).getAnswers,
  extraHtml: hackHtml,
  classStatsExtra: {
    cols: 1,
    head: `<th class="num">Hack</th>`,
    cells(s, res, classId) {
      const h = res?.hacksByClass?.[classId];
      if (s?.hacking === false) return `<td class="num">av</td>`;
      return `<td class="num">${h ? `${tal(h.success)}/${tal(h.attempts)} (${andel(h)})` : "–"}</td>`;
    },
  },
});

export const { winnerText, detailHtml, classStats } = H;
export const ownPlayerTable = true;

export function playerCounts(s, result) {
  return H.playerCounts(s, result);
}

/** Klassens Datakuppen-matcher sammantaget (Statistik → Live). entries = [{ s, result }]. */
export function classSummaryHtml(entries, classId) {
  return H.classSummaryHtml(entries, classId);
}
