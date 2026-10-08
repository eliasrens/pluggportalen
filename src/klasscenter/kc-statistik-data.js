// ============================================================================
// Klasscentret – statistiktavlans "lösta uppgifter" mot Firestore (#498).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT (av kc-rum-session.js) – aldrig från den statiska
// bootgrafen (#271).
//
// Ingen ny räknare och ingen ny skrivning: klass-projektionen
// (classProjections/{classId}, #231) bär redan varje elevs totaler och sedan
// #498 även `plays` (awardProjectionPatch speglar den vid varje avklarad
// omgång). EN getDoc per klass (via projektions-storens 30 s-cache) + den
// cachade classes-listan – aldrig ett dokument per elev (incident #114).
//
// API
//   hamtaLosta(classId, { farsk? }) → Promise<number>
//     farsk = true → projektions-cachen töms först (panelen öppnas = nya siffror)
// ============================================================================

import { getClassProjection, invalidateClassProjection } from "../data-content.js";
import { getClasses } from "../data-classes.js";
import { lostaUppgifter } from "./kc-statistik.js";

export async function hamtaLosta(classId, { farsk = false } = {}) {
  if (!classId) return 0;
  if (farsk) invalidateClassProjection(classId);
  const [proj, klasser] = await Promise.all([getClassProjection(classId), getClasses()]);
  const klass = klasser.find((k) => k.id === classId);
  return lostaUppgifter(proj?.members, Array.isArray(klass?.studentIds) ? klass.studentIds : null);
}
