// ============================================================================
// Pluggporten – byggstenar för Ämnesläsningens AI-prompt (prompt-amnes.js, #673)
// ----------------------------------------------------------------------------
// Mallen i bilaga A (docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md), uppdelad i
// block som src/prompts.js sätter ihop:
//   • buildAmnesPrompt (prompts.js) – panelen "Skapa ämnestexter": hela mallen.
//   • buildAreaPrompt (prompts.js)  – övningstypen "📖 Ämnesläsning" ikryssad:
//     nivåer, texter, frågor och schemat för "readingTexts" som ett innehållskrav.
// Ordantal, frågor per nivå, nivåbeskrivningar och kategorier hämtas ur
// src/lasresan/config.js – samma tal som valideringen (src/amneslasning/content.js)
// använder, så att prompten och valideringen aldrig glider isär.
// Bor bredvid prompt-parts.js (som är nära radtaket); laddas aldrig vid boot.
// ============================================================================

import {
  AMNES_LEVELS,
  AMNES_LEVEL_DESCRIPTIONS,
  AMNES_QUESTIONS_BY_LEVEL,
  AMNES_WORD_RANGES,
  CATEGORIES,
  CATEGORY_AI_HINTS,
  OPTIONS_PER_QUESTION,
} from "./lasresan/config.js";

const ANTAL_ORD = { 1: "ett", 2: "två", 3: "tre", 4: "fyra", 5: "fem" };
const antalOrd = (n) => ANTAL_ORD[n] || String(n);

/** "tre nivåer" – antalet ämnesnivåer i ord. */
export const NIVAER_ORD = `${antalOrd(AMNES_LEVELS.length)} nivåer`;

/** NIVÅERNA – en punkt per ämnesnivå med ordantal, språk och frågor ur config. */
export function amnesNivaer() {
  const rows = AMNES_LEVELS.map((level) => {
    const d = AMNES_LEVEL_DESCRIPTIONS[level] || {};
    const [wMin, wMax] = AMNES_WORD_RANGES[level];
    const [qMin, qMax] = AMNES_QUESTIONS_BY_LEVEL[level];
    return `- Nivå ${level} (${d.reader}): cirka ${wMin}–${wMax} ord, ${d.language}. ${qMin}–${qMax} frågor, ${d.questions}.`;
  });
  return `NIVÅERNA
${rows.join("\n")}
Samma ämnesinnehåll får gärna finnas på flera nivåer, men skrivet på olika
svårighetsnivå. Gör inte språket konstgjort svårt bara för att höja nivån.`;
}

export const AMNES_TEXTERNA = `TEXTERNA
- Mest faktatexter ("fact"). En berättande text ("story") som gör ämnet levande
  är välkommen, till exempel "En dag i en vikingaby".
- Alla fakta ska vara korrekta och passa elevernas ålder. Undvik osäkra eller
  omstridda uppgifter, och hitta aldrig på årtal, siffror eller namn.
- Engagerande och konkret, inte som en uppslagsbok.
- Inga frågor eller svar inne i själva texten.`;

/** FRÅGORNA – med kategorierna (nyckel + förklaring) ur config. */
export function amnesFragorna() {
  const width = Math.max(...CATEGORIES.map((c) => c.length)) + 2;
  const kat = CATEGORIES.map((c) => `  ${`"${c}"`.padEnd(width + 1)} – ${CATEGORY_AI_HINTS[c] || c}`).join("\n");
  const sista = CATEGORIES.slice(-2).map((c) => `"${c}"`).join(" och ");
  const toppniva = AMNES_LEVELS[AMNES_LEVELS.length - 1];
  return `FRÅGORNA
- Varje fråga ska gå att besvara med hjälp av texten.
- Exakt ${OPTIONS_PER_QUESTION} svarsalternativ. Exakt ett är rätt. Felalternativen ska vara rimliga,
  inte löjliga, och inte delvis rätta.
- Variera vilket alternativ som är rätt (inte alltid det första eller det
  längsta).
- Avslöja inte svaret i frågans formulering.
- Ange vad frågan testar med "category", exakt en av:
${kat}
  Sprid kategorierna; på nivå ${toppniva} ska det finnas flera ${sista}.`;
}

