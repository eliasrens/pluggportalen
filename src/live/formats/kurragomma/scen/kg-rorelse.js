// ============================================================================
// Kurragömma (#837): RÖRELSEN – ren logik utan DOM och utan three.js, delad av
// 3D-scenen och 2D-reserven (spec §3). Farten och kollisionen kommer ur
// motorn (kg-config.js, kg-geometri.js) – ingen egen geometri här.
//
// Riktningen yaw följer motorns kontrakt: framåt är (x: sin yaw, z: cos yaw).
// Ökande yaw svänger åt vänster.
//
// API
//   stegaJag(jag, styr, dt, karta) → nytt { x, z, yaw, gar }   (fri rörelse + "gå dit")
//   gaMot(jag, mal)                → true när figuren är framme (mal = { x, z })
//   vridMot(yaw, malYaw, dt)       → yaw närmare målet (kortaste vägen)
//   vinkelMot(fran, till)          → yaw som pekar från fran mot till
//   skapaInterpolering(fordrojningMs) → { satt(uid, { x, z, yaw, t }), lage(uid, nu), bort(uid), alla() }
//   normVinkel(a)                  → a i (-π, π]
// ============================================================================

import { MAX_FART, POS_INTERPOLERING_MS } from "../delat/kg-config.js";
import { kollidera } from "../delat/kg-geometri.js";

/** Svänghastighet med A/D (rad/s) och hur fort "gå dit" vrider figuren. */
export const VRID_FART = 2.4;
const GA_DIT_VRID = 7;
/** "Gå dit": framme när man är så här nära målet. */
const FRAMME_M = 0.35;
/** "Gå dit" avbryts om figuren står still (kollision) så här länge. */
const FAST_S = 0.6;

export function normVinkel(a) {
  let v = a % (2 * Math.PI);
  if (v > Math.PI) v -= 2 * Math.PI;
  if (v <= -Math.PI) v += 2 * Math.PI;
  return v;
}

export function vinkelMot(fran, till) {
  return Math.atan2(till.x - fran.x, till.z - fran.z);
}

/** Vrid yaw mot malYaw med farten `fart` rad/s – kortaste vägen. */
export function vridMot(yaw, malYaw, dt, fart = GA_DIT_VRID) {
  const diff = normVinkel(malYaw - yaw);
  const steg = fart * dt;
  if (Math.abs(diff) <= steg) return normVinkel(malYaw);
  return normVinkel(yaw + Math.sign(diff) * steg);
}

/**
 * Ett steg för den egna figuren.
 * styr = { fram: -1..1, sväng: -1..1, mal: { x, z } | null } – fram > 0 går framåt,
 * sväng > 0 svänger vänster. Ett mål (tryck på marken) gäller tills tangenter
 * eller joysticken används, tills figuren är framme eller tills den fastnat.
 * `fast` (true) låser figuren: bara vridningen fungerar (letfasen, gömd).
 */
export function stegaJag(jag, styr, dt, karta, { fast = false } = {}) {
  let { x, z, yaw } = jag;
  let mal = styr.mal || null;
  let stillaS = jag.stillaS || 0;
  const manuell = Math.abs(styr.fram) > 0.05 || Math.abs(styr.svang) > 0.05;
  if (manuell) mal = null;
  yaw = normVinkel(yaw + (styr.svang || 0) * VRID_FART * dt);
  let fart = fast ? 0 : Math.max(-1, Math.min(1, styr.fram || 0));
  if (mal && !fast) {
    const d = Math.hypot(mal.x - x, mal.z - z);
    if (d <= FRAMME_M) mal = null;
    else {
      yaw = vridMot(yaw, vinkelMot({ x, z }, mal), dt);
      // Sakta in sista biten så figuren inte skjuter förbi.
      fart = Math.min(1, d / (MAX_FART * dt) / 4 + 0.2);
    }
  }
  if (fart) {
    const steg = fart * MAX_FART * dt;
    const p = kollidera(x + Math.sin(yaw) * steg, z + Math.cos(yaw) * steg, karta);
    const flytt = Math.hypot(p.x - x, p.z - z);
    if (mal) {
      stillaS = flytt < steg * 0.2 ? stillaS + dt : 0;
      if (stillaS >= FAST_S) { mal = null; stillaS = 0; }
    }
    x = p.x; z = p.z;
  }
  return { x, z, yaw, gar: !!fart, mal, stillaS };
}

/**
 * Interpolering av andras positioner (spec §5.3): vi ritar fordrojningMs
 * bakåt i tiden och glider mellan de två proverna runt den tiden. Saknas ett
 * nyare prov står figuren still på det senaste.
 */
export function skapaInterpolering(fordrojningMs = POS_INTERPOLERING_MS) {
  const spar = new Map(); // uid → [{ x, z, yaw, t }], äldst först (högst 4)

  function satt(uid, p) {
    if (!uid || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
    const lista = spar.get(uid) || [];
    const prov = { x: p.x, z: p.z, yaw: Number.isFinite(p.yaw) ? p.yaw : 0, t: Number.isFinite(p.t) ? p.t : 0 };
    if (lista.length && prov.t < lista[lista.length - 1].t) return; // gammalt prov
    lista.push(prov);
    while (lista.length > 4) lista.shift();
    spar.set(uid, lista);
  }

  function lage(uid, nu) {
    const lista = spar.get(uid);
    if (!lista || !lista.length) return null;
    const t = nu - fordrojningMs;
    const sist = lista[lista.length - 1];
    if (lista.length === 1 || t >= sist.t) return { x: sist.x, z: sist.z, yaw: sist.yaw, gar: false };
    let i = lista.length - 1;
    while (i > 0 && lista[i - 1].t > t) i--;
    if (i === 0) return { x: lista[0].x, z: lista[0].z, yaw: lista[0].yaw, gar: false };
    const a = lista[i - 1], b = lista[i];
    const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const yaw = normVinkel(a.yaw + normVinkel(b.yaw - a.yaw) * k);
    const gar = Math.hypot(b.x - a.x, b.z - a.z) > 0.05;
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw, gar };
  }

  return {
    satt,
    lage,
    bort: (uid) => spar.delete(uid),
    alla: () => [...spar.keys()],
    rensa: () => spar.clear(),
  };
}
