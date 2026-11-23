// ============================================================================
// Pluggporten – 🎄 Jul-fliken i butiken (#910, epic #906)
// ----------------------------------------------------------------------------
// En samlingsflik (samling-butik.js), exakt som 🎃 Halloween: syns BARA när Jul
// är på (TILLAGG "jul", season.js) och ritas om live när slutdatumet passerar.
// Undergrupperna i Halloweens ordning; E (kostymer/avatarer) och F (djur)
// fyller dem – kostymerna läggs sist med registreraUndergrupp, som Halloween.
// Laddas bara med import() (#271).
// ============================================================================

import { skapaSamlingsFlik, standardUndergrupper } from "../samling-butik.js";

export const JUL = "jul";

export const JUL_SAMLING = skapaSamlingsFlik({
  samling: JUL,
  flik: {
    name: "Jul",
    emoji: "🎄",
    hint: "Bara under julen! Allt du köper här behåller du och kan använda för alltid – även när julen är slut.",
  },
  slutText: "Julen är slut för i år – sakerna kommer tillbaka nästa jul!",
  undergrupper: standardUndergrupper({
    inne: "🕯️ Dekor och möbler", tradgard: "⛄ Trädgård", hus: "🏠 Hus", djur: "🦌 Djur", avatarer: "🎅 Avatarer",
  }),
});
