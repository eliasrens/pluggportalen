// ============================================================================
// Bråkresan – komponenternas geometri (src/brakresan/komponenter/geometri.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 "Gemensamma visuella regler": cirkelsektorer exakt 360°/n, stavar
// exakt helhet/n, rutnätsceller lika stor area, tallinjen linjär
// x(v) = x0 + (v − min)/(max − min) · bredd, fyra delar = fem markeringar,
// samma helhet och nollpunkt under omdelning. ALLT här är rena funktioner
// utan DOM – komponenterna ritar ur dem och test/brakresan-komponenter-
// geometri.test.js mäter dem. Värden som ska vara exakta (vinklar i grader,
// tallinjens värden) räknas med heltal/rationella tal; bara pixlarna är flyttal.
//
// Delarnas id (docs/BRAKRESAN.md §5): "p0" … "p{N−1}" i läsordning – helhet
// för helhet; stav vänster→höger; cirkel medurs från klockan 12; rutnät rad
// för rad.
// ============================================================================

import { q, toQ, add, sub, mul, cmp } from "../math/rational.js";

export const MAX_CIRKEL_DELAR = 12;

/** Delens id i läsordning. */
export const delId = (i) => `p${i}`;
export const delIndex = (id) => Number(String(id).slice(1));

/** `marked` ur view: ett antal (de första k delarna) eller en lista med id. */
export function markeradeIds(marked, total) {
  if (Array.isArray(marked)) return marked.map(String).filter((id) => delIndex(id) < total);
  const k = Math.max(0, Math.min(total, Math.floor(Number(marked) || 0)));
  return Array.from({ length: k }, (_, i) => delId(i));
}

// --- Bråkcirkel ---------------------------------------------------------------

/**
 * n exakta sektorer, medurs från klockan 12. Vinklarna i grader är exakta
 * rationella tal (a0, a1 som { n, d }); `path` är SVG-vägen.
 */
export function cirkelSektorer(n, cx, cy, r) {
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CIRKEL_DELAR) {
    throw new RangeError(`Bråkresan: cirkeln kan ha 1–${MAX_CIRKEL_DELAR} delar, inte ${n}`);
  }
  const steg = q(360, n);
  const punkt = (grader) => {
    const rad = ((grader - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const f = (v) => Math.round(v * 1000) / 1000;
  return Array.from({ length: n }, (_, i) => {
    const a0 = mul(steg, q(i));
    const a1 = mul(steg, q(i + 1));
    const g0 = a0.n / a0.d;
    const g1 = a1.n / a1.d;
    let path;
    if (n === 1) {
      // Hel cirkel: två halvbågar (en båge kan inte gå 360°).
      path = `M ${f(cx)} ${f(cy - r)} A ${r} ${r} 0 1 1 ${f(cx)} ${f(cy + r)} A ${r} ${r} 0 1 1 ${f(cx)} ${f(cy - r)} Z`;
    } else {
      const [x0, y0] = punkt(g0);
      const [x1, y1] = punkt(g1);
      const stor = g1 - g0 > 180 ? 1 : 0;
      path = `M ${f(cx)} ${f(cy)} L ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${stor} 1 ${f(x1)} ${f(y1)} Z`;
    }
    const [mx, my] = punkt((g0 + g1) / 2);
    const mitt = [cx + (mx - cx) * 0.62, cy + (my - cy) * 0.62];
    return { id: delId(i), i, a0, a1, path, mitt };
  });
}

/** Sektorns vinkel i grader som exakt värde (a1 − a0). */
export const sektorVinkel = (s) => sub(s.a1, s.a0);

// --- Bråkstav -----------------------------------------------------------------

/** En stav med `parts` lika långa delar på [x0, x0 + bredd]. */
export function stavDelar(parts, x0, bredd) {
  if (!Number.isSafeInteger(parts) || parts < 1) throw new RangeError("Bråkresan: stavens delar ≥ 1");
  const w = bredd / parts;
  return Array.from({ length: parts }, (_, i) => ({ i, x: x0 + i * w, w }));
}

/**
 * Omdelning (spec §4 komponent 2): varje gammal del delas i k nya. Helheten och
 * nollpunkten är desamma; gamla del i → nya delarna i·k … i·k + k − 1, så den
 * markerade totala längden är oförändrad (1/2 → 2/4). `gamlaGranser` = de
 * index bland de nya gränserna (0 … parts·k) som fanns före omdelningen –
 * dem ritar staven kraftigare.
 */
export function omdela(parts, markerade, k) {
  if (!Number.isSafeInteger(k) || k < 1) throw new RangeError("Bråkresan: omdelning k ≥ 1");
  const ny = parts * k;
  const mark = [];
  for (const id of markerade) {
    const i = delIndex(id);
    for (let j = 0; j < k; j++) mark.push(delId(i * k + j));
  }
  const gamlaGranser = Array.from({ length: parts + 1 }, (_, i) => i * k);
  return { parts: ny, markerade: mark, gamlaGranser };
}

/** Markerad andel av en helhet som exakt värde: 2 av 4 → 1/2. */
export const andel = (antal, parts) => q(antal, parts);

// --- Rutnät / rektangel -------------------------------------------------------

/** rows × cols lika stora celler på en yta b × h, rad för rad. */
export function rutnatCeller(rows, cols, b, h) {
  const w = b / cols;
  const hh = h / rows;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ i: r * cols + c, r, c, x: c * w, y: r * hh, w, h: hh });
  }
  return out;
}

