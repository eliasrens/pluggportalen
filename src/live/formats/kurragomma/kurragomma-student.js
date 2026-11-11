// ============================================================================
// Kurragömma 🙈 – elevens skärm (#839, spec §6). Laddas LATT av
// page-elev-live.js via studentView(). Spelytan är kge-elev-vy.js (utan
// Firebase, så att förhandsvisningen och demot kan köra den mot en
// låtsasserver); här kopplas callables + Firestore + RTDB (kurragomma-data.js),
// den serverkorrigerade klockan, avatarerna (createAvatarRoster – en läsning av
// klassprojektionen per dator, inte per elev) och Pluggmynt-saldot i menyn in.
//
// API (studentView-kontraktet, live-formats.js)
//   lobbyHtml(s)  joinedText  endHtml(st, player, classId)
//   createStage({ view, host, uid, classId, session, mode, answerKind }) → { update(st, player), destroy() }
// ============================================================================

import { renderTopbar } from "../../../ui.js";
import { invalidateStudentData } from "../../../data.js";
import { serverNow } from "../../live-clock.js";
import { createAvatarRoster } from "../../design/live-avatars.js";
import { createKgStage } from "./kge-elev-vy.js";
import * as api from "./kurragomma-data.js";

export { joinedText, lobbyHtml, endHtml } from "./kge-skarmar.js";

export function createStage(ctx) {
  const roster = createAvatarRoster();
  roster.prefetch(ctx.session?.participatingClassIds || []);
  return createKgStage(ctx, {
    api,
    now: serverNow,
    roster,
    onCoins: () => { invalidateStudentData(ctx.uid); renderTopbar(); },
  });
}
