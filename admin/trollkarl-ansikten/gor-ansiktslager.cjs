// Friläggningsreceptet för Trollkarlsduellens ansiktslager (#537).
// Gör om ref/*_3_bilder.png → ref/<who>-<uttryck>.webp. Se README.md.
// Steg: flood-fill av vit bakgrund från kanterna (tänder/ögonvitor skonas) →
// vita fickor/halo nära konturen äts → defringe av kantpixlar → per-panel:
// kantrörande småkomponenter (rök-slivers) bort → käk-/halsmask (Elias
// AUTO-spåras ur hudkonturen, Rasmus manuella polylinjer – skägget täcker) →
// bara största sammanhängande ytan behålls → WebP med lossless alfa.
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

const REF = path.join(__dirname, "..", "..", "src", "live", "trollkarl", "ref") + path.sep;
const SRC = REF;
const OUT = REF;

const JOBS = {
  "Elias_3_bilder.png": [
    { name: "elias-happy", box: [96, 40, 390, 560] },
    { name: "elias-angry", box: [596, 50, 380, 560] },
    { name: "elias-sad", box: [1110, 90, 380, 540] },
  ],
  "rasmus_3_bilder.png": [
    { name: "rasmus-happy", box: [30, 30, 450, 640] },
    { name: "rasmus-angry", box: [548, 40, 440, 630] },
    { name: "rasmus-sad", box: [1058, 40, 450, 640] },
  ],
};

const FLOOD_WHITE = 232;   // flood-fill-tröskel (sänkt från 238)
const POCKET_WHITE = 218;  // "nästan vit" som tas bort nära bakgrunden
const POCKET_DEPTH = 9;    // hur långt in (px) vita fickor/halo får ätas
const MAXDIM = 380;

async function process(file) {
  const { data, info } = await sharp(SRC + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const bg = new Uint8Array(N);
  const isWhite = (i, th) => data[i * 4] >= th && data[i * 4 + 1] >= th && data[i * 4 + 2] >= th;

  // 1) flood-fill från kanterna
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || !isWhite(p, FLOOD_WHITE)) continue;
    bg[p] = 1;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < N - W) stack.push(p + W);
  }

  // 2) avstånd till bakgrund (BFS, max POCKET_DEPTH+2) …
  const depth = new Uint8Array(N).fill(255);
  let frontier = [];
  for (let p = 0; p < N; p++) if (bg[p]) { depth[p] = 0; }
  for (let p = 0; p < N; p++) {
    if (bg[p]) continue;
    const x = p % W;
    if ((x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (p >= W && bg[p - W]) || (p < N - W && bg[p + W])) {
      depth[p] = 1; frontier.push(p);
    }
  }
  for (let d = 2; d <= POCKET_DEPTH + 2; d++) {
    const next = [];
    for (const p of frontier) {
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1]) {
        if (q >= 0 && !bg[q] && depth[q] === 255) { depth[q] = d; next.push(q); }
      }
    }
    frontier = next;
  }

  // 3) … och ät vita fickor/halo nära kanten (upprepa tills stabilt)
  let changed = true;
  while (changed) {
    changed = false;
    for (let p = 0; p < N; p++) {
      if (bg[p] || depth[p] > POCKET_DEPTH) continue;
      if (isWhite(p, POCKET_WHITE)) {
        bg[p] = 1; depth[p] = 0; changed = true;
        const x = p % W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1]) {
          if (q >= 0 && !bg[q] && depth[q] > 1) depth[q] = 1;
        }
      }
    }
  }

  // 4) defringe kantpixlar (djup ≤2): pixeln är F blandat med vitt → lös ut F.
  //    alfa uppskattas ur ljusheten; 1 px-kanten (djup 1) får dessutom lägre alfa.
  for (let p = 0; p < N; p++) {
    const a4 = p * 4;
    if (bg[p]) { data[a4 + 3] = 0; continue; }
    if (depth[p] <= 2) {
      const r0 = data[a4], g0 = data[a4 + 1], b0 = data[a4 + 2];
      const luma = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      let a = Math.min(1, Math.max(0.12, (255 - luma) / 160));
      if (depth[p] === 1) a = Math.min(a, 0.6);
      for (let c = 0; c < 3; c++) {
        const v = (data[a4 + c] - (1 - a) * 255) / a;
        data[a4 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
      data[a4 + 3] = Math.round(a * 255);
    }
  }

  // 5) ta bort små isolerade öar (lösa rökpuffs-/konturfragment)
  {
    const seen = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
      if (bg[p] || seen[p]) continue;
      const comp = [p]; seen[p] = 1;
      for (let i = 0; i < comp.length; i++) {
        const c = comp[i], x = c % W;
        for (const q of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c < N - W ? c + W : -1]) {
          if (q >= 0 && !bg[q] && !seen[q]) { seen[q] = 1; comp.push(q); }
        }
      }
      if (comp.length < 400) for (const c of comp) { bg[c] = 1; data[c * 4 + 3] = 0; }
    }
  }
  return { data, W, H };
}


