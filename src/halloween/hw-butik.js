// ============================================================================
// Pluggporten – 🎃 Halloween-fliken i butiken (#692, epic #689)
// ----------------------------------------------------------------------------
// En samlingsflik (samling-butik.js, generaliserad i #910): varorna har
// `collection: "halloween"` i shop-items.js; fliken syns BARA när Halloween är
// på (season.js, server-korrigerad klocka) och ritas om live när slutdatumet
// passerar. Köpta saker behålls och fungerar året runt.
//
// D (kostymer), E (avatarer), F (djur): lägg till en egen undergrupp med
// registreraUndergrupp({ id, rubrik, match }) – t.ex. från hw-konst.js.
// Laddas bara med import() (#271).
// ============================================================================

import { skapaSamlingsFlik, standardUndergrupper } from "../samling-butik.js";

export const HALLOWEEN = "halloween";

export const HALLOWEEN_SAMLING = skapaSamlingsFlik({
  samling: HALLOWEEN,
  flik: {
    name: "Halloween",
    emoji: "🎃",
    hint: "Bara under Halloween! Allt du köper här behåller och kan använda för alltid – även när Halloween är slut.",
  },
  slutText: "Halloween är slut för i år – sakerna kommer tillbaka nästa Halloween!",
  undergrupper: standardUndergrupper({
    inne: "🕯️ Dekor & möbler", tradgard: "🍂 Trädgård", hus: "🏚️ Hus", djur: "👻 Djur", avatarer: "🧛 Avatarer",
  }),
});

/** Flik-definitionen (samma form som CATEGORIES; ikonen = categorySvg("halloween")). */
export const HALLOWEEN_FLIK = HALLOWEEN_SAMLING.flik;
/** Undergrupperna i ordning. */
export const HW_UNDERGRUPPER = HALLOWEEN_SAMLING.undergrupper;
export const registreraUndergrupp = HALLOWEEN_SAMLING.registreraUndergrupp;
export const halloweenSektioner = HALLOWEEN_SAMLING.sektioner;
