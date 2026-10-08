// ============================================================================
// Klasscentret – vem är jag i det här rummet? (#501, epic #473, spec §7)
// ----------------------------------------------------------------------------
// ETT beslut per öppning, oberoende av vilken väg man kom in (egna byn,
// grannbyn, direktlänk): behörigheten avgörs av klassens medlemslista och
// lärarens spärrlista – aldrig av "visaOnly". UI:t (verktyg, drag, möbellåda),
// statusraden och rubriken läser alla samma roll. Reglerna (firestore.rules
// "KLASSCENTRET") är den riktiga spärren; det här är UI-grinden.
//
//   kcRoll({ uid, arLarare, studentIds, inredningSparr }) →
//     "larare"   lärare (globalt anspråk, docs/SAKERHET-klasscentret.md R1)
//     "hemma"    klassmedlem som får inreda
//     "sparrad"  klassmedlem som läraren bockat ur (titta + donera i shoppen)
//     "gast"     inloggad elev i en annan klass (titta, hovra, tavlan)
//     "utloggad" ingen användare
//   rollKanInreda(roll)  → bool (larare | hemma)
//   rollArGast(roll)     → bool (gast | utloggad)
//   arKlassmedlem(uid, studentIds) → bool
//   anvandarNyckel({ studentId, teacher, uid }) → "elev:…" | "larare:…" | ""
//
// Ren modul (inga importer) – enhetstestas i Node. Laddas BARA dynamiskt (#271).
// ============================================================================

export const KC_ROLLER = Object.freeze(["larare", "hemma", "sparrad", "gast", "utloggad"]);

export function arKlassmedlem(uid, studentIds) {
  return !!uid && Array.isArray(studentIds) && studentIds.includes(uid);
}

export function kcRoll({ uid = null, arLarare = false, studentIds = [], inredningSparr = [] } = {}) {
  if (arLarare) return "larare";
  if (!uid) return "utloggad";
  if (!arKlassmedlem(uid, studentIds)) return "gast";
  return Array.isArray(inredningSparr) && inredningSparr.includes(uid) ? "sparrad" : "hemma";
}

export function rollKanInreda(roll) {
  return roll === "larare" || roll === "hemma";
}

export function rollArGast(roll) {
  return roll === "gast" || roll === "utloggad";
}

/**
 * Vem är inloggad, som en jämförbar nyckel (#501 O4): byts användaren i samma
 * flik (eller loggas ut) ändras nyckeln → rummet stängs i stället för att
 * behålla förra användarens verktyg.
 */
export function anvandarNyckel({ studentId = null, teacher = false, uid = null } = {}) {
  if (teacher) return `larare:${uid || ""}`;
  return studentId ? `elev:${studentId}` : "";
}
