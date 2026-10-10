// ============================================================================
// Live-format `klassmatch` – Klassmatchen: klass mot klass (#547)
// ----------------------------------------------------------------------------
// Dagens Live, oförändrat, bakom format-interfacet (src/live/live-formats.js).
// Två–åtta klasser i varsitt klassrum svarar så snabbt de kan under en
// serverstyrd matchklocka. Poäng = rätt ÷ lärarens nämnare per klass.
//
//   klassmatch-core.js       ren logik: ställning, vinnare, result, pris, fält
//   klassmatch-projector.js  LAT: lobby (redo per klass), Raketrace, Statistik,
//                            Dragkamp, Trollkarlsduellen, vinnarskärm, nämnare
//   klassmatch-student.js    LAT: elevens lobbyrad (pris) + slutskärm
//   klassmatch-setup.js      LAT: lärarformulärets trollkarlsval (custom-fält)
//   klassmatch-history.js    LAT: historikens vinnare/klasstabell + Statistik → Live
//
// Hör till Klassmatchen (inte kärnan): nämnare, shardade klassräknare, mynt-
// pris till klasskassan (#526), pokalerna live-vinst/live-avklarat (via
// result, kc-koppling), trollkarlsval (#536), kooperativa lägen (#495).
// Svarssätt: bara "free" (skriv själv) i dag – lägg till "choice" i
// answerKinds när flervalssvar ska kunna spelas klass mot klass.
//
// API: export default KLASSMATCH (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import { durationField } from "../../live-setup-fields.js";
import {
  MIN_LIVE_CLASSES, MAX_LIVE_CLASSES, LIVE_PRIZE_MAX, sumCounters, classStandings, decideWinner, buildResult,
  sessionTitle, validateSetup, buildSessionFields,
} from "./klassmatch-core.js";

const KLASSMATCH = {
  id: "klassmatch",
  displayName: "Klassmatchen",
  icon: "🏁",
  description: "Klass mot klass – flest rätt per elev vinner.",
  scope: "mellan-klasser",
  minClasses: MIN_LIVE_CLASSES,
  maxClasses: MAX_LIVE_CLASSES,
  answerKinds: ["free"],
  pacing: "tid",
  classCounters: true,
  classDivisors: true,
  // Ritas generiskt av lärarformuläret (#548, live-setup-fields.js) – samma
  // ordning och utseende som före formatväljaren. validate:false: reglerna
  // (och felmeddelandena) ligger kvar i validateSetup / kärnans matchlängd.
  setupFields: [
    {
      key: "divisors", kind: "perClass", label: "Nämnare per klass", cls: "live-divisors",
      hint: "antal elever idag – poäng = rätt / nämnare", min: 1, max: 999, validate: false,
      defaultFor: (c) => Math.max(1, (c?.studentIds || []).length),
    },
    {
      key: "wizards", kind: "custom", label: "🧙 Trollkarlsduellen", cls: "live-wizards",
      hint: "projektorvy för två klasser – vem är Rasmus och vem är Elias? Kan bytas i lobbyn före start.",
      load: () => import("./klassmatch-setup.js"),
    },
    durationField(),
    {
      key: "coinPrize", kind: "number", label: "Mynt-pris till vinnarklassen", id: "live-prize", inputCls: "live-prize-input",
      hint: "valfritt – går till klassens klasskassa i Klasscentret; oavgjort delas lika. Kan inte ändras efter att matchen skapats.",
      min: 0, max: LIVE_PRIZE_MAX, placeholder: "t.ex. 1000 (tomt = inget pris)", validate: false,
    },
  ],

  compatibleGameModes(mode) {
    return answerKindsFor(KLASSMATCH, mode).length > 0;
  },

  validateSetup,
  buildSessionFields,
  sessionTitle,

  // "Redo" (färsk puls) räknas bara i lobbyn – annars alla anslutna.
  computeStandings(s, { counters = [], players = [], now = null } = {}) {
    const classes = classStandings(s, sumCounters(counters), players, s?.status === "lobby" ? now : null);
    const w = decideWinner(classes);
    return {
      classes,
      totalCorrect: classes.reduce((n, c) => n + c.correct, 0),
      leaderIds: w.leaderIds,
      winnerId: w.winnerId,
      draw: w.draw,
    };
  },

  buildResult,

  projectorViews: () => import("./klassmatch-projector.js"),
  studentView: () => import("./klassmatch-student.js"),
  historyRenderer: () => import("./klassmatch-history.js"),
};

export default KLASSMATCH;
