// ============================================================================
// 17. Samma täljare (src/brakresan/utmaningar/u17.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 17: större nämnare ger mindre delar av SAMMA helhet. Välj <, = eller
// > mellan a/n och a/m; i tre rundor även den korrekta förklaringen till
// bilden (två lika långa stavar med a markerade delar var).
//   • samma täljare a = 1–4, nämnare n, m > a, högst 12; enstaka likheter
//   • bilden syns i introduktionen och i förklaringsrundorna, annars i hjälpen
//   • förklaringen säger alltid "samma helhet" och "lika många delar" –
//     aldrig bara "större nämnare ger mindre bråk" (spec)
// Hjälp: dela ett lika långt band i n respektive m bitar och jämför EN bit först.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, relation, RELATION_WORDS } from "../math/index.js";
import { ord, stor, tal, jamforelseUppgift, tvaStavar } from "./delat-e.js";

const SLOTS = ["bild", "bild", "bild-forkl", "rel", "rel", "rel-lika", "bild-forkl", "rel", "bild-forkl", "rel"];
const delnamn = (d) => ord(2, d).split(" ")[1]; // "femtedelar"

function forklaringar(a, n, m, rel, ordning) {
  // Lika långa texter: längden får inte avslöja den rätta förklaringen.
  if (rel === "=") {
    return ordning.map((i) => [
      { text: "Samma helhet och lika stora delar – lika mycket.", ratt: true },
      { text: "Den ena nämnaren är större, så det bråket är större.", tag: "storre-namnare-storre-brak" },
      { text: "Täljarna är lika, men det ena är ändå större.", tag: "fel-antal" },
    ][i]);
  }
  const [s, l] = n < m ? [n, m] : [m, n]; // s = färre delar = större bitar
  return ordning.map((i) => [
    { text: `${stor(delnamn(s))} är större bitar än ${delnamn(l)}.`, ratt: true },
    { text: `${stor(delnamn(l))} är större bitar än ${delnamn(s)}.`, tag: "storre-namnare-storre-brak" },
    { text: `${stor(delnamn(s))} och ${delnamn(l)} är lika stora bitar.`, tag: "bara-taljaren" },
  ][i]);
}

export default defineChallenge({
  id: "17",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const a = rng.int(1, 4);
    const namnare = Array.from({ length: 12 - a }, (_, i) => a + 1 + i);
    let n;
    let m;
    if (slot === "rel-lika") n = m = rng.pick(namnare);
    else [n, m] = rng.sample(namnare, 2);
    return { slot, a, n, m, ordning: rng.shuffle([0, 1, 2]) };
  },

  core: ({ a, n, m }) => `${a}/${[n, m].sort((x, y) => x - y).join(",")}`,

  build({ slot, a, n, m, ordning }) {
    const A = [a, n];
    const B = [a, m];
    const rel = relation(q(a, n), q(a, m));
    const bild = slot.startsWith("bild");
    const forkl = slot.endsWith("forkl") ? forklaringar(a, n, m, rel, ordning) : null;
    const u = jamforelseUppgift({ A, B, rel, bild, forklaringar: forkl });
    const ratt = forkl?.find((f) => f.ratt);
    const [s, l] = n < m ? [n, m] : [m, n];
    const forklText = rel === "=" ? "Samma bråk: lika stora delar och lika många." : `${stor(delnamn(s))} är större bitar än ${delnamn(l)} av samma helhet. Båda har ${a === 1 ? "en bit" : `${tal(a)} bitar`}, så ${a}/${s} är störst.`;
    const ex = [3, 5].includes(n) || [3, 5].includes(m) ? [4, 6] : [3, 5];
    return {
      core: `${a}/${[n, m].sort((x, y) => x - y).join(",")}`,
      prompt: forkl ? `Jämför ${a}/${n} och ${a}/${m}. Välj tecken och förklaring.` : `Jämför ${a}/${n} och ${a}/${m}. Välj <, = eller >.`,
      values: { A: { n: a, d: n }, B: { n: a, d: m }, relation: rel },
      view: u.view,
      answer: u.answer,
      key: { ...u.key, display: `${a}/${n} ${rel} ${a}/${m}${ratt ? ` – ${ratt.text}` : ""}`, examples: u.examples },
      help: [
        { step: "orientering", text: `Båda bråken har täljaren ${a}: samma antal delar. Helheten är lika stor.` },
        {
          step: "princip",
          text: "Om samma helhet delas i fler delar blir varje del mindre. Jämför storleken på EN del först.",
          ...(bild ? {} : { view: { component: "sammansatt", delar: tvaStavar(A, B) } }),
        },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: dela två lika långa band i ${ex[0]} och ${ex[1]} bitar. En ${delnamn(ex[0]).slice(0, -2)} är större än en ${delnamn(ex[1]).slice(0, -2)}.`,
          view: { component: "stav", bars: [{ parts: ex[0], marked: 1 }, { parts: ex[1], marked: 1 }] },
        },
        { step: "atergang", text: "Nu provar du själv: vilket bråk har störst delar? Båda har lika många delar." },
      ],
      misconceptions: ["storre-namnare-storre-brak", ...(forkl ? ["bara-taljaren"] : [])],
      feedback: {
        correct: `Ja! ${a}/${n} ${rel} ${a}/${m}. ${forklText}`,
        wrong: `${a}/${n} ${rel} ${a}/${m}. ${forklText}`,
      },
      review: `${a}/${n} ${rel} ${a}/${m}: ${ord(a, n)} ${RELATION_WORDS[rel]} ${ord(a, m)}. ${forklText}`,
    };
  },

  reserve: [
    ["bild", 2, 3, 5], ["bild", 1, 4, 2], ["bild-forkl", 3, 4, 8], ["bild-forkl", 1, 6, 3], ["bild-forkl", 2, 10, 5],
    ["rel", 4, 5, 12], ["rel", 1, 9, 7], ["rel", 3, 11, 6], ["rel-lika", 2, 7, 7], ["rel-lika", 1, 5, 5], ["rel", 2, 12, 3],
  ].map(([slot, a, n, m]) => ({ slot, params: { slot, a, n, m, ordning: [2, 0, 1] } })),
});
