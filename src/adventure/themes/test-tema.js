// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/test-tema.js
// ----------------------------------------------------------------------------
// Ett MINIMALT test-tema som bevisar att motorn (engine.js) är tema-agnostisk:
// ren data + en handfull strängar, ingen motorkod. Används för att verifiera hela
// kedjan i preview (avatar går → station → fråga → rätt räknas → slutmål →
// belöning). Riktiga teman (skog/rymd/…) läggs till som fler filer här enligt
// samma gränssnitt – se docs/ADVENTURE-ENGINE-PLAN.md §3.3.
//
// TEMA-CONFIG-GRÄNSSNITTET (allt tema-specifikt bor här; motorn läser bara detta):
//   id             string   – unikt tema-id (blir mode "aventyr:<id>" i belöningen)
//   namn           string   – visningsnamn (intro-rubrik)
//   stamning       {himmel, mark} – bakgrundsfärger (CSS-variabler på scenen)
//   map            string[] – ASCII-grid: '#' vägg, '.' golv, 'S' start,
//                             '?' station, 'M' mål (se grid.js DEFAULT_LEGEND)
//   legend?        {char:type} – valfri egen teckenuppsättning
//   goal?          number   – antal rätt som krävs (default = antal stationer)
//   progressIcon   string   – ikon i framstegsräknaren (x/10)
//   stationArt?    () => htmlString – stationsmarkör (default progressIcon)
//   goalArt?       () => htmlString – slutmålets grafik (default 🏆)
//   tileArt?       {floor,wall,void,...}: (tile) => htmlString – valfri tile-grafik
//   avatarScale?   number   – avatarens font-size i cqw (default ~1 ruta)
//   texter         {intro, stationPrompt, stationTitle, goalPrompt, klart}
//   questionKinds  string[] – frågekällor stationerna drar från: quiz|lasforstaelse|para
// ============================================================================

import { THEMES as REAL_THEMES } from "./index.js";

export const testTheme = {
  id: "test",
  namn: "Testbanan",
  stamning: { himmel: "#cdeafd", mark: "#9ad07b" },
  map: [
    "############",
    "#S.........#",
    "#..?..##...#",
    "#.....##.?.#",
    "#..#.......#",
    "#..#.?..M..#",
    "#......#...#",
    "#.?........#",
    "############",
  ],
  // goal utelämnas medvetet → motorn använder antal stationer (4) som mål, så
  // preview går snabbt att spela igenom. Ett riktigt tema sätter t.ex. goal: 10.
  progressIcon: "⭐",
  stationArt: () => "❓",
  goalArt: () => "🏆",
  texter: {
    intro: "Öva-banan! Gå fram till varje ❓ och svara rätt. När alla är klara dyker skatten 🏆 upp – gå dit för att avsluta.",
    stationPrompt: "En kunskapsstation! Tryck E (eller mellanslag) för att svara.",
    stationTitle: "Kunskapsstation",
    goalPrompt: "Skatten är framme! Tryck E för att hämta belöningen 🎉",
    klart: "Du klarade testbanan! 🎉",
  },
  questionKinds: ["quiz", "lasforstaelse", "para"],
};

/** Test-routens temaregister: test-banan + de tre RIKTIGA temana (från det
 *  gemensamma produktionsregistret themes/index.js, så listan har EN källa till
 *  sanning). Elevens kort/route använder index.js direkt – test-temat saknar
 *  `oversikt` och syns därför aldrig som kort. Nya riktiga teman läggs till i
 *  index.js, inte här. */
export const THEMES = {
  test: testTheme,
  ...REAL_THEMES,
};
