// ============================================================================
// Pluggportalen – skriv-sidan av klass-projektionen (#233)
// ----------------------------------------------------------------------------
// Håller `classProjections/{classId}` FÄRSK genom att spegla elevens egna fält
// in i projektionen NÄR de ändras (award + avatar/palett/hus-skal/lås/namn), i
// stället för att läsa ett studentData-dok per elev vid varje by-öppning
// (incidenten 2026-09-09, #231). Skrivningar har egen, mycket rymligare kvot.
//
// Modulen är REN av Firebase: den känner varken till Firestore eller data.js.
// Skriv-funktionen (updateStudentProjectionAllClasses) INJICERAS av anroparen,
// så kärnan – härledningen av award-patchen + "kasta aldrig"-omslaget – kan
// enhetstestas browser-fritt (test/projection-sync.test.js). game-shared.js och
// data-room.js/data-content.js kopplar in de riktiga data-lager-funktionerna.
// ============================================================================

import { progressTotals, xpFromStudentData } from "./leveling.js";

/**
 * Award-patchen (stars/xp/completed) härledd EXAKT som by-översikten räknar
 * fram dem ur elevens studentData (se class-projection.projectionEntryFrom /
 * data-content.getStudentsWithLooks – samma hjälpare, en KÄLLA för formen).
 * Så projektionen visar samma siffror som en per-elev-läsning annars gett.
 * @param {object} sd elevens FÄRSKA studentData (efter att award sparats)
 * @returns {{stars:number, xp:number, completed:number}}
 */
export function awardProjectionPatch(sd = {}) {
  const { completed, stars } = progressTotals(sd && sd.progress);
  return { stars, xp: xpFromStudentData(sd), completed };
}

/** Default-loggning av en fallerad projektions-skrivning (aldrig kastande). */
function defaultOnError(err) {
  try {
    // eslint-disable-next-line no-console
    console.warn("[projection-sync] kunde inte uppdatera klass-projektionen:", err);
  } catch {}
}

/**
 * Spegla en fält-patch in i elevens entry i ALLA sina klassers projektioner,
 * utan att NÅGONSIN kasta: en misslyckad projektions-skrivning får aldrig fälla
 * den underliggande spar-operationen (self-heal-läsaren täcker upp resten).
 *
 * @param {function} updateAllClasses (studentId, patch) → Promise – normalt
 *   data.updateStudentProjectionAllClasses (injiceras för testbarhet).
 * @param {string} studentId inloggad elev (= studentData-dok-id:t som skrevs).
 * @param {object} patch under-fält att spegla, t.ex. { husLast:true } eller
 *   { stars, xp, completed }. Tom/utan studentId → no-op.
 * @param {function} [onError] anropas med felet om skrivningen fallerar.
 * @returns {Promise<void>}
 */
export async function mirrorStudentProjection(
  updateAllClasses,
  studentId,
  patch,
  onError = defaultOnError
) {
  if (!studentId || !patch || typeof patch !== "object") return;
  if (Object.keys(patch).length === 0) return;
  try {
    await updateAllClasses(studentId, patch);
  } catch (err) {
    onError(err);
  }
}
