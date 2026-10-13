// ============================================================================
// Ämnesläsning – textval (src/amneslasning/picker.js)  ·  #672
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/amneslasning-picker.test.js.
// Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §4.
//
// Klick på kortet ger DIREKT nästa text, utan karta och utan lista:
//   0. Påbörjad text i området (currentTextId) som finns kvar → återupptas.
//   1. Oläst text på elevens ämnesnivå (i områdets ordning).
//   2. Inga olästa där → oläst text på närmaste nivå (samma tanke som
//      levelSearchOrder i lasresan/picker.js: ±1, ±2 …, lättare först).
//   3. Allt läst → den text som lästes längst tillbaka (allRead: true, UI:t
//      visar ett vänligt besked).
// Nivån returneras aldrig till UI:t i någon form eleven ser.
// ============================================================================

import { AMNES_LEVELS } from "../lasresan/config.js";
import { isPlayableAmnesText, readingTextsOf } from "./content.js";
import { parseAmnesLevel } from "./level.js";

const AMNES_MIN = AMNES_LEVELS[0];
const AMNES_MAX = AMNES_LEVELS[AMNES_LEVELS.length - 1];

/**
 * Områdets spelbara ämnestexter, i områdets ordning. Regeln bor i content.js
 * (#673): readingTextsOf släpper gamla nivåtexter (#152), isPlayableAmnesText
 * kräver id, ämnesnivå 1–3 och minst en fråga.
 */
export function playableTexts(readingTexts) {
  return readingTextsOf({ readingTexts }).filter(isPlayableAmnesText);
}

/** Ämnesnivåer att pröva i ordning: exakt nivå, sedan ±1, ±2 … (lättare först). */
export function amnesSearchOrder(amnesLevel) {
  const lvl = parseAmnesLevel(amnesLevel) ?? AMNES_MIN;
  const order = [lvl];
  for (let d = 1; d <= AMNES_MAX - AMNES_MIN; d++) {
    if (lvl - d >= AMNES_MIN) order.push(lvl - d);
    if (lvl + d <= AMNES_MAX) order.push(lvl + d);
  }
  return order;
}

const isRead = (area, id) => !!(area && area.read && area.read[id] && area.read[id].count > 0);

/** "Du har läst X av Y texter i området": räknar bara texter som finns kvar. */
export function readProgress(readingTexts, area) {
  const texts = playableTexts(readingTexts);
  return { read: texts.filter((t) => isRead(area, t.id)).length, total: texts.length };
}

/** Diskret rad till eleven – aldrig någon nivå. */
export function readProgressLine({ read, total }) {
  return `Du har läst ${read} av ${total} ${total === 1 ? "text" : "texter"} i området`;
}

/**
 * "Elev-id" till reader-logic:s localStorage-hjälpare (låsta svar). De har EN
 * plats per nyckel; område + elev i nyckeln gör att Läsresans påbörjade text
 * (och andra områden) aldrig skrivs över.
 */
export function pendingKey(areaId, studentId) {
  return `amnes:${areaId}:${studentId}`;
}

/** Beskedet när eleven läst allt (§4.3). */
export const ALL_READ_MESSAGE = "Du har läst alla texter i området! Här är en du läste för ett tag sedan.";

/**
 * Nästa text för eleven i området.
 * @param {object[]} readingTexts områdets readingTexts
 * @param {number} amnesLevel elevens ämnesnivå 1–3 (data-amneslasning.getAmnesArea)
 * @param {object} area områdets tillstånd (progress.areaOf: read, currentTextId)
 * @returns {{text:object, resumed:boolean, allRead:boolean, stale:boolean}|null}
 *   `stale` = en påbörjad text fanns men är borttagen ur området (starta med force).
 *   null = området har inga spelbara texter.
 */
export function pickAmnesText(readingTexts, amnesLevel, area) {
  const texts = playableTexts(readingTexts);
  if (texts.length === 0) return null;
  const currentId = area && area.currentTextId;
  if (currentId) {
    const current = texts.find((t) => t.id === currentId);
    if (current) return { text: current, resumed: true, allRead: false, stale: false };
  }
  const stale = !!currentId;
  for (const lvl of amnesSearchOrder(amnesLevel)) {
    const unread = texts.find((t) => parseAmnesLevel(t.level) === lvl && !isRead(area, t.id));
    if (unread) return { text: unread, resumed: false, allRead: false, stale };
  }
  // Allt läst: den som lästes längst tillbaka (saknad tid = äldst; lika → områdets ordning).
  const lastAt = (t) => (area.read[t.id] && Number.isFinite(area.read[t.id].lastAt) ? area.read[t.id].lastAt : 0);
  const oldest = texts.reduce((best, t) => (lastAt(t) < lastAt(best) ? t : best));
  return { text: oldest, resumed: false, allRead: true, stale };
}
