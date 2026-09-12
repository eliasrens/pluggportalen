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

  // ── FAS 2 (issue #295): resterande klassrummatte-plugins ──────────────────
  // Nyckelordningen HÄR = registry-ordningen i plugins.js (talserie → aritmetik
  // → mått → visuella). listTopics()/listVariants() speglar det. `force` sätter
  // settings.variantType (som de portade generate() läser) så varje variant blir
  // en enda deterministisk gren. answerType-/spelbarhet styrs av TOPIC_META nedan,
  // INTE av den här tabellen (som bara håller motor-force/minGrade).

  // Talförståelse
  tallinje:     [{ name: 'enkel', force: {} }],
  talfoljd:     [
    { name: 'nasta',  force: { variantType: 'next' } },
    { name: 'saknas', force: { variantType: 'missing' } },
    { name: 'regel',  force: { variantType: 'rule' }, minGrade: 3 },
  ],
  'negativa-tal': [
    { name: 'temperatur', force: { variantType: 'temp' },     minGrade: 5 },
    { name: 'rakna',      force: { variantType: 'add-sub' },  minGrade: 5 },
    { name: 'tallinje',   force: { variantType: 'tallinje' }, minGrade: 5 },
  ],
  talsorter:    [{ name: 'talsort', force: {} }],
  romerska:     [
    { name: 'till-tal',      force: { variantType: 'roman-to-arabic' }, minGrade: 4 },
    { name: 'till-romerska', force: { variantType: 'arabic-to-roman' }, minGrade: 4 },
  ],

  // Aritmetik-utökningar
  procent: [
    { name: 'av-heltal',    force: { variantType: 'pct-of-whole' }, minGrade: 4 },
    { name: 'omvandla',     force: { variantType: 'pct-to-frac' },  minGrade: 4 },
    { name: 'del-i-procent', force: { variantType: 'part-to-pct' }, minGrade: 5 },
    { name: 'baklanges',    force: { variantType: 'reverse-pct' },  minGrade: 6 },
  ],
  avrundning: [
    { name: 'tiotal',    force: { variantType: 'round-ten' } },
    { name: 'hundratal', force: { variantType: 'round-hundred' } },
    { name: 'uppskatta', force: { variantType: 'estimate-sum' }, minGrade: 3 },
  ],
  prioritet: [
    { name: 'utan-parentes', force: { variantType: 'utan-parentes' } },
    { name: 'med-parentes',  force: { variantType: 'med-parentes' }, minGrade: 5 },
  ],
  'oppna-utsaga': [
    { name: 'addition',       force: { variantType: 'add' } },
    { name: 'subtraktion',    force: { variantType: 'sub' } },
    { name: 'multiplikation', force: { variantType: 'mult' }, minGrade: 2 },
    { name: 'division',       force: { variantType: 'div' },  minGrade: 3 },
  ],
  ekvationer: [
    { name: 'enstegs',  force: { variantType: 'enstegs' },  minGrade: 3 },
    { name: 'tvastegs', force: { variantType: 'tvastegs' }, minGrade: 5 },
    { name: 'geometri', force: { variantType: 'geometri' }, minGrade: 4 },
  ],

  // Mått
  'matt-langd': [{ name: 'omvandla', force: {} }],
  'matt-vikt':  [{ name: 'omvandla', force: {} }],
  'matt-tid':   [{ name: 'omvandla', force: {} }],
  'matt-area':  [{ name: 'omvandla', force: {}, minGrade: 4 }],
  'matt-volym': [
    { name: 'omvandla',    force: { variantType: 'convert' } },
    { name: 'addition',    force: { variantType: 'addition' } },
    { name: 'subtraktion', force: { variantType: 'subtraction' } },
    { name: 'oppen',       force: { variantType: 'open' } },
  ],

  // Visuella / icke-numeriska (porterade + testade, EJ spelbara i räkna – se TOPIC_META)
  sannolikhet: [
    { name: 'brakform', force: { variantType: 'frac' },    minGrade: 5 },
    { name: 'ord',      force: { variantType: 'word' },    minGrade: 5 },
    { name: 'jamfor',   force: { variantType: 'compare' }, minGrade: 5 },
  ],
  statistik: [
    { name: 'las-av',     force: { variantType: 'read-val' }, minGrade: 4 },
    { name: 'flest',      force: { variantType: 'most' },     minGrade: 4 },
    { name: 'minst',      force: { variantType: 'least' },    minGrade: 4 },
    { name: 'skillnad',   force: { variantType: 'diff' },     minGrade: 4 },
    { name: 'medelvarde', force: { variantType: 'mean' },     minGrade: 5 },
    { name: 'typvarde',   force: { variantType: 'mode' },     minGrade: 5 },
    { name: 'median',     force: { variantType: 'median' },   minGrade: 6 },
  ],
  koordinatsystem: [
    { name: 'forsta-kvadrant',  force: { variantType: 'forsta-kvadrant' },  minGrade: 4 },
    { name: 'alla-kvadranter',  force: { variantType: 'alla-kvadranter' },  minGrade: 6 },
  ],
  klocka: [
    { name: 'las-av',   force: { variantType: 'read' } },
    { name: 'senare',   force: { variantType: 'add-minutes' } },
    { name: 'skillnad', force: { variantType: 'diff' }, minGrade: 3 },
  ],
  geometri: [
    { name: 'area-kvadrat',          force: { geometriTypes: ['area'],      variantType: 'square' } },
    { name: 'omkrets-rektangel',     force: { geometriTypes: ['perimeter'], variantType: 'rectangle' } },
    { name: 'area-triangel',         force: { geometriTypes: ['area'],      variantType: 'triangle' },       minGrade: 5 },
    { name: 'cirkel',                force: { geometriTypes: ['area'],      variantType: 'circle' },         minGrade: 6 },
    { name: 'vinkel-typ',            force: { geometriTypes: ['vinklar'],   variantType: 'angle' },          minGrade: 4 },
    { name: 'vinkelsumma',           force: { geometriTypes: ['vinklar'],   variantType: 'angle-sum' },      minGrade: 5 },
    { name: 'vinkelsumma-fyrhorning', force: { geometriTypes: ['vinklar'],  variantType: 'angle-sum-quad' }, minGrade: 5 },
    { name: 'kropp',                 force: { geometriTypes: ['kropp'],     variantType: 'kropp' },          minGrade: 3 },
    { name: 'klassificering',        force: { geometriTypes: ['klassificering'], variantType: 'classify' },  minGrade: 4 },
    { name: 'ratblock-volym',        force: { geometriTypes: ['volym'],     variantType: 'cuboid' },         minGrade: 5 },
  ],
  symmetri: [
    { name: 'antal-linjer',   force: { variantType: 'count' } },
    { name: 'ej-symmetrisk',  force: { variantType: 'identify-non-sym' } },
  ],
  monster: [
    { name: 'upprepa-figur', force: { variantType: 'repeat-shape' } },
    { name: 'upprepa-farg',  force: { variantType: 'repeat-color' } },
    { name: 'vaxande',       force: { variantType: 'growing' }, minGrade: 3 },
  ],
  brak: [
    { name: 'namnge',            force: { variantType: 'name' },              minGrade: 3 },
    { name: 'ordna-lika',        force: { variantType: 'order-same-den' },    minGrade: 3 },
    { name: 'ordna-olika',       force: { variantType: 'order-diff-den' },    minGrade: 3 },
    { name: 'addition-lika',     force: { variantType: 'add-same-den' },      minGrade: 4 },
    { name: 'subtraktion-lika',  force: { variantType: 'sub-same-den' },      minGrade: 4 },
    { name: 'jamfor',            force: { variantType: 'compare' },           minGrade: 4 },
    { name: 'forenkla',          force: { variantType: 'simplify' },          minGrade: 4 },
    { name: 'brak-av-heltal',    force: { variantType: 'fraction-of-whole' }, minGrade: 4 },
    { name: 'addition-olika',    force: { variantType: 'add-diff-den' },      minGrade: 5 },
    { name: 'subtraktion-olika', force: { variantType: 'sub-diff-den' },      minGrade: 5 },
    { name: 'blandat-tal',       force: { variantType: 'to-mixed' },          minGrade: 6 },
  ],
};

