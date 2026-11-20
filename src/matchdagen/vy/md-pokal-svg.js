// ============================================================================
// Matchdagen (#873, Etapp 3): de TECKNADE POKALERNA (SVG, spec §10.4) och
// KLUBBMÄRKET med guldkant och guldstjärnor (§10.1, §10.3). Rena strängar: ur
// dokumentet bara färgen (prövad som #rrggbb), tal och titeln (esc) – används av
// Pokalskåpet, sidhuvudet, rutorna efter matchen, 2D-firandet och förhandsvisningen.
//
//   pokalSvg(sort, { tom?, id? })   sort: liga | kval | cup | superliga | mastarcup
//                                   tom = skuggan av en pokal som inte vunnits än
//   klubbMarke({ farg, guld, stjarnor, initialer, titel? })   SVG-sköld
// ============================================================================

import { esc } from "./md-vy-delat.js";

const FARG = /^#[0-9a-fA-F]{6}$/;
const GULD = ["#fff3b0", "#ffd23f", "#c98a12"];
const SILVER = ["#ffffff", "#d9e2ee", "#8796ab"];
let lopnr = 0;

/** En linjär gradient (ljus → mellan → mörk) med ett unikt id – flera pokaler på samma sida. */
const grad = (id, [a, b, c]) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset=".35" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;

/** Foten: en mörk sockel med en mässingsskylt. */
const fot = (g, bred = 30, y = 66) => `<rect x="${32 - bred / 2}" y="${y}" width="${bred}" height="${80 - y - 2}" rx="2" fill="#1d2b44"/>
  <rect x="${32 - bred / 2 + 4}" y="${y + 3.5}" width="${bred - 8}" height="4" rx="1" fill="url(#${g})"/>`;

const RITA = {
  /** Divisionsvinst: en klassisk guldpokal med två handtag. */
  liga: (g) => `${fot(g, 26)}
    <path d="M26 60h12l2 6H24z" fill="url(#${g})"/>
    <rect x="29.5" y="46" width="5" height="15" fill="url(#${g})"/>
    <path d="M18 14h28c0 18-5 30-14 33-9-3-14-15-14-33z" fill="url(#${g})"/>
    <path d="M18 18c-9 0-9 13 2 15M46 18c9 0 9 13-2 15" fill="none" stroke="url(#${g})" stroke-width="3"/>`,
  /** Uppflyttning genom kval: en sköld med en pil uppåt. */
  kval: (g) => `${fot(g, 24)}
    <rect x="30" y="54" width="4" height="12" fill="url(#${g})"/>
    <path d="M14 12h36v20c0 12-8 20-18 24-10-4-18-12-18-24z" fill="url(#${g})"/>
    <path d="M32 18l10 11h-6v13h-8V29h-6z" fill="#1d2b44" opacity=".85"/>`,
  /** Silverpokalen: en hög, smal silverbägare. */
  cup: (g) => `${fot(g, 24)}
    <path d="M27 58h10l3 8H24z" fill="url(#${g})"/>
    <rect x="30" y="40" width="4" height="19" fill="url(#${g})"/>
    <path d="M22 8h20l-2 24c-1 6-4 9-8 10-4-1-7-4-8-10z" fill="url(#${g})"/>
    <path d="M22 12c-7 2-6 12 1 13M42 12c7 2 6 12-1 13" fill="none" stroke="url(#${g})" stroke-width="2.4"/>
    <ellipse cx="32" cy="8" rx="10" ry="2" fill="#ffffff" opacity=".6"/>`,
  /** Superligan: en stor guldpokal med en stjärna och lagerkrans. */
  superliga: (g) => `${fot(g, 34, 64)}
    <path d="M24 56h16l3 8H21z" fill="url(#${g})"/>
    <rect x="29" y="44" width="6" height="13" fill="url(#${g})"/>
    <path d="M13 6h38c0 22-7 36-19 39C20 42 13 28 13 6z" fill="url(#${g})"/>
    <path d="M13 10c-11 0-11 17 3 19M51 10c11 0 11 17-3 19" fill="none" stroke="url(#${g})" stroke-width="3.5"/>
    <path d="M32 14l3 6.4 7 .8-5.2 4.8 1.4 6.9L32 29.4l-6.2 3.5 1.4-6.9-5.2-4.8 7-.8z" fill="#fff8d6" stroke="#c98a12" stroke-width=".8"/>
    <path d="M20 36c4 4 8 5 12 5s8-1 12-5" fill="none" stroke="#2f8f45" stroke-width="2" stroke-dasharray="3 2"/>`,
  /** Mästarcupen: den största – silver med guldkanter och stora handtag ("öron"). */
  mastarcup: (g, g2) => `${fot(g2, 36, 66)}
    <path d="M23 58h18l3 8H20z" fill="url(#${g2})"/>
    <rect x="28.5" y="46" width="7" height="13" fill="url(#${g})"/>
    <path d="M16 4h32c1 24-5 38-16 43C21 42 15 28 16 4z" fill="url(#${g})" stroke="url(#${g2})" stroke-width="1.6"/>
    <path d="M17 7C2 4 0 30 19 32M47 7c15-3 17 23-2 25" fill="none" stroke="url(#${g})" stroke-width="5"/>
    <path d="M17 7C2 4 0 30 19 32M47 7c15-3 17 23-2 25" fill="none" stroke="url(#${g2})" stroke-width="1.2"/>
    <path d="M32 13l3.4 7.2 7.8.9-5.8 5.3 1.6 7.7L32 30.2l-7 3.9 1.6-7.7-5.8-5.3 7.8-.9z" fill="url(#${g2})" stroke="#8a5a06" stroke-width=".8"/>`,
};

