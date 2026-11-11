// ============================================================================
// Kurragömma (#837): KAMERAN – ren logik utan three.js (spec §3, §7).
//
// Tredjeperson: KAMERA.bakom m bakom, KAMERA.upp m upp, tittar på överkroppen
// (KAMERA.tittaPaY). Kameran hamnar aldrig inne i ett träd eller en vägg:
// vi DRAR IN kameran mot figuren tills den är utanför hindret (billigast –
// ingen genomskinlighet, inga materialbyten, inga sorteringsproblem). Ett
// lov-föremål som figuren själv står inne i hindrar inte; ritaren gör det
// halvgenomskinligt i stället (en handfull separata meshar), annars såg man
// bara lövverk.
//
// Projektorn: snett ovanifrån med långsam rotation, och en glidning (~3 s)
// mot en vissling eller en hittad elev. Flera händelser tätt efter varandra
// ger EN glidning. prefers-reduced-motion stänger av båda (ritaren skickar
// stilla: true).
//
// API
//   kameraHinder(karta)                      → [{ id, x, z, h, lov, r | hx, hz, rot }]
//   placeraKamera({ jag, hinder, inneI, fullt? }) → { x, y, z, mal: { x, y, z }, avstand }
//   skapaGlid()  .starta({ x, z }, nu) .lage(nu) → { x, z, k } (k = 0..1 hur nära platsen)
//   projektorKamera({ t, glid, stilla, aspekt }) → { x, y, z, mal: { x, y, z } }
// ============================================================================

import { KAMERA, KAMERA_GLID_MS } from "../delat/kg-config.js";

/** Minsta avstånd kameran dras in till (m). */
export const KAMERA_MIN_M = 2;
/** Marginal utanför hindret: near-planet (0,3) plus lite luft. */
const MARGINAL_M = 0.45;

/**
 * Hindren per typ – modellernas VERKLIGA fotavtryck (kg-modeller.js), inte
 * motorns kollisionsradie: en cirkel (r i meter, eller `rFaktor` × fast/r) eller
 * en låda (hx, hz halvbredder, vriden med rot) för ladan. h = höjden.
 * Testat mot modellerna i test/live-kurragomma-kamera.test.js.
 */
const HINDER = {
  lada: { box: [3.3, 2.4], h: 7.2 },
  sten: { rFaktor: 0.95, av: "fast", h: 3.2 }, brunn: { r: 1.8, h: 4.2 }, vedtrave: { r: 1.6, h: 2.2 },
  vagn: { r: 1.9, h: 2.6 }, tunnor: { r: 1.4, h: 2.7 }, talt: { r: 2.0, h: 3.4 },
  gran: { r: 2.5, h: 6.8 }, ek: { r: 3.6, h: 6.6 }, trad: { r: 1.9, h: 5.4 },
  buskage: { rFaktor: 1.0, av: "r", h: 2.8 }, hostack: { r: 2.0, h: 3.6 },
};

/** Hindren ur kartan: [{ id, x, z, h, lov, r } | { ..., hx, hz, rot }]. */
export function kameraHinder(karta) {
  const ut = [];
  for (const f of karta.foremal) {
    const h = HINDER[f.typ];
    if (!h) continue;
    const bas = { id: f.id, x: f.x, z: f.z, h: h.h, lov: !!f.lov };
    if (h.box) ut.push({ ...bas, hx: h.box[0], hz: h.box[1], rot: f.rot || 0 });
    else ut.push({ ...bas, r: h.rFaktor ? f[h.av] * h.rFaktor : h.r });
  }
  return ut;
}

/** Punkten i hindrets lokala ram (lådan är vriden med rot runt y). */
function lokal(p, h) {
  const dx = p.x - h.x, dz = p.z - h.z;
  if (!h.rot) return { x: dx, z: dz };
  const c = Math.cos(-h.rot), s = Math.sin(-h.rot);
  return { x: dx * c + dz * s, z: -dx * s + dz * c };
}

const inne = (p, h) => {
  const l = lokal(p, h);
  if (h.hx != null) return Math.abs(l.x) <= h.hx + MARGINAL_M && Math.abs(l.z) <= h.hz + MARGINAL_M;
  return Math.hypot(l.x, l.z) <= h.r + MARGINAL_M;
};

/** Första t (0..1) där sträckan P→C (P utanför) går in i cirkeln, eller null. */
function inCirkelT(p, c, r) {
  const dx = c.x - p.x, dz = c.z - p.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (p.x * dx + p.z * dz);
  const cc = p.x * p.x + p.z * p.z - r * r;
  const disk = b * b - 4 * a * cc;
  if (disk < 0) return null;
  const t = (-b - Math.sqrt(disk)) / (2 * a);
  return t < 0 || t > 1 ? null : t;
}

