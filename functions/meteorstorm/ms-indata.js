// ============================================================================
// Meteorstormen (#820): motorns INDATA – normalisering och ordning. Ren, delas
// med servern. Samma indata (oavsett ordning på handlingarna) → samma motor.
//
//   normCfg(cfg)                     → { seed, startMs, varaktighetMs, stationer, installningar }
//   cfgNyckel(cfg)                   → sträng – samma nyckel = samma motor (cachen)
//   jamforHandling(a, b)             → ordningen: t, sedan id (strängjämförelse)
//   normHandlingar(lista, index)     → giltiga handlingar, sorterade, med stationsindex i
//   sammaHandling(a, b)              → true om två normaliserade handlingar är lika
// ============================================================================

import { STEG_MS, HANDLINGAR, MAX_STATIONER, aktivaElever, normInstallningar } from "./ms-balans.js";

export function normCfg(cfg) {
  const varaktighetMs = Math.max(STEG_MS, Math.round((Number(cfg?.varaktighetMs) || 0) / STEG_MS) * STEG_MS);
  const stationer = (Array.isArray(cfg?.stationer) ? cfg.stationer : [])
    .slice(0, MAX_STATIONER)
    .map((s) => ({ classId: String(s?.classId ?? ""), aktiva: aktivaElever(s?.aktiva) }));
  return {
    seed: cfg?.seed ?? 0,
    startMs: Number(cfg?.startMs) || 0,
    varaktighetMs,
    stationer,
    installningar: normInstallningar(cfg?.installningar),
  };
}

export const cfgNyckel = (c) => JSON.stringify([typeof c.seed, c.seed, c.startMs, c.varaktighetMs, c.stationer, c.installningar]);

export function jamforHandling(a, b) {
  return a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function normHandlingar(lista, stationIndex) {
  const ut = [];
  for (const h of Array.isArray(lista) ? lista : []) {
    const t = Number(h?.t);
    const i = stationIndex.get(String(h?.classId ?? ""));
    if (!Number.isFinite(t) || i === undefined || !HANDLINGAR.includes(h?.typ)) continue;
    ut.push({
      id: String(h.id ?? ""), t, classId: String(h.classId), i, typ: h.typ,
      uid: h.uid == null ? "" : String(h.uid), mal: h.mal == null ? "" : String(h.mal),
    });
  }
  return ut.sort(jamforHandling);
}

export const sammaHandling = (a, b) => a.id === b.id && a.t === b.t && a.i === b.i && a.typ === b.typ && a.uid === b.uid && a.mal === b.mal;

