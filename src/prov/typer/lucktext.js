// ============================================================================
// Prov (#738) – frågetypen "lucktext": eleven fyller i luckor i en text.
// Läraren skriver luckorna i `lucktext` som [[svar]] eller [[svar|annat svar]]
// (alla varianter godkänns). Eleven får texten som `delar`:
//   [{ t: "Sveriges huvudstad heter " }, { lucka: 0 }, { t: "." }]
// – inget svar finns kvar. Svar = lista med en sträng per lucka.
// Förslaget rättar varje lucka som ett kortsvar; delpoäng per lucka.
// ============================================================================

import { DELVIS_STAVFEL_ANDEL, forslagAv, matchaText } from "../prov-rattning.js";
import { GRANS, elevFalt, strangLista, tecken, valideraGemensamt } from "./delat.js";

const LUCKA = /\[\[([^\]]*)\]\]/g;

/** Lucktexten → { delar, luckor: [[godkända …], …] }. */
export function tolkaLucktext(lucktext) {
  const text = String(lucktext ?? "");
  const delar = [];
  const luckor = [];
  let sist = 0;
  for (const m of text.matchAll(LUCKA)) {
    if (m.index > sist) delar.push({ t: text.slice(sist, m.index) });
    delar.push({ lucka: luckor.length });
    luckor.push([...new Set(m[1].split("|").map((s) => s.trim()).filter(Boolean))]);
    sist = m.index + m[0].length;
  }
  if (sist < text.length) delar.push({ t: text.slice(sist) });
  return { delar, luckor };
}

export default {
  id: "lucktext",
  namn: "Lucktext",
  ikon: "🧩",
  beskrivning: "Eleven fyller i luckor i en text.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const text = typeof f.lucktext === "string" ? f.lucktext.trim() : "";
    const { luckor } = tolkaLucktext(text);
    if (!text) fel.push('texten med luckor ("lucktext") saknas – skriv luckorna som [[svar]] eller [[svar|annat svar]]');
    else if (tecken(text) > GRANS.lucktext) fel.push(`texten är för lång (högst ${GRANS.lucktext} tecken)`);
    else if (!luckor.length) fel.push("texten har inga luckor – skriv dem som [[svar]] eller [[svar|annat svar]]");
    else if (luckor.length > GRANS.luckor) fel.push(`högst ${GRANS.luckor} luckor (nu ${luckor.length})`);
    luckor.forEach((g, i) => {
      if (!g.length) fel.push(`lucka ${i + 1} saknar svar ([[ ]] är tom)`);
      else if (g.some((x) => tecken(x) > GRANS.kortsvar)) fel.push(`lucka ${i + 1}: ett svar får vara högst ${GRANS.kortsvar} tecken`);
    });
    if (text && /\[\[|\]\]/.test(text.replace(LUCKA, ""))) fel.push("texten har en [[ eller ]] som inte bildar en lucka");
    for (const k of ["exaktStavning", "skiftlage"]) {
      if (f[k] !== undefined && f[k] !== null && typeof f[k] !== "boolean") fel.push(`"${k}" måste vara true eller false`);
    }
    if (luckor.length > 1 && value.poang === 1) varningar.push(`${luckor.length} luckor men bara 1 poäng – delpoängen avrundas till halva poäng`);
    return {
      ok: !fel.length, fel, varningar,
      value: { ...value, typ: "lucktext", lucktext: text, exaktStavning: f.exaktStavning !== false, skiftlage: f.skiftlage === true },
    };
  },

  // Firestore tillåter inga listor i listor → en map per lucka.
  facit: (f) => ({ luckor: tolkaLucktext(f.lucktext).luckor.map((godkanda) => ({ godkanda })), exaktStavning: f.exaktStavning, skiftlage: f.skiftlage }),
  utanFacit(f) {
    const { delar, luckor } = tolkaLucktext(f.lucktext);
    return { ...elevFalt(f), delar, antalLuckor: luckor.length };
  },
  tomtSvar: (f) => Array(f.antalLuckor).fill(""),
  arBesvarad: (svar) => Array.isArray(svar) && svar.some((s) => typeof s === "string" && s.trim() !== ""),
  rensaSvar: (svar, f) => strangLista(svar, f.antalLuckor, GRANS.kortsvar),

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    let summa = 0;
    facit.luckor.forEach(({ godkanda }, i) => {
      const m = matchaText(lista[i], godkanda, facit);
      summa += m === true ? 1 : m === "delvis" ? DELVIS_STAVFEL_ANDEL : 0;
    });
    return forslagAv(facit.luckor.length ? summa / facit.luckor.length : 0, f.poang);
  },

  /** Rättningsvyn (D): förslaget per lucka – true | "delvis" | false. */
  luckResultat(svar, facit) {
    const lista = Array.isArray(svar) ? svar : [];
    return facit.luckor.map(({ godkanda }, i) => matchaText(lista[i], godkanda, facit));
  },
};
