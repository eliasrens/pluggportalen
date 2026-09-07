// ============================================================================
// Pluggportalen – question-rotation.js
// Roterande frågeurval för Quiz + Läsförståelse: varje ny session serverar ett
// urval OSEDDA frågor ur områdets pool, så eleven inte får samma frågor gång på
// gång. När hela poolen körts igenom (ett helt "varv") nollställs spårningen och
// nästa varv slumpas om.
//
// Den här modulen är MEDVETET fri från browser-/Firebase-beroenden så att den
// kan enhetstestas med `node --test` (se test/question-rotation.test.js). Själva
// lagringen (per elev, område, läge) sköts av data.js; anroparna i games-quiz.js
// läser in "sedda" nycklar därifrån, kör pickRotatingQuestions och sparar tillbaka
// den uppdaterade listan.
// ============================================================================

// Max antal frågor per NY quiz-/läsförståelse-session. Har arbetsområdet fler
// frågor i poolen serveras exakt så här många osedda den sessionen; har det färre
// körs alla (och rotationen är då meningslös → nollställs).
export const MAX_QUESTIONS_PER_SESSION = 10;

/** Blanda en array (kopia, Fisher–Yates). Lokal kopia för att hålla modulen fri
 *  från beroenden (game-shared.js har en egen exporterad shuffle för UI-koden). */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Stabil nyckel för en fråga – en hash av själva frågetexten (djb2 → base36).
 * Vald framför "index i quiz-arrayen" eftersom den är stabil även om läraren
 * lägger till/tar bort/flyttar frågor: en flyttad fråga räknas fortfarande som
 * sedd, en redigerad fråga räknas (rimligt nog) som en ny osedd fråga.
 */
export function questionKey(q) {
  const text = q && typeof q.question === "string" ? q.question : "";
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0; // h * 33 + char
  }
  return "q" + (h >>> 0).toString(36);
}

/** Ta bort dubbletter men behåll ordningen (första förekomsten vinner). */
function dedupe(keys) {
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/**
 * Välj vilka frågor en NY session ska köra ur områdets pool, med rotation.
 *
 * @param {Array}  pool  hela områdets fråge-pool (för läget)
 * @param {string[]} seen  nycklar som redan serverats i pågående varv (kan sakna
 *                         data → tom lista → slumpad start, bakåtkompatibelt)
 * @param {number} limit  max frågor per session (default MAX_QUESTIONS_PER_SESSION)
 * @returns {{questions: Array, seen: string[]}}  frågorna att köra + den
 *          uppdaterade listan sedda nycklar att spara inför nästa session.
 *
 * Regler:
 *  • Pool ≤ limit: rotation är meningslös – kör alla (blandade), nollställ sedda.
 *  • Finns ≥ limit osedda: slumpa fram `limit` osedda, lägg dem till sedda
 *    (och rensa bort ev. stale nycklar som inte längre finns i poolen).
 *  • Finns < limit osedda: servera resten av de osedda (varvet tar slut), fyll på
 *    upp till `limit` med färska frågor ur ett NYTT varv, och låt sedda börja om
 *    med enbart de färska frågorna (så nästa varv rullar vidare korrekt).
 */
export function pickRotatingQuestions(pool, seen, limit = MAX_QUESTIONS_PER_SESSION) {
  if (!Array.isArray(pool) || pool.length === 0) return { questions: [], seen: [] };

  // Liten pool: kör alla varje gång, ingen rotation att spåra.
  if (pool.length <= limit) return { questions: shuffle(pool), seen: [] };

  const seenSet = new Set(Array.isArray(seen) ? seen : []);
  const withKey = pool.map((q) => ({ q, key: questionKey(q) }));
  const poolKeys = new Set(withKey.map((x) => x.key));
  const unseen = withKey.filter((x) => !seenSet.has(x.key));

  if (unseen.length >= limit) {
    const picked = shuffle(unseen).slice(0, limit);
    // Behåll bara nycklar som finns kvar i poolen (rensa stale) + de nya.
    const keptSeen = [...seenSet].filter((k) => poolKeys.has(k));
    const nextSeen = dedupe([...keptSeen, ...picked.map((x) => x.key)]);
    return { questions: shuffle(picked.map((x) => x.q)), seen: nextSeen };
  }

  // Varvet tar slut denna session: ta alla kvarvarande osedda och fyll på ur ett
  // nytt, ommlandat varv. Sedda börjar om med enbart de färska frågorna.
  const part1 = shuffle(unseen); // 0 .. limit-1 kvarvarande osedda
  const need = limit - part1.length;
  const part1Keys = new Set(part1.map((x) => x.key));
  const fresh = shuffle(withKey.filter((x) => !part1Keys.has(x.key))).slice(0, need);
  const picked = part1.concat(fresh);
  return {
    questions: shuffle(picked.map((x) => x.q)),
    seen: dedupe(fresh.map((x) => x.key)),
  };
}
