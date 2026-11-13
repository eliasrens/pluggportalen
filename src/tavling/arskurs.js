// ============================================================================
// Årskurs ur klassnamnet (#845) – delad av elev- och lärarsidan i Mattematchen.
// ----------------------------------------------------------------------------
// Klasser har inget årskursfält. Årskursen HÄRLEDS ur namnets inledande
// siffror: "4B" → 4, "3A" → 3, "10A" → 10. Ett namn utan inledande siffra
// ("Klass 3", "Fritids", "", null) → "Övriga". Används av Klasskampens
// årskursfilter (Alla · Åk 3 · Åk 4 …) – bara i klienten, inget lagras.
//
// Ren modul (ingen DOM/Firebase) → test/arskurs.test.js.
//
// API
//   arskursAvKlass(namn)            → 4 | 10 | OVRIGA
//   arskursLabel(ak)                → "Åk 4" | "Övriga" | "Alla"
//   arskurserIMatch(classIds, namnAv)
//                                   → unika årskurser i matchen, stigande,
//                                     Övriga sist (bara de som finns)
//   filtreraArskurs(rows, ak, namnAv, nyckel)
//                                   → raderna (med classId) i årskursen,
//                                     omrankade på `nyckel` (delade platser
//                                     1, 2, 2, 4); ALLA = oförändrat
//   namnAv = Map<classId, namn> eller (classId) → namn
// ============================================================================

export const OVRIGA = "Övriga";
/** Filtervärdet "Alla" (inget filter). */
export const ALLA = "alla";

/** "4B" → 4, "10A" → 10, "Klass 3"/"Fritids"/""/null → OVRIGA. */
export function arskursAvKlass(namn) {
  const m = /^([1-9][0-9]*)/.exec(String(namn ?? ""));
  return m ? Number(m[1]) : OVRIGA;
}

/** "Åk 4" / "Övriga" / "Alla". */
export function arskursLabel(ak) {
  if (ak === ALLA) return "Alla";
  return ak === OVRIGA ? OVRIGA : `Åk ${ak}`;
}

function namnFn(namnAv) {
  if (typeof namnAv === "function") return namnAv;
  if (namnAv && typeof namnAv.get === "function") return (id) => namnAv.get(id);
  return () => "";
}

/** Stigande årskurser, Övriga sist. */
function sortera(list) {
  return list.sort((a, b) => {
    if (a === OVRIGA) return 1;
    if (b === OVRIGA) return -1;
    return a - b;
  });
}

/** Unika årskurser bland matchens klasser (utifrån klassnamnen). */
export function arskurserIMatch(classIds, namnAv) {
  const namn = namnFn(namnAv);
  const set = new Set((Array.isArray(classIds) ? classIds : []).map((id) => arskursAvKlass(namn(id))));
  return sortera([...set]);
}

/** Placering med delade platser (samma som mm-core.classStandings). */
function ranka(rows, key) {
  let prev = null;
  rows.forEach((r, i) => {
    r.rank = prev && prev[key] === r[key] ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/**
 * Raderna vars klass hör till årskursen `ak` (ALLA = alla, oförändrade), i
 * samma ordning som de kom, omrankade på `nyckel` (Klasskampen: "score").
 */
export function filtreraArskurs(rows, ak, namnAv, nyckel = "score") {
  const list = Array.isArray(rows) ? rows : [];
  if (ak === ALLA || ak == null) return list;
  const namn = namnFn(namnAv);
  const valda = list.filter((r) => arskursAvKlass(namn(r?.classId)) === ak).map((r) => ({ ...r }));
  return ranka(valda, nyckel);
}
