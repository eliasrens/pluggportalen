// ============================================================================
// Prov (#738) – frågetypen "fritext": eleven skriver ett längre svar (högst
// 4000 tecken, med teckenräknare). Inget facit – läraren rättar alltid.
// Valfritt `bedomningsstod` (exempelsvar, vad som krävs) som BARA läraren ser:
// det hamnar i provTillfallen/{t}/privat/facit.bedomningsstod, aldrig hos eleven.
// ============================================================================

import { GRANS, elevFalt, klipp, tecken, valideraGemensamt } from "./delat.js";
import { elevKontext, h, textFalt } from "../prov-vy.js";

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

  /** Elevens svarsruta (#740): ett längre svar med teckenräknare. */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    const max = f.maxTecken || GRANS.fritext;
    const raknare = h("div", { class: "provv-raknare", "aria-live": "off" });
    const visa = (v) => {
      const n = tecken(v);
      raknare.textContent = `${n} / ${max} tecken`;
      raknare.classList.toggle("provv-raknare-nara", n > max * 0.9);
    };
    const falt = textFalt("textarea", {
      class: "provv-fritext", rows: "8", varde: typeof k.svar === "string" ? k.svar : "", max, "aria-label": "Ditt svar",
      k: { ...k, andra: (v) => { visa(v); k.andra(v); } },
    });
    visa(falt.value);
    return h("div", {}, falt, raknare);
  },
};
