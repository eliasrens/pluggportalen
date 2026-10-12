// ============================================================================
// Hitta rätt! (#607) – bygg förprojicerad geodata för SVG-kartmotorn.
// ----------------------------------------------------------------------------
// Offline-skript (körs av en människa/agent, ALDRIG av appen). Det
//   1. hämtar källorna (version-pinnade URL:er) till en cache UTANFÖR repot,
//   2. klipper, slår ihop och förenklar med mapshaper (CLI via npx, pinnad),
//   3. projicerar med kartmotorns projektion.js (samma kod som webbläsaren)
//      och skriver färdiga SVG-vägar som heltal,
//   4. skriver src/hitta-ratt/content/geo/<geo-id>.json (laddas av appen) och
//      <geo-id>.nycklar.json (källnyckel → ogenomskinligt id; BARA för
//      packbyggaren och valideringen – appen laddar den aldrig),
//   5. skriver storleksrapporten i src/hitta-ratt/content/KALLOR.md.
//
//   node admin/hitta-ratt-geo.mjs                 → alla fyra geofiler
//   node admin/hitta-ratt-geo.mjs europa varlden  → bara de namngivna
//   HR_GEO_CACHE=/tmp/x MAPSHAPER=/sökväg/mapshaper node admin/hitta-ratt-geo.mjs
//
// Omkörning ger samma resultat (pinnade källor, deterministisk blandning av
// id:n). Efter en omkörning: `node admin/hitta-ratt-packs.mjs` synkar packens
// områdes-id mot de nya nyckelfilerna. Se docs/HITTA-RATT-ARKITEKTUR.md §2.
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { ROT, GEO_DIR, laddaProjektion, uppdateraRapport } from "./hitta-ratt-delat.mjs";
import { litenSida } from "../src/hitta-ratt/karta/ringregel.js";

const { byggProjektion, tillKarta, tillLatLon } = await laddaProjektion();

const CACHE = process.env.HR_GEO_CACHE || "/tmp/hitta-ratt-geo-cache";
const MAPSHAPER_VER = "0.6.121";

// Källor – pinnade så att en omkörning ger samma resultat.
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const LM = "https://raw.githubusercontent.com/perliedman/svenska-landskap/64f033ea4cab359d6810e27b221ca6b7f10ce649";
const KALLOR = {
  ne10land: `${NE}/ne_10m_admin_0_countries.geojson`,
  ne50land: `${NE}/ne_50m_admin_0_countries.geojson`,
  ne110land: `${NE}/ne_110m_admin_0_countries.geojson`,
  ne10lan: `${NE}/ne_10m_admin_1_states_provinces.geojson`,
  ne10sjo: `${NE}/ne_10m_lakes.geojson`,
  ne50sjo: `${NE}/ne_50m_lakes.geojson`,
  ne10alv: `${NE}/ne_10m_rivers_lake_centerlines.geojson`,
  ne50alv: `${NE}/ne_50m_rivers_lake_centerlines.geojson`,
  // Sveriges 25 landskap, CC0, byggt ur Lantmäteriets Distriktskarta. Den
  // OKLIPPTA varianten (går ut i havet) klipps här mot Natural Earths
  // 10m-kust, så landskap och län får samma kust (§2.1).
  landskap: `${LM}/svenska-landskap.geo.json`,
};

// Europadefinitionen (§2.4, 46 länder). Övriga ritas som bakgrund.
export const EUROPA = [
  // EU27
  "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL",
  "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
  // EES/EFTA, Storbritannien, Västra Balkan, Östeuropa, mikrostater
  "ISL", "NOR", "CHE", "LIE", "GBR", "ALB", "BIH", "MNE", "MKD", "SRB", "KOS",
  "MDA", "UKR", "BLR", "RUS", "AND", "MCO", "SMR", "VAT",
];
// Delar som slås ihop med sitt land (Natural Earth har dem som egna ytor).
const SLA_IHOP = { ALD: "FIN", FRO: "DNK", CYN: "CYP", SOL: "SOM", HKG: "CHN", MAC: "CHN" };
// Världen: suveräna stater + Kosovo, Israel, Palestina. Mindre än
// VARLD_MIN_KM2 blir bakgrund (annars en klickring per Stillahavsö på
// helvyn; inget av de 30 länderna i packen är i närheten av gränsen).
const VARLD_TYPER = new Set(["Sovereign country", "Country", "Sovereignty"]);
const VARLD_EXTRA = new Set(["KOS", "ISR", "PSX"]);
const VARLD_UTAN = new Set(["ATA", "JEY", "GGY", "IMN", "ABW", "CUW", "SXM", "GRL"]);
const VARLD_MIN_KM2 = 5000;

