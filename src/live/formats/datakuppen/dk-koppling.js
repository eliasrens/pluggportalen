// ============================================================================
// Datakuppen – Nätverket (#654): KOPPLINGEN mellan Live-flödet och
// projektorvyerna. En per monterad vy (Nätverket eller statistiken):
// lyssnar på dkPlayers (datan – bara servern skriver) och dkEvents
// (terminalen, senaste 30). ready = båda första ögonblicksbilderna från
// servern har kommit – första sync blir baslinjen, så en omladdning spelar
// aldrig upp gamla händelser.
//
// Kopplingen är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-koppling.js – här bara deps-nyckeln, datafilen och texterna. Motorn
// läser watchGrPlayers; datakuppen-data.js heter watchDkPlayers.
//
// Datalagret: deps.datakuppen (demots låtsasdata, samma form som motorn
// läser) eller datakuppen-data.js (laddas latt).
//
// API
//   avatarRoster(sid, deps?) → roster (delad med lobbyn)
//   createDkKoppling({ sid, deps, onChange, say? }) → ks-koppling createKoppling
//     (grPlayers = dkPlayers, events, ready, whenReady, standings(st), now(),
//     destroy())
// ============================================================================

import { avatarRoster, createKoppling } from "../../kistspel/ks-koppling.js";
import { computeStandings } from "./datakuppen-core.js";

export { avatarRoster };

async function loadData() {
  const api = await import("./datakuppen-data.js");
  return { watchGrPlayers: api.watchDkPlayers, watchEvents: api.watchEvents };
}

export function createDkKoppling(opts) {
  return createKoppling({
    ...opts,
    dataKey: "datakuppen",
    loadData,
    computeStandings: (s, { players, grPlayers }) => computeStandings(s, { players, dkPlayers: grPlayers }),
    texts: { players: "Datan", events: "Händelserna", loadFailed: "Datakuppen kunde inte laddas" },
  });
}
