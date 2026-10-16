// ============================================================================
// Prov (#738) – frågetypen "kortsvar": eleven skriver ett ord, tal eller en
// kort fras (högst 100 tecken). Facit = listan med godkända svar + lärarens
// val "Exakt stavning krävs" (standard på) och "Stor och liten bokstav spelar
// roll" (standard av). Jämförelsen efter normalisering: prov-rattning.js.
// ============================================================================

import { DELVIS_STAVFEL_ANDEL, delpoang, gruppNyckel, matchaText } from "../prov-rattning.js";
import { GRANS, elevFalt, klipp, tecken, trimmad, valideraGemensamt } from "./delat.js";
import { elevKontext, h, textFalt } from "../prov-vy.js";
import { facitRad, svarsVyer, textSvar } from "../prov-svar-vy.js";

export const MAX_GODKANDA = 20;

const godkandaText = (facit) => (facit?.godkanda || []).join(" · ");
// Svaret efter provet (#741): elevens text och de godkända svaren.
const visa = (f, svar, o) => h("div", {}, textSvar(svar, o), facitRad(o, "Godkända svar", godkandaText(o.facit)));

export default {
  id: "kortsvar",
  namn: "Kort svar",
  ikon: "✏️",
  beskrivning: "Eleven skriver ett ord, ett tal eller en kort fras.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const lista = typeof f.godkanda === "string" ? [f.godkanda] : f.godkanda;
    let godkanda = [];
    if (!Array.isArray(lista)) fel.push('minst ett godkänt svar krävs ("godkanda": ["…"])');
    else {
      godkanda = [...new Set(lista.map((x) => (typeof x === "number" ? String(x) : trimmad(x))).filter(Boolean))];
      if (!godkanda.length) fel.push("minst ett godkänt svar krävs");
      if (godkanda.length > MAX_GODKANDA) fel.push(`högst ${MAX_GODKANDA} godkända svar`);
      const langa = godkanda.filter((g) => tecken(g) > GRANS.kortsvar);
      if (langa.length) fel.push(`ett godkänt svar får vara högst ${GRANS.kortsvar} tecken ("${klipp(langa[0], 30)}…")`);
    }
    for (const k of ["exaktStavning", "skiftlage"]) {
      if (f[k] !== undefined && f[k] !== null && typeof f[k] !== "boolean") fel.push(`"${k}" måste vara true eller false`);
    }
    return {
      ok: !fel.length, fel, varningar,
      value: { ...value, typ: "kortsvar", godkanda, exaktStavning: f.exaktStavning !== false, skiftlage: f.skiftlage === true },
    };
  },

  facit: (f) => ({ godkanda: [...f.godkanda], exaktStavning: f.exaktStavning, skiftlage: f.skiftlage }),
  utanFacit: (f) => elevFalt(f),
  tomtSvar: () => "",
  arBesvarad: (svar) => typeof svar === "string" && svar.trim() !== "",
  rensaSvar: (svar) => klipp(typeof svar === "string" ? svar : "", GRANS.kortsvar),

  forslag(svar, facit, f) {
    const max = f.poang;
    const m = matchaText(svar, facit.godkanda, facit);
    if (m === true) return { poang: max, maxPoang: max, ratt: true };
    if (m === "delvis") return { poang: delpoang(DELVIS_STAVFEL_ANDEL, max), maxPoang: max, ratt: "delvis" };
    return { poang: 0, maxPoang: max, ratt: false };
  },

  /** Rättningen (#741, §6.1): identiska svar efter normaliseringen hamnar i samma grupp. */
  gruppNyckel: (svar, f, facit) => gruppNyckel(svar, { skiftlage: facit?.skiftlage === true }),
  facitText: (f, facit) => godkandaText(facit),
  ...svarsVyer(visa),

  /** Elevens svarsruta (#740): ett ord, tal eller kort fras. */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    return textFalt("input", {
    type: "text", class: "provv-kortsvar", varde: typeof k.svar === "string" ? k.svar : "", max: GRANS.kortsvar, k,
    "aria-label": "Ditt svar",
  });
  },
};