// --- hämtning + mapshaper ---------------------------------------------------

function hamta(nyckel) {
  mkdirSync(CACHE, { recursive: true });
  const fil = join(CACHE, `${nyckel}.geojson`);
  if (!existsSync(fil)) {
    console.log(`hämtar ${nyckel} …`);
    execFileSync("curl", ["-sSfL", "-m", "600", "-o", fil, KALLOR[nyckel]]);
  }
  return fil;
}

function mapshaper(inFil, cmd, namn) {
  const ut = join(CACHE, `ut-${namn}.json`);
  const args = [inFil, ...cmd, "-o", "format=geojson", "precision=0.00001", "force", ut];
  if (process.env.MAPSHAPER) execFileSync(process.env.MAPSHAPER, args, { stdio: ["ignore", "ignore", "inherit"] });
  else execFileSync("npx", ["-y", `mapshaper@${MAPSHAPER_VER}`, ...args], { stdio: ["ignore", "ignore", "inherit"] });
  return JSON.parse(readFileSync(ut, "utf8"));
}

/** Skriv en mellanfil (GeoJSON) i cachen och returnera sökvägen. */
function mellanfil(namn, features) {
  const fil = join(CACHE, `mellan-${namn}.json`);
  writeFileSync(fil, JSON.stringify({ type: "FeatureCollection", features }));
  return fil;
}
const lasFc = (nyckel) => JSON.parse(readFileSync(hamta(nyckel), "utf8"));

// --- GeoJSON → SVG-väg (heltal, relativa kommandon) --------------------------

/** Projicera + avrunda en ring; tar bort dubbletter. */
function projRing(p, ring, stang) {
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
  return pts;
}

/** Signerad yta (kartenheter², Y nedåt: positiv = medurs på skärmen). */
function ytaRing(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]);
  return a / 2;
}

function vag(pts, stang) {
  let d = `M${pts[0][0]} ${pts[0][1]}l`;
  const steg = [];
  for (let i = 1; i < pts.length; i++) steg.push(`${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`);
  return d + steg.join(" ").replace(/ -/g, "-") + (stang ? "z" : "");
}

/**
 * Polygon/MultiPolygon → SVG-väg. Ytterringar medurs, hål moturs (så att
 * både nonzero och evenodd ritar enklaver som San Marino rätt). Små
 * ytterringar under `minYta` (kartenheter²) tas bort, utom den största delen
 * när `behallStorsta` (ett interaktivt område får aldrig försvinna).
 */
function polyVag(p, g, minYta, behallStorsta) {
  if (!g) return { d: "", n: 0, storsta: 0 };
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const delar = polys.map((rings) => rings.map((r) => projRing(p, r, true)).filter((r) => r.length >= 3))
    .filter((rs) => rs.length)
    .map((rs) => ({ rs, yta: Math.abs(ytaRing(rs[0])) }));
  const storsta = delar.reduce((m, x) => (!m || x.yta > m.yta ? x : m), null);
  let d = "", n = 0;
  for (const del of delar) {
    if (del.yta < minYta && !(behallStorsta && del === storsta)) continue;
    del.rs.forEach((r, i) => {
      const medurs = ytaRing(r) > 0;
      if ((i === 0) !== medurs) r.reverse();
      d += vag(r, true);
      n += r.length;
    });
  }
  return { d, n, storsta: storsta?.yta ?? 0 };
}

function linjeVag(p, g) {
  const linjer = g?.type === "LineString" ? [g.coordinates] : g?.type === "MultiLineString" ? g.coordinates : [];
  let d = "", n = 0;
  for (const l of linjer) {
    const pts = projRing(p, l, false);
    if (pts.length >= 2) { d += vag(pts, false); n += pts.length; }
  }
  return { d, n };
}

/** Slå ihop alla features i ett lager till EN väg (ett DOM-element). */
function lagerVag(p, features, minYta = 0) {
  let d = "", n = 0;
  for (const f of features) {
    const v = /Line/.test(f.geometry?.type) ? linjeVag(p, f.geometry) : polyVag(p, f.geometry, minYta, false);
    d += v.d; n += v.n;
  }
  return { d, n };
}