// Per-panel: ta bort komponenter som rör panelkanten och är små (rök-slivers)
// samt mikroöar var som helst.
function cleanPanel(data, W, H) {
  const N = W * H;
  const seen = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (data[p * 4 + 3] === 0 || seen[p]) continue;
    const comp = [p]; seen[p] = 1;
    let touchesEdge = false;
    for (let i = 0; i < comp.length; i++) {
      const c = comp[i], x = c % W, y = (c / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
      for (const q of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c < N - W ? c + W : -1]) {
        if (q >= 0 && data[q * 4 + 3] !== 0 && !seen[q]) { seen[q] = 1; comp.push(q); }
      }
    }
    if (comp.length < 400 || (touchesEdge && comp.length < 6000)) {
      for (const c of comp) data[c * 4 + 3] = 0;
    }
  }
}


// Käk-/skägg-/halskontur per uttryck (slutskala, ~267x380): allt NEDANFÖR
// polylinjen tonas ut över 12 px – följer verklig kontur, inga raka snitt.
const JAW = {
  "rasmus-happy": [[0,302],[35,316],[70,342],[100,360],[135,368],[170,360],[200,340],[228,312],[250,296],[267,288]],
  "rasmus-angry": [[0,310],[35,324],[70,352],[100,364],[135,372],[170,364],[200,348],[228,320],[250,300],[265,292]],
  "rasmus-sad":   [[0,308],[35,330],[70,358],[110,378],[160,378],[200,360],[228,330],[250,312],[267,300]],
  "elias-happy":  [[0,246],[20,262],[50,304],[240,310],[265,300]],
  "elias-angry":  [[0,270],[30,278],[245,285],[265,270]],
  "elias-sad":    [[0,278],[33,282],[238,300],[265,285]],
};
// Elias-lagren: masklinjen HITTAS i bilden – understa hudpixeln per kolumn +
// konturens tjocklek. Manuella JAW-punkter används bara där hud saknas (håret
// vid sidorna). Rasmus skägg täcker hakan, där räcker de manuella linjerna.
const AUTO_FACE = { "elias-happy": 1, "elias-angry": 1, "elias-sad": 1 };

function autoFaceLine(data, w, h, pts) {
  const line = new Float64Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 240; y--) {
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 150 && r - b > 35 && g > r * 0.55 && g < r * 0.95) { line[x] = y + 6; break; }
    }
    if (line[x] < 0) line[x] = jawY(pts, x);
  }
  // medianfilter (9) + lådutjämning (5) så linjen inte hackar
  const med = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    const win = [];
    for (let k = -4; k <= 4; k++) win.push(line[Math.min(w - 1, Math.max(0, x + k))]);
    win.sort((a, b2) => a - b2);
    med[x] = win[4];
  }
  const out = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += med[Math.min(w - 1, Math.max(0, x + k))];
    out[x] = s / 5;
  }
  return out;
}

