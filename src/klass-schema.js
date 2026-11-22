// ============================================================================
// Pluggporten – veckoschema per klass (#900, docs/VECKOSCHEMA.md), REN logik
// ----------------------------------------------------------------------------
// Läraren lägger in klassens lektioner (dag, tid, ämne). Under en lektion ser
// eleverna bara det som hör till lektionens ämne. Lagras på klass-dokumentet:
//
//   classes/{id}.schema = {
//     pa:        bool,                              // "Aktivera veckoschemat" (saknas = av)
//     lektioner: [ { id, dag, start, slut, amne } ], // dag 1–5, "HH:MM" svensk tid, start < slut
//     koppling:  { [modulId | "matchdagen:tabeller"]: subjectId | null },
//     updatedAt, updatedBy,
//   }
//
// Samma varje vecka. Tiden räknas i Europe/Stockholm på serverNow() (Intl), inte
// i datorns tidszon. Start räknas med, slut räknas inte med.
// Fokuslåset (class-lock.js) går ALLTID före schemat (kombineradGrind).
// Schemat kan bara MINSKA det eleven ser – synligheten bestäms aldrig här.
//
// Ingen Firebase, ingen DOM. Laddas ALLTID dynamiskt – aldrig i den statiska
// bootgrafen (incident #271).
// ============================================================================

import { STUDENT_MODULES, studentModuleForRoute, modulesHiddenForStudent } from "./gamemode-visibility.js";
import { gateFor } from "./class-lock.js";
import { SCHEMA_TZ, tidTillMinuter, svenskTid, nastaSvenskTid } from "./klass-schema-tid.js";

export { SCHEMA_TZ, tidTillMinuter, svenskTid, nastaSvenskTid };

/** Högst så många lektioner per klass (speglas i firestore.rules). */
export const SCHEMA_MAX_LEKTIONER = 60;
/** Skoldagarna: 1 = måndag … 5 = fredag. */
export const SCHEMA_DAGAR = [1, 2, 3, 4, 5];
export const DAG_NAMN = { 1: "måndag", 2: "tisdag", 3: "onsdag", 4: "torsdag", 5: "fredag" };

/** Kopplingsnyckeln för Matchdagens multiplikationstabeller (inget modul-id). */
export const MATCHDAGEN_TABELLER = "matchdagen:tabeller";

/**
 * Det som kan kopplas till ett ämne: registrets moduler med `amnesTips` (null =
 * aldrig något ämne, Schack) + Matchdagens tabeller (samma tips som matte).
 * Speglas i firestore.rules validSchemaKoppling – test/klass-schema.test.mjs jämför.
 */
export const KOPPLINGAR = [
  ...STUDENT_MODULES.filter((m) => "amnesTips" in m).map((m) => ({ id: m.id, label: m.label, amnesTips: m.amnesTips })),
  { id: MATCHDAGEN_TABELLER, label: "Matchdagens multiplikationstabeller", amnesTips: ["matte", "matematik", "ma"] },
];
export const KOPPLING_NYCKLAR = KOPPLINGAR.map((k) => k.id);
const KOPPLING = new Map(KOPPLINGAR.map((k) => [k.id, k]));

const LEKTION_ID = /^[A-Za-z0-9_-]{1,20}$/;
const AMNE_MAX = 100;

const amneOk = (v) => typeof v === "string" && v.length > 0 && v.length <= AMNE_MAX;

/** En lektion i säker form, eller null. */
export function normalizeLektion(v) {
  if (!v || typeof v !== "object") return null;
  if (typeof v.id !== "string" || !LEKTION_ID.test(v.id)) return null;
  if (!SCHEMA_DAGAR.includes(v.dag)) return null;
  const start = tidTillMinuter(v.start);
  const slut = tidTillMinuter(v.slut);
  if (start == null || slut == null || start >= slut) return null;
  if (!amneOk(v.amne)) return null;
  return { id: v.id, dag: v.dag, start: v.start, slut: v.slut, amne: v.amne };
}

/** Kopplingen i säker form: bara kända nycklar, ämnes-id eller null (Schack alltid null). */
export function normalizeKoppling(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, amne] of Object.entries(v)) {
    const k = KOPPLING.get(id);
    if (!k) continue;
    if (k.amnesTips === null) out[id] = null;
    else if (amne === null || amneOk(amne)) out[id] = amne;
  }
  return out;
}

/**
 * Normalisera schema-fältet till { pa, lektioner, koppling }, eller null (inget
 * schema). Okänd form (inte ett objekt, lektioner som inte är en lista, fler än
 * SCHEMA_MAX_LEKTIONER) ger null. En enskild ogiltig lektion (eller ett dubblerat
 * id) släpps; okända kopplingsnycklar släpps.
 */
