// ============================================================================
// Pluggporten – lärarsidan (teacher.js)
// ----------------------------------------------------------------------------
// Tunn entry som återexporterar lärarsidans routes. Själva implementationen
// bor i fokuserade moduler så varje fil hålls under fil-cap:
//   * teacher-shared.js         – lärarspärr (renderGate), delade hjälpare, toppnav.
//   * teacher-class.js          – klassens framstegsmatris (renderClassStats,
//                                 nu en 📊-expander i Klasser & elever, issue #299).
//   * teacher-classes.js        – klasser, elevkonton & statistik, enad sida (#/larare/klasser).
//   * teacher-class-accounts.js – kontoskapande/medlemshantering (hjälpmodul).
//   * teacher-content.js        – innehållsinmatning + AI-promptbyggare (#/larare/innehall).
//
// Sidorna anropas från app.js router med ett `ctx` = { app, go, renderTopbar }.
// Sedan #440 registrerar app.js lärar-routes ur flik-registryn TEACHER_TABS
// (teacher-shared.js), som laddar sidmodulerna med import(); den här barrel-
// filen behålls för bakåtkompatibla importörer (previews/verktyg).
// ============================================================================

// Klasser, elevkonton & statistik (#/larare/klasser) – den enade sidan. Gamla
// #/larare/elever OCH #/larare/klass (klassöversikt) är sammanslagna hit och
// omdirigeras i app.js; framstegsmatrisen är en 📊-expander per klasskort.
export { pageLarareKlasser } from "./teacher-classes.js";
export { pageLarareInnehall } from "./teacher-content.js";
