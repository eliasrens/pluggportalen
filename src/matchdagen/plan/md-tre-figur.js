// ============================================================================
// Matchdagen (#869): SPELARNA i 3D (spec §4) – byggda av enkla former: ben med
// skor och strumpor, shorts, tröja i lagets färg, armar, huvud och hår, och en
// blob-skugga. Målvakterna har egna färger, lagkaptenen bär kaptensbindel.
// Geometrierna delas av alla figurer och materialen per lag (få tillstånds-
// byten – prestandan §4: ≥ 50 bilder/s i 1366 × 768).
//
//   skapaFigurDelar(T)                    → delar (geometrier + delade material)
//   skapaLagMaterial(T, delar, { troja, byxor, mv }) → material för ett lag
//   skapaFigur(T, delar, lagMat, { mv, i, kapten }) → THREE.Group (userData: lemmar)
//   stegaFigur(f, dt, { direkt, tittaPa })  springer mot f.userData.mal
// ============================================================================

const HUD = ["#f1c9a5", "#d9a37e", "#a86f4c", "#7a4a2e", "#f5d6bd", "#c68a5e"];
const HAR = ["#2b1a10", "#5a3a1e", "#c9a050", "#111111", "#8a3b1c", "#3b2a20"];
export const FART = 7.5; // meter per sekund när spelaren springer
const SKALA = 1.25;

export function skapaFigurDelar(T) {
  const box = (x, y, z) => new T.BoxGeometry(x, y, z);
  const geo = {
    ben: box(0.2, 0.5, 0.2), strumpa: box(0.22, 0.38, 0.24), sko: box(0.22, 0.12, 0.34),
    byxor: box(0.56, 0.32, 0.32), kropp: box(0.6, 0.72, 0.34), arm: box(0.16, 0.62, 0.16),
    huvud: new T.SphereGeometry(0.23, 12, 10), har: new T.SphereGeometry(0.245, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    skugga: new T.CircleGeometry(0.55, 14), bindel: box(0.19, 0.12, 0.19),
  };
  const mat = {
    hud: HUD.map((c) => new T.MeshLambertMaterial({ color: c })),
    har: HAR.map((c) => new T.MeshLambertMaterial({ color: c })),
    sko: new T.MeshLambertMaterial({ color: "#111111" }),
    strumpa: new T.MeshLambertMaterial({ color: "#f2f2f2" }),
    skugga: new T.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false }),
    bindel: new T.MeshLambertMaterial({ color: "#ffd23f", emissive: "#5a4500" }),
  };
  return {
    geo, mat,
    dispose() {
      Object.values(geo).forEach((g) => g.dispose());
      [...mat.hud, ...mat.har, mat.sko, mat.strumpa, mat.skugga, mat.bindel].forEach((m) => m.dispose());
    },
  };
}

/** Ett lags material: tröja, shorts och målvaktens tröja. */
export function skapaLagMaterial(T, { troja, byxor, mv }) {
  const m = (c) => new T.MeshLambertMaterial({ color: c });
  const lag = { troja: m(troja), byxor: m(byxor), mv: m(mv), mvByxor: m("#222222") };
  lag.dispose = () => [lag.troja, lag.byxor, lag.mv, lag.mvByxor].forEach((x) => x.dispose());
  return lag;
}

/** En spelare. i väljer hy och hår (samma spelare ser likadan ut varje match). */
export function skapaFigur(T, { geo, mat }, lagMat, { mv = false, i = 0, kapten = false } = {}) {
  const f = new T.Group();
  const mesh = (g, m, x, y, z, foralder = f) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    foralder.add(o);
    return o;
  };
  const hud = mat.hud[(i * 7 + (mv ? 3 : 0)) % mat.hud.length];
  const troja = mv ? lagMat.mv : lagMat.troja;
  const ben = (sx) => {
    const p = new T.Group();
    p.position.set(sx, 0.9, 0);
    mesh(geo.ben, hud, 0, -0.25, 0, p);
    mesh(geo.strumpa, mat.strumpa, 0, -0.66, 0, p);
    mesh(geo.sko, mat.sko, 0, -0.86, 0.06, p);
    f.add(p);
    return p;
  };
  const arm = (sx) => {
    const p = new T.Group();
    p.position.set(sx, 1.68, 0);
    mesh(geo.arm, troja, 0, -0.3, 0, p);
    f.add(p);
    return p;
  };
  const bv = ben(-0.15), bh = ben(0.15);
  mesh(geo.byxor, mv ? lagMat.mvByxor : lagMat.byxor, 0, 1.02, 0);
  mesh(geo.kropp, troja, 0, 1.5, 0);
  const av = arm(-0.39), ah = arm(0.39);
  if (kapten) mesh(geo.bindel, mat.bindel, 0, -0.12, 0, av); // kaptensbindeln på vänster överarm
  mesh(geo.huvud, hud, 0, 2.08, 0);
  mesh(geo.har, mat.har[(i * 5 + (mv ? 1 : 0)) % mat.har.length], 0, 2.1, 0);
  const skugga = mesh(geo.skugga, mat.skugga, 0, 0.02, 0);
  skugga.rotation.x = -Math.PI / 2;
  f.scale.setScalar(SKALA);
  f.userData = { bv, bh, av, ah, mal: new T.Vector3(), fas: i * 1.3, hopp: 0, placerad: false };
  return f;
}

/**
 * Ett steg i animationen: springer mot målet med benen och armarna svängande,
 * vänder sig mot bollen när den står still. direkt = hoppa dit (lugnt läge).
 * hopp > 0 = firar (studsar).
 */
export function stegaFigur(f, dt, { direkt = false, tittaPa = null, tid = 0 } = {}) {
  const u = f.userData;
  const dx = u.mal.x - f.position.x, dz = u.mal.z - f.position.z;
  const avst = Math.hypot(dx, dz);
  let springer = false;
  if (direkt || !u.placerad) {
    f.position.x = u.mal.x;
    f.position.z = u.mal.z;
    u.placerad = true;
  } else if (avst > 0.05) {
    const steg = Math.min(avst, FART * dt * (avst > 12 ? 1.6 : 1));
    f.position.x += (dx / avst) * steg;
    f.position.z += (dz / avst) * steg;
    springer = avst > 0.2;
  }
  u.fas += springer ? dt * 11 : 0;
  const sv = springer ? Math.sin(u.fas) * 0.7 : 0;
  u.bv.rotation.x = sv;
  u.bh.rotation.x = -sv;
  u.av.rotation.x = -sv;
  u.ah.rotation.x = sv;
  if (springer) f.rotation.y = Math.atan2(dx, dz);
  else if (tittaPa) f.rotation.y = Math.atan2(tittaPa.x - f.position.x, tittaPa.z - f.position.z);
  f.position.y = u.hopp > 0 && !direkt ? Math.abs(Math.sin(tid * 9 + u.fas)) * 0.45 * u.hopp : 0;
  if (u.hopp > 0) { u.av.rotation.z = -2.6 * u.hopp; u.ah.rotation.z = 2.6 * u.hopp; } else { u.av.rotation.z = 0; u.ah.rotation.z = 0; }
  return springer;
}
