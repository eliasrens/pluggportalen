// ============================================================================
// Matchdagen (#869): 3D-ARENAN – det som står still (spec §4, skissen): planen
// med gräsränder och linjer (canvas-textur), mål med nät, reklamskyltar
// "PLUGGPORTEN"/"MATCHDAGEN", läktaren med publik (md-tre-publik.js, #882) och
// kvällsljuset med fyra strålkastarmaster. Tar three-modulen T som argument –
// three laddas bara när matchen startar (src/tre/tre-ladda.js).
//
//   byggArena(T, scen, { lugnt, final? }) → { natBukt(sida, t), publikJubel(t, lag?), publikFarg(sida, farg), steg(tid), dispose() }
//   sida: 1 = deras mål (höger, +x), -1 = vårt mål. t = 0–1 (effektens styrka).
//   final (#873, Mästarcupens final §10.2): fullsatt läktare (tätare publik), flaggor som
//   vajar längs läktarens framkant (EN InstancedMesh – ett ritanrop) och skyltarna
//   "MÄSTARCUPEN"/"FINALEN". Lugnt läge: flaggorna står still.
// ============================================================================

import { PLAN_B, PLAN_L } from "./md-formation.js";
import { byggPublik } from "./md-tre-publik.js";

const K = 20; // pixlar per meter i plantexturen
const MAL_B = 7.32, MAL_H = 2.44;

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Planen: tio gräsränder och kritvita linjer (samma mått som 2D-reserven). */
function planTextur() {
  const c = canvas(PLAN_L * K, PLAN_B * K);
  const g = c.getContext("2d");
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 ? "#2a8240" : "#2f8f45";
    g.fillRect((i * c.width) / 10, 0, c.width / 10 + 1, c.height);
  }
  g.strokeStyle = "rgba(255,255,255,.92)";
  g.lineWidth = 9;
  g.strokeRect(2 * K, 2 * K, 101 * K, 64 * K);
  g.beginPath(); g.moveTo(52.5 * K, 2 * K); g.lineTo(52.5 * K, 66 * K); g.stroke();
  g.beginPath(); g.arc(52.5 * K, 34 * K, 9.15 * K, 0, Math.PI * 2); g.stroke();
  for (const [x, y, w, h] of [[2, 16, 16.5, 36], [86.5, 16, 16.5, 36], [2, 26, 5.5, 16], [97.5, 26, 5.5, 16]]) g.strokeRect(x * K, y * K, w * K, h * K);
  g.fillStyle = "#fff";
  for (const [x, y] of [[52.5, 34], [13, 34], [92, 34]]) { g.beginPath(); g.arc(x * K, y * K, 6, 0, Math.PI * 2); g.fill(); }
  return c;
}

/** Reklamskyltarna: PLUGGPORTEN och MATCHDAGEN om vartannat – i finalen MÄSTARCUPEN och FINALEN. */
function skyltTextur(final = false) {
  const c = canvas(1024, 64);
  const g = c.getContext("2d");
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#ffd23f" : "#1d3a6e";
    g.fillRect(i * 256, 0, 256, 64);
    g.fillStyle = i % 2 ? "#1b1500" : "#fff";
    g.font = "800 34px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.textAlign = "center";
    g.fillText(final ? (i % 2 ? "FINALEN" : "MÄSTARCUPEN") : i % 2 ? "MATCHDAGEN" : "PLUGGPORTEN", i * 256 + 128, 45);
  }
  return c;
}