// Deterministisk blandning: områdenas id får inte avslöja ordning eller namn.
function blanda(lista, fro) {
  let s = fro;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Interaktiva områden. Sorteras på nyckel FÖRE blandningen, så att id:n bara
 * beror på nyckelmängden + fröet (inte på källans ordning).
 */
function byggOmraden(p, features, fro, minYta) {
  const omraden = [], nycklar = {};
  let n = 0;
  const sorterade = [...features].sort((a, b) => (a.properties.k < b.properties.k ? -1 : 1));
  blanda(sorterade, fro).forEach((f, i) => {
    const id = `o${i + 1}`;
    const [cx, cy] = tillKarta(p, f.properties.ix, f.properties.iy).map(Math.round);
    let v = polyVag(p, f.geometry, minYta, true);
    if (!v.n) {
      // Mindre än en kartenhet (Vatikanen i Europa): en liten romb runt den
      // inre punkten. Motorns klickring gör den klickbar ändå.
      v = { d: `M${cx} ${cy - 2}l2 2-2 2-2-2z`, n: 4, storsta: 0 };
    }
    // Kan området få klickring? Ur största delens verkliga yta (#639).
    const liten = litenSida(v.storsta, p.s);
    omraden.push({ id, d: v.d, c: [cx, cy], ...(liten === null ? {} : { liten }) });
    nycklar[f.properties.k] = id;
    n += v.n;
  });
  omraden.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  return { omraden, nycklar, n };
}

const bbox = (r, m) => `bbox=${r[0] - m},${r[1] - m},${r[2] + m},${r[3] + m}`;

// Klippruta: kartrektangeln utökad med `marg` (andel) åt alla håll,
// bak-projicerad till lon/lat. En klippkant i lon/lat blir sned i planet, så
// bakgrundens kant måste ligga långt utanför det man kan panorera till.
function bakRuta(p, marg) {
  const [x0, y0, x1, y1] = [-marg * p.bredd, -marg * p.hojd, (1 + marg) * p.bredd, (1 + marg) * p.hojd];
  let v = 180, s = 90, o = -180, n = -90;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    for (const [X, Y] of [[x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]]) {
      const [lon, lat] = tillLatLon(p, X, Y);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      v = Math.min(v, lon); o = Math.max(o, lon); s = Math.min(s, lat); n = Math.max(n, lat);
    }
  }
  return `bbox=${Math.max(-180, v).toFixed(2)},${Math.max(-85, s).toFixed(2)},${Math.min(180, o).toFixed(2)},${Math.min(85, n).toFixed(2)}`;
}
const INRE = ["-each", "ix=this.innerX, iy=this.innerY"];
const km2 = (p, a) => a * p.s * p.s; // km² → kartenheter²

// --- skrivning + rapport ----------------------------------------------------

