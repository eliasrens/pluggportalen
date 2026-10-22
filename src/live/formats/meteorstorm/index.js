// ============================================================================
// Live-format `meteorstorm` – Meteorstormen ☄️ (epic #819)
// ----------------------------------------------------------------------------
// Klasser försvarar var sin rymdstation mot en förutbestämd meteorstorm; rätt
// svar ger energi till 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Kontraktet:
// docs/METEORSTORMEN.md. Motorn och balansen: ./delat/ (#820), servern:
// functions/meteorstorm-*.js + ms-klient.js/meteorstorm-data.js (#821).
//
// Ägarskap i formatobjektet (spec-PR-ordningen):
//   C (#822, projektorn) – projectorViews (meteorstorm-projector.js), ownTimer/
//     ownControls i vyn, resultInputs (msAvsluta – SERVERNS result gäller;
//     kärnans writeResultIfMissing nekas av reglerna och ser sedan att result
//     redan finns), buildResult (= serverns result), computeStandings (klasserna
//     + anslutna elever till lobbyn och skalet), emitOnPlayers, registreringen.
//   D (#823) – lärarformuläret (setupFields/validateSetup/buildSessionFields/
//     prepareCreate för quiz), elevskärmen (studentView), historiken
//     (historyRenderer). Här står bara det minsta som krävs för att formatet
//     ska gå att registrera och skapa (multiplikation) – märkt "D ersätter".
//   E (#824) – `music` (assets/meteorstormen-loop.ogg). Fältet saknas tills
//     filen finns: ingen 🎵-knapp och ingen 404.
//
// API: export default METEORSTORM (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";
import { LAGEN, ATTACKER, LAGE_STANDARD, ATTACKER_STANDARD, normInstallningar } from "./delat/ms-balans.js";

const MODES = ["multiplication_0_10"]; // D ersätter: + plugga_quiz med prepareCreate

const METEORSTORM = {
  id: "meteorstorm",
  displayName: "Meteorstormen",
  icon: "☄️",
  description: "Försvara rymdstationen – rätt svar ger sköld, laser och dragstråle.",
  scope: "mellan-klasser",
  minClasses: 1,
  maxClasses: 2,
  answerKinds: ["free", "choice"],
  pacing: "tid",

  // D ersätter: lärarformulärets fält (läge, attacker, speltid 5–20 min, namn i flödet).
  setupFields: [
    { key: "lage", kind: "choice", label: "Läge", default: LAGE_STANDARD,
      options: [{ value: "klass-mot-klass", label: "Klass mot klass" }, { value: "en-klass", label: "En klass" }] },
    { key: "attacker", kind: "choice", label: "Attacker", default: ATTACKER_STANDARD,
      options: [{ value: "av", label: "Av" }, { value: "milda", label: "Milda" }, { value: "vilda", label: "Vilda" }] },
    rewardsSetupField(),
  ],

  compatibleGameModes(mode) {
    return MODES.includes(mode?.id) && answerKindsFor(METEORSTORM, mode).length > 0;
  },

  // D ersätter
  validateSetup(input) {
    const fel = [];
    const lage = input?.lage ?? LAGE_STANDARD;
    if (!LAGEN.includes(lage)) fel.push("Välj läge.");
    if (input?.attacker != null && !ATTACKER[input.attacker]) fel.push("Välj attacker.");
    const n = (input?.classIds || []).length;
    if (lage === "en-klass" && n !== 1) fel.push("En klass: välj exakt en klass.");
    if (lage === "klass-mot-klass" && n < 2) fel.push("Klass mot klass: välj två klasser.");
    const min = Number(input?.durationMin);
    if (!(Number.isInteger(min) && min >= 5 && min <= 20)) fel.push("Speltiden måste vara hela minuter mellan 5 och 20.");
    return [...fel, ...validateRewards(input?.rewards)];
  },

  // D ersätter
  buildSessionFields(input, { rng = Math.random } = {}) {
    return {
      msSeed: Math.floor(rng() * 2147483647),
      msInstallningar: normInstallningar({ lage: input?.lage, attacker: input?.attacker }),
      ...rewardSessionFields(input?.rewards),
    };
  },

  sessionTitle(s) {
    return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" mot ").toUpperCase();
  },

  defaultSessionName(names) {
    const n = (names || []).filter(Boolean);
    return n.length ? `Meteorstormen ${n.join(" mot ")}` : "Meteorstormen";
  },

  /** Klasserna + anslutna elever (lobbyn); stationerna räknar projektorn själv ur loggen. */
  computeStandings(s, { players = [] } = {}) {
    const classes = (s?.participatingClassIds || []).map((classId) => ({
      classId, name: s?.classNames?.[classId] || classId,
      joined: (players || []).filter((p) => p?.classId === classId).length,
    }));
    return { classes, totalCorrect: 0, leaderIds: [], winnerId: null, draw: false };
  },

  /** Serverns slutresultat (msAvsluta) – projektorn räknar aldrig ett eget. */
  async resultInputs(s) {
    const { avsluta } = await import("./meteorstorm-data.js");
    return avsluta(s.id);
  },

  buildResult(s, classes, players, mode, extra) {
    if (!extra?.result) throw new Error("Meteorstormen: serverns resultat saknas (msAvsluta).");
    return extra.result;
  },

  emitOnPlayers: true,
  projectorViews: () => import("./meteorstorm-projector.js"),
  studentView: () => import("./meteorstorm-student.js"), // D ersätter
  historyRenderer: () => import("./meteorstorm-history.js"), // D ersätter
};

export default METEORSTORM;