export function normalizeSchema(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const lista = v.lektioner === undefined ? [] : v.lektioner;
  if (!Array.isArray(lista) || lista.length > SCHEMA_MAX_LEKTIONER) return null;
  const sedda = new Set();
  const lektioner = [];
  for (const l of lista) {
    const n = normalizeLektion(l);
    if (!n || sedda.has(n.id)) continue;
    sedda.add(n.id);
    lektioner.push(n);
  }
  return { pa: v.pa === true, lektioner, koppling: normalizeKoppling(v.koppling) };
}

/** Lektionerna sorterade på dag och starttid (för lärarens vecka). */
export function sorteradeLektioner(lektioner) {
  return [...(lektioner || [])].sort((a, b) => a.dag - b.dag || tidTillMinuter(a.start) - tidTillMinuter(b.start));
}

/**
 * Krockar `lektion` med en annan lektion samma dag? Reglerna kontrollerar inte
 * överlapp – klienten nekar med ett tydligt besked (C). Returnerar den första
 * krockande lektionen (annat id), annars null. Slut = nästa start krockar inte.
 */
export function lektionKrock(lektioner, lektion) {
  const s = tidTillMinuter(lektion?.start);
  const e = tidTillMinuter(lektion?.slut);
  if (s == null || e == null) return null;
  return (lektioner || []).find((l) => l.id !== lektion.id && l.dag === lektion.dag &&
    tidTillMinuter(l.start) < e && s < tidTillMinuter(l.slut)) || null;
}

/** Ett kort slumpat lektions-id (stabilt, för redigering). */
export function nyttLektionsId(slump = Math.random) {
  const tecken = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += tecken[Math.floor(slump() * tecken.length)];
  return id;
}

// --- Ämneskopplingen (B.3) ----------------------------------------------------

const ord = (s) => String(s || "").toLowerCase().split(/[^a-zåäö0-9]+/).filter(Boolean);

/** Liknar ämnets namn (eller id) tipset? Ett helt ord, eller namnets början för tips ≥ 3 tecken. */
function liknar(subject, tips) {
  for (const text of [subject?.name, subject?.id]) {
    const t = String(text || "").trim().toLowerCase();
    if (!t) continue;
    if (ord(t).includes(tips)) return true;
    if (tips.length >= 3 && t.startsWith(tips)) return true;
  }
  return false;
}

/** Gissa ämnet för en kopplingspost: första tipset som något ämne liknar (ämnenas ordning). */
function gissaAmne(k, subjects) {
  if (!Array.isArray(k.amnesTips)) return null;
  for (const tips of k.amnesTips) {
    const s = (subjects || []).find((x) => x?.id && liknar(x, tips));
    if (s) return s.id;
  }
  return null;
}

/**
 * Gissad koppling ur ämnenas namn: { [nyckel]: subjectId | null } för ALLA nycklar.
 * @param {Array<{id:string, name?:string}>} subjects
 */
export function gissaKoppling(subjects) {
  return Object.fromEntries(KOPPLINGAR.map((k) => [k.id, gissaAmne(k, subjects)]));
}

/**
 * Den koppling som gäller: lärarens sparade val, och för nycklar läraren inte
 * valt – gissningen (om ämnena ges). Ett sparat null står kvar (läraren valde
 * "inget ämne"). Ett ämne som inte längre finns (när ämnena ges) räknas som null.
 */
export function effektivKoppling(schema, subjects) {
  const sparad = normalizeSchema(schema)?.koppling || normalizeKoppling(schema?.koppling);
  const finns = Array.isArray(subjects) ? new Set(subjects.map((s) => s?.id)) : null;
  const gissad = finns ? gissaKoppling(subjects) : {};
  const out = {};
  for (const k of KOPPLINGAR) {
    let v = k.id in sparad ? sparad[k.id] : (gissad[k.id] ?? null);
    if (k.amnesTips === null || (v && finns && !finns.has(v))) v = null;
    out[k.id] = v;
  }
  return out;
}

/** Nycklarna som gissningen inte hittade något ämne för (och läraren inte valt) – C:s "välj"-rad. */
export function okandaKopplingar(schema, subjects) {
  const sparad = normalizeKoppling(schema?.koppling);
  const gissad = gissaKoppling(subjects);
  return KOPPLINGAR.filter((k) => k.amnesTips !== null && !(k.id in sparad) && !gissad[k.id]).map((k) => k.id);
}

/** Klockslaget lektionen slutar, som epoch-ms (den pågående lektionens slut, från `now`). */
function slutMs(lektion, now) {
  return nastaSvenskTid(now, lektion.dag, tidTillMinuter(lektion.slut));
}

