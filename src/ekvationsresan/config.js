// ============================================================================
// Ekvationsresan – konfiguration (src/ekvationsresan/config.js) · #615
// ----------------------------------------------------------------------------
// Nivåer, spärrar och texter på ETT ställe, så att de kan finjusteras utan att
// logiken rörs. Etapp 2 lägger till nivå 7–12 genom att utöka LEVELS (och
// FORMS i forms.js) – spärrarna är redan per nivå (t.ex. allowNegative från
// nivå 9, allowDecimals från nivå 10, operandX från nivå 7).
// #623: nivå 7–12 finns nu (nya poster sist i LEVELS). Bråk bara i
// extrautmaningar (EXTRA_RULES).
// ============================================================================

/** Spärrar och fält (E1.4). Etapp 1 = allt detta för nivå 1–6. */
export const BASE_RULES = Object.freeze({
  allowFractions: false, //  bråk i någon term efter draget → spärr (x/a räknas INTE som bråk)
  allowDecimals: false, //   ändliga decimaler (Etapp 2, nivå 10) – annars som bråk
  maxDecimals: 2, //         högst två decimaler när decimaler är på
  allowNegative: false, //   minustal (ett led < 0 eller ledande minus) → spärr
  maxAbs: 1000, //           tal över 1 000 → spärr
  operandMin: 0, //          talfältet: 0 tas emot så att ÷0/·0 kan förklaras
  operandMax: 999, //        talfältet: 1–999 i Etapp 1
  operandX: false, //        "2x" i talfältet (Etapp 2, nivå 7)
  operandDecimal: false, //  "2,5" i talfältet (Etapp 2, nivå 10)
  distributionStep: true, // mellanled vid ÷/· av led med flera termer (E1.3)
  maxSearchDepth: 6, //      BFS-djup för optimalt antal drag (E1.7)
});

/**
 * Nivåerna. `forms` = vikter för uppgiftsformerna i forms.js, `typeB` = andel
 * uppgiftstyp B ("Lös själv"), `swapShare` = andel där x står i högerledet
 * (14 = 2x + 4) – ger "5 = x"-slutet. `rules` skriver över BASE_RULES.
 */
