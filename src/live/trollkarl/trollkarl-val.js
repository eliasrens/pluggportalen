// ============================================================================
// Trollkarlsduellen (#536): TROLLKARLSVALET – vilken trollkarl varje klass har
// (spec §5). Ren logik, ingen DOM/Firebase. Sparas i sessionen som
// liveSessions/{sid}.wizards = { classId: <trollkarls-id> } – bara i
// tvåklassmatcher, aldrig samma på båda sidor, ändras bara i lobbyn
// (firestore.rules, liveWizardsOk – samma id-lista som registret nedan).
// Ingen klass är permanent kopplad till en person: valet hör till matchen.
//
// REGISTRET (#818): TROLLKARLAR är den enda listan över trollkarlar. En ny
// trollkarl = en rad här + ansiktslager (ref/<id>-{happy,angry,sad}.webp,
// admin/trollkarl-ansikten/) + THEME/FACE i trollkarl-delar.js + färger i
// trollkarl.css + id:t i firestore.rules liveWizardsOk. test/trollkarl-
// karna.test.js kontrollerar att inget av det saknas.
//
// API
//   TROLLKARLAR                   [{ id, namn }] – i valets ordning
//   WIZARDS                       ["rasmus", "elias", "emre"]
//   WIZARD_NAMES                  { rasmus: "Rasmus", … }
//   wizardName(id)                → namnet ur registret ("?" om okänt)
//   defaultWizards(classIds)      → { [id0]: "rasmus", [id1]: "elias" } | null
//   validWizards(map, classIds)   → true om två OLIKA registrerade trollkarlar
//                                   på exakt de två klasserna
//   resolveWizards(session)       → giltigt val ur sessionen, annars default (| null)
//   swapWizards(map)              → samma klasser, trollkarlarna bytta
//   chooseWizard(map, classId, who) → klassen får `who`; har den andra klassen
//                                   redan `who` får den klassens förra trollkarl
// ============================================================================

export const TROLLKARLAR = [
  { id: "rasmus", namn: "Rasmus" },
  { id: "elias", namn: "Elias" },
  { id: "emre", namn: "Emre" },
];

export const WIZARDS = TROLLKARLAR.map((t) => t.id);
export const WIZARD_NAMES = Object.fromEntries(TROLLKARLAR.map((t) => [t.id, t.namn]));

export const wizardName = (id) => WIZARD_NAMES[id] || "?";

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
  const ids = Object.keys(map || {});
  if (ids.length !== 2) return { ...map };
  return { [ids[0]]: map[ids[1]], [ids[1]]: map[ids[0]] };
}

export function chooseWizard(map, classId, who) {
  const out = { ...map };
  if (!WIZARDS.includes(who) || !(classId in out)) return out;
  const prev = out[classId];
  for (const id of Object.keys(out)) if (id !== classId && out[id] === who) out[id] = prev;
  out[classId] = who;
  return out;
}