const rapport = {};
function skriv(geoId, data, nycklar, statistik) {
  mkdirSync(GEO_DIR, { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(join(GEO_DIR, `${geoId}.json`), json + "\n");
  writeFileSync(join(GEO_DIR, `${geoId}.nycklar.json`), JSON.stringify(nycklar, null, 1) + "\n");
  const punkter = Object.values(statistik).reduce((a, b) => a + b, 0);
  rapport[geoId] = {
    kB: +(Buffer.byteLength(json) / 1024).toFixed(1),
    gzipKB: +(gzipSync(json).length / 1024).toFixed(1),
    punkter, omraden: data.omraden.length, lager: statistik,
  };
  console.log(`${geoId}: ${rapport[geoId].kB} kB (${rapport[geoId].gzipKB} kB gzip), ${punkter} punkter`, statistik);
}

/** Natural Earth-sjöar och älvar inom en ruta (gemensamt för Sverige). */
function vattenSverige(p, r) {
  const sjo = mapshaper(hamta("ne10sjo"),
    ["-clip", bbox(r, 1), "-filter", "scalerank <= 9", "-simplify", "interval=350", "keep-shapes"], "sv-sjo");
  const alv = mapshaper(hamta("ne10alv"),
    ["-clip", bbox(r, 1), "-filter", "scalerank <= 8", "-simplify", "interval=500"], "sv-alv");
  return { sjo: lagerVag(p, sjo.features, km2(p, 4.5)), alv: lagerVag(p, alv.features) };
}

/** NE 10m-länder kring Sverige → EN bakgrundsväg (inkl. Sverige självt). */
function bakgrundSverige(p) {
  const bak = mapshaper(hamta("ne10land"),
    ["-clip", bakRuta(p, 0.6), "-simplify", "interval=1500", "keep-shapes"], "sv-bak");
  return lagerVag(p, bak.features, km2(p, 5));
}

// --- Sverige: landskap -----------------------------------------------------
function sverigeLandskap() {
  const p = byggProjektion("sverige");
  const r = [9.6, 54.9, 25.4, 69.4];
  const swe = mellanfil("swe", lasFc("ne10land").features.filter((f) => f.properties.ADM0_A3 === "SWE"));
  const slug = (s) => s.toLowerCase().replace(/å|ä/g, "a").replace(/ö/g, "o").replace(/[^a-z]+/g, "-");
  const landskap = mellanfil("landskap", lasFc("landskap").features.map((f) => ({
    type: "Feature", geometry: f.geometry, properties: { k: slug(f.properties.landskap) },
  })));
  // Klipp mot NE-Sverige, fyll små glipor mot riksgränsen, förenkla topologiskt.
  const o = mapshaper(landskap,
    ["-clip", swe, "-clean", "gap-fill-area=20km2", "-simplify", "interval=300", "keep-shapes", ...INRE], "sv-landskap");
  if (o.features.length !== 25) throw new Error(`väntade 25 landskap, fick ${o.features.length}`);
  const om = byggOmraden(p, o.features, 604, km2(p, 3));
  const lb = bakgrundSverige(p), { sjo, alv } = vattenSverige(p, r);
  skriv("sverige-landskap", {
    v: 1, scope: "sverige", proj: p,
    lager: { bakgrund: lb.d, sjoar: sjo.d, vattendrag: alv.d },
    omraden: om.omraden, kalla: ["ne", "lm-landskap"],
  }, om.nycklar, { omraden: om.n, bakgrund: lb.n, sjoar: sjo.n, vattendrag: alv.n });
}

// --- Sverige: län (Natural Earth admin-1, samma kust som NE 10m) ------------
function sverigeLan() {
  const p = byggProjektion("sverige");
  const r = [9.6, 54.9, 25.4, 69.4];
  const lan = mellanfil("lan", lasFc("ne10lan").features.filter((f) => f.properties.adm0_a3 === "SWE")
    .map((f) => ({ type: "Feature", geometry: f.geometry, properties: { k: f.properties.iso_3166_2 } })));
  const o = mapshaper(lan, ["-simplify", "interval=300", "keep-shapes", ...INRE], "sv-lan");
  if (o.features.length !== 21) throw new Error(`väntade 21 län, fick ${o.features.length}`);
  const om = byggOmraden(p, o.features, 607, km2(p, 3));
  const lb = bakgrundSverige(p), { sjo, alv } = vattenSverige(p, r);
  skriv("sverige-lan", {
    v: 1, scope: "sverige", proj: p,
    lager: { bakgrund: lb.d, sjoar: sjo.d, vattendrag: alv.d },
    omraden: om.omraden, kalla: ["ne"],
  }, om.nycklar, { omraden: om.n, bakgrund: lb.n, sjoar: sjo.n, vattendrag: alv.n });
}

/**
 * Länder i ETT mapshaper-lager (interaktiva + bakgrund), så att delade
 * gränser förenklas likadant och ingen bakgrundskant sticker ut runt ett
 * interaktivt land. `nyckel(props)` → { k, int } eller null (utelämna).
 */
function landLager(kalla, namn, p, klipp, nyckel, simpInt, simpBak) {
  const fc = lasFc(kalla).features.flatMap((f) => {
    const n = nyckel(f.properties);
    return n ? [{ type: "Feature", geometry: f.geometry, properties: n }] : [];
  });
  const fil = mellanfil(namn, fc);
  return mapshaper(fil, ["-clip", klipp, "-dissolve2", "k", "copy-fields=int",
    "-simplify", "variable", `interval=int ? ${simpInt} : ${simpBak}`, "keep-shapes",
    "-each", "km2=this.area/1e6", ...INRE], namn).features;
}

// --- Europa (46 länder enligt §2.4) -----------------------------------------
function europa() {
  const p = byggProjektion("europa");
  const r = [-25, 33.5, 45, 71.5];
  const eu = new Set(EUROPA);
  const land = landLager("ne10land", "eu-land", p, bakRuta(p, 0.5), (pr) => {
    const k = SLA_IHOP[pr.ADM0_A3] && eu.has(SLA_IHOP[pr.ADM0_A3]) ? SLA_IHOP[pr.ADM0_A3] : pr.ADM0_A3;
    return { k: eu.has(k) ? k : `bak-${k}`, int: eu.has(k) };
  }, 2200, 14000);
  // Interaktiva länder klipps snävare (Ryssland slutar strax utanför kartan;
  // resten av Ryssland ritas som bakgrund).
  const intRuta = bakRuta(p, 0.15).slice(5).split(",").map(Number);
  const inom = mapshaper(mellanfil("eu-int", land.filter((f) => f.properties.int)),
    ["-clip", `bbox=${intRuta.join(",")}`, ...INRE], "eu-int").features;
  if (inom.length !== 46) throw new Error(`väntade 46 länder, fick ${inom.length}`);
  const om = byggOmraden(p, inom, 603, km2(p, 120));
  // Bakgrund = övriga länder + det som klipptes bort av de interaktiva
  // (Ryssland bortom kartan), så att det inte blir glipor vid klippkanten.
  const utanfor = mapshaper(mellanfil("eu-int-ut", land.filter((f) => f.properties.int)),
    ["-erase", `bbox=${intRuta.join(",")}`], "eu-int-ut").features;
  const lb = lagerVag(p, [...land.filter((f) => !f.properties.int), ...utanfor], km2(p, 400));
  const sjo = mapshaper(hamta("ne50sjo"), ["-clip", bbox(r, 2), "-simplify", "interval=2500", "keep-shapes"], "eu-sjo");
  const alv = mapshaper(hamta("ne50alv"), ["-clip", bbox(r, 2), "-filter", "scalerank <= 5", "-simplify", "interval=3000"], "eu-alv");
  const ls = lagerVag(p, sjo.features, km2(p, 400)), la = lagerVag(p, alv.features);
  skriv("europa", {
    v: 1, scope: "europa", proj: p,
    lager: { bakgrund: lb.d, sjoar: ls.d, vattendrag: la.d },
    omraden: om.omraden, kalla: ["ne"],
  }, om.nycklar, { omraden: om.n, bakgrund: lb.n, sjoar: ls.n, vattendrag: la.n });
}

// --- Världen ----------------------------------------------------------------
function varlden() {
  const p = byggProjektion("varlden");
  const land = landLager("ne50land", "va-land", p, "bbox=-180,-60,180,84", (pr) => {
    const a = pr.ADM0_A3;
    if (a === "ATA") return null; // Antarktis ligger utanför scope-rutan
    const k = SLA_IHOP[a] || a;
    const int = (VARLD_TYPER.has(pr.TYPE) || VARLD_EXTRA.has(a)) && !VARLD_UTAN.has(a);
    return { k: int ? k : `bak-${a}`, int };
  }, 6000, 15000);
  for (const f of land) if (f.properties.int && f.properties.km2 < VARLD_MIN_KM2) { f.properties.int = false; f.properties.k = `bak-${f.properties.k}`; }
  const om = byggOmraden(p, land.filter((f) => f.properties.int), 612, km2(p, 900));
  const lb = lagerVag(p, land.filter((f) => !f.properties.int), km2(p, 300));
  const sjo = mapshaper(hamta("ne50sjo"), ["-filter", "scalerank <= 2", "-simplify", "interval=12000", "keep-shapes"], "va-sjo");
  const alv = mapshaper(hamta("ne50alv"), ["-filter", "scalerank <= 2", "-simplify", "interval=15000"], "va-alv");
  const ls = lagerVag(p, sjo.features, km2(p, 8000)), la = lagerVag(p, alv.features);
  skriv("varlden", {
    v: 1, scope: "varlden", proj: p,
    lager: { bakgrund: lb.d, sjoar: ls.d, vattendrag: la.d },
    omraden: om.omraden, kalla: ["ne"],
  }, om.nycklar, { omraden: om.n, bakgrund: lb.n, sjoar: ls.n, vattendrag: la.n });
}

const BYGG = { "sverige-landskap": sverigeLandskap, "sverige-lan": sverigeLan, europa, varlden };
const valda = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BYGG);
for (const id of valda) {
  if (!BYGG[id]) throw new Error(`okänd geofil: ${id} (finns: ${Object.keys(BYGG).join(", ")})`);
  BYGG[id]();
}
uppdateraRapport("geo", rapport);
console.log(`klart → ${GEO_DIR.replace(ROT + "/", "")}`);
