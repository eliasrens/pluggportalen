// ============================================================================
// Prov (#738) – frågetypen "flerval-flera": eleven kryssar ALLA rätta
// alternativ (2–8). Facit = lista med index (`ratt`, minst ett).
// Svar = lista med kryssade index. Delpoäng: (rätt kryss − fel kryss) /
// antal rätta, aldrig under 0 (§2.1).
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { elevFalt, textLista, valideraGemensamt } from "./delat.js";
import { elevKontext, h, valLista } from "../prov-vy.js";

const kryss = (svar, n) =>
  [...new Set((Array.isArray(svar) ? svar : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b);

export default {
  id: "flerval-flera",
  namn: "Flerval, flera rätt",
  ikon: "☑️",
  beskrivning: "Eleven kryssar alla rätta alternativ.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const alt = textLista(f.alternativ, { namn: "alternativ", min: 2, max: 8, unika: true });
    fel.push(...alt.fel);
    let ratt = [];
    if (!Array.isArray(f.ratt) || !f.ratt.length) {
      fel.push('"ratt" (lista med index för de rätta alternativen, 0 = första) saknas eller är tom');
    } else {
      ratt = f.ratt.map(Number);
      const utanfor = ratt.filter((i) => !Number.isInteger(i) || i < 0 || i >= alt.value.length);
      if (utanfor.length) fel.push(`"ratt" pekar på alternativ som inte finns: ${utanfor.join(", ")}`);
      ratt = [...new Set(ratt)].sort((a, b) => a - b);
      if (!utanfor.length && ratt.length === alt.value.length) varningar.push("alla alternativ är rätt");
    }
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "flerval-flera", alternativ: alt.value, ratt } };
  },

  facit: (f) => ({ ratt: [...f.ratt] }),
  utanFacit: (f) => ({ ...elevFalt(f), alternativ: [...f.alternativ] }),
  tomtSvar: () => [],
  arBesvarad: (svar) => Array.isArray(svar) && svar.length > 0,
  rensaSvar: (svar, f) => kryss(svar, f.alternativ.length),

  forslag(svar, facit, f) {
    const valda = kryss(svar, f.alternativ.length);
    const ratta = new Set(facit.ratt);
    const r = valda.filter((i) => ratta.has(i)).length;
    const fel = valda.length - r;
    return forslagAv(Math.max(0, r - fel) / ratta.size, f.poang);
  },

  /** Elevens svarsruta (#740): kryssa i alla rätta alternativ. */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    return h("div", {},
    h("p", { class: "provv-instruktion", text: "Kryssa i alla alternativ som stämmer." }),
    valLista(f.alternativ, {
      flera: true, namn: `${k.uid}-${f.id}`, etikett: "Kryssa i alla rätta alternativ", las: k.las,
      valda: Array.isArray(k.svar) ? k.svar : [], andra: (v) => k.andra(v), lamna: k.lamna,
    }));
  },
};
