// ============================================================================
// Generator: skriver Gruvans egentecknade grott-bakgrund till gruvan-karta.svg.
// Kör om efter ändringar i themes/gruvan-map.js (geometri) eller gruvan-scen-svg.js
// (utseende), så att BILDEN alltid speglar KOLLISIONEN:
//   node src/adventure/assets/build-gruvan-karta.mjs
// Ren byggsteg – ingen del av runtime.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildCaveSvg } from "../themes/gruvan-scen-svg.js";

const out = fileURLToPath(new URL("./gruvan-karta.svg", import.meta.url));
await writeFile(out, buildCaveSvg(), "utf8");
console.log("Skrev", out, `(${(await import("node:fs")).statSync(out).size} bytes)`);
