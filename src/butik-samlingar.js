// ============================================================================
// Pluggporten – butikens samlingsflikar (#910, epic #906)
// ----------------------------------------------------------------------------
// En rad per säsongssamling (skapaSamlingsFlik, samling-butik.js), i den ordning
// flikarna står först i butiken. Ett nytt tillägg (t.ex. Påsk) = en rad i
// TILLAGG (season-config.js) + sin samlingsmodul här. Laddas bara med import()
// av pages-shop.js (#271).
// ============================================================================

import { HALLOWEEN_SAMLING } from "./halloween/hw-butik.js";
import { JUL_SAMLING } from "./jul/jul-butik.js";

export const SAMLINGAR = [HALLOWEEN_SAMLING, JUL_SAMLING];
