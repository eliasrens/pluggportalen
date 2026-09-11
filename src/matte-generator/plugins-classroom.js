// ============================================================================
// Matte­generator FAS 2 (issue #295) – katalog över portade klassrummatte-plugins
// ----------------------------------------------------------------------------
// Detta är BARA en samlingspunkt: de portade generate()-klasserna bor i
// kategori-moduler (plugins-talserie / plugins-aritmetik / plugins-matt /
// plugins-visual / plugins-geometri), en fil per kohesiv grupp så ingen enskild
// fil blir en jättefil. Här slås de ihop till EN lista som plugins.js
// registrerar i den interna registryn (samma som fas 1:s add/sub/mult/div).
//
// Kontraktet varje plugin följer (se kategori-modulerna för detaljer):
//   • generate(settings) → { type, ..., text, answer } (ren beräkning, ingen DOM)
//   • FORCING: settings.variantType tvingar en specifik gren (deterministiskt)
//   • seedbart via rnd()/PluginUtils.shuffle() – aldrig Math.random()
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { TALSERIE_PLUGINS } from "./plugins-talserie.js";
import { ARITMETIK_PLUGINS } from "./plugins-aritmetik.js";
import { MATT_PLUGINS } from "./plugins-matt.js";
import { VISUAL_PLUGINS } from "./plugins-visual.js";
import { GEOMETRI_PLUGINS } from "./plugins-geometri.js";

export const CLASSROOM_PLUGINS = [
  ...TALSERIE_PLUGINS,
  ...ARITMETIK_PLUGINS,
  ...MATT_PLUGINS,
  ...VISUAL_PLUGINS,
  ...GEOMETRI_PLUGINS,
];
