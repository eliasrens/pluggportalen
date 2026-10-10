// ============================================================================
// Guldrushen – Skattkammaren (#565): GROTTAN (designspec §6.1). Ritas EN gång
// per vy (en inline-SVG, ingen bild att ladda) och rörs sedan aldrig – bara
// CSS-animationer på transform/opacitet:
//   • mörklila/brunt berg med Gruvans palett (gruvan-scen-svg.js) – samma
//     värld som Gruvan och Skattjakten
//   • fyra facklor vars lågor och sken fladdrar (osynkat)
//   • guldådror och ädelstenar (turkos, rosa, bärnsten) som glittrar
//   • räls längs golvet med en gruvvagn full av guld
//   • små levande detaljer ibland (prio 3): en spindel som hänger ned, en
//     fladdermus som flyger förbi, en droppe från en stalaktit
//   • lobbyn: grottans ingång med dagsljus till vänster
// Reducerad rörelse / variant "stilla" (statistiken): inga detaljer som rör
// sig, facklorna lyser stilla. Inga blinkningar – glittret tonar mjukt.
// Stilarna: guldrush-grotta.css (grg-*).
//
// API
//   ensureGrottaCss()
//   grottaHtml({ variant? = "kammare" | "lobby" | "stilla" }) → bakgrundens markup
//   logoHtml({ size? = "liten" | "stor" }) → "GULDRUSHEN" + guldkistan
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { ensureDesignCss } from "../../design/live-avatar-pool.js";
import { chestSvg } from "./gr-kistor.js";

const CSS = ["src/live/formats/guldrush/guldrush-grotta.css", "src/live/formats/guldrush/guldrush-projektor.css"];

export function ensureGrottaCss() {
  ensureDesignCss();
  ensureLiveCss(CSS);
}

// Liten deterministisk slump (samma bild varje gång).
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (v) => Math.round(v * 10) / 10;

function stalaktiter() {
  const r = rng(7);
  let x = -20;
  let out = "";
  while (x < 1940) {
    const w = 40 + r() * 90;
    const h = 40 + r() * 120;
    out += `<path d="M${r1(x)} 0 L${r1(x + w / 2 + (r() - 0.5) * 16)} ${r1(h)} L${r1(x + w)} 0Z"/>`;
    x += w * (0.55 + r() * 0.5);
  }
  return out;
}

// Guldåder: sicksack-linje med glimtar.
function ader(x, y, len, ang, seed) {
  const r = rng(seed);
  const pts = [[x, y]];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const d = (len / n) * i;
    pts.push([x + Math.cos(ang) * d + (r() - 0.5) * 26, y + Math.sin(ang) * d + (r() - 0.5) * 26]);
  }
  const d = `M${pts.map(([a, b]) => `${r1(a)} ${r1(b)}`).join(" L")}`;
  const glints = pts.slice(1, -1).filter((_, i) => i % 2 === 0).map(([a, b], i) =>
    `<path class="grg-glimt" style="--d:${r1(seed % 5 + i * 1.3)}s" d="M${r1(a)} ${r1(b - 9)} L${r1(a + 2.5)} ${r1(b - 2.5)} L${r1(a + 9)} ${r1(b)} L${r1(a + 2.5)} ${r1(b + 2.5)} L${r1(a)} ${r1(b + 9)} L${r1(a - 2.5)} ${r1(b + 2.5)} L${r1(a - 9)} ${r1(b)} L${r1(a - 2.5)} ${r1(b - 2.5)}Z"/>`).join("");
  return `<path class="grg-ader" d="${d}"/><path class="grg-ader-ljus" d="${d}"/>${glints}`;
}

// Kristallklunga (ädelstenar).
function stenar(x, y, color, seed, s = 1) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < 4; i++) {
    const w = (10 + r() * 10) * s;
    const h = (24 + r() * 30) * s;
    const cx = x + (i - 1.5) * 13 * s;
    const tilt = (i - 1.5) * 12 + (r() - 0.5) * 10;
    out += `<g transform="translate(${r1(cx)} ${r1(y)}) rotate(${r1(tilt)})"><path d="M${r1(-w / 2)} 0 L${r1(-w / 2)} ${r1(-h * 0.7)} L0 ${r1(-h)} L${r1(w / 2)} ${r1(-h * 0.7)} L${r1(w / 2)} 0Z" fill="${color}"/><path d="M0 ${r1(-h)} L${r1(w / 2)} ${r1(-h * 0.7)} L${r1(w / 2)} 0 L0 0Z" fill="#000" opacity=".18"/></g>`;
  }
  return `<g class="grg-sten" style="--d:${seed % 7}s">${out}<circle class="grg-sten-glans" cx="${r1(x)}" cy="${r1(y - 26 * s)}" r="${r1(30 * s)}" fill="${color}"/></g>`;
}

