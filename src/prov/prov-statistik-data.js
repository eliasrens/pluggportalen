// ============================================================================
// Prov (#742, spec §7.5 "Över tid"): statistikflikens enda läsning.
// EN collection group-fråga på rattning med where("classId", "==", klassen),
// en gång när fliken "Prov" öppnas – en klass i taget, ingen läsning per elev
// (kvotregeln #114). Fältundantaget för classId (COLLECTION_GROUP) ligger i
// firestore.indexes.json; reglerna: match /{path=**}/rattning/{elevUid}.
// test/prov-statistik.test.js räknar att filen gör exakt en databasfråga.
// ============================================================================

import { db } from "../firebase-config.js";
import { collectionGroup, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { RATTNING } from "./prov-modell.js";

/**
 * Klassens alla rättningar, med tillfällets id (t) ur sökvägen
 * provTillfallen/{t}/rattning/{elevUid}.
 * @returns {Promise<object[]>}
 */
export async function hamtaKlassensRattningar(classId) {
  const snap = await getDocs(query(collectionGroup(db, RATTNING), where("classId", "==", classId)));
  return snap.docs.map((d) => ({ ...d.data(), t: d.ref.parent.parent?.id || "" }));
}
