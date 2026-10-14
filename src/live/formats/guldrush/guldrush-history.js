// ============================================================================
// Guldrushen – historiken och Statistik → Live (#566). Laddas LATT av
// teacher-live-history.js via GULDRUSH.historyRenderer(). Vyn är den
// gemensamma kistspelsmallen (#655, src/live/kistspel/ks-historik.js) med
// Guldrushens tema; siffrorna räknas i gr-historik-data.js (ren logik).
//
// En match: 💰-vinnare, pallplats (delad placering), klassens totala guld,
// topplista med rätt/fel/kistor/guld och Pluggmynt per elev, andel rätt per
// fråga (multiplikation: faktorparet) och per spellägets statKeys
// (multiplikation: per tabell) och – ur svaren – varje elevs felsvar.
// Kärnans elevtabell (players.correct, som Guldrushen inte räknar – servern
// skriver grPlayers) ersätts av topplistan (ownPlayerTable).
//
// API
//   winnerText(s, result)          → "💰 Alma" | "💰 Alma & Omar" | "–"
//   detailHtml(s, result, { getAnswers? }) → Promise<html> (en match)
//   ownPlayerTable                 true – kärnan ritar ingen elevtabell
//   playerCounts(s, result)        → Map uid → { correct, incorrect }
//   classStats.head / .cols / .cells(s, result, classId) – klassens rad
//   classSummaryHtml(entries, classId) → html – klassens Guldrush-matcher
//                                    sammantaget: per tabell + svåraste frågorna
// ============================================================================

import { createKistHistory, tal } from "../../kistspel/ks-historik.js";

const H = createKistHistory({
  icon: "💰",
  amount: (n) => `${tal(n)} guld`,
  classTotal: "guld tillsammans",
  balanceHead: "💰 Guld",
  chestsHead: "Kistor",
  statsHead: "Guld",
  summaryTitle: "💰 Guldrushen",
  loadAnswers: async () => (await import("./guldrush-data.js")).getAnswers,
});

export const { winnerText, detailHtml, classStats } = H;
export const ownPlayerTable = true;

export function playerCounts(s, result) {
  return H.playerCounts(s, result);
}

/** Klassens Guldrush-matcher sammantaget (Statistik → Live). entries = [{ s, result }]. */
export function classSummaryHtml(entries, classId) {
  return H.classSummaryHtml(entries, classId);
}