/** Första t (0..1) där sträckan P→C (P utanför) går in i lådan ±hx, ±hz (slab-test), eller null. */
function inLadaT(p, c, hx, hz) {
  const dx = c.x - p.x, dz = c.z - p.z;
  let t0 = 0, t1 = 1;
  for (const [pp, d, hh] of [[p.x, dx, hx], [p.z, dz, hz]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(pp) > hh) return null; continue; }
    let ta = (-hh - pp) / d, tb = (hh - pp) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0 > 0 && t0 <= 1 ? t0 : null;
}

/** Första t (0..1) där sträckan P→C går in i hindret under dess höjd, eller null. */
function inTradeT(p, c, h) {
  const lp = lokal(p, h), lc = lokal(c, h);
  const t = h.hx != null ? inLadaT(lp, lc, h.hx + MARGINAL_M, h.hz + MARGINAL_M) : inCirkelT(lp, lc, h.r + MARGINAL_M);
  if (t == null) return null;
  const y = p.y + (c.y - p.y) * t;
  return y < h.h ? t : null;
}

/**
 * Tredjepersonskamerans plats för figuren `jag` ({ x, z, yaw }): KAMERA.bakom m
 * bakom och KAMERA.upp m upp, men sträckan figur→kamera klipps mot hindren så
 * kameran aldrig hamnar inne i ett träd eller en vägg. `inneI` är id:t på det
 * lov-föremål figuren står inne i (eller null) – det hindrar inte (ritas
 * halvgenomskinligt). Står figuren intill ett hinder och kameran skulle hamna
 * inne i det, dras kameran in till KAMERA_MIN_M och lyfts över hindret.
 * `fullt` (valfri) klipper en annan önskad punkt – den lerpade kameran
 * (kg-ritare-3d.js), så inte heller mellanlägena går in i något.
 */
export function placeraKamera({ jag, hinder = [], inneI = null, fullt = null }) {
  const mal = { x: jag.x, y: KAMERA.tittaPaY, z: jag.z };
  const full = fullt || { x: jag.x - Math.sin(jag.yaw) * KAMERA.bakom, y: KAMERA.upp, z: jag.z - Math.cos(jag.yaw) * KAMERA.bakom };
  const langd = Math.hypot(full.x - mal.x, full.z - mal.z) || 1e-6;
  const minT = Math.min(1, KAMERA_MIN_M / langd);
  let t = 1;
  let lyft = 0;
  for (const h of hinder) {
    if (h.lov && h.id === inneI) continue;
    if (inne(mal, h)) {
      if (inne(full, h) && full.y < h.h) { t = minT; lyft = Math.max(lyft, h.h + 0.5); }
      continue;
    }
    const ti = inTradeT(mal, full, h);
    if (ti == null || ti >= t) continue;
    t = ti;
    // Hindret ligger närmare än minsta avståndet: lyft kameran över det.
    if (ti - 0.02 < minT) lyft = Math.max(lyft, h.h + 0.5);
  }
  t = Math.max(minT, t - 0.02);
  return {
    x: mal.x + (full.x - mal.x) * t,
    y: lyft || mal.y + (full.y - mal.y) * t,
    z: mal.z + (full.z - mal.z) * t,
    mal,
    avstand: langd * t,
  };
}

/** Glidningen på projektorn: in på 0,8 s, håll, tillbaka till 3 s (KAMERA_GLID_MS). */
export function skapaGlid() {
  let aktiv = null; // { x, z, start }
  const IN_MS = 800;
  return {
    starta(punkt, nu) {
      if (aktiv && nu - aktiv.start < KAMERA_GLID_MS) return false; // en glidning, inte flera
      aktiv = { x: punkt.x, z: punkt.z, start: nu };
      return true;
    },
    lage(nu) {
      if (!aktiv) return null;
      const e = nu - aktiv.start;
      if (e >= KAMERA_GLID_MS) { aktiv = null; return null; }
      let k;
      if (e < IN_MS) k = e / IN_MS;
      else if (e > KAMERA_GLID_MS - IN_MS) k = (KAMERA_GLID_MS - e) / IN_MS;
      else k = 1;
      k = k * k * (3 - 2 * k); // mjuk in/ut
      return { x: aktiv.x, z: aktiv.z, k };
    },
    pagar: () => !!aktiv,
  };
}

/** Projektorns kamera: ön snett ovanifrån, ett varv på ~3 minuter. */
export const PROJEKTOR_VARV_S = 180;
export function projektorKamera({ t = 0, glid = null, stilla = false, aspekt = 16 / 9 } = {}) {
  const vinkel = stilla ? 0.6 : 0.6 + ((t / 1000) / PROJEKTOR_VARV_S) * 2 * Math.PI;
  const langd = aspekt < 0.9 ? 62 : 58;
  const k = glid && !stilla ? glid.k : 0;
  const mal = { x: (glid ? glid.x : 0) * k, y: 0, z: (glid ? glid.z : 0) * k };
  const avst = langd * (1 - 0.4 * k);
  const hojd = 34 * (1 - 0.3 * k);
  return {
    x: mal.x + Math.sin(vinkel) * avst,
    y: hojd,
    z: mal.z + Math.cos(vinkel) * avst,
    mal: { x: mal.x, y: 1.5 * k, z: mal.z },
  };
}
