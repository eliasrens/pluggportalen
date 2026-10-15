// ============================================================================
// 30. Kluriga andelar (src/brakresan/utmaningar/u30.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 30: del, andel, helhet och det som blir kvar, i två steg. Fyra
// uppgifter beräknar delen, tre det som är kvar och tre hela antalet från en
// känd del (SLOTS).
//   • förkortade andelar med nämnare 2–6, små positiva heltal – parametrarna väljs
//     baklänges (N = n·k) så att alla antal blir heltal
//   • bandmodell: ett band med n lika delar, a markerade, märkt med känt och
//     okänt ("Hela = 24 böcker" eller "Hela = ? kulor", "18 kulor" över de
//     markerade) – helheten ändras aldrig mitt i problemet
//   • svaret är ett slutantal med enheten utskriven efter rutan; ett frivilligt
//     fält för mellansteget ("En del = …") ger stöd men ingen dold poäng
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gcd } from "../math/rational.js";
import { fractionWords, partName } from "../math/words.js";
import { brak, heltal, NUMBER_INTEGER, talNyckel } from "./f-delat.js";

const MAX_N = 60;
const SLOTS = ["del", "rest", "helhet", "del", "rest", "helhet", "del", "rest", "helhet", "del"];

const SAKER = [
  { id: "bocker", flera: "böcker", del: (N, x) => `${x} av ${N} böcker lånas ut.`, helhet: (x, v) => `${x} av böckerna är lånade. Det är ${v} böcker.`, kvar: "står kvar", fick: "lånas ut" },
  { id: "kulor", flera: "kulor", del: (N, x) => `Saga har ${N} kulor och ger bort ${x} av dem.`, helhet: (x, v) => `${x} av Sagas kulor är ${v} kulor.`, kvar: "har hon kvar", fick: "ger hon bort" },
  { id: "elever", flera: "elever", del: (N, x) => `${x} av de ${N} eleverna i klassen äter lunch först.`, helhet: (x, v) => `${x} av eleverna i klassen är ${v} elever.`, kvar: "äter sedan", fick: "äter först" },
  { id: "kakor", flera: "kakor", del: (N, x) => `Det finns ${N} kakor på ett fat. ${x} av kakorna äts upp.`, helhet: (x, v) => `${x} av kakorna på fatet är ${v} kakor.`, kvar: "är kvar", fick: "äts upp" },
  { id: "kronor", flera: "kronor", del: (N, x) => `Noah har ${N} kronor och använder ${x} av pengarna.`, helhet: (x, v) => `${x} av Noahs pengar är ${v} kronor.`, kvar: "har han kvar", fick: "använder han" },
];

const ALLA = [];
for (let n = 2; n <= 6; n++) for (let a = 1; a < n; a++) if (gcd(a, n) === 1) for (let k = 2; k <= 12 && n * k <= MAX_N; k++) ALLA.push({ n, a, k });

