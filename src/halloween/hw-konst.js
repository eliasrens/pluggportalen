// ============================================================================
// Pluggporten – registrerar Halloween-samlingens konst (#692, epic #689)
// ----------------------------------------------------------------------------
// Laddas lazy av loadCollectionArt() i art-items.js (aldrig statiskt, #271) och
// slår in konsten i de befintliga registren – sedan ritar rummet, trädgården,
// "🏠 Nytt hus", byn och butiken de nya sakerna utan särfall. Köpta saker ritas
// därför året runt; om Halloween är på avgör bara butiksfliken (hw-butik.js).
// D–F: lägg egna register här (kostymer/avatarer/djur) i samma funktion.
// ============================================================================

import { registerItemArt, registerCategoryIcons } from "../art-items.js";
import { registerHusSkal } from "../art-hus-ute.js";
import { HW_INNE } from "./hw-art-inne.js";
import { HW_UTE } from "./hw-art-ute.js";
import { HW_HUS_SKAL, HW_HUS_BILDER } from "./hw-art-hus.js";
import { pumpa } from "./hw-art-delar.js";
import { registreraHalloweenAvatarer } from "./hw-avatarer.js";

/** Flik-ikonen för 🎃 Halloween i butiken (SVG, ingen Emoji 13+, #590). */
export const HW_FLIK_IKON = { viewBox: "0 0 48 46", art: pumpa(24, 26, 19, "glad") };

let klar = false;

/** Slå in all Halloween-konst i registren (idempotent). */
export function registreraHalloweenKonst() {
  if (klar) return;
  klar = true;
  registerItemArt({ ...HW_INNE, ...HW_UTE, ...HW_HUS_BILDER });
  registerHusSkal(HW_HUS_SKAL);
  registerCategoryIcons({ halloween: HW_FLIK_IKON });
  registreraHalloweenAvatarer(); // köpbara avatarer (#694): figurer + butikskort
}
