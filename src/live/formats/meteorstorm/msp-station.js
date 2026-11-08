// ============================================================================
// Meteorstormen – projektorns RYMDSTATION på Canvas 2D (#822, spec §4.1–4.1.1).
// Mjuka former, tydlig mörk kontur, fönster som lyser, klassens färg på bandet
// och på besättningens dräkter. Skadenivåerna (skadeniva i ms-balans.js):
//   hel       blank, alla fönster lyser
//   repor     repor och små bucklor, lite rök från ett hörn
//   sprickor  sprickor, gnistor då och då, en solpanel hänger snett, röd
//             varningslampa som pulserar LÅNGSAMT (2,6 s, aldrig blink)
//   rok       mer rök, två fönster släckta, antennen böjd
//   flyter    dämpat ljus, stationen driver långsamt, besättningen i
//             rymddräkter utanför och vinkar
// Varje skrovträff lämnar en buckla där meteoren slog ner.
// Allt är en funktion av (tillståndet, t, fröet) – inget eget tillstånd, ingen
// Math.random: två projektorer ritar samma bild för samma t.
//
// API
//   ritaStation(g, o)  o = { x, y, skala, farg, skrov, skold, t, seed, idx,
//                      humor, gung: {x,y}, rorelse, buckla: [vinkel], vagor:
//                      [{ vinkel, alder }], tand (alla lampor – vinnaren), vinka }
// Besättningen: msp-besattning.js. Skölden: msp-skold.js.
// ============================================================================

import { skadeniva } from "./delat/ms-balans.js";
import { RADIE, brus } from "./msp-scen.js";
import { astronaut, KONTUR } from "./msp-besattning.js";

const TAU = Math.PI * 2;
const FONSTER = [[-36, -14], [0, -22], [36, -14]];

