// ============================================================================
// Matchdagen – lärarens inställningar per elev (src/matchdagen/md-inst.js) · #867
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, ingen Firebase) – testas i node (test/matchdagen-modul.test.js).
// Formen på matchdagenInst/{uid} (spec §1.2, speglas i firestore.rules
// validMatchdagenInst):
//
//   omraden:   ["subj/area", ...]   Plugga-områden (quiz utan passage + par), ≤ 60
//   tabeller:  [0..10]              multiplikationstabeller, ≤ 11
//   rakna:     ["subj/area", ...]   Räkna-områden (område med generator), ≤ 60
//   svarssatt: "flerval" | "skriv"  flerval är standard (där källan stödjer det)
//   klocka:    0 | 30 | 60          sekunder per fråga, 0 = av (standard)
//   lugnt:     bool                 lugnt läge: färre effekter, ingen publik
//   paus:      0 | 30 | 45 | 60     minuter till "Dags för en paus", 0 = av (standard 60)
//   updatedAt, updatedBy            serverns tid + lärarens uid (sätts av md-inst-data.js)
//
// Åtkomsten (på/av) bor INTE här utan i classes/{id}.enabledModules (hela klassen, #876)
// och classes/{id}.elevModuler (per elev, #867) – gamemode-visibility.js.
// Klassens inställningar (#876): classes/{id}.matchdagenInst i samma form. Eleven spelar med
// sina EGNA om de finns, annars klassens, annars STANDARD_FRAGOR (tabellerna 0–10) – effektivInst.
// Frågekällorna läses av md-fragor.js i Etapp 1b; kallNycklar() är nycklarna i
// statistikens perKalla (spec §6.1).
// ============================================================================

import { normalizeElevModuler, normalizeEnabledModules } from "../gamemode-visibility.js";

export const MODUL = "matchdagen";
export const SVARSSATT = ["flerval", "skriv"];
export const KLOCKA_VAL = [0, 30, 60];
export const PAUS_VAL = [0, 30, 45, 60];
export const TABELLER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_OMRADEN = 60;
export const INGA_FRAGOR = "Din lärare har inte valt några frågor än";

export const STANDARD_INST = Object.freeze({
  omraden: [], tabeller: [], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60,
});

/** Utan egna och klassens inställningar (#876): multiplikationstabellerna 0–10, resten som standard. */
export const STANDARD_FRAGOR = Object.freeze({ ...STANDARD_INST, tabeller: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });

/** Områdets nyckel i omraden/rakna: "ämne/område" (samma som fokuslåsets mal.id). */
export const omradeNyckel = (subjectId, areaId) => `${subjectId}/${areaId}`;

/** Unika, trimmade "ämne/område"-nycklar (bara formen a/b), högst MAX_OMRADEN. */
function nycklar(v) {
  const ut = [];
  for (const x of Array.isArray(v) ? v : []) {
    const s = typeof x === "string" ? x.trim() : "";
    if (/^[^/\s]+\/[^/\s]+$/.test(s) && s.length <= 200 && !ut.includes(s)) ut.push(s);
    if (ut.length >= MAX_OMRADEN) break;
  }
  return ut;
}

/**
 * Hela inställningen med standardvärden för det som saknas eller är ogiltigt.
 * @param {*} raw  matchdagenInst-dokumentet (eller null)
 * @returns {{omraden:string[], tabeller:number[], rakna:string[], svarssatt:string, klocka:number, lugnt:boolean, paus:number}}
 */
export function normalizeInst(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const tabeller = TABELLER.filter((t) => Array.isArray(r.tabeller) && r.tabeller.includes(t));
  return {
    omraden: nycklar(r.omraden),
    tabeller,
    rakna: nycklar(r.rakna),
    svarssatt: SVARSSATT.includes(r.svarssatt) ? r.svarssatt : STANDARD_INST.svarssatt,
    klocka: KLOCKA_VAL.includes(r.klocka) ? r.klocka : STANDARD_INST.klocka,
    lugnt: r.lugnt === true,
    paus: PAUS_VAL.includes(r.paus) ? r.paus : STANDARD_INST.paus,
  };
}

/** Samma inställning (ordningen i listorna spelar ingen roll)? */
export function sammaInst(a, b) {
  const nyckel = (x) => {
    const i = normalizeInst(x);
    return JSON.stringify({ ...i, omraden: [...i.omraden].sort(), rakna: [...i.rakna].sort() });
  };
  return nyckel(a) === nyckel(b);
}

/** Har läraren valt minst en frågekälla? Annars kan ingen match startas (§2). */
export function harKallor(inst) {
  const i = normalizeInst(inst);
  return i.omraden.length + i.tabeller.length + i.rakna.length > 0;
}

/** Källornas nycklar (statistikens perKalla): omrade:ä/o, tabell:7, rakna:ä/o. */
export function kallNycklar(inst) {
  const i = normalizeInst(inst);
  return [...i.omraden.map((k) => `omrade:${k}`), ...i.tabeller.map((t) => `tabell:${t}`), ...i.rakna.map((k) => `rakna:${k}`)];
}

/** Är Matchdagen påslagen för HELA klassen (enabledModules, #876)? */
export function klassPa(cls) {
  return normalizeEnabledModules(cls?.enabledModules).includes(MODUL);
}

