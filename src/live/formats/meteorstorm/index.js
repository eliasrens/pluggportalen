// ============================================================================
// Live-format `meteorstorm` – Meteorstormen ☄️ (epic #819)
// ----------------------------------------------------------------------------
// Klasser försvarar var sin rymdstation mot en förutbestämd meteorstorm; rätt
// svar ger energi till 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Kontraktet:
// docs/METEORSTORMEN.md. Motorn och balansen: ./delat/ (#820), servern:
// functions/meteorstorm-*.js + ms-klient.js/meteorstorm-data.js (#821).
//
// Formatobjektet = { id, …projektordelarna (C, #822), ...MS_ELEV_DELAR (D, #823) }.
//   C (#822): id/namn/ikon/klassantal/svarssätt/takt, compatibleGameModes,
//     computeStandings (klasserna + anslutna elever till lobbyn och skalet),
//     emitOnPlayers, projectorViews (meteorstorm-projector.js), registreringen
//     (src/live/formats/index.js).
//   D (#823): ms-format-elev.js – lärarformuläret, sessionen, quizets
//     ögonblicksbild, resultInputs/buildResult (ms-avslut.js: msAvsluta +
//     pluggmynten), elevskärmen och historiken.
//   Avsluta: skalets knapp → kärnans flöde (status finished → resultInputs =
//     avslutaOchBetala → msAvsluta + settleLiveRewards). Samma väg vid 00:00.
//     Serverns result gäller; kärnans writeResultIfMissing ser att det finns.
//   E (#824) – `music` (assets/meteorstormen-loop.ogg). Fältet saknas tills
//     filen finns: ingen 🎵-knapp och ingen 404.
//
// API: export default METEORSTORM (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import { MS_ELEV_DELAR, MS_MODES, MS_MIN_CLASSES, MS_MAX_CLASSES } from "./ms-format-elev.js";

const METEORSTORM = {
  id: "meteorstorm",
  displayName: "Meteorstormen",
  icon: "☄️",
  description: "Försvara rymdstationen – sköld, laser och dragstråle.",
  scope: "inom-klass",
  minClasses: MS_MIN_CLASSES,
  maxClasses: MS_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  pacing: "tid",

  ...MS_ELEV_DELAR,

  compatibleGameModes(mode) {
    return MS_MODES.includes(mode?.id) && answerKindsFor(METEORSTORM, mode).length > 0;
  },

  /** Klasserna + anslutna elever (lobbyn); stationerna räknar projektorn själv ur loggen. */
  computeStandings(s, { players = [] } = {}) {
    const classes = (s?.participatingClassIds || []).map((classId) => ({
      classId, name: s?.classNames?.[classId] || classId,
      joined: (players || []).filter((p) => p?.classId === classId).length,
    }));
    return { classes, totalCorrect: 0, leaderIds: [], winnerId: null, draw: false };
  },

  emitOnPlayers: true,
  projectorViews: () => import("./meteorstorm-projector.js"),
};

export default METEORSTORM;
