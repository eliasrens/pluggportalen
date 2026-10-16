// ============================================================================
// Prov (#738) – "text": INGEN fråga, ett textblock (läsförståelse, en källa)
// som frågorna efter refererar till. Har `titel` och `brodtext` i stället för
// `fraga`, ingen poäng, får inget nummer och räknas aldrig som obesvarad.
// ============================================================================

import { GRANS, tecken, trimmad, valideraGemensamt } from "./delat.js";

export default {
  id: "text",
  namn: "Textblock",
  ikon: "📄",
  beskrivning: "Ingen fråga – en text som frågorna efter handlar om.",
  autoratt: false,
  arFraga: false,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f, { arFraga: false });
    const titel = trimmad(f.titel);
    const brodtext = trimmad(f.brodtext);
    if (tecken(titel) > GRANS.titel) fel.push(`titeln är för lång (högst ${GRANS.titel} tecken)`);
    if (!brodtext) fel.push('texten ("brodtext") saknas eller är tom');
    else if (tecken(brodtext) > GRANS.textblock) fel.push(`texten är för lång (högst ${GRANS.textblock} tecken)`);
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "text", titel, brodtext } };
  },

  facit: () => null,
  utanFacit: (f) => ({ id: f.id, typ: "text", titel: f.titel, brodtext: f.brodtext }),
  tomtSvar: () => null,
  arBesvarad: () => true,
  rensaSvar: () => null,
  forslag: () => null,
};
