// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/index.js
// ----------------------------------------------------------------------------
// PRODUKTIONSREGISTER för äventyrsteman: de TRE riktiga temana som visas för
// elever – som kort i områdesöversikten (gamemodes.js) och som val via
// #/elev/aventyr?...&tema=<id> (adventure/index.js). EN källa till sanning.
//
// Test-temat (themes/test-tema.js) ingår AVSIKTLIGT INTE här – det är bara en
// preview-/utvecklingsbana och ska inte synas för elever. test-tema.js spreder
// däremot in det här registret (test + de tre riktiga) för sin egen testroute.
//
// Nytt tema = skapa themes/<x>.js enligt README.md, importera dess config här
// och lägg till EN rad i THEMES. Inget annat behövs – motorn är oförändrad.
// ============================================================================

import { skattjaktenTheme } from "./skattjakten.js";
import { spokjaktenTheme } from "./spokjakten.js";
import { gruvanTheme } from "./gruvan.js";

/** id → temaconfig för de riktiga temana (test-temat exkluderat med flit). */
export const THEMES = {
  skattjakten: skattjaktenTheme,
  spokjakten: spokjaktenTheme,
  gruvan: gruvanTheme,
};
