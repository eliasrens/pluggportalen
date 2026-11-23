// ============================================================================
// QA 19 (#908, epic #906): bländtestet – medelluminans och andel ljusa pixlar
// i skärmdumpar (PNG, 1366×768) av byn, huset ute, gården, porten och
// lärarspärren i vinter. Krav (B.2 punkt 4): medel ≤ 215 och ≤ 5 % pixlar med
// luminans ≥ 245 (Rec. 709: 0,2126 R + 0,7152 G + 0,0722 B på 0–255).
//   node admin/qa-vinter-blandtest.mjs by.png hus.png gard.png port.png gate.png
// Skärmdumparna tas t.ex. ur preview/preview-vinter-908-app.html (riktiga appen
// utan emulator). Ingen npm-modul: en minimal PNG-avkodare (zlib + filter).
// ============================================================================
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { basename } from "node:path";

/** PNG (8 bitar, RGB/RGBA, ej interlace) → { w, h, kanaler, data }. */
export function lasPng(buf) {
  let p = 8;
  let w = 0, h = 0, typ = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const namn = buf.toString("ascii", p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (namn === "IHDR") {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      if (d[8] !== 8 || d[12] !== 0) throw new Error("bara 8-bitars PNG utan interlace");
      typ = d[9];
    } else if (namn === "IDAT") idat.push(d);
    else if (namn === "IEND") break;
    p += 12 + len;
  }
  const k = typ === 6 ? 4 : typ === 2 ? 3 : 0;
  if (!k) throw new Error(`PNG-färgtyp ${typ} stöds inte`);
  const raw = inflateSync(Buffer.concat(idat));
  const rad = w * k;
  const ut = Buffer.alloc(rad * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (rad + 1)];
    const src = raw.subarray(y * (rad + 1) + 1, (y + 1) * (rad + 1));
    for (let x = 0; x < rad; x++) {
      const a = x >= k ? ut[y * rad + x - k] : 0;
      const b = y ? ut[(y - 1) * rad + x] : 0;
      const c = x >= k && y ? ut[(y - 1) * rad + x - k] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      ut[y * rad + x] = v & 255;
    }
  }
  return { w, h, k, data: ut };
}

/** Medelluminans och andel pixlar med luminans ≥ 245. */
export function bland({ w, h, k, data }) {
  let sum = 0, ljusa = 0;
  for (let i = 0; i < w * h; i++) {
    const L = 0.2126 * data[i * k] + 0.7152 * data[i * k + 1] + 0.0722 * data[i * k + 2];
    sum += L;
    if (L >= 245) ljusa++;
  }
  return { medel: sum / (w * h), andel: ljusa / (w * h) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let ok = true;
  console.log("| Vy | Storlek | Medelluminans (≤ 215) | Pixlar ≥ 245 (≤ 5 %) | |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const fil of process.argv.slice(2)) {
    const png = lasPng(readFileSync(fil));
    const { medel, andel } = bland(png);
    const gron = medel <= 215 && andel <= 0.05;
    ok &&= gron;
    console.log(`| ${basename(fil, ".png")} | ${png.w}×${png.h} | ${medel.toFixed(1)} | ${(andel * 100).toFixed(2)} % | ${gron ? "OK" : "FEL"} |`);
  }
  process.exit(ok ? 0 : 1);
}
