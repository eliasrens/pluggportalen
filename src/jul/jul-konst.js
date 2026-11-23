// ============================================================================
// Pluggporten – registrerar Jul-samlingens katalog och konst (#910, epic #906)
// ----------------------------------------------------------------------------
// Laddas lazy av loadCollectionArt() i art-items.js (aldrig statiskt, #271) och
// slår in varorna (jul-katalog.js) och konsten i de befintliga registren – sedan
// ritar butiken, rummet, trädgården, "🏠 Nytt hus", byn och kompisbesök de nya
// sakerna utan särfall, året runt. Om Jul är på avgör bara butiksfliken
// (jul-butik.js). E (kostymer/avatarer) och F (djur) lägger sina register här.
// ============================================================================

import { registerItemArt, registerCategoryIcons } from "../art-items.js";
import { registerHusSkal } from "../art-hus-ute.js";
import { registerShopItems } from "../shop-items.js";
import { JUL_VAROR } from "./jul-katalog.js";
import { JUL_INNE } from "./jul-art-inne.js";
import { JUL_UTE } from "./jul-art-ute.js";
import { JUL_HUS_SKAL, JUL_HUS_BILDER } from "./jul-art-hus.js";
import { gran, stjarna5, GULD } from "./jul-art-delar.js";
// Kostymer och avatarer (#911)
import { registerWearables } from "../art-wearables.js";
import { JUL_KOSTYMER_KATALOG } from "./jul-kostymer.js";
import { JUL_KOSTYMER } from "./jul-art-kostymer.js";
import { JUL_SAMLING } from "./jul-butik.js";
import { registreraJulAvatarer } from "./jul-avatarer.js";
import { registreraJulDjur } from "./jul-djur.js";

/** Flik-ikonen för 🎄 Jul i butiken (SVG, ingen Emoji 13+, #590). */
export const JUL_FLIK_IKON = { viewBox: "0 0 48 50", art: gran(24, 8, 44, 19, 3) + stjarna5(24, 7, 6.5, GULD) };

let klar = false;

/** Slå in Jul-samlingens varor och konst i registren (idempotent). */
export function registreraJulKonst() {
  if (klar) return;
  klar = true;
  registerShopItems(JUL_VAROR);
  registerItemArt({ ...JUL_INNE, ...JUL_UTE, ...JUL_HUS_BILDER });
  registerHusSkal(JUL_HUS_SKAL);
  registerCategoryIcons({ jul: JUL_FLIK_IKON });
  registreraJulDjur(); // de tio Jul-djuren + julklappsägget (#912)
  registreraJulKostymer(); // kostymerna + avatarerna (#911)
}

/** Kostymerna (#911): katalog + konst, en egen undergrupp sist i fliken, och avatarerna. */
function registreraJulKostymer() {
  registerShopItems(JUL_KOSTYMER_KATALOG);
  registerWearables(JUL_KOSTYMER);
  JUL_SAMLING.registreraUndergrupp({ id: "kostymer", rubrik: "🎭 Kostymer", match: (it) => it.category === "klader" });
  registreraJulAvatarer(); // köpbara avatarer: figurer + butikskort
}