export const LEVELS = Object.freeze([
  {
    level: 1, name: "Balansen", typeB: 0.1, swapShare: 0,
    forms: { "x+a=b": 1, "x-a=b": 1 },
    params: { maxNumber: 20 },
  },
  {
    level: 2, name: "Lika stora grupper", typeB: 0.2, swapShare: 0,
    forms: { "ax=b": 2, "x/a=b": 1 },
    params: { aMin: 2, aMax: 10, xMax: 12 },
  },
  {
    level: 3, name: "Två steg", typeB: 0.35, swapShare: 0,
    forms: { "ax+b=c": 1 },
    params: { aMin: 2, aMax: 5, xMax: 10, bMax: 10 },
  },
  {
    level: 4, name: "Ekvationslösaren", typeB: 0.5, swapShare: 0,
    forms: { "ax+b=c": 1, "ax-b=c": 1 },
    params: { aMin: 2, aMax: 9, xMax: 12, bMax: 20 },
  },
  {
    level: 5, name: "Större tal", typeB: 0.65, swapShare: 0,
    forms: { "ax+b=c": 1, "ax-b=c": 1 },
    params: { aMin: 3, aMax: 9, xMin: 3, xMax: 12, bMin: 10, bMax: 40 },
  },
  {
    level: 6, name: "Blandat", typeB: 0.8, swapShare: 0.15,
    forms: { "x+a=b": 1, "x-a=b": 1, "ax=b": 1, "x/a=b": 1, "ax+b=c": 2, "ax-b=c": 2, "x/a+b=c": 2, "x/a-b=c": 1 },
    params: { maxNumber: 60, aMin: 2, aMax: 9, xMax: 20, bMax: 30 },
  },
  // --- Etapp 2 (#623, spec E2.1/E2.2). Mellanledet vid fördelning visas bara
  // på nivå 1–6 (E1.3), därför distributionStep: false härifrån.
  {
    level: 7, name: "x i båda leden", typeB: 0.82, swapShare: 0.25,
    forms: { "ax=cx+d": 1, "ax+b=cx+d": 3 },
    params: { aMin: 2, aMax: 5, xMax: 10, bMax: 12 },
    rules: { operandX: true, distributionStep: false },
  },
  {
    level: 8, name: "Fler steg", typeB: 0.85, swapShare: 0.3,
    forms: { "ax+b=cx+d": 2, "ax-b=cx+d": 2, "ax+b=cx-d": 1 },
    params: { aMin: 2, aMax: 8, xMax: 12, bMax: 25 },
    rules: { operandX: true, distributionStep: false },
  },
  {
    level: 9, name: "Minustal på vägen", typeB: 0.88, swapShare: 0.5,
    forms: { "ax+b=cx+d": 2, "b-ax=c": 1, "b-ax=cx+d": 1, "ax-b=cx-d": 1 },
    params: { aMin: 2, aMax: 8, xMax: 12, bMax: 25 },
    rules: { operandX: true, allowNegative: true, distributionStep: false },
  },
  {
    level: 10, name: "Decimaler", typeB: 0.9, swapShare: 0.2,
    forms: { "dx=c": 1, "dx+b=c": 3, "ax+b=c:xdec": 2, "dx+b=ex+f": 2 },
    params: { aMin: 2, aMax: 6, xMax: 10, bMax: 20 },
    rules: { operandX: true, allowNegative: true, allowDecimals: true, operandDecimal: true, distributionStep: false },
  },
  {
    level: 11, name: "Svåra blandade", typeB: 0.92, swapShare: 0.35,
    forms: {
      "ax+b=cx+d": 2, "ax-b=cx+d": 2, "ax+b=cx-d": 1, "b-ax=cx+d": 1, "ax-b=cx-d": 1,
      "x/a+b=c": 1, "dx+b=c": 1, "ax+b=c:xdec": 1, "dx+b=ex+f": 1,
    },
    params: { aMin: 2, aMax: 9, xMax: 15, bMax: 40, quotientMax: 15 },
    rules: { operandX: true, allowNegative: true, allowDecimals: true, operandDecimal: true, distributionStep: false },
  },
  {
    // Tillämpning och problemlösning (E2.1). Här finns ekvationerna; texten
    // (verklighet → ekvation → lösning → svar) läggs på av problemlösnings-
    // typen. Formerna är de som brukar bära textuppgifter: påsar och lösa
    // (ax+b=c), två abonnemang (ax+b=cx+d), pris med decimaler (dx+b=c).
    level: 12, name: "Problemlösning", typeB: 0.95, swapShare: 0.15,
    forms: { "ax+b=c": 2, "ax-b=c": 1, "ax=cx+d": 1, "ax+b=cx+d": 2, "dx+b=c": 1 },
    params: { aMin: 2, aMax: 9, xMin: 2, xMax: 20, bMin: 2, bMax: 50 },
    rules: { operandX: true, allowNegative: true, allowDecimals: true, operandDecimal: true, distributionStep: false },
  },
]);

/**
 * Spärrar för extrautmaningarna (E2.6): bråk tillåtna (bara här), minustal,
 * decimaler och x-termer. Huvudprogressionen (nivå 1–12) använder aldrig dessa.
 */
export const EXTRA_RULES = Object.freeze({
  ...BASE_RULES,
  allowFractions: true,
  allowNegative: true,
  allowDecimals: true,
  operandX: true,
  operandDecimal: true,
  distributionStep: false,
});

export const LEVEL_MIN = 1;
export const LEVEL_MAX = LEVELS.length;

export function levelConfig(level) {
  const cfg = LEVELS.find((l) => l.level === level);
  if (!cfg) throw new RangeError(`Ekvationsresan: okänd nivå ${level}`);
  return cfg;
}

/** Spärrarna för en nivå (BASE_RULES + nivåns överskrivningar). */
export function rulesFor(level) {
  return Object.freeze({ ...BASE_RULES, ...(levelConfig(level).rules || {}) });
}

/** Spärrarna för en uppgift: extrautmaningar (task.extra, #627) har EXTRA_RULES. */
export function rulesForTask(task) {
  return task?.extra ? EXTRA_RULES : rulesFor(task.level);
}

