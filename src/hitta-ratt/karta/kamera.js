// ============================================================================
// Hitta rätt! – kartans kamera, ren matte (src/hitta-ratt/karta/kamera.js) · #606
// ----------------------------------------------------------------------------
// Ingen DOM. Kartmotorn (kartmotor.js) håller kameran som
//   { k, cx, cy }   k = skärm-px per kartenhet, (cx, cy) = kartpunkten i vyns mitt
// och gör om den till EN transform: matrix(k 0 0 k tx ty). Den formen är lätt
// att begränsa (zoom- och panoreringsgränser per pack) och att animera
// (geometrisk zoom + linjär mittpunkt).
//
// Gränser: { kMin, kMax, ruta: [xmin, ymin, xmax, ymax] } – vyns MITTPUNKT
// måste ligga inom rutan (förlåtande: kartan kan aldrig tappas bort).
// ============================================================================

/** Kameran → transformens { k, tx, ty } för en vy W × H px. */
export function tillTransform({ k, cx, cy }, W, H) {
  return { k, tx: W / 2 - cx * k, ty: H / 2 - cy * k };
}

/** Skärm-px (relativt kartans värd) → kartkoordinat. */
export function skarmTillKarta(kam, W, H, sx, sy) {
  const { k, tx, ty } = tillTransform(kam, W, H);
  return [(sx - tx) / k, (sy - ty) / k];
}

/** Kartkoordinat → skärm-px. */
export function kartaTillSkarm(kam, W, H, [x, y]) {
  const { k, tx, ty } = tillTransform(kam, W, H);
  return [x * k + tx, y * k + ty];
}

/** Håll kameran inom gränserna (zoom först, sedan mittpunkten). */
export function begransa(kam, { kMin, kMax, ruta }) {
  const k = Math.min(kMax, Math.max(kMin, kam.k));
  const [x0, y0, x1, y1] = ruta;
  return {
    k,
    cx: Math.min(x1, Math.max(x0, kam.cx)),
    cy: Math.min(y1, Math.max(y0, kam.cy)),
  };
}

/**
 * Zooma med faktorn så att kartpunkten under (sx, sy) står still.
 * Zoomen kläms först, så punkten står still även vid min/max-zoom.
 */
export function zoomaVid(kam, W, H, sx, sy, faktor, { kMin, kMax }) {
  const k = Math.min(kMax, Math.max(kMin, kam.k * faktor));
  const [px, py] = skarmTillKarta(kam, W, H, sx, sy);
  return { k, cx: px - (sx - W / 2) / k, cy: py - (sy - H / 2) / k };
}

/** Panorera med (dx, dy) skärm-px (kartan följer fingret). */
export function panorera(kam, dx, dy) {
  return { k: kam.k, cx: kam.cx - dx / kam.k, cy: kam.cy - dy / kam.k };
}

/**
 * Kamera som passar in kartrutan i vyn, med luft i px per kant
 * { v, t, h, b } (t.ex. plats för zoomknapparna till höger).
 */
export function passaIn([x0, y0, x1, y1], W, H, luft = {}) {
  const { v = 0, t = 0, h = 0, b = 0 } = luft;
  const iw = Math.max(1, W - v - h);
  const ih = Math.max(1, H - t - b);
  const k = Math.min(iw / Math.max(x1 - x0, 1e-9), ih / Math.max(y1 - y0, 1e-9));
  // Mittpunkten flyttas så att rutans mitt hamnar i den inre ytans mitt.
  return {
    k,
    cx: (x0 + x1) / 2 - (v - h) / 2 / k,
    cy: (y0 + y1) / 2 - (t - b) / 2 / k,
  };
}

/** Mjuk in-ut (kvadratisk) för t i [0, 1]. */
/** Minsta ruta [x0, y0, x1, y1] runt punkterna [[x, y], …]. */
export function omslutRuta(punkter) {
  const xs = punkter.map((q) => q[0]), ys = punkter.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function lattnad(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Interpolera kameran: geometrisk zoom (jämn känsla) och linjär mittpunkt. */
export function interpolera(fran, mal, e) {
  return {
    k: fran.k * (mal.k / fran.k) ** e,
    cx: fran.cx + (mal.cx - fran.cx) * e,
    cy: fran.cy + (mal.cy - fran.cy) * e,
  };
}

/**
 * Omslutande ruta [xmin, ymin, xmax, ymax] för en SVG-väg med kommandona
 * M/m L/l H/h V/v Z/z (förprojicerade geofiler använder M, l, z). Används
 * för att avgöra vilka områden som är så små att de behöver en klickring –
 * utan getBBox(), som ger nollor om kartan ännu inte syns.
 */
export function vagRuta(d) {
  const tok = String(d).match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "M", i = 0, forsta = true;
  const med = () => {
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  };
  while (i < tok.length) {
    const t = tok[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") { x = sx; y = sy; }
      continue;
    }
    const n = (j) => Number(tok[i + j]);
    switch (cmd) {
      case "M": x = n(0); y = n(1); i += 2; break;
      case "m": x += n(0); y += n(1); i += 2; break;
      case "L": x = n(0); y = n(1); i += 2; break;
      case "l": x += n(0); y += n(1); i += 2; break;
      case "H": x = n(0); i += 1; break;
      case "h": x += n(0); i += 1; break;
      case "V": y = n(0); i += 1; break;
      case "v": y += n(0); i += 1; break;
      default: i += 1; continue; // okänt kommando: hoppa över talet
    }
    if (cmd === "M" || cmd === "m") {
      sx = x; sy = y;
      cmd = cmd === "M" ? "L" : "l"; // efterföljande par är linjer
    }
    med();
    forsta = false;
  }
  return forsta ? [0, 0, 0, 0] : [xmin, ymin, xmax, ymax];
}
