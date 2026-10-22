// ============================================================================
// Meteorstormen ☄️ (#823): formatobjektets ELEV-, LÄRARFORMULÄR- och
// HISTORIKDELAR. index.js sprider in dem (`...MS_ELEV_DELAR`) bredvid
// projektorns delar (C, #822) – två issues kan då bygga formatobjektet
// parallellt utan att röra samma rader.
//
//   setupFields      läge, attacker, speltid 5–20, namn i flödet, pluggmynt
//                    (spelläge + svarssätt ritar kärnan) – ms-setup.js
//   validateSetup / buildSessionFields (+ live-rewards), sessionTitle,
//   defaultSessionName, prepareCreate (quiz → msPublic/msPrivate), privateDocs
//   timelineQuestions  true – servern rättar tidslinjefrågor (msRatta)
//   resultInputs / buildResult  serverns result (msAvsluta) + utbetalning – ms-avslut.js
//   studentView()    meteorstorm-student.js (LAT)
//   historyRenderer() meteorstorm-history.js (LAT)
// ============================================================================

import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";
import {
  MS_MODES, MS_MIN_CLASSES, MS_MAX_CLASSES, MS_PUBLIC_DOC, MS_PRIVATE_DOC,
  durationField, lageField, attackerField, namesField,
  validateSetup, buildSessionFields, sessionTitle, defaultSessionName, prepareCreate,
} from "./ms-setup.js";
import { resultInputs, buildResult } from "./ms-avslut.js";

export { MS_MODES, MS_MIN_CLASSES, MS_MAX_CLASSES };

export const MS_ELEV_DELAR = {
  setupFields: [lageField(), attackerField(), durationField(), namesField(), rewardsSetupField()],
  validateSetup: (input) => [...validateSetup(input), ...validateRewards(input?.rewards)],
  buildSessionFields: (input) => ({ ...buildSessionFields(input), ...rewardSessionFields(input?.rewards) }),
  sessionTitle,
  defaultSessionName,
  prepareCreate,
  privateDocs: [MS_PRIVATE_DOC, MS_PUBLIC_DOC],
  timelineQuestions: true,
  minQuestions: 5,
  resultInputs,
  buildResult,
  studentView: () => import("./meteorstorm-student.js"),
  historyRenderer: () => import("./meteorstorm-history.js"),
};
