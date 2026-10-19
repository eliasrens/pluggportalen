// ============================================================================
// Pluggporten – lärarsidan: elevtabellens val (teacher-elever-val.js)
// ----------------------------------------------------------------------------
// #805 (epic #802 §3.4). Ren modul utan importer och utan DOM, så att node-
// testerna (test/lararsida-elever-admin.test.js) kan läsa exakt vad varje roll
// får i menyn ⋯:
//   * MENYVAL   – raderna i ⋯-menyn; admin:true = bara admin (döljs helt för
//                 årskurslärare – reglerna spärrar ändå på riktigt, #678)
//   * menyFor   – menyns rader för rollen
//   * matcharSok – sökfältet: namn eller användarnamn, utan skiftlägeskänslighet
//   * fordelaMynt – "Ge hela klassen mynt": antalet som ska ges, eller ett fel
// Laddas bara med import() via teacher-elever-tabell.js (#271).
// ============================================================================

/**
 * Menyn ⋯ per elev, i ordning. farlig = destruktiv (röd, kräver bekräftelse
 * i en ruta på sidan). adminLabel = text för admin när admin kan mer.
 */
export const MENYVAL = [
  { key: "losen", label: "Byt lösenord", adminLabel: "Byt lösenord eller användarnamn", icon: "key", admin: false },
  { key: "namn", label: "Ändra namn och avatar", icon: "pencil", admin: true },
  { key: "mynt", label: "Ge mynt", icon: "plus", admin: true },
  { key: "ur", label: "Ta ur klassen", icon: "minus", admin: true, farlig: true },
  { key: "bort", label: "Ta bort konto", icon: "trash", admin: true, farlig: true },
];

/** Menyns rader för rollen (admin = true/false). */
export const menyFor = (admin) => MENYVAL.filter((v) => admin || !v.admin);

/** Knapparna för hela klassen (§3.4), i ordning. admin:true = bara admin. */
export const KLASSKNAPPAR = [
  { key: "skriv-ut", label: "Skriv ut inloggningskort", admin: false },
  { key: "mynt", label: "Ge hela klassen mynt", admin: true },
  { key: "lagg-till", label: "Lägg till elev", admin: true },
];

const norm = (s) => String(s ?? "").trim().toLocaleLowerCase("sv");

/** Matchar eleven söktexten (namn eller användarnamn)? Tom text → alla. */
export function matcharSok(s, text) {
  const t = norm(text);
  return !t || norm(s.namn).includes(t) || norm(s.username).includes(t);
}

/** Antal mynt per elev ur fältet, eller { fel } (heltal 1–1000). */
export function fordelaMynt(varde) {
  const n = Math.floor(Number(varde));
  if (!Number.isFinite(n) || n <= 0) return { fel: "Skriv ett antal (positivt tal)." };
  if (n > 1000) return { fel: "Högst 1000 mynt per elev åt gången." };
  return { antal: n };
}
