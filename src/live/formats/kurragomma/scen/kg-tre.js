// ============================================================================
// Kurragömma (#837): THREE.JS-RITAREN – laddar biblioteket LAT (import() ur
// src/vendor/three/, spec §4.1, bootgrafen #271), bygger renderer, scen, ljus,
// dimma, gradientkartan för toon-skuggningen och världen, och ritar en bildruta
// åt gången åt kg-scen.js. Inga realtidsskuggor, ingen kantutjämning, ingen
// efterbehandling (spec §4.4).
//
// API
//   harWebGL()                               → bool (utan att skapa en three-renderer)
//   laddaThree()                             → Promise<three-modulen>
//   skapaTreRitare({ T, yta, karta, niva }) → {
//     T, scen, kamera, varld, gradient,
//     rita()            → antal ritanrop
//     storlek()         → { w, h }
//     nivaSatt(n)
//     kameraSatt({ x, y, z, mal })   direkt – lerp och hinderklippning görs i kg-ritare-3d.js
//     skarmPunkt(x, y, z)            → { sx, sy, inne, framfor } i CSS-px
//     markPunkt(sx, sy)              → { x, z } på marken (y = 0) eller null
//     dimma(lage)
//     dispose()
//   }
// ============================================================================

import { KAMERA } from "../delat/kg-config.js";
import { byggVarld } from "./kg-varld.js";
import { NIVAER, normNiva, pixelfaktor } from "./kg-niva.js";

const HIMMEL = 0xbfe6ff;

export function harWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_lose_context"); // släpp provkontexten direkt
    if (ext) ext.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Lat laddning – den enda platsen som når src/vendor/three/. */
export function laddaThree() {
  return import("../../../../vendor/three/three.module.min.js");
}

/** 3-stegs gradientkarta för MeshToonMaterial (spec §4.2). */
function gradientKarta(T) {
  const t = new T.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, T.RedFormat);
  t.minFilter = t.magFilter = T.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function skapaTreRitare({ T, yta, karta, niva = 1 }) {
  const canvas = document.createElement("canvas");
  canvas.className = "kg-canvas";
  yta.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 0);

  const scen = new T.Scene();
  scen.fog = new T.Fog(HIMMEL, 35, 110);
  const kamera = new T.PerspectiveCamera(KAMERA.synfalt, 1, 0.3, 220);
  scen.add(new T.HemisphereLight(0xd9f1ff, 0x7aa85b, 1.1));
  const sol = new T.DirectionalLight(0xfff4d6, 2.2);
  sol.position.set(18, 30, 12);
  scen.add(sol);
  scen.add(new T.AmbientLight(0xffffff, 0.25));

  const gradient = gradientKarta(T);
  const varld = byggVarld(T, karta, { gradient });
  scen.add(varld.grupp);

  let w = 1, h = 1;
  let aktuellNiva = normNiva(niva);
  function storlekSatt() {
    w = Math.max(1, yta.clientWidth);
    h = Math.max(1, yta.clientHeight);
    renderer.setPixelRatio(pixelfaktor(aktuellNiva, window.devicePixelRatio));
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
  }
  storlekSatt();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(storlekSatt) : null;
  if (ro) ro.observe(yta);
  else window.addEventListener("resize", storlekSatt);

  function nivaSatt(n) {
    aktuellNiva = normNiva(n);
    const def = NIVAER[aktuellNiva];
    varld.nivaSatt({ kontur: def.kontur, dekor: def.dekor });
    storlekSatt();
  }
  nivaSatt(aktuellNiva);

  const v = new T.Vector3();
  const mal = new T.Vector3(0, KAMERA.tittaPaY, 0);

  /** Sätter kameran direkt – den mjuka följningen (och klippningen mot hinder) görs i kg-ritare-3d.js. */
  function kameraSatt({ x, y, z, mal: m }) {
    kamera.position.set(x, y, z);
    mal.set(m.x, m.y, m.z);
    kamera.lookAt(mal);
  }

  /** Världspunkt → skärmpunkt (CSS-px). framfor = framför kameran. */
  function skarmPunkt(x, y, z) {
    v.set(x, y, z).project(kamera);
    const framfor = v.z < 1;
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * h;
    return { sx, sy, framfor, inne: framfor && sx >= 0 && sx <= w && sy >= 0 && sy <= h };
  }

  const stralStart = new T.Vector3(), stralRikt = new T.Vector3();
  /** Skärmpunkt (CSS-px) → punkten på marken (y = 0), eller null (himlen). */
  function markPunkt(sx, sy) {
    stralRikt.set((sx / w) * 2 - 1, -(sy / h) * 2 + 1, 0.5).unproject(kamera);
    stralStart.copy(kamera.position);
    stralRikt.sub(stralStart).normalize();
    if (Math.abs(stralRikt.y) < 1e-4) return null;
    const t = -stralStart.y / stralRikt.y;
    if (t <= 0) return null;
    return { x: stralStart.x + stralRikt.x * t, z: stralStart.z + stralRikt.z * t };
  }

  function dimma(lage) {
    const proj = lage === "projektor";
    scen.fog.near = proj ? 80 : 35;
    scen.fog.far = proj ? 170 : 110;
  }

  return {
    T, scen, kamera, varld, gradient, renderer,
    rita() {
      renderer.render(scen, kamera);
      return renderer.info.render.calls;
    },
    storlek: () => ({ w, h }),
    nivaSatt,
    kameraSatt,
    skarmPunkt,
    markPunkt,
    dimma,
    dispose() {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", storlekSatt);
      varld.dispose();
      gradient.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
