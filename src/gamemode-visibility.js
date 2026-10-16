// ============================================================================
// Pluggporten – gamemode-katalog + synliga lägen per område (gamemode-visibility.js)
// ----------------------------------------------------------------------------
// Här bor GAMEMODES (metadata för elevens spellägen) samt logiken för vilka
// lägen som ska visas för ett arbetsområde. Läraren kan bocka i/ur vilka lägen
// som syns PER område (issue #200); valet lagras på området i fältet
// "hiddenModes": en lista med mode-id som ska DÖLJAS i elevvyn.
//
//   • Bakåtkompatibelt: saknas fältet (eller är listan tom) visas alla
//     tillgängliga lägen precis som förr.
//   • Ett läge kan bara spelas/bockas om området har underlag för det
//     (has[gm.needs]) – ett läge utan innehåll kan inte tvingas på.
//
// Modulen hålls browser-fri (bara sanningsjakt-content.js, som också är rent)
// så den kan enhetstestas i Node och importeras av validate.js utan att dra in
// spelmoduler (ui/fx/data). game-shared.js re-exporterar allt härifrån.
// ============================================================================

import { hasSanningsjaktContent } from "./sanningsjakt-content.js";
import { hasGeneratorContent } from "./exercise-types.js";
import { ADVENTURE_THEME_META } from "./adventure/themes/meta.js";

// Metadata för gamemodes: ordning, namn, ikon, färg och vilket innehåll de kräver.
export const GAMEMODES = [
  { id: "lasforstaelse", name: "Läsförståelse", emoji: "📖", color: "bla",
    sub: "Läs en text och svara på frågor", needs: "quiz" },
  { id: "para", name: "Para ihop", emoji: "🧩", color: "gron",
    sub: "Matcha begrepp med förklaring", needs: "pairs" },
  { id: "quiz", name: "Quiz", emoji: "❓", color: "orange",
    sub: "Flervalsfrågor med direkt svar", needs: "quiz" },
  // Tidsjakten (#599): dra en markör till rätt årtal. Tänds av area.timeline
  // (samma händelser som tidslinjefrågorna i Quiz). Felpoäng = års avvikelse.
  { id: "tidsjakt", name: "Tidsjakten", emoji: "⏳", color: "bla",
    sub: "Dra till rätt årtal – så få felpoäng som möjligt", needs: "timeline" },
  { id: "kunskapsjakt", name: "Kunskapsjakt", emoji: "⚡", color: "rosa",
    sub: "Snabba frågor på tid – bygg combo!", needs: "quiz" },
  { id: "sanningsjakt", name: "Fånga sanningar", emoji: "🙌", color: "orange",
    sub: "Fånga de sanna påståendena – undvik de falska!", needs: "sanningsjakt" },
  // noStars: Memory är turbaserat och ger aldrig stjärnor (#467, areaStarModes).
  { id: "memory", name: "Memory", emoji: "🃏", color: "lila",
    sub: "Hitta fakta-paren", needs: "pairs", noStars: true },
  // Räkna-läget (issue #279/#3): tänds BARA av ett generator-område (area.generator).
  // Kräver alltså varken quiz eller par – och ett rent generator-område tänder i sin
  // tur inte quiz/par/läs-lägena. Själva spelet byggs i #3; här pekar bara gaten ut det.
  { id: "rakna", name: "Räkna", emoji: "🔢", color: "orange",
    sub: "Räkna ut svaret på genererade tal", needs: "generator" },
  // Ämnesläsning (#672, docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md): Läsresans läsvy
  // på områdets egna texter (area.readingTexts), i alla ämnen. Tänds bara av
  // readingTexts – ett område kan ha enbart ämnestexter (§6.4). Inga stjärnor:
  // belöningen är mynt och den delade läsnivån. Spelet laddas dynamiskt.
  { id: "amneslasning", name: "Ämnesläsning", emoji: "📖", color: "lila",
    sub: "Läs texter om området och svara på frågor", needs: "readingTexts", noStars: true },
];

// Frågekälla (questionKind) → innehållsflagga den drar från. Samma mappning som
// gamemodes.js (KIND_NEEDS) så kort-låset och synlighetsgaten är exakt lika.
// "generator" (#296): ett äventyr kan köras på ett generator-område (genererade tal
// + svarsfält) → temat är tillgängligt om området har generator-underlag.
const ADVENTURE_KIND_NEEDS = { quiz: "quiz", lasforstaelse: "quiz", para: "pairs", generator: "generator" };

