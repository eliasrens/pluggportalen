// ============================================================================
// Pluggportalen – Matte­generator-adapter (issue #278)
// ----------------------------------------------------------------------------
// ARKITEKTUR-SÖMMEN mot klassrummattes räkne-generatorer. Hela epicen
// (mattegenerator med magma-stuk) hänger på att detta gränssnitt är rent:
// resten av appen får BARA importera de tre funktionerna härifrån.
//
//   generateProblem(topic, settings, seed) -> { problem, answer, variant }
//   listTopics()                           -> ["addition","subtraktion",…]
//   listVariants(topic)                    -> ["enkel","uppstallning",…]
//
// Allt annat – PluginManager, PluginUtils, BasePlugin, plugin-klasserna och
// slumpströmmen – är INMURAT i src/matte-generator/ (privata moduler). Inga
// globaler läcker ut, och inget av klassrummattes DOM-/render-/facit-lager
// portas.
//
// KÄLLA: https://eliasrens.github.io/klassrummatte/ (js/plugins/*.js). Där är
// koden globala klasser + Math.random(). Här är den ren ES-modul + en SEEDBAR
// PRNG (mulberry32, i linje med talsorter-seed-konventionen), så att samma
// (topic, settings, seed) alltid ger exakt samma tal. Ingen DOM, inga Firebase-
// anrop: ren beräkning in -> ut.
//
// OMFATTNING fas 1: addition, subtraktion, multiplikation, division. Wiring mot
// spellägen/områden görs i följd-issues (#2 och #3), inte här.
// ============================================================================

import { xmur3, mulberry32, setRng } from "./matte-generator/prng.js";
import { getPlugin } from "./matte-generator/plugins.js";

// ---------------------------------------------------------------------------
//  Varianter – appens rena vokabulär -> källans mode-inställningar
// ---------------------------------------------------------------------------
// Varje topic har en ordnad lista varianter. `force` är de settings som TVINGAR
// generate() till den grenen (en enda mode i arrayen → pickRandom blir
// deterministisk). `minGrade` säkrar att generate():s åldersfilter inte tyst
// faller tillbaka till "enkel" (decimaler kräver t.ex. åk 4). Första varianten
// i listan är default när ingen variant anges.

const VARIANTS = {
  addition: [
    { name: 'enkel',        force: { addSubMode: ['standard'] } },
    { name: 'uppstallning', force: { addSubMode: ['uppstallning'] }, minGrade: 2 },
    { name: 'flersteg',     force: { addSubMode: ['flersteg'] },     minGrade: 3 },
    { name: 'decimaler',    force: { addSubMode: ['decimaler'] },    minGrade: 4 },
  ],
  subtraktion: [
    { name: 'enkel',        force: { addSubMode: ['standard'] } },
    { name: 'uppstallning', force: { addSubMode: ['uppstallning'] }, minGrade: 2 },
    { name: 'decimaler',    force: { addSubMode: ['decimaler'] },    minGrade: 4 },
  ],
  multiplikation: [
    { name: 'tabeller',  force: { multDivMode: ['tables-basic'] } },
    { name: 'tiopotens', force: { multDivMode: ['tables-ten'] } },
    { name: 'stora-tal', force: { multDivMode: ['tables-large'] } },
    { name: 'dubbelt',   force: { multDivMode: ['double-half'] } },
    { name: 'bild',      force: { multDivMode: ['bild-mult'] } },
    { name: 'decimaler', force: { multDivMode: ['decimaler'] }, minGrade: 4 },
  ],
  division: [
    { name: 'tabeller',  force: { multDivMode: ['tables-basic'] },                    minGrade: 2 },
    { name: 'rest',      force: { multDivMode: ['tables-basic'], divisionRest: true }, minGrade: 2 },
    { name: 'tiopotens', force: { multDivMode: ['tables-ten'] },                      minGrade: 2 },
    { name: 'stora-tal', force: { multDivMode: ['tables-large'] },                    minGrade: 2 },
    { name: 'halften',   force: { multDivMode: ['double-half'] },                     minGrade: 2 },
    { name: 'decimaler', force: { multDivMode: ['decimaler'] },                       minGrade: 4 },
  ],
};

const DEFAULT_GRADE = 4; // åk 4 – projektets målgrupp.

// Läsbar operator-symbol för problem.text (källans operator kan vara 'division').
const OP_SYMBOL = { '+': '+', '−': '−', '-': '−', '·': '·', '*': '·', '×': '·', '÷': '÷', 'division': '÷', '/': '÷' };

/** Kort, deterministisk uppgiftstext för enkel visning nedströms. */
function problemText(p) {
  if (p.questionText) return p.questionText;
  const op = OP_SYMBOL[p.operator] || p.operator;
  if (p.mode === 'flersteg') return `${p.a} + ${p.b} + ${p.c}`;
  return `${p.a} ${op} ${p.b}`;
}

// ---------------------------------------------------------------------------
//  Publikt gränssnitt – DET ENDA resten av appen får se
// ---------------------------------------------------------------------------

/** Alla topics som fas 1 stödjer, i visningsordning. */
export function listTopics() {
  return ['addition', 'subtraktion', 'multiplikation', 'division'];
}

/** Variantnamnen för ett topic (tom array för okänt topic). */
export function listVariants(topic) {
  return (VARIANTS[topic] || []).map(v => v.name);
}

/**
 * Generera EN uppgift, deterministiskt ur (topic, settings, seed).
 *
 * @param {string} topic      – ett av listTopics().
 * @param {object} [settings] – { grade?, variant?, addSubVaxling?, specificTables?, … }.
 *                              `variant` väljer gren (se listVariants); utelämnad
 *                              → första varianten. Övriga fält skickas vidare
 *                              till generatorn (grade default åk 4).
 * @param {number} [seed]     – heltalsfrö. Samma (topic, settings, seed) → samma tal.
 * @returns {{ problem: object, answer: number, variant: string }}
 */
export function generateProblem(topic, settings = {}, seed = 0) {
  const plugin = getPlugin(topic);
  if (!plugin) throw new Error(`Okänt topic: ${topic}`);

  const variants = VARIANTS[topic];
  const chosen = variants.find(v => v.name === settings.variant) || variants[0];

  // Sätt frö INNAN generate() körs: all slump dras ur denna ström.
  const seedFn = xmur3(`${topic}|${JSON.stringify(settings)}|${seed}`);
  const prev = setRng(mulberry32(seedFn()));
  try {
    // Bygg settings: default-årskurs, anropar-settings, sedan variantens
    // tvingande mode-fält. minGrade lyfter årskursen så varianten inte tyst
    // filtreras bort till "enkel".
    const grade = Math.max(settings.grade || DEFAULT_GRADE, chosen.minGrade || 0);
    const merged = { ...settings, grade, ...chosen.force };
    delete merged.variant;

    const raw = plugin.generate(merged);
    const { answer, ...rest } = raw;
    rest.text = problemText(raw);
    return { problem: rest, answer, variant: chosen.name };
  } finally {
    setRng(prev); // återställ – läck aldrig strömmen mellan anrop.
  }
}
