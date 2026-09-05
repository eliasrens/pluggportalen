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
//
// Skylten visas inte längre som ett alltid-påslaget block (som skymde byn) utan
// bakom en liten stjärn-toggle (✨) uppe till höger på by-nivån: klassStatsMarkup
// ger toggeln + den (default infällda) skylten, mountKlassStatsToggle() sköter
// utfällning/infällning och ifyllning. Så pages-varld.js slipper svälla med den
// nya presentationslogiken (samma modul-mönster som klassStatsSkylt själv).
// ============================================================================

/** Svensk tusentalsformatering (1234 → "1 234"). Tål trasiga tal → 0. */
function nf(n) {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString("sv-SE");
}

/**
 * Markup för stjärn-toggeln + den utfällbara stats-skylten (uppe till höger på
 * by-nivån). Toggeln är kompakt (✨ + klassens totala stjärnor) och fäller
 * ut/in skylten vid klick; skylten är default infälld så byn inte skyms.
 * Tillgänglighet: knappen bär aria-expanded + aria-controls, skylt-innehållet
 * har role="status" (aria-live) så utfällningen läses upp.
 * @returns {string} innerHTML att lägga i overlay-toppen (#klass-toggle-wrap)
 */
export function klassStatsMarkup() {
  return `<button class="varld-knapp varld-klass-stjarna" id="klass-toggle"
      aria-expanded="false" aria-controls="klass-stats"
      title="Klassens gemensamma stjärnor – klicka för att se klassens framsteg">
      ✨ <span class="ks-toggle-tal" id="klass-toggle-tal">0</span>
    </button>
    <div class="varld-klass-stats" id="klass-stats" role="status" hidden></div>`;
}

/**
 * Koppla upp stjärn-toggeln: klick fäller ut/in skylten (aria-expanded följer
 * med), och den lilla ✨-siffran + skylten fylls ur klassaggregatet. Returnerar
 * `fyll()` (mata in stats när byn laddats) och `visa()` (visa/dölj hela togglen;
 * döljs den fälls skylten även ihop så den inte står öppen nästa by-besök).
 *
 * @param {object} o
 * @param {HTMLElement} o.wrap    behållaren (#klass-toggle-wrap) som visas/döljs
 * @param {HTMLElement} o.toggle  ✨-knappen (#klass-toggle)
 * @param {HTMLElement} o.talEl   siffran i knappen (#klass-toggle-tal)
 * @param {HTMLElement} o.statsEl skylt-innehållet (#klass-stats)
 * @returns {{fyll:(stats:object, klassNamn?:string)=>void, visa:(pa:boolean)=>void}}
 */
export function mountKlassStatsToggle({ wrap, toggle, talEl, statsEl }) {
  function setOppen(oppen) {
    statsEl.hidden = !oppen;
    toggle.setAttribute("aria-expanded", String(oppen));
  }
  setOppen(false); // default infälld/kompakt
  toggle.addEventListener("click", () => setOppen(statsEl.hidden));
  return {
    fyll(stats, klassNamn = "") {
      statsEl.innerHTML = klassStatsSkylt(stats, klassNamn);
      talEl.textContent = nf(stats?.totalStars);
    },
    visa(pa) {
      wrap.hidden = !pa;
      if (!pa) setOppen(false); // lämnar vi by-nivån → fäll ihop igen
    },
  };
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