function fackla(x, y, i) {
  return `<g class="grg-fackla" transform="translate(${x} ${y})">
    <circle class="grg-sken" style="--d:${-i * 0.37}s" r="190" fill="url(#grg-sken)"/>
    <path d="M-14 6 H14 L8 18 H-8Z" fill="#3a2a1e"/><rect x="-5" y="10" width="10" height="70" rx="3" fill="#5f4127"/>
    <path d="M-12 2 Q-14 -6 -8 -8 H8 Q14 -6 12 2Z" fill="#7a5532"/>
    <g class="grg-laga" style="--d:${-i * 0.29}s">
      <path d="M0 -62 C10 -44 18 -30 14 -14 C11 -2 -11 -2 -14 -14 C-18 -30 -8 -40 0 -62Z" fill="#ff8a1f"/>
      <path d="M0 -46 C6 -34 10 -24 8 -14 C6 -6 -6 -6 -8 -14 C-10 -24 -4 -32 0 -46Z" fill="#ffd25a"/>
      <path d="M0 -30 C3 -24 4 -18 3 -13 C2 -9 -2 -9 -3 -13 C-4 -18 -2 -23 0 -30Z" fill="#fff4c4"/>
    </g>
  </g>`;
}

function gruvvagn() {
  const mynt = [[-46, -64], [-24, -72], [0, -76], [24, -70], [46, -62], [-34, -54], [-10, -60], [14, -58], [36, -52]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="9" fill="#ffcf3a" stroke="#c48a00" stroke-width="2.5"/>`).join("");
  return `<g class="grg-vagn" transform="translate(1680 1012)">
    <path d="M-66 -54 Q0 -98 66 -54Z" fill="#f5b81f"/>${mynt}
    <path d="M-30 -66 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3Z" class="grg-glimt" style="--d:1.2s" fill="#fff8d0"/>
    <path d="M-78 -50 H78 L64 -6 H-64Z" fill="#6b4a33" stroke="#3a2516" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-70 -36 H70" stroke="#9b7451" stroke-width="5"/><path d="M-66 -18 H66" stroke="#3a2516" stroke-width="3" opacity=".6"/>
    <circle cx="-40" cy="-2" r="16" fill="#2b2420" stroke="#8a8a92" stroke-width="5"/><circle cx="40" cy="-2" r="16" fill="#2b2420" stroke="#8a8a92" stroke-width="5"/>
  </g>`;
}

function rals() {
  let sliprar = "";
  for (let x = 10; x < 1920; x += 46) sliprar += `<rect x="${x}" y="1018" width="26" height="14" rx="2"/>`;
  return `<g class="grg-rals"><g fill="#4a3426">${sliprar}</g>
    <rect x="0" y="1012" width="1920" height="6" fill="#9a9aa6"/><rect x="0" y="1026" width="1920" height="5" fill="#7c7c88"/></g>`;
}

function ingang() {
  return `<g class="grg-ingang">
    <path d="M-10 1000 L-10 330 Q120 250 260 330 Q380 420 390 620 L400 1000Z" fill="url(#grg-dag)"/>
    <path d="M-10 1000 L-10 330 Q120 250 260 330 Q380 420 390 620 L400 1000" fill="none" stroke="#1d1622" stroke-width="38"/>
    <path class="grg-dagsljus" d="M0 380 L760 1000 L120 1000Z" fill="url(#grg-strale)"/>
  </g>`;
}

function liv() {
  return `<g class="grg-liv">
    <g class="grg-spindel" transform="translate(1180 0)">
      <g class="grg-spindel-ner"><line x1="0" y1="-400" x2="0" y2="0" stroke="#d8cfe0" stroke-width="1.5" opacity=".6"/>
        <ellipse cx="0" cy="12" rx="11" ry="13" fill="#1a1216"/><circle cx="0" cy="-2" r="7" fill="#1a1216"/>
        <circle cx="-3" cy="-3" r="1.8" fill="#fff"/><circle cx="3" cy="-3" r="1.8" fill="#fff"/>
        <path d="M-9 6 L-22 -2 M-10 12 L-24 12 M-10 18 L-22 26 M9 6 L22 -2 M10 12 L24 12 M10 18 L22 26" stroke="#1a1216" stroke-width="2.5" stroke-linecap="round"/></g>
    </g>
    <g class="grg-fladdermus"><g class="grg-vingar">
      <path d="M0 0 C-10 -12 -26 -16 -44 -6 C-36 -4 -32 2 -30 8 C-22 2 -12 4 0 8Z" fill="#241a26"/>
      <path d="M0 0 C10 -12 26 -16 44 -6 C36 -4 32 2 30 8 C22 2 12 4 0 8Z" fill="#241a26"/>
      <ellipse cx="0" cy="4" rx="7" ry="9" fill="#2e2230"/><circle cx="-2.5" cy="1" r="1.4" fill="#ffd25a"/><circle cx="2.5" cy="1" r="1.4" fill="#ffd25a"/></g></g>
    <g transform="translate(760 0)"><path d="M-16 0 L0 118 L16 0Z" fill="#2a1f2c"/><ellipse class="grg-dropp" cx="0" cy="124" rx="4" ry="6" fill="#9fdcf0"/></g>
  </g>`;
}

export function grottaHtml({ variant = "kammare" } = {}) {
  return `<div class="grg grg-${variant}" aria-hidden="true">
    <svg class="grg-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <radialGradient id="grg-bak" cx="50%" cy="58%" r="70%"><stop offset="0" stop-color="#5a3b3a"/><stop offset=".45" stop-color="#3a2e3f"/><stop offset="1" stop-color="#1d1622"/></radialGradient>
        <radialGradient id="grg-sken"><stop offset="0" stop-color="#ffce73" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9a3a" stop-opacity=".16"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
        <linearGradient id="grg-golv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e5342"/><stop offset="1" stop-color="#43332a"/></linearGradient>
        <linearGradient id="grg-dag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff1c6"/><stop offset=".6" stop-color="#ffce73"/><stop offset="1" stop-color="#b8743a"/></linearGradient>
        <linearGradient id="grg-strale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c6" stop-opacity=".35"/><stop offset="1" stop-color="#fff1c6" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#grg-bak)"/>
      <path d="M0 0 H1920 V520 Q1700 430 1520 470 Q1300 330 1060 400 Q860 300 640 390 Q420 330 240 450 Q120 420 0 470Z" fill="#2c2230"/>
      <path d="M0 0 H1920 V300 Q1640 220 1400 260 Q1180 160 960 210 Q700 140 480 230 Q240 190 0 260Z" fill="#241c28"/>
      <g fill="#3a2e3f" opacity=".7"><path d="M0 520 Q160 430 300 500 L300 700 L0 700Z"/><path d="M1920 520 Q1760 440 1610 520 L1610 700 L1920 700Z"/></g>
      <g class="grg-adror">${ader(120, 380, 360, -0.25, 11)}${ader(1500, 330, 380, 0.2, 23)}${ader(820, 250, 300, 0.1, 31)}${ader(1640, 640, 240, -0.4, 41)}${ader(360, 660, 240, 0.35, 53)}</g>
      ${stenar(520, 470, "#86d8e8", 3)}${stenar(1400, 520, "#e88fa8", 5, 0.9)}${stenar(1790, 470, "#ffb648", 9, 1.1)}${stenar(80, 600, "#86d8e8", 13, 0.8)}${stenar(1080, 330, "#c58cff", 17, 0.7)}
      <g fill="#1d1622">${stalaktiter()}</g>
      <path d="M0 690 Q480 640 960 662 Q1440 640 1920 690 V1080 H0Z" fill="url(#grg-golv)"/>
      <path d="M0 690 Q480 640 960 662 Q1440 640 1920 690" fill="none" stroke="#856650" stroke-width="5" opacity=".6"/>
      ${variant === "lobby" ? ingang() : ""}
      ${fackla(150, 330, 0)}${fackla(660, 230, 1)}${fackla(1260, 230, 2)}${fackla(1770, 330, 3)}
      ${rals()}${gruvvagn()}
      ${variant === "stilla" ? "" : liv()}
    </svg>
    <div class="grg-mork"></div>
  </div>`;
}

export function logoHtml({ size = "liten" } = {}) {
  return `<div class="grl grl-${size}"><span class="grl-kista">${chestSvg()}</span><span class="grl-namn">GULD<b>RUSHEN</b></span></div>`;
}