/** Exempelobjektet för en ämnestext (JSON-rader, indragna med `pad`). */
function exampleText(pad = "") {
  const opts = ["Alternativ A", "Alternativ B", "Alternativ C", "Alternativ D"].slice(0, OPTIONS_PER_QUESTION);
  return `{
  "id": "kort-id-med-bindestreck",
  "title": "Textens rubrik",
  "level": ${AMNES_LEVELS[0]},
  "textType": "fact",
  "body": "Själva texten. Stycken separeras med tom rad.",
  "questions": [
    {
      "id": "q1",
      "question": "Frågan?",
      "options": [${opts.map((o) => `"${o}"`).join(", ")}],
      "answerIndex": 0,
      "category": "${CATEGORIES[0]}"
    }
  ]
}`
    .split("\n")
    .map((l, i) => (i === 0 ? l : pad + l))
    .join("\n");
}

/** SVARSFORMAT – panelens fristående prompt (bara readingTexts). */
export function amnesSvarsformat(count) {
  return `SVARSFORMAT
Svara ENDAST med JSON, utan förklaringar före eller efter, enligt det här
formatet:

{
  "readingTexts": [
    ${exampleText("    ")}
  ]
}

"answerIndex" är 0-baserat (0 = första alternativet). Kontrollera att det
pekar på det rätta svaret. Kontrollera innan du svarar att varje nivå har
${count} texter och att antalet frågor stämmer med nivån.`;
}

/** Schemaraden för "readingTexts" i områdes-prompten (buildAreaPrompt). */
export const SCHEMA_READING_TEXTS = `- "readingTexts": lista med ÄMNESTEXTER för övningen Ämnesläsning (läsförståelse på ${NIVAER_ORD}).
  Inte samma sak som "texts". Varje text:
    { "id": string, "title": string, "level": ${AMNES_LEVELS.join(" | ")}, "textType": "fact" | "story",
      "body": string, "questions": [{ "id": string, "question": string,
      "options": [${OPTIONS_PER_QUESTION} strängar], "answerIndex": number, "category": string }] }
    * "level" är textens nivå, "body" är själva texten (stycken separeras med tom rad).
    * "answerIndex" är 0-baserat. "category" är EXAKT en av ${CATEGORIES.map((c) => `"${c}"`).join(", ")}
      (andra nycklar än för "quiz").`;

/** Exempel på "readingTexts" inne i områdes-exemplet. */
export function areaExampleReadingTexts() {
  return `  "readingTexts": [
    ${exampleText("    ")}
  ]`;
}

/** Innehållskravet i områdes-prompten: antal per nivå + nivåer/texter/frågor. */
export function amnesKrav(count) {
  return `${count} texter per nivå på ${NIVAER_ORD}, alltså ${count * AMNES_LEVELS.length} texter totalt. Varje text har egna flervalsfrågor.
${amnesNivaer()}
${AMNES_TEXTERNA}
${amnesFragorna()}`;
}

/** Områdets fält när BARA Ämnesläsning är vald (spec §6.4) – inga quiz/par-scheman. */
export const SCHEMA_AREA_HEAD = `Objektet (ETT arbetsområde) har fälten:
- "id": string – kort id i gemener med bindestreck, t.ex. "vikingatiden". (Får utelämnas; skapas då från namnet.)
- "name": string – arbetsområdets namn, t.ex. "Vikingatiden". (Obligatoriskt.)
- "order": number – sorteringsordning, t.ex. 1. (Får utelämnas.)
- "coverEmoji": string – en emoji som symbol, t.ex. "🛶".
- "description": string – en kort beskrivning på 1–2 meningar.
- "texts", "quiz", "pairs": tomma listor [] (området har bara ämnesläsning).`;

/** Reglerna när BARA Ämnesläsning är vald (utan quiz-/par-reglerna). */
export const REGLER_AMNES = `Viktiga regler:
- Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga \`\`\`-kodstaket.
- Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.
- Skriv på svenska, anpassat till elevernas ålder (se årskursen ovan) och till textens nivå.
- Hitta INTE på fakta. Utgå från det bifogade materialet / texten nedan.
- Varje fråga: exakt ${OPTIONS_PER_QUESTION} svarsalternativ och "answerIndex" 0-baserat som pekar på det rätta alternativet.`;
