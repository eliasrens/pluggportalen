// ============================================================================
// Hitta rätt! – SPIKE (#604): bygg förprojicerad geodata för SVG-kartmotorn.
// ----------------------------------------------------------------------------
// Offline-skript (körs av en människa/agent, ALDRIG av appen). Det
//   1. hämtar källorna (version-pinnade URL:er) till en cache UTANFÖR repot,
//   2. klipper + förenklar med mapshaper (CLI via npx, pinnad version),
//   3. projicerar med preview/hitta-ratt-spik/projektion.js (samma kod som
//      webbläsaren kör) och skriver färdiga SVG-vägar som heltal,
//   4. skriver preview/hitta-ratt-spik/geo-<scope>.json (+ namn-<scope>.json,
//      BARA för spikens felsökningsruta – produktionens namn bor i packen).
//
//   node admin/hitta-ratt-geo-spik.mjs            → sverige + europa
//   HR_GEO_CACHE=/tmp/x MAPSHAPER=/sökväg/mapshaper node admin/…
//
// Sub-issue D (#607) gör om detta till admin/hitta-ratt-geo.mjs (alla scopes,
// län, världen, minsta-stater-ringar, storleksrapport) – se
// docs/HITTA-RATT-ARKITEKTUR.md §3.
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { byggProjektion, tillKarta, tillLatLon } from "../preview/hitta-ratt-spik/projektion.js";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UT = join(ROT, "preview/hitta-ratt-spik");
const CACHE = process.env.HR_GEO_CACHE || "/tmp/hitta-ratt-geo-cache";
const MAPSHAPER_VER = "0.6.121";

// Källor – pinnade så att ett omkörning ger samma resultat.
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const KALLOR = {
  ne10land: `${NE}/ne_10m_admin_0_countries.geojson`,
  ne50land: `${NE}/ne_50m_admin_0_countries.geojson`,
  ne10sjo: `${NE}/ne_10m_lakes.geojson`,
  ne50sjo: `${NE}/ne_50m_lakes.geojson`,
  ne10alv: `${NE}/ne_10m_rivers_lake_centerlines.geojson`,
  ne50alv: `${NE}/ne_50m_rivers_lake_centerlines.geojson`,
  // Sveriges 25 landskap, CC0, byggt ur Lantmäteriets Distriktskarta och klippt
  // mot kustlinjen (perliedman/svenska-landskap, commit 64f033e).
  landskap:
    "https://raw.githubusercontent.com/perliedman/svenska-landskap/64f033ea4cab359d6810e27b221ca6b7f10ce649/svenska-landskap-klippt.geo.json",
};

function hamta(nyckel) {
  mkdirSync(CACHE, { recursive: true });
  const fil = join(CACHE, `${nyckel}.geojson`);
  if (!existsSync(fil)) {
    console.log(`hämtar ${nyckel} …`);
    execFileSync("curl", ["-sSfL", "-m", "300", "-o", fil, KALLOR[nyckel]]);
  }
  return fil;
}

/** Kör mapshaper på `in` med kommandon `cmd` → GeoJSON-objekt (lon/lat). */
function mapshaper(inFil, cmd, namn) {
  const ut = join(CACHE, `ut-${namn}.json`);
  const args = [inFil, ...cmd, "-o", "format=geojson", "precision=0.00001", "force", ut];
  if (process.env.MAPSHAPER) execFileSync(process.env.MAPSHAPER, args, { stdio: "inherit" });
  else execFileSync("npx", ["-y", `mapshaper@${MAPSHAPER_VER}`, ...args], { stdio: "inherit" });
  return JSON.parse(readFileSync(ut, "utf8"));
}

// --- GeoJSON → SVG-väg (heltal, relativa kommandon) ---------------------------

function ringTillVag(p, ring, stang) {
  const pts = [];
  for (const [lon, lat] of ring) {
    const [x, y] = tillKarta(p, lon, lat).map(Math.round);
    const sista = pts[pts.length - 1];
    if (!sista || sista[0] !== x || sista[1] !== y) pts.push([x, y]);
  }
  if (stang && pts.length > 1) {
    const [a, b] = [pts[0], pts[pts.length - 1]];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
  }
  if (pts.length < (stang ? 3 : 2)) return { d: "", n: 0 };
  let d = `M${pts[0][0]} ${pts[0][1]}l`;
  const steg = [];
  for (let i = 1; i < pts.length; i++) steg.push(`${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`);
  d += steg.join(" ").replace(/ -/g, "-") + (stang ? "z" : "");
  return { d, n: pts.length };
}

function geomTillVag(p, g) {
  if (!g) return { d: "", n: 0 };
  const delar = [];
  let n = 0;
  const poly = (rings) => rings.forEach((r) => { const v = ringTillVag(p, r, true); if (v.n) { delar.push(v.d); n += v.n; } });
  const linje = (l) => { const v = ringTillVag(p, l, false); if (v.n) { delar.push(v.d); n += v.n; } };
  if (g.type === "Polygon") poly(g.coordinates);
  else if (g.type === "MultiPolygon") g.coordinates.forEach(poly);
  else if (g.type === "LineString") linje(g.coordinates);
  else if (g.type === "MultiLineString") g.coordinates.forEach(linje);
  return { d: delar.join(""), n };
}

/** Slå ihop alla features i ett lager till EN väg (ett DOM-element). */
function lagerVag(p, fc) {
  let d = "", n = 0;
  for (const f of fc.features) { const v = geomTillVag(p, f.geometry); d += v.d; n += v.n; }
  return { d, n };
}

