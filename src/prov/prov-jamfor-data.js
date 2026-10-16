// ============================================================================
// Prov (#747, spec §12 "Jämförelse"): samma prov i lärarens ANDRA klasser.
// Läses bara när läraren trycker "Jämför med mina andra klasser" – resten av
// den fördjupade statistiken räknas ur det rättningsvyn redan läst. Läraren
// ser bara sina egna klasser (filterClasses, som Provtillfällen); reglerna
// kräver dessutom hasClass för varje tillfälle och varje rättning.
// Läsningar: lärarens tillfällen (listaTillfallen, samma fråga som listan
// Provtillfällen) + EN läsning av rattning per annat tillfälle med provet.
// Inga nya index eller regler.
// ============================================================================

import { db } from "../firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses } from "../data-classes.js";
import { filterClasses, myRole } from "../teacher-role.js";
import { RATTNING, SAMLING_TILLFALLEN, STATUS } from "./prov-modell.js";
import { listaTillfallen } from "./prov-tillfalle-data.js";

/**
 * De andra öppnade tillfällena av samma prov i lärarens klasser.
 * @param {{ id: string, provId: string }} tf  tillfället som rättas
 * @returns {Promise<{ tf: object, klassNamn: string, rattningar: Record<string, object> }[]>}
 */
export async function hamtaJamforelse(tf) {
  const [role, klasser] = await Promise.all([myRole(), getClasses()]);
  const mina = filterClasses(klasser, role);
  const namn = new Map(mina.map((c) => [c.id, c.name || c.id]));
  const andra = (mina.length ? await listaTillfallen(mina.map((c) => c.id)) : [])
    .filter((x) => x.id !== tf.id && x.provId === tf.provId && x.status !== STATUS.FORBERETT && namn.has(x.classId));
  return Promise.all(andra.map(async (x) => {
    const snap = await getDocs(collection(db, SAMLING_TILLFALLEN, x.id, RATTNING));
    return { tf: x, klassNamn: namn.get(x.classId), rattningar: Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])) };
  }));
}
