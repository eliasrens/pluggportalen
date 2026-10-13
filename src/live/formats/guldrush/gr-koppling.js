// ============================================================================
// Guldrushen – Skattkammaren (#565): KOPPLINGEN mellan Live-flödet och
// projektorvyerna. En per monterad vy (Skattkammaren eller statistiken):
//   • lyssnar på grPlayers (guldet – bara servern skriver) och grEvents
//     (händelseflödet, senaste 30) – samma lyssnare som elevvyn läser
//   • ställningen = formatets computeStandings(s, { players, grPlayers })
//   • ready = BÅDA första ögonblicksbilderna FRÅN SERVERN har kommit (en
//     ögonblicksbild ur cachen kan sakna händelser – då spelades gamla upp
//     som nya, upptäckt mot emulatorn). Vyn startar inte händelsesystemet
//     förrän dess: första sync blir baslinjen med alla gamla händelser – en
//     omladdning spelar aldrig upp något igen (§9). Utan nät: cachen gäller
//     efter CACHE_MS.
//
// Datalagret: deps.guldrush (förhandsvisningens låtsasdata) eller
// guldrush-data.js (laddas latt). Avatarerna: avatarRoster – EN roster per
// session (klassprojektionen, en läsning per klass), delad mellan lobbyn och
// spelvyerna.
//
// Kopplingen är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-koppling.js – här bara deps-nyckeln, datafilen och texterna.
//
// API
//   avatarRoster(sid, deps?) → roster (design/live-avatars.js), cachad per session
//   createGrKoppling({ sid, deps, onChange, say? }) → {
//     grPlayers, events            senaste ögonblicksbilderna
//     ready                        bool – båda har kommit (eller laddningen föll)
//     whenReady                    Promise
//     standings(st)                → computeStandings
//     now()                        server-korrigerad tid
//     destroy()
//   }
// ============================================================================

import { avatarRoster, createKoppling } from "../../kistspel/ks-koppling.js";
import { computeStandings } from "./guldrush-core.js";

export { avatarRoster };

export function createGrKoppling(opts) {
  return createKoppling({
    ...opts,
    dataKey: "guldrush",
    loadData: () => import("./guldrush-data.js"),
    computeStandings,
    texts: { players: "Guldet", events: "Händelserna", loadFailed: "Guldrushen kunde inte laddas" },
  });
}
