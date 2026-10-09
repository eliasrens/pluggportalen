// ============================================================================
// Pluggporten – Live: gameMode-registry (#457)
// ----------------------------------------------------------------------------
// Live-kärnan (sessioner, lobby, timer, räknare, projektorvyer) vet INGET om
// multiplikation. Den frågar sitt sessions `gameMode` via det här registret.
// Ett nytt spelläge (addition, division, geography …) = en ny fil i
// src/live/modes/ + EN rad i src/live/modes/index.js. Live-kärnan rörs inte.
// Ren modul (ingen DOM/Firebase) – testas i test/live-game-modes.test.js.
//
// API
//   registerGameMode(mode)  → mode (fryst). Kastar om interfacet inte uppfylls
//                             eller id:t redan finns.
//   getGameMode(id)         → mode | null
//   requireGameMode(id)     → mode, kastar för okänt id
//   listGameModes()         → mode[] i registreringsordning (lärarens mode-väljare)
//   validateGameMode(mode)  → string[] med fel (tom = ok)
//
// GameMode-INTERFACET (alla fält obligatoriska om inget annat sägs):
//   id                 string  – lagras som liveSessions.gameMode, t.ex.
//                                "multiplication_0_10". Får aldrig bytas.
//   displayName        string  – "Multiplikation 0–10 – snabbmatch"
//   icon               string  – emoji i lärarens mode-väljare
//   description        string  – en rad förklaring (valfri, default "")
//   inputMode          "numeric" | "text" – svarsfältets tangentbord
//   pointsPerCorrect   number  – poäng för ett rätt svar. ⚠️ firestore.rules
//                                tillåter i dag bara +1 per svarsdokument;
//                                ett mode med annan poäng kräver regeländring.
//   createSource(opts) → { next(): Question } – frågeström per klient/elev.
//                                opts: { rng? } (se generatorn).
//   checkAnswer(q, raw)→ { valid, correct, correctAnswer } – `valid:false`
//                                (t.ex. tomt fält) räknas INTE som försök.
//                                `correctAnswer` visas i "❌ FEL – rätt svar var X".
//   answerRecord(q, r) → object – mode-specifika fält som sparas i svars-
//                                dokumentet (utöver kärnans uid/classId/at/
//                                isCorrect/mode). Reglerna validerar dem per mode.
//   statKeys(q)        → string[] – statistik-kategorier ett svar räknas till
//                                (multiplikation: tabellerna, "t7","t8").
//   statCategories     → [{ key, label }] – alla kategorier i visningsordning
//                                (statistikvyer bygger tabeller ur denna).
//   answerKinds        string[] – VALFRI (saknas = ["free"], #551). Svarssätten
//                                läget kan leverera: "free" = skriv själv
//                                (src/mult/fast-answer.js), "choice" = fyra
//                                alternativ (flervalsflödet, se nedan).
//                                Sessionens svarssätt (liveSessions.answerKind)
//                                måste finnas här OCH i formatets answerKinds.
//   cooperative        bool    – VALFRI (default false). true = klasserna spelar
//                                MOT ETT MÅL i stället för mot varandra.
//   goalReached(standings, session) → bool – KRÄVS om cooperative. Nådde
//                                matchen målet? (live-core buildResult sparar
//                                svaret i result.goalReached → pokalen
//                                "live-avklarat" till deltagande klasser, #495.
//                                Tävlingslägen ger i stället "live-vinst".)
//   setupFields        VALFRI – lägets egna lärarinställningar (#553), samma
//                                fältsorter som formatets (live-setup-fields.js),
//                                ritade under spellägesvalet. "custom"-fältets
//                                mount får { className, format } – t.ex. quizets
//                                ämne/område läser formatets minQuestions.
//   validateSetup(input, { format }) VALFRI → string[] – lägets egna fält
//   buildSessionFields(input) VALFRI → object – lägets fält på sessionen
//                                (quiz: { quiz: { subjectId, areaId, … } })
//
// Question är mode-specifik men har alltid { key, text } – `text` är det
// svarskomponenten (src/mult/fast-answer.js) visar stort.
//
// SVARSSÄTTET "choice" (#551/#552) – ett läge med "choice" i answerKinds
// har dessutom (validateGameMode kräver det):
//   choices(q, rng?) → { options: 4 alternativ, answerIndex } – samma frågor
//                      ur createSource() som skriv själv; rätt svars plats
//                      varierar (multiplikation: multChoices i motorn).
//   Rättningen är DENSAMMA som skriv själv: checkAnswer(q, String(options[i]))
//   på det valda alternativets värde, och answerRecord(q, r) ger samma fält.
//   Kärnan (planLiveAnswerWrites) lägger själv till `answerKind: "choice"` +
//   `choiceIndex` (knappens index 0–3) på svarsdokumentet; reglerna nekar
//   ett svar vars form inte matchar sessionens answerKind.
//   Elevsidan väljer komponent ur sessionens answerKind via
//   src/live/answer-kinds.js (free = fast-answer, choice = choice-flow.js).
// ============================================================================

