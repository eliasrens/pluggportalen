// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/meta.js
// ----------------------------------------------------------------------------
// LÄTT metadata om äventyrsteman: bara id/namn/emoji/needs – INGEN grafik, INGEN
// DOM/avatar. Skild från det tunga produktionsregistret (index.js, som drar in
// hela SVG-konsten via theme-configarna) just för att browser-FRIA moduler ska
// kunna lista temana utan att släpa in temagrafiken.
//
// Läses av src/gamemode-visibility.js (som i sin tur importeras av validate.js och
// node-testerna) så lärarens synlighetslista kan innehålla äventyrs-temana –
// nyckelade "aventyr:<id>" där – utan att den lätta modulen blir tung.
//
//   • emoji  = temats progressIcon (kort-ikonen i översikten).
//   • needs  = temats questionKinds (vilka frågekällor stationerna drar från);
//              ett tema kan spelas om området har underlag för NÅGON av dem.
//
// Nytt tema = lägg till dess fulla config i index.js OCH en rad här. Att listorna
// hålls i synk vaktas av ett test (test/gamemode-visibility.test.js) som jämför
// mot THEMES, så en glömd rad fångas direkt.
// ============================================================================

/** @typedef {{ id: string, namn: string, emoji: string, needs: string[] }} ThemeMeta */

/** Lätt metadata för de tre riktiga temana (test-temat exkluderat, jfr index.js). */
export const ADVENTURE_THEME_META = [
  { id: "skattjakten", namn: "Skattjakten", emoji: "🗺️", needs: ["quiz", "lasforstaelse", "para"] },
  { id: "spokjakten", namn: "Spökjakten", emoji: "👻", needs: ["quiz", "lasforstaelse", "para"] },
  { id: "gruvan", namn: "Gruvan", emoji: "💎", needs: ["quiz", "lasforstaelse", "para"] },
];
