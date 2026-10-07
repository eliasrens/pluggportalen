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
//
// Question är mode-specifik men har alltid { key, text } – `text` är det
// svarskomponenten (src/mult/fast-answer.js) visar stort.
// ============================================================================

const REGISTRY = new Map();

const FUNCS = ["createSource", "checkAnswer", "answerRecord", "statKeys"];

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
