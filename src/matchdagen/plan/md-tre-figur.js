// ============================================================================
// Matchdagen (#869): SPELARNA i 3D (spec §4) – byggda av enkla former: ben med
// skor och strumpor, shorts, tröja i lagets färg, armar, huvud och hår, och en
// blob-skugga. Målvakterna har egna färger, lagkaptenen bär kaptensbindel.
// Delarna slås ihop med vertexfärger och delar ETT material (få ritanrop och
// tillståndsbyten – prestandan §4: ≥ 50 bilder/s i 1366 × 768).
//
//   skapaFigurDelar(T)                    → delar (sammanslagna geometrier + ett delat material)
//   skapaFigur(T, delar, { troja, byxor, mv }, { mv, i, kapten }) → THREE.Group (userData: lemmar)
//   stegaFigur(f, dt, { direkt, tittaPa })  springer mot f.userData.mal
// ============================================================================

const HUD = ["#f1c9a5", "#d9a37e", "#a86f4c", "#7a4a2e", "#f5d6bd", "#c68a5e"];
const HAR = ["#2b1a10", "#5a3a1e", "#c9a050", "#111111", "#8a3b1c", "#3b2a20"];
export const FART = 7.5; // meter per sekund när spelaren springer
const SKALA = 1.5;

/**
 * Delarna som alla figurer delar: EN Lambert-material med vertexfärger och
 * sammanslagna geometrier (kropp+huvud+hår, ett ben med strumpa och sko, en arm)
 * i en cache per färgkombination. Det ger 6 ritanrop per spelare i stället för 13.
 */
export function skapaFigurDelar(T) {
  const box = (x, y, z) => new T.BoxGeometry(x, y, z);
  const geo = {
    ben: box(0.2, 0.5, 0.2), strumpa: box(0.22, 0.38, 0.24), sko: box(0.22, 0.12, 0.34),
    byxor: box(0.56, 0.32, 0.32), kropp: box(0.6, 0.72, 0.34), arm: box(0.16, 0.62, 0.16), bindel: box(0.19, 0.12, 0.19),
    huvud: new T.SphereGeometry(0.23, 10, 8), har: new T.SphereGeometry(0.245, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  const skuggGeo = new T.CircleGeometry(0.55, 14);
  const mat = new T.MeshLambertMaterial({ vertexColors: true });
  const skuggMat = new T.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false });
  const cache = new Map();
  const farg = new T.Color();
  /** Slå ihop delar ({ g, f, x, y, z }) till en geometri med vertexfärger. */
  function slaIhop(delar) {
    const pos = [], nor = [], col = [];
    for (const d of delar) {
      const g = d.g.toNonIndexed();
      g.translate(d.x, d.y, d.z);
      farg.set(d.f);
      pos.push(...g.attributes.position.array);
      nor.push(...g.attributes.normal.array);
      for (let i = 0; i < g.attributes.position.count; i++) col.push(farg.r, farg.g, farg.b);
      g.dispose();
    }
    const ut = new T.BufferGeometry();
    ut.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    ut.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    ut.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    return ut;
  }
  const hamta = (nyckel, delar) => {
    if (!cache.has(nyckel)) cache.set(nyckel, slaIhop(delar()));
    return cache.get(nyckel);
  };
  return {
    mat, skuggMat, skuggGeo,
    kropp: (troja, byxor, hud, har) => hamta(`k|${troja}|${byxor}|${hud}|${har}`, () => [
      { g: geo.byxor, f: byxor, x: 0, y: 1.02, z: 0 }, { g: geo.kropp, f: troja, x: 0, y: 1.5, z: 0 },
      { g: geo.huvud, f: hud, x: 0, y: 2.08, z: 0 }, { g: geo.har, f: har, x: 0, y: 2.1, z: 0 }]),
    ben: (hud) => hamta(`b|${hud}`, () => [
      { g: geo.ben, f: hud, x: 0, y: -0.25, z: 0 }, { g: geo.strumpa, f: "#f2f2f2", x: 0, y: -0.66, z: 0 },
      { g: geo.sko, f: "#111111", x: 0, y: -0.86, z: 0.06 }]),
    arm: (troja, bindel) => hamta(`a|${troja}|${bindel}`, () => [
      { g: geo.arm, f: troja, x: 0, y: -0.3, z: 0 }, ...(bindel ? [{ g: geo.bindel, f: "#ffd23f", x: 0, y: -0.12, z: 0 }] : [])]),
    dispose() {
      Object.values(geo).forEach((g) => g.dispose());
      for (const g of cache.values()) g.dispose();
      skuggGeo.dispose();
      mat.dispose();
      skuggMat.dispose();
    },
  };
}

/**
 * En spelare. lag = { troja, byxor, mv } (färger). i väljer hy och hår, så samma
 * spelare ser likadan ut varje match. Kaptenen bär bindeln på vänster överarm.
 */
export function skapaFigur(T, delar, lag, { mv = false, i = 0, kapten = false } = {}) {
  const f = new T.Group();
  const hud = HUD[(i * 7 + (mv ? 3 : 0)) % HUD.length];
  const har = HAR[(i * 5 + (mv ? 1 : 0)) % HAR.length];
  const troja = mv ? lag.mv : lag.troja;
  const lem = (geo, x, y) => {
    const p = new T.Group();
    p.position.set(x, y, 0);
    p.add(new T.Mesh(geo, delar.mat));
    f.add(p);
    return p;
  };
  f.add(new T.Mesh(delar.kropp(troja, mv ? "#222222" : lag.byxor, hud, har), delar.mat));
  const bv = lem(delar.ben(hud), -0.15, 0.9), bh = lem(delar.ben(hud), 0.15, 0.9);
  const av = lem(delar.arm(troja, kapten), -0.39, 1.68), ah = lem(delar.arm(troja, false), 0.39, 1.68);
  const skugga = new T.Mesh(delar.skuggGeo, delar.skuggMat);
  skugga.rotation.x = -Math.PI / 2;
  skugga.position.y = 0.02;
  f.add(skugga);
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
