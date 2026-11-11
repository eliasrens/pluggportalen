// Kurragömma B (#837, spec §3): "Kameran får aldrig hamna inne i ett träd eller en
// vägg" – regressionstest mot MODELLERNA (kg-modeller.js byggda med three.js ur
// src/vendor/, raycast udda/jämn = inne). Täcker:
//   • kameran (och near-planets hörn) för alla nåbara platser × riktningar
//   • den LERPADE kameran under en slumpvandring, klippt som kg-ritare-3d.js gör
//   • figurens mitt står aldrig inne i ett fast föremål (modellerna ryms i
//     motorns kollisionscirklar) – bron (ingen kollision) och lov-föremål undantagna
// Tätare rigg (0,5 m × 24 riktningar): testarens kamera-sim, samma metod.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as T from "../src/vendor/three/three.module.min.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { kollidera } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { KAMERA } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { delarFor } from "../src/live/formats/kurragomma/scen/kg-modeller.js";
import { kameraHinder, placeraKamera } from "../src/live/formats/kurragomma/scen/kg-kamera.js";
import { stegaJag } from "../src/live/formats/kurragomma/scen/kg-rorelse.js";

function geometri(del) {
  const p = del.p;
  switch (del.geo) {
    case "cyl": return new T.CylinderGeometry(p[0], p[1], p[2], p[3] || 8);
    case "box": return new T.BoxGeometry(p[0], p[1], p[2]);
    case "kon": return new T.ConeGeometry(p[0], p[1], p[2] || 8);
    case "iko": return new T.IcosahedronGeometry(p[0], 0);
    case "dod": return new T.DodecahedronGeometry(p[0], 0);
    case "sfar": return new T.SphereGeometry(p[0], p[1] || 8, p[2] || 6);
    default: return null; // cirklar är platta
  }
}

const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
const delar = [];
for (const f of ON.foremal) {
  for (const del of delarFor(f)) {
    if (del.grupp === "dekor") continue;
    const g = geometri(del);
    if (!g) continue;
    const m = new T.Matrix4().compose(new T.Vector3(del.x, del.y, del.z),
      new T.Quaternion().setFromEuler(new T.Euler(del.rx || 0, del.ry || 0, del.rz || 0)),
      new T.Vector3(del.sx || 1, del.sy || 1, del.sz || 1));
    const o = new T.Matrix4().makeRotationY(f.rot || 0).setPosition(f.x, 0, f.z).multiply(m);
    const me = new T.Mesh(g, mat);
    me.matrixAutoUpdate = false;
    me.matrix.copy(o);
    me.matrixWorld.copy(o);
    g.computeBoundingSphere();
    delar.push({ f, me, bs: g.boundingSphere.clone().applyMatrix4(o), geo: del.geo });
  }
}
const rc = new T.Raycaster();
const upp = new T.Vector3(0, 1, 0), ned = new T.Vector3(0.3, -1, 0.2).normalize();
/** Delen punkten ligger inne i (udda antal träffar åt två håll), eller null. */
function inneI(p, undantag = null) {
  for (const d of delar) {
    if (d.f.id === undantag) continue;
    if (p.distanceTo(d.bs.center) > d.bs.radius) continue;
    rc.set(p, upp);
    const a = rc.intersectObject(d.me).length;
    rc.set(p, ned);
    const b = rc.intersectObject(d.me).length;
    if (a % 2 === 1 && b % 2 === 1) return d;
  }
  return null;
}
function inneILov(x, z) {
  let basta = null, bd = Infinity;
  for (const f of ON.foremal) {
    if (!f.lov) continue;
    const d = Math.hypot(x - f.x, z - f.z);
    if (d <= f.r && d < bd) { bd = d; basta = f.id; }
  }
  return basta;
}
const hinder = kameraHinder(ON);
const kam = new T.PerspectiveCamera(KAMERA.synfalt, 16 / 9, 0.3, 220);
/** Kameran och near-planets fyra hörn. */
function kameraPunkter(pos, mal) {
  kam.position.copy(pos);
  kam.lookAt(mal);
  kam.updateMatrixWorld();
  const pts = [pos.clone()];
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pts.push(new T.Vector3(x, y, -1).unproject(kam));
  return pts;
}

