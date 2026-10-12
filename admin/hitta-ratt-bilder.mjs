// ============================================================================
// Hitta rätt! (#607) – ladda ner bilderna till "Kända platser" från Commons.
// ----------------------------------------------------------------------------
// Offline-skript. Speltiden använder ALDRIG Commons – bilderna ligger i repot.
// För varje item med `bildKalla: "File:…"`:
//   1. Commons API (imageinfo + extmetadata): licens, fotograf, miniatyr-URL,
//   2. godtar BARA Public domain, CC0, CC BY och CC BY-SA (vitlistan i
//      src/hitta-ratt/larare/commons.js – samma som lärarvyns bildsökning),
//   3. laddar ner 960 px-miniatyren och gör WebP, max 800 px (sharp-cli via
//      npx, pinnad; inga nya beroenden i package.json),
//   4. skriver `bild { fil, bredd, hojd, kalla, fotograf, licens, licensUrl,
//      kallaUrl }` i packen.
// Redan nerladdade bilder (samma bildKalla) hoppas över; `--om` gör om alla.
//
//   node admin/hitta-ratt-bilder.mjs [--om]
//   node admin/hitta-ratt-packs.mjs            (uppdaterar KALLOR.md efteråt)
//
// Byt bild: ändra itemets `bildKalla` och kör skriptet igen.
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BILD_DIR, PACK_DIR, formateraPack, lasJson } from "./hitta-ratt-delat.mjs";
// Licensvitlistan och Artist-rensningen delas med lärarvyns bildsökning (#637).
import { fotografUr, licens } from "../src/hitta-ratt/larare/commons.js";

const CACHE = process.env.HR_GEO_CACHE || "/tmp/hitta-ratt-geo-cache";
const SHARP = ["-y", "sharp-cli@5.1.0"];
const MAX_PX = 800;
const KVALITET = 72;
const MAX_KB = 120;
const UA = { "User-Agent": "Pluggporten-HittaRatt/1.0 (elevspel; admin-skript)" };
const OM = process.argv.includes("--om");

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

async function info(titel) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=960&titles=${encodeURIComponent(titel)}`;
  let j;
  for (let forsok = 1; ; forsok++) {
    await vanta(1500); // Commons strypar täta anrop
    const svar = await fetch(url, { headers: UA });
    if (svar.ok) { j = await svar.json(); break; }
    if (forsok >= 5) throw new Error(`${titel}: Commons svarar ${svar.status}`);
    await vanta(15000 * forsok);
  }
  const sida = Object.values(j.query.pages)[0];
  if (!sida.imageinfo) throw new Error(`${titel}: finns inte på Commons`);
  return sida.imageinfo[0];
}

function webp(inFil, utFil, kvalitet) {
  const tmp = join(CACHE, "bild-ut");
  mkdirSync(tmp, { recursive: true });
  for (const f of readdirSync(tmp)) unlinkSync(join(tmp, f));
  execFileSync("npx", [...SHARP, "-i", inFil, "-o", tmp, "-f", "webp", "-q", String(kvalitet),
    "resize", String(MAX_PX), String(MAX_PX), "--fit", "inside", "--withoutEnlargement"], { stdio: ["ignore", "ignore", "inherit"] });
  const ut = readdirSync(tmp)[0];
  execFileSync("mv", [join(tmp, ut), utFil]);
}

/** Bildens mått ur WebP-huvudet (VP8/VP8L/VP8X). */
function matt(fil) {
  const b = execFileSync("head", ["-c", "40", fil]);
  const typ = b.toString("ascii", 12, 16);
  if (typ === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (typ === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

mkdirSync(BILD_DIR, { recursive: true });
mkdirSync(CACHE, { recursive: true });
const packFiler = readdirSync(PACK_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
let nya = 0;
for (const f of packFiler) {
  const p = lasJson(join(PACK_DIR, f));
  const items = p.items.filter((it) => it.bildKalla);
  if (!items.length) continue;
  for (const it of items) {
    const fil = `${it.id}.webp`;
    const ut = join(BILD_DIR, fil);
    if (!OM && it.bild?.kalla === it.bildKalla.replace(/^File:/, "") && existsSync(ut)) continue;
    const ii = await info(it.bildKalla);
    const lic = licens(ii.extmetadata);
    if (!lic) throw new Error(`${p.id}/${it.id}: licensen "${ii.extmetadata.LicenseShortName?.value}" är inte godkänd – välj en annan bild`);
    // `bildFotograf` i itemet skriver över Commons Artist-fält när det är rörigt.
    const fotograf = it.bildFotograf || fotografUr(ii.extmetadata);
    const ra = join(CACHE, `ra-${it.id}`);
    execFileSync("curl", ["-sSfL", "-m", "120", "-A", UA["User-Agent"], "-o", ra, ii.thumburl || ii.url]);
    let q = KVALITET;
    webp(ra, ut, q);
    while (statSync(ut).size > MAX_KB * 1024 && q > 40) { q -= 8; webp(ra, ut, q); }
    const [bredd, hojd] = matt(ut);
    it.bild = {
      fil, bredd, hojd, kalla: it.bildKalla.replace(/^File:/, ""),
      fotograf: fotograf.slice(0, 160), ...lic, kallaUrl: ii.descriptionurl,
    };
    nya++;
    console.log(`${p.id}/${it.id}: ${bredd}×${hojd}, ${(statSync(ut).size / 1024).toFixed(0)} kB, ${lic.licens}, ${it.bild.fotograf}`);
    writeFileSync(join(PACK_DIR, f), formateraPack(p)); // efter varje bild: ett avbrott tappar inget
  }
}
console.log(`${nya} bilder hämtade.`);
