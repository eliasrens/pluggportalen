// ============================================================================
// Pluggportalen – klassbyns gemensamma statistik-skylt (varld-by-stats.js)
// ----------------------------------------------------------------------------
// Ren rendering av den lilla "byskylten" som visas överst i klassbyn (#/elev/by)
// och stoltserar med klassens GEMENSAMMA, BARA POSITIVA framsteg: en gemensam
// klass-nivå (med mätare mot nästa nivå), hur många övningar klassen klarat
// tillsammans och hur många stjärnor de samlat. Inga jämförelser, inga per-elev-
// tal, inget utpekande – bara sådant som växer när klassen pluggar.
//
// Aggregatet räknas fram i leveling.aggregateKlassStats (rent) ur kamraternas
// klass-scopat läsbara studentData; den här modulen bara målar upp det.
// ============================================================================

/** Svensk tusentalsformatering (1234 → "1 234"). Tål trasiga tal → 0. */
function nf(n) {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString("sv-SE");
}

/**
 * HTML för klassens statistik-skylt.
 * @param {object} stats  resultatet från leveling.aggregateKlassStats
 *   ({ level, progressRatio, totalCompleted, totalStars, totalXp, ... })
 * @param {string} [klassNamn]  klassens namn (t.ex. "6A"); tomt → "Klassen"
 * @returns {string} innerHTML för skylt-elementet (#klass-stats)
 */
export function klassStatsSkylt(stats, klassNamn = "") {
  const s = stats || {};
  const level = Math.max(1, Math.round(Number(s.level) || 1));
  // Andel mot nästa nivå (0–1) → procent för mätaren. Klampas så en trasig
  // ratio aldrig spränger baren.
  const pct = Math.round(Math.min(1, Math.max(0, Number(s.progressRatio) || 0)) * 100);
  const namn = String(klassNamn || "").trim();
  const rubrik = namn ? `Klass ${namn} tillsammans` : "Klassen tillsammans";

  return `
    <div class="ks-rubrik">🏘️ ${escHtml(rubrik)}</div>
    <div class="ks-niva">
      <span class="ks-niva-badge">⭐ Klass-nivå ${level}</span>
      <div class="ks-bar" role="img"
        aria-label="Klassen är ${pct}% på väg till nästa gemensamma nivå">
        <span class="ks-bar-fyll" style="width:${pct}%"></span>
      </div>
    </div>
    <div class="ks-rad">
      <span class="ks-stat">🏆 ${nf(s.totalCompleted)} övningar klarade</span>
      <span class="ks-stat">✨ ${nf(s.totalStars)} stjärnor</span>
    </div>`;
}

/** Minimal HTML-escape för klassnamn från Firestore. */
function escHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
