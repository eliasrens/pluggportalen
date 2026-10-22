// ============================================================================
// Meteorstormen – projektorns RYMD på Canvas 2D (#822, spec §4.1): stjärnhimlen,
// meteorerna (från kanterna; en slungad meteor drar en svans i den kastande
// klassens färg med "från 4B"), laserstrålarna, de mjuka explosionerna (gnistor
// + ett litet "puff" – inget blinkande, inga vita blixtar över skärmen) och de
// lugna fyrverkerierna i slutet. Effekterna räknas ur motorns logg vid t (ingen
// partikelstat, ingen Math.random) – två projektorer ritar samma bild.
//
// API
//   skapaBakgrund(pxW, pxH)               → offscreen-canvas (stjärnor, nebulosa, planet)
//   ritaTindra(g, t, rorelse)             några stjärnor som tindrar långsamt
//   ritaMeteor(g, m, p, o)                p = meteorPunkt, o = { t, seed, farg (kastarens),
//                                         fran (klassnamn), pl, geo }
//   samlaEffekter(logg, t, ctx)           → { vagor: [[{ vinkel, alder }]], eff: [...] }
//   traffVinkel(p, ctx)                   → vinkeln (rad) där en meteor slog ner
//   ritaEffekter(g, eff, ctx)
//   ritaFyrverkeri(g, t, sedan, x, y, farg, seed)
// ============================================================================

import { W, H, platser, meteorGeo, meteorPunkt, brus, METEOR_R, RADIE } from "./msp-scen.js";

const TAU = Math.PI * 2;
const EFFEKT_MS = 1400;