// Deterministisk blandning: områdenas id får inte avslöja ordning/namn.
function blanda(lista, fro) {
  let s = fro;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function byggOmraden(p, fc, namnFalt, fro) {
  const omraden = [], namn = {};
  let n = 0;
  blanda(fc.features, fro).forEach((f, i) => {
    const v = geomTillVag(p, f.geometry);
    if (!v.n) return;
    const id = `o${i + 1}`;
    const [cx, cy] = tillKarta(p, f.properties.ix, f.properties.iy).map(Math.round);
    omraden.push({ id, d: v.d, c: [cx, cy] });
    namn[id] = f.properties[namnFalt];
    n += v.n;
  });
  return { omraden, namn, n };
}

function skriv(scope, data, namn, statistik) {
  const fil = join(UT, `geo-${scope}.json`);
  const json = JSON.stringify(data);
  writeFileSync(fil, json + "\n");
  writeFileSync(join(UT, `namn-${scope}.json`), JSON.stringify(namn, null, 1) + "\n");
  console.log(`${scope}: ${(json.length / 1024).toFixed(0)} kB, punkter`, statistik);
}

const bbox = (r, m) => `bbox=${r[0] - m},${r[1] - m},${r[2] + m},${r[3] + m}`;

// Klippruta för BAKGRUNDEN: kartrektangeln utökad med `marg` (andel) åt alla
// håll, bak-projicerad till lon/lat. En klippkant i lon/lat blir sned i planet,
// så den måste ligga långt utanför det man kan panorera till.
function bakRuta(p, marg) {
  const [x0, y0, x1, y1] = [-marg * p.bredd, -marg * p.hojd, (1 + marg) * p.bredd, (1 + marg) * p.hojd];
  let v = 180, s = 90, o = -180, n = -90;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    for (const [X, Y] of [[x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]]) {
      const [lon, lat] = tillLatLon(p, X, Y);
      v = Math.min(v, lon); o = Math.max(o, lon); s = Math.min(s, lat); n = Math.max(n, lat);
    }
  }
  return `bbox=${Math.max(-180, v).toFixed(2)},${Math.max(-85, s).toFixed(2)},${Math.min(180, o).toFixed(2)},${Math.min(85, n).toFixed(2)}`;
}
const INRE = ["-each", "ix=this.innerX, iy=this.innerY"];

// --- Sverige: landskap (interaktiva) + grannländer, sjöar, älvar -------------
function sverige() {
  const p = byggProjektion("sverige");
  const r = [9.6, 54.9, 25.4, 69.4];
  const landskap = mapshaper(hamta("landskap"),
    ["-simplify", "interval=350", "keep-shapes", "-filter-islands", "min-area=3km2", ...INRE], "sv-landskap");
  const bak = mapshaper(hamta("ne10land"),
    ["-filter", "ADM0_A3 != 'SWE'", "-clip", bakRuta(p, 0.6), "-simplify", "interval=1500", "keep-shapes", "-filter-islands", "min-area=25km2"], "sv-bak");
  const sjo = mapshaper(hamta("ne10sjo"),
    ["-clip", bbox(r, 1), "-filter", "scalerank <= 9", "-simplify", "interval=350", "keep-shapes", "-filter-islands", "min-area=20km2"], "sv-sjo");
  const alv = mapshaper(hamta("ne10alv"),
    ["-clip", bbox(r, 1), "-filter", "scalerank <= 8", "-simplify", "interval=500"], "sv-alv");
  const o = byggOmraden(p, landskap, "landskap", 604);
  const lb = lagerVag(p, bak), ls = lagerVag(p, sjo), la = lagerVag(p, alv);
  skriv("sverige", {
    v: 1, scope: "sverige", proj: p,
    lager: { bakgrund: lb.d, sjoar: ls.d, vattendrag: la.d },
    omraden: o.omraden,
    kalla: ["ne", "lm-landskap"],
  }, o.namn, { omraden: o.n, bakgrund: lb.n, sjoar: ls.n, vattendrag: la.n });
}

// --- Europa: länder (interaktiva) + övrig mark, sjöar, älvar -----------------
function europa() {
  const p = byggProjektion("europa");
  const r = [-25, 33.5, 45, 71.5];
  const land = mapshaper(hamta("ne50land"),
    ["-filter", "CONTINENT == 'Europe'", "-clip", bakRuta(p, 0.5), "-simplify", "interval=2500", "keep-shapes",
      "-filter-islands", "min-area=150km2", "remove-empty", ...INRE], "eu-land");
  const bak = mapshaper(hamta("ne50land"),
    ["-filter", "CONTINENT != 'Europe'", "-clip", bakRuta(p, 0.5), "-simplify", "interval=9000", "keep-shapes",
      "-filter-islands", "min-area=1500km2"], "eu-bak");
  const sjo = mapshaper(hamta("ne50sjo"),
    ["-clip", bbox(r, 2), "-simplify", "interval=2500", "keep-shapes", "-filter-islands", "min-area=400km2"], "eu-sjo");
  const alv = mapshaper(hamta("ne50alv"),
    ["-clip", bbox(r, 2), "-filter", "scalerank <= 5", "-simplify", "interval=3000"], "eu-alv");
  const o = byggOmraden(p, land, "NAME", 603);
  const lb = lagerVag(p, bak), ls = lagerVag(p, sjo), la = lagerVag(p, alv);
  skriv("europa", {
    v: 1, scope: "europa", proj: p,
    lager: { bakgrund: lb.d, sjoar: ls.d, vattendrag: la.d },
    omraden: o.omraden,
    kalla: ["ne"],
  }, o.namn, { omraden: o.n, bakgrund: lb.n, sjoar: ls.n, vattendrag: la.n });
}

sverige();
europa();
