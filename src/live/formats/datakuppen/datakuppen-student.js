// ============================================================================
// Datakuppen 💾 – elevens skärm (#653, spec §1.2–1.7, §4.3). Laddas LATT av
// page-elev-live.js via DATAKUPPEN.studentView(). Spelytan är dk-elev-vy.js
// (utan Firebase, så att förhandsvisningen kan köra den mot en låtsasserver);
// här kopplas Firestore + Cloud Functions (datakuppen-data.js), den
// serverkorrigerade klockan och Pluggmynt-saldot i menyn in.
//
// API (studentView-kontraktet, live-formats.js)
//   lobbyHtml(s)  joinedText  endHtml(st, player)
//   createStage({ view, host, uid, classId, session, mode, answerKind })
//     → { update(st, player), destroy() }
// ============================================================================

import { renderTopbar } from "../../../ui.js";
import { invalidateStudentData } from "../../../data.js";
import { serverNow } from "../../live-clock.js";
import { createDkStage } from "./dk-elev-vy.js";
import * as dk from "./datakuppen-data.js";

export { joinedText, lobbyHtml, endHtml } from "./dk-skarmar.js";

export function createStage(ctx) {
  return createDkStage(ctx, {
    api: dk,
    now: serverNow,
    onCoins: () => { invalidateStudentData(ctx.uid); renderTopbar(); },
  });
}
