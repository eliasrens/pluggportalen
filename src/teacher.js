// ============================================================================
// Pluggportalen – lärarsidan (teacher.js)
// ----------------------------------------------------------------------------
// Tunn entry som återexporterar lärarsidans routes. Själva implementationen
// bor i fokuserade moduler så varje fil hålls under fil-cap:
//   * teacher-shared.js   – lärarspärr, delade hjälpare, toppnav, översikt.
//   * teacher-content.js  – innehållsinmatning (#/larare/innehall).
//   * teacher-prompts.js  – AI-prompter (#/larare/prompter).
//   * teacher-students.js – elevkontohantering (#/larare/elever).
//
// Sidorna anropas från app.js router med ett `ctx` = { app, go, renderTopbar }.
// ============================================================================

export { pageLarare } from "./teacher-shared.js";
export { pageLarareInnehall } from "./teacher-content.js";
export { pageLararePrompter } from "./teacher-prompts.js";
export { pageLarareElever } from "./teacher-students.js";