function rundRekt(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function solpanel(g, sida, snett) {
  g.save();
  if (snett) {
    g.translate(sida * 100, 0);
    g.rotate(sida * 0.26);
    g.translate(-sida * 100, 0);
  }
  g.fillStyle = "#8d96b3";
  g.strokeStyle = KONTUR;
  g.lineWidth = 3;
  rundRekt(g, sida > 0 ? 70 : -104, -6, 34, 12, 4);
  g.fill();
  g.stroke();
  const x0 = sida > 0 ? 102 : -196;
  rundRekt(g, x0, -34, 94, 68, 7);
  g.fillStyle = "#2b4fa3";
  g.fill();
  g.lineWidth = 4;
  g.stroke();
  g.strokeStyle = "rgba(150,185,255,.55)";
  g.lineWidth = 2;
  g.beginPath();
  for (const dx of [31, 62]) { g.moveTo(x0 + dx, -30); g.lineTo(x0 + dx, 30); }
  g.moveTo(x0 + 4, 0);
  g.lineTo(x0 + 90, 0);
  g.stroke();
  g.restore();
}

/** Rök: K puffar per källa, ålder ur t (ingen partikelstat). */
function rok(g, kallor, t, seed, idx, styrka) {
  const L = 2800;
  const K = 7;
  for (let e = 0; e < kallor.length; e++) {
    const [ex, ey] = kallor[e];
    const drift = brus(seed, `rokd|${idx}|${e}`) - 0.5;
    for (let k = 0; k < K; k++) {
      const f = (((t + (k * L) / K + brus(seed, `rok|${idx}|${e}`) * L) % L) + L) % L / L;
      const r = 7 + f * 24 * styrka;
      g.fillStyle = `rgba(${150 - 40 * styrka},${152 - 40 * styrka},${170 - 40 * styrka},${(1 - f) * 0.32 * Math.min(1.4, styrka + 0.3)})`;
      g.beginPath();
      g.arc(ex + drift * f * 70 + Math.sin(f * 5 + k) * 4, ey - f * 95, r, 0, TAU);
      g.fill();
    }
  }
}

/** Gnistor "då och då": en skur per 2,8 s-fönster om fröet säger så. */
function gnistor(g, t, seed, idx, x0, y0) {
  const P = 2800;
  const b = Math.floor(t / P);
  if (brus(seed, `gn|${idx}|${b}`) > 0.6) return;
  const age = t - b * P - 300;
  if (age < 0 || age > 520) return;
  const f = age / 520;
  for (let k = 0; k < 8; k++) {
    const v = brus(seed, `gnv|${idx}|${b}|${k}`) * TAU;
    const sp = 30 + brus(seed, `gns|${idx}|${b}|${k}`) * 40;
    g.fillStyle = `rgba(255,${200 - k * 8},90,${1 - f})`;
    g.beginPath();
    g.arc(x0 + Math.cos(v) * sp * f, y0 + Math.sin(v) * sp * f + 30 * f * f, 2.6, 0, TAU);
    g.fill();
  }
}

function sprickor(g, seed, idx, antal, R) {
  g.strokeStyle = "rgba(45,35,70,.75)";
  g.lineWidth = 2.5;
  g.lineJoin = "round";
  for (let k = 0; k < antal; k++) {
    const v = brus(seed, `spr|${idx}|${k}`) * TAU;
    let x = Math.cos(v) * R * 0.97;
    let y = Math.sin(v) * R * 0.97;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      const vv = v + Math.PI + (brus(seed, `sprs|${idx}|${k}|${s}`) - 0.5) * 1.3;
      x += Math.cos(vv) * 11;
      y += Math.sin(vv) * 11;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

export function ritaStation(g, o) {
  const { x, y, skala, farg, skrov, t, seed, idx, rorelse } = o;
  const niva = skadeniva(skrov).id;
  const grad = { hel: 0, repor: 1, sprickor: 2, rok: 3, flyter: 4 }[niva];
  const R = RADIE.skrov;
  g.save();
  let dx = rorelse ? o.gung?.x || 0 : 0;
  let dy = rorelse ? o.gung?.y || 0 : 0;
  let rot = 0;
  if (grad === 4 && rorelse) {
    dx += Math.sin(t / 3900) * 12;
    dy += Math.sin(t / 5300) * 8;
    rot = Math.sin(t / 6100) * 0.07;
  }
  g.translate(x + dx, y + dy);
  g.scale(skala, skala);
  g.rotate(rot);

  if (o.tand) {
    // vinnaren tänder alla lampor: varmt sken bakom stationen
    const sken = g.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2.6);
    sken.addColorStop(0, "rgba(255,214,120,.38)");
    sken.addColorStop(1, "rgba(255,214,120,0)");
    g.fillStyle = sken;
    g.beginPath();
    g.arc(0, 0, R * 2.6, 0, TAU);
    g.fill();
  }
  solpanel(g, -1, false);
  solpanel(g, 1, grad >= 2);
  // modulen under och antennen
  rundRekt(g, -30, 54, 60, 36, 10);
  g.fillStyle = "#b9c2d9";
  g.fill();
  g.strokeStyle = KONTUR;
  g.lineWidth = 4;
  g.stroke();
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, -R + 2);
  const topp = grad >= 3 ? [20, -R - 36] : [0, -R - 42];
  if (grad >= 3) { g.lineTo(0, -R - 20); g.lineTo(topp[0], topp[1]); } else g.lineTo(topp[0], topp[1]);
  g.stroke();
  g.fillStyle = grad >= 3 ? "#9aa0b5" : "#ffd166";
  g.beginPath();
  g.arc(topp[0], topp[1], 6, 0, TAU);
  g.fill();
  g.stroke();

  // navet
  const yta = g.createLinearGradient(0, -R, 0, R);
  yta.addColorStop(0, "#f6f8fd");
  yta.addColorStop(1, "#c3cce2");
  g.fillStyle = yta;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = farg;
  g.fillRect(-R, 16, 2 * R, 20);
  g.fillStyle = "rgba(255,255,255,.35)";
  g.fillRect(-R, 16, 2 * R, 4);
  if (grad === 0) {
    g.strokeStyle = "rgba(255,255,255,.75)";
    g.lineWidth = 7;
    g.beginPath();
    g.arc(0, 0, R - 12, Math.PI * 1.08, Math.PI * 1.42);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = KONTUR;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.stroke();

  // fönster + besättning
  const slacka = grad >= 3 ? [0, 2] : [];
  FONSTER.forEach(([fx, fy], k) => {
    const tand = grad < 4 && !slacka.includes(k);
    g.save();
    g.translate(fx, fy);
    if (tand && o.tand) {
      g.fillStyle = "rgba(255,220,120,.35)";
      g.beginPath();
      g.arc(0, 0, 25, 0, TAU);
      g.fill();
    }
    const glas = g.createRadialGradient(0, -3, 2, 0, 0, 16);
    glas.addColorStop(0, tand ? "#fff6cf" : "#3a4066");
    glas.addColorStop(1, tand ? (grad >= 2 ? "#e9b44c" : "#ffd166") : "#232849");
    g.fillStyle = glas;
    g.beginPath();
    g.arc(0, 0, 16, 0, TAU);
    g.fill();
    if (grad < 4) {
      g.save();
      g.beginPath();
      g.arc(0, 0, 14.5, 0, TAU);
      g.clip();
      const pose = o.humor === "lugn" && o.vinka ? "vinka" : o.humor;
      astronaut(g, farg, pose, t, k + idx * 3, rorelse);
      g.restore();
    }
    g.strokeStyle = KONTUR;
    g.lineWidth = 3.5;
    g.beginPath();
    g.arc(0, 0, 16, 0, TAU);
    g.stroke();
    if (o.humor === "svett" && grad < 4 && k === 1) {
      g.fillStyle = "#7fd0ff";
      g.beginPath();
      g.moveTo(14, -16);
      g.quadraticCurveTo(19, -8, 14, -6);
      g.quadraticCurveTo(9, -8, 14, -16);
      g.fill();
    }
    if (o.humor === "jubel" && grad < 4 && k !== 1) {
      g.fillStyle = "#ffe08a";
      g.font = "bold 13px system-ui";
      g.textAlign = "center";
      g.fillText("✦", k === 0 ? -14 : 14, -18);
    }
    g.restore();
  });

  if (o.tand) {
    // en ljusslinga runt navet (fast sken – ingen blinkning)
    for (let k = 0; k < 16; k++) {
      const v = (k / 16) * TAU;
      g.fillStyle = ["#ffd166", "#9be7ff", farg, "#b6f5a8"][k % 4];
      g.beginPath();
      g.arc(Math.cos(v) * (R + 9), Math.sin(v) * (R + 9), 4.5, 0, TAU);
      g.fill();
    }
  }

  // skadorna
  if (grad >= 1) {
    g.strokeStyle = "rgba(70,65,105,.45)";
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = brus(seed, `rep|${idx}|${k}`) * TAU;
      const r = R * (0.35 + 0.5 * brus(seed, `repr|${idx}|${k}`));
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r + 40 * (k % 2 ? 0.3 : -0.1);
      if (ly > -6 && ly < 14 && Math.abs(lx) < 50) continue;
      g.moveTo(lx, ly);
      g.lineTo(lx + 12, ly + 5);
    }
    g.stroke();
  }
  if (grad >= 2 && grad < 4) sprickor(g, seed, idx, grad === 3 ? 4 : 2, R);
  for (const v of o.buckla || []) {
    const bx = Math.cos(v) * R * 0.84;
    const by = Math.sin(v) * R * 0.84;
    g.fillStyle = "rgba(55,50,85,.55)";
    g.beginPath();
    g.ellipse(bx, by, 7, 5, v, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.45)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(bx, by, 7, 5, v, Math.PI * 0.9, Math.PI * 1.7);
    g.stroke();
  }
  if (grad === 2 || grad === 3) {
    const puls = 0.5 + 0.5 * Math.sin((t / 2600) * TAU);
    const lampa = g.createRadialGradient(-50, -54, 1, -50, -54, 18);
    lampa.addColorStop(0, `rgba(255,80,80,${0.35 + 0.5 * puls})`);
    lampa.addColorStop(1, "rgba(255,80,80,0)");
    g.fillStyle = lampa;
    g.beginPath();
    g.arc(-50, -54, 18, 0, TAU);
    g.fill();
    g.fillStyle = `rgb(${190 + 60 * puls},60,60)`;
    g.strokeStyle = KONTUR;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(-50, -54, 7, 0, TAU);
    g.fill();
    g.stroke();
  }
  if (grad >= 1) {
    const kallor = grad === 1 ? [[54, -48]] : grad === 2 ? [[54, -48], [-60, 28]] : grad === 3 ? [[54, -48], [-60, 28], [18, -66]] : [[40, -40]];
    rok(g, kallor, t, seed, idx, grad === 1 ? 0.55 : grad === 4 ? 0.5 : grad === 2 ? 0.8 : 1.15);
  }
  if (grad === 2 || grad === 3) gnistor(g, t, seed, idx, 104, 0);
  if (grad === 4) {
    g.fillStyle = "rgba(10,14,40,.42)";
    g.beginPath();
    g.arc(0, 0, R + 2, 0, TAU);
    g.fill();
  }
  g.restore();

  if (grad === 4) {
    // besättningen i rymddräkter bredvid stationen, vinkar
    [[-1, -150, -78], [1, 150, -86]].forEach(([s, ax, ay], k) => {
      const flyt = rorelse ? Math.sin(t / 1300 + k * 2) * 6 : 0;
      g.save();
      g.translate(x + dx + ax * skala, y + dy + (ay + flyt) * skala);
      g.scale(skala * 1.6, skala * 1.6);
      g.rotate(s * 0.15);
      astronaut(g, farg, "vinka", t, k, rorelse, true);
      g.restore();
    });
  }
}
