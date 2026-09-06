// ============================================================================
// Pluggportalen – text-format.js
// ----------------------------------------------------------------------------
// Små, rena textformat-hjälpare (ingen DOM, inga beroenden) så de kan delas
// av både elev- och lärarvyerna och testas isolerat med `node --test`.
// ============================================================================

/**
 * Svensk genitiv/possessiv av ett namn.
 *
 * Regel: namn som slutar på s, x eller z får INGEN extra genitiv-s – bara
 * namnet självt ("Rasmus hus", "Max hus", "Liz hus"). Övriga namn får "s"
 * ("Astrids hus").
 *
 * @param {string} namn Namnet (elev, klass, e.d.).
 * @returns {string} Namnet i possessiv form, eller "" om namn saknas.
 */
export function possessiv(namn) {
  if (namn == null) return "";
  const s = String(namn);
  const trimmed = s.trim();
  if (!trimmed) return s;
  return /[sxz]$/i.test(trimmed) ? s : s + "s";
}
