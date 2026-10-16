// ============================================================================
// 33. Hitta räknefelet (src/brakresan/utmaningar/u33.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 33: granska en kort elevlösning i två rader. Eleven väljer raden med
// felet (eller "Inget fel") och den förklaring som stämmer – EN uppgift med
// två obligatoriska val (multi, en poäng). Ingen fritext, ingen AI-bedömning.
// Mallar (bara samma nämnare – olika nämnare kommer i 34):
//   add     a/n + b/n = (a+b)/n, sedan förkortning.     Fel: adderar nämnarna
//           (rad 1) eller förkortar bara täljaren (rad 2).
//   sub     a/n − b/n = (a−b)/n, sedan förkortning.     Fel: drar bort b från
//           nämnaren också (rad 1) eller förkortar bara täljaren (rad 2).
//   lik     p/q = kp/kq = mp/mq.                         Fel: lägger till samma
//           tal uppe och nere (rad 1 eller rad 2).
//   jamfor  a/n och a/m har lika många delar; slutsats.   Fel: "större nämnare
//           ger större bråk" (rad 2).
// Slots: två "ratt" per omgång är helt riktiga lösningar; övriga har exakt ett
// fel. Förklaringarna är fyra påståenden (rätt + tre andra missuppfattningar
// eller "Allt stämmer") i blandad ordning – en förklaring passar bara sitt fel.
// Före/efter-stavar under varje rad (bara medan hjälpen är öppen) visar om
// mängden bevaras – "Stämmer räkningen med bilden?".
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gcd } from "../math/index.js";

const SLOTS = ["add", "lik", "sub", "jamfor", "add", "ratt", "sub", "lik", "ratt", "jamfor"];
const MALLAR = ["add", "sub", "lik", "jamfor"];

export const FORKLARINGAR = Object.freeze({
  "adderar-namnare": "Delarna är lika stora. När man lägger ihop delar ska nämnaren inte adderas – den säger hur stora delarna är.",
  "subtraherar-namnare": "Delarna har samma storlek före och efter. När man tar bort delar ska nämnaren inte ändras.",
  "forkortar-bara-taljaren": "Vid förkortning delas täljaren och nämnaren med samma tal. Här ändrades bara täljaren.",
  "additiv-forlangning": "Man får inte lägga till samma tal uppe och nere. Täljaren och nämnaren ska multipliceras med samma tal.",
  "storre-namnare-storre": "Med samma täljare ger en större nämnare mindre delar – och ett mindre bråk.",
  "inget-fel": "Allt stämmer: värdet är detsamma i varje steg, och slutsatsen stämmer med bilden.",
});
const MALL_FEL = { add: ["adderar-namnare", "forkortar-bara-taljaren"], sub: ["subtraherar-namnare", "forkortar-bara-taljaren"],
  lik: ["additiv-forlangning", "additiv-forlangning"], jamfor: [null, "storre-namnare-storre"] };

// Talpooler per mall (alla villkor uppfyllda, i fast ordning).
const ADD = [];
const SUB = [];
for (let n = 3; n <= 12; n++) {
  for (let a = 1; a < n; a++) {
    for (let b = 1; a + b <= n; b++) {
      const s = a + b;
      // Rad 2 är en förkortning både i den rätta och i den felaktiga lösningen (s/2n förkortas med 2).
      if (gcd(s, n) > 1 && s < n && s % 2 === 0) ADD.push({ a, b, n });
    }
    for (let b = 1; b < a; b++) {
      const r = a - b;
      if (gcd(r, n) > 1 && gcd(r, n - b) > 1 && r < n - b) SUB.push({ a, b, n });
    }
  }
}
const LIK = [];
for (let qq = 2; qq <= 6; qq++) for (let p = 1; p < qq; p++) if (gcd(p, qq) === 1) for (let k = 2; k <= 3; k++) for (let m = k + 1; m <= 5; m++) LIK.push({ p, q: qq, k, m });
const JAMFOR = [];
for (let a = 1; a <= 4; a++) for (let n = a + 1; n <= 12; n++) for (let m = n + 1; m <= 12; m++) JAMFOR.push({ a, n, m });
export const POOLER = { add: ADD, sub: SUB, lik: LIK, jamfor: JAMFOR };

const red = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const bars = (...v) => v.map(([n, d]) => ({ parts: d, marked: n }));

