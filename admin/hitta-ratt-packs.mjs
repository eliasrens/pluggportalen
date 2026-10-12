// ============================================================================
// Hitta rätt! (#607) – synka de officiella packen mot geodatan.
// ----------------------------------------------------------------------------
// Packen (src/hitta-ratt/content/packs/<packId>.json) är källan: titel,
// svårighet, items, koordinater. Det här skriptet
//   1. sätter varje områdesitems `omrade` (ogenomskinligt id) ur
//      geo/<geo>.nycklar.json via itemets `key` (behövs efter att
//      admin/hitta-ratt-geo.mjs körts om),
//   2. skriver om packen i ett läsbart format (ett item per rad),
//   3. skriver packs/index.json (startsidans lista; ordningen = ORDNING),
//   4. räknar filstorleken per pack och skriver tabellerna i KALLOR.md.
//
//   node admin/hitta-ratt-packs.mjs                 → synka + index + rapport
//   node admin/hitta-ratt-packs.mjs --kontrollera   → + jämför alla punkter med
//        Wikidata (P625) och engelska Wikipedias koordinater (nätverk)
//
// Ändra en lista: redigera packfilen och kör skriptet. Ändras ett befintligt
// packs frågor ska `version` höjas (eller packId bytas, se arkitektur §3.1).
// ============================================================================

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { BILD_DIR, CONTENT, GEO_DIR, PACK_DIR, formateraPack, lasJson, lasRapport, uppdateraRapport } from "./hitta-ratt-delat.mjs";

// Startsidans ordning (§14). Packfiler som inte finns här läggs sist.
const ORDNING = [
  "sverige-stader", "sverige-landskap", "sverige-lan", "sverige-geografi",
  "europa-lander-20", "europa-lander-alla", "europa-huvudstader-20", "europa-huvudstader-alla",
  "varlden-lander-30", "varlden-huvudstader-30",
  "europa-kanda-platser", "varlden-kanda-platser",
];
const UA = { "User-Agent": "Pluggporten-HittaRatt/1.0 (elevspel; admin-skript)" };

