// ============================================================================
// Ekvationsresan – MIN LÖSNING som mattehäfte (src/ekvationsresan/min-losning.js)
// ----------------------------------------------------------------------------
// #618, spec E1.2/E1.3. Ritar notation.js-raderna ({ kind, segments, text })
// som HTML: elevens operation (segment med mark "op") i rött, x/4 med
// bråkstreck. Ren strängbyggare (ingen DOM-state) – lärarens elevdetalj
// (#619) ritar elevens räknegång med samma funktion ur replayRows().
//
//   rowsHtml(rows, { fromIndex, ghost })  → <li>-rader (fromIndex = första nya)
//   rowHtml(row)                          → en rads innehåll
// Ett nytt drag (raden "op") börjar ett nytt stycke i häftet, så räknegången
// läses som i spec-exemplet: operationsrad, ev. mellanled, förenklad rad.
// ============================================================================

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function segHtml(s) {
  const cls = `ekv-s ekv-s--${s.t}${s.mark === "op" ? " ekv-rod" : ""}`;
  if (s.num) {
    return `<span class="${cls} ekv-frac"><span>${esc(s.num)}</span><span>${esc(s.den)}</span></span>`;
  }
  return `<span class="${cls}">${esc(s.text)}</span>`;
}

/** En rad: segmenten med mellanrum, men inte innanför parenteser (som rowText). */
export function rowHtml(row) {
  const segs = row.segments || [];
  let out = "";
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    const tight = i === 0 || (prev.t === "paren" && prev.text.endsWith("(")) || (s.t === "paren" && s.text === ")");
    out += (tight ? "" : " ") + segHtml(s);
  });
  return out;
}

/**
 * Raderna som <li>. `fromIndex` = index för första raden som ska få
 * inkommande animation; `ghost` = förslag (hjälpens steg 3), inte elevens rad.
 */
export function rowsHtml(rows, { fromIndex = Infinity, ghost = false } = {}) {
  return rows
    .map((r, i) => {
      const cls = [
        "ekv-rad",
        `ekv-rad--${r.kind}`,
        r.kind === "op" && i > 0 ? "ekv-rad--nytt-drag" : "",
        i >= fromIndex ? "ekv-rad--ny" : "",
        ghost ? "ekv-rad--forslag" : "",
      ].filter(Boolean).join(" ");
      return `<li class="${cls}" aria-label="${esc(r.text)}">${rowHtml(r)}</li>`;
    })
    .join("");
}
