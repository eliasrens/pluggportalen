// ============================================================================
// Matchdagen (#869): 3D-RITAREN (spec §4) – renderer, arenan, de två lagen,
// bollen med skugga och tv-kameran från långsidan som mjukt följer bollen och
// zoomar in en kort stund vid mål. Samma RITAR-GRÄNSSNITT som 2D-reserven
// (md-plan-2d.js), så matchvyn (md-plan.js) vet inte vilken som kör.
// Lugnt läge / prefers-reduced-motion: fast kamera över hela planen, ingen zoom,
// spelarna och bollen hoppar direkt till sina platser.
//
//   skapa3dRitare({ T, yta, lugnt }) → {
//     typ: "3d",
//     lag(sida, { troja, byxor, mv, kapten? }), spelare(sida, pos[7], { direkt }),
//     boll(x, y, { hojd, ms }), firar(sida, pa), malEffekt(sida), zoom(pa),
//     avatar(canvas), fps() → { snitt, lagst, bilder }, dispose()
//   }
//   sida: "vi" | "dem". Positioner i planmeter (0–105, 0–68), se md-formation.js.
// ============================================================================

import { byggArena } from "./md-tre-arena.js";
import { skapaFigur, skapaFigurDelar, stegaFigur } from "./md-tre-figur.js";
import { PLAN_B, PLAN_L } from "./md-formation.js";

const BOLL_R = 0.3;
const tillX = (x) => x - PLAN_L / 2;
const tillZ = (y) => y - PLAN_B / 2;

