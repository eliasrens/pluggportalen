// ============================================================================
// Årskurs ur klassnamnet (#845) – delad av elev- och lärarsidan i Mattematchen.
// ----------------------------------------------------------------------------
// Klasser har inget årskursfält. Årskursen HÄRLEDS ur namnets inledande
// siffror: "4B" → 4, "3A" → 3, "10A" → 10. Ett namn utan inledande siffra
// ("Klass 3", "Fritids", "", null) → "Övriga". Reglerna (firestore.rules
// mmArskursOk) gör SAMMA härledning mot classes/{id}.name, så värdet på
// topplisteposten kan inte fuskas.
//
// Ren modul (ingen DOM/Firebase) → test/arskurs.test.js.
//
// API
//   arskursAvKlass(namn)            → 4 | 10 | OVRIGA
//   arskursKod(ak) / arskursFranKod(n)
//                                   → Firestore-fältet `arskurs` är ett heltal,
//                                     0 = Övriga (så where('arskurs','==',n) går)
//   arskursLabel(ak)                → "Åk 4" | "Övriga"
//   arskurserIMatch(classIds, namnAv)
//                                   → unika årskurser i matchen, stigande,
//                                     Övriga sist (bara de som finns)
//   arskursAvRad(rad, namnAv)       → årskurs för en topplista-/klassrad:
//                                     rad.arskurs om det finns, annars ur
//                                     klassnamnet (poster före #845)
//   filtreraArskurs(rows, ak, namnAv, nyckel)
//                                   → raderna i årskursen, omrankade på
//                                     `nyckel` (delade platser 1, 2, 2, 4)
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

/** Årskurs → heltalet som lagras på score-dokumentet (Övriga = 0). */
export function arskursKod(ak) {
  return ak === OVRIGA ? 0 : Math.max(0, Math.floor(Number(ak) || 0));
}

/** Lagrat heltal → årskurs (0 eller ogiltigt = Övriga). */
export function arskursFranKod(n) {
  const k = Math.floor(Number(n));
  return Number.isFinite(k) && k > 0 ? k : OVRIGA;
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

/** Radens årskurs: lagrat `arskurs` först, annars ur klassnamnet. */
export function arskursAvRad(rad, namnAv) {
  if (rad && rad.arskurs != null) return arskursFranKod(rad.arskurs);
  return arskursAvKlass(namnFn(namnAv)(rad?.classId));
}

/** Placering med delade platser (samma som mm-core.topList/classStandings). */
function ranka(rows, key) {
  let prev = null;
  rows.forEach((r, i) => {
    r.rank = prev && prev[key] === r[key] ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/**
 * Raderna som hör till årskursen `ak` (ALLA = alla, oförändrade), i samma
 * ordning som de kom, omrankade på `nyckel` ("correct" / "score").
 */
export function filtreraArskurs(rows, ak, namnAv, nyckel = "correct") {
  const list = Array.isArray(rows) ? rows : [];
  if (ak === ALLA || ak == null) return list;
  const namn = namnFn(namnAv);
  const valda = list.filter((r) => arskursAvRad(r, namn) === ak).map((r) => ({ ...r }));
  return ranka(valda, nyckel);
}
