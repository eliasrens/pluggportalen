// ============================================================================
// Matte­generator – BasePlugin (INTERN modul, issue #295)
// ----------------------------------------------------------------------------
// Gemensam basklass för de portade klassrummatte-pluginsen. Bara generate()
// (ren beräkning) portas – render/showAnswer/isSameProblem/buildBildstod var
// DOM och ingår inte i sömmen. Egen liten fil så plugin-kategorimodulerna kan
// dela den utan att importera plugins.js (undviker cirkulär import).
//
// Privat bakom src/matte-generator.js.
// ============================================================================

export class BasePlugin {
  constructor() { this.type = ''; }
  generate(settings) { return null; }
}
