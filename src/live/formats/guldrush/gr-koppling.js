// ============================================================================
// Guldrushen – Skattkammaren (#565): KOPPLINGEN mellan Live-flödet och
// projektorvyerna. En per monterad vy (Skattkammaren eller statistiken):
//   • lyssnar på grPlayers (guldet – bara servern skriver) och grEvents
//     (händelseflödet, senaste 30) – samma lyssnare som elevvyn läser
//   • ställningen = formatets computeStandings(s, { players, grPlayers })
//   • ready = BÅDA första ögonblicksbilderna har kommit. Vyn startar inte
//     händelsesystemet förrän dess: första sync blir då baslinjen med alla
//     gamla händelser – en omladdning spelar aldrig upp något igen (§9).
//
// Datalagret: deps.guldrush (förhandsvisningens låtsasdata) eller
// guldrush-data.js (laddas latt). Avatarerna: avatarRoster – EN roster per
// session (klassprojektionen, en läsning per klass), delad mellan lobbyn och
// spelvyerna.
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

import { createAvatarRoster } from "../../design/live-avatars.js";
import { computeStandings } from "./guldrush-core.js";

let rosterCache = null; // { sid, roster }

/** Avatarlistan för sessionen – samma instans för lobby och spelvyer. */
export function avatarRoster(sid, deps = null) {
  if (rosterCache?.sid === sid) return rosterCache.roster;
  rosterCache?.roster.destroy();
  const roster = createAvatarRoster(deps?.loadProjection ? { load: deps.loadProjection } : {});
  rosterCache = { sid, roster };
  return roster;
}

export function createGrKoppling({ sid, deps = null, onChange = () => {}, say = () => {} }) {
  let dead = false;
  let grPlayers = [];
  let events = [];
  let gotPlayers = false;
  let gotEvents = false;
  let ready = false;
  let markReady = () => {};
  const whenReady = new Promise((r) => { markReady = r; });
  const unsubs = [];

  const check = () => {
    if (!ready && gotPlayers && gotEvents) {
      ready = true;
      markReady();
    }
  };
  const fail = (what) => (e) => {
    say(`${what}: ${e?.message || e}`);
    if (what === "Guldet") gotPlayers = true;
    else gotEvents = true;
    check();
    onChange();
  };

  (deps?.guldrush ? Promise.resolve(deps.guldrush) : import("./guldrush-data.js")).then((api) => {
    if (dead) return;
    unsubs.push(api.watchGrPlayers(sid, (list) => {
      grPlayers = list || [];
      gotPlayers = true;
      check();
      onChange("players");
    }, fail("Guldet")));
    unsubs.push(api.watchEvents(sid, (list) => {
      events = list || [];
      gotEvents = true;
      check();
      onChange("events");
    }, fail("Händelserna")));
  }).catch((e) => {
    gotPlayers = gotEvents = true;
    check();
    say(`Guldrushen kunde inte laddas: ${e?.message || e}`);
    onChange();
  });

  return {
    get grPlayers() { return grPlayers; },
    get events() { return events; },
    get ready() { return ready; },
    whenReady,
    standings(st) {
      return computeStandings(st?.session, { players: st?.players || [], grPlayers });
    },
    now: () => (deps?.now ? deps.now() : Date.now()),
    destroy() {
      dead = true;
      unsubs.forEach((u) => { try { u?.(); } catch {} });
    },
  };
}
