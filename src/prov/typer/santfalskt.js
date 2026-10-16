// ============================================================================
// Prov (#738) – frågetypen "santfalskt": eleven väljer Sant eller Falskt.
// Facit = true/false (`ratt`). Svar = true, false eller null.
// ============================================================================

import { elevFalt, valideraGemensamt } from "./delat.js";
import { valLista } from "../prov-vy.js";

const SANT = ["sant", "true", "ja"];
const FALSKT = ["falskt", "false", "nej"];

export default {
  id: "santfalskt",
  namn: "Sant eller falskt",
  ikon: "⚖️",
  beskrivning: "Eleven väljer Sant eller Falskt.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    let ratt = f.ratt;
    if (typeof ratt === "string") {
      const s = ratt.trim().toLowerCase();
      ratt = SANT.includes(s) ? true : FALSKT.includes(s) ? false : ratt;
    }
    if (typeof ratt !== "boolean") fel.push('"ratt" måste vara true (sant) eller false (falskt)');
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "santfalskt", ratt } };
  },

  facit: (f) => ({ ratt: f.ratt }),
  utanFacit: (f) => elevFalt(f),
  tomtSvar: () => null,
  arBesvarad: (svar) => typeof svar === "boolean",
  rensaSvar: (svar) => (typeof svar === "boolean" ? svar : null),

  forslag(svar, facit, f) {
    const max = f.poang;
    return typeof svar === "boolean" && svar === facit.ratt
      ? { poang: max, maxPoang: max, ratt: true }
      : { poang: 0, maxPoang: max, ratt: false };
  },

  /** Elevens svarsruta (#740): Sant eller Falskt. */
  renderElev: (f, k) => valLista(["Sant", "Falskt"], {
    namn: `${k.uid}-${f.id}`, etikett: "Sant eller falskt", las: k.las,
    valda: k.svar === true ? [0] : k.svar === false ? [1] : [], andra: (v) => k.andra(v[0] === 0 ? true : v[0] === 1 ? false : null), lamna: k.lamna,
  }),
};
