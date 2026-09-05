// ============================================================================
// Pluggportalen – klass-medlemskap (ren logik, ingen Firestore)
// ----------------------------------------------------------------------------
// Klassbyn (#/elev/by) ska visa ALLA klasskamraternas hus, inte bara elevens
// eget. Vilka elever byn ska försöka läsa härleds ur klass-dokumentens publika
// `studentIds`-lista (classes-kollektionen är läsbar för alla inloggade). Den
// här modulen är den rena mattematiken kring det, utbruten så den kan
// enhetstestas utan Firebase (jfr leveling.js):
//
//   * En elev kan ingå i FLERA klasser. Byn ska då visa kamrater ur ALLA
//     elevens klasser (unionen), inte bara den första som råkar matcha – annars
//     tappas kamrater när en elev har mer än en klass. Reglerna tillåter ändå
//     läsning av var och en (sharesClass matchar delad klass), så unionen är
//     behörighetssäker.
//   * Eleven själv är alltid med (först i listan), även utan klass – då blir byn
//     bara det egna huset (samma snälla fallback som förr).
//
// OBS: att en kamrat finns i listan garanterar inte att läsningen LYCKAS – det
// kräver att den denormaliserade students/{id}.classIds är i synk (se
// firestore.rules sharesClass + admin/backfill-class-ids.mjs). getStudentsWithLooks
// hoppar tyst över nekade läsningar per elev, så byn tål osynk utan att falla.
// ============================================================================

/**
 * De klasser en elev ingår i (via klass-dokumentets `studentIds`).
 * @param {string} meId
 * @param {Array<{id?:string, studentIds?:string[]}>} classes
 * @returns {Array<{id?:string, studentIds?:string[]}>}
 */
export function myClasses(meId, classes) {
  if (!meId || !Array.isArray(classes)) return [];
  return classes.filter(
    (c) => c && Array.isArray(c.studentIds) && c.studentIds.includes(meId)
  );
}

/**
 * Alla elev-id:n byn ska försöka läsa: eleven själv först, sedan unionen av
 * klasskamraterna ur ALLA elevens klasser (deduplicerad, self borttagen ur
 * svansen). Utan klass (eller okänd elev) blir det bara elevens eget id.
 *
 * @param {string} meId
 * @param {Array<{id?:string, studentIds?:string[]}>} classes  hela klasslistan (getClasses)
 * @returns {string[]} unika id:n, meId först
 */
export function classmateIds(meId, classes) {
  if (!meId) return [];
  const ids = new Set([meId]);
  for (const c of myClasses(meId, classes)) {
    for (const sid of c.studentIds) if (sid) ids.add(sid);
  }
  return [...ids];
}