/**
 * Lektionen som gäller just nu i klassen, eller null. Bara när schemat är
 * aktiverat (pa), en skoldag, och start ≤ nu < slut (svensk tid).
 * Flera lektioner samtidigt (överlapp – reglerna tillåter det) → den som började först.
 */
export function aktivLektion(klass, now) {
  const s = normalizeSchema(klass?.schema);
  if (!s?.pa) return null;
  const t = svenskTid(now);
  if (!SCHEMA_DAGAR.includes(t.dag)) return null;
  const pagar = s.lektioner.filter((l) => l.dag === t.dag &&
    tidTillMinuter(l.start) <= t.minut && t.minut < tidTillMinuter(l.slut));
  return sorteradeLektioner(pagar)[0] || null;
}

const egnaKlasser = (classes, meId) => (!meId || !Array.isArray(classes) ? []
  : classes.filter((c) => Array.isArray(c?.studentIds) && c.studentIds.includes(meId)));

/**
 * Nästa ändring av elevens schemaläge (epoch-ms): nästa lektions start eller en
 * pågående lektions slut, i någon av elevens klasser med aktiverat schema.
 * null = inget att vänta på (D:s timer; skyddsnätet är 15 s-intervallet).
 */
export function nastaSchemaAndring(classes, meId, now) {
  let forst = null;
  for (const c of egnaKlasser(classes, meId)) {
    const s = normalizeSchema(c.schema);
    if (!s?.pa) continue;
    for (const l of s.lektioner) {
      for (const minut of [tidTillMinuter(l.start), tidTillMinuter(l.slut)]) {
        let ms = nastaSvenskTid(now, l.dag, minut);
        if (ms <= now) ms = nastaSvenskTid(now + 60_000, l.dag, minut);
        if (forst == null || ms < forst) forst = ms;
      }
    }
  }
  return forst;
}

// --- Elevens schemaläge (B.4) ----------------------------------------------------

/** Plugga-modulen (områdena) – listan är grindens `home`. */
const PLUGGA = STUDENT_MODULES.find((m) => m.lockAreas);
const MATCHDAGEN = "matchdagen";
const areaNyckel = (subjectId, areaId) => `${subjectId}/${areaId}`;
const tilldelade = (klass) => (Array.isArray(klass?.assignedAreas) ? klass.assignedAreas : []);

/**
 * Har lektionens ämne något i klassen? Synliga områden (assignedAreas, eller hela
 * biblioteket när listan är tom – `amnenMedOmraden` säger vilka ämnen som har
 * områden; saknas den antas varje ämne ha det) eller en modul kopplad till ämnet
 * som eleven annars ser. Nej → lektionen filtrerar inget ("har man inte kryssat
 * i ett NO-område, då är allt"). `synliga` = områdeslistan att pröva mot (för en
 * elev: Plugga-klassens, se schemaForStudent); standard = klassens egen.
 * @returns {{omraden:boolean, moduler:string[]}}
 */
export function amnetsInnehall(klass, amne, { amnenMedOmraden = null, subjects = null, dolda = [], synliga } = {}) {
  const lista = Array.isArray(synliga) ? synliga : tilldelade(klass);
  const omraden = lista.length > 0 ? lista.some((a) => a?.subjectId === amne)
    : !amnenMedOmraden || new Set(amnenMedOmraden).has(amne);
  const koppling = effektivKoppling(klass?.schema, subjects);
  const doldaSet = new Set(dolda);
  const moduler = KOPPLINGAR.filter((k) => k.id !== MATCHDAGEN_TABELLER && koppling[k.id] === amne && !doldaSet.has(k.id))
    .map((k) => k.id);
  return { omraden, moduler };
}

/**
 * Elevens aktiva schemaläge, eller null (inget filter – allt som vanligt).
 *  - Varje klass eleven går i med en aktiv lektion bidrar med lektionens ämne;
 *    de tillåtna ämnena är UNIONEN.
 *  - En aktiv lektion vars ämne inget har (amnetsInnehall) filtrerar inget →
 *    unionen blir "allt" → null.
 *  - Synliga områden = den FÖRSTA klassens assignedAreas (samma regel som
 *    Plugga-listan, getClassForStudent); tom lista = hela biblioteket.
 * @param {Array} classes   klassdokumenten (med id, studentIds, schema, assignedAreas …)
 * @param {string} meId
 * @param {number} now      serverNow()
 * @param {{amnenMedOmraden?:Iterable<string>, subjects?:Array<{id,name}>}} [opts]
 *   subjects ger ämnesnamnen (label) och gissad koppling för nycklar läraren inte sparat.
 */
