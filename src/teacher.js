// ============================================================================
// Pluggportalen – lärarsidan (teacher.js)
// ----------------------------------------------------------------------------
// Tunn entry som återexporterar lärarsidans routes. Själva implementationen
// bor i fokuserade moduler så varje fil hålls under fil-cap:
//   * teacher-shared.js         – lärarspärr, delade hjälpare, toppnav, översikt.
//   * teacher-class.js          – klassöversikt (#/larare/klass).
//   * teacher-classes.js        – klasser & elevkonton, enad sida (#/larare/klasser).
//   * teacher-class-accounts.js – kontoskapande/medlemshantering (hjälpmodul).
//   * teacher-content.js        – innehållsinmatning + AI-promptbyggare (#/larare/innehall).
//
// Sidorna anropas från app.js router med ett `ctx` = { app, go, renderTopbar }.
// ============================================================================

export { pageLarare } from "./teacher-shared.js";
export { pageLarareKlass } from "./teacher-class.js";
// Klasser & elevkonton (#/larare/klasser) – den enade sidan (gamla #/larare/elever
// är sammanslagen hit och omdirigeras i app.js).
export { pageLarareKlasser } from "./teacher-classes.js";
export { pageLarareInnehall } from "./teacher-content.js";