function lasPacks() {
  const filer = readdirSync(PACK_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  const packs = filer.map((f) => lasJson(join(PACK_DIR, f)));
  const plats = (id) => (ORDNING.includes(id) ? ORDNING.indexOf(id) : ORDNING.length);
  return packs.sort((a, b) => plats(a.id) - plats(b.id) || a.id.localeCompare(b.id));
}

const kB = (n) => +(n / 1024).toFixed(1);

function synka(packs) {
  const nycklar = {};
  for (const p of packs) {
    if (p.type !== "area") continue;
    nycklar[p.geo] ||= lasJson(join(GEO_DIR, `${p.geo}.nycklar.json`));
    for (const it of p.items) {
      const id = nycklar[p.geo][it.key];
      if (!id) throw new Error(`${p.id}/${it.id}: nyckeln ${it.key} finns inte i ${p.geo}`);
      it.omrade = id;
    }
  }
  for (const p of packs) writeFileSync(join(PACK_DIR, `${p.id}.json`), formateraPack(p));
}

function skrivIndex(packs) {
  const index = packs.map((p) => ({
    id: p.id, title: p.title, description: p.description, category: p.category, type: p.type,
    difficulty: p.difficulty, geo: p.geo, antal: p.items.length, ...(p.bilder ? { bilder: true } : {}),
  }));
  writeFileSync(join(PACK_DIR, "index.json"), JSON.stringify(index, null, 1) + "\n");
}

/** Storlek per pack: packfil + geofil (det som laddas när packen startar) + bilder. */
function storlek(packs) {
  const ut = {};
  for (const p of packs) {
    const packTxt = readFileSync(join(PACK_DIR, `${p.id}.json`));
    const geoTxt = readFileSync(join(GEO_DIR, `${p.geo}.json`));
    const bilder = p.items.filter((it) => it.bild).map((it) => statSync(join(BILD_DIR, it.bild.fil)).size);
    ut[p.id] = {
      geo: p.geo,
      packKB: kB(packTxt.length), packGzipKB: kB(gzipSync(packTxt).length),
      geoKB: kB(geoTxt.length), geoGzipKB: kB(gzipSync(geoTxt).length),
      bilder: bilder.length, bilderKB: kB(bilder.reduce((a, b) => a + b, 0)),
      storstaBildKB: bilder.length ? kB(Math.max(...bilder)) : 0,
    };
  }
  uppdateraRapport("packs", ut);
  return ut;
}

// --- KALLOR.md: genererade tabeller mellan markörer ---------------------------

function ersattBlock(txt, namn, innehall) {
  const start = `<!-- ${namn}:start -->`, slut = `<!-- ${namn}:slut -->`;
  const i = txt.indexOf(start), j = txt.indexOf(slut);
  if (i < 0 || j < 0) throw new Error(`KALLOR.md saknar markörerna för ${namn}`);
  return txt.slice(0, i + start.length) + `\n${innehall}\n` + txt.slice(j);
}

function skrivKallor(packs, packStorlek) {
  const fil = join(CONTENT, "KALLOR.md");
  let txt = readFileSync(fil, "utf8");
  const geo = lasRapport().geo || {};
  const geoRader = Object.entries(geo).map(([id, g]) =>
    `| \`${id}\` | ${g.omraden} | ${g.punkter.toLocaleString("sv-SE")} | ${g.kB} kB | ${g.gzipKB} kB |`);
  txt = ersattBlock(txt, "geo", ["| Geofil | Områden | Punkter | Storlek | gzip |", "| --- | --- | --- | --- | --- |", ...geoRader].join("\n"));
  const packRader = packs.map((p) => {
    const s = packStorlek[p.id];
    const bild = s.bilder ? `${s.bilder} st, ${s.bilderKB} kB (största ${s.storstaBildKB} kB)` : "–";
    return `| \`${p.id}\` | ${p.items.length} | \`${s.geo}\` | ${s.packKB} kB (${s.packGzipKB} gzip) | ${s.geoKB} kB (${s.geoGzipKB} gzip) | ${bild} |`;
  });
  txt = ersattBlock(txt, "packs", ["| Pack | Items | Geofil | Packfil | Geofil | Bilder (lat, en åt gången) |", "| --- | --- | --- | --- | --- | --- |", ...packRader].join("\n"));
  const bildRader = packs.flatMap((p) => p.items.filter((it) => it.bild).map((it) =>
    `| ${it.name} | [${it.bild.kalla}](${it.bild.kallaUrl}) | ${it.bild.fotograf.replace(/\|/g, "/")} | [${it.bild.licens}](${it.bild.licensUrl}) |`));
  txt = ersattBlock(txt, "bilder", ["| Plats | Fil (Wikimedia Commons) | Fotograf | Licens |", "| --- | --- | --- | --- |", ...bildRader].join("\n"));
  writeFileSync(fil, txt);
}

// --- --kontrollera: jämför punkterna med två oberoende källor ---------------

const RAD = Math.PI / 180;
function km(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function kontrollera(packs) {
  const items = packs.flatMap((p) => p.items.filter((it) => it.wikidata).map((it) => ({ p, it })));
  const qids = [...new Set(items.map((x) => x.it.wikidata))];
  const wd = {};
  for (let i = 0; i < qids.length; i += 40) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.slice(i, i + 40).join("|")}&props=claims|sitelinks&sitefilter=enwiki&format=json`;
    const j = await (await fetch(url, { headers: UA })).json();
    for (const [q, e] of Object.entries(j.entities)) {
      const c = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      wd[q] = { lat: c?.latitude, lon: c?.longitude, titel: e.sitelinks?.enwiki?.title };
    }
  }
  const titlar = Object.values(wd).map((w) => w.titel).filter(Boolean);
  const en = {};
  for (let i = 0; i < titlar.length; i += 40) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max&format=json&titles=${encodeURIComponent(titlar.slice(i, i + 40).join("|"))}`;
    const j = await (await fetch(url, { headers: UA })).json();
    for (const s of Object.values(j.query.pages)) if (s.coordinates?.[0]) en[s.title] = s.coordinates[0];
  }
  let fel = 0;
  console.log("\nKoordinatkontroll (km från Wikidata P625 / engelska Wikipedia):");
  for (const { p, it } of items) {
    const w = wd[it.wikidata], e = en[w?.titel];
    const dW = w?.lat != null ? km(it.lat, it.lon, w.lat, w.lon) : null;
    const dE = e ? km(it.lat, it.lon, e.lat, e.lon) : null;
    const grans = p.scoringConfig.fullKm;
    const avvik = it.malpunkt ? false : (dW ?? dE ?? Infinity) > grans || (dE != null && dE > 4 * grans);
    if (avvik) fel++;
    if (avvik || it.malpunkt || process.env.HR_VERBOSE) {
      console.log(`${avvik ? "AVVIKER" : it.malpunkt ? "målpunkt" : "ok"}\t${p.id}/${it.id}\twd ${dW?.toFixed(1) ?? "–"}\ten ${dE?.toFixed(1) ?? "–"}${it.malpunkt ? `\t(${it.malpunkt})` : ""}`);
    }
  }
  console.log(`${items.length} punkter kontrollerade, ${fel} avviker mer än packens fullKm.`);
  if (fel) process.exitCode = 1;
}

const packs = lasPacks();
synka(packs);
skrivIndex(packs);
const s = storlek(packs);
if (existsSync(join(CONTENT, "KALLOR.md"))) skrivKallor(packs, s);
for (const p of packs) {
  const x = s[p.id];
  console.log(`${p.id.padEnd(26)} ${String(p.items.length).padStart(3)} items  pack ${x.packGzipKB} kB + ${p.geo} ${x.geoGzipKB} kB gzip${x.bilder ? `  + ${x.bilder} bilder ${x.bilderKB} kB` : ""}`);
}
if (process.argv.includes("--kontrollera")) await kontrollera(packs);