/**
 * Extrautmaningarna (#627, spec E2.6): frivilliga, nås diskret från
 * nivåöversikten när eleven nått `minLevel` (huvudprogressionens maxLevel).
 * Påverkar aldrig nivån. `categories` = vikter för kategorierna i extra.js;
 * mynten per löst uppgift ligger i COINS.extraChallenge.
 */
export const EXTRA = Object.freeze({
  minLevel: 7,
  title: "Extrautmaningar",
  categories: Object.freeze({ negativ: 1, brak: 1, decimal: 1, parentes: 1, klurig: 1 }),
  names: Object.freeze({
    negativ: "Negativa x",
    brak: "Bråk",
    decimal: "Svårare decimaler",
    parentes: "Parenteser",
    klurig: "Kluriga",
  }),
  link: "✨ Extrautmaningar",
  linkHint: "Frivilligt – klurigare uppgifter för den som vill. Påverkar inte din nivå.",
  locked: (level) => `✨ Extrautmaningar öppnas när du nått nivå ${level}.`,
  back: (level) => `← Tillbaka till nivå ${level}`,
});

/** Elevens förklaring när ett drag spärras (E1.4). Spärrar räknas inte som drag. */
export const BLOCK_MESSAGES = Object.freeze({
  div0: "Man kan inte dela med noll.",
  mul0: "Om du gångrar med noll blir båda sidorna 0, och då försvinner x. Prova något annat!",
  fraction: "Det fungerar matematiskt, men då får du bråk. Prova ett annat drag!",
  negative: "Då blir det minustal. Prova ett annat drag!",
  tooBig: "Nu blir talen väldigt stora. Prova ett annat drag!",
  xProduct: "Då får du x gånger x. Prova att lägga till eller ta bort x i stället!",
});

/** Talfältets felmeddelanden (operand.js). */
export const OPERAND_MESSAGES = Object.freeze({
  empty: "Skriv ett tal, till exempel −4 eller /2.",
  noOp: "Välj + − · eller ÷ först, eller skriv tecknet före talet.",
  syntax: "Det där kan jag inte läsa. Skriv till exempel −4, +5, /2 eller *3.",
  xOff: "Här räknar du bara med tal.",
  decimalOff: "Här räknar du bara med heltal.",
  decimalMax: "Skriv högst två decimaler, till exempel 2,5 eller 0,25.",
  range: "Skriv ett tal mellan 1 och 999.",
});

// ---------------------------------------------------------------------------
//  Hjälp, stjärnor, anpassning och mynt (#616, spec E1.6, E1.7, E1.9, E1.10).
//  Alla trösklar och myntnivåer ligger här så att de kan finjusteras.
// ---------------------------------------------------------------------------

/** Hjälpen (E1.6): fyra steg. Erbjudandet visas efter optimalt + 6 drag. */
export const HELP = Object.freeze({
  steps: 4,
  offerAfterExtraMoves: 6,
  offerText: "Vill du ha hjälp eller se lösningen?",
});

/**
 * Stjärnor (E1.7). `extraMovesForTwo` = drag utöver optimalt som fortfarande
 * ger ⭐⭐. `helpCap` = högsta antal stjärnor efter ett visst hjälpsteg
 * (steg 1 är bara en fråga och kostar inget).
 */
export const STARS = Object.freeze({
  extraMovesForTwo: 2,
  helpCap: Object.freeze({ 0: 3, 1: 3, 2: 2, 3: 2, 4: 1 }),
});

/** Poäng per uppgift (E1.9) i TIONDELAR, så att summorna blir exakta (4,2 ≥ 4,0). */
export const STAR_POINTS10 = Object.freeze({ 3: 10, 2: 6, 1: 2, 0: 0 });

/**
 * Anpassning (E1.9). Upp om NÅGOT gäller: `upStreak` ⭐⭐⭐ i rad, ELLER summan
 * av de senaste `upShortCount` ≥ `upShortMin10`/10, ELLER summan av de senaste
 * `upLongCount` ≥ `upLongMin10`/10 (de två sista först efter `minTasks`). Ner om
 * summan av de senaste `downCount` ≤ `downMax10`/10 (efter `minTasks`).
 * Fönstret nollställs vid varje nivåändring.
 */