/**
 * Konturen runt en region (lista med cellindex) som kanter mellan cellhörn:
 * en kant ritas där grannen inte hör till samma region. Svarar
 * [{ x1, y1, x2, y2 }] i cellenheter (multiplicera med cellens bredd/höjd).
 */
export function regionKontur(cellIdx, rows, cols) {
  const inne = new Set(cellIdx);
  const har = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && inne.has(r * cols + c);
  const kanter = [];
  for (const i of inne) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (!har(r - 1, c)) kanter.push({ x1: c, y1: r, x2: c + 1, y2: r });
    if (!har(r + 1, c)) kanter.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
    if (!har(r, c - 1)) kanter.push({ x1: c, y1: r, x2: c, y2: r + 1 });
    if (!har(r, c + 1)) kanter.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
  }
  return kanter;
}

/** Har alla regioner samma area (antal celler) och täcker de rutnätet exakt en gång? */
export function regionerLikaStora(regions, rows, cols) {
  const alla = regions.flatMap((g) => g.cells);
  const unika = new Set(alla);
  return regions.length > 0 && unika.size === alla.length && unika.size === rows * cols &&
    regions.every((g) => g.cells.length === regions[0].cells.length);
}

// --- Hundraruta ---------------------------------------------------------------

/** 10 × 10 celler per helhet (1–2 helheter), id p0 … p99 (p100 … p199). */
export function hundraCeller(wholes = 1) {
  const out = [];
  for (let w = 0; w < wholes; w++) for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const i = w * 100 + r * 10 + c;
    out.push({ id: delId(i), i, w, r, c });
  }
  return out;
}

/** Id för en hel rad i en hundraruta. */
export const hundraRad = (w, r) => Array.from({ length: 10 }, (_, c) => delId(w * 100 + r * 10 + c));

// --- Tallinje -----------------------------------------------------------------

/** Tallinjens x(v) = x0 + (v − min)/(max − min) · bredd (linjär, spec §4). */
export function xAv(v, min, max, x0, bredd) {
  const t = sub(toQ(v), toQ(min));
  const span = sub(toQ(max), toQ(min));
  return x0 + ((t.n / t.d) / (span.n / span.d)) * bredd;
}

/**
 * Markeringarna från min till max med steget 1/ticks. (max − min)·ticks
 * delsträckor ger en markering mer: fyra delar = fem markeringar.
 * Varje markering: { value: {n,d}, k, hel } där hel = heltal.
 */
export function tallinjeMarkeringar(min, max, ticks) {
  const lo = toQ(min);
  const span = sub(toQ(max), lo);
  const delar = mul(span, q(ticks));
  if (delar.d !== 1 || delar.n < 1) throw new RangeError("Bråkresan: tallinjens intervall måste delas jämnt");
  return Array.from({ length: delar.n + 1 }, (_, k) => {
    const value = add(lo, q(k, ticks));
    return { k, value, hel: value.d === 1 };
  });
}

