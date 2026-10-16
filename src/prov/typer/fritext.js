// ============================================================================
// Prov (#738) – frågetypen "fritext": eleven skriver ett längre svar (högst
// 4000 tecken, med teckenräknare). Inget facit – läraren rättar alltid.
// Valfritt `bedomningsstod` (exempelsvar, vad som krävs) som BARA läraren ser:
// det hamnar i provTillfallen/{t}/privat/facit.bedomningsstod, aldrig hos eleven.
// ============================================================================

import { GRANS, elevFalt, klipp, tecken, valideraGemensamt } from "./delat.js";

export default {
  id: "fritext",
  namn: "Fritext",
  ikon: "📝",
  beskrivning: "Eleven skriver ett längre svar. Läraren rättar.",
  autoratt: false,
  maxTecken: GRANS.fritext,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const out = { ...value, typ: "fritext" };
    if (f.bedomningsstod !== undefined && f.bedomningsstod !== null && f.bedomningsstod !== "") {
      if (typeof f.bedomningsstod !== "string") fel.push('"bedomningsstod" måste vara en text');
      else if (tecken(f.bedomningsstod.trim()) > GRANS.bedomningsstod) fel.push(`bedömningsstödet är för långt (högst ${GRANS.bedomningsstod} tecken)`);
      else if (f.bedomningsstod.trim()) out.bedomningsstod = f.bedomningsstod.trim();
    }
    return { ok: !fel.length, fel, varningar, value: out };
  },

  facit: () => null,
  bedomningsstod: (f) => f.bedomningsstod || null,
  utanFacit: (f) => ({ ...elevFalt(f), maxTecken: GRANS.fritext }),
  tomtSvar: () => "",
  arBesvarad: (svar) => typeof svar === "string" && svar.trim() !== "",
  rensaSvar: (svar) => klipp(typeof svar === "string" ? svar : "", GRANS.fritext),
  forslag: () => null,
};
