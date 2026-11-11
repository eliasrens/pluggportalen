// ============================================================================
// Kurragömma (#837): ÖVERLÄGGET – de få DOM-bitar scenen äger ovanpå bilden,
// lika i 3D och 2D: pilen i skärmkanten mot visslingen (§1.5), hjärtslagets
// pulserande kant (§1.3) och notisraden vid automatisk sänkning (§4.4).
// Ikonen är SVG (inga emojier, §0.2). Klasserna är kg-* (kurragomma-scen.css).
//
// API: skapaOverlagg(yta) → { pil(punkt | null, storlek), hjartslag(bool), notis(text), destroy() }
// ============================================================================

const NOTIS_MS = 4000;
const PIL_MARGINAL = 28;

const PIL_SVG = '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">' +
  '<circle cx="24" cy="24" r="21" fill="#FFB020" stroke="#3B3350" stroke-width="3"/>' +
  '<path d="M24 10 L36 26 L28 26 L28 38 L20 38 L20 26 L12 26 Z" fill="#3B3350"/></svg>';

export function skapaOverlagg(yta) {
  const kant = document.createElement("div");
  kant.className = "kg-kant";
  kant.setAttribute("aria-hidden", "true");
  const pil = document.createElement("div");
  pil.className = "kg-pil";
  pil.setAttribute("aria-hidden", "true");
  pil.innerHTML = PIL_SVG;
  pil.hidden = true;
  const notis = document.createElement("div");
  notis.className = "kg-notis";
  notis.setAttribute("role", "status");
  notis.hidden = true;
  yta.append(kant, pil, notis);
  let notisT = 0;

  return {
    /** Pilen: visas bara när visslingens punkt är utanför bilden. */
    pil(punkt, storlek) {
      if (!punkt || punkt.inne) { pil.hidden = true; return; }
      const { w, h } = storlek;
      const cx = w / 2, cy = h / 2;
      // Punkter bakom kameran projiceras spegelvänt – vänd riktningen.
      let dx = punkt.sx - cx, dy = punkt.sy - cy;
      if (punkt.framfor === false) { dx = -dx; dy = -dy; }
      const vinkel = Math.atan2(dy, dx);
      const rx = cx - PIL_MARGINAL, ry = cy - PIL_MARGINAL;
      const k = Math.min(Math.abs(rx / (Math.cos(vinkel) || 1e-6)), Math.abs(ry / (Math.sin(vinkel) || 1e-6)));
      pil.style.left = `${(cx + Math.cos(vinkel) * k).toFixed(0)}px`;
      pil.style.top = `${(cy + Math.sin(vinkel) * k).toFixed(0)}px`;
      pil.style.transform = `translate(-50%, -50%) rotate(${(vinkel + Math.PI / 2).toFixed(3)}rad)`;
      pil.hidden = false;
    },
    hjartslag(v) { kant.classList.toggle("kg-kant-hjartslag", !!v); },
    notis(text) {
      notis.textContent = text;
      notis.hidden = false;
      clearTimeout(notisT);
      notisT = setTimeout(() => { notis.hidden = true; }, NOTIS_MS);
    },
    destroy() {
      clearTimeout(notisT);
      kant.remove(); pil.remove(); notis.remove();
    },
  };
}
