// ============================================================================
// Schack – lärarens sektion, läsningarna utöver lyssnarna (#781). Laddas bara
// med import() från schack-larare.js.
//
//   lasDatorPartier(ids)  EN getDoc per elev (studentData/{uid}) – bara när
//                         läraren trycker "Hämta partier mot datorn"; ingen
//                         ensureStudentData (läraren skapar aldrig elevdata).
//   projektionsNamn(cid)  classProjections/{classId}.members (1 läsning,
//                         session-cachad) – bara för elever som inte finns i
//                         lärarsidans redan laddade elevlista.
// ============================================================================

import { db } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { datorPartierUr } from "./schack-larare-delar.js";

/** uid → antal datorpartier (0 om dokumentet saknas, null om läsningen nekades). */
export async function lasDatorPartier(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const res = await Promise.all(
    uniq.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "studentData", uid));
        return datorPartierUr(snap.exists() ? snap.data() : null);
      } catch (err) {
        console.warn(`schack: kunde inte läsa studentData/${uid}`, err);
        return null;
      }
    }),
  );
  return new Map(uniq.map((uid, i) => [uid, res[i]]));
}

/** Klassprojektionens members ({} vid fel) – namnen till elever utanför elevlistan. */
export async function projektionsNamn(classId) {
  try {
    const { getClassProjection } = await import("../../data.js");
    return (await getClassProjection(classId)).members || {};
  } catch {
    return {};
  }
}
