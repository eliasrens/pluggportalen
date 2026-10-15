// ============================================================================
// 12. Hitta tre lika bråk (src/brakresan/utmaningar/u12.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §8 12 + §6 "hitta tre": sex symbolkort, exakt tre har samma värde.
//   • reducerat basbråk p/q med q = 2–6, förlängningsfaktorer 1–5,
//     presentationsnämnare högst 30
//   • de tre andra korten bygger på missuppfattningar (samma tal adderat
//     uppe och nere, bara täljaren eller nämnaren förlängd, täljaren ±1 med
//     samma nämnare …) och har tre OLIKA värden, alla skilda från målvärdet –
//     då finns ingen annan trippel (inget dolt andravärde)
//   • korten blandas, id:n k1–k6 följer visningsordningen: id, ordning och
//     utseende avslöjar aldrig vilka som hör ihop
// Hjälp: "Dela samma helhet i fler delar …", ett exempel med andra tal och
// jämförelsestavar under korten från steg 2 (highlight { stavar: true }). Stavarna
// syns BARA medan hjälpen är öppen – aldrig från början – och utan facitetikett.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, valueKey } from "../math/index.js";
import { fractionWords } from "../math/words.js";

const MAX_D = 30;

/** Reducerade basbråk p/q, q = 2–6 (äkta bråk). */
const BASER = [];
for (let qq = 2; qq <= 6; qq++) for (let p = 1; p < qq; p++) if (q(p, qq).d === qq) BASER.push([p, qq]);

const kortFraction = (n, d) => ({ kind: "fraction", n, d });

/** Distraktorernas kandidater (missuppfattningar), i en fast ordning. */
function kandidater(p, qq, faktorer) {
  const ut = [];
  const lagg = (n, d, tag) => {
    if (n >= 1 && d >= 2 && d <= MAX_D && n < d) ut.push({ n, d, tag }); // äkta bråk, som målkorten
  };
  for (const k of faktorer) {
    lagg(p * k + 1, qq * k, "samma-namnare-fel-taljare");
    lagg(p * k - 1, qq * k, "samma-namnare-fel-taljare");
    lagg(p + k, qq + k, "additiv-forlangning");
    lagg(p * k, qq, "bara-taljaren-forlangd");
    lagg(p, qq * k, "bara-namnaren-forlangd");
    lagg(p * k, qq * k + 1, "fel-namnare");
  }
  lagg(qq - p, qq, "komplement");
  return ut;
}