/** Antal delsträckor mellan min och max med steget 1/ticks. */
export const tallinjeDelstrackor = (min, max, ticks) => tallinjeMarkeringar(min, max, ticks).length - 1;

/** Närmaste tillåtna värde (multipel av 1/snap inom [min, max]) för en x-position. */
export function snappa(x, min, max, x0, bredd, snap) {
  const lo = toQ(min);
  const hi = toQ(max);
  const span = sub(hi, lo);
  const steg = (span.n / span.d) * snap; // antal snäppsteg (heltal)
  const t = Math.max(0, Math.min(1, (x - x0) / bredd));
  const k = Math.round(t * steg);
  const startK = lo.n * snap / lo.d; // lo som multipel av 1/snap (heltal om lo ligger på rutnätet)
  return q(Math.round(startK) + k, snap);
}

/** Ett snäppsteg åt `riktning` (±1), aldrig utanför [min, max]. */
export function snappSteg(v, riktning, min, max, snap) {
  const nv = add(toQ(v), q(riktning, snap));
  if (cmp(nv, toQ(min)) < 0) return toQ(min);
  if (cmp(nv, toQ(max)) > 0) return toQ(max);
  return nv;
}

// --- Mängdbild ----------------------------------------------------------------

/**
 * Placering av `count` identiska föremål. Med `groups` (som delar count jämnt)
 * läggs de i lika stora grupper; annars i rader. Varje föremål exakt en gång.
 * Svarar { items: [{ id, i, g, x, y }], grupper: [{ g, x, y, w, h }], b, h } i
 * enheter av ett föremål (1 × 1).
 */
export function mangdLayout(count, groups = 0) {
  const items = [];
  const grupper = [];
  if (groups > 1 && count % groups === 0) {
    const per = count / groups;
    const kol = per <= 3 ? per : Math.ceil(Math.sqrt(per));
    const rad = Math.ceil(per / kol);
    // Grupper per rad: så många som ryms (≈ 10 föremål brett), sedan jämnt fördelat på raderna.
    const maxGk = Math.min(groups, Math.max(1, Math.floor(10 / (kol + 0.6))));
    const gk = Math.ceil(groups / Math.ceil(groups / maxGk));
    for (let g = 0; g < groups; g++) {
      const gx = (g % gk) * (kol + 0.6);
      const gy = Math.floor(g / gk) * (rad + 0.6);
      grupper.push({ g, x: gx, y: gy, w: kol, h: rad });
      for (let j = 0; j < per; j++) {
        const i = g * per + j;
        items.push({ id: delId(i), i, g, x: gx + (j % kol), y: gy + Math.floor(j / kol) });
      }
    }
    const gr = Math.ceil(groups / gk);
    return { items, grupper, b: gk * (kol + 0.6) - 0.6, h: gr * (rad + 0.6) - 0.6 };
  }
  const kol = Math.min(10, Math.max(1, count <= 12 ? count : Math.ceil(Math.sqrt(count * 1.6))));
  for (let i = 0; i < count; i++) items.push({ id: delId(i), i, g: null, x: i % kol, y: Math.floor(i / kol) });
  return { items, grupper, b: kol, h: Math.ceil(count / kol) };
}

// --- Areamodell för produkt ---------------------------------------------------

/**
 * Enhetskvadraten delas lodrätt i vertical.d kolumner (vertical.n färgade) och
 * vågrätt i horizontal.d rader (horizontal.n färgade). Cellerna id p0 … rad för
 * rad. Överlappningen är vertical·horizontal av den ursprungliga helheten.
 */
export function areaModell(vertical, horizontal) {
  const cols = vertical.d;
  const rows = horizontal.d;
  const celler = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    celler.push({ id: delId(i), i, r, c, lodratt: c < vertical.n, vagratt: r < horizontal.n });
  }
  const overlapp = celler.filter((x) => x.lodratt && x.vagratt).length;
  return { rows, cols, celler, overlapp, andel: q(overlapp, rows * cols) };
}
