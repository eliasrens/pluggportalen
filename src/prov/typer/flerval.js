// ============================================================================
// Prov (#738) – frågetypen "flerval": eleven väljer ETT av 2–6 alternativ.
// Facit = index för rätt alternativ (`ratt`). Svar = valt index eller null.
// ============================================================================

import { elevFalt, textLista, valideraGemensamt } from "./delat.js";
import { elevKontext, valLista } from "../prov-vy.js";
import { alternativ, svarsVyer } from "../prov-svar-vy.js";

// Svaret efter provet (#741): elevens val, och med facit det rätta.
const visa = (f, svar, o) => alternativ(f.alternativ, new Set(Number.isInteger(svar) ? [svar] : []), o.facit ? new Set([o.facit.ratt]) : null, o);

export default {
  id: "flerval",
  namn: "Flerval",
  ikon: "🔘",
  beskrivning: "Eleven väljer ett rätt alternativ.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const alt = textLista(f.alternativ, { namn: "alternativ", min: 2, max: 6, unika: true });
    fel.push(...alt.fel);
    const ratt = Number(f.ratt);
    if (f.ratt === undefined || f.ratt === null || f.ratt === "" || !Number.isInteger(ratt)) {
      fel.push('"ratt" (index för rätt alternativ, 0 = första) saknas');
    } else if (ratt < 0 || ratt >= alt.value.length) {
      fel.push(`"ratt" = ${ratt} pekar inte på något alternativ (0–${alt.value.length - 1})`);
    }
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "flerval", alternativ: alt.value, ratt } };
  },

  facit: (f) => ({ ratt: f.ratt }),
  utanFacit: (f) => ({ ...elevFalt(f), alternativ: [...f.alternativ] }),
  tomtSvar: () => null,
  arBesvarad: (svar) => Number.isInteger(svar),
  rensaSvar: (svar, f) => (Number.isInteger(svar) && svar >= 0 && svar < f.alternativ.length ? svar : null),

  forslag(svar, facit, f) {
    const max = f.poang;
    return Number.isInteger(svar) && svar === facit.ratt
      ? { poang: max, maxPoang: max, ratt: true }
      : { poang: 0, maxPoang: max, ratt: false };
  },

  facitText: (f, facit) => f.alternativ[facit?.ratt] ?? "",
  ...svarsVyer(visa),

  /** Elevens svarsruta (#740): ett val bland alternativen. */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    return valLista(f.alternativ, {
    namn: `${k.uid}-${f.id}`, etikett: "Välj ett alternativ", las: k.las,
    valda: Number.isInteger(k.svar) ? [k.svar] : [], andra: (v) => k.andra(v[0] ?? null), lamna: k.lamna,
  });
  },
};