/** Är Matchdagen påslagen för just eleven (elevModuler, #867)? */
export function elevPa(cls, uid) {
  return (normalizeElevModuler(cls?.elevModuler, cls?.studentIds)[uid] || []).includes(MODUL);
}

/** Har eleven Matchdagen i klassen – för hela klassen ELLER för eleven? */
export function harMatchdagen(cls, uid) {
  return (klassPa(cls) && Array.isArray(cls?.studentIds) && cls.studentIds.includes(uid)) || elevPa(cls, uid);
}

/**
 * Inställningarna eleven spelar med (#876) och var de kommer ifrån: elevens egna
 * (matchdagenInst/{uid}), annars klassens (classes/{id}.matchdagenInst – den första av
 * elevens klasser där eleven har Matchdagen och som har inställningar), annars STANDARD_FRAGOR.
 * @param {object|null} egen   matchdagenInst/{uid} (null = inga egna)
 * @param {Array<object>} klasser  klassdokumenten (getClasses)
 * @param {string} uid
 * @returns {{inst:object, kalla:"egen"|"klass"|"standard"}}
 */
export function effektivInst(egen, klasser, uid) {
  if (egen) return { inst: normalizeInst(egen), kalla: "egen" };
  const egna = (Array.isArray(klasser) ? klasser : []).filter((c) => Array.isArray(c?.studentIds) && c.studentIds.includes(uid));
  const k = egna.find((c) => harMatchdagen(c, uid) && klassInst(c)) || egna.find((c) => klassInst(c));
  return k ? { inst: klassInst(k), kalla: "klass" } : { inst: normalizeInst(STANDARD_FRAGOR), kalla: "standard" };
}

/** Klassens inställningar (classes/{id}.matchdagenInst), normaliserade – null om läraren inte sparat några. */
export function klassInst(cls) {
  const r = cls?.matchdagenInst;
  return r && typeof r === "object" && !Array.isArray(r) ? normalizeInst(r) : null;
}

/**
 * Klassens nya elevModuler när Matchdagen slås på/av för `uid` (eller en lista elever,
 * "Välj alla", #876) – hela mapen (skrivs med updateDoc så att en avstängd elev
 * försvinner helt). Elever som inte längre går i klassen rensas bort (reglerna kräver
 * klassens studentIds).
 * @param {object} cls
 * @param {string|string[]} uid
 * @param {boolean} pa
 * @returns {Record<string, string[]>}
 */
export function nyaElevModuler(cls, uid, pa) {
  const map = normalizeElevModuler(cls?.elevModuler, cls?.studentIds);
  for (const u of Array.isArray(uid) ? uid : [uid]) {
    const egna = (map[u] || []).filter((id) => id !== MODUL);
    if (pa) egna.push(MODUL);
    if (egna.length) map[u] = egna;
    else delete map[u];
  }
  return map;
}

/** Klassens nya enabledModules när Matchdagen slås på/av för hela klassen (#876). */
export function nyaEnabledModules(cls, pa) {
  const ut = normalizeEnabledModules(cls?.enabledModules).filter((id) => id !== MODUL);
  if (pa) ut.push(MODUL);
  return ut;
}

/** Elevens rad i lärarens lista, t.ex. "2 områden · tabell 3, 7 · klocka 30 s". */
export function sammanfattning(inst) {
  const i = normalizeInst(inst);
  const delar = [];
  if (i.omraden.length) delar.push(`${i.omraden.length} ${i.omraden.length === 1 ? "område" : "områden"}`);
  if (i.tabeller.length) delar.push(`${i.tabeller.length === 1 ? "tabell" : "tabellerna"} ${i.tabeller.join(", ")}`);
  if (i.rakna.length) delar.push(`${i.rakna.length} Räkna`);
  if (!delar.length) delar.push("inga frågor valda");
  if (i.svarssatt === "skriv") delar.push("skriv själv");
  if (i.klocka) delar.push(`klocka ${i.klocka} s`);
  if (i.lugnt) delar.push("lugnt läge");
  if (i.paus !== STANDARD_INST.paus) delar.push(i.paus ? `paus ${i.paus} min` : "paus av");
  return delar.join(" · ");
}

/** "a", "a och b", "a, b och c". */
const ochLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} och ${xs.at(-1)}` : xs.join(""));

/** Elevens rad på Matchdagen-sidan om frågorna läraren valt (inga områdesnamn – de skulle kosta läsningar). */
export function fragorText(inst) {
  const i = normalizeInst(inst);
  if (!harKallor(i)) return `${INGA_FRAGOR}.`;
  const delar = [];
  if (i.omraden.length) delar.push(i.omraden.length === 1 ? "ett Plugga-område" : `${i.omraden.length} Plugga-områden`);
  if (i.tabeller.length) delar.push(`${i.tabeller.length === 1 ? "tabell" : "tabellerna"} ${ochLista(i.tabeller)}`);
  if (i.rakna.length) delar.push(i.rakna.length === 1 ? "ett Räkna-område" : `${i.rakna.length} Räkna-områden`);
  return `Dina frågor kommer från ${delar.length > 1 ? `${delar.slice(0, -1).join(", ")} samt ${delar.at(-1)}` : delar[0]}.`;
}