describe("kameran mot modellerna (kg-kamera.js × kg-modeller.js)", () => {
  it("statiskt: kameran och near-planet är aldrig inne i någon del (1 m rutnät × 12 riktningar)", () => {
    const fel = [];
    let prov = 0;
    for (let x = -ON.radie; x <= ON.radie; x += 1) {
      for (let z = -ON.radie; z <= ON.radie; z += 1) {
        const p = kollidera(x, z, ON);
        if (Math.hypot(p.x - x, p.z - z) > 1e-6) continue; // inte nåbar
        const lov = inneILov(x, z);
        for (let i = 0; i < 12; i++) {
          const yaw = (i / 12) * 2 * Math.PI - Math.PI;
          const c = placeraKamera({ jag: { x, z, yaw }, hinder, inneI: lov });
          prov++;
          for (const q of kameraPunkter(new T.Vector3(c.x, c.y, c.z), new T.Vector3(c.mal.x, c.mal.y, c.mal.z))) {
            const d = inneI(q, lov);
            if (d) { fel.push(`${d.f.id} (${d.geo}) vid jag ${x},${z},${yaw.toFixed(2)}`); break; }
          }
        }
      }
    }
    assert.ok(prov > 20_000, `prov: ${prov}`);
    assert.deepEqual(fel.slice(0, 10), [], `${fel.length} av ${prov} poser inne i ett föremål`);
  });

  it("dynamiskt: den lerpade och klippta kameran (som kg-ritare-3d.js) går aldrig in i något under en slumpvandring", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lerp = (a, b, k) => a + (b - a) * k;
    const fel = [];
    let bilder = 0;
    for (let run = 0; run < 120; run++) {
      let jag = { ...kollidera(rnd() * 50 - 25, rnd() * 50 - 25, ON), yaw: rnd() * 6 - 3 };
      const c0 = placeraKamera({ jag, hinder, inneI: inneILov(jag.x, jag.z) });
      const nu = { x: c0.x, y: c0.y, z: c0.z };
      const dt = 1 / 30;
      let fram = 1, svang = 0;
      for (let s = 0; s < 400; s++) {
        if (s % 20 === 0) { fram = rnd() < 0.7 ? 1 : rnd() < 0.5 ? 0 : -1; svang = rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : -1; }
        jag = stegaJag(jag, { fram, svang, mal: null }, dt, ON);
        const lov = inneILov(jag.x, jag.z);
        const c = placeraKamera({ jag, hinder, inneI: lov });
        const k = 1 - Math.exp(-dt * 7);
        nu.x = lerp(nu.x, c.x, k); nu.y = lerp(nu.y, c.y, k); nu.z = lerp(nu.z, c.z, k);
        const q = placeraKamera({ jag, hinder, inneI: lov, fullt: { ...nu } });
        nu.x = q.x; nu.y = q.y; nu.z = q.z;
        bilder++;
        const d = inneI(new T.Vector3(nu.x, nu.y, nu.z), lov);
        if (d) fel.push(`${d.f.id} (${d.geo}) bildruta ${s} i vandring ${run}`);
      }
    }
    assert.deepEqual(fel.slice(0, 10), [], `${fel.length} av ${bilder} bildrutor inne i ett föremål`);
  });

  it("figuren står aldrig med mitten inne i ett fast föremål – modellerna ryms i kollisionscirklarna", () => {
    const fel = [];
    for (let x = -ON.radie; x <= ON.radie; x += 0.5) {
      for (let z = -ON.radie; z <= ON.radie; z += 0.5) {
        const p = kollidera(x, z, ON);
        if (Math.hypot(p.x - x, p.z - z) > 1e-6) continue;
        const d = inneI(new T.Vector3(x, 0.9, z), inneILov(x, z));
        // Bron har ingen kollision (man går på den), lov-föremål får man stå i.
        if (d && d.f.typ !== "bro" && !d.f.lov) fel.push(`${d.f.id} (${d.geo}) vid ${x},${z}`);
      }
    }
    assert.deepEqual(fel.slice(0, 10), [], `${fel.length} platser`);
  });
});
