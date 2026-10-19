// ============================================================================
// Prov (#807, epic #802 §1.3): räknarna "prov att rätta" på provtillfället.
// Ren modul utan importer (testas i node, test/prov-raknare.test.js).
//
// Räknarna är tillfällets räkneverk rattStatus (#741) – inga nya dokument:
//   rattStatus.antal    = inlämnade prov   (spec: "inlamnade")
//   rattStatus.rattade  = rättade prov, tillbakalämnade inräknade
//   rattStatus.tillbaka = tillbakalämnade
//   attRatta            = antal > rattade (flagga på tillfället, så att märket
//                         och "Att rätta" hittar tillfällena med EN fråga:
//                         where classId in … + where attRatta == true)
// Lärarens webbläsare skriver dem när siffrorna ändå finns – aldrig genom att läsa
// svar eller rättningar bara för att räkna:
//   Stäng          antal = svaren som stängningen redan läser (alla är inlämnade)
//   Öppna igen     hela räkneverket ur svaren + rättningarna som redan läses
//   Rättningen     rattStatusSumma när vyn sparar (förslag, bedömning, Rätta alla,
//                  tillbakalämning, ångra) – som sedan #741
// Ett omprov är ett eget tillfälle med egna räknare.
// ============================================================================

/** Hur många prov på tillfället väntar på rättning? */
export function attRattaAntal(tf) {
  if (!tf || tf.status === "forberett") return 0;
  const s = tf.rattStatus || {};
  return Math.max(0, (Number(s.antal) || 0) - (Number(s.rattade) || 0));
}

/** Fälten som skrivs på tillfället: räkneverket + flaggan för frågan. */
export function raknareFalt(rattStatus) {
  const s = { antal: Number(rattStatus?.antal) || 0, rattade: Number(rattStatus?.rattade) || 0, tillbaka: Number(rattStatus?.tillbaka) || 0 };
  return { rattStatus: s, attRatta: s.antal > s.rattade };
}

/** Står flaggan rätt på tillfället? (Äldre tillfällen saknar den.) */
export const flaggaStammer = (tf) => tf?.attRatta === attRattaAntal({ rattStatus: tf?.rattStatus }) > 0;

/**
 * Äldre tillfälle (före #807) med räkneverk men utan flaggan → fälten att skriva
 * (lat uppskrivning när Provtillfällen laddas, inga extra läsningar), annars null.
 */
export const uppgraderaFalt = (tf) => (tf?.rattStatus && !flaggaStammer(tf) ? raknareFalt(tf.rattStatus) : null);

/**
 * Engångsskriptet admin/backfill-att-ratta.mjs: vad behöver ett tillfälle från före #807?
 *   "flagga" – räkneverket finns, flaggan saknas/fel (uppgraderaFalt)
 *   "rakna"  – stängt utan räkneverk (aldrig rättat): antal = inlämnade svar (count-fråga)
 *   null     – inget (förberett, öppet utan räkneverk – räknas när det stängs – eller redan rätt)
 */
export function backfillPlan(tf) {
  if (!tf || tf.status === "forberett") return null;
  if (tf.rattStatus) return uppgraderaFalt(tf) ? "flagga" : null;
  return tf.status === "stangt" && tf.attRatta === undefined ? "rakna" : null;
}

/**
 * Stäng: alla `antalSvar` svar är inlämnade nu. Rättade och tillbakalämnade
 * står kvar (de gäller elever som redan lämnat in).
 */
export function stangRaknare(tf, antalSvar) {
  return raknareFalt({ ...(tf?.rattStatus || {}), antal: antalSvar });
}

/** "Rätta"-knappens adress (rättningsvyn, #741). */
export const rattaHash = (t) => `#/larare/prov/ratta?t=${encodeURIComponent(t)}`;

/**
 * Raderna i "Att rätta" (Hem och Prov → Mina prov): tillfällen med orättade
 * prov, flest först. klasser ger klassens namn.
 * @returns {{ id, namn, klass, classId, antal, inlamnade, rattade }[]}
 */
export function attRattaRader(tillfallen, klasser = []) {
  const namn = new Map(klasser.map((c) => [c.id, c.name || c.id]));
  return (tillfallen || [])
    .map((tf) => ({
      id: tf.id,
      namn: tf.provNamn || "Prov",
      omprov: Array.isArray(tf.elevIds),
      classId: tf.classId,
      klass: namn.get(tf.classId) || tf.classId || "",
      antal: attRattaAntal(tf),
      inlamnade: Number(tf.rattStatus?.antal) || 0,
      rattade: Number(tf.rattStatus?.rattade) || 0,
    }))
    .filter((r) => r.antal > 0)
    .sort((a, b) => b.antal - a.antal || a.namn.localeCompare(b.namn, "sv"));
}

/** Märket på Prov: summan av alla tillfällens orättade prov. */
export const summaAttRatta = (rader) => rader.reduce((n, r) => n + r.antal, 0);

/**
 * Sessionscachen för märket och "Att rätta" (prov-att-ratta.js). Skrivningarna
 * som ändrar räknarna tömmer den, så att märket stämmer direkt efteråt.
 */
export const attRattaCache = { nyckel: "", tid: 0, lofte: null };
export function glomAttRatta() {
  attRattaCache.tid = 0;
  attRattaCache.lofte = null;
}
