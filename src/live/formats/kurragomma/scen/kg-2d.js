// ============================================================================
// Kurragömma (#837): 2D-RESERVEN (spec §4.4) – kartan ovanifrån på en vanlig
// canvas, utan WebGL. Samma karta (kg-karta.js), samma logik (kg-scen.js
// stegar figuren, interpolerar sökarna och räknar skyddet) och samma
// styrning/knappar – bara ritandet skiljer. Exakt samma ritar-gränssnitt som
// kg-ritare-3d.js, så kg-scen vet inte vilken som kör.
//
// Elevlägena: kartan centrerad på den egna figuren (norr uppåt, figurens
// riktning som en liten pil). Projektorn: hela ön, och glidningen zoomar
// mot platsen. Avatarerna är samma canvas-bilder som i 3D (kg-avatar-bild.js).
// ============================================================================

import { F } from "./kg-modeller.js";
import { VISSLING_MARKOR_MS } from "../delat/kg-config.js";
import { NIVAER, normNiva } from "./kg-niva.js";

const PX_PER_M = 16;
const FIGUR_PX = 46;
const KONFETTI = ["#2F80ED", "#27AE60", "#F2994A", "#9B51E0", "#EB5757", "#F890B7"];

/** Form per föremålstyp: ctx är flyttad till föremålets mitt och vriden med rot; 1 enhet = 1 m. */
const FORMER = {
  lada: (c) => { rekt(c, 6, 5, F.rod); rekt(c, 6.4, 1.2, F.rodMork, 0, 0); },
  hostack: (c, f) => { cirkel(c, f.r * 0.95, F.gul); cirkel(c, f.r * 0.5, F.barnsten, false); },
  sten: (c, f) => { c.scale(1.3, 1); cirkel(c, f.fast * 0.85, F.grabla); },
  gran: (c, f) => { cirkel(c, f.r, F.grasMork); cirkel(c, f.r * 0.6, F.gron, false); cirkel(c, 0.3, F.jord, false); },
  ek: (c, f) => { cirkel(c, f.r, F.gron); cirkel(c, f.r * 0.6, F.gras, false); cirkel(c, 0.4, F.jord, false); },
  trad: (c, f) => { cirkel(c, f.r, F.gron); cirkel(c, 0.3, F.jord, false); },
  buskage: (c, f) => { const s = f.r / 2.6; cirkel(c, 1.6 * s, F.gron, true, 0, 0); cirkel(c, 1.2 * s, F.gron, true, 1.6 * s, 0.6 * s); cirkel(c, 1.3 * s, F.gron, true, -1.4 * s, 0.4 * s); },
  bro: (c) => rekt(c, 8, 2.4, F.tra),
  damm: (c, f) => { cirkel(c, f.yta || 5.9, F.traLjus, false); cirkel(c, (f.yta || 5.9) - 0.5, F.blaHimmel, false); },
  brunn: (c) => { cirkel(c, 1.3, F.grabla); c.rotate(Math.PI / 4); rekt(c, 1.7, 1.7, F.rod); },
  vedtrave: (c) => rekt(c, 3, 2.6, F.tra),
  vagn: (c) => { rekt(c, 3.4, 2, F.tra); rekt(c, 3, 1.6, F.gul, 0, 0); },
  tunnor: (c) => { cirkel(c, 0.6, F.tra, true, -0.7, 0); cirkel(c, 0.6, F.tra, true, 0.7, 0.2); cirkel(c, 0.6, F.jord, true, 0, 1.2); },
  talt: (c) => { c.rotate(Math.PI / 4); rekt(c, 3.1, 3.1, F.orange); },
  staket: (c) => rekt(c, 3.1, 0.3, F.traLjus),
  blommor: (c) => { [F.vit, F.gul, F.rosa, F.lila].forEach((f, i) => cirkel(c, 0.18, f, false, Math.cos(i * 1.7) * 0.6, Math.sin(i * 1.7) * 0.6)); },
  moln: (c) => { c.globalAlpha = 0.45; cirkel(c, 2.2, F.vit, false); cirkel(c, 1.6, F.vit, false, 2.2, 0.3); cirkel(c, 1.5, F.vit, false, -2.1, 0); c.globalAlpha = 1; },
};
const DEKOR = new Set(["blommor", "moln"]);

let kontur = true;
function cirkel(c, r, farg, linje = true, x = 0, y = 0) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = farg; c.fill();
  if (linje && kontur) { c.lineWidth = 0.14; c.strokeStyle = F.kontur; c.stroke(); }
}
function rekt(c, b, h, farg, x = 0, y = 0) {
  c.fillStyle = farg; c.fillRect(x - b / 2, y - h / 2, b, h);
  if (kontur) { c.lineWidth = 0.14; c.strokeStyle = F.kontur; c.strokeRect(x - b / 2, y - h / 2, b, h); }
}