export function skapaBakgrund(pxW, pxH) {
  const c = document.createElement("canvas");
  c.width = pxW;
  c.height = pxH;
  const g = c.getContext("2d");
  g.scale(pxW / W, pxH / H);
  const himmel = g.createLinearGradient(0, 0, 0, H);
  himmel.addColorStop(0, "#070c2b");
  himmel.addColorStop(0.6, "#0f1a48");
  himmel.addColorStop(1, "#18265c");
  g.fillStyle = himmel;
  g.fillRect(0, 0, W, H);
  for (const [x, y, r, f] of [[300, 200, 420, "rgba(120,80,200,.12)"], [1320, 260, 380, "rgba(40,170,190,.09)"], [820, 760, 520, "rgba(90,70,190,.08)"]]) {
    const n = g.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, f);
    n.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = n;
    g.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 260; i++) {
    const x = brus("stjarna", `x${i}`) * W;
    const y = brus("stjarna", `y${i}`) * H;
    const r = 0.6 + brus("stjarna", `r${i}`) ** 3 * 2.2;
    g.fillStyle = `rgba(${220 + (i % 3) * 12},${225 + (i % 2) * 20},255,${0.35 + brus("stjarna", `a${i}`) * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  // en avlägsen planet i nedre hörnet
  const pg = g.createRadialGradient(150, 930, 30, 120, 960, 260);
  pg.addColorStop(0, "#3d6fd1");
  pg.addColorStop(0.7, "#253f8f");
  pg.addColorStop(1, "#1a2b66");
  g.fillStyle = pg;
  g.beginPath();
  g.arc(120, 990, 240, 0, TAU);
  g.fill();
  g.strokeStyle = "rgba(140,190,255,.35)";
  g.lineWidth = 3;
  g.stroke();
  return c;
}

export function ritaTindra(g, t, rorelse) {
  if (!rorelse) return;
  for (let i = 0; i < 18; i++) {
    const a = 0.5 + 0.5 * Math.sin(t / (2400 + i * 230) + i * 2.1);
    g.fillStyle = `rgba(255,250,225,${0.15 + 0.6 * a})`;
    g.beginPath();
    g.arc(brus("tindra", `x${i}`) * W, brus("tindra", `y${i}`) * H * 0.8, 1.6 + a, 0, TAU);
    g.fill();
  }
}

function sten(g, r, seed, n, rot) {
  g.save();
  g.rotate(rot);
  g.beginPath();
  const K = 9;
  for (let k = 0; k <= K; k++) {
    const v = (k / K) * TAU;
    const rr = r * (0.8 + 0.28 * brus(seed, `sten|${n}|${k % K}`));
    if (k === 0) g.moveTo(Math.cos(v) * rr, Math.sin(v) * rr);
    else g.lineTo(Math.cos(v) * rr, Math.sin(v) * rr);
  }
  const yta = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  yta.addColorStop(0, "#c9a986");
  yta.addColorStop(1, "#6b513e");
  g.fillStyle = yta;
  g.fill();
  g.strokeStyle = "#3a2b25";
  g.lineWidth = Math.max(2, r * 0.12);
  g.lineJoin = "round";
  g.stroke();
  g.fillStyle = "rgba(70,50,40,.45)";
  for (const [cx, cy, cr] of [[0.25, -0.15, 0.22], [-0.3, 0.3, 0.15]]) {
    g.beginPath();
    g.arc(cx * r, cy * r, cr * r, 0, TAU);
    g.fill();
  }
  g.restore();
}

export function ritaMeteor(g, m, p, o) {
  const r = METEOR_R[m.storlek] || 14;
  const n = String(m.id).split(".")[0];
  const sp = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / sp;
  const uy = p.vy / sp;
  if (m.kastadAv && o.geo) {
    // svansen längs bågen i den kastande klassens färg
    g.lineCap = "round";
    for (let k = 7; k >= 1; k--) {
      const q0 = meteorPunkt(o.geo, o.t - k * 110, o.pl);
      const q1 = meteorPunkt(o.geo, o.t - (k - 1) * 110, o.pl);
      g.strokeStyle = o.farg;
      g.globalAlpha = 0.55 * (1 - k / 8);
      g.lineWidth = r * (1.3 - k * 0.12);
      g.beginPath();
      g.moveTo(q0.x, q0.y);
      g.lineTo(q1.x, q1.y);
      g.stroke();
    }
    g.globalAlpha = 1;
  } else {
    const svans = g.createLinearGradient(p.x, p.y, p.x - ux * r * 4, p.y - uy * r * 4);
    svans.addColorStop(0, m.jatte ? "rgba(255,140,90,.55)" : "rgba(255,200,140,.35)");
    svans.addColorStop(1, "rgba(255,200,140,0)");
    g.strokeStyle = svans;
    g.lineWidth = r * 1.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - ux * r * 4, p.y - uy * r * 4);
    g.stroke();
  }
  if (m.jatte) {
    const puls = 0.5 + 0.5 * Math.sin(o.t / 900);
    const glod = g.createRadialGradient(p.x, p.y, r * 0.8, p.x, p.y, r * 1.9);
    glod.addColorStop(0, `rgba(255,110,70,${0.35 + 0.15 * puls})`);
    glod.addColorStop(1, "rgba(255,110,70,0)");
    g.fillStyle = glod;
    g.beginPath();
    g.arc(p.x, p.y, r * 1.9, 0, TAU);
    g.fill();
  }
  g.save();
  g.translate(p.x, p.y);
  sten(g, r, o.seed, n, (o.t / 1000) * (0.6 + brus(o.seed, `rot|${n}`)) + brus(o.seed, `rot0|${n}`) * TAU);
  g.restore();
  if (m.kastadAv && o.fran) {
    g.font = `800 22px "Baloo 2", system-ui, sans-serif`;
    g.textAlign = "center";
    g.lineJoin = "round";
    g.lineWidth = 5;
    g.strokeStyle = "rgba(10,14,40,.85)";
    g.strokeText(`från ${o.fran}`, p.x, p.y - r - 14);
    g.fillStyle = o.farg;
    g.fillText(`från ${o.fran}`, p.x, p.y - r - 14);
  }
}

const vinklar = new WeakMap();

/** Var på stationen en meteor slog ner (vinkel från stationens mitt). */
export function traffVinkel(p, ctx) {
  if (vinklar.has(p)) return vinklar.get(p);
  const geo = meteorGeo(p.meteor, ctx.plan, ctx.kast, ctx.cfg, ctx.index);
  const i = ctx.index.get(p.classId) ?? 0;
  const pl = platser(ctx.pl.length); // alltid matchens läge – samma vinkel efter slutet
  const st = pl[i];
  let v = brus(ctx.seed, `v|${p.meteor}`) * TAU;
  if (geo && st) {
    const q = meteorPunkt(geo, geo.ankomstMs, pl);
    v = Math.atan2(q.y - st.y, q.x - st.x);
  }
  vinklar.set(p, v);
  return v;
}

/** Loggens färska poster → vågor i sköldarna + explosioner och laserstrålar. */
export function samlaEffekter(logg, t, ctx) {
  const vagor = ctx.pl.map(() => []);
  const eff = [];
  for (let k = logg.length - 1; k >= 0; k--) {
    const p = logg[k];
    const alder = t - p.t;
    if (alder > EFFEKT_MS) break;
    if (alder < 0) continue;
    const i = ctx.index.get(p.classId);
    if (i === undefined) continue;
    const st = ctx.pl[i];
    if (p.typ === "skold") {
      vagor[i].push({ vinkel: traffVinkel(p, ctx), alder });
    } else if (p.typ === "traff" || p.typ === "flyter") {
      const v = traffVinkel(p, ctx);
      const rr = (p.typ === "flyter" ? RADIE.bubbla * 0.8 : RADIE.skrov) * st.skala;
      eff.push({ typ: p.typ === "traff" ? "boom" : "puff", x: st.x + Math.cos(v) * rr, y: st.y + Math.sin(v) * rr, r: (METEOR_R[p.storlek] || 14) * 1.2, alder, n: p.meteor });
    } else if (p.typ === "nedskjuten") {
      const geo = meteorGeo(p.meteor, ctx.plan, ctx.kast, ctx.cfg, ctx.index);
      if (!geo) continue;
      const q = meteorPunkt(geo, p.t, ctx.pl);
      eff.push({ typ: "laser", x0: st.x, y0: st.y - RADIE.skrov * st.skala * 0.6, x: q.x, y: q.y, alder, farg: ctx.farger[i] });
      eff.push({ typ: "boom", x: q.x, y: q.y, r: METEOR_R[p.storlek] || 14, alder, n: p.meteor });
    }
  }
  return { vagor, eff };
}

export function ritaEffekter(g, eff, ctx) {
  for (const e of eff) {
    if (e.typ === "laser") {
      if (e.alder > 260) continue;
      const f = e.alder / 260;
      g.lineCap = "round";
      g.strokeStyle = `rgba(120,240,255,${0.35 * (1 - f)})`;
      g.lineWidth = 12 * (1 - f) + 2;
      g.beginPath();
      g.moveTo(e.x0, e.y0);
      g.lineTo(e.x, e.y);
      g.stroke();
      g.strokeStyle = `rgba(200,255,250,${0.9 * (1 - f)})`;
      g.lineWidth = 3.5 * (1 - f) + 1;
      g.stroke();
      continue;
    }
    if (e.typ === "puff") {
      const f = e.alder / 900;
      if (f >= 1) continue;
      g.fillStyle = `rgba(170,175,200,${0.4 * (1 - f)})`;
      g.beginPath();
      g.arc(e.x, e.y, e.r * (0.6 + f), 0, TAU);
      g.fill();
      continue;
    }
    // mjuk explosion: varm glöd (aldrig vit), gnistor, ett litet puff
    const f = e.alder / 520;
    if (f < 1) {
      const R = e.r * (0.9 + 1.7 * f);
      const eld = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
      eld.addColorStop(0, `rgba(255,214,120,${0.8 * (1 - f)})`);
      eld.addColorStop(0.5, `rgba(255,140,60,${0.5 * (1 - f)})`);
      eld.addColorStop(1, "rgba(255,120,60,0)");
      g.fillStyle = eld;
      g.beginPath();
      g.arc(e.x, e.y, R, 0, TAU);
      g.fill();
    }
    const fg = e.alder / 700;
    if (fg < 1) {
      for (let k = 0; k < 9; k++) {
        const v = brus(ctx.seed, `gx|${e.n}|${k}`) * TAU;
        const d = (25 + 45 * brus(ctx.seed, `gd|${e.n}|${k}`)) * fg * (e.r / 14);
        g.fillStyle = `rgba(255,${190 - k * 6},80,${1 - fg})`;
        g.beginPath();
        g.arc(e.x + Math.cos(v) * d, e.y + Math.sin(v) * d + 18 * fg * fg, 2.6, 0, TAU);
        g.fill();
      }
    }
    const fp = (e.alder - 180) / 1000;
    if (fp > 0 && fp < 1) {
      const R = Math.min(60, e.r) * (0.6 + 0.8 * fp);
      const rok = g.createRadialGradient(e.x, e.y - 14 * fp, 0, e.x, e.y - 14 * fp, R);
      rok.addColorStop(0, `rgba(170,170,195,${0.26 * (1 - fp)})`);
      rok.addColorStop(1, "rgba(170,170,195,0)");
      g.fillStyle = rok;
      g.beginPath();
      g.arc(e.x, e.y - 14 * fp, R, 0, TAU);
      g.fill();
    }
  }
}

/** Lugna fyrverkerier: en raket var 1,7:e s, mjuka färger, ingen vit blixt. */
export function ritaFyrverkeri(g, t, sedan, x, y, farg, seed) {
  const P = 1700;
  const alder = t - sedan;
  if (alder < 0) return;
  const sist = Math.floor(alder / P);
  for (let b = Math.max(0, sist - 2); b <= sist; b++) {
    const a = alder - b * P;
    const bx = x + (brus(seed, `fv|${b}`) - 0.5) * 420;
    const by = y - 110 - brus(seed, `fh|${b}`) * 90;
    const farger = [farg, "#ffd166", "#9be7ff"];
    if (a < 900) {
      const f = a / 900;
      g.fillStyle = "rgba(255,220,160,.8)";
      g.beginPath();
      g.arc(bx, y + 90 - (y + 90 - by) * (1 - (1 - f) ** 2), 3, 0, TAU);
      g.fill();
      continue;
    }
    const f = (a - 900) / 2200;
    if (f >= 1) continue;
    for (let k = 0; k < 26; k++) {
      const v = (k / 26) * TAU + brus(seed, `fk|${b}`) * TAU;
      const d = 120 * (1 - (1 - f) ** 2.2);
      g.fillStyle = farger[k % 3];
      g.globalAlpha = 0.85 * (1 - f) ** 1.4;
      g.beginPath();
      g.arc(bx + Math.cos(v) * d, by + Math.sin(v) * d + 40 * f * f, 3.2, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