/** Lösningens två rader (text) och före/efter-stavarna, ur mall, tal och felrad (0 = inget fel). */
export function losning(mall, t, felRad) {
  if (mall === "add") {
    const { a, b, n } = t;
    const s = a + b;
    const d1 = felRad === 1 ? 2 * n : n;
    const [rn, rd] = red(s, d1);
    const rad2 = felRad === 2 ? [s / gcd(s, n), n] : [rn, rd];
    return [
      { text: `${a}/${n} + ${b}/${n} = ${s}/${d1}`, stavar: bars([a + b, n], [s, d1]) },
      { text: `${s}/${d1} = ${rad2[0]}/${rad2[1]}`, stavar: bars([s, d1], rad2) },
    ];
  }
  if (mall === "sub") {
    const { a, b, n } = t;
    const r = a - b;
    const d1 = felRad === 1 ? n - b : n;
    const [rn, rd] = red(r, d1);
    const rad2 = felRad === 2 ? [r / gcd(r, n), n] : [rn, rd];
    return [
      { text: `${a}/${n} − ${b}/${n} = ${r}/${d1}`, stavar: bars([r, n], [r, d1]) },
      { text: `${r}/${d1} = ${rad2[0]}/${rad2[1]}`, stavar: bars([r, d1], rad2) },
    ];
  }
  if (mall === "lik") {
    const { p, q: qq, k, m } = t;
    const r1 = felRad === 1 ? [p + k, qq + k] : [p * k, qq * k];
    const r2 = felRad === 1 ? [r1[0] * 2, r1[1] * 2] : felRad === 2 ? [r1[0] + (m - k), r1[1] + (m - k)] : [p * m, qq * m];
    return [
      { text: `${p}/${qq} = ${r1[0]}/${r1[1]}`, stavar: bars([p, qq], r1) },
      { text: `${r1[0]}/${r1[1]} = ${r2[0]}/${r2[1]}`, stavar: bars(r1, r2) },
    ];
  }
  const { a, n, m } = t;
  const slut = felRad === 2 ? `${a}/${n} < ${a}/${m}, eftersom ${m} är större än ${n}.` : `${a}/${n} > ${a}/${m}, eftersom ${partNamnPlural(n)} är större bitar än ${partNamnPlural(m)}.`;
  return [
    { text: `${a}/${n} och ${a}/${m} har lika många delar: ${a}.`, stavar: bars([a, n], [a, m]) },
    { text: slut, stavar: bars([a, n], [a, m]) },
  ];
}
function partNamnPlural(d) {
  const namn = { 2: "halvor", 3: "tredjedelar", 4: "fjärdedelar", 5: "femtedelar", 6: "sjättedelar", 7: "sjundedelar", 8: "åttondelar",
    9: "niondelar", 10: "tiondelar", 11: "elftedelar", 12: "tolftedelar" };
  return namn[d] || `${d}-delar`;
}