export default defineChallenge({
  id: "12",
  version: 1,

  generate(rng, { slot }) {
    const baser = slot === "intro" ? BASER.filter(([, qq]) => qq <= 4) : BASER;
    const [p, qq] = rng.pick(baser);
    // Intro: basbråket syns bland korten (faktor 1). Överföring: bara förlängda kort (2–5).
    const pool = slot === "intro" ? [2, 3, 4] : slot === "overforing" ? [2, 3, 4, 5] : [1, 2, 3, 4, 5];
    const faktorer = slot === "intro" ? [1, ...rng.sample(pool, 2)] : rng.sample(pool, 3);
    faktorer.sort((x, y) => x - y);
    const target = q(p, qq);
    const sett = new Set([valueKey(target)]);
    const distraktorer = [];
    for (const c of rng.shuffle(kandidater(p, qq, faktorer))) {
      const k = valueKey(q(c.n, c.d));
      if (sett.has(k) || distraktorer.some((x) => x.n === c.n && x.d === c.d)) continue;
      sett.add(k);
      distraktorer.push(c);
      if (distraktorer.length === 3) break;
    }
    const kort = [
      ...faktorer.map((k) => ({ n: p * k, d: qq * k, ratt: true })),
      ...distraktorer.map((c) => ({ n: c.n, d: c.d, tag: c.tag })),
    ];
    return { p, q: qq, faktorer, kort: rng.shuffle(kort).map((c) => ({ n: c.n, d: c.d, ...(c.ratt ? { ratt: true } : { tag: c.tag }) })) };
  },

  core: ({ p, q: qq, faktorer }) => `${p}/${qq}×${faktorer.join(",")}`,

  build({ p, q: qq, faktorer, kort }) {
    const cards = kort.map((c, i) => ({ id: `k${i + 1}`, face: kortFraction(c.n, c.d) }));
    const ratt = cards.filter((_, i) => kort[i].ratt).map((c) => c.id);
    const fel = cards.filter((_, i) => !kort[i].ratt).map((c) => c.id);
    const visa = (i) => `${kort[i].n}/${kort[i].d}`;
    const rattText = kort.map((c, i) => (c.ratt ? visa(i) : null)).filter(Boolean);
    const ex = p === 1 && qq === 3 ? [1, 4] : [1, 3]; // exemplet har ett annat värde
    return {
      core: `${p}/${qq}×${faktorer.join(",")}`,
      prompt: "Välj de tre korten som är lika mycket.",
      values: { target: { n: p, d: qq }, cards: Object.fromEntries(cards.map((c, i) => [c.id, q(kort[i].n, kort[i].d)])) },
      view: { component: "kort", cards, stavar: true },
      answer: { type: "select", count: 3, options: cards.map((c) => c.id) },
      key: {
        type: "select",
        groups: [{ ids: ratt }],
        display: rattText.join(" = "),
        examples: {
          right: [{ ids: ratt }, { ids: [...ratt].reverse() }],
          wrong: [{ ids: [ratt[0], ratt[1], fel[0]] }, { ids: fel }, { ids: [ratt[2], fel[1], fel[2]] }],
        },
      },
      help: [
        { step: "orientering", text: "Alla bråk gäller samma sorts helhet. Du letar efter tre kort som är exakt lika mycket.", highlight: { whole: true } },
        { step: "princip", text: "Dela samma helhet i fler delar. Då blir det fler markerade delar också – men lika mycket är markerat. Täljaren och nämnaren ändras lika många gånger.", highlight: { stavar: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex[0]}/${ex[1]} = ${2 * ex[0]}/${2 * ex[1]} = ${3 * ex[0]}/${3 * ex[1]}. Varje del delas i 2 eller 3 nya delar.`,
          view: { component: "stav", bars: [1, 2, 3].map((k) => ({ parts: ex[1] * k, marked: ex[0] * k })) },
          highlight: { stavar: true },
        },
        { step: "atergang", text: "Nu provar du själv: ta ett kort i taget. Gå det att få de andra genom att dela delarna lika många gånger?", highlight: { stavar: true } },
      ],
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
      feedback: {
        correct: `Ja! ${rattText.join(", ")} är alla ${fractionWords(p, qq)}: samma helhet delad i fler delar.`,
        wrong: `De tre som hör ihop är alla ${fractionWords(p, qq)}. Öppna hjälpen och jämför stavarna: är lika mycket markerat?`,
      },
      review: `${rattText.join(" = ")}${faktorer.includes(1) ? "" : ` = ${p}/${qq}`}. ` +
        "Täljare och nämnare är förlängda med samma tal. De andra korten har andra värden.",
    };
  },

  reserve: [
    [1, 2, [1, 2, 3]], [1, 3, [1, 2, 4]], [2, 3, [1, 3, 5]], [1, 4, [2, 3, 5]], [3, 4, [1, 2, 4]],
    [1, 5, [1, 3, 5]], [2, 5, [2, 3, 4]], [3, 5, [1, 2, 5]], [4, 5, [1, 2, 3]], [1, 6, [1, 2, 4]],
    [5, 6, [2, 3, 5]], [1, 2, [3, 4, 5]],
  ].map(([p, qq, faktorer]) => ({ params: reservParams(p, qq, faktorer) })),
});

/** Reservbankens uppgifter byggs med samma regler, men utan slump (fast ordning). */
function reservParams(p, qq, faktorer) {
  const target = q(p, qq);
  const sett = new Set([valueKey(target)]);
  const dis = [];
  for (const c of kandidater(p, qq, faktorer)) {
    const k = valueKey(q(c.n, c.d));
    if (sett.has(k)) continue;
    sett.add(k);
    dis.push({ n: c.n, d: c.d, tag: c.tag });
    if (dis.length === 3) break;
  }
  const r = faktorer.map((k) => ({ n: p * k, d: qq * k, ratt: true }));
  return { p, q: qq, faktorer, kort: [dis[0], r[0], dis[1], r[1], r[2], dis[2]] };
}
