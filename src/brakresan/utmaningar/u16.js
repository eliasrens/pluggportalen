// ============================================================================
// 16. Samma nämnare (src/brakresan/utmaningar/u16.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 16: jämförelse när delarna är lika stora. Välj <, = eller > mellan
// a/n och b/n; i tre av tio uppgifter även en kort korrekt förklaring (båda
// delarna krävs för rätt – en uppgift, en poäng, svarstypen multi).
//   • nämnare 3–12, täljare 1–n, minst två likheter per omgång
//   • bilden (två lika långa stavar från samma start) syns i de tre
//     introduktionsuppgifterna och är frivillig i övriga: den finns i hjälpen
//   • felförklaringarna: "större nämnare" fast nämnaren är densamma, "delarna
//     är större" fast de är lika stora – enkelt språk
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, relation, RELATION_WORDS } from "../math/index.js";
import { ord, stor, jamforelseUppgift, tvaStavar } from "./delat-e.js";

const SLOTS = ["bild", "bild", "bild-lika", "rel", "rel-forkl", "rel-lika", "rel", "rel-forkl", "rel", "rel-forkl"];

/** Förklaringar: en rätt och två vanliga felresonemang, i en fast ordning ur params. */
function forklaringar(a, b, n, rel, ordning) {
  // Lika långa texter: längden får inte avslöja den rätta förklaringen.
  const [x, y] = rel === ">" ? [a, b] : [b, a];
  const lista = rel === "="
    ? [
      { text: "Lika många delar, och delarna är lika stora.", ratt: true },
      { text: "Den ena har större nämnare, så den är större.", tag: "storre-namnare" },
      { text: "Delarna i den ena är större, så den är större.", tag: "olika-delstorlek" },
    ]
    : [
      { text: `${stor(ord(x, n))} är fler lika stora delar än ${ord(y, n)}.`, ratt: true },
      { text: `${stor(ord(x, n))} har en större nämnare än ${ord(y, n)}.`, tag: "storre-namnare" },
      { text: `${stor(ord(x, n))} har större och färre delar än ${ord(y, n)}.`, tag: "olika-delstorlek" },
    ];
  return ordning.map((i) => lista[i]);
}

export default defineChallenge({
  id: "16",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const n = slot.startsWith("bild") ? rng.int(3, 8) : rng.int(3, 12);
    let a;
    let b;
    if (slot.endsWith("lika")) a = b = rng.int(1, n - 1);
    else [a, b] = rng.sample(Array.from({ length: n }, (_, i) => i + 1), 2);
    return { slot, n, a, b, ordning: rng.shuffle([0, 1, 2]) };
  },

  core: ({ n, a, b }) => `${[a, b].sort((x, y) => x - y).join(",")}/${n}`,

  build({ slot, n, a, b, ordning }) {
    const A = [a, n];
    const B = [b, n];
    const rel = relation(q(a, n), q(b, n));
    const bild = slot.startsWith("bild");
    const forkl = slot === "rel-forkl" ? forklaringar(a, b, n, rel, ordning) : null;
    const u = jamforelseUppgift({ A, B, rel, bild, forklaringar: forkl });
    const ratt = forkl?.find((f) => f.ratt);
    const forklText = rel === "=" ? `Det är lika många lika stora delar.` : `${stor(ord(Math.max(a, b), n))} är fler lika stora delar än ${ord(Math.min(a, b), n)}.`;
    const exN = n === 5 ? 6 : 5;
    return {
      core: `${[a, b].sort((x, y) => x - y).join(",")}/${n}`,
      prompt: forkl ? `Jämför ${a}/${n} och ${b}/${n}. Välj tecken och förklaring.` : `Jämför ${a}/${n} och ${b}/${n}. Välj <, = eller >.`,
      values: { A: { n: a, d: n }, B: { n: b, d: n }, relation: rel },
      view: u.view,
      answer: u.answer,
      key: { ...u.key, display: `${a}/${n} ${rel} ${b}/${n}${ratt ? ` – ${ratt.text}` : ""}`, examples: u.examples },
      help: [
        { step: "orientering", text: `Båda bråken har nämnaren ${n}: helheten är delad i ${n} lika stora delar båda gångerna.` },
        {
          step: "princip",
          text: "Delarna är lika stora. Vad skiljer? Jämför hur många delar det är.",
          ...(bild ? {} : { view: { component: "sammansatt", delar: tvaStavar(A, B) } }),
        },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: 2/${exN} och 4/${exN}. Båda är ${ord(2, exN).split(" ")[1]} av samma helhet – fyra delar är fler än två lika stora delar.`,
          view: { component: "stav", bars: [{ parts: exN, marked: 2 }, { parts: exN, marked: 4 }] },
        },
        { step: "atergang", text: "Nu provar du själv: titta på täljarna – vilket bråk har flest lika stora delar?" },
      ],
      misconceptions: forkl ? ["storre-namnare", "olika-delstorlek"] : rel === "=" ? ["likhet"] : ["jamfor-taljare"],
      feedback: {
        correct: `Ja! ${a}/${n} ${rel} ${b}/${n}. ${forklText}`,
        wrong: `${a}/${n} ${rel} ${b}/${n}. Delarna är lika stora (samma nämnare), så det som skiljer är antalet delar. ${forklText}`,
      },
      review: `${a}/${n} ${rel} ${b}/${n}: ${ord(a, n)} ${RELATION_WORDS[rel]} ${ord(b, n)}. ${forklText}`,
    };
  },

  reserve: [
    ["bild", 8, 3, 5], ["bild", 4, 3, 1], ["bild-lika", 6, 2, 2], ["rel", 10, 7, 9], ["rel", 12, 11, 5],
    ["rel-lika", 9, 4, 4], ["rel-forkl", 7, 2, 6], ["rel-forkl", 5, 4, 3], ["rel-forkl", 12, 5, 5], ["rel", 3, 1, 2],
  ].map(([slot, n, a, b]) => ({ slot, params: { slot, n, a, b, ordning: [1, 0, 2] } })),
});
