// ============================================================================
// Pluggporten – XP/nivå-data (data-xp.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (som redan ligger nära filtaket, precis som
// data-pet.js): läsningen av studentData.xp. Importera direkt härifrån
// (t.ex. `import { getXp } from "./data-xp.js"`). Ren nivå-/XP-logik (kurva,
// XP-pott) ligger i leveling.js; fältbeskrivning i docs/DATAMODELL.md.
//
// Kumulativt xp-fält. Nivån räknas fram ur xp (leveling.js) och sparas ALDRIG.
// XP delas ut ihop med mynten i data-mynt.js tjanaMynt (#853, dagskvittot) –
// och BARA när fältet redan finns. Elever utan xp-fält (spelade innan
// systemet fanns) får det härledda värdet av migreringen (SAKERHET-MYNT §7);
// tills dess visas det härledda värdet (xpFromStudentData).
// ============================================================================

import { currentStudentId, getStudentData } from "./data.js";
import { xpFromStudentData } from "./leveling.js";

/** Elevens samlade XP (sparat fält, annars härlett ur progress). */
export async function getXp(studentId = currentStudentId()) {
  return xpFromStudentData(await getStudentData(studentId));
}