/** En tecknad pokal (§10.4). tom = en mörk skugga – pokalen som väntar i skåpet. */
export function pokalSvg(sort, { tom = false, id = "" } = {}) {
  const rita = RITA[sort] || RITA.liga;
  const g = `mdp-${id || ++lopnr}`;
  const fargerA = sort === "cup" || sort === "mastarcup" ? SILVER : GULD;
  const defs = tom ? "" : `<defs>${grad(g, fargerA)}${grad(`${g}b`, GULD)}</defs>`;
  const kropp = rita(g, `${g}b`);
  return `<svg class="md-pokalbild${tom ? " tom" : ""}" viewBox="0 0 64 80" aria-hidden="true" focusable="false">${defs}${tom
    ? `<g fill="#2a3a58" stroke="#2a3a58">${kropp.replace(/url\(#[^)]+\)/g, "#2a3a58")}</g>`
    : kropp}</svg>`;
}

/** En femuddig stjärna (för klubbmärket). */
const stjarna = (cx, cy, r) => {
  const p = Array.from({ length: 10 }, (_, i) => {
    const v = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(v) * rr).toFixed(2)},${(cy + Math.sin(v) * rr).toFixed(2)}`;
  });
  return `<polygon points="${p.join(" ")}" fill="#ffd23f" stroke="#8a5a06" stroke-width=".6"/>`;
};

/** Ljus eller mörk text på tröjfärgen. */
const ljus = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160;
};

/**
 * Klubbmärket: en sköld i tröjfärgen med initialerna, en guldkant för mästare i Superligan
 * (§10.1) och en guldstjärna ovanför för varje klubb som tagits hela vägen (§10.3, högst 5
 * ritade – fler skrivs som "×N" i titeln). Initialerna är bara A–Ö och siffror.
 */
export function klubbMarke({ farg, guld = false, stjarnor = 0, initialer = "", titel = "" }) {
  const f = FARG.test(String(farg)) ? farg : "#2f6fe8";
  const n = Math.max(0, Math.floor(Number(stjarnor) || 0));
  const visa = Math.min(5, n);
  const ini = String(initialer).replace(/[^0-9A-Za-zÅÄÖåäö]/g, "").slice(0, 3).toUpperCase();
  const stj = Array.from({ length: visa }, (_, i) => stjarna(32 + (i - (visa - 1) / 2) * 11, 7, 5)).join("");
  const kant = guld ? `stroke="#ffd23f" stroke-width="4.5"` : `stroke="#e8eef8" stroke-width="2.5"`;
  return `<svg class="md-marke${guld ? " guld" : ""}" viewBox="0 0 64 76" role="img" aria-label="${esc(titel || "Klubbmärket")}" focusable="false">
    ${stj}
    <path d="M10 16h44v26c0 15-10 24-22 30C20 66 10 57 10 42z" fill="${f}" ${kant}/>
    ${guld ? `<path d="M14 20h36v22c0 12-8 20-18 25-10-5-18-13-18-25z" fill="none" stroke="#c98a12" stroke-width="1"/>` : ""}
    <text x="32" y="${ini.length > 2 ? 48 : 49}" text-anchor="middle" font-family="'Barlow Condensed', 'Arial Narrow', sans-serif" font-weight="800"
      font-size="${ini.length > 2 ? 17 : 21}" fill="${ljus(f) ? "#1b1500" : "#ffffff"}">${ini}</text>
  </svg>`;
}
