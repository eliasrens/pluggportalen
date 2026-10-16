// ============================================================================
// 19. Placera på tallinjen (src/brakresan/utmaningar/u19.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §8 19: konstruera bråkets position. Eleven drar/klickar punkten på
// tallinjen 0–1 (eller flyttar den med piltangenterna) och kontrollerar.
// Rätt = punktens snäppvärde är EXAKT målvärdet (point, bedomning.js) –
// 6/8 är rätt för 3/4, aldrig pixelnärhet.
//   • nämnare 2, 3, 4, 5, 6, 8, 10; skala 0–1; snäppnät = linjens indelning
//   • slots: 3 intro (egen indelning, n ≤ 5), 3 normal (egen indelning),
//     1 likvärdig (2/4 på en linje i halvor …), 3 finare (fjärdedelar på
//     åttondelsgradering …) – spec: minst tre rundor med finare indelning
//   • bara 0 och 1 har etiketter: etiketter på strecken skulle lösa uppgiften
//     (omgångsvyn döljer dessutom bråknamnet i skärmläsarens värdetext)
// Hjälp: nollpunkten, hela sträckan, antalet lika mellanrum (räkna
// mellanrum, inte streck), ett exempel med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { fractionWords } from "../math/words.js";

const NAMNARE = [2, 3, 4, 5, 6, 8, 10];
const MAX_TICKS = 12;
const SLOTS = ["intro", "intro", "intro", "normal", "normal", "normal", "likvardig", "finare", "finare", "finare"];

/** Alla tillåtna (a, n, ticks) per sort – små listor, väljs likformigt. */
const EGNA = NAMNARE.flatMap((n) => Array.from({ length: n - 1 }, (_, i) => ({ a: i + 1, n, ticks: n })));
const FINARE = [2, 3, 4, 5, 6].flatMap((n) => {
  const out = [];
  for (let t = 2 * n; t <= MAX_TICKS; t += n) for (let a = 1; a < n; a++) out.push({ a, n, ticks: t });
  return out;
});
// Likvärdigt: oförkortat mål på en GROVARE linje (2/4 på halvor, 6/8 på fjärdedelar).
const LIKVARDIGA = NAMNARE.flatMap((n) => {
  const out = [];
  for (let a = 1; a < n; a++) {
    const r = q(a, n);
    if (r.d === n) continue;
    for (let t = r.d; t < n; t += r.d) if (n % t === 0) out.push({ a, n, ticks: t });
  }
  return out;
});
export const VARIANTER = { EGNA, FINARE, LIKVARDIGA };

const delOrd = (t) => (t === 2 ? "två lika delar" : `${t} lika delar`);