// Äventyrs-temana som spellägen i synlighetslistan, nyckelade "aventyr:<id>".
// Härleds GENERISKT ur den lätta metadatan (adventure/themes/meta.js) så nya
// teman dyker upp automatiskt UTAN att den browser-fria modulen drar in
// temagrafiken. Till skillnad från vanliga lägen (ett enda `needs`) kan ett tema
// använda FLERA frågekällor: `needsAny` = tillgängligt om NÅGON flagga har underlag.
export const ADVENTURE_MODES = ADVENTURE_THEME_META.map((t) => ({
  id: `aventyr:${t.id}`,
  name: `Äventyr: ${t.namn}`,
  emoji: t.emoji,
  color: "orange",
  sub: "Äventyrsspel på området",
  needsAny: [...new Set((t.needs || []).map((k) => ADVENTURE_KIND_NEEDS[k]).filter(Boolean))],
}));

// Hela lägeskatalogen som lärarens synlighets-kryssrutor byggs ur: de vanliga
// lägena + äventyrs-temana. Elevens vanliga kort använder GAMEMODES separat
// (gamemodes.js), och äventyrskorten byggs ur tema-registret – den här listan är
// synlighets-UI:ts källa.
export const ALL_MODES = [...GAMEMODES, ...ADVENTURE_MODES];

/**
 * Har området underlag för läget? Vanliga lägen har ett enda `needs`-flaggnamn;
 * äventyrs-teman har `needsAny` (tillgängligt om NÅGON av flaggorna finns).
 * @param {object} mode – post ur ALL_MODES
 * @param {object} has – areaContentFlags(area)
 * @returns {boolean}
 */
function modeAvailable(mode, has) {
  if (Array.isArray(mode.needsAny)) return mode.needsAny.some((k) => has[k]);
  return !!has[mode.needs];
}

/**
 * Rensa en lista med dolda mode-id: behåll bara icke-tomma strängar, trimmade,
 * utan dubbletter, i ordningen de kom in. Ogiltig indata ger en tom lista.
 * Okända id filtreras INTE bort här (validate.js känner inte spelkatalogen) –
 * de matchar helt enkelt inget läge och är därför ofarliga.
 * @param {*} v
 * @returns {string[]}
 */