export const ADAPT = Object.freeze({
  upStreak: 4,
  upShortCount: 5,
  upShortMin10: 40,
  upLongCount: 10,
  upLongMin10: 70,
  downCount: 5,
  downMax10: 12,
  minTasks: 5,
  windowSize: 10,
});

/**
 * Mynt per löst uppgift (E1.10), oavsett stjärnor; "Visa lösningen" ger 0.
 * Nivå 7–12 och extrautmaningar är Etapp 2 men finns redan här.
 */
export const COINS = Object.freeze({
  byLevel: Object.freeze([
    { from: 1, to: 2, coins: 1 },
    { from: 3, to: 4, coins: 2 },
    { from: 5, to: 6, coins: 3 },
    { from: 7, to: 8, coins: 4 },
    { from: 9, to: 10, coins: 5 },
    { from: 11, to: 12, coins: 6 },
  ]),
  extraChallenge: 7,
});

/** Feedback efter en uppgift och efter ett giltigt men onödigt drag (E1.7). */
export const FEEDBACK = Object.freeze({
  three: (moves) => `Smart lösning! ${moves} drag, precis så kort kunde den lösas.`,
  twoMoves: (moves) => `Rätt! Du löste den på ${moves} drag. Kan du hitta en kortare väg?`,
  twoHelp: (moves) => `Rätt! ${moves} drag. Nästa gång klarar du den kanske med mindre hjälp.`,
  oneMoves: (moves) => `Du löste den på ${moves} drag. Bra kämpat! Finns det en kortare väg?`,
  oneHelp: () => "Du löste den med hjälp. Prova en liknande och se om du klarar den själv!",
  revealed: () => "Nu har du sett hur den kan lösas. Prova en ny!",
  moveSame: "Det fungerar, men ekvationen blev inte enklare än.",
  moveFurther: "Båda sidor är fortfarande lika. Finns det ett drag som får x närmare att bli ensamt?",
  retryButton: "FÖRSÖK IGEN FÖR ⭐⭐⭐",
});

// ---------------------------------------------------------------------------
//  Spelvyn (#618, spec E1.2, E1.9). Texter som eleven ser.
// ---------------------------------------------------------------------------

/** Nivå upp-skärmen (E1.9): en glad rad om vad eleven visat + vad som väntar. */
export const LEVEL_UP = Object.freeze({
  2: "Du kan hålla vågen i balans när du lägger till och tar bort. Nu ska du dela upp i lika stora grupper!",
  3: "Du kan få x ensamt i ett steg. Nu blir det två steg – vilket gör du först?",
  4: "Du löser tvåstegsekvationer. Nu kommer fler varianter, även med minus.",
  5: "Du har visat att du kan lösa tvåstegsekvationer självständigt. Nu blir ekvationerna lite klurigare…",
  6: "Du klarar stora tal också. Nu blandas allt – du får själv välja strategi.",
  7: "Du löser alla sorters tvåstegsekvationer. Nu står x på båda sidor – flytta x-en först!",
  8: "x på båda sidor klarar du. Nu blir det fler steg och minus i ekvationerna.",
  9: "Du väljer smarta vägar. Nu får det bli minustal på vägen – lösningen är ändå positiv.",
  10: "Minustal skrämmer dig inte. Nu kommer decimaltal, som 2,5x.",
  11: "Decimaler går också. Nu blandas allt svårt – välj själv hur du löser.",
  12: "Du löser svåra ekvationer på egen hand. Nu gör du ekvationer av verkliga problem!",
});

export const UI_TEXT = Object.freeze({
  instruction: "GÖR SAMMA SAK PÅ BÅDA SIDOR",
  revealConfirm: "Säker? Då räknas uppgiften som ej löst.",
  saveError: "Det gick inte att spara just nu. Din lösning syns ändå – fortsätt med nästa!",
  next: "NÄSTA UPPGIFT →",
  levelUpContinue: "FORTSÄTT →",
});
