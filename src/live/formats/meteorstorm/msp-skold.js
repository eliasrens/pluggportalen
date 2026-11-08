// ============================================================================
// Meteorstormen – projektorns SKÖLD (#822, spec §2.3.1, §4.1.1). Bubblan runt
// stationen: halvgenomskinlig, lyser starkare när skölden är full, blir svagare
// – och streckad och sprucken – när den nästan är slut. Varje träff i skölden
// sprider en våg från träffpunkten. Tom sköld → "⚠️ Skölden är nere!" (fast
// text, ingen blinkning). Ren funktion av tillståndet och t.
//   ritaBubbla(g, { x, y, skala, skold, t, seed, idx, gung, vagor: [{ vinkel, alder }] })
//   ritaSkoldText(g, x, y, skala)
// ============================================================================

import { SKOLD_TAK } from "./delat/ms-balans.js";
import { RADIE, brus } from "./msp-scen.js";

const TAU = Math.PI * 2;

/** Sköldbubblan (efter stationen) + vågorna från träffarna. */
export function ritaBubbla(g, o) {
  const { x, y, skala, skold, t, seed, idx } = o;
  const frac = Math.max(0, Math.min(1, skold / SKOLD_TAK));
  const r = RADIE.bubbla * skala;
  const cx = x + (o.gung?.x || 0);
  const cy = y + (o.gung?.y || 0);
  if (frac > 0) {
    const a = 0.08 + 0.22 * frac;
    const fyll = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    fyll.addColorStop(0, "rgba(120,200,255,0)");
    fyll.addColorStop(1, `rgba(140,210,255,${a})`);
    g.fillStyle = fyll;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    if (frac >= 0.95) {
      g.strokeStyle = "rgba(150,220,255,.16)";
      g.lineWidth = 14 * skala;
      g.beginPath();
      g.arc(cx, cy, r + 4 * skala, 0, TAU);
      g.stroke();
    }
    g.strokeStyle = `rgba(175,228,255,${0.22 + 0.55 * frac})`;
    g.lineWidth = (2 + 3 * frac) * skala;
    if (frac < 0.25) g.setLineDash([16 * skala, 11 * skala]);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();
    g.setLineDash([]);
    if (frac < 0.25) {
      g.strokeStyle = "rgba(175,228,255,.45)";
      g.lineWidth = 2 * skala;
      for (let k = 0; k < 4; k++) {
        const v = brus(seed, `bsp|${idx}|${k}`) * TAU;
        g.beginPath();
        let px = cx + Math.cos(v) * r;
        let py = cy + Math.sin(v) * r;
        g.moveTo(px, py);
        for (let s = 0; s < 3; s++) {
          const vv = v + Math.PI + (brus(seed, `bsps|${idx}|${k}|${s}`) - 0.5) * 1.6;
          px += Math.cos(vv) * 16 * skala;
          py += Math.sin(vv) * 16 * skala;
          g.lineTo(px, py);
        }
        g.stroke();
      }
    }
  }
  for (const w of o.vagor || []) {
    const f = w.alder / 800;
    if (f < 0 || f >= 1) continue;
    const px = cx + Math.cos(w.vinkel) * r;
    const py = cy + Math.sin(w.vinkel) * r;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r + 3 * skala, 0, TAU);
    g.clip();
    g.strokeStyle = `rgba(200,236,255,${0.75 * (1 - f)})`;
    g.lineWidth = 4 * skala * (1 - f) + 1;
    g.beginPath();
    g.arc(px, py, (12 + f * 110) * skala, 0, TAU);
    g.stroke();
    g.restore();
  }
}

export function ritaSkoldText(g, x, y, skala) {
  g.save();
  g.font = `800 ${Math.round(26 * Math.max(0.8, skala))}px "Baloo 2", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 6;
  g.strokeStyle = "rgba(15,18,50,.9)";
  const txt = "⚠️ Skölden är nere!";
  g.strokeText(txt, x, y);
  g.fillStyle = "#ffcf5a";
  g.fillText(txt, x, y);
  g.restore();
}
