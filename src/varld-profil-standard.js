// ============================================================================
// Pluggporten – STANDARDPROFILEN för Pixi-rörelsens spegling (#396, F4 #418)
// ----------------------------------------------------------------------------
// Används för varje lager vars scen-profil (data-spegel-profil →
// varld-profil-<scen>.js) saknas eller inte kan laddas. Allt i lagret räknas
// som statiskt: inga ambient-noder utelämnas ur bas-speglingen. Har lagret
// ändå levande animationer (moln, husdjur …) speglar motorn om hela lagret
// vid handoff, efter att varld-vila.js frusit dem – bilden blir då exakt, till
// priset av en kallare start. Scen-profilerna (S1–S6) gör det billigare.
//
// Formatet (§2.4 i docs/pixi-arkitektur-396.md):
//   ambient     levande noder som speglas som egna sprites (utelämnas ur basen)
//   objekt      kandidater för fokus-överlägg: hovrad/fokuserad nod speglas
//               på nytt vid handoff (t.ex. tomten i scale(1.06) man klickar på)
//   ignorera    ritas aldrig (bubblor, paneler)
//   malSelektor förvärm fokus-pyramid vid pointerenter/focusin (dynamiska mål)
//   fangst      "stage" (övertecknad natur runt lagret) | "lager"
// Laddas bara via import() – aldrig i bootgrafen.
// ============================================================================

export default {
  id: "standard",
  ambient: [],
  // Allt klickbart i scenerna är role=button/tabindex (husgrupp, klasskylt,
  // by-tomter, skyltar) – det är dem hover/fokus skalar upp.
  objekt: '[role="button"], button, a[href], [tabindex]:not([tabindex="-1"])',
  ignorera: [],
  malSelektor: null,
  fangst: "stage",
};
