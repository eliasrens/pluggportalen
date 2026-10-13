// ============================================================================
// Datakuppen – NÄTVERKET (#654, spec §4.1): bakgrunden, loggan och dekor-
// vakten. "Ett hemligt kontrollrum i ett lekfullt dataspel": mörk marinblå
// botten, svaga kretsbanor i grönt/cyan, noder som lyser mjukt och små
// datapaket som glider längs några banor, plus två vänliga robotar i hörnen.
// Ritas EN gång per vy (inline-SVG, ingen bild att ladda) och rörs sedan
// aldrig – bara CSS-animationer på transform/opacitet, inga blinkningar
// (noderna tonar långsamt, ingen strobe). Reducerad rörelse / variant
// "stilla" (statistiken): inget rör sig.
// Stilarna: datakuppen-natverk.css (dknb-*, dkn-logo, lobbyn) och
// datakuppen-projektor.css (vyerna).
//
// API
//   ensureNatverkCss()
//   natverkHtml({ variant? = "natverk" | "lobby" | "stilla" }) → bakgrunden
//   logoHtml({ size? = "liten" | "stor" }) → robot + "DATAKUPPEN"
//   robotSvg({ mood? = "glad" }) → den lilla roboten (loggan, lobbyn)
//   createDekorVakt(root, hinder) → { check(), destroy() } – DEKOR BAKOM TEXT
//     (spec §0.2): varje dekorbit ([data-dekor]: noder, paket, robotar) som
//     överlappar en av hinder()-ytorna (DOMRect-liknande) göms (dknb-skymd).
//     Prövas vid storleksändring och varannan sekund.
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { ensureDesignCss } from "../../design/live-avatar-pool.js";

const CSS = ["src/live/formats/datakuppen/datakuppen-natverk.css", "src/live/formats/datakuppen/datakuppen-projektor.css"];

export function ensureNatverkCss() {
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

// En kretsbana: vågrät med 45°-knyckar upp/ned, som på ett kretskort.
function bana(y0, seed) {
  const r = rng(seed);
  let x = -20;
  let y = y0;
  let d = `M${x} ${y}`;
  const noder = [];
  while (x < 1940) {
    x += 120 + r() * 220;
    d += ` H${r1(x)}`;
    if (r() < 0.55) {
      const dy = (r() < 0.5 ? -1 : 1) * (30 + Math.round(r() * 2) * 20);
      x += Math.abs(dy);
      y += dy;
      d += ` L${r1(x)} ${r1(y)}`;
    }
    if (r() < 0.35) noder.push([r1(x), r1(y)]);
  }
  return { d, noder };
}

const BANOR = [120, 210, 330, 450, 560, 680, 790, 900, 1010].map((y, i) => bana(y, 11 + i * 7));

// Datapaket: korta lysande streck som glider längs en rak sträcka.
const PAKET = [
  [80, 260, 700, 0, "c"], [1100, 380, 640, 2.4, "g"], [300, 610, 900, 4.1, "c"],
  [1250, 840, 560, 1.2, "g"], [40, 960, 760, 5.6, "o"], [980, 150, 820, 3.3, "c"],
];

export function robotSvg({ mood = "glad" } = {}) {
  const mun = mood === "glad" ? `<path d="M22 40 Q32 47 42 40" class="dkr-mun"/>` : `<path d="M23 42 H41" class="dkr-mun"/>`;
  return `<svg class="dkr" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <line x1="32" y1="4" x2="32" y2="13" class="dkr-ant"/><circle cx="32" cy="5" r="4" class="dkr-lampa"/>
    <rect x="9" y="13" width="46" height="40" rx="12" class="dkr-huvud"/>
    <rect x="15" y="20" width="34" height="26" rx="8" class="dkr-skarm"/>
    <circle cx="25" cy="31" r="4" class="dkr-oga"/><circle cx="39" cy="31" r="4" class="dkr-oga"/>
    ${mun}
    <rect x="3" y="27" width="6" height="12" rx="3" class="dkr-ora"/><rect x="55" y="27" width="6" height="12" rx="3" class="dkr-ora"/>
  </svg>`;
}

function robot(x, y, s, d) {
  return `<g data-dekor class="dknb-robot" style="--d:${d}s"><g class="dkr" transform="translate(${x} ${y}) scale(${s})">${
    robotSvg().replace(/<svg[^>]*>|<\/svg>/g, "")}</g></g>`;
}

export function natverkHtml({ variant = "natverk" } = {}) {
  const banor = BANOR.map((b) => `<path d="${b.d}"/>`).join("");
  const noder = BANOR.flatMap((b, i) => b.noder.map(([x, y], j) =>
    `<g data-dekor><circle class="dknb-nod" style="--d:${r1(((i * 3 + j * 5) % 11) * 0.7)}s" cx="${x}" cy="${y}" r="7"/></g>`)).join("");
  const paket = variant === "stilla" ? "" : PAKET.map(([x, y, len, d, ton]) =>
    // Den osynliga rektangeln = hela sträckan, så vakten ser vart paketet ska.
    `<g data-dekor><rect x="${x}" y="${y - 3}" width="${len + 46}" height="6" fill="none"/><rect class="dknb-paket dknb-${ton}" style="--len:${len}px;--d:${d}s" x="${x}" y="${y - 3}" width="46" height="6" rx="3"/></g>`).join("");
  return `<div class="dknb dknb-${variant}" aria-hidden="true">
    <svg class="dknb-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <radialGradient id="dknb-bak" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0f2148"/><stop offset=".55" stop-color="#091530"/><stop offset="1" stop-color="#040a1a"/></radialGradient>
        <pattern id="dknb-rutor" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0 H0 V48" fill="none" stroke="#3ee8ff" stroke-width="1" opacity=".06"/></pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#dknb-bak)"/>
      <rect width="1920" height="1080" fill="url(#dknb-rutor)"/>
      <g class="dknb-banor">${banor}</g>
      ${noder}${paket}
      ${variant === "stilla" ? "" : robot(36, 958, 1.5, 0) + robot(1790, 958, 1.5, 2.2)}
    </svg>
    <div class="dknb-vinjett"></div>
  </div>`;
}

export function logoHtml({ size = "liten" } = {}) {
  return `<div class="dkn-logo dkn-logo-${size}"><span class="dkn-logo-robot">${robotSvg()}</span><span class="dkn-logo-namn">DATA<b>KUPPEN</b></span></div>`;
}

export function createDekorVakt(root, hinder, { pad = 6, everyMs = 2000 } = {}) {
  const bitar = [...root.querySelectorAll(".dknb [data-dekor]")];
  function check() {
    const rs = (hinder() || []).filter((r) => r && r.right > r.left && r.bottom > r.top);
    for (const el of bitar) {
      const b = el.getBoundingClientRect();
      const krock = b.width > 0 && rs.some((r) => b.left < r.right + pad && b.right > r.left - pad && b.top < r.bottom + pad && b.bottom > r.top - pad);
      el.classList.toggle("dknb-skymd", krock);
    }
  }
  let raf = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => requestAnimationFrame(check)); });
  ro.observe(root);
  const iv = setInterval(check, everyMs);
  return {
    check,
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearInterval(iv);
    },
  };
}
