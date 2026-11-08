// ============================================================================
// Meteorstormen (#820): EN STATIONS mekanik (§2.1) – skrov, sköldmätaren och
// laserladdningen, i heltal (tusendelar, MILLI) så att node och webbläsare får
// exakt samma tal. Ren, delas med servern. Motorn (ms-motor.js) äger tiden,
// meteorerna och dragstrålen; här ligger bara det som händer i stationen.
//
//   nyStation()                  → internt stationstillstånd
//   klonaStation(st)             → djup kopia (motorns kontrollpunkter)
//   fyllSkold(st, milli)         → skölden + milli, högst SKOLD_TAK
//   laddaLaser(st, milli, uid)   → laddningen + milli, högst LADDNING_TAK; uid minns
//                                  vem som laddade (kön) så att skottet kan tillskrivas
//   avfyra(st)                   → förbrukar ett skott, ger uid som bidrog mest till det
//   slaNer(st, skadaMilli)       → skölden tar skadan först, sedan skrovet (aldrig < 0)
//                                  → { iSkold, iSkrov } i milli
// ============================================================================

import { MILLI, SKROV_START, SKOLD_START, SKOLD_TAK, LADDNING_TAK } from "./ms-balans.js";

export function nyStation() {
  return {
    skrov: SKROV_START * MILLI, skold: SKOLD_START * MILLI, ladd: 0, ko: [],
    nedskjutna: 0, traffar: 0, skada: 0, hjalp: false, armerad: null, dragRedo: 0,
    noll: null, antal: { skold: 0, laser: 0, drag: 0 }, kastade: 0,
  };
}

export function klonaStation(s) {
  return { ...s, ko: s.ko.map((k) => ({ ...k })), armerad: s.armerad && { ...s.armerad }, antal: { ...s.antal } };
}

export function fyllSkold(st, milli) {
  st.skold = Math.min(SKOLD_TAK * MILLI, st.skold + milli);
}

export function laddaLaser(st, milli, uid) {
  const fore = st.ladd;
  st.ladd = Math.min(LADDNING_TAK * MILLI, st.ladd + milli);
  if (st.ladd > fore) st.ko.push({ uid, m: st.ladd - fore });
}

export function avfyra(st) {
  st.ladd -= MILLI;
  let kvar = MILLI;
  const andel = new Map();
  while (kvar > 0 && st.ko.length) {
    const k = st.ko[0];
    const tag = Math.min(k.m, kvar);
    k.m -= tag;
    kvar -= tag;
    andel.set(k.uid, (andel.get(k.uid) || 0) + tag);
    if (k.m === 0) st.ko.shift();
  }
  let uid = "";
  let max = -1;
  for (const [u, m] of andel) if (m > max) { max = m; uid = u; }
  return uid;
}

export function slaNer(st, skadaMilli) {
  const iSkold = Math.min(st.skold, skadaMilli);
  const iSkrov = Math.min(st.skrov, skadaMilli - iSkold);
  st.skold -= iSkold;
  st.skrov -= iSkrov;
  st.skada += iSkrov;
  if (iSkrov > 0) st.traffar++;
  return { iSkold, iSkrov };
}