// ---------------------------------------------------------------------------
//  SVARSTYPER & SPELBARHET (issue #295-kravet)
// ---------------------------------------------------------------------------
// Varje topic har en answerType. Räkna-läget (#280) rättar NUMERISKA svar; därför
// surfar bara topics vars uppgift är självbärande (frågan syns i texten) OCH ger
// ett otvetydigt numeriskt svar (playable:true). Övriga porteras & enhetstestas men
// exponeras inte i räkna än – de behöver visuell rendering (klocka=urtavla,
// koordinatsystem=rutnät, geometri=figur, statistik=diagram, sannolikhet=kulpåse,
// symmetri/mönster=figur) eller egen svarswidget (bråk=bråkform, talsorter=markerad
// siffra). Dokumenterat val enligt issue-alternativ (b).
const TOPIC_META = {
  addition:        { answerType: 'numeric', playable: true },
  subtraktion:     { answerType: 'numeric', playable: true },
  multiplikation:  { answerType: 'numeric', playable: true },
  division:        { answerType: 'numeric', playable: true },
  tallinje:        { answerType: 'numeric', playable: true },
  talfoljd:        { answerType: 'numeric', playable: true },
  'negativa-tal':  { answerType: 'numeric', playable: true },
  talsorter:       { answerType: 'text',    playable: false },
  romerska:        { answerType: 'numeric', playable: true },
  procent:         { answerType: 'numeric', playable: true },
  avrundning:      { answerType: 'numeric', playable: true },
  prioritet:       { answerType: 'numeric', playable: true },
  'oppna-utsaga':  { answerType: 'numeric', playable: true },
  ekvationer:      { answerType: 'numeric', playable: true },
  'matt-langd':    { answerType: 'numeric', playable: true },
  'matt-vikt':     { answerType: 'numeric', playable: true },
  'matt-tid':      { answerType: 'numeric', playable: true },
  'matt-area':     { answerType: 'numeric', playable: true },
  'matt-volym':    { answerType: 'numeric', playable: true },
  sannolikhet:     { answerType: 'fraction', playable: false },
  statistik:       { answerType: 'text',     playable: false },
  koordinatsystem: { answerType: 'coord',    playable: false },
  klocka:          { answerType: 'time',     playable: false },
  geometri:        { answerType: 'text',     playable: false },
  symmetri:        { answerType: 'text',     playable: false },
  monster:         { answerType: 'text',     playable: false },
  brak:            { answerType: 'fraction', playable: false },
};

