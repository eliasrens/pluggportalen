// ============================================================================
// Ekvationsresan – lärarens sammanfattningar (src/ekvationsresan/sammanfattning.js) · #626
// ----------------------------------------------------------------------------
// Spec E2.5. Ren logik: färdighetsmodellen i progressdokumentet (fardigheter.js)
// → korta, begripliga meningar för läraren ("Behöver ofta hjälp när x har en
// koefficient."), vad eleven behärskar / har svårt för, problemlösning och
// färdighetsindikatorer. Allt räknas ur ETT progressdokument per elev – inga
// försök läses för klassöversikten (#231).
// ============================================================================

import { FARDIGHET } from "./config.js";
import { las, stark, svag, hjalpOfta, sjalvstandig, ekvationer, indikatorer, EKVATIONSSLAG } from "./fardigheter.js";

/** Ekvationsslagen som läraren känner igen dem. */
export const SLAG_NAMN = Object.freeze({
  ettSteg: "enstegsekvationer",
  tvaSteg: "tvåstegsekvationer",
  bada: "x i båda leden",
  addSub: "ta bort ett tal (+ och −)",
  multDiv: "x med koefficient (· och ÷)",
});

export const FOR_LITE = "För få uppgifter för en sammanfattning än.";

/**
 * Sammanfattningens meningar, viktigast först inom varje ton.
 * @param {object} skills  progress.skills
 * @param {{solvedPct?: number|null}} [extra]  lösta % ur teacherSummary
 * @returns {{ ton: "bra"|"svart"|"info", text: string, key: string }[]}
 */
export function sammanfattningar(skills, { solvedPct = null } = {}) {
  const s = (key) => las(skills, key);
  const bra = [];
  const svart = [];
  const add = (list, key, text) => list.push({ ton: list === bra ? "bra" : "svart", key, text });

  // Behärskar …
  const sjalvt = (key) => stark(s(key)) && sjalvstandig(s(key));
  if (sjalvt("ettSteg")) add(bra, "ettSteg", "Behärskar enstegsekvationer självständigt.");
  if (sjalvt("tvaSteg")) add(bra, "tvaSteg", "Behärskar tvåstegsekvationer självständigt.");
  if (sjalvt("bada")) add(bra, "bada", "Behärskar ekvationer med x i båda leden.");
  if (stark(s("problem"))) add(bra, "problem", "Löser textuppgifter hela vägen – ekvation, lösning och svar.");
  else if (stark(s("text"))) add(bra, "text", "Skapar ekvationer från text utan problem.");

  // Hjälpbehov per ekvationsslag
  if (hjalpOfta(s("multDiv"))) add(svart, "multDiv", "Behöver ofta hjälp när x har en koefficient.");
  else if (svag(s("multDiv"))) add(svart, "multDiv", "Har svårt när x har en koefficient.");
  if (hjalpOfta(s("addSub"))) add(svart, "addSub", "Behöver ofta hjälp att få bort ett tal som läggs till eller dras ifrån.");
  if (svag(s("bada")) || hjalpOfta(s("bada"))) add(svart, "bada", "Har svårt när x står i båda leden.");
  else if (svag(s("tvaSteg")) || hjalpOfta(s("tvaSteg"))) add(svart, "tvaSteg", "Har svårt med ekvationer i två steg.");

  // Text, skrivsätt, förenkling, balans
  if (svag(s("text"))) {
    add(svart, "text", stark(ekvationer(skills)) ? "Löser ekvationer bra men har svårt att skapa ekvation från text." : "Har svårt att skapa ekvation från text.");
  } else if (svag(s("problem"))) add(svart, "problem", "Har svårt att lösa textuppgifter hela vägen till svaret.");
  if (svag(s("skrivsatt"))) {
    add(svart, "skrivsatt", stark(s("balans")) ? "Förstår vågen men har svårt att skriva ekvationen med symboler." : "Har svårt att skriva ekvationen med symboler.");
  }
  if (svag(s("forenkling"))) add(svart, "forenkling", "Har svårt att förenkla raden efter en operation.");
  if (svag(s("balans"))) add(svart, "balans", "Har svårt med att göra samma sak i båda leden.");
  if (svag(s("operation")) && (solvedPct == null || solvedPct >= 60)) add(svart, "operation", "Tar ofta många extra steg trots korrekta slutsvar.");

  // Självständighet – bara om inget mer specifikt redan sagts
  const hjalpSagt = svart.some((r) => /hjälp/.test(r.text));
  if (hjalpOfta(s("sjalv")) && !hjalpSagt) add(svart, "sjalv", "Använder ofta 💡 eller Visa lösningen.");
  if (!bra.length && stark(s("sjalv")) && sjalvstandig(s("sjalv"))) add(bra, "sjalv", "Arbetar självständigt och använder sällan 💡.");

  if (!bra.length && !svart.length) {
    const underlag = Math.max(0, ...EKVATIONSSLAG.map((k) => s(k).n), s("sjalv").n);
    return [{ ton: "info", key: "info", text: underlag < FARDIGHET.minN ? FOR_LITE : "Inget som sticker ut – eleven ligger jämnt på sin nivå." }];
  }
  return [...bra, ...svart];
}

/** Klassöversiktens korta rad: det första eleven har svårt för + det första hen behärskar. */
export function iKorthet(rows) {
  const svart = rows.find((r) => r.ton === "svart");
  const bra = rows.find((r) => r.ton === "bra");
  const out = [svart, bra].filter(Boolean);
  return out.length ? out : rows.slice(0, 1);
}

/** Vilka ekvationsslag eleven behärskar och har svårt för (lärarens listor). */
export function slagLagen(skills) {
  const kan = [];
  const svart = [];
  for (const key of EKVATIONSSLAG) {
    const e = las(skills, key);
    if (stark(e) && !hjalpOfta(e)) kan.push(SLAG_NAMN[key]);
    else if (svag(e) || hjalpOfta(e)) svart.push(SLAG_NAMN[key]);
  }
  return { kan, svart };
}

/** Problemlösning och text → ekvation: { text, problem } ur modellen. */
export function problemlosning(skills) {
  return { text: las(skills, "text"), problem: las(skills, "problem") };
}

/** Allt lärarvyn visar om färdigheterna. */
export function fardighetsbild(progress, { solvedPct = null } = {}) {
  const skills = progress?.skills || {};
  const rader = sammanfattningar(skills, { solvedPct });
  return { rader, korthet: iKorthet(rader), slag: slagLagen(skills), problem: problemlosning(skills), indikatorer: indikatorer(skills) };
}
