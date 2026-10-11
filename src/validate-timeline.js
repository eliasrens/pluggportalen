// ============================================================================
// Pluggporten – validering av tidslinjefrågor (validate-timeline.js)
// ----------------------------------------------------------------------------
// Epic #595 / issue #596 (Tidsjakten). Ett område kan ha en lista historiska
// händelser som eleven placerar på en tidslinje genom att dra en markör till ett
// årtal. Samma lista används av Tidsjakten, Quiz, Guldrushen och Snilleblixten –
// EN lagring per händelse, inga kopior per läge:
//
//   area.timeline[]    = { id, event, question, year, description, explanation }
//   area.timelineSpan? = { from, to }   (valfritt tidsspann för linjen)
//
// "year" är ett heltal; negativt = f.Kr. (−500 = 500 f.Kr.). "description" visas
// FÖRE svaret och får därför inte avslöja årtalet; "explanation" visas efter.
//
// Bor utanför den statiska bootgrafen (nås via validate.js/merge-area.js/
// prompt-parts.js, som alla laddas lat från lärarsidan) – se #271.
// ============================================================================

/** Antal händelser läraren kan be AI:n om (samma steg som frågeantalen i spec). */
export const TIMELINE_COUNTS = [5, 10, 15, 20];

/** Rimliga gränser för ett årtal (förhistoria ↔ nutid). */
export const TIMELINE_MIN_YEAR = -100000;
export const TIMELINE_MAX_YEAR = 2100;

/**
 * Lärarens valda antal händelser, eller null (osatt/okänt → AI:n skalar efter
 * materialet).
 * @param {*} n
 * @returns {number|null}
 */
export function normalizeTimelineCount(n) {
  const v = Number(n);
  return TIMELINE_COUNTS.includes(v) ? v : null;
}

/**
 * Tolka ett årtal: heltal (eller en sträng med bara ett heltal, t.ex. "1520"
 * från en AI) inom gränserna. Allt annat → null.
 * @param {*} raw
 * @returns {number|null}
 */
export function parseYear(raw) {
  let v = raw;
  if (typeof v === "string" && /^\s*-?\d+\s*$/.test(v)) v = Number(v);
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  return v >= TIMELINE_MIN_YEAR && v <= TIMELINE_MAX_YEAR ? v : null;
}

/** "1520" eller "500 f.Kr." – för felmeddelanden och prompter. */
export function formatYear(year) {
  return year < 0 ? `${-year} f.Kr.` : String(year);
}

/**
 * Nämner texten årtalet? Söker årtalets siffror som fristående tal (inte del av
 * ett längre tal), så "1520" träffar "år 1520" men inte "15200". Årtal under 100
 * kontrolleras inte – korta tal ("30 soldater") ger annars falsklarm.
 * @param {string} text
 * @param {number} year
 * @returns {boolean}
 */
export function revealsYear(text, year) {
  const digits = String(Math.abs(year));
  if (digits.length < 3) return false;
  return new RegExp(`(^|[^0-9])${digits}([^0-9]|$)`).test(String(text || ""));
}

/**
 * Dubblettnyckel för en händelse: händelsens namn (gemener, hopslagna blanksteg)
 * + år. Används av valideringen (inom en lista) och merge-area.js (mot befintligt).
 */
