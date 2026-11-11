// ============================================================================
// Kurragömma (#837): VÄRLDEN i three.js – ön och alla föremål ur kg-karta.js
// byggda ur kg-modeller.js och SAMMANSLAGNA till få ritanrop (spec §4.4):
//
//   varld        ett enda vertexfärgat MeshToonMaterial-mesh (3-stegs gradient)
//   varldKontur  en enda bakåtvänd, lite förstorad kopia (#3B3350) = konturen
//   dekor(+kontur)  blommor, moln, stigen – döljs på nivån Låg
//   skuggor      alla blob-skuggor som ett platt, halvgenomskinligt mesh
//   lov-föremål  (buskage, höstacken, granen, eken) ligger var för sig så det
//                man står inne i kan göras halvgenomskinligt (kg-kamera.js)
//
// T är three-modulen (laddad med import() i kg-tre.js) – ingen statisk import.
//
// API
//   byggVarld(T, karta, { gradient }) → { grupp, nivaSatt({ kontur, dekor }), genomskinlig(id|null), ritanrop, dispose() }
// ============================================================================

import { delarFor, onDelar, skuggRadie, F } from "./kg-modeller.js";

const KONTUR_M = 0.085;
const SKUGG_FARG = 0x1e2240;

/** Primitivens geometri (centrerad i origo). */
function geometri(T, del) {
  const p = del.p;
  switch (del.geo) {
    case "cyl": return new T.CylinderGeometry(p[0], p[1], p[2], p[3] || 8);
    case "box": return new T.BoxGeometry(p[0], p[1], p[2]);
    case "kon": return new T.ConeGeometry(p[0], p[1], p[2] || 8);
    case "iko": return new T.IcosahedronGeometry(p[0], 0);
    case "dod": return new T.DodecahedronGeometry(p[0], 0);
    case "sfar": return new T.SphereGeometry(p[0], p[1] || 8, p[2] || 6);
    case "cirkel": { const g = new T.CircleGeometry(p[0], p[1] || 24); g.rotateX(-Math.PI / 2); return g; }
    default: throw new Error(`okänd geometri ${del.geo}`);
  }
}

/** Delens egen matris (skala, vridning, plats) gånger föremålets (plats, rot). */
function matris(T, del, f) {
  const m = new T.Matrix4().compose(
    new T.Vector3(del.x, del.y, del.z),
    new T.Quaternion().setFromEuler(new T.Euler(del.rx || 0, del.ry || 0, del.rz || 0)),
    new T.Vector3(del.sx || 1, del.sy || 1, del.sz || 1),
  );
  const o = new T.Matrix4().makeRotationY(f.rot || 0).setPosition(f.x, 0, f.z);
  return o.multiply(m);
}

/** Samlare för en sammanslagen, vertexfärgad geometri. */
function samlare(T) {
  const pos = [], nor = [], col = [];
  const farg = new T.Color();
  return {
    tom: () => pos.length === 0,
    lagg(geo, m, hex) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m);
      g.computeVertexNormals(); // per yta eftersom hörnen inte delas → platt, low-poly
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      if (hex) {
        farg.set(hex);
        for (let i = 0; i < p.length; i += 3) col.push(farg.r, farg.g, farg.b);
      }
      if (g !== geo) g.dispose();
    },
    bygg() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
      if (col.length) g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      return g;
    },
  };
}

/** Konturens förstoring per axel: samma tjocklek oavsett delens storlek. */
function konturSkala(T, geo) {
  geo.computeBoundingBox();
  const s = new T.Vector3();
  geo.boundingBox.getSize(s);
  return [1 + (2 * KONTUR_M) / Math.max(s.x, 0.1), 1 + (2 * KONTUR_M) / Math.max(s.y, 0.1), 1 + (2 * KONTUR_M) / Math.max(s.z, 0.1)];
}

/** Lägg ett föremåls delar i samlarna (kropp + kontur). */
function laggForemal(T, f, delar, kropp, kontur) {
  for (const del of delar) {
    const geo = geometri(T, del);
    const m = matris(T, del, f);
    if (del.kontur !== false && kontur) {
      const k = geo.clone();
      const [sx, sy, sz] = konturSkala(T, geo);
      k.scale(sx, sy, sz);
      kontur.lagg(k, m, null);
      k.dispose();
    }
    kropp.lagg(geo, m, del.f);
    geo.dispose();
  }
}

