// ============================================================================
// Förhandsvisningen av kompisläget (#780): låtsasklassen 4A med fyra elever,
// schack påslaget, namnen i classProjections (som i appen). Bara i preview.
// ============================================================================

export const KLASS_ID = "pv-4a";
export const ELEVER = [
  { uid: "pv-alva", namn: "Alva", farg: "#ff6b9d" },
  { uid: "pv-bilal", namn: "Bilal", farg: "#2f80ed" },
  { uid: "pv-cleo", namn: "Cleo", farg: "#27ae60" },
  { uid: "pv-dante", namn: "Dante", farg: "#9b51e0" },
];

export const elevFor = (id) => ELEVER.find((e) => e.uid === id || e.uid === `pv-${id}`) || ELEVER[0];

/** Avatar i förhandsvisningen: en färgad cirkel med initialen. */
export const avatarHtml = (e) =>
  `<span class="pv-avatar" style="background:${e.farg}">${e.namn[0]}</span>`;

/** Lägg in klassen (idempotent: rör inte lobbyn eller partierna). */
export function seedKlass(db, { enabled = true } = {}) {
  db.skriv(`classes/${KLASS_ID}`, {
    name: "4A", studentIds: ELEVER.map((e) => e.uid), enabledModules: enabled ? ["schack"] : [], hiddenModules: [],
  });
  db.skriv(`classProjections/${KLASS_ID}`, {
    members: Object.fromEntries(ELEVER.map((e) => [e.uid, { namn: e.namn }])),
  });
}