export default defineChallenge({
  id: "33",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const mall = slot === "ratt" ? rng.pick(MALLAR) : slot;
    const t = rng.pick(POOLER[mall]);
    const felRad = slot === "ratt" ? 0 : mall === "jamfor" ? 2 : rng.int(1, 2);
    const tag = felRad ? MALL_FEL[mall][felRad - 1] : "inget-fel";
    const andra = rng.sample(Object.keys(FORKLARINGAR).filter((k) => k !== tag && k !== "inget-fel"), tag === "inget-fel" ? 3 : 2);
    const forklaringar = rng.shuffle([tag, ...andra, ...(tag === "inget-fel" ? [] : ["inget-fel"])]);
    return { mall, t, felRad, forklaringar };
  },

  core: ({ mall, t, felRad }) => `${mall}:${Object.values(t).join(",")}:${felRad}`,

  build({ mall, t, felRad, forklaringar }) {
    const rader = losning(mall, t, felRad);
    const tag = felRad ? MALL_FEL[mall][felRad - 1] : "inget-fel";
    const fOpts = forklaringar.map((k, i) => ({ id: `f${i + 1}`, text: FORKLARINGAR[k], tag: k }));
    const rattF = fOpts.find((o) => o.tag === tag).id;
    const fel = fOpts.find((o) => o.tag !== tag).id;
    const steg = felRad ? `s${felRad}` : "inget";
    const andraSteg = ["s1", "s2", "inget"].filter((s) => s !== steg);
    const radText = rader.map((r, i) => `Rad ${i + 1}: ${r.text}`).join(" ");
    const facitSteg = felRad ? `Felet är på rad ${felRad}` : "Lösningen är rätt";
    const ex = mall === "add" && t.n === 4 ? 5 : 4; // hjälpens exempel får aldrig vara elevens rad
    return {
      core: `${mall}:${Object.values(t).join(",")}:${felRad}`,
      prompt: "Granska elevens lösning. Vilken rad har ett fel? Välj också den förklaring som stämmer.",
      values: { mall, felRad, rader: rader.map((r) => r.text) },
      view: {
        component: "verkstad",
        fragor: [
          {
            id: "steg", text: "Elevens lösning", stil: "rader",
            options: [...rader.map((r, i) => ({ id: `s${i + 1}`, text: r.text, etikett: `Rad ${i + 1}`, stavar: r.stavar })),
              { id: "inget", text: "Inget fel – lösningen stämmer" }],
          },
          { id: "varfor", text: "Vilken förklaring stämmer?", options: fOpts.map(({ id, text }) => ({ id, text })) },
        ],
      },
      answer: { type: "multi", parts: { steg: { type: "choice", options: ["s1", "s2", "inget"] }, varfor: { type: "choice", options: fOpts.map((o) => o.id) } } },
      key: {
        type: "multi",
        parts: { steg: { type: "choice", correct: steg }, varfor: { type: "choice", correct: rattF } },
        display: `${facitSteg}. ${FORKLARINGAR[tag]}`,
        examples: {
          right: [{ parts: { steg: { id: steg }, varfor: { id: rattF } } }],
          wrong: [
            { parts: { steg: { id: andraSteg[0] }, varfor: { id: rattF } } },
            { parts: { steg: { id: andraSteg[1] }, varfor: { id: rattF } } },
            { parts: { steg: { id: steg }, varfor: { id: fel } } },
          ],
        },
      },
      help: [
        { step: "orientering", text: "Läs lösningen rad för rad. Varje rad påstår att två saker är lika mycket – eller att det ena är större." },
        { step: "princip", text: "Stämmer räkningen med bilden? Under varje rad visas stavar för före och efter. Är det lika mycket färgat på båda?", highlight: { stavar: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: 1/${ex} + 1/${ex} = 2/${2 * ex}? Bilden visar att 2/${2 * ex} är mindre än 1/${ex} + 1/${ex}. ` +
            `Rätt är 2/${ex}: det är fortfarande ${partNamnPlural(ex)}.`,
          view: { component: "stav", bars: [{ parts: ex, marked: 2 }, { parts: 2 * ex, marked: 2 }] },
          highlight: { stavar: true },
        },
        { step: "atergang", text: "Nu provar du själv: välj den rad där bilden före och efter inte stämmer – eller Inget fel. Välj sedan förklaringen.", highlight: { stavar: true } },
      ],
      misconceptions: tag === "inget-fel" ? [] : [tag],
      feedback: {
        correct: `Ja! ${facitSteg}. ${FORKLARINGAR[tag]}`,
        wrong: `${facitSteg}. ${FORKLARINGAR[tag]}`,
      },
      review: `${radText} ${facitSteg}. ${FORKLARINGAR[tag]}`,
    };
  },

  reserve: [
    { slot: "add", params: { mall: "add", t: { a: 1, b: 3, n: 8 }, felRad: 1, forklaringar: ["inget-fel", "adderar-namnare", "storre-namnare-storre", "additiv-forlangning"] } },
    { slot: "add", params: { mall: "add", t: { a: 2, b: 2, n: 6 }, felRad: 2, forklaringar: ["forkortar-bara-taljaren", "subtraherar-namnare", "inget-fel", "adderar-namnare"] } },
    { slot: "sub", params: { mall: "sub", t: { a: 7, b: 3, n: 10 }, felRad: 2, forklaringar: ["additiv-forlangning", "inget-fel", "forkortar-bara-taljaren", "subtraherar-namnare"] } },
    { slot: "sub", params: { mall: "sub", t: { a: 8, b: 2, n: 12 }, felRad: 1, forklaringar: ["subtraherar-namnare", "adderar-namnare", "storre-namnare-storre", "inget-fel"] } },
    { slot: "lik", params: { mall: "lik", t: { p: 2, q: 3, k: 2, m: 4 }, felRad: 2, forklaringar: ["storre-namnare-storre", "additiv-forlangning", "inget-fel", "adderar-namnare"] } },
    { slot: "lik", params: { mall: "lik", t: { p: 1, q: 4, k: 3, m: 5 }, felRad: 1, forklaringar: ["inget-fel", "forkortar-bara-taljaren", "additiv-forlangning", "subtraherar-namnare"] } },
    { slot: "jamfor", params: { mall: "jamfor", t: { a: 2, n: 3, m: 5 }, felRad: 2, forklaringar: ["storre-namnare-storre", "inget-fel", "adderar-namnare", "additiv-forlangning"] } },
    { slot: "jamfor", params: { mall: "jamfor", t: { a: 1, n: 4, m: 6 }, felRad: 2, forklaringar: ["additiv-forlangning", "storre-namnare-storre", "forkortar-bara-taljaren", "inget-fel"] } },
    { slot: "ratt", params: { mall: "add", t: { a: 1, b: 1, n: 4 }, felRad: 0, forklaringar: ["adderar-namnare", "inget-fel", "additiv-forlangning", "storre-namnare-storre"] } },
    { slot: "ratt", params: { mall: "lik", t: { p: 3, q: 5, k: 2, m: 3 }, felRad: 0, forklaringar: ["subtraherar-namnare", "forkortar-bara-taljaren", "inget-fel", "storre-namnare-storre"] } },
    { slot: "ratt", params: { mall: "jamfor", t: { a: 3, n: 5, m: 8 }, felRad: 0, forklaringar: ["inget-fel", "storre-namnare-storre", "adderar-namnare", "additiv-forlangning"] } },
  ],
});
