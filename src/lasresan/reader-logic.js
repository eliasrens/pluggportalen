// ============================================================================
// Läsresan – läsvyns rena logik (src/lasresan/reader-logic.js)
// ----------------------------------------------------------------------------
// Ingen DOM och ingen Firestore, så allt testas med `node --test`
// (test/lasresan-reader.test.js). Används av ui-reader.js och page-lasresan.js.
//
//  * displayOrder: STABIL blandning av svarsalternativen per fråga. Rätt svars
//    position i innehållet blir då ingen ledtråd, och samma fråga visas i samma
//    ordning efter en omladdning. Vyn skickar alltid tillbaka ORIGINALindex.
//  * Pågående svar: en påbörjad text återupptas där eleven slutade, och redan
//    låsta svar följer med. Annars kunde eleven ladda om sidan och svara om
//    de frågor som blev fel.
// ============================================================================

/** Enkel, deterministisk 32-bitars hash (FNV-1a) av en sträng. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Liten seedad slumpgenerator (mulberry32), ger tal i [0, 1). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Visningsordning för `n` alternativ: en permutation av 0..n-1 som bara beror
 * på `key` (t.ex. "textId/qid"). Samma nyckel ger alltid samma ordning.
 */
export function displayOrder(key, n) {
  const order = Array.from({ length: Math.max(0, n | 0) }, (_, i) => i);
  const rnd = seeded(hashString(key));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Tvätta sparade svar mot texten: bara svar på textens frågor, i frågeordning,
 * med giltigt index, och bara en obruten följd från första frågan (vyn visar
 * en fråga i taget, så det kan inte finnas luckor).
 * @returns {{qid:string, chosen:number}[]}
 */
export function validAnswers(text, saved) {
  const qs = (text && Array.isArray(text.questions)) ? text.questions : [];
  const list = Array.isArray(saved) ? saved : [];
  const out = [];
  for (let i = 0; i < qs.length && i < list.length; i++) {
    const a = list[i];
    const q = qs[i];
    const nOpts = Array.isArray(q.options) ? q.options.length : 0;
    if (!a || a.qid !== q.id || !Number.isInteger(a.chosen) || a.chosen < 0 || a.chosen >= nOpts) break;
    out.push({ qid: q.id, chosen: a.chosen });
  }
  return out;
}

/** Antal rätt bland svaren (för vyns egen räknare – kärnan rättar på riktigt). */
export function countCorrect(text, answers) {
  const byId = new Map(((text && text.questions) || []).map((q) => [q.id, q]));
  return (answers || []).filter((a) => byId.has(a.qid) && byId.get(a.qid).answerIndex === a.chosen).length;
}

// --- Pågående text i localStorage ------------------------------------------
// Nyckeln innehåller elev-id så att flera elever på samma dator inte krockar.
// Allt är inslaget i try/catch: blockerad lagring = ingen återupptagning, inget fel.

export const PENDING_PREFIX = "pp:lasresan:pagaende:";

export function loadPending(storage, studentId, textId) {
  try {
    const raw = storage && storage.getItem(PENDING_PREFIX + studentId);
    const v = raw ? JSON.parse(raw) : null;
    return v && v.textId === textId && Array.isArray(v.answers) ? v.answers : [];
  } catch {
    return [];
  }
}

export function savePending(storage, studentId, textId, answers) {
  try {
    if (storage) storage.setItem(PENDING_PREFIX + studentId, JSON.stringify({ textId, answers }));
  } catch {}
}

export function clearPending(storage, studentId) {
  try {
    if (storage) storage.removeItem(PENDING_PREFIX + studentId);
  } catch {}
}
