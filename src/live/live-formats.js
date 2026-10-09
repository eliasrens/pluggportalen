// ============================================================================
// Pluggporten – Live: SPELFORMAT-registret (#547, epic #546)
// ----------------------------------------------------------------------------
// Tredje axeln bredvid gameMode (VAD eleverna svarar på) och projektorvy:
// spelformatet = HUR matchen spelas – vem som tävlar mot vem, flödet, poängen
// och vinnaren. Live-kärnan (session, lobby, status, klocka, 3-2-1-KÖR!,
// närvaro, ljud, fullskärm, elevskärm) vet INGET om klass mot klass: den
// slår upp sessionens format (`session.format ?? "klassmatch"`) här.
// Nytt format = en mapp src/live/formats/<id>/ + EN rad i
// src/live/formats/index.js (+ dess regelgren i firestore.rules).
// Ren modul (ingen DOM/Firebase) – testas i test/live-formats.test.js.
// Samma mönster som gameMode-registret (src/live/game-modes.js).
//
// API
//   registerFormat(format)   → format (fryst). Kastar om interfacet inte
//                              uppfylls eller id:t redan finns.
//   getFormat(id)            → format | null
//   requireFormat(id)        → format, kastar för okänt id
//   listFormats()            → format[] i registreringsordning (formatväljaren)
//   validateFormat(format)   → string[] med fel (tom = ok)
//   answerKindsFor(format, mode) → svarssätt BÅDA stöder (mode utan
//                              answerKinds = ["free"]), i formatets ordning
//   defaultAnswerKind(kinds) → "free" om den finns med, annars den första
//                              (null för tom lista) – lärarformulärets förval
//   resolveAnswerKind(format, mode, wanted) → svarssättet sessionen sparar:
//                              wanted om båda stöder det, saknat wanted =
//                              defaultAnswerKind, annars null (ogiltigt val)
//   answerKindOf(session)    → session.answerKind ?? "free" (#551: sessioner
//                              utan fältet är skriv själv – ingen migrering)
//   ANSWER_KINDS             ["free", "choice"]
//
// FORMAT-INTERFACET (obligatoriskt om inget annat sägs):
//   id            string – lagras som liveSessions.format ("klassmatch").
//                          Får aldrig bytas. Session UTAN format = "klassmatch".
//   displayName, icon, description (valfri)  – lärarens formatväljare
//   scope         "mellan-klasser" | "inom-klass"
//   minClasses / maxClasses  heltal 1–8 – hur många klasser läraren väljer
//   answerKinds   delmängd av ANSWER_KINDS: "free" = skriv själv (dagens
//                 snabba ENTER-fält), "choice" = fyra alternativ
//   pacing        "tid" (serverstyrd matchklocka, durationSeconds) |
//                 "lärarstyrd" (läraren går vidare fråga för fråga)
//   compatibleGameModes(mode) → bool – kan formatet spelas med spelläget?
//   setupFields   [{ key, label, kind, … }] – formatets egna lärarinställningar,
//                 ritade GENERISKT av lärarformuläret (#548). Sorterna
//                 (choice/number/text/toggle/perClass/custom) och deras
//                 nycklar: src/live/live-setup-fields.js. Matchlängden ritas
//                 av kärnan vid pacing "tid" om formatet inte själv lagt ett
//                 "durationMin"-fält (durationField()) i listan.
//   validateSetup(input) → string[] – formatets egna fält (kärnan kontrollerar
//                 namn, spelläge, klassantal och – vid pacing "tid" – matchlängd)
//   buildSessionFields(input) → object – formatspecifika fält på sessionen
//   defaultSessionName(names) VALFRI → förslaget i Matchnamn ("4B mot 5E" om
//                 den saknas)
//   sessionTitle(s) → string – stor rubrik (elevlistan, elevens matchvy)
//   computeStandings(s, { counters, players, now }) → { classes, totalCorrect,
//                 leaderIds, winnerId, draw } – ställningen projektorvyerna
//                 ritar (läggs direkt på live-feed-tillståndet)
//   buildResult(s, classes, players, mode) → historikens ögonblicksbild
//                 (liveSessions.result, skrivs en gång vid matchslut)
//   projectorViews() → Promise<{ views, createLobby, createWinner, editDivisors? }>
//                 LAT (import()) – DOM-moduler. views = [{ id, label,
//                 create(host, { st, colors, sound }) → { update, destroy },
//                 only2?, finale?, preload? }]
//   studentView()    → Promise<{ lobbyHtml(s), endHtml(st, player, classId) }>  LAT
//   historyRenderer() → Promise<{ winnerText, detailHtml, classStats }>   LAT
//   classCounters VALFRI bool – sessionen har shardade klassräknare
//                 (liveSessions/{sid}/counters) som realtidslagret lyssnar på
//   classDivisors VALFRI bool – lärarens nämnare per klass ("÷ Nämnare")
//   emitOnPlayers VALFRI bool – realtidslagret skickar nytt tillstånd vid varje
//                 spelarändring (svar, även fel) för händelsesystemet (#571)
//   minQuestions  VALFRI heltal ≥ 1 – färre frågor än så i ett quizområde ger
//                 läraren en tydlig varning (#553; saknas = 5, plugga-quiz-core.js)
// ============================================================================

