// ============================================================================
// Pluggporten – Plugga per område: rader för lärarens klasstabell
// (plugga-teacher-rows.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #446: ren logik (ingen DOM/Firestore) bakom
// src/teacher-plugga.js och src/teacher-plugga-elev.js, testad i
// test/plugga-teacher.test.js. Bygger på läs-API:t summarizeClass
// (src/plugga-stats.js, #445) – ingen egen datalogik, bara det tabellen behöver:
// möjliga stjärnor (ur områdesinnehållet), sortering, färgnivåer, svagaste/
// starkaste kategori och en "senast aktiv"-text. Jfr src/lasresan/teacher-rows.js.
//
// ⚠️ BOOTGRAF (#271): NY fil – laddas bara via teacher-plugga.js, som i sin tur
// importeras dynamiskt från teacher-class.js.
// ============================================================================

/** Kolumner i visningsordning. `num` → första klick sorterar fallande. */
export const PLUGGA_COLUMNS = [
  { key: "namn", label: "Elev", num: false },
  { key: "completed", label: "Genomförda", num: true, title: "Klarade övningar (spellägen) i urvalet" },
  { key: "pct", label: "Rätt %", num: true, title: "Andel rätt på kategoriserade frågor" },
  { key: "stars", label: "Stjärnor", num: true, title: "Intjänade av möjliga stjärnor" },
  { key: "lastMs", label: "Senast aktiv", num: true },
];

/** Andel i hela procent (0–100), eller null om nämnaren är 0. */
const pctOf = (a, b) => (b > 0 ? Math.round((100 * a) / b) : null);

/**
 * Tabellrader ur summarizeClass(...).rows. `maxStars` = urvalets möjliga
 * stjärnor (areaMaxStars summerat över valda områden) – summarizeClass känner
 * bara elevens SPELADE lägen, inte områdets innehåll.
 * @param {Array} summaryRows
 * @param {number} maxStars
 */
export function pluggaTeacherRows(summaryRows, maxStars) {
  return (summaryRows || []).map((r) => {
    const max = Math.max(maxStars || 0, r.stars);
    return {
      ...r,
      possibleStars: max,
      possibleStarPct: pctOf(r.stars, max),
      lastMs: r.lastPlayed instanceof Date ? r.lastPlayed.getTime() : null,
    };
  });
}

function cmp(a, b, key) {
  if (key === "namn") return String(a.namn || "").localeCompare(String(b.namn || ""), "sv");
  return a[key] - b[key];
}

/**
 * Sortera rader. Saknade värden (null – t.ex. rätt % utan kategoriserade svar,
 * aldrig aktiv) hamnar alltid sist; lika värden ordnas på namn.
 */
export function sortPluggaRows(rows, key = "namn", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return (rows || []).slice().sort((a, b) => {
    const an = a[key] == null;
    const bn = b[key] == null;
    if (an !== bn) return an ? 1 : -1;
    const c = an ? 0 : cmp(a, b, key) * sign;
    return c || cmp(a, b, "namn");
  });
}

/** Nästa sorteringsläge efter klick på kolumn `key`. */
export function nextPluggaSort(current, key) {
  if (current && current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  const col = PLUGGA_COLUMNS.find((c) => c.key === key);
  return { key, dir: col && col.num ? "desc" : "asc" };
}

/** Färgklass för en procent (samma gränser som klassmatrisen/Läsresan). null → "tom". */
export function pctLevel(pct) {
  if (pct == null || !Number.isFinite(pct)) return "tom";
  if (pct >= 67) return "hog";
  if (pct >= 34) return "mellan";
  return "lag";
}

/**
 * Svagaste och starkaste kategori ur en perCategory-lista (categoryBreakdown).
 * Bara kategorier med minst `minAnswered` svar jämförs, och det krävs minst två
 * sådana med olika rätt-% – annars finns inget att peka ut (null).
 * @returns {{weakest:(string|null), strongest:(string|null)}}
 */
export function weakStrong(perCategory, minAnswered = 1) {
  const cands = (perCategory || []).filter((c) => c.t >= minAnswered && c.pct != null);
  if (cands.length < 2) return { weakest: null, strongest: null };
  // Lägst %, vid lika: flest svar (mest underlag) först.
  const asc = cands.slice().sort((a, b) => a.pct - b.pct || b.t - a.t);
  const lo = asc[0];
  const hi = asc[asc.length - 1];
  if (lo.pct === hi.pct) return { weakest: null, strongest: null };
  return { weakest: lo.key, strongest: hi.key };
}

/** Svensk "senast aktiv"-text ur ett Date, relativt `now`. */
export function lastActiveText(date, now = new Date()) {
  if (!(date instanceof Date)) return "aldrig";
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(date)) / 86400000);
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dagar sedan`;
  if (days < 14) return "1 vecka sedan";
  if (days < 31) return `${Math.round(days / 7)} veckor sedan`;
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}
