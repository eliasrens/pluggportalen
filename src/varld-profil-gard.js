// ============================================================================
// Pluggporten – GÅRDS-profilen för Pixi-rörelsens spegling (#396, S5 #423)
// ----------------------------------------------------------------------------
// Gäller #gard-lager OCH #laggard-lager (data-spegel-profil="gard" i
// pages-varld.js), alltså gårds-grenens övergångar (varld-gard.js):
//   T7  hus ↔ gård      (gård = INRE roll, fokus 50 %/46 % i ute-lagret)
//   T8  gård ↔ laggård  (gård = yttre roll kring dörren 82 %/74 %, laggård = inre)
//   T9  rum → hus → gård: huvudkamerans T3 ut och sedan gårdskamerans T7, alltså
//       två Pixi-resor i följd (ensureHus väntar in den första).
//
// Levande på gården (ambient): de promenerande bondgårdsdjuren (gard-djur.js
// skriver left/top varje frame och växlar .promenerar/.vand-vanster), den
// pulserande skördeklara grödan (.odling-klar, opacitet) och 🎁-guppet
// (.fdjur-gava, fdjur-gava-gupp). Motorn fryser dem med WAAPI under rörelsen
// (varld-vila.js; promenaden sover via closest(".varld-pixi-vilar")) och bakar
// in den frusna posen. Deras mutationer smutsar alltså inte lagret, och djuren
// fortsätter efteråt där de stod, utan hopp.
//
// Objekt (fokus-överlägg): laggårdsdörren (hover/fokus = scale(1.04)), odlings-
// rutorna (hover = grödan lyfts 2 px) och gårdens trädgårdssaker.
// Ignoreras: matningens hjärt-puff (.foder-hjarta, ~1 s engångs-FX). Den ska
// inte frysas mitt i luften under en resa.
// Fångst "stage": gård-/laggårdsscenerna är övertecknade (xMidYMid meet +
// overflow:visible) precis som ute-scenen, så naturen runt lagret ska med.
//
// Laddas bara via import() (varld-motor-textur.js laddaProfil) och ligger
// aldrig i bootgrafen.
// ============================================================================

export default {
  id: "gard",
  ambient: [], // TEMP-TEST före F4b
  objekt: "#laggard-dorr, .odling-slot, .garden-item",
  ignorera: [".foder-hjarta"],
  // Dörren bär data-fokus-x/y (varld-gard.js) = gårdskamerans T8-fokus, så att
  // T8 kan förvärmas vid hover/fokus även när budgeten (maxPar) inte räcker
  // till båda gårds-övergångarna.
  malSelektor: "#laggard-dorr[data-fokus-x]",
  fangst: "stage",
};