export function byggVarld(T, karta, { gradient } = {}) {
  const grupp = new T.Group();
  grupp.name = "kg-varld";
  const toon = (extra = {}) => new T.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, ...extra });
  const konturMat = new T.MeshBasicMaterial({ color: F.kontur, side: T.BackSide });
  const skuggMat = new T.MeshBasicMaterial({ color: SKUGG_FARG, transparent: true, opacity: 0.13, depthWrite: false });
  const meshar = [];
  const mesh = (geo, mat, namn) => {
    const me = new T.Mesh(geo, mat);
    me.name = namn;
    me.matrixAutoUpdate = false;
    me.frustumCulled = false; // ett stort mesh – alltid i bild
    grupp.add(me);
    meshar.push(me);
    return me;
  };

  const varld = samlare(T), varldKontur = samlare(T), dekor = samlare(T), dekorKontur = samlare(T), skuggor = samlare(T);
  const ON = { x: 0, z: 0, rot: 0 };
  laggForemal(T, ON, onDelar(karta).filter((d) => d.grupp !== "dekor"), varld, varldKontur);
  laggForemal(T, ON, onDelar(karta).filter((d) => d.grupp === "dekor"), dekor, dekorKontur);

  const lov = new Map(); // id → { mesh, kontur, mat }
  for (const f of karta.foremal) {
    const delar = delarFor(f);
    const r = skuggRadie(f);
    if (r > 0) {
      const g = new T.CircleGeometry(r, 20).rotateX(-Math.PI / 2);
      skuggor.lagg(g, new T.Matrix4().setPosition(f.x, 0.03, f.z), null);
      g.dispose();
    }
    if (f.lov) {
      const k = samlare(T), kk = samlare(T);
      laggForemal(T, f, delar, k, kk);
      const mat = toon();
      const me = mesh(k.bygg(), mat, `kg-lov-${f.id}`);
      const ko = mesh(kk.bygg(), konturMat, `kg-lov-kontur-${f.id}`);
      lov.set(f.id, { mesh: me, kontur: ko, mat });
      continue;
    }
    laggForemal(T, f, delar.filter((d) => d.grupp !== "dekor"), varld, varldKontur);
    laggForemal(T, f, delar.filter((d) => d.grupp === "dekor"), dekor, dekorKontur);
  }

  mesh(varld.bygg(), toon(), "kg-varld-kropp");
  const konturMesh = mesh(varldKontur.bygg(), konturMat, "kg-varld-kontur");
  const dekorMesh = dekor.tom() ? null : mesh(dekor.bygg(), toon(), "kg-dekor");
  const dekorKonturMesh = dekorKontur.tom() ? null : mesh(dekorKontur.bygg(), konturMat, "kg-dekor-kontur");
  const skuggMesh = mesh(skuggor.bygg(), skuggMat, "kg-skuggor");
  skuggMesh.renderOrder = -1;

  let visaKontur = true, visaDekor = true, genomskinligId = null;
  function uppdatera() {
    konturMesh.visible = visaKontur;
    if (dekorMesh) dekorMesh.visible = visaDekor;
    if (dekorKonturMesh) dekorKonturMesh.visible = visaDekor && visaKontur;
    for (const [id, l] of lov) {
      const genom = id === genomskinligId;
      if (l.mat.transparent !== genom) {
        l.mat.transparent = genom;
        l.mat.opacity = genom ? 0.35 : 1;
        l.mat.depthWrite = !genom;
        l.mat.needsUpdate = true;
      }
      l.kontur.visible = visaKontur && !genom;
    }
  }
  uppdatera();

  return {
    grupp,
    nivaSatt({ kontur = true, dekor: visaD = true } = {}) { visaKontur = !!kontur; visaDekor = !!visaD; uppdatera(); },
    /** Det lov-föremål figuren står inne i ritas halvgenomskinligt (eller null). */
    genomskinlig(id) { if (id !== genomskinligId) { genomskinligId = id || null; uppdatera(); } },
    ritanrop: () => meshar.filter((m) => m.visible).length,
    dispose() {
      for (const m of meshar) { m.geometry.dispose(); }
      for (const l of lov) l[1].mat.dispose();
      konturMat.dispose(); skuggMat.dispose();
      grupp.clear();
    },
  };
}
