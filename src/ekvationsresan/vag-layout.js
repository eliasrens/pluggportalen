// ============================================================================
// Ekvationsresan – vågens layout (src/ekvationsresan/vag-layout.js) · #617
// ----------------------------------------------------------------------------
// Ren logik: var varje bit (vag-scen.js) ligger i sin skål. Koordinater i
// skålens system: (0, 0) = mitten av skålens ovansida, y uppåt är NEGATIVT.
// En position är bitens nederkant-mitt { x, y, s (skala), o (opacitet), w, h }.
//
//   föremål  behållarna först, föremålen i rader om fem (lätta att räkna:
//            11 = 5 + 5 + 1); bredvid behållarna om det får plats, annars ovanpå
//   block    x-block och talbrickor i rader nerifrån och upp
//   grupper  skålen delas i a kolumner, varje grupp får en ram
// ============================================================================

/** Skålens innerbredd och stapelhöjd (viewBox-enheter, vag-konst.js). */
export const PAN = Object.freeze({ width: 320, height: 200 });
const CELL = 34; //   föremålens rutnät
const CONT = 60; //   behållarnas steg
const PER_ROW = 5;
const LIFT = 24;

/** Ungefärlig bredd för en etikett (segment med ev. bråkstreck). */
export function segsWidth(segs, fs) {
  return segs.reduce((w, s) => w + segWidth(s, fs), 0);
}

/** Ett segments bredd; + och − får luft runt sig ("8x + 29"). */
export function segWidth(s, fs) {
  const chars = s.num ? Math.max(s.num.length, s.den.length) : s.text.length;
  return chars * fs * 0.58 + fs * (s.t === "sign" ? 0.9 : 0.32);
}

export function pieceSize(p) {
  switch (p.kind) {
    case "cont": return [56, 56];
    case "item":
    case "hole": return [30, 30];
    case "xb": return [44, 50];
    case "xf": return [Math.max(52, segsWidth(p.segs, 24) + 22), 50];
    case "tile": return [Math.max(40, 20 + p.text.length * 15), 40];
    case "label": return [Math.max(90, segsWidth(p.segs, 30) + 40), 58];
    case "badge": return [Math.max(56, 26 + p.text.length * 12), 30];
    default: return [0, 0];
  }
}

const isFlow = (p) => p.kind !== "badge" && p.kind !== "frame" && !p.at;

/** Föremål i en ruta med bredden `width`, centrerat kring cx. */
function foremalBox(pieces, width, cx, out) {
  const conts = pieces.filter((p) => p.kind === "cont");
  const smalls = pieces.filter((p) => p.kind !== "cont");
  const contPerRow = Math.max(1, Math.min(conts.length, Math.floor((width + 4) / CONT)));
  const contRows = Math.ceil(conts.length / contPerRow) || 0;
  const contW = Math.min(conts.length, contPerRow) * CONT - 4;
  const cols = Math.max(1, Math.min(PER_ROW, Math.floor((width + 4) / CELL)));
  const itemW = Math.min(smalls.length, cols) * CELL - 4;
  const beside = conts.length && smalls.length && contRows === 1 && contW + 14 + itemW <= width;
  const total = beside ? contW + 14 + itemW : 0;
  const contLeft = beside ? cx - total / 2 : cx - contW / 2;
  conts.forEach((p, j) => {
    const r = Math.floor(j / contPerRow);
    const inRow = Math.min(contPerRow, conts.length - r * contPerRow);
    const left = beside ? contLeft : cx - (inRow * CONT - 4) / 2;
    out.set(p.key, { x: left + 28 + (j % contPerRow) * CONT, y: -r * (CONT + 2) });
  });
  const itemLeft = beside ? contLeft + contW + 14 : cx - itemW / 2;
  const base = beside ? 0 : -contRows * (CONT + 2);
  smalls.forEach((p, k) => {
    out.set(p.key, { x: itemLeft + 15 + (k % cols) * CELL, y: base - Math.floor(k / cols) * CELL });
  });
  const itemRows = Math.ceil(smalls.length / cols);
  return beside ? Math.max(CONT, itemRows * CELL) : -base + itemRows * CELL;
}

/** Block i rader nerifrån och upp, varje rad centrerad kring cx. → höjd */
function blockBox(pieces, width, cx, out) {
  const rows = [];
  let row = [];
  let w = 0;
  for (const p of pieces) {
    const [pw] = pieceSize(p);
    if (row.length && w + 6 + pw > width) {
      rows.push(row);
      row = [];
      w = 0;
    }
    w += (row.length ? 6 : 0) + pw;
    row.push(p);
  }
  if (row.length) rows.push(row);
  let y = 0;
  for (const r of rows) {
    const sizes = r.map(pieceSize);
    const rw = sizes.reduce((s, [pw]) => s + pw, 0) + 6 * (r.length - 1);
    let x = cx - rw / 2;
    r.forEach((p, i) => {
      out.set(p.key, { x: x + sizes[i][0] / 2, y });
      x += sizes[i][0] + 6;
    });
    y -= Math.max(...sizes.map(([, ph]) => ph)) + 8;
  }
  return -y - (rows.length ? 8 : 0);
}

function box(pieces, view, width, cx, out) {
  if (view === "foremal") return foremalBox(pieces, width, cx, out);
  return blockBox(pieces, width, cx, out);
}

/**
 * Positioner för ett leds bitar: arr = { pieces, groups }.
 * @returns {Map<string, {x, y, s, o, w, h}>}
 */
export function layoutSide(arr, view) {
  const pos = new Map();
  const pieces = arr.pieces || [];
  const flow = pieces.filter(isFlow);
  let top = 0;
  if (arr.groups > 1) {
    const cw = PAN.width / arr.groups;
    let hMax = 0;
    for (let g = 0; g < arr.groups; g++) {
      const cx = -PAN.width / 2 + cw * (g + 0.5);
      hMax = Math.max(hMax, box(flow.filter((p) => p.g === g), view, cw - 12, cx, pos));
    }
    for (const p of pieces.filter((p) => p.kind === "frame")) {
      pos.set(p.key, { x: -PAN.width / 2 + cw * (p.g + 0.5), y: 5, w: cw - 6, h: hMax + 14 });
    }
    top = hMax + 14;
  } else {
    top = box(flow, view, PAN.width, 0, pos);
  }
  for (const p of pieces) {
    if (p.at && pos.has(p.at)) pos.set(p.key, { ...pos.get(p.at) });
  }
  for (const p of pieces) {
    const at = pos.get(p.key);
    if (!at) continue;
    const [w, h] = pieceSize(p);
    at.w ??= w;
    at.h ??= h;
    at.s = p.lift ? 1.1 : 1;
    if (p.lift) at.y -= LIFT;
    at.o = p.ghost ? 0.5 : 1;
  }
  const badge = pieces.find((p) => p.kind === "badge");
  if (badge) {
    const [w, h] = pieceSize(badge);
    const lifted = pieces.some((p) => p.lift) ? LIFT + 6 : 0;
    pos.set(badge.key, { x: 0, y: -Math.min(top + lifted + 14, PAN.height + 8), s: 1, o: 1, w, h });
  }
  return pos;
}

/** Hela scenens positioner: { L: Map, R: Map }. */
export function layoutScene(scene, view) {
  return { L: layoutSide(scene.L, view), R: layoutSide(scene.R, view) };
}

/** Stapelns höjd (för tester och för att kontrollera att allt ryms). */
export function extent(pos) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = 0;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x - p.w / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    minY = Math.min(minY, p.y - p.h);
  }
  return { minX, maxX, height: -minY };
}