export function schemaForStudent(classes, meId, now, opts = {}) {
  const egna = egnaKlasser(classes, meId);
  if (!egna.length) return null;
  const dolda = modulesHiddenForStudent(egna, meId); // bara elevens klasser (tål trasiga poster)
  // Synliga områden = Plugga-listans: den första klassen (samma lista prövas och grindas).
  const synliga = tilldelade(egna[0]);
  const amnen = [];
  const moduler = new Set();
  let tabeller = false;
  const lektioner = [];
  for (const c of egna) {
    const l = aktivLektion(c, now);
    if (!l) continue;
    const innehall = amnetsInnehall(c, l.amne, { ...opts, dolda, synliga });
    if (!innehall.omraden && !innehall.moduler.length) return null;
    if (!amnen.includes(l.amne)) amnen.push(l.amne);
    // Alla moduler kopplade till ämnet (även dolda): modulgrinden prövar synligheten som vanligt.
    const koppling = effektivKoppling(c.schema, opts.subjects);
    for (const k of KOPPLINGAR) if (koppling[k.id] === l.amne && k.id !== MATCHDAGEN_TABELLER) moduler.add(k.id);
    if (koppling[MATCHDAGEN_TABELLER] === l.amne) tabeller = true;
    lektioner.push({ ...l, classId: c.id, till: slutMs(l, now) });
  }
  if (!lektioner.length) return null;
  const forstSlut = lektioner.reduce((a, b) => (b.till < a.till ? b : a));
  const namn = new Map((opts.subjects || []).map((s) => [s?.id, s?.name]));
  return {
    amnen,
    moduler: [...moduler],
    tabeller,
    omraden: synliga.length ? synliga.map((a) => areaNyckel(a?.subjectId, a?.areaId)) : null,
    lektioner,
    label: amnen.map((a) => namn.get(a) || a).join(" och "),
    klockslag: forstSlut.slut,
    till: forstSlut.till,
    home: PLUGGA && !dolda.includes(PLUGGA.id) ? `#${PLUGGA.routes[0]}` : "#/elev/hus",
  };
}

/** Är (ämne, område) öppet under lektionen? Lektionens ämne OCH synligt för klassen. */
export function schemaAllowsArea(lage, subjectId, areaId) {
  if (!lage.amnen.includes(subjectId)) return false;
  return !lage.omraden || lage.omraden.includes(areaNyckel(subjectId, areaId));
}

/**
 * Får eleven öppna `path` under lektionen? (B.5)
 *  - Plugga-listan: ja (visar bara lektionens områden); område/spel/äventyr: bara lektionens synliga områden
 *  - inlärningsmoduler: bara de kopplade till lektionens ämne (modulgrinden prövar synligheten som vanligt)
 *  - Prov: som vanligt (eget lås). Matchdagen: öppen (E filtrerar frågorna; `lage.matchdagen === false` spärrar)
 *  - allt annat (hem/hus/värld, Shoppen, profil, Live, avatarvalet): öppet
 */
export function schemaAllowsRoute(lage, path, query) {
  const m = studentModuleForRoute(path);
  if (!m || !m.learning || m.lockId) return true;
  if (m.lockAreas) {
    if (path === m.routes[0]) return true;
    return schemaAllowsArea(lage, query?.get?.("subj") || "", query?.get?.("area") || "");
  }
  if (m.id === MATCHDAGEN) return lage.matchdagen !== false;
  return lage.moduler.includes(m.id);
}

/**
 * Router-/meny-vänlig vy av schemaläget – samma form som gateFor i class-lock.js
 * (null in → null ut). isTarget är alltid falskt: schemat öppnar aldrig något som
 * annars är dolt, så modulgrinden gäller som vanligt.
 */
export function gateForSchema(lage) {
  if (!lage) return null;
  return {
    lock: null, // inget fokuslås – konsumenter som läser gate.lock prövar det först
    schema: lage,
    fri: null,
    home: lage.home,
    label: lage.label,
    klockslag: lage.klockslag,
    allows: (path, query) => schemaAllowsRoute(lage, path, query),
    isTarget: () => false,
    allowsArea: (subjectId, areaId) => schemaAllowsArea(lage, subjectId, areaId),
  };
}

/**
 * Den kombinerade grinden: fokuslåset går ALLTID före schemat. Ett aktivt lås
 * (även ett inlämnat prov med "klassens vanliga läge", där gateFor ger null)
 * gäller och schemat ignoreras; utan lås gäller schemat; annars null.
 * @param {object|null} lock  elevens effektiva lås (lockEfterInlamning(lockForStudent(…)))
 * @param {object|null} lage  schemaForStudent(…)
 */
export function kombineradGrind(lock, lage) {
  return lock ? gateFor(lock) : gateForSchema(lage);
}