const REGISTRY = new Map();

export const ANSWER_KINDS = ["free", "choice"];
const SCOPES = ["mellan-klasser", "inom-klass"];
const PACINGS = ["tid", "lärarstyrd"];
const FUNCS = [
  "compatibleGameModes", "validateSetup", "buildSessionFields", "sessionTitle",
  "computeStandings", "buildResult", "projectorViews", "studentView", "historyRenderer",
];

/**
 * Kontrollera att ett objekt uppfyller format-interfacet.
 * @param {object} f
 * @returns {string[]} fel (tom lista = giltigt)
 */
export function validateFormat(f) {
  const errs = [];
  if (!f || typeof f !== "object") return ["format saknas"];
  if (typeof f.id !== "string" || !/^[a-z][a-z0-9_]{1,39}$/.test(f.id)) {
    errs.push("id måste vara snake_case, 2–40 tecken");
  }
  if (typeof f.displayName !== "string" || !f.displayName) errs.push("displayName saknas");
  if (typeof f.icon !== "string") errs.push("icon saknas");
  if (!SCOPES.includes(f.scope)) errs.push(`scope måste vara ${SCOPES.join("|")}`);
  const okN = (n) => Number.isInteger(n) && n >= 1 && n <= 8;
  if (!okN(f.minClasses) || !okN(f.maxClasses) || f.minClasses > f.maxClasses) {
    errs.push("minClasses/maxClasses måste vara heltal 1–8, min ≤ max");
  }
  if (!Array.isArray(f.answerKinds) || !f.answerKinds.length || !f.answerKinds.every((k) => ANSWER_KINDS.includes(k))) {
    errs.push(`answerKinds måste vara en icke-tom delmängd av ${ANSWER_KINDS.join(",")}`);
  }
  if (!PACINGS.includes(f.pacing)) errs.push(`pacing måste vara ${PACINGS.join("|")}`);
  if (!Array.isArray(f.setupFields) ||
      !f.setupFields.every((x) => x && typeof x.key === "string" && typeof x.label === "string" && typeof x.kind === "string")) {
    errs.push("setupFields måste vara [{key,label,kind}]");
  }
  for (const fn of FUNCS) if (typeof f[fn] !== "function") errs.push(`${fn}() saknas`);
  if (f.minQuestions != null && !(Number.isInteger(f.minQuestions) && f.minQuestions >= 1)) {
    errs.push("minQuestions måste vara ett heltal ≥ 1");
  }
  for (const b of ["classCounters", "classDivisors", "emitOnPlayers"]) {
    if (f[b] != null && typeof f[b] !== "boolean") errs.push(`${b} måste vara bool`);
  }
  return errs;
}

/**
 * Registrera ett format.
 * @param {object} f
 * @returns {Readonly<object>}
 */
export function registerFormat(f) {
  const errs = validateFormat(f);
  if (errs.length) throw new Error(`registerFormat(${f?.id}): ${errs.join("; ")}`);
  if (REGISTRY.has(f.id)) throw new Error(`registerFormat: "${f.id}" finns redan`);
  const frozen = Object.freeze({ description: "", classCounters: false, classDivisors: false, emitOnPlayers: false, ...f });
  REGISTRY.set(f.id, frozen);
  return frozen;
}

/** @returns {object|null} */
export function getFormat(id) {
  return REGISTRY.get(id) || null;
}

/** @returns {object} kastar för okänt id */
export function requireFormat(id) {
  const f = REGISTRY.get(id);
  if (!f) throw new Error(`Okänt Live-format: ${id}`);
  return f;
}

/** @returns {object[]} i registreringsordning */
export function listFormats() {
  return [...REGISTRY.values()];
}

/** Svarssätten läraren kan välja: de som både formatet och spelläget stöder. */
export function answerKindsFor(format, mode) {
  const modeKinds = Array.isArray(mode?.answerKinds) ? mode.answerKinds : ["free"];
  return (format?.answerKinds || []).filter((k) => modeKinds.includes(k));
}

/** Lärarformulärets förval: skriv själv om möjligt. */
export function defaultAnswerKind(kinds) {
  if (!kinds?.length) return null;
  return kinds.includes("free") ? "free" : kinds[0];
}

/** Svarssättet en ny session sparar, eller null om valet inte går ihop. */
export function resolveAnswerKind(format, mode, wanted) {
  const kinds = answerKindsFor(format, mode);
  if (wanted == null || wanted === "") return defaultAnswerKind(kinds);
  return kinds.includes(wanted) ? wanted : null;
}

/** Sessionens svarssätt – saknat fält = "free" (alla sessioner före #551). */
export function answerKindOf(session) {
  return session?.answerKind ?? "free";
}

/** Bara för tester: töm registret. */
export function _resetFormatsForTest() {
  REGISTRY.clear();
}
