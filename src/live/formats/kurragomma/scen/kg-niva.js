// ============================================================================
// Kurragömma (#837): PRESTANDANIVÅERNA och valet av ritare (spec §4.4) – ren
// logik utan DOM, testad i test/live-kurragomma-scen.test.js.
//
//   NIVAER                      Låg / Mellan / Hög med upplösningsfaktor m.m.
//   valjRitare({ harWebGL, tvinga2d }) → "3d" | "2d"
//   skapaNivavakt({ niva, nu })  fps-mätning + automatisk sänkning:
//     .bildruta(nu) → händelse | null  ("sankt" med ny nivå, eller "2d" när
//                                        Låg ligger under 15 fps)
//     .fps(), .niva(), .satt(n)
//   lasSparadNiva(storage) / sparaNiva(storage, n)   (try/catch runt localStorage)
// ============================================================================

export const NIVAER = Object.freeze([
  // Låg: upplösning ×0,6, ingen kontur, mindre dekor (blommor, moln, stigen).
  Object.freeze({ id: 0, namn: "Låg", upplosning: 0.6, kontur: false, dekor: false }),
  Object.freeze({ id: 1, namn: "Mellan", upplosning: 1, kontur: true, dekor: true }),
  // Hög: upp till skärmens upplösning, högst ×2.
  Object.freeze({ id: 2, namn: "Hög", upplosning: 2, kontur: true, dekor: true }),
]);
export const NIVA_STANDARD = 1;
export const LAGRINGSNYCKEL = "pp:kg:niva";

/** Automatisk sänkning: under så här många fps i så här många sekunder. */
export const SANK_FPS = 24;
export const SANK_S = 3;
/** 2D-reserven tar över när Låg ligger under så här många fps lika länge. */
export const RESERV_FPS = 15;

export function normNiva(n) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 0 && v < NIVAER.length ? v : NIVA_STANDARD;
}

/** Pixelfaktor för renderern på en nivå – Hög följer skärmen, högst ×2. */
export function pixelfaktor(niva, devicePixelRatio = 1) {
  const n = NIVAER[normNiva(niva)];
  return n.id === 2 ? Math.min(2, Math.max(1, devicePixelRatio || 1)) : n.upplosning;
}

/** 2D-reserven startar när WebGL saknas eller när den tvingas (?2d=1). */
export function valjRitare({ harWebGL, tvinga2d = false } = {}) {
  return !harWebGL || tvinga2d ? "2d" : "3d";
}

export function lasSparadNiva(storage) {
  try {
    const v = storage && storage.getItem(LAGRINGSNYCKEL);
    return v == null || v === "" ? null : normNiva(v);
  } catch {
    return null;
  }
}

export function sparaNiva(storage, niva) {
  try {
    storage && storage.setItem(LAGRINGSNYCKEL, String(normNiva(niva)));
  } catch {
    /* privat läge eller fullt lager – valet gäller bara den här sidan */
  }
}

/**
 * Mäter fps i fönster om en sekund och sänker nivån ett steg när snittet
 * ligger under SANK_FPS i SANK_S sekunder i rad. På Låg under RESERV_FPS lika
 * länge ges händelsen { typ: "2d" } i stället. Efter en sänkning får den nya
 * nivån en lugn sekund innan mätningen börjar om.
 */
export function skapaNivavakt({ niva = NIVA_STANDARD, nu = 0, auto = true } = {}) {
  let aktuell = normNiva(niva);
  let fonsterStart = nu;
  let bilder = 0;
  let fps = 0;
  let langsammaS = 0;
  let lugnTill = nu + 1000;

  function bildruta(t) {
    bilder++;
    if (t - fonsterStart < 1000) return null;
    fps = (bilder * 1000) / (t - fonsterStart);
    bilder = 0;
    fonsterStart = t;
    if (!auto || t < lugnTill) return null;
    const grans = aktuell === 0 ? RESERV_FPS : SANK_FPS;
    langsammaS = fps < grans ? langsammaS + 1 : 0;
    if (langsammaS < SANK_S) return null;
    langsammaS = 0;
    lugnTill = t + 2000;
    if (aktuell === 0) return { typ: "2d", fps: Math.round(fps) };
    aktuell -= 1;
    return { typ: "sankt", niva: aktuell, namn: NIVAER[aktuell].namn, fps: Math.round(fps) };
  }

  return {
    bildruta,
    fps: () => fps,
    niva: () => aktuell,
    satt(n, t = fonsterStart) {
      aktuell = normNiva(n);
      langsammaS = 0;
      lugnTill = t + 1000;
    },
  };
}
