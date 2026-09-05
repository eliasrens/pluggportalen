// ============================================================================
// Pluggportalen – lärarsidan (teacher.js)
// ----------------------------------------------------------------------------
// Tunn entry som återexporterar lärarsidans routes. Själva implementationen
// bor i fokuserade moduler så varje fil hålls under fil-cap:
//   * teacher-shared.js   – lärarspärr, delade hjälpare, toppnav, översikt.
//   * teacher-class.js    – klassöversikt (#/larare/klass).
//   * teacher-classes.js  – klasshantering (#/larare/klasser).
//   * teacher-content.js  – innehållsinmatning + AI-promptbyggare (#/larare/innehall).
//   * teacher-students.js – elevkontohantering (#/larare/elever).
//
// Sidorna anropas från app.js router med ett `ctx` = { app, go, renderTopbar }.
// ============================================================================

export { pageLarare } from "./teacher-shared.js";
export { pageLarareKlass } from "./teacher-class.js";
// Klasshantering (#/larare/klasser) – additivt tillägg (håll separat för enkel rebase).
export { pageLarareKlasser } from "./teacher-classes.js";
export { pageLarareInnehall } from "./teacher-content.js";
export { pageLarareElever } from "./teacher-students.js";