export function skapa2dRitare({ yta, karta, bilder, jagUid = "jag" }) {
  const canvas = document.createElement("canvas");
  canvas.className = "kg-canvas";
  yta.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let w = 1, h = 1, dpr = 1, niva = 1, lage = "elev-gom", visaNamn = true;
  const figurer = new Map(); // uid → { x, z, gar, namn, skylt, hopp, fas }
  const fx = []; // { typ, x, z, start, d }
  const gomstallen = new Map();
  const vy = { cx: 0, cz: 0, skala: PX_PER_M, yaw: 0 };

  function storlek() {
    w = Math.max(1, yta.clientWidth); h = Math.max(1, yta.clientHeight);
    dpr = niva === 0 ? 1 : Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  storlek();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(storlek) : null;
  if (ro) ro.observe(yta); else window.addEventListener("resize", storlek);

  const tillSkarm = (x, z) => ({ sx: w / 2 + (x - vy.cx) * vy.skala, sy: h / 2 + (z - vy.cz) * vy.skala });

  function ritaVarld(nu) {
    const R = karta.radie;
    ctx.save();
    ctx.translate(w / 2 - vy.cx * vy.skala, h / 2 - vy.cz * vy.skala);
    ctx.scale(vy.skala, vy.skala);
    ctx.lineJoin = "round";
    cirkel(ctx, R + 3, F.sand, false); cirkel(ctx, R + 1, F.gras, false);
    cirkel(ctx, 5.5, F.sand, false, karta.sokarStart.x, karta.sokarStart.z);
    for (const f of karta.foremal) {
      if (!NIVAER[niva].dekor && DEKOR.has(f.typ)) continue;
      const form = FORMER[f.typ];
      if (!form) continue;
      ctx.save(); ctx.translate(f.x, f.z); ctx.rotate(-(f.rot || 0)); form(ctx, f); ctx.restore();
    }
    for (const g of gomstallen.values()) {
      ctx.beginPath(); ctx.arc(g.x, g.z, 1.1, 0, Math.PI * 2);
      ctx.lineWidth = 0.3; ctx.strokeStyle = `rgba(255,176,32,${0.7 + Math.sin(nu * 0.006) * 0.25})`; ctx.stroke();
    }
    ctx.restore();
  }

  function ritaFigurer(nu) {
    const hojd = lage === "projektor" ? FIGUR_PX * 0.55 : FIGUR_PX;
    const lista = [...figurer.entries()].sort((a, b) => a[1].z - b[1].z);
    for (const [uid, f] of lista) {
      const { sx, sy } = tillSkarm(f.x, f.z);
      const bild = bilder.bild(uid);
      const b = (hojd * bild.width) / bild.height;
      const studs = f.gar ? Math.abs(Math.sin(nu * 0.011 + f.fas)) * 4 : 0;
      const hopp = f.hopp > 0 ? Math.sin(Math.min(1, f.hopp) * Math.PI) * 14 : 0;
      ctx.fillStyle = "rgba(30,34,64,0.15)";
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, b * 0.4, b * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      if (uid === jagUid && lage !== "projektor") {
        // Riktningspilen på marken framför fötterna: framåt är (sin yaw, cos yaw).
        ctx.save(); ctx.translate(sx + Math.sin(f.yaw) * 16, sy + Math.cos(f.yaw) * 16); ctx.rotate(Math.PI - f.yaw);
        ctx.fillStyle = "#2F80ED"; ctx.strokeStyle = F.kontur; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-7, 5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.drawImage(bild, sx - b / 2, sy - hojd * 0.92 - studs - hopp, b, hojd);
      if (f.skylt && f.namn && visaNamn) skylt(sx, sy - hojd - 8 - studs, f.namn);
    }
  }

  function skylt(sx, sy, text, bg = "#2F80ED", fg = "#fff", px = 13) {
    ctx.font = `800 ${px}px "Baloo 2", "Segoe UI Rounded", system-ui, sans-serif`;
    const b = ctx.measureText(text).width + px;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(sx - b / 2, sy - px * 0.8, b, px * 1.5, px * 0.75); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, sx, sy);
  }

  function ritaEffekter(nu) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; const t = nu - e.start;
      if (t < 0) continue;
      const k = t / e.d;
      if (k >= 1) { fx.splice(i, 1); continue; }
      const { sx, sy } = tillSkarm(e.x, e.z);
      const m = vy.skala;
      if (e.typ === "ring" || e.typ === "svep") {
        ctx.beginPath(); ctx.arc(sx, sy, (0.8 + k * 5) * m, 0, Math.PI * 2);
        ctx.lineWidth = 0.3 * m; ctx.strokeStyle = e.typ === "ring" ? `rgba(255,176,32,${1 - k})` : `rgba(39,174,96,${1 - k})`; ctx.stroke();
      } else if (e.typ === "markor") {
        const puls = 1 + Math.sin(t * 0.012) * 0.15;
        ctx.beginPath(); ctx.arc(sx, sy, 1.1 * m * puls, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,176,32,0.45)"; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "#FFB020"; ctx.stroke();
      } else if (e.typ === "konfetti") {
        for (let j = 0; j < 12; j++) {
          const a = j * 0.52 + e.start, r = (0.5 + k * 3) * m;
          ctx.fillStyle = KONFETTI[j % KONFETTI.length]; ctx.globalAlpha = 1 - k;
          ctx.fillRect(sx + Math.cos(a) * r - 3, sy + Math.sin(a) * r - 3 - k * 20, 6, 6);
        }
        ctx.globalAlpha = 1;
      } else if (e.typ === "text") {
        ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        skylt(sx, sy - 2.6 * m - k * 12, e.text, e.bg, e.fg, 18);
        ctx.globalAlpha = 1;
      }
    }
  }

  return {
    typ: "2d",
    lageSatt(l) { lage = l; },
    kameraHopp() { /* ingen mjuk följning i 2D */ },
    kamera({ jag, projektor }) {
      if (lage === "projektor") {
        const g = projektor && projektor.glid && !projektor.stilla ? projektor.glid : null;
        const k = g ? g.k : 0;
        const bas = Math.min(w, h) / (2 * (karta.radie + 4));
        vy.skala = bas * (1 + 0.8 * k);
        vy.cx = g ? g.x * k : 0; vy.cz = g ? g.z * k : 0;
      } else { vy.skala = PX_PER_M; vy.cx = jag.x; vy.cz = jag.z; vy.yaw = jag.yaw; }
    },
    figur(uid, { x, z, gar = false, namn = null, skylt: visaSkylt = false, hopp = 0 } = {}) {
      const f = figurer.get(uid) || { fas: Math.random() * 7 };
      Object.assign(f, { x, z, gar, namn, skylt: visaSkylt, hopp, yaw: vy.yaw });
      figurer.set(uid, f);
    },
    figurerBehall(uids) { const s = new Set(uids); for (const u of [...figurer.keys()]) if (!s.has(u)) figurer.delete(u); },
    namnPa(v) { visaNamn = !!v; },
    genomskinlig() { /* behövs inte ovanifrån */ },
    vissling(p, { markor = false, text = true } = {}, nu) {
      for (let i = 0; i < 3; i++) fx.push({ typ: "ring", x: p.x, z: p.z, start: nu + i * 300, d: 1300 });
      if (text) fx.push({ typ: "text", x: p.x, z: p.z, start: nu, d: 1800, text: "Vissling!", bg: "#FFB020", fg: "#22314A" });
      if (markor) fx.push({ typ: "markor", x: p.x, z: p.z, start: nu, d: VISSLING_MARKOR_MS });
    },
    hittad(p, { text = true } = {}, nu) {
      fx.push({ typ: "svep", x: p.x, z: p.z, start: nu, d: 1100 }, { typ: "konfetti", x: p.x, z: p.z, start: nu, d: 1400 });
      if (text) fx.push({ typ: "text", x: p.x, z: p.z, start: nu, d: 1800, text: "Hittad!", bg: "#27AE60", fg: "#fff" });
    },
    gomstalle(uid, p) { gomstallen.set(uid, { x: p.x, z: p.z }); },
    gomstallenRensa() { gomstallen.clear(); },
    skarmPunkt(x, z) {
      const { sx, sy } = tillSkarm(x, z);
      return { sx, sy, framfor: true, inne: sx >= 0 && sx <= w && sy >= 0 && sy <= h };
    },
    markPunkt(sx, sy) { return { x: vy.cx + (sx - w / 2) / vy.skala, z: vy.cz + (sy - h / 2) / vy.skala }; },
    rita(nu) {
      kontur = NIVAER[niva].kontur;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ritaVarld(nu);
      ritaFigurer(nu);
      ritaEffekter(nu);
      return 1;
    },
    nivaSatt(n) { niva = normNiva(n); storlek(); },
    storlek: () => ({ w, h }),
    dispose() {
      if (ro) ro.disconnect(); else window.removeEventListener("resize", storlek);
      canvas.remove(); figurer.clear(); fx.length = 0; gomstallen.clear();
    },
  };
}
