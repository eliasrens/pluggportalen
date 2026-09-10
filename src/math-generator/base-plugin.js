// ============================================================================
// Pluggportalen – math-generator/base-plugin.js  (INTERN modul-del)
// ----------------------------------------------------------------------------
// Portad från klassrummattes js/plugins/BasePlugin.js. Bara den RENA beräknings-
// ytan behålls (generate + isSameProblem). Render-/DOM-metoderna (render,
// showAnswer, hasBildstodSupport, buildBildstod) portas INTE – adaptern är ren
// beräkning in→ut, utan DOM.
// ============================================================================

export class BasePlugin {
  constructor() {
    this.type = ""; // Måste sättas i varje subklass
  }

  // Generera ett problem-objekt utifrån ett settings-snapshot.
  generate(settings) {
    return null;
  }

  // Kontrollera om två problem är identiska (upprepningsskydd).
  isSameProblem(a, b) {
    return false;
  }
}
