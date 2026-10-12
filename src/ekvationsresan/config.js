// ============================================================================
// Ekvationsresan – konfiguration (src/ekvationsresan/config.js) · #615
// ----------------------------------------------------------------------------
// Nivåer, spärrar och texter på ETT ställe, så att de kan finjusteras utan att
// logiken rörs. Etapp 2 lägger till nivå 7–12 genom att utöka LEVELS (och
// FORMS i forms.js) – spärrarna är redan per nivå (t.ex. allowNegative från
// nivå 9, allowDecimals från nivå 10, operandX från nivå 7).
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
]);

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
  range: "Skriv ett tal mellan 1 och 999.",
});