export function timelineKey(e) {
  const name = String(e?.event || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${name}\u0000${e?.year}`;
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

function slug(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Validera områdets tidsspann { from, to } (valfritt). Returnerar null när det
 * saknas; fel läggs i `errors`.
 */
function readSpan(raw, errors) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push('Fältet "timelineSpan" måste vara ett objekt { "from": år, "to": år } (eller utelämnas).');
    return null;
  }
  const from = parseYear(raw.from);
  const to = parseYear(raw.to);
  if (from === null || to === null) {
    errors.push('"timelineSpan": "from" och "to" måste vara heltalsår (negativt = f.Kr.).');
    return null;
  }
  if (from >= to) {
    errors.push(`"timelineSpan": "from" (${formatYear(from)}) måste vara tidigare än "to" (${formatYear(to)}).`);
    return null;
  }
  return { from, to };
}

/**
 * Validera och normalisera ett områdes tidslinjefrågor. Fel (blockerar) läggs i
 * `errors`, anmärkningar (blockerar inte) i `warnings`.
 *
 * Regler: "event", "question" och "year" är obligatoriska; "year" är ett heltal.
 * Varken händelsen, frågan eller beskrivningen får innehålla årtalet (då är
 * svaret avslöjat). Saknad beskrivning/förklaring är en varning. Samma händelse
 * + år två gånger tas bara med en gång (varning). Ett satt tidsspann måste
 * rymma alla händelser.
 *
 * @param {object} obj – områdes-JSON:en (läser obj.timeline + obj.timelineSpan).
 * @param {string[]} errors
 * @param {string[]} warnings
 * @returns {{ timeline: object[], timelineSpan: {from:number,to:number}|null }}
 */
export function validateTimeline(obj, errors, warnings) {
  const timeline = [];
  const timelineSpan = readSpan(obj?.timelineSpan, errors);
  const raw = obj?.timeline;
  if (raw === undefined || raw === null) return { timeline, timelineSpan };
  if (!Array.isArray(raw)) {
    errors.push('Fältet "timeline" måste vara en lista [ ... ].');
    return { timeline, timelineSpan };
  }

  const seen = new Set();
  const usedIds = new Set();
  raw.forEach((e, i) => {
    const nr = i + 1;
    const where = `Tidslinjehändelse ${nr}`;
    if (e === null || typeof e !== "object" || Array.isArray(e)) {
      errors.push(`${where}: måste vara ett objekt med "event", "question" och "year".`);
      return;
    }
    const event = str(e.event);
    const question = str(e.question);
    const description = str(e.description);
    const explanation = str(e.explanation);
    const year = parseYear(e.year);
    if (!event) errors.push(`${where}: "event" (händelsens namn) saknas eller är tomt.`);
    if (!question) errors.push(`${where}: "question" (frågan) saknas eller är tom.`);
    if (year === null) {
      errors.push(
        `${where}: "year" måste vara ett heltal mellan ${TIMELINE_MIN_YEAR} och ${TIMELINE_MAX_YEAR} (t.ex. 1520; negativt = f.Kr.).`
      );
      return;
    }
    for (const [field, text] of [["event", event], ["question", question], ["description", description]]) {
      if (revealsYear(text, year)) {
        errors.push(`${where}: "${field}" avslöjar årtalet ${formatYear(year)} – skriv om utan årtalet.`);
      }
    }
    if (!description) warnings.push(`${where}: "description" saknas – eleven får ingen ledtråd om händelsen.`);
    if (!explanation) warnings.push(`${where}: "explanation" saknas – ingen förklaring visas efter svaret.`);
    if (timelineSpan && (year < timelineSpan.from || year > timelineSpan.to)) {
      errors.push(
        `${where}: året ${formatYear(year)} ligger utanför tidsspannet ${formatYear(timelineSpan.from)}–${formatYear(timelineSpan.to)}.`
      );
    }

    const key = timelineKey({ event, year });
    if (event && seen.has(key)) {
      warnings.push(`${where}: "${event}" (${formatYear(year)}) finns redan i listan och hoppas över.`);
      return;
    }
    seen.add(key);

    let id = slug(e.id) || `e${nr}`;
    for (let n = nr; usedIds.has(id); n++) id = `e${n + 1}`;
    usedIds.add(id);
    timeline.push({ id, event, question, year, description, explanation });
  });
  return { timeline, timelineSpan };
}

/**
 * Tidsspann för ett område: lärarens/AI:ns timelineSpan om det finns, annars
 * null. (Den interaktiva komponenten, #597, härleder ett spann med marginal ur
 * händelserna när det saknas – aldrig centrerat på ett svar.)
 * @param {object} area
 */
export function areaTimelineSpan(area) {
  const errors = [];
  return readSpan(area?.timelineSpan, errors);
}