const REGISTRY = new Map();

const FUNCS = ["createSource", "checkAnswer", "answerRecord", "statKeys"];
// Samma lista som live-formats.js ANSWER_KINDS (registren är fristående).
const ANSWER_KINDS = ["free", "choice"];

/**
 * Kontrollera att ett objekt uppfyller GameMode-interfacet.
 * @param {object} mode
 * @returns {string[]} fel (tom lista = giltigt)
 */
export function validateGameMode(mode) {
  const errs = [];
  if (!mode || typeof mode !== "object") return ["mode saknas"];
  if (typeof mode.id !== "string" || !/^[a-z][a-z0-9_]{1,39}$/.test(mode.id)) {
    errs.push("id måste vara snake_case, 2–40 tecken");
  }
  if (typeof mode.displayName !== "string" || !mode.displayName) errs.push("displayName saknas");
  if (typeof mode.icon !== "string") errs.push("icon saknas");
  if (!["numeric", "text"].includes(mode.inputMode)) errs.push("inputMode måste vara numeric|text");
  if (!(Number.isInteger(mode.pointsPerCorrect) && mode.pointsPerCorrect > 0)) {
    errs.push("pointsPerCorrect måste vara ett positivt heltal");
  }
  for (const f of FUNCS) if (typeof mode[f] !== "function") errs.push(`${f}() saknas`);
  if (!Array.isArray(mode.statCategories) ||
      !mode.statCategories.every((c) => c && typeof c.key === "string" && typeof c.label === "string")) {
    errs.push("statCategories måste vara [{key,label}]");
  }
  if (mode.answerKinds != null && (!Array.isArray(mode.answerKinds) || !mode.answerKinds.length ||
      !mode.answerKinds.every((k) => ANSWER_KINDS.includes(k)))) {
    errs.push(`answerKinds måste vara en icke-tom delmängd av ${ANSWER_KINDS.join(",")}`);
  }
  if (mode.answerKinds?.includes?.("choice") && typeof mode.choices !== "function") {
    errs.push("choices() krävs för svarssättet choice");
  }
  if (mode.setupFields != null && (!Array.isArray(mode.setupFields) ||
      !mode.setupFields.every((x) => x && typeof x.key === "string" && typeof x.label === "string" && typeof x.kind === "string"))) {
    errs.push("setupFields måste vara [{key,label,kind}]");
  }
  for (const f of ["validateSetup", "buildSessionFields"]) {
    if (mode[f] != null && typeof mode[f] !== "function") errs.push(`${f} måste vara en funktion`);
  }
  if (mode.cooperative != null && typeof mode.cooperative !== "boolean") errs.push("cooperative måste vara bool");
  if (mode.cooperative === true && typeof mode.goalReached !== "function") {
    errs.push("goalReached() krävs för ett kooperativt läge");
  }
  return errs;
}

/**
 * Registrera ett spelläge.
 * @param {object} mode GameMode
 * @returns {Readonly<object>}
 */
export function registerGameMode(mode) {
  const errs = validateGameMode(mode);
  if (errs.length) throw new Error(`registerGameMode(${mode?.id}): ${errs.join("; ")}`);
  if (REGISTRY.has(mode.id)) throw new Error(`registerGameMode: "${mode.id}" finns redan`);
  const frozen = Object.freeze({ description: "", ...mode });
  REGISTRY.set(mode.id, frozen);
  return frozen;
}

/** @returns {object|null} */
export function getGameMode(id) {
  return REGISTRY.get(id) || null;
}

/** @returns {object} kastar för okänt id */
export function requireGameMode(id) {
  const m = REGISTRY.get(id);
  if (!m) throw new Error(`Okänt Live-spelläge: ${id}`);
  return m;
}

/** @returns {object[]} i registreringsordning */
export function listGameModes() {
  return [...REGISTRY.values()];
}

/** Bara för tester: töm registret. */
export function _resetGameModesForTest() {
  REGISTRY.clear();
}
