// ============================================================================
// Pluggportalen – math-generator/plugin-manager.js  (INTERN modul-del)
// ----------------------------------------------------------------------------
// Portad från klassrummattes js/plugins/PluginManager.js. Central registret som
// varje plugin registrerar sig i (register(new XxxPlugin()) i slutet av sin fil).
// Lever helt inuti math-generator – inga globaler läcker ut.
// ============================================================================

const registry = new Map();

export const PluginManager = {
  register(plugin) {
    registry.set(plugin.type, plugin);
  },
  get(type) {
    return registry.get(type) || null;
  },
  getAll() {
    return [...registry.values()];
  },
};
