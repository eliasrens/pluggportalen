// ============================================================================
// Prov (#762, spec §2.1/§2.3) – "avsnitt": INGEN fråga, en rubrik som delar in
// provet ("Del 1 – Begrepp") med en valfri instruktion till eleven. Har
// `titel` och `instruktion` i stället för `fraga`: ingen poäng, inget svar,
// inget nummer – frågorna numreras löpande genom hela provet. Grupperingen per
// avsnitt (elevens frågelista, redigerarens summor, rättning och statistik)
// går via avsnittsGrupper(fragor) i prov-modell.js.
// ============================================================================

import { GRANS, tecken, trimmad, valideraGemensamt } from "./delat.js";
import { h, stycken } from "../prov-vy.js";
import { svarsVyer } from "../prov-svar-vy.js";

export default {
  id: "avsnitt",
  namn: "Avsnitt",
  ikon: "🔖",
  beskrivning: "Ingen fråga – en rubrik som delar in provet i delar.",
  autoratt: false,
  arFraga: false,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f, { arFraga: false });
    const titel = trimmad(f.titel);
    const instruktion = trimmad(f.instruktion);
    if (!titel) fel.push('rubriken ("titel") saknas eller är tom');
    else if (tecken(titel) > GRANS.titel) fel.push(`rubriken är för lång (högst ${GRANS.titel} tecken)`);
    if (tecken(instruktion) > GRANS.instruktion) fel.push(`instruktionen är för lång (högst ${GRANS.instruktion} tecken)`);
    const out = { ...value, typ: "avsnitt", titel };
    if (instruktion) out.instruktion = instruktion;
    return { ok: !fel.length, fel, varningar, value: out };
  },

  facit: () => null,
  utanFacit: (f) => ({ id: f.id, typ: "avsnitt", titel: f.titel, ...(f.instruktion ? { instruktion: f.instruktion } : {}) }),
  tomtSvar: () => null,
  arBesvarad: () => true,
  rensaSvar: () => null,
  forslag: () => null,

  facitText: () => "",
  // Efter provet: samma rubrik i rättnings- och resultatvyn.
  ...svarsVyer((f) => avsnittRubrik(f)),

  /** Rubriken som eleven ser (#762) – inget nummer, inget svar. */
  renderElev(f) {
    return avsnittRubrik(f);
  },
};

function avsnittRubrik(f) {
  return h("div", { class: "provv-avsnitt-inre" },
    h("h2", { class: "provv-avsnitt-titel", text: f.titel || "Avsnitt" }),
    f.instruktion ? stycken(f.instruktion, "provv-avsnitt-instruktion") : null);
}
