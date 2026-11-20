// ============================================================================
// Matchdagen (#869): 3D-ARENAN – det som står still (spec §4, skissen): planen
// med gräsränder och linjer (canvas-textur), mål med nät, reklamskyltar
// "PLUGGPORTEN"/"MATCHDAGEN", läktaren med publik (canvas-textur) och
// kvällsljuset med fyra strålkastarmaster. Tar three-modulen T som argument –
// three laddas bara när matchen startar (src/tre/tre-ladda.js).
//
//   byggArena(T, scen, { lugnt }) → { natBukt(sida, t), publikJubel(t), dispose() }
//   sida: 1 = deras mål (höger, +x), -1 = vårt mål. t = 0–1 (effektens styrka).
// ============================================================================

import { PLAN_B, PLAN_L } from "./md-formation.js";

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

/** Reklamskyltarna: PLUGGPORTEN och MATCHDAGEN om vartannat. */
function skyltTextur() {
  const c = canvas(1024, 64);
  const g = c.getContext("2d");
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#ffd23f" : "#1d3a6e";
    g.fillRect(i * 256, 0, 256, 64);
    g.fillStyle = i % 2 ? "#1b1500" : "#fff";
    g.font = "800 34px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.textAlign = "center";
    g.fillText(i % 2 ? "MATCHDAGEN" : "PLUGGPORTEN", i * 256 + 128, 45);
  }
  return c;
}

/** Publiken: små färgade prickar på mörka bänkrader (ingen slump – samma varje gång). */
function publikTextur() {
  const c = canvas(512, 128);
  const g = c.getContext("2d");
  g.fillStyle = "#1c2a42";
  g.fillRect(0, 0, 512, 128);
  for (let r = 0; r < 8; r++) { g.fillStyle = r % 2 ? "#22324d" : "#1a2840"; g.fillRect(0, r * 16, 512, 16); }
  const farger = ["#e8473f", "#f2f2f2", "#2f6fe8", "#ffd23f", "#8e5cf7", "#f59f1a", "#5a6478", "#2ecc71"];
  let s = 7;
  const slump = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = farger[Math.floor(slump() * farger.length)];
    g.fillRect(slump() * 512, Math.floor(slump() * 8) * 16 + 4 + slump() * 6, 3, 5);
  }
  return c;
}

export function byggArena(T, scen, { lugnt = false } = {}) {
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
  const skyltTex = tex(skyltTextur(), 4);
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

  // Läktaren med publik bakom bortre långsidan, och ett tak.
  const publikTex = tex(publikTextur(), 6);
  const lakt = new T.Mesh(spara(new T.PlaneGeometry(130, 18)), lambert({ map: publikTex }));
  lakt.position.set(0, 7.2, -46);
  lakt.rotation.x = -0.55;
  scen.add(lakt);
  const tak = new T.Mesh(spara(new T.BoxGeometry(132, 0.6, 9)), lambert({ color: "#16233a" }));
  tak.position.set(0, 16, -52);
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

  return {
    /** Nätet buktar ut (t 0–1). */
    natBukt(sida, t) {
      const n = nat[sida];
      if (!n) return;
      const b = lugnt ? 0 : t;
      n.mesh.scale.set(1 + b * 0.6, 1, 1 + b * 0.08);
      n.mesh.position.x = n.x + sida * b * 0.6;
    },
    /** Publiken jublar: läktaren gungar lite (inte i lugnt läge). */
    publikJubel(t) {
      lakt.position.y = 7.2 + (lugnt ? 0 : Math.abs(Math.sin(t * Math.PI * 6)) * 0.35 * (1 - t));
    },
    dispose() {
      for (const x of sparat) x.dispose?.();
    },
  };
}
