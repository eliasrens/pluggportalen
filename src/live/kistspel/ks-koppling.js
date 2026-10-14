// ============================================================================
// Kistspel 🎁 – KOPPLINGEN mellan Live-flödet och projektorvyerna (#651,
// utbruten ur Guldrushens gr-koppling.js #565). En per monterad vy:
//   • lyssnar på formatets spelardokument (saldot – bara servern skriver) och
//     händelser (senaste 30) – samma lyssnare som elevvyn läser
//   • ställningen = formatets computeStandings(s, { players, grPlayers })
//   • ready = BÅDA första ögonblicksbilderna FRÅN SERVERN har kommit (en
//     ögonblicksbild ur cachen kan sakna händelser – då spelades gamla upp
//     som nya). Vyn startar inte händelsesystemet förrän dess: första sync
//     blir baslinjen – en omladdning spelar aldrig upp något igen. Utan nät:
//     cachen gäller efter CACHE_MS.
//
// Datalagret: deps[dataKey] (förhandsvisningens/demots låtsasdata) eller
// loadData() (formatets datafil, laddas latt) – båda med
// watchGrPlayers(sid, cb, onErr) och watchEvents(sid, cb, onErr).
// Avatarerna: avatarRoster – EN roster per session (klassprojektionen, en
// läsning per klass), delad mellan lobbyn och spelvyerna (alla kistformat).
//
// API
//   avatarRoster(sid, deps?) → roster (design/live-avatars.js), cachad per session
//   createKoppling({ sid, deps, onChange, say?, dataKey, loadData,
//                    computeStandings, texts: { players, events, loadFailed } }) → {
//     grPlayers, events            senaste ögonblicksbilderna
//     ready                        bool – båda har kommit (eller laddningen föll)
//     whenReady                    Promise
//     standings(st)                → computeStandings
//     now()                        server-korrigerad tid
//     destroy()
//   }
// ============================================================================

import { createAvatarRoster } from "../design/live-avatars.js";

let rosterCache = null; // { sid, roster }
const CACHE_MS = 4000;

/** Avatarlistan för sessionen – samma instans för lobby och spelvyer. */
export function avatarRoster(sid, deps = null) {
  if (rosterCache?.sid === sid) return rosterCache.roster;
  rosterCache?.roster.destroy();
  const roster = createAvatarRoster(deps?.loadProjection ? { load: deps.loadProjection } : {});
  rosterCache = { sid, roster };
  return roster;
}

export function createKoppling({
  sid, deps = null, onChange = () => {}, say = () => {}, dataKey, loadData, computeStandings, texts,
}) {
  let dead = false;
  let grPlayers = [];
  let events = [];
  let gotPlayers = false;
  let gotEvents = false;
  let ready = false;
  let markReady = () => {};
  const whenReady = new Promise((r) => { markReady = r; });
  const unsubs = [];
  let offline = false;
  let sawPlayers = false;
  let sawEvents = false;
  const offT = setTimeout(() => {
    offline = true;
    gotPlayers = gotPlayers || sawPlayers;
    gotEvents = gotEvents || sawEvents;
    check();
    onChange();
  }, CACHE_MS);

  const check = () => {
    if (!ready && gotPlayers && gotEvents) {
      clearTimeout(offT);
      ready = true;
      markReady();
    }
  };
  const fail = (what) => (e) => {
    say(`${what}: ${e?.message || e}`);
    if (what === texts.players) gotPlayers = true;
    else gotEvents = true;
    check();
    onChange();
  };

  (deps?.[dataKey] ? Promise.resolve(deps[dataKey]) : loadData()).then((api) => {
    if (dead) return;
    unsubs.push(api.watchGrPlayers(sid, (list, meta) => {
      grPlayers = list || [];
      sawPlayers = true;
      gotPlayers = gotPlayers || !meta?.fromCache || offline;
      check();
      onChange("players");
    }, fail(texts.players)));
    unsubs.push(api.watchEvents(sid, (list, meta) => {
      events = list || [];
      sawEvents = true;
      gotEvents = gotEvents || !meta?.fromCache || offline;
      check();
      onChange("events");
    }, fail(texts.events)));
  }).catch((e) => {
    gotPlayers = gotEvents = true;
    check();
    say(`${texts.loadFailed}: ${e?.message || e}`);
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
      clearTimeout(offT);
      unsubs.forEach((u) => { try { u?.(); } catch {} });
    },
  };
}
