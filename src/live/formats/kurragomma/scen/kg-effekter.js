// ============================================================================
// Kurragömma (#837): EFFEKTERNA i 3D (spec §1.5, §7) – visslingen (ringar,
// noter, "Vissling!" och sökarens markör som syns genom dimman), hittad
// (konfetti och "Hittad!") och gömställena i finalen (gyllene ringar).
// Inga mörka eller läskiga effekter (spec §1.8). Allt är korta, självdöende
// objekt i en lista; tick() flyttar och tar bort.
//
// API
//   skapaEffekter(T, { scen }) → {
//     vissling({ x, z }, { markor, text }, nu)
//     hittad({ x, z }, { text }, nu)
//     gomstalle(uid, { x, z }) · gomstallenRensa()
//     tick(nu, dt) · dispose()
//   }
// ============================================================================

import { VISSLING_MARKOR_MS } from "../delat/kg-config.js";
import { textSprite } from "./kg-figur.js";

const GUL = 0xffb020;
const KONFETTI = [0x2f80ed, 0x27ae60, 0xf2994a, 0x9b51e0, 0xeb5757, 0xf890b7, 0xf2c94c, 0x58c6a9];

export function skapaEffekter(T, { scen }) {
  const fx = []; // { o, start, d, typ, ... }
  const ringGeo = new T.RingGeometry(0.85, 1.15, 40).rotateX(-Math.PI / 2);
  const konfettiGeo = new T.BoxGeometry(0.25, 0.25, 0.05);
  const konfettiMat = KONFETTI.map((c) => new T.MeshBasicMaterial({ color: c }));
  const gomRingGeo = new T.RingGeometry(0.9, 1.2, 32).rotateX(-Math.PI / 2);
  const gomRingMat = new T.MeshBasicMaterial({ color: GUL, transparent: true, opacity: 0.9, depthWrite: false });
  const gomstallen = new Map(); // uid → mesh
  let noteTex = null;
  const noteTextur = () => {
    if (!noteTex) { const sp = textSprite(T, "♪", { bg: null, fg: "#6C4BF4", px: 80, h: 1 }); noteTex = sp.material.map; sp.material.dispose(); }
    return noteTex;
  };

  const lagg = (o, nu, d, typ, extra = {}) => { scen.add(o); fx.push({ o, start: nu, d, typ, ...extra }); return o; };

  function ring(p, farg, nu, d, fordrojning = 0, typ = "ring", { dimma = true } = {}) {
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: farg, transparent: true, depthWrite: false, side: T.DoubleSide, fog: dimma }));
    m.position.set(p.x, 0.12, p.z);
    lagg(m, nu + fordrojning, d, typ);
  }

  /** Sökarens markör: en lysande stolpe + pulserande ring, synlig genom dimman i 4 s. */
  function markor(p, nu) {
    const g = new T.Group();
    const stolpe = new T.Mesh(new T.CylinderGeometry(0.12, 0.25, 6, 8, 1, true),
      new T.MeshBasicMaterial({ color: GUL, transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: T.DoubleSide }));
    stolpe.position.y = 3;
    g.add(stolpe);
    const topp = new T.Mesh(new T.SphereGeometry(0.45, 10, 8), new T.MeshBasicMaterial({ color: GUL, fog: false }));
    topp.position.y = 6.2;
    g.add(topp);
    g.position.set(p.x, 0, p.z);
    lagg(g, nu, VISSLING_MARKOR_MS, "markor");
  }

  function vissling(p, { markor: visaMarkor = false, text = true } = {}, nu) {
    for (let i = 0; i < 3; i++) ring(p, GUL, nu, 1300, i * 300);
    const tex = noteTextur();
    for (let i = 0; i < 5; i++) {
      const n = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: KONFETTI[i % 3] }));
      n.scale.set(1.1, 1.1, 1);
      n.position.set(p.x, 2.2, p.z);
      lagg(n, nu + i * 180, 1700, "not", { vx: (Math.random() - 0.5) * 2.4, vz: (Math.random() - 0.5) * 2.4 });
    }
    if (text) {
      const t = textSprite(T, "Vissling!", { bg: "#FFB020", fg: "#22314A", px: 44, h: 1.2 });
      t.position.set(p.x, 4.6, p.z);
      lagg(t, nu, 1800, "text", { y0: 4.6 });
    }
    if (visaMarkor) markor(p, nu);
  }

  function hittad(p, { text = true } = {}, nu) {
    for (let i = 0; i < 16; i++) {
      const c = new T.Mesh(konfettiGeo, konfettiMat[i % KONFETTI.length]);
      c.position.set(p.x, 2, p.z);
      lagg(c, nu, 1400, "konfetti", { vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 4, vz: (Math.random() - 0.5) * 8 });
    }
    ring(p, 0x27ae60, nu, 1100, 0, "svep");
    if (text) {
      const t = textSprite(T, "Hittad!", { bg: "#27AE60", fg: "#ffffff", px: 44, h: 1.2 });
      t.position.set(p.x, 4.5, p.z);
      lagg(t, nu, 1800, "text", { y0: 4.5 });
    }
  }

  function gomstalle(uid, p) {
    let m = gomstallen.get(uid);
    if (!m) { m = new T.Mesh(gomRingGeo, gomRingMat); gomstallen.set(uid, m); scen.add(m); }
    m.position.set(p.x, 0.1, p.z);
  }

  function gomstallenRensa() {
    for (const m of gomstallen.values()) scen.remove(m);
    gomstallen.clear();
  }

  function tabort(i) {
    const f = fx[i];
    scen.remove(f.o);
    if (f.typ === "ring" || f.typ === "svep" || f.typ === "text" || f.typ === "not") { f.o.material.dispose(); }
    if (f.typ === "text") f.o.material.map.dispose();
    if (f.typ === "markor") f.o.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    fx.splice(i, 1);
  }

  function tick(nu, dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const e = nu - f.start;
      if (e < 0) { f.o.visible = false; continue; }
      f.o.visible = true;
      const k = e / f.d;
      if (k >= 1) { tabort(i); continue; }
      switch (f.typ) {
        case "ring": { const s = 1 + k * 6; f.o.scale.set(s, 1, s); f.o.material.opacity = 1 - k; break; }
        case "svep": { const s = 0.35 + Math.min(1, k * 2.5) * 0.65 * 3; f.o.scale.set(s, 1, s); f.o.material.opacity = 0.9 * (1 - k); break; }
        case "not": f.o.position.y += dt * 2.4; f.o.position.x += f.vx * dt; f.o.position.z += f.vz * dt; f.o.material.opacity = 1 - k; break;
        case "text": { const p = Math.min(1, e / 170); f.o.material.opacity = k > 0.75 ? (1 - k) * 4 : 1; f.o.position.y = f.y0 - (1 - p) * 0.8 + k * 0.6; break; }
        case "konfetti":
          f.vy -= 14 * dt; f.o.position.x += f.vx * dt; f.o.position.z += f.vz * dt;
          f.o.position.y = Math.max(0.1, f.o.position.y + f.vy * dt);
          f.o.rotation.x += dt * 8; f.o.rotation.y += dt * 6;
          f.o.scale.setScalar(Math.max(0.05, 1 - k * k));
          break;
        case "markor": { const puls = 0.85 + Math.sin(e * 0.012) * 0.15; f.o.scale.set(puls, 1, puls); f.o.children[0].material.opacity = 0.55 * (k > 0.8 ? (1 - k) * 5 : 1); break; }
        default: break;
      }
    }
    gomRingMat.opacity = 0.7 + Math.sin(nu * 0.006) * 0.25;
  }

  return {
    vissling, hittad, gomstalle, gomstallenRensa, tick,
    antal: () => fx.length + gomstallen.size,
    dispose() {
      while (fx.length) tabort(fx.length - 1);
      gomstallenRensa();
      ringGeo.dispose(); konfettiGeo.dispose(); gomRingGeo.dispose(); gomRingMat.dispose();
      konfettiMat.forEach((m) => m.dispose());
      if (noteTex) noteTex.dispose();
    },
  };
}
