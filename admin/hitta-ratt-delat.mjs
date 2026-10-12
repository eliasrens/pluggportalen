// Hitta rätt! (#607) – delat mellan admin-skripten hitta-ratt-geo/-packs/-bilder.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTENT = join(ROT, "src/hitta-ratt/content");
export const GEO_DIR = join(CONTENT, "geo");
export const PACK_DIR = join(CONTENT, "packs");
export const BILD_DIR = join(CONTENT, "bilder");
const STORLEK = join(CONTENT, "storlek.json");

/**
 * Kartmotorns projektion. C (#606) lyfter spikens projektion.js till
 * src/hitta-ratt/karta/; tills dess används spikens (identisk kod).
 */
export async function laddaProjektion() {
  for (const rel of ["src/hitta-ratt/karta/projektion.js", "preview/hitta-ratt-spik/projektion.js"]) {
    const fil = join(ROT, rel);
    if (existsSync(fil)) return import(pathToFileURL(fil).href);
  }
  throw new Error("hittar ingen projektion.js");
}

export const lasJson = (fil) => JSON.parse(readFileSync(fil, "utf8"));

/** Spara en del av storleksrapporten (geo | packs) i storlek.json. */
export function uppdateraRapport(del, data) {
  const r = existsSync(STORLEK) ? lasJson(STORLEK) : {};
  r[del] = { ...(r[del] || {}), ...data };
  writeFileSync(STORLEK, JSON.stringify(r, null, 1) + "\n");
}
export const lasRapport = () => (existsSync(STORLEK) ? lasJson(STORLEK) : {});

/** Läsbart packformat: fälten på var sin rad, ett item per rad. */
export function formateraPack(p) {
  const { items, ...huvud } = p;
  const rader = Object.entries(huvud).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  rader.push(`  "items": [\n${items.map((it) => `    ${JSON.stringify(it)}`).join(",\n")}\n  ]`);
  return `{\n${rader.join(",\n")}\n}\n`;
}
