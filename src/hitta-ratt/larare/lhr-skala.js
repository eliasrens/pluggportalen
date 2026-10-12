// ============================================================================
// Hitta rätt! – nedskalning av bilder i lärarens webbläsare (src/hitta-ratt/larare/lhr-skala.js) · #637
// ----------------------------------------------------------------------------
// Arkitektur §11.8 (bevisat i spiken). Inget Storage: bilden blir ett eget
// Firestore-dokument, så den måste vara liten.
//   1. avkoda (createImageBitmap) → canvas, längsta sidan ≤ 800 px
//   2. WebP med kvalitet 0,82 → 0,72 → 0,62 → 0,5. Kan webbläsaren inte koda
//      WebP (blob.type ≠ image/webp, äldre Safari) blir det JPEG.
//   3. Fortfarande > 120 kB → 640 px, sedan 480 px. Annars SkalaFel.
//
//   await skalaBild(blob, { avkoda, canvas }) → { blob, mime, bredd, hojd, kvalitet }
//     avkoda(blob) → { width, height, close? }        (standard: createImageBitmap)
//     canvas(w, h) → { rita(bild), tillBlob(typ, q) }  (standard: OffscreenCanvas
//                                                       eller <canvas>.toBlob)
// Testerna (test/hitta-ratt-bilder-egna.test.js) stubbar båda.
// ============================================================================

export const MAX_BYTES = 120_000;
export const STEG_PX = [800, 640, 480];
export const KVALITETER = [0.82, 0.72, 0.62, 0.5];

export class SkalaFel extends Error {
  constructor(message) {
    super(message);
    this.code = "skala";
  }
}

function standardCanvas(w, h) {
  const c = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = c.getContext("2d");
  return {
    rita: (bild) => ctx.drawImage(bild, 0, 0, w, h),
    tillBlob: (typ, q) => (c.convertToBlob
      ? c.convertToBlob({ type: typ, quality: q })
      : new Promise((ok, fel) => c.toBlob((b) => (b ? ok(b) : fel(new Error("toBlob"))), typ, q))),
  };
}

/** Måtten efter nedskalning: längsta sidan ≤ max, aldrig uppskalning. */
export function matt(bredd, hojd, max) {
  const f = Math.min(1, max / Math.max(bredd, hojd));
  return { bredd: Math.max(1, Math.round(bredd * f)), hojd: Math.max(1, Math.round(hojd * f)) };
}

export async function skalaBild(blob, { avkoda = (b) => createImageBitmap(b), canvas = standardCanvas } = {}) {
  let bild;
  try {
    bild = await avkoda(blob);
  } catch {
    throw new SkalaFel("Bilden gick inte att läsa. Välj en JPEG-, PNG- eller WebP-bild.");
  }
  try {
    for (const max of STEG_PX) {
      const m = matt(bild.width, bild.height, max);
      const c = canvas(m.bredd, m.hojd);
      c.rita(bild);
      for (const q of KVALITETER) {
        let ut = await c.tillBlob("image/webp", q);
        if (ut?.type !== "image/webp") ut = await c.tillBlob("image/jpeg", q);
        if (ut && ut.size <= MAX_BYTES) return { blob: ut, mime: ut.type === "image/webp" ? "image/webp" : "image/jpeg", ...m, kvalitet: q };
      }
    }
  } finally {
    bild.close?.();
  }
  throw new SkalaFel("Bilden blev för stor även nedskalad. Prova en annan bild.");
}
