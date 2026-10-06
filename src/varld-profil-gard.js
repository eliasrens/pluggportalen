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
// Levande (F4b-semantiken, se varld-profil-standard.js):
//   ambient  de promenerande bondgårdsdjuren (gard-djur.js skriver left/top
//            varje frame och växlar .promenerar/.vand-vanster), den pulserande
//            skördeklara grödan (.odling-klar, opacitet) och 🎁-guppet
//            (.fdjur-gava). Deras mutationer smutsar inte lagret; vid handoff
//            fryses de (WAAPI, promenaden sover via closest(".varld-pixi-vilar"))
//            och BAKAS IN i basen i rätt z-ordning. Hagens djur MÅSTE vara
//            ambient: staketets framkant (.gard-forgrund) ligger ÖVER dem.
//   sprites  bara ladans djur (#laggard-lager .gard-djur): ingenting ligger över
//            dem i laggården (ingen forgrund, ingen trädgård), och de är det
//            enda levande där – så laggårdens bas behöver aldrig speglas om vid
//            handoff, bara djuren (frusen pose, med 🎁 och namnskylt) som egna
//            sprites ovanpå.
// Efter rörelsen fortsätter allt där det stod, utan hopp (varld-gard.js låter
// dessutom djur-/odlingsomritningen landa FÖRE rörelsen, så noderna aldrig
// byts mitt i handoffen).
//
// Objekt (fokus-överlägg): laggårdsdörren (hover/fokus = scale(1.04)) och
// odlingsrutorna (hover = grödan lyfts 2 px). Inget i gård-lagret ligger
// över dem (hagen och staketet står mellan bädden och ladan).
// Ignoreras: matningens hjärt-puff (.foder-hjarta, ~1 s engångs-FX). Den ska
// inte frysas mitt i luften under en resa.
// Mål: dörren bär data-fokus-x/y/-lager (varld-gard.js) = gårdskamerans
// T8-fokus + laggård-lagret, så T8 förvärms vid hover/fokus även när budgeten
// (maxPar) inte räcker till båda gårds-övergångarna i idle.
// Fångst "stage": gård-/laggårdsscenerna är övertecknade (xMidYMid meet +
// overflow:visible) precis som ute-scenen, så naturen runt lagret ska med.
//
// Laddas bara via import() (varld-motor-textur.js laddaProfil) och ligger
// aldrig i bootgrafen. Format: §2.4 i docs/pixi-arkitektur-396.md.
// ============================================================================

export default {
  id: "gard",
  ambient: [".gard-djur", ".odling-klar", ".fdjur-gava"],
  sprites: ["#laggard-lager .gard-djur"],
  objekt: ["#laggard-dorr", ".odling-slot"],
  ignorera: [".foder-hjarta"],
  malSelektor: "#laggard-dorr[data-fokus-x]",
  fangst: "stage",
};
