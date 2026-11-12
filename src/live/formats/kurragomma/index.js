// ============================================================================
// Live-format `kurragomma` – Kurragömma 🙈 (epic #835, spec §0.1)
// ----------------------------------------------------------------------------
// Klassen spelar kurragömma på en ö i 3D: gömfasen (göm dig, lås platsen),
// letfasen (frågor – fel svar visslar, sökarna letar, hittad blir sökare) och
// finalen (prispall, pluggmynt, gömställena på kartan). Kontraktet:
// docs/KURRAGOMMA.md. Motorn: ./delat/ (A, #836), 3D-scenen: ./scen/ (B, #837),
// servern + rörelsekanalen: functions/kurragomma-*.js + kg-kanal.js (C, #838),
// projektorn, elevskärmen och demot: D (#839, det här). Lärarformulärets egna
// fält, historiken och statistiken: E (#840).
//
// Allt DOM/Firebase laddas LATT (projectorViews/studentView/historyRenderer =
// import()) – bootgrafen (#271) når bara det här objektet, kg-setup.js och
// delat/. three.js når bara scen/kg-tre.js med import().
//   pacing "tid": kärnans matchklocka täcker gömfasen + letfasen – formatet
//   sätter durationSeconds = gömtid + speltid själv (kg-setup.js, §10.6) och
//   visar sin egen klocka (ownTimer i kurragomma-projector.js).
//   Avsluta: skalets knapp / 00:00 / alla hittade → kärnans flöde (status
//   finished → resultInputs = kg-avslut.js avslutaOchBetala → kgAvsluta +
//   settleLiveRewards). Serverns result gäller.
//   music: assets/kurragomma-loop.ogg – filen levereras separat; saknas den
//   är formatet tyst (proj-music sväljer 404) och behöver bara filen på plats.
//
// API: export default KURRAGOMMA (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";
import {
  KG_FORMAT, KG_MODES, KG_MIN_CLASSES, KG_MAX_CLASSES, KG_PUBLIC_DOC, KG_PRIVATE_DOC,
  durationField, namesField, validateSetup, buildSessionFields, sessionTitle, defaultSessionName, prepareCreate, computeStandings,
} from "./kg-setup.js";
import { resultInputs, buildResult } from "./kg-avslut.js";

const KURRAGOMMA = {
  id: KG_FORMAT,
  displayName: "Kurragömma",
  icon: "🙈",
  description: "Göm dig på ön i 3D – svara rätt, annars visslar det! Den som hittas blir sökare.",
  scope: "inom-klass",
  minClasses: KG_MIN_CLASSES,
  maxClasses: KG_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  timelineQuestions: true,
  pacing: "tid",
  minQuestions: 5,
  // Tyst lobby, matchen ≈ 30 % av effekterna – som Guldrushen. Lägre under gömfasen (vyn: music.skala).
  music: { src: new URL("./assets/kurragomma-loop.ogg", import.meta.url).href, level: 0.3, lobby: 0 },

  setupFields: [durationField(), namesField(), rewardsSetupField()],
  compatibleGameModes(mode) {
    return KG_MODES.includes(mode?.id) && answerKindsFor(KURRAGOMMA, mode).length > 0;
  },
  validateSetup: (input) => [...validateSetup(input), ...validateRewards(input?.rewards)],
  buildSessionFields: (input) => ({ ...buildSessionFields(input), ...rewardSessionFields(input?.rewards) }),
  sessionTitle,
  defaultSessionName,
  prepareCreate,
  privateDocs: [KG_PRIVATE_DOC, KG_PUBLIC_DOC],
  computeStandings,
  emitOnPlayers: true,
  resultInputs,
  buildResult,

  projectorViews: () => import("./kurragomma-projector.js"),
  studentView: () => import("./kurragomma-student.js"),
  historyRenderer: () => import("./kurragomma-history.js"),
};

export default KURRAGOMMA;
