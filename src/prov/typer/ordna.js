// ============================================================================
// Prov (#738) – frågetypen "ordna": eleven sätter 3–10 saker i rätt ordning
// (händelser i tid, steg i en process). Läraren skriver `saker` i RÄTT
// ordning; eleven får dem blandade (stabilt per fråge-id, aldrig i facit-
// ordning). Svar = elevens ordning som lista med texterna, [] = inte rörd.
// Delpoäng per sak på rätt plats.
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { blanda, elevFalt, textLista, valideraGemensamt } from "./delat.js";

export default {
  id: "ordna",
  namn: "Sätt i ordning",
  ikon: "🔢",
  beskrivning: "Eleven sätter saker i rätt ordning.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const saker = textLista(f.saker, { namn: "saker", min: 3, max: 10, unika: true });
    fel.push(...saker.fel.map((x) => x.replace(/^saker (\d+)/, "sak $1")));
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "ordna", saker: saker.value } };
  },

  facit: (f) => ({ ordning: [...f.saker] }),
  utanFacit: (f) => ({ ...elevFalt(f), saker: blanda(f.saker, `ordna:${f.id}`) }),
  tomtSvar: () => [],
  arBesvarad: (svar) => Array.isArray(svar) && svar.length > 0,
  /** Bara en hel omflyttning av provets saker godtas, annars "inte rörd". */
  rensaSvar(svar, f) {
    if (!Array.isArray(svar) || svar.length !== f.saker.length) return [];
    const kvar = new Set(f.saker);
    return svar.every((s) => kvar.delete(s)) ? [...svar] : [];
  },

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    const ratt = facit.ordning.filter((s, i) => lista[i] === s).length;
    return forslagAv(ratt / facit.ordning.length, f.poang);
  },
};
