// ============================================================================
// Pluggporten – lärarsidan: Mina klasser – flikar och val (teacher-mina-val.js)
// ----------------------------------------------------------------------------
// #804 (epic #802 §3.1). Ren modul utan importer och utan DOM, så att den kan
// testas i node (test/lararsida-mina-klasser.test.js):
//   * MINA_FLIKAR  – de fyra flikarna med undertext och vilka sektioner ur
//                    CLASS_SECTIONS de visar (för årskurslärare resp. admin)
//   * startVal     – vilken klass/flik/underflik som visas när sidan öppnas:
//                    URL (?klass=&flik=&del=, gamla ?sektion=) → sparat → först
//   * minaHash     – adressen som speglar valet (#/larare/mina-klasser?klass=…)
//   * hittaKlass / filtreraKlasser – klass-id eller namn ("4B") och sökningen
//                    i rullgardinen (fler än MANGA_KLASSER klasser)
// Laddas bara med import() via teacher-mina-klasser.js (#271).
// ============================================================================

export const MINA_BASE = "#/larare/mina-klasser";

/** Fler klasser än så här → sökbar rullgardin i stället för knappraden (§3.1). */
export const MANGA_KLASSER = 8;

/**
 * Flikarna (§3.1). sections = vad årskurslärare ser; admin = vad admin ser i
 * stället (Elever: hela medlemshanteraren – den har allt Inloggning har – plus
 * Klasscentret). Nivåerna för Läsresan och Ekvationsresan bor i statistikens
 * underflikar (#506) och följer alltså med Hur går det?.
 */
export const MINA_FLIKAR = [
  { key: "hur", label: "Hur går det?", sub: "Statistik", sections: ["statistik"] },
  { key: "ser", label: "Vad eleverna ser", sub: "Områden och moduler", sections: ["omraden", "synlighet", "lagen"] },
  { key: "fokus", label: "Fokusläge", sub: "Lås till en sak", sections: ["fokus"] },
  { key: "elever", label: "Elever", sub: "Inloggning och konton", sections: ["inloggning"], admin: ["elever", "klasscenter"] },
];

/** Flikens sektionsnycklar för rollen. */
export const flikSektioner = (flik, admin) => (admin && flik.admin) || flik.sections;

/** Gamla ?sektion= (Klasser/Statistik före #804) → [flik, ev. statistikens underflik]. */
export const SEKTION_TILL_FLIK = {
  statistik: ["hur"], schack: ["hur", "schack"], omraden: ["ser"], lagen: ["ser"], synlighet: ["ser"],
  fokus: ["fokus"], inloggning: ["elever"], elever: ["elever"], klasscenter: ["elever"],
};

const norm = (s) => String(s ?? "").trim().toLocaleLowerCase("sv");

/** Klass ur ?klass= – id först, annars namnet utan skiftlägeskänslighet ("4B"). */
export function hittaKlass(classes, q) {
  if (!q) return null;
  return classes.find((c) => c.id === q) || classes.find((c) => norm(c.name) === norm(q)) || null;
}

/** Klasserna vars namn (eller id) innehåller söktexten. Tom text → alla. */
export function filtreraKlasser(classes, text) {
  const t = norm(text);
  return t ? classes.filter((c) => norm(c.name || c.id).includes(t) || norm(c.id).includes(t)) : classes;
}

/**
 * Valet när sidan öppnas.
 * @param {Array} sorted  klasserna i visningsordning
 * @param {{query?: URLSearchParams, saved?: string|null, statsSaved?: string|null}} o
 * @returns {{id: string|null, flik: string, del: string|null}}
 */
export function startVal(sorted, { query = new URLSearchParams(), saved = null, statsSaved = null } = {}) {
  const klass = hittaKlass(sorted, query.get("klass")) || hittaKlass(sorted, saved) || sorted[0] || null;
  const fran = SEKTION_TILL_FLIK[query.get("sektion")] || [];
  const flikar = MINA_FLIKAR.map((f) => f.key);
  const flik = fran[0] || (flikar.includes(query.get("flik")) ? query.get("flik") : "hur");
  const del = fran[1] || query.get("del") || statsSaved || null;
  return { id: klass ? klass.id : null, flik, del };
}

/** Adressen som speglar valet; underfliken (del) bara under Hur går det?. */
export function minaHash(id, flik, del) {
  if (!id) return MINA_BASE;
  const q = new URLSearchParams({ klass: id, flik });
  if (flik === "hur" && del) q.set("del", del);
  return `${MINA_BASE}?${q}`;
}
