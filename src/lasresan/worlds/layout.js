// ============================================================================
// Läsresan – hjälp för stegpositioner (src/lasresan/worlds/layout.js)
// ----------------------------------------------------------------------------
// Ren geometri: en slingrande stig ("serpentin") med N jämnt fördelade steg i
// en scen. Används av PLACEHOLDER-världarna så kartan går att rita innan
// issue 2 (kartvyn) handplacerar riktiga stegpositioner. En värld får alltid
// ange egna `stepPositions` i stället.
// ============================================================================

/**
 * @param {number} steps antal steg
 * @param {{width?:number, height?:number, rows?:number, margin?:number}} [opts]
 * @returns {{x:number, y:number}[]} positioner i scenens koordinater, steg 1 först
 *   (nederst till vänster), stigen slingrar uppåt rad för rad.
 */
export function serpentinePositions(steps, opts = {}) {
  const width = opts.width || 1600;
  const height = opts.height || 1000;
  const rows = Math.max(1, opts.rows || 4);
  const margin = opts.margin == null ? 140 : opts.margin;
  const perRow = Math.ceil(steps / rows);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const t = perRow > 1 ? col / (perRow - 1) : 0.5;
    const along = row % 2 === 0 ? t : 1 - t; // varannan rad tillbaka
    const x = margin + along * (width - 2 * margin);
    const rowY = rows > 1 ? row / (rows - 1) : 0.5;
    // Lätt våg inom raden så stigen inte blir spikrak.
    const wave = Math.sin(t * Math.PI * 2) * 18;
    const y = height - margin - rowY * (height - 2 * margin) + wave;
    out.push({ x: Math.round(x), y: Math.round(y) });
  }
  return out;
}
