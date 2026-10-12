// ============================================================================
// Hitta rätt! – kamerastyrning (src/hitta-ratt/karta/kamerastyrning.js) · #606
// ----------------------------------------------------------------------------
// Håller kartans kamera { k, cx, cy } inom packens gränser och animerar den.
// Ingen DOM – bara requestAnimationFrame och prefers-reduced-motion. Varje
// ändring anropar `rita()` (kartmotorn samlar dem till EN skrivning per
// bildruta). Ren matte i kamera.js.
//
//   const st = skapaKamerastyrning({ startRuta, panRuta, minZoom, maxZoom, rita, klar })
//   st.storlek(W, H)             vyn bytte storlek (räknar om helvy och gränser)
//   st.satt(kam) / st.pan(dx, dy) / st.zoomVid(x, y, faktor)    direkt (gester)
//   st.animera(mal, ms)          mjuk övergång (knappar, tangenter, resultat)
//   st.hjulZoom(x, y, faktor)    kort animation mot pekaren (mushjulets hack)
//   st.stoppa()                  avbryt pågående animation (ny gest)
//   klar()                       anropas när en animation landat
// ============================================================================

import {
  tillTransform, skarmTillKarta, kartaTillSkarm, begransa, zoomaVid, panorera,
  passaIn, lattnad, interpolera,
} from "./kamera.js";

// Luft runt helvyn: plats för zoomknapparna (höger) och attributionen (botten).
// Smal stående vy (mobil): knapparna tar för mycket bredd → luften i botten.
const LUFT = { v: 12, t: 12, h: 62, b: 22 };
const LUFT_SMAL = { v: 12, t: 12, h: 12, b: 60 };
// Luft när ett resultat visas: nålar och etiketter sticker upp/åt höger.
export const VISA_LUFT = { v: 40, t: 70, h: 90, b: 40 };

const reduceraRorelse = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function skapaKamerastyrning({ startRuta, panRuta, minZoom = 0.85, maxZoom = 10, rita, klar = () => {} }) {
  let W = 1, H = 1, kHem = 1;
  let kam = { k: 1, cx: (startRuta[0] + startRuta[2]) / 2, cy: (startRuta[1] + startRuta[3]) / 2 };
  let grans = { kMin: 0.5, kMax: 10, ruta: panRuta };
  let animId = 0;
  let hjulMal = null;
  let aktiv = false; // en animation pågår

  const luft = () => (W < 480 && H > W ? LUFT_SMAL : LUFT);
  const hemKamera = () => passaIn(startRuta, W, H, luft());

  function satt(ny) {
    kam = begransa(ny, grans);
    rita();
  }

  function animera(mal, ms = 380) {
    const id = ++animId;
    hjulMal = null;
    if (reduceraRorelse() || ms <= 0) { aktiv = false; satt(mal); klar(); return; }
    aktiv = true;
    const fran = { ...kam };
    const malB = begransa(mal, grans);
    const t0 = performance.now();
    const steg = (nu) => {
      if (id !== animId) return;
      const t = Math.min(1, (nu - t0) / ms);
      satt(interpolera(fran, malB, lattnad(t)));
      if (t < 1) requestAnimationFrame(steg);
      else { aktiv = false; klar(); }
    };
    requestAnimationFrame(steg);
  }

  // Flera hjulhack i följd bygger på samma mål, så snabb scrollning inte hackar.
  function hjulZoom(sx, sy, faktor) {
    const bas = hjulMal && hjulMal.sx === sx && hjulMal.sy === sy ? hjulMal.k : kam.k;
    const k = Math.min(grans.kMax, Math.max(grans.kMin, bas * faktor));
    const id = ++animId;
    if (reduceraRorelse()) { hjulMal = null; aktiv = false; satt(zoomaVid(kam, W, H, sx, sy, k / kam.k, grans)); klar(); return; }
    hjulMal = { sx, sy, k };
    aktiv = true;
    const ankare = skarmTillKarta(kam, W, H, sx, sy); // står still under pekaren
    const k0 = kam.k, t0 = performance.now(), ms = 140;
    const steg = (nu) => {
      if (id !== animId) return;
      const t = Math.min(1, (nu - t0) / ms);
      const kn = k0 * (k / k0) ** lattnad(t);
      satt({ k: kn, cx: ankare[0] - (sx - W / 2) / kn, cy: ankare[1] - (sy - H / 2) / kn });
      if (t < 1) requestAnimationFrame(steg);
      else { hjulMal = null; aktiv = false; klar(); }
    };
    requestAnimationFrame(steg);
  }

  /**
   * Kamera där hela kartrutan syns med luft för nålar/etiketter,
   * aldrig utzoomad förbi helvyn och aldrig närmare än maxRel × helvyn.
   */
  function visaRuta(ruta, maxRel) {
    const l = VISA_LUFT;
    const k = Math.max(kHem, Math.min(passaIn(ruta, W, H, l).k, kHem * maxRel, grans.kMax));
    return {
      k,
      cx: (ruta[0] + ruta[2]) / 2 - (l.v - l.h) / 2 / k,
      cy: (ruta[1] + ruta[3]) / 2 - (l.t - l.b) / 2 / k,
    };
  }

  let forsta = true;
  return {
    get kam() { return kam; },
    get W() { return W; },
    get H() { return H; },
    get kHem() { return kHem; },
    get grans() { return grans; },
    get animerar() { return aktiv; },
    transform: () => tillTransform(kam, W, H),
    tillSkarm: (pt) => kartaTillSkarm(kam, W, H, pt),
    tillKarta: (sx, sy) => skarmTillKarta(kam, W, H, sx, sy),
    storlek(nW, nH) {
      const rel = kam.k / kHem;
      W = Math.max(1, nW);
      H = Math.max(1, nH);
      kHem = hemKamera().k;
      grans = { kMin: kHem * minZoom, kMax: kHem * maxZoom, ruta: panRuta };
      // Första riktiga storleken → helvyn; därefter samma upplevda zoom.
      if (forsta) { satt(hemKamera()); forsta = W <= 1; } else satt({ ...kam, k: rel * kHem });
    },
    satt,
    pan(dx, dy) { satt(panorera(kam, dx, dy)); },
    zoomVid(sx, sy, faktor) { satt(zoomaVid(kam, W, H, sx, sy, faktor, grans)); },
    animera,
    hjulZoom,
    hem(ms = 380) { animera(hemKamera(), ms); },
    visaRuta(ruta, maxRel, ms = 650) { animera(visaRuta(ruta, maxRel), ms); },
    stoppa() { animId++; hjulMal = null; aktiv = false; },
  };
}
