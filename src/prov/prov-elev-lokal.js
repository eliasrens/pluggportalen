// ============================================================================
// Prov (#740, spec §5.5): elevens lokala kopia i localStorage – skrivs vid
// VARJE ändring, så att en omladdning eller krasch aldrig tappar något
// (valjStartSvar i prov-tillfalle-logik.js väljer mellan den och serverns).
// ============================================================================

import { serverNow } from "../data-class-lock.js";
import { lokalNyckel } from "./prov-tillfalle-logik.js";

export function lasLokal(t, uid) {
  try {
    return JSON.parse(localStorage.getItem(lokalNyckel(t, uid)) || "null");
  } catch {
    return null;
  }
}
export function skrivLokal(t, uid, svar, flikbyten = 0) {
  try {
    localStorage.setItem(lokalNyckel(t, uid), JSON.stringify({ svar, at: serverNow(), flikbyten }));
  } catch {}
}
export function rensaLokal(t, uid) {
  try {
    localStorage.removeItem(lokalNyckel(t, uid));
  } catch {}
}