export default defineChallenge({
  id: "19",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "intro") return rng.pick(EGNA.filter((x) => x.n <= 5));
    if (slot === "normal") return rng.pick(EGNA);
    if (slot === "likvardig") return rng.pick(LIKVARDIGA);
    return rng.pick(FINARE);
  },

  core: ({ a, n, ticks }) => `${a}/${n}@${ticks}`,

  build({ a, n, ticks }) {
    const target = q(a, n);
    const steg = (target.n * ticks) / target.d; // målets streck räknat från 0
    const wrong = [];
    const lagg = (k) => {
      if (k >= 0 && k <= ticks && k !== steg && !wrong.some((w) => w.value.n === k)) wrong.push({ value: { n: k, d: ticks } });
    };
    if (ticks !== n) lagg(a); //               täljaren som antal streck på en annan indelning (3/4 → 3/8)
    lagg(steg - 1); //                          räknar streck i stället för mellanrum (börjar på 1 vid 0)
    lagg(steg + 1);
    lagg(ticks - steg); //                      räknar från fel ände
    const ex = exempel(a, n);
    const finare = ticks > n;
    const grovare = ticks < n;
    return {
      core: `${a}/${n}@${ticks}`,
      prompt: `Placera ${a}/${n} på tallinjen.`,
      values: { target: { n: target.n, d: target.d }, ticks },
      view: { component: "tallinje", min: 0, max: 1, ticks, labels: "hela", label: "Från 0 till 1 är en hel" },
      answer: { type: "point", snap: ticks, min: 0, max: 1 },
      key: {
        type: "point",
        value: { n: target.n, d: target.d },
        display: `${a}/${n} = ${steg} av ${ticks} lika mellanrum från 0`,
        examples: {
          right: [{ value: { n: steg, d: ticks } }, { value: { n: target.n, d: target.d } }],
          wrong,
        },
      },
      help: [
        { step: "orientering", text: "Sträckan från 0 till 1 är en hel. Titta var nollpunkten är och var 1 är.", highlight: { whole: true } },
        { step: "princip", text: `Linjen är delad i ${delOrd(ticks)}. Räkna mellanrummen från 0 – inte strecken.`, highlight: { count: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: för ${ex.b}/${ex.m} delas linjen i ${ex.m} lika mellanrum, och punkten ligger ${ex.b} mellanrum från 0.` +
            (finare ? " Om linjen har fler streck än nämnaren: hur många små mellanrum är en av bråkets delar?" : "") +
            (grovare ? " Om linjen har färre delar än nämnaren: kan bråket skrivas med linjens delar?" : ""),
          view: { component: "tallinje", min: 0, max: 1, ticks: ex.m, labels: "alla", points: [{ id: "ex", value: { n: ex.b, d: ex.m }, label: "★" }] },
        },
        { step: "atergang", text: "Nu provar du själv: börja på 0 och räkna mellanrummen." },
      ],
      misconceptions: ["raknar-streck", ...(finare ? ["taljare-pa-finare-gradering"] : []), ...(grovare ? ["likvardighet"] : [])],
      feedback: {
        correct: `Ja! ${fractionWords(a, n)[0].toUpperCase()}${fractionWords(a, n).slice(1)} ligger ${steg} av ${ticks} lika mellanrum från 0.`,
        wrong: `${fractionWords(a, n)[0].toUpperCase()}${fractionWords(a, n).slice(1)} är ett avstånd från 0. Räkna mellanrummen, inte strecken.`,
      },
      review: `${a}/${n}: linjen 0–1 är delad i ${ticks} lika mellanrum. ${a}/${n} = ${steg}/${ticks}, alltså ${steg} mellanrum från 0.`,
    };
  },

  reserve: [
    { slot: "intro", params: { a: 1, n: 2, ticks: 2 } },
    { slot: "intro", params: { a: 2, n: 3, ticks: 3 } },
    { slot: "intro", params: { a: 3, n: 4, ticks: 4 } },
    { slot: "intro", params: { a: 2, n: 5, ticks: 5 } },
    { slot: "normal", params: { a: 5, n: 6, ticks: 6 } },
    { slot: "normal", params: { a: 3, n: 8, ticks: 8 } },
    { slot: "normal", params: { a: 7, n: 10, ticks: 10 } },
    { slot: "likvardig", params: { a: 2, n: 4, ticks: 2 } },
    { slot: "likvardig", params: { a: 6, n: 8, ticks: 4 } },
    { slot: "likvardig", params: { a: 4, n: 10, ticks: 5 } },
    { slot: "finare", params: { a: 3, n: 4, ticks: 8 } },
    { slot: "finare", params: { a: 1, n: 2, ticks: 10 } },
    { slot: "finare", params: { a: 2, n: 3, ticks: 6 } },
    { slot: "finare", params: { a: 4, n: 5, ticks: 10 } },
  ],
});

/** Exemplet i hjälpen: en annan nämnare och ett annat värde. */
function exempel(a, n) {
  const m = n === 4 ? 5 : n === 5 ? 3 : 4;
  let b = Math.min(m - 1, Math.max(1, a));
  if (b * n === a * m) b = b === 1 ? 2 : b - 1;
  return { b, m };
}