function jawY(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * ((x - x0) / Math.max(1, x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}

function applyJawMask(data, w, h, name) {
  const pts = JAW[name];
  if (!pts) return;
  const FADE = AUTO_FACE[name] ? 4 : 12;
  const auto = AUTO_FACE[name] ? autoFaceLine(data, w, h, pts) : null;
  for (let x = 0; x < w; x++) {
    const yl = auto ? auto[x] : jawY(pts, x);
    // Defringe i bandet kring masklinjen (−6..+FADE px): ljusa lågkroma-pixlar
    // är tröj-/bakgrundsrester (hoodie-grått, vitt) – döda dem så ingen vit
    // rand står kvar mot mörk arena. Hud/skägg har varm kroma och skonas.
    for (let y = Math.max(0, Math.floor(yl) + 1); y < Math.min(h, yl + FADE + 1); y++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const w1 = Math.min(1, Math.max(0, (luma - 150) / 60)) * Math.min(1, Math.max(0, (45 - chroma) / 30));
      if (w1 > 0) data[i + 3] = Math.round(data[i + 3] * (1 - 0.95 * w1));
    }
    for (let y = Math.max(0, Math.floor(yl)); y < h; y++) {
      const f = Math.min(1, Math.max(0, 1 - (y - yl) / FADE));
      const a = (y * w + x) * 4 + 3;
      data[a] = Math.round(data[a] * f);
    }
  }
}

(async () => {
  for (const [file, panels] of Object.entries(JOBS)) {
    const { data, W, H } = await process(file);
    const base = sharp(data, { raw: { width: W, height: H, channels: 4 } });
    for (const p of panels) {
      const [x, y, w, h] = p.box;
      const scale = Math.min(1, MAXDIM / Math.max(w, h));
      const panel = await base.clone()
        .extract({ left: x, top: y, width: w, height: h })
        .raw().toBuffer();
      cleanPanel(panel, w, h);
      const rw = Math.round(w * scale);
      const { data: rdata, info: rinfo } = await sharp(panel, { raw: { width: w, height: h, channels: 4 } })
        .resize(rw)
        .raw().toBuffer({ resolveWithObject: true });
      applyJawMask(rdata, rinfo.width, rinfo.height, p.name);
      // Efter masken: behall BARA storsta sammanhangande ytan (ansikte+har) –
      // troj-/harfragment som maskats loss fran ansiktet svavar annars bredvid.
      {
        const W2 = rinfo.width, H2 = rinfo.height, N2 = W2 * H2;
        const comp = new Int32Array(N2).fill(-1);
        const sizes = [];
        for (let p2 = 0; p2 < N2; p2++) {
          if (rdata[p2 * 4 + 3] === 0 || comp[p2] !== -1) continue;
          const id = sizes.length;
          const st = [p2]; comp[p2] = id; let n = 0;
          while (st.length) {
            const c = st.pop(); n++;
            const cx = c % W2;
            for (const q of [cx > 0 ? c - 1 : -1, cx < W2 - 1 ? c + 1 : -1, c >= W2 ? c - W2 : -1, c < N2 - W2 ? c + W2 : -1]) {
              if (q >= 0 && rdata[q * 4 + 3] !== 0 && comp[q] === -1) { comp[q] = id; st.push(q); }
            }
          }
          sizes.push(n);
        }
        let big = 0;
        for (let i3 = 1; i3 < sizes.length; i3++) if (sizes[i3] > sizes[big]) big = i3;
        for (let p2 = 0; p2 < N2; p2++) if (comp[p2] !== -1 && comp[p2] !== big) rdata[p2 * 4 + 3] = 0;
      }
      // Vita rester langs hela silhuetten: ljus lagkroma-pixel intill
      // genomskinligt = bakgrundsrest, inte har (harets highlights har varm
      // kroma). Dampa kraftigt.
      {
        const W2 = rinfo.width, H2 = rinfo.height;
        for (let y2 = 1; y2 < H2 - 1; y2++) for (let x2 = 1; x2 < W2 - 1; x2++) {
          const i2 = (y2 * W2 + x2) * 4;
          if (rdata[i2 + 3] === 0) continue;
          const r2 = rdata[i2], g2 = rdata[i2 + 1], b2 = rdata[i2 + 2];
          const lum = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
          if (lum <= 172 || Math.max(r2, g2, b2) - Math.min(r2, g2, b2) >= 38) continue;
          let near0 = false;
          for (let dy = -2; dy <= 2 && !near0; dy++) for (let dx = -2; dx <= 2; dx++) {
            const yy2 = y2 + dy, xx2 = x2 + dx;
            if (yy2 < 0 || yy2 >= H2 || xx2 < 0 || xx2 >= W2) continue;
            if (rdata[(yy2 * W2 + xx2) * 4 + 3] === 0) { near0 = true; break; }
          }
          if (near0) rdata[i2 + 3] = Math.round(rdata[i2 + 3] * 0.08);
        }
      }
      const buf = await sharp(rdata, { raw: { width: rinfo.width, height: rinfo.height, channels: 4 } })
        .webp({ quality: 82, alphaQuality: 100 })
        .toBuffer();
      fs.writeFileSync(OUT + p.name + ".webp", buf);
      console.log(p.name, (buf.length / 1024).toFixed(1) + " KB");
    }
  }
})();