export function byggArena(T, scen, { lugnt = false, final = false } = {}) {
  const sparat = []; // geometrier, material och texturer att släppa
  const spara = (...x) => { sparat.push(...x); return x[0]; };
  const tex = (c, rep = null) => {
    const t = spara(new T.CanvasTexture(c));
    t.colorSpace = T.SRGBColorSpace;
    if (rep) { t.wrapS = T.RepeatWrapping; t.repeat.set(rep, 1); }
    return t;
  };
  const lambert = (o) => spara(new T.MeshLambertMaterial(o));

  // Planen och gräset runt om.
  const planTex = tex(planTextur());
  planTex.anisotropy = 4;
  const plan = new T.Mesh(spara(new T.PlaneGeometry(PLAN_L, PLAN_B)), lambert({ map: planTex }));
  plan.rotation.x = -Math.PI / 2;
  scen.add(plan);
  const omgivning = new T.Mesh(spara(new T.PlaneGeometry(170, 120)), lambert({ color: "#1f5a30" }));
  omgivning.rotation.x = -Math.PI / 2;
  omgivning.position.y = -0.02;
  scen.add(omgivning);

  // Målen med nät (nätet buktar vid mål).
  const vit = lambert({ color: "#ffffff" });
  const stolpGeo = spara(new T.CylinderGeometry(0.09, 0.09, MAL_H, 8));
  const ribbGeo = spara(new T.CylinderGeometry(0.09, 0.09, MAL_B, 8));
  const natMat = spara(new T.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.4 }));
  const natGeo = spara(new T.BoxGeometry(2, MAL_H, MAL_B, 4, 4, 10));
  const nat = {};
  for (const sida of [-1, 1]) {
    const x = sida * (PLAN_L / 2 - 2); // mållinjen (linjen i texturen ligger 2 m in)
    for (const z of [-MAL_B / 2, MAL_B / 2]) {
      const s = new T.Mesh(stolpGeo, vit);
      s.position.set(x, MAL_H / 2, z);
      scen.add(s);
    }
    const ribba = new T.Mesh(ribbGeo, vit);
    ribba.rotation.x = Math.PI / 2;
    ribba.position.set(x, MAL_H, 0);
    scen.add(ribba);
    const n = new T.Mesh(natGeo, natMat);
    n.position.set(x + sida, MAL_H / 2, 0);
    scen.add(n);
    nat[sida] = { mesh: n, x: x + sida };
  }

  // Reklamskyltar längs långsidorna och bakom målen.
  const skyltTex = tex(skyltTextur(final), 4);
  const skyltMat = spara(new T.MeshBasicMaterial({ map: skyltTex }));
  const skyltGeo = spara(new T.PlaneGeometry(112, 1.1));
  for (const [z, rot] of [[-37.5, 0], [37.5, Math.PI]]) {
    const b = new T.Mesh(skyltGeo, skyltMat);
    b.position.set(0, 0.55, z);
    b.rotation.y = rot;
    scen.add(b);
  }
  const kortSkylt = spara(new T.PlaneGeometry(60, 1.1));
  for (const sida of [-1, 1]) {
    const b = new T.Mesh(kortSkylt, skyltMat);
    b.position.set(sida * 56.5, 0.55, 0);
    b.rotation.y = -sida * Math.PI / 2;
    scen.add(b);
  }

  // Läktaren med publik bakom bortre långsidan (#882: bänkrader och figurer i lagens färger), och ett tak.
  const publik = byggPublik(T, scen, { final, spara });
  const tak = new T.Mesh(spara(new T.BoxGeometry(132, 0.6, 10)), lambert({ color: "#16233a" }));
  tak.position.set(0, 10.6, -49.5); // vilar på bakväggen (md-tre-publik.js)
  scen.add(tak);

  // Kvällsljuset: himmel, dimma, ljus och fyra strålkastarmaster.
  scen.background = new T.Color("#0b1830");
  scen.fog = new T.Fog("#0b1830", 95, 180);
  scen.add(new T.HemisphereLight("#cfe3ff", "#24452a", 1.6));
  const sol = new T.DirectionalLight("#fff6e0", 1.6);
  sol.position.set(-30, 60, 40);
  scen.add(sol);
  const mastMat = lambert({ color: "#2a3448" });
  const lampMat = spara(new T.MeshBasicMaterial({ color: "#fff8d6" }));
  const mastGeo = spara(new T.BoxGeometry(0.5, 24, 0.5));
  const lampGeo = spara(new T.BoxGeometry(4, 1.6, 0.6));
  for (const [x, z] of [[-58, -42], [58, -42], [-58, 42], [58, 42]]) {
    const m = new T.Mesh(mastGeo, mastMat);
    m.position.set(x, 12, z);
    scen.add(m);
    const l = new T.Mesh(lampGeo, lampMat);
    l.position.set(x, 24.5, z);
    l.lookAt(0, 0, 0);
    scen.add(l);
  }

  // Finalen: flaggor på stänger längs läktarens framkant (en InstancedMesh, färg per instans).
  let flaggor = null;
  const FLAGGOR = 22;
  if (final) {
    const flaggGeo = spara(new T.PlaneGeometry(2.2, 1.3));
    flaggGeo.translate(1.1, 0, 0); // vajar kring stången
    flaggor = new T.InstancedMesh(flaggGeo, spara(new T.MeshBasicMaterial({ side: T.DoubleSide })), FLAGGOR);
    const fargerF = ["#ffd23f", "#e8473f", "#2f6fe8", "#ffffff", "#2ecc71", "#8e5cf7"];
    const c = new T.Color();
    for (let i = 0; i < FLAGGOR; i++) flaggor.setColorAt(i, c.set(fargerF[i % fargerF.length]));
    scen.add(flaggor);
  }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), eul = new T.Euler(), pv = new T.Vector3(), en = new T.Vector3(1, 1, 1);
  function flagga(i, tid) {
    eul.set(0, lugnt ? 0.3 : Math.sin(tid * 1.7 + i * 0.9) * 0.45, 0);
    pv.set(-60 + (i * 120) / (FLAGGOR - 1), 4.8 + (i % 2) * 2.2, -39.5 - (i % 2) * 2.4);
    flaggor.setMatrixAt(i, m4.compose(pv, q.setFromEuler(eul), en));
  }
  if (flaggor) { for (let i = 0; i < FLAGGOR; i++) flagga(i, 0); flaggor.instanceMatrix.needsUpdate = true; }

  return {
    /** Flaggorna vajar (bara i finalen, inte i lugnt läge). */
    steg(tid) {
      if (!flaggor || lugnt) return;
      for (let i = 0; i < FLAGGOR; i++) flagga(i, tid);
      flaggor.instanceMatrix.needsUpdate = true;
    },
    /** Nätet buktar ut (t 0–1). */
    natBukt(sida, t) {
      const n = nat[sida];
      if (!n) return;
      const b = lugnt ? 0 : t;
      n.mesh.scale.set(1 + b * 0.6, 1, 1 + b * 0.08);
      n.mesh.position.x = n.x + sida * b * 0.6;
    },
    /** Publiken jublar och hoppar – bara lag:ets halva om lag anges (inte i lugnt läge). */
    publikJubel(t, lag = null) {
      if (!lugnt) publik.jubel(t, lag);
    },
    /** Lagets tröjfärg på dess halva av läktaren. */
    publikFarg: (sida, farg) => publik.lagFarg(sida, farg),
    dispose() {
      flaggor?.dispose();
      publik.dispose();
      for (const x of sparat) x.dispose?.();
    },
  };
}
