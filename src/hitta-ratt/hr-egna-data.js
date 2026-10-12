// ============================================================================
// Hitta rätt! – läsningarna för egna pack (src/hitta-ratt/hr-egna-data.js) · #633
// ----------------------------------------------------------------------------
// Laddas bara DYNAMISKT (Hitta rätt!-routen), aldrig i bootgrafen (#271).
// Den rena logiken ligger i hr-egna.js. Arkitektur §11.3 (#231, O(1)):
//   katalogen hittaRattMeta/egnaPack = EN läsning, cachad KATALOG_TTL_MS och
//   nollad av skickaOmgang (hr-data.js); elevens klasser ur getClasses()
//   (sessionscachen); ett pack = EN läsning av hittaRattPacks/{id}.
//
// API
//   hamtaKatalog({ farsk }) → katalogdokumentet ({} om det saknas), kastar vid läsfel
//   invalideraKatalog()
//   minaKlassIds(uid?)      → elevens klass-id
//   egnaForMig()            → startsidans kort (hr-egna.js egnaForElev), [] vid fel
//   hamtaEgetPack(id)       → packet om det finns OCH delas med elevens klass,
//                             annars fel med code "not-found"; läsfel kastas som de är
// ============================================================================

import { db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getClasses } from "../data.js";
import { delasMed, egnaForElev } from "./hr-egna.js";

const KATALOG_TTL_MS = 60_000;
let cache = null; // { at, p }

export function hamtaKatalog({ farsk = false } = {}) {
  const nu = Date.now();
  if (!farsk && cache && nu - cache.at < KATALOG_TTL_MS) return cache.p;
  const p = getDoc(doc(db, "hittaRattMeta", "egnaPack")).then((s) => (s.exists() ? s.data() : {}));
  p.catch(() => {
    if (cache?.p === p) cache = null;
  });
  cache = { at: nu, p };
  return p;
}

export function invalideraKatalog() {
  cache = null;
}

export async function minaKlassIds(uid = currentStudentId()) {
  if (!uid) return [];
  const klasser = await getClasses();
  return klasser.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(uid)).map((c) => c.id);
}

export async function egnaForMig() {
  try {
    const [katalog, mina] = await Promise.all([hamtaKatalog(), minaKlassIds()]);
    return egnaForElev(katalog, mina);
  } catch {
    return []; // en trasig katalog ska aldrig stoppa startsidan
  }
}

class EgnaFel extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function hamtaEgetPack(id) {
  const [snap, mina] = await Promise.all([getDoc(doc(db, "hittaRattPacks", id)), minaKlassIds()]);
  const pack = snap.exists() ? { ...snap.data(), id: snap.id } : null;
  if (!pack || !delasMed(pack, mina)) throw new EgnaFel("not-found", "Kartan finns inte längre.");
  return pack;
}