function bollTextur(T) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 32);
  g.fillStyle = "#1b1b1b";
  for (const [x, y] of [[8, 8], [24, 22], [40, 8], [56, 22], [16, 26], [48, 4]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function skapa3dRitare({ T, yta, lugnt = false }) {
  const canvas = document.createElement("canvas");
  canvas.className = "md-canvas";
  yta.appendChild(canvas);
  // Som Kurragömma: ingen kantutjämning, högst 1,5 i pixeltäthet – och en vakt som
  // sänker pixeltätheten om datorn inte orkar 45 bilder/s (prestandan §4).
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  let pixel = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixel);
  const scen = new T.Scene();
  const kamera = new T.PerspectiveCamera(36, 16 / 9, 0.5, 400);
  const arena = byggArena(T, scen, { lugnt });
  const delar = skapaFigurDelar(T);

  const lagen = { vi: { figurer: [] }, dem: { figurer: [] } };
  const bollTex = bollTextur(T);
  const bollM = new T.Mesh(new T.SphereGeometry(BOLL_R, 16, 12), new T.MeshLambertMaterial({ map: bollTex }));
  const bollSk = new T.Mesh(new T.CircleGeometry(0.34, 12), new T.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.32, depthWrite: false }));
  bollSk.rotation.x = -Math.PI / 2;
  bollM.position.set(0, BOLL_R, 0);
  scen.add(bollM, bollSk);
  let bana = null; // { fran, till, t0, ms, hojd }

  let avatarSprite = null;
  let w = 1, h = 1;
  function storlek() {
    w = Math.max(1, yta.clientWidth);
    h = Math.max(1, yta.clientHeight);
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    // Smal yta (mobil): bredare synfält så att planen ryms.
    kamera.fov = kamera.aspect < 1.4 ? 50 : 36;
    kamera.updateProjectionMatrix();
  }
  storlek();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(storlek) : null;
  if (ro) ro.observe(yta);

  // ---- lagen ----------------------------------------------------------------
  function lag(sida, { troja, byxor, mv, kapten = -1 }) {
    const L = lagen[sida];
    L.figurer.forEach((f) => scen.remove(f));
    L.figurer = Array.from({ length: 7 }, (_, i) => {
      const f = skapaFigur(T, delar, { troja, byxor, mv }, { mv: i === 0, i: i + (sida === "dem" ? 7 : 0), kapten: i === kapten });
      scen.add(f);
      return f;
    });
    L.kapten = kapten;
    if (sida === "vi" && avatarSprite) placeraAvatar();
  }
  function spelare(sida, pos, { direkt = false } = {}) {
    lagen[sida].figurer.forEach((f, i) => {
      const [x, y] = pos[i];
      f.userData.mal.set(tillX(x), 0, tillZ(y));
      if (direkt) f.userData.placerad = false;
    });
  }
  /** Elevens avatar som en liten bricka ovanför kaptenen (§4). */
  function avatar(bild) {
    if (!bild) return;
    const tex = new T.CanvasTexture(bild);
    tex.colorSpace = T.SRGBColorSpace;
    avatarSprite = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
    avatarSprite.scale.set(1.5, 1.8, 1);
    avatarSprite.userData.tex = tex;
    placeraAvatar();
  }
  function placeraAvatar() {
    const f = lagen.vi.figurer[lagen.vi.kapten];
    if (!f || !avatarSprite) return;
    avatarSprite.position.set(0, 2.95, 0); // i figurens skala (1,5)
    avatarSprite.scale.set(1, 1.2, 1);
    f.add(avatarSprite);
  }
  const uppdateraAvatar = () => { if (avatarSprite) avatarSprite.userData.tex.needsUpdate = true; };

  // ---- bollen ---------------------------------------------------------------
  function boll(x, y, { hojd = 0, ms = 600 } = {}) {
    const till = new T.Vector3(tillX(x), 0, tillZ(y));
    if (lugnt || ms <= 0) {
      bana = null;
      bollM.position.set(till.x, BOLL_R, till.z);
      return;
    }
    const fran = bollM.position.clone();
    fran.y = 0;
    bana = { fran, till, t0: performance.now(), ms, hojd };
  }

  // ---- effekter -------------------------------------------------------------
  const effekter = []; // { t0, ms, steg(t) }
  function effekt(ms, steg) { effekter.push({ t0: performance.now(), ms, steg }); }
  function firar(sida, pa) { lagen[sida].figurer.forEach((f, i) => { f.userData.hopp = pa && i ? 1 : 0; }); }
  function malEffekt(sida) {
    const s = sida === "dem" ? 1 : -1; // vi gör mål i deras mål (höger)
    effekt(1400, (t) => { arena.natBukt(s, Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t)); arena.publikJubel(t); });
  }
  let zoomTill = 0;
  function zoom(pa) { zoomTill = pa && !lugnt ? performance.now() + 2200 : 0; }

  // ---- kameran --------------------------------------------------------------
  const kamPos = new T.Vector3(0, 24, 46), kamMal = new T.Vector3(), kamPosMal = new T.Vector3(), kamMalMal = new T.Vector3();
  function kameraSteg(nu, dt) {
    const bx = bollM.position.x, bz = bollM.position.z;
    if (lugnt) { // fast vy över hela planen – ingen följning, ingen zoom
      kamPos.set(0, 52, 62);
      kamMal.set(0, 0, 4);
    } else {
      const narbild = nu < zoomTill;
      const bred = kamera.aspect < 1.4 ? 1.35 : 1;
      if (narbild) { kamPosMal.set(bx * 0.92, 8, bz + 17); kamMalMal.set(bx, 1, bz); } else { kamPosMal.set(bx * 0.72, 19 * bred, 37 * bred); kamMalMal.set(bx * 0.86, 0, bz * 0.4); }
      const k = 1 - Math.pow(narbild ? 0.04 : 0.12, dt);
      kamPos.lerp(kamPosMal, k);
      kamMal.lerp(kamMalMal, k);
    }
    kamera.position.copy(kamPos);
    kamera.lookAt(kamMal);
  }

  // ---- loopen ---------------------------------------------------------------
  const bilder = []; // tidpunkter (ms) för de senaste bilderna
  let senast = performance.now(), raf = 0, levande = true;
  function loop(nu) {
    if (!levande) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (nu - senast) / 1000);
    if (nu - senast > 250) vaktStart = 0; // uppehåll (dold flik, sovläge): börja mäta om
    senast = nu;
    bilder.push(nu);
    if (bilder.length > 240) bilder.shift();
    if (bana) {
      const t = Math.min(1, (nu - bana.t0) / bana.ms);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      bollM.position.lerpVectors(bana.fran, bana.till, bana.hojd > 0 ? t : e);
      bollM.position.y = BOLL_R + Math.sin(Math.PI * t) * bana.hojd;
      bollM.rotation.x += dt * 12;
      if (t >= 1) bana = null;
    }
    bollSk.position.set(bollM.position.x, 0.03, bollM.position.z);
    const tid = nu / 1000;
    for (const L of [lagen.vi, lagen.dem]) for (const f of L.figurer) stegaFigur(f, dt, { direkt: lugnt, tittaPa: bollM.position, tid });
    for (let i = effekter.length - 1; i >= 0; i--) {
      const e = effekter[i];
      const t = Math.min(1, (nu - e.t0) / e.ms);
      e.steg(t);
      if (t >= 1) effekter.splice(i, 1);
    }
    kameraSteg(nu, dt);
    renderer.render(scen, kamera);
    vakt(nu);
  }
  // Pixelvakten: mäter 3 s åt gången och sänker pixeltätheten i två steg (aldrig under 0,6).
  let vaktStart = 0, vaktBilder = 0;
  function vakt(nu) {
    if (!vaktStart) { vaktStart = nu; vaktBilder = 0; return; }
    vaktBilder++;
    if (nu - vaktStart < 3000) return;
    const fps = (vaktBilder * 1000) / (nu - vaktStart);
    vaktStart = nu;
    vaktBilder = 0;
    if (fps < 45 && pixel > 0.6) {
      pixel = Math.max(0.6, Math.round(pixel * 0.75 * 100) / 100);
      renderer.setPixelRatio(pixel);
      storlek();
    }
  }
  raf = requestAnimationFrame(loop);

  return {
    typ: "3d",
    lag, spelare, boll, firar, malEffekt, zoom, avatar, uppdateraAvatar,
    /** Uppmätta bilder per sekund över de senaste bilderna. */
    fps() {
      if (bilder.length < 10) return { snitt: 0, lagst: 0, bilder: bilder.length };
      const d = [];
      for (let i = 1; i < bilder.length; i++) d.push(bilder[i] - bilder[i - 1]);
      const snitt = 1000 / (d.reduce((a, b) => a + b, 0) / d.length);
      const varst = d.slice().sort((a, b) => b - a)[Math.floor(d.length * 0.05)];
      return { snitt: Math.round(snitt * 10) / 10, lagst: Math.round(10000 / varst) / 10, bilder: bilder.length, ritanrop: renderer.info.render.calls, pixel };
    },
    dispose() {
      levande = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      delar.dispose();
      arena.dispose();
      bollTex.dispose();
      avatarSprite?.userData.tex.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // släpp WebGL-kontexten direkt (webbläsaren har bara ett fåtal)
      canvas.remove();
    },
  };
}
