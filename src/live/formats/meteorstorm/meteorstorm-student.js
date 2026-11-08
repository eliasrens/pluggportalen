// ============================================================================
// Meteorstormen ☄️ – elevens skärm (#823, spec §5). Laddas LATT av
// page-elev-live.js via studentView(). Spelytan är ms-elev-vy.js (utan
// Firebase, så att förhandsvisningen och demot kan köra den mot en
// låtsasserver); här kopplas Cloud Functions + Firestore (meteorstorm-data.js:
// skapaKlient, skapaStatusvakt, getQuestions, avsluta), den serverkorrigerade
// klockan och Pluggmynt-saldot i menyn in.
//
// API (studentView-kontraktet, live-formats.js)
//   lobbyHtml(s)  joinedText  endHtml(st, player, classId)
//   createStage({ view, host, uid, classId, session, mode, answerKind })
//     → { update(st, player), destroy() }
// ============================================================================

import { renderTopbar } from "../../../ui.js";
import { invalidateStudentData } from "../../../data.js";
import { serverNow } from "../../live-clock.js";
import { createMsStage } from "./ms-elev-vy.js";
import * as ms from "./meteorstorm-data.js";

export { joinedText, lobbyHtml, endHtml } from "./ms-skarmar.js";

export function createStage(ctx) {
  return createMsStage(ctx, {
    api: ms,
    now: serverNow,
    onCoins: () => { invalidateStudentData(ctx.uid); renderTopbar(); },
  });
}