export function normalizeHiddenModes(v) {
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(v) ? v : []) {
    const s = String(m == null ? "" : m).trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Är läget `modeId` urbockat (dolt) för området?
 * @param {object} area – arbetsområde (kan sakna hiddenModes)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHidden(area, modeId) {
  return normalizeHiddenModes(area?.hiddenModes).includes(modeId);
}

/**
 * Vilket innehåll ett område HAR underlag för, nyckelat på GAMEMODES `needs`.
 * Ett läge kan bara spelas (och bockas i/ur) om områdets flagga här är sann.
 * Delas av elevvyn och lärar-UI:t så gaten är exakt densamma på båda hållen.
 * @param {object} area
 * @returns {{quiz:boolean, pairs:boolean, sanningsjakt:boolean, generator:boolean, timeline:boolean, readingTexts:boolean}}
 */
export function areaContentFlags(area) {
  return {
    quiz: Array.isArray(area?.quiz) && area.quiz.length > 0,
    pairs: Array.isArray(area?.pairs) && area.pairs.length > 0,
    // Arkad-läget kan härleda påståenden ur par (minst 2) eller quiz.
    sanningsjakt: hasSanningsjaktContent(area),
    // Räkna-läget (issue #279): tänds av ett giltigt generator-område (topic +
    // varianter). Egen väg – helt frikopplad från quiz/par ovan.
    generator: hasGeneratorContent(area),
    // Tidsjakten (#599): minst en händelse i area.timeline.
    timeline: Array.isArray(area?.timeline) && area.timeline.length > 0,
    // Ämnesläsning (#672): minst en ämnestext med nivå 1–3 och frågor. Gamla
    // nivåtexter (#152, borttagna i #531) i samma fält har formen { levels: {…} }
    // utan level/questions och tänder alltså inget. Inline-kopia av content.js
    // isPlayableAmnesText (bootgrafen, #271) – testet jämför dem (#673).
    readingTexts: Array.isArray(area?.readingTexts) && area.readingTexts.some((t) => !!t && typeof t === "object" &&
      typeof t.id === "string" && !!t.id && Array.isArray(t.questions) && t.questions.length > 0 &&
      [1, 2, 3].includes(typeof t.level === "string" && /^\s*\d+\s*$/.test(t.level) ? Number(t.level) : t.level)),
  };
}

/**
 * Vilka lägen området faktiskt HAR underlag för – oavsett lärarens synlighetsval.
 * Härleds GENERISKT ur ALL_MODES (vanliga lägen + äventyrs-teman), så nya lägen
 * OCH nya äventyrs-teman dyker upp automatiskt. Används av lärar-UI:t för
 * kryssrutorna (per-område); äventyren gate:as på needsAny (quiz ELLER par).
 * @param {object} area
 * @returns {typeof ALL_MODES}
 */
export function availableGamemodes(area) {
  const has = areaContentFlags(area);
  return ALL_MODES.filter((gm) => modeAvailable(gm, has));
}

/**
 * Vilka lägen eleven ska se som kort: har underlag OCH inte urbockat av läraren.
 * (Elevvyn i gamemodes.js visar dessutom lägen UTAN underlag som låsta kort –
 * den distinktionen görs där; här är det bara den kombinerade synlighetsgaten.)
 * @param {object} area
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodes(area) {
  return availableGamemodes(area).filter((gm) => !isModeHidden(area, gm.id));
}

// ---------------------------------------------------------------------------
// Klass-nivå (issue #208): läraren kan dölja lägen för HELA klassen, utöver
// per-område-valet ovan (#200). Valet lagras på klassdokumentet i samma form –
// classes/{id}.hiddenModes: en lista med mode-id som ska döljas i elevvyn.
// Bakåtkompatibelt: saknas fältet (eller är listan tom) döljs inget på klass-nivå.
// ---------------------------------------------------------------------------

/**
 * Är läget `modeId` urbockat (dolt) på KLASS-nivå?
 * @param {object} cls – klassdokument (kan sakna hiddenModes / vara null)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForClass(cls, modeId) {
  return normalizeHiddenModes(cls?.hiddenModes).includes(modeId);
}

/**
 * Är läget dolt för eleven? UNION av de dolda mängderna: klass ∪ område.
 * Ett läge visas bara om det INTE är dolt på någondera nivå (has-gaten – att
 * området har underlag – hanteras separat av anroparen, jfr availableGamemodes).
 * @param {object} area – arbetsområde (kan sakna hiddenModes)
 * @param {object|null} cls – elevens klass (kan sakna hiddenModes / vara null)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForStudent(area, cls, modeId) {
  return isModeHidden(area, modeId) || isModeHiddenForClass(cls, modeId);
}

/**
 * Vilka lägen eleven ska se, med BÅDE klass- och område-synlighet invägd:
 * har underlag OCH inte urbockat på vare sig område- eller klass-nivå.
 * @param {object} area
 * @param {object|null} cls
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodesForStudent(area, cls) {
  return availableGamemodes(area).filter((gm) => !isModeHiddenForStudent(area, cls, gm.id));
}

// ---------------------------------------------------------------------------
// Per (klass × område) (issue #298): en tredje axel. Utöver per-område (#200)
// och per-klass-globalt (#208) kan läraren dölja lägen för en klass PÅ ETT
// visst område. Valet lagras på klassdokumentet i en map nyckelad på områdes-id:
//
//   classes/{id}.areaModes = { [areaId]: { hiddenModes: [modeId, ...] } }
//
// Bakåtkompatibelt: saknas map:en, saknas områdets nyckel, eller är listan tom
// → inget döljs på den här axeln, och beteendet faller tillbaka på område ∪ klass
// exakt som förr. Inget går sönder för befintliga klasser (utan fältet).
// Områdes-id härleds ur area.id (samma id getArea sätter på dokumentet).
// ---------------------------------------------------------------------------

/**
 * De på (klass × område) dolda lägena för ETT områdes-id, normaliserade.
 * Läser classes/{id}.areaModes[areaId].hiddenModes; tom lista vid allt som
 * saknas (ingen klass, ingen map, okänt areaId, tom/ogiltig lista).
 * @param {object|null} cls    klassdokument (kan sakna areaModes / vara null)
 * @param {string} areaId      arbetsområdets id
 * @returns {string[]}
 */
export function classAreaHiddenModes(cls, areaId) {
  if (!areaId) return [];
  const map = cls?.areaModes;
  // Bara ett rent objekt (inte array/null) räknas som en giltig map.
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return normalizeHiddenModes(map[areaId]?.hiddenModes);
}

/**
 * Normalisera en HEL areaModes-map till { [areaId]: { hiddenModes: string[] } }.
 * Skriv-sidans motsvarighet till classAreaHiddenModes (#299): ogiltiga områdes-id
 * släpps, varje lista normaliseras (trimmad, unik). Tomma listor BEHÅLLS så att
 * ett tidigare dolt läge kan "av-döljas" via Firestore-merge på just det området
 * (en medskickad array ersätter den gamla helt). Ren funktion – lever här hos
 * resolutionen (inte i den firebase-kopplade data-classes.js) så den kan
 * enhetstestas och delas.
 * @param {*} map
 * @returns {Record<string, {hiddenModes: string[]}>}
 */
export function normalizeAreaModes(map) {
  const out = {};
  if (!map || typeof map !== "object" || Array.isArray(map)) return out;
  for (const [areaId, entry] of Object.entries(map)) {
    const id = String(areaId == null ? "" : areaId).trim();
    if (!id) continue;
    out[id] = { hiddenModes: normalizeHiddenModes(entry?.hiddenModes) };
  }
  return out;
}

/**
 * EFFEKTIVT dolda lägen för ett (område, klass)-par: unionen av
 *   (a) area.hiddenModes                              – per område (#200)
 *   (b) classes/{id}.hiddenModes                      – per klass globalt (#208)
 *   (c) classes/{id}.areaModes[area.id].hiddenModes   – per klass × område (#298)
 * Normaliserad, utan dubbletter, i ordningen område → klass → klass×område.
 * @param {object} area        arbetsområde (kan sakna hiddenModes)
 * @param {object|null} cls    elevens klass (kan sakna fält / vara null)
 * @returns {string[]}
 */
export function effectiveHiddenModes(area, cls) {
  return normalizeHiddenModes([
    ...normalizeHiddenModes(area?.hiddenModes),
    ...normalizeHiddenModes(cls?.hiddenModes),
    ...classAreaHiddenModes(cls, area?.id),
  ]);
}

/**
 * Är läget dolt för eleven med ALLA tre axlar invägda (område ∪ klass ∪
 * klass×område)? Detta är den fullständiga elev-resolutionen (#298).
 * has-gaten (att området har underlag) hanteras separat av anroparen.
 * @param {object} area
 * @param {object|null} cls
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForClassArea(area, cls, modeId) {
  return (
    isModeHiddenForStudent(area, cls, modeId) ||
    classAreaHiddenModes(cls, area?.id).includes(modeId)
  );
}

/**
 * Vilka lägen eleven ska se på ett visst område, med alla tre axlar invägda:
 * har underlag OCH inte urbockat på område-, klass- eller klass×område-nivå.
 * @param {object} area
 * @param {object|null} cls
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodesForClassArea(area, cls) {
  return availableGamemodes(area).filter((gm) => !isModeHiddenForClassArea(area, cls, gm.id));
}

/**
 * EN definition av ett områdes STJÄRN-lägen (#467): lägen med underlag (inkl.
 * äventyrs-teman), utan noStars-lägen (Memory), som inte är dolda för klassen
 * (område ∪ klass ∪ klass×område; cls null → bara områdets eget val). Elevpanelen,
 * Ämnen-matrisen, Per område och djupdykningen räknar både intjänat och möjligt
 * (antal × 3) över just dessa lägen – så intjänat kan aldrig överstiga möjligt.
 * @param {object} area
 * @param {object|null} [cls]
 * @returns {typeof ALL_MODES}
 */
export function areaStarModes(area, cls = null) {
  return visibleGamemodesForClassArea(area, cls).filter((gm) => !gm.noStars);
}

// ---------------------------------------------------------------------------
// By-synlighet per klass (issue #391): läraren kan dölja ANDRA klassers byar i
// klassens områdesvy (skolan). Lagras som classes/{id}.hiddenVillages =
// string[] (klass-id som DÖLJS för DENNA klass). Tom/saknad lista = alla byar
// synliga (bakåtkompatibelt). Bor här bredvid lägessynligheten eftersom modulen
// är ren (Node-testbar) och redan ligger i bootgrafen (ingen ny bootfil, #271).
// ---------------------------------------------------------------------------

/** Normalisera hiddenVillages till en ren lista klass-id (samma regler som lägen). */
export function normalizeHiddenVillages(v) {
  return normalizeHiddenModes(v);
}

/**
 * Vilka klassers byar eleven ska se i områdesvyn. Elevens EGNA klasser (där
 * meId finns i studentIds) syns ALLTID; övriga döljs om någon av elevens klasser
 * har dem i hiddenVillages (union – en elev i flera klasser får den striktaste
 * vyn). Läser bara klass-dokumentens publika fält (#37). Ordningen behålls.
 * @param {Array<{id:string, studentIds?:string[], hiddenVillages?:string[]}>} classes
 * @param {string|null} meId
 * @returns {Array} filtrerad klasslista
 */
export function visibleVillageClasses(classes, meId) {
  const lista = Array.isArray(classes) ? classes : [];
  const egna = lista.filter(
    (c) => meId && Array.isArray(c.studentIds) && c.studentIds.includes(meId)
  );
  const egnaIds = new Set(egna.map((c) => c.id));
  const dolda = new Set(egna.flatMap((c) => normalizeHiddenVillages(c.hiddenVillages)));
  return lista.filter((c) => egnaIds.has(c.id) || !dolda.has(c.id));
}

// ---------------------------------------------------------------------------
// MODULREGISTRET (#412/#605/#734): elevens TOP-NIVÅ-moduler med egen route.
//
//   Ny modul = en rad här, så följer fokusläget, modul-av/på och menyn med.
//   (Ett nytt LÅSMÅL kräver dessutom typen i firestore.rules validLockShape –
//   testet test/class-lock.test.js fångar en glömd typ. Se docs/FOKUSLAGE.md.)
//
// Ordning = lärar-UI:ts ordning och, inom varje menygrupp, sidomenyns ordning.
// Fält:
//   id, label, ikon   – modul-id (= låstypen i fokusläget), namn och menyikon
//   routes            – elev-routerna modulen äger (första = modulens startsida);
//                       en dold modul nås inte ens via direktlänk
//   grupp             – sidomenyns grupp (ui.js NAV_GRUPPER: "mitt" | "ova")
//   toggle:false      – INTE av/på-bar för läraren (styrs av annat, t.ex. en period)
//   optIn             – av tills läraren aktiverar den (classes/{id}.enabledModules)
//   villkor           – menylänken syns bara när ui.js NAV_VILLKOR[villkor] svarar sant
//   learning          – inlärningsmodul: fokuslåset spärrar den när den inte är målet
//   lockable          – kan väljas som mål i fokusläget (låstypen = id)
//   lockAreas         – låsmålet är ETT område i modulen (Plugga → typen "omrade")
//   lockGrupp         – rubrik i lärarens målväljare (standard "Moduler")
//   lockId            – låsmålet är ETT tillfälle i modulen: mal.id krävs och
//                       eleven skickas till `lockRoute?<lockId>=<mal.id>` (Prov:
//                       provtillfället, #740). Sätts av modulens eget flöde
//                       ("Kör i klass"), inte i lärarens målväljare
//
// Hem (huset) är elevens startsida och går inte att dölja – den står inte här.
// Live (#460) är ingen inlärningsmodul: syns som Live-rutan när klassen bjudits in.
// ---------------------------------------------------------------------------

export const STUDENT_MODULES = [
  // Prov (#740, docs/PROV.md): överst i "Öva" – länken syns bara när ett prov är
  // öppet för klassen eller ett rättat prov lämnats tillbaka (NAV_VILLKOR.prov).
  // Låses bara via "Kör i klass" (mal.id = provtillfället, lockHomeHash → provet).
  { id: "prov", label: "Prov", ikon: "📝", grupp: "ova", learning: true, lockable: true, lockId: "t",
    lockRoute: "/elev/prov/skriv", toggle: false, villkor: "prov", routes: ["/elev/prov", "/elev/prov/skriv", "/elev/prov/resultat"] },
  { id: "plugga", label: "Plugga", ikon: "📚", grupp: "ova", learning: true, lockable: true, lockAreas: true,
    routes: ["/elev/plugga", "/elev/omrade", "/elev/spela", "/elev/aventyr"] },
  // Läsresan (#398): egen huvudmodul, fristående från Plugga.
  { id: "lasresan", label: "Läsresan", ikon: "📖", grupp: "ova", learning: true, lockable: true,
    lockGrupp: "Läsning", routes: ["/elev/lasresan"] },
  { id: "shop", label: "Shoppen", ikon: "🛒", grupp: "mitt", routes: ["/elev/shop"] },
  // Mattematchen (#458): bara under en aktiv period för elevens klass – inte av/på-bar.
  { id: "mattematchen", label: "Mattematchen", ikon: "🧮", grupp: "ova", learning: true, lockable: true,
    toggle: false, villkor: "mattematchen", routes: ["/elev/mattematchen"] },
  // Hitta rätt! (#605) och Ekvationsresan (#618, E1.11): OPT-IN – av tills läraren
  // aktiverar dem för klassen. Läraren kan alltså inte "dölja" dem utan bara slå på/av.
  { id: "hittaratt", label: "Hitta rätt!", ikon: "🗺️", grupp: "ova", learning: true, lockable: true,
    optIn: true, routes: ["/elev/hitta-ratt"] },
  { id: "ekvationsresan", label: "Ekvationsresan", ikon: "⚖️", grupp: "ova", learning: true, lockable: true,
    optIn: true, routes: ["/elev/ekvationsresan"] },
];

/** Moduler läraren kan slå av/på per klass (#412, ordning = lärar-UI:ts ordning). */
export const TOGGLABLE_MODULES = STUDENT_MODULES.filter((m) => m.toggle !== false);

/** Modulen (ur hela registret) som äger elev-routen `path`, annars null. */
export function studentModuleForRoute(path) {
  return STUDENT_MODULES.find((m) => m.routes.includes(path)) || null;
}

/** Normalisera hiddenModules: bara kända modul-id, samma regler som lägen. */
export function normalizeHiddenModules(v) {
  const kanda = new Set(TOGGLABLE_MODULES.map((m) => m.id));
  return normalizeHiddenModes(v).filter((id) => kanda.has(id));
}

/** Normalisera enabledModules (#605): bara kända OPT-IN-modul-id. */
export function normalizeEnabledModules(v) {
  const optIn = new Set(TOGGLABLE_MODULES.filter((m) => m.optIn).map((m) => m.id));
  return normalizeHiddenModes(v).filter((id) => optIn.has(id));
}

/** Modul-id som äger elev-routen `path` (utan query), annars null. */
export function moduleForRoute(path) {
  return TOGGLABLE_MODULES.find((m) => m.routes.includes(path))?.id || null;
}

/**
 * Modulerna som är dolda för eleven: union över ALLA elevens klasser (en elev i
 * flera klasser får den striktaste vyn – samma regel som visibleVillageClasses).
 * @param {Array<{studentIds?:string[], hiddenModules?:string[]}>} classes
 * @param {string|null} meId
 * @returns {string[]}
 */
export function hiddenModulesForStudent(classes, meId) {
  if (!meId || !Array.isArray(classes)) return [];
  const egna = classes.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId));
  return [...new Set(egna.flatMap((c) => normalizeHiddenModules(c.hiddenModules)))];
}

/**
 * Allt som är dolt för eleven (#605): hiddenModules (#412) PLUS de opt-in-
 * moduler som INGEN av elevens klasser har aktiverat (enabledModules).
 * Aktiverad i någon klass → syns, så länge ingen klass döljer den.
 * Elev utan klass ser alltså inga opt-in-moduler.
 * @param {Array<{studentIds?:string[], hiddenModules?:string[], enabledModules?:string[]}>} classes
 * @param {string|null} meId
 * @returns {string[]}
 */
export function modulesHiddenForStudent(classes, meId) {
  const dolda = new Set(hiddenModulesForStudent(classes, meId));
  const egna = !meId || !Array.isArray(classes) ? []
    : classes.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId));
  const pa = new Set(egna.flatMap((c) => normalizeEnabledModules(c.enabledModules)));
  for (const m of TOGGLABLE_MODULES) if (m.optIn && !pa.has(m.id)) dolda.add(m.id);
  return [...dolda];
}

/** Opt-in-modulernas id – dolda när klasslistan inte gick att läsa. */
export const OPT_IN_MODULES = TOGGLABLE_MODULES.filter((m) => m.optIn).map((m) => m.id);