// Bara de spelbara varianterna surfas för räkna-läget. För spelbara topics är
// ALLA listade varianter spelbara UTOM de här (som porteras men ger icke-numeriskt/
// icke-självbärande svar). Räkna-katalogen (exercise-types.js) speglar exakt detta.
const NON_PLAYABLE_VARIANTS = {
  talfoljd:       new Set(['regel']),          // regel = text ("× 2")
  'negativa-tal': new Set(['tallinje']),       // kräver SVG-tallinje
  romerska:       new Set(['till-romerska']),  // svar = romersk sträng
  procent:        new Set(['omvandla', 'del-i-procent', 'baklanges']), // bråk/%/kr-svar
  avrundning:     new Set(['uppskatta']),      // uppskattning = diskutabel exakthet
};

const DEFAULT_GRADE = 4; // åk 4 – projektets målgrupp.

// Läsbar operator-symbol för problem.text (källans operator kan vara 'division').
const OP_SYMBOL = { '+': '+', '−': '−', '-': '−', '·': '·', '*': '·', '×': '·', '÷': '÷', 'division': '÷', '/': '÷' };

/** Kort, deterministisk uppgiftstext för enkel visning nedströms. */
function problemText(p) {
  if (p.text) return p.text;               // fas 2-plugins sätter en färdig prompt
  if (p.questionText) return p.questionText;
  const op = OP_SYMBOL[p.operator] || p.operator;
  if (p.mode === 'flersteg') return `${p.a} + ${p.b} + ${p.c}`;
  return `${p.a} ${op} ${p.b}`;
}

/** De varianter av ett topic som räkna-läget kan visa & rätta (spelbara). */
function surfacedVariants(topic) {
  const meta = TOPIC_META[topic];
  if (!meta || !meta.playable) return [];
  const skip = NON_PLAYABLE_VARIANTS[topic];
  return (VARIANTS[topic] || []).map(v => v.name).filter(n => !skip || !skip.has(n));
}

// ---------------------------------------------------------------------------
//  Publikt gränssnitt – DET ENDA resten av appen får se
// ---------------------------------------------------------------------------

/**
 * Topics som räkna-läget SURFAR (spelbara: självbärande + numeriskt svar), i
 * registry-/visningsordning. Räkna-katalogen (exercise-types.js) speglar detta.
 */
export function listTopics() {
  return Object.keys(VARIANTS).filter(t => TOPIC_META[t]?.playable);
}

/** ALLA portade topics (spelbara + visuella/icke-numeriska), i registry-ordning. */
export function listAllTopics() {
  return Object.keys(VARIANTS);
}

/** De spelbara variantnamnen för ett topic (tom för okänt/icke-spelbart topic). */
export function listVariants(topic) {
  return surfacedVariants(topic);
}

/** ALLA variantnamn för ett topic (inkl. icke-spelbara), tom för okänt topic. */
export function listAllVariants(topic) {
  return (VARIANTS[topic] || []).map(v => v.name);
}

/** Svarstyp för ett topic: 'numeric' | 'text' | 'fraction' | 'coord' | 'time'. */
export function topicAnswerType(topic) {
  return TOPIC_META[topic]?.answerType || null;
}

/** Kan räkna-läget visa & rätta detta topic (numeriskt, självbärande svar)? */
export function isTopicPlayable(topic) {
  return TOPIC_META[topic]?.playable === true;
}

/**
 * Generera EN uppgift, deterministiskt ur (topic, settings, seed).
 *
 * @param {string} topic      – ett av listTopics()/listAllTopics().
 * @param {object} [settings] – { grade?, variant?, … }. `variant` väljer gren (se
 *                              listVariants/listAllVariants); utelämnad → första
 *                              varianten. Övriga fält skickas vidare (grade default åk 4).
 * @param {number} [seed]     – heltalsfrö. Samma (topic, settings, seed) → samma tal.
 * @returns {{ problem: object, answer: (number|string), variant: string }}
 *          problem.answerType säger hur `answer` ska tolkas/rättas.
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
    // filtreras bort.
    const grade = Math.max(settings.grade || DEFAULT_GRADE, chosen.minGrade || 0);
    const merged = { ...settings, grade, ...chosen.force };
    delete merged.variant;

    const raw = plugin.generate(merged);
    const { answer, ...rest } = raw;
    rest.text = problemText(raw);
    rest.answerType = TOPIC_META[topic]?.answerType || 'numeric';
    return { problem: rest, answer, variant: chosen.name };
  } finally {
    setRng(prev); // återställ – läck aldrig strömmen mellan anrop.
  }
}
