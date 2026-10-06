// ============================================================================
// Pluggporten – RUM-profilen för Pixi-rörelsens spegling (#396, S4 #422)
// ----------------------------------------------------------------------------
// Gäller #rum-lager (data-spegel-profil="rum"): rummet är INRE lagret i T3
// (hus ↔ rum) och står aldrig förstorat → bilderna (spritedjurens PNG-delar)
// bäddas in i visad storlek (bildZoom 1) i stället för ~650 px-originalen.
//
// Z-ordningen i rummet (varld-rum.js renderStage, styles.css):
//   golv → fönster (med .rum-moln BAKOM spröjs/kulle) → möbler → äpplen →
//   husdjur → dörrar + rumslista (z-index --z-scen-objekt).
// sprites ritas OVANPÅ basen i DOM-ordning, så:
//   • husdjuren (mystery-djur, vanliga djur, ev. bondgårdsdjur – alla bär
//     .room-pet) är sprites: promenad-AI:n flyttar dem (left/top varje frame)
//     och deras många CSS-animationer fryses i aktuell pose vid handoff;
//   • dörrarna och rumslistan ligger över djuren i DOM:en → måste också vara
//     sprites, annars skulle ett djur framför en dörr hamna ovanpå den.
//   • molnen är INTE sprites: fönster-SVG:n ritar kullen, spröjsen och ramen
//     ovanpå dem. De är ambient – bakas in frusna i basen (som speglas om vid
//     handoff) och deras mutationer ignoreras.
//   • äpplena (Mysterymat) ligger UNDER djuren och står still (pop-in-
//     animationen är 0,32 s) → del av basen; att lägga/äta mat ska invalidera.
// Formatet: se varld-profil-standard.js (F4/F4b #428). Laddas bara via
// import() från motorn – aldrig i bootgrafen.
// ============================================================================

/** Husdjuren: mystery-djur (pages-rum-pets.js), vanliga djur (varld-rum-djur.js). */
const DJUR = ".room-pet";

export default {
  id: "rum",
  // Levande noder som bakas in frusna i basen; MutationObservern ignorerar dem.
  ambient: [".rum-moln", DJUR],
  // Utesluts ur basen och ritas som speglaNod-sprites ovanpå, i DOM-ordning.
  // Dörrarna var för sig (wrappern .rum-dorrar har ingen egen box → en
  // scenbred sprite); en dold dörr (första/sista rummet) är display:none.
  sprites: [DJUR, ".rum-dorr", ".rum-lista"],
  // Inga fokus-överlägg: rummet är inre lagret (osynligt när T3-in startar) och
  // vid T3-ut sitter pekaren på "Gå ut"-menyn i .varld-ui. Det enda med hover-
  // utseende (dörrens lyft, rumsflikarna, djurets "nyfiken") är redan sprites,
  // frusna i aktuell pose; vald möbel (.selected-ram + 🗑️) står i basen.
  objekt: null,
  // Allt i lagret syns i vila (mat-/drag-UI och paneler ligger i .varld-ui).
  ignorera: [],
  malSelektor: null,
  // Rum-boxen = hela staget (avvikande box mot övriga lager, #373) → fånga lagret.
  fangst: "lager",
  // Rummet visas aldrig förstorat (inre roll, z ≤ 1) → <img> i visad storlek × dpr.
  bildZoom: 1,
};