export default defineChallenge({
  id: "30",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const pool = index < 3 ? ALLA.filter((x) => x.n <= 4 && x.n * x.k <= 24) : ALLA;
    const { n, a, k } = rng.pick(pool);
    return { typ: slot, n, a, k, sak: rng.pick(SAKER).id };
  },

  core: ({ typ, n, a, k }) => `${typ}-${a}/${n}×${k}`,

  build({ typ, n, a, k, sak }) {
    const s = SAKER.find((x) => x.id === sak);
    const N = n * k;
    const x = a * k;
    const rest = N - x;
    const andel = `${a}/${n}`;
    const del = partName(n) || "del";
    const svar = typ === "del" ? x : typ === "rest" ? rest : N;
    const text = typ === "helhet" ? `${s.helhet(andel, x)} Hur många ${s.flera} finns det totalt?`
      : `${s.del(N, andel)} Hur många ${s.flera} ${typ === "del" ? s.fick : s.kvar}?`;
    const etiketter = typ === "helhet"
      ? [{ fran: 0, till: a, text: `${x} ${s.flera}` }]
      : typ === "rest" ? [{ fran: a, till: n, text: `? ${s.flera}` }] : [{ fran: 0, till: a, text: `? ${s.flera}` }];
    // Missuppfattningar: en del i stället för flera, delen/resten förväxlade, hela antalet, ×nämnaren.
    const fel = typ === "del" ? [k, rest, N, N - k] : typ === "rest" ? [x, k, N, N - a] : [x * n, k, x + a, x];
    const ex = n === 3 ? { n: 4, a: 3, k: 5 } : { n: 3, a: 2, k: 4 };
    const enDel = `${a === 1 ? "" : `${a} delar = ${x} ${s.flera}, så `}1 del = ${k} ${s.flera}`;
    return {
      core: `${typ}-${a}/${n}×${k}`,
      prompt: text,
      values: { whole: N, fraction: { n: a, d: n }, part: x, rest },
      view: {
        component: "verkstad",
        stavar: [{
          id: "band", parts: n, marked: a, helhet: typ === "helhet" ? `Hela = ? ${s.flera}` : `Hela = ${N} ${s.flera}`,
          etiketter,
        }],
        delsteg: { text: `En del (1/${n}) =`, enhet: s.flera },
        expr: [{ input: "svar" }, { text: s.flera }],
      },
      answer: NUMBER_INTEGER,
      key: {
        ...talNyckel({ n: svar, d: 1 }),
        display: `${svar} ${s.flera}`,
        examples: { right: [heltal(svar)], wrong: [...new Set(fel.filter((v) => v !== svar && v >= 0))].map(heltal) },
      },
      help: [
        { step: "orientering", text: typ === "helhet" ? `Bandet är hela antalet, som du inte vet. De markerade ${a} delarna är ${x} ${s.flera}.` : `Bandet är alla ${N} ${s.flera}. Det är delat i ${n} lika stora delar.`, highlight: { whole: true } },
        { step: "princip", text: `Hitta en andelsgrupp först: hur mycket är en ${del}? Bygg sedan det som frågas efter – de markerade delarna, de omarkerade eller hela bandet.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} av något är ${ex.a * ex.k}. Då är en ${partName(ex.n)} ${ex.a * ex.k} ÷ ${ex.a} = ${ex.k}, ` +
            `och hela är ${ex.n} · ${ex.k} = ${ex.n * ex.k}. Kvar blir ${ex.n * ex.k} − ${ex.a * ex.k} = ${(ex.n - ex.a) * ex.k}.`,
          view: { component: "stav", parts: ex.n, marked: ex.a, label: `Hela = ${ex.n * ex.k}` },
        },
        { step: "atergang", text: "Nu provar du själv: skriv gärna en dels storlek i rutan för mellansteget först." },
      ],
      misconceptions: typ === "helhet" ? ["multiplicerar-med-namnaren", "en-del-som-helhet"] : typ === "rest" ? ["svarar-delen", "en-del-som-svar"] : ["en-del-som-svar", "svarar-resten"],
      feedback: {
        correct: `Ja! ${enDel}. ${typ === "helhet" ? `Hela är ${n} delar: ${n} · ${k} = ${N}.` : typ === "rest" ? `Kvar är ${n - a} ${n - a === 1 ? "del" : "delar"}: ${(n - a)} · ${k} = ${rest}.` : `${fractionWords(a, n)} är ${a} · ${k} = ${x}.`}`,
        wrong: `Börja med en ${del}: hur många ${s.flera} är en del av bandet? Bygg sedan svaret av sådana delar.`,
      },
      review: `${andel}: ${typ === "helhet" ? `${a} delar = ${x}, 1 del = ${x} ÷ ${a} = ${k}, hela = ${n} · ${k} = ${N}` : `1 del = ${N} ÷ ${n} = ${k}, ${typ === "rest" ? `kvar = ${n - a} · ${k} = ${rest}` : `${a} delar = ${a} · ${k} = ${x}`}`}. Svar: ${svar} ${s.flera}.`,
    };
  },

  reserve: [
    { slot: "del", params: { typ: "del", n: 3, a: 2, k: 8, sak: "bocker" } },
    { slot: "del", params: { typ: "del", n: 4, a: 3, k: 5, sak: "kulor" } },
    { slot: "del", params: { typ: "del", n: 5, a: 2, k: 6, sak: "kakor" } },
    { slot: "rest", params: { typ: "rest", n: 3, a: 2, k: 8, sak: "bocker" } },
    { slot: "rest", params: { typ: "rest", n: 4, a: 1, k: 7, sak: "kronor" } },
    { slot: "rest", params: { typ: "rest", n: 6, a: 5, k: 3, sak: "elever" } },
    { slot: "helhet", params: { typ: "helhet", n: 4, a: 3, k: 6, sak: "kulor" } },
    { slot: "helhet", params: { typ: "helhet", n: 5, a: 3, k: 4, sak: "kronor" } },
    { slot: "helhet", params: { typ: "helhet", n: 2, a: 1, k: 9, sak: "kakor" } },
    { slot: "helhet", params: { typ: "helhet", n: 6, a: 5, k: 5, sak: "bocker" } },
  ],
});
