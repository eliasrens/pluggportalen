// ============================================================================
// Prov (#738): exempelfrågor – en giltig fråga per typ och vad som är facit i
// den (söks i utanFacit). Delas av test/prov-fragetyper.test.js och
// test/prov-grund.test.js. Ny frågetyp ⇒ ett exempel här.
// ============================================================================

import assert from "node:assert/strict";
import { fragetyp } from "../../src/prov/prov-fragetyper.js";

export const EXEMPEL = {
  flerval: { f: { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Öland"], ratt: 0 }, hemligt: [] },
  "flerval-flera": {
    f: { id: "q2", typ: "flerval-flera", fraga: "Vilka är vikingastäder?", alternativ: ["Birka", "Hedeby", "Paris", "Rom"], ratt: [0, 1], poang: 2 },
    hemligt: [],
  },
  santfalskt: { f: { id: "q3", typ: "santfalskt", fraga: "Vikingar hade horn på hjälmarna.", ratt: false }, hemligt: [] },
  kortsvar: { f: { id: "q4", typ: "kortsvar", fraga: "Vad hette handelsstaden?", godkanda: ["Birka", "Björkö"] }, hemligt: ["Birka", "Björkö"] },
  lucktext: {
    f: { id: "q5", typ: "lucktext", fraga: "Fyll i.", lucktext: "Vikingarna seglade till [[Miklagård|Konstantinopel]] och [[Bagdad]].", poang: 2 },
    hemligt: ["Miklagård", "Konstantinopel", "Bagdad", "[["],
  },
  para: {
    f: {
      id: "q6", typ: "para", fraga: "Para ihop.", poang: 3,
      par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }],
    },
    hemligt: [],
  },
  ordna: { f: { id: "q7", typ: "ordna", fraga: "Sätt i tidsordning.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 4 }, hemligt: [] },
  fritext: { f: { id: "q8", typ: "fritext", fraga: "Beskriv livet på en gård.", poang: 4, bedomningsstod: "Nämner djur, hus och arbete" }, hemligt: ["Nämner djur, hus och arbete"] },
  text: { f: { id: "t1", typ: "text", titel: "Birka", brodtext: "Birka var en handelsstad på Björkö." }, hemligt: [] },
};
export const giltig = (id) => {
  const r = fragetyp(id).validera(structuredClone(EXEMPEL[id].f));
  assert.ok(r.ok, `${id}: ${r.fel.join("; ")}`);
  return r.value;
};
export const elevFraga = (id) => fragetyp(id).utanFacit(giltig(id));
export const forslag = (id, svar) => {
  const f = giltig(id);
  const t = fragetyp(id);
  return t.forslag(svar, t.facit(f), t.utanFacit(f));
};
