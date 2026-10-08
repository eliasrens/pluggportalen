// ============================================================================
// Trollkarlsduellen (#536): TROLLKARLSVALET – vilken klass är Rasmus och vilken
// är Elias (spec §5). Ren logik, ingen DOM/Firebase. Sparas i sessionen som
// liveSessions/{sid}.wizards = { classId: "rasmus" | "elias" } – bara i
// tvåklassmatcher, alltid en av varje, ändras bara i lobbyn (firestore.rules).
// Ingen klass är permanent kopplad till en person: valet hör till matchen.
//
// API
//   WIZARDS                       ["rasmus", "elias"]
//   WIZARD_NAMES                  { rasmus: "Rasmus", elias: "Elias" }
//   defaultWizards(classIds)      → { [id0]: "rasmus", [id1]: "elias" } | null
//   validWizards(map, classIds)   → true om exakt en av varje på exakt de två klasserna
//   resolveWizards(session)       → giltigt val ur sessionen, annars default (| null)
//   swapWizards(map)              → samma klasser, trollkarlarna bytta
// ============================================================================

export const WIZARDS = ["rasmus", "elias"];
export const WIZARD_NAMES = { rasmus: "Rasmus", elias: "Elias" };

const twoIds = (ids) => Array.isArray(ids) && ids.length === 2 && ids[0] !== ids[1];

export function defaultWizards(classIds) {
  if (!twoIds(classIds)) return null;
  return { [classIds[0]]: WIZARDS[0], [classIds[1]]: WIZARDS[1] };
}

export function validWizards(map, classIds) {
  if (!twoIds(classIds) || !map || typeof map !== "object") return false;
  const keys = Object.keys(map);
  if (keys.length !== 2 || !classIds.every((id) => keys.includes(id))) return false;
  const a = map[classIds[0]];
  const b = map[classIds[1]];
  return WIZARDS.includes(a) && WIZARDS.includes(b) && a !== b;
}

export function resolveWizards(session) {
  const ids = session?.participatingClassIds;
  return validWizards(session?.wizards, ids) ? { ...session.wizards } : defaultWizards(ids);
}

export function swapWizards(map) {
  const out = {};
  for (const [id, who] of Object.entries(map || {})) out[id] = who === "rasmus" ? "elias" : "rasmus";
  return out;
}
