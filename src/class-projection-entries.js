// ============================================================================
// Pluggportalen – klass-projektionens ENTRY-form (ren shaping, ingen Firebase)
// ----------------------------------------------------------------------------
// De rena hjälparna som formar data mellan tre representationer:
//   students/{id} + studentData/{id}   →  members-entry (projectionEntryFrom)
//   members-entry (keyad på id)         →  boende-objekt byn ritar (entryToBoende)
// samt fallback-entry för nekad läsning och self-heal-diffen (missingMemberIds).
//
// Utbrutet ur class-projection.js (som bär Firestore-store:n) så shaping-logiken
// kan enhetstestas isolerat och båda filerna hålls under filtaket. class-
// projection.js re-exporterar allt härifrån, så befintliga importvägar består.
// ============================================================================

import { xpFromStudentData, progressTotals } from "./leveling.js";

/**
 * REN hjälpare: bygg en members-entry ur ett students-dokument + dess
 * studentData. Samma fält-härledning som getStudentsWithLooks (en KÄLLA för
 * fältformen), men keyad in i projektionen och med `husLast` i stället för det
 * härledda `locked` (vyn härleder locked ur husLast).
 * @param {object} student students/{id}-data (namn, username, avatarId)
 * @param {object} sd       studentData/{id}-data
 */
export function projectionEntryFrom(student = {}, sd = {}) {
  const s = student || {};
  const d = sd || {};
  const { completed, stars } = progressTotals(d.progress);
  return {
    namn: s.namn || "",
    username: s.username || "",
    avatarId: d.avatarId || s.avatarId || "fox",
    avatarItems: Array.isArray(d.avatarItems) ? d.avatarItems : [],
    paletteId: (d.room && d.room.paletteId) || null,
    husSkalId: d.husSkalId || null,
    stars,
    xp: xpFromStudentData(d),
    completed,
    husLast: d.husLast === true,
  };
}

/**
 * REN hjälpare: fallback-entry när studentData INTE gick att läsa. Vid en nekad
 * läsning (locked=true) är huset låst (husLast → true) och vi ritar ett
 * generiskt hus; vid andra fel faller vi tyst tillbaka på default-utseendet.
 */
export function fallbackEntryFrom(student = {}, locked = false) {
  const s = student || {};
  return {
    namn: s.namn || "",
    username: s.username || "",
    avatarId: s.avatarId || "fox",
    avatarItems: [],
    paletteId: null,
    husSkalId: null,
    stars: 0,
    xp: 0,
    completed: 0,
    husLast: !!locked,
  };
}

/** Vilka av `memberIds` saknar en entry i projektionen? (för self-heal) */
export function missingMemberIds(members = {}, memberIds = []) {
  const have = members && typeof members === "object" ? members : {};
  return [...new Set((Array.isArray(memberIds) ? memberIds : []).filter(Boolean))].filter(
    (id) => !have[id]
  );
}

/**
 * REN hjälpare: gör en members-entry (keyad på `id` i projektionen) till det
 * översikts-objekt som byn/grannbyn ritar (mountByScen + aggregateKlassStats).
 * Samma form som den gamla getStudentsWithLooks gav: `id` läggs på och `locked`
 * härleds ur entryns `husLast` (låst hus ritas 🔒). Egen elev märks aldrig låst
 * ute i byn (mountByScen gate:ar `!me`), så ingen special-casing behövs här.
 */
export function entryToBoende(id, entry = {}) {
  const e = entry || {};
  return {
    id,
    namn: e.namn || "",
    username: e.username || "",
    avatarId: e.avatarId || "fox",
    avatarItems: Array.isArray(e.avatarItems) ? e.avatarItems : [],
    paletteId: e.paletteId || null,
    husSkalId: e.husSkalId || null,
    xp: Math.max(0, Number(e.xp) || 0),
    completed: Math.max(0, Number(e.completed) || 0),
    stars: Math.max(0, Number(e.stars) || 0),
    locked: !!e.husLast,
  };
}

/**
 * REN hjälpare: bygg översikts-arrayen (boende) ur en members-map, i ordningen
 * `orderIds` (deduplicerad). Id:n som saknar en entry hoppas tyst över – efter
 * self-heal ska de dock alltid finnas.
 */
export function boendeFromMembers(members = {}, orderIds = []) {
  const m = members && typeof members === "object" ? members : {};
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(orderIds) ? orderIds : []) {
    if (!id || seen.has(id) || !m[id]) continue;
    seen.add(id);
    out.push(entryToBoende(id, m[id]));
  }
  return out;
}
