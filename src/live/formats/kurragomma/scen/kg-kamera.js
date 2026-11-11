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
//   kameraHinder(karta)                      → [{ id, x, z, r, h, lov }]
//   placeraKamera({ jag, hinder, inneI })    → { x, y, z, mal: { x, y, z }, avstand }
//   skapaGlid()  .starta({ x, z }, nu) .lage(nu) → { x, z, k } (k = 0..1 hur nära platsen)
//   projektorKamera({ t, glid, stilla, aspekt }) → { x, y, z, mal: { x, y, z } }
// ============================================================================

import { KAMERA, KAMERA_GLID_MS } from "../delat/kg-config.js";

/** Minsta avstånd kameran dras in till (m). */
export const KAMERA_MIN_M = 2;
const MARGINAL_M = 0.3;

/**
 * Hur högt och brett varje typ hindrar kameran (ska stämma med kg-modeller.js).
 * fast: radien är föremålets `fast` + r (väggar, stammar) – figuren står alltid
 * utanför den (FIGUR_RADIE_M). Övriga: kronan/lövverket, som figuren kan stå under.
 */
const HINDER = {
  lada: { r: 0.1, h: 7.2, fast: true }, sten: { r: 0.1, h: 3.2, fast: true }, brunn: { r: 0.2, h: 4.2, fast: true },
  vedtrave: { r: 0.1, h: 2.2, fast: true }, vagn: { r: 0.1, h: 2.6, fast: true }, tunnor: { r: 0.1, h: 2.7, fast: true },
  talt: { r: 0.1, h: 3.4, fast: true },
  gran: { r: 2.5, h: 6.8 }, ek: { r: 2.9, h: 6.5 }, trad: { r: 1.8, h: 4.6 }, buskage: { r: 0, h: 2.6 }, hostack: { r: 0, h: 3.6 },
};

/** Hindren ur kartan: `fast` + r för de fasta, annars typens krona eller lov-radien. */
export function kameraHinder(karta) {
  const ut = [];
  for (const f of karta.foremal) {
    const h = HINDER[f.typ];
    if (!h) continue;
    const r = h.fast ? f.fast + h.r : Math.max(h.r, f.lov ? f.r : 0);
    if (r > 0) ut.push({ id: f.id, x: f.x, z: f.z, r, h: h.h, lov: !!f.lov });
  }
  return ut;
}

const inne = (p, h) => Math.hypot(p.x - h.x, p.z - h.z) <= h.r + MARGINAL_M;

/** Första t (0..1) där sträckan P→C (P utanför) går in i cylindern, eller null. */
function inTradeT(p, c, hinder) {
  const dx = c.x - p.x, dz = c.z - p.z;
  const fx = p.x - hinder.x, fz = p.z - hinder.z;
  const r = hinder.r + MARGINAL_M;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - r * r;
  const disk = b * b - 4 * a * cc;
  if (disk < 0) return null;
  const t = (-b - Math.sqrt(disk)) / (2 * a);
  if (t < 0 || t > 1) return null;
  const y = p.y + (c.y - p.y) * t;
  return y < hinder.h ? t : null;
}

/**
 * Tredjepersonskamerans önskade plats för figuren `jag` ({ x, z, yaw }).
 * `inneI` är id:t på det lov-föremål figuren står inne i (eller null).
 * Står figuren intill ett hinder (under en krona) och kameran skulle hamna
 * inne i det, dras kameran in till KAMERA_MIN_M och lyfts över hindret.
 */
export function placeraKamera({ jag, hinder = [], inneI = null }) {
  const mal = { x: jag.x, y: KAMERA.tittaPaY, z: jag.z };
  const fullt = { x: jag.x - Math.sin(jag.yaw) * KAMERA.bakom, y: KAMERA.upp, z: jag.z - Math.cos(jag.yaw) * KAMERA.bakom };
  const minT = KAMERA_MIN_M / KAMERA.bakom;
  let t = 1;
  let lyft = 0;
  for (const h of hinder) {
    if (h.lov && h.id === inneI) continue;
    if (inne(mal, h)) {
      if (inne(fullt, h) && fullt.y < h.h) { t = minT; lyft = Math.max(lyft, h.h + 0.5); }
      continue;
    }
    const ti = inTradeT(mal, fullt, h);
    if (ti == null || ti >= t) continue;
    t = ti;
    // Hindret ligger närmare än minsta avståndet: lyft kameran över det.
    if (ti - 0.02 < minT) lyft = Math.max(lyft, h.h + 0.5);
  }
  t = Math.max(minT, t - 0.02);
  return {
    x: mal.x + (fullt.x - mal.x) * t,
    y: lyft || mal.y + (fullt.y - mal.y) * t,
    z: mal.z + (fullt.z - mal.z) * t,
    mal,
    avstand: KAMERA.bakom * t,
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
