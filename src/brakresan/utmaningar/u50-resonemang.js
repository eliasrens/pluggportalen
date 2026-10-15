// ============================================================================
// 50. Mästarkluringarna – felaktigt resonemang (utmaningar/u50-resonemang.js) · #712 G
// ----------------------------------------------------------------------------
// Familjen "felresonemang": en person räknar – ibland rätt, oftast med en
// vanlig missuppfattning. Eleven väljer om personen har rätt och skriver det
// rätta svaret. Varje mall: gen(rng), text(params) (resonemanget), ratt,
// svar(params) (rätt värde), pastar(params) (personens värde), varfor.
// ============================================================================

import { q, add, sub, gcd } from "../math/index.js";
import { text, blandatSvar, nd, kr } from "./delat-g.js";
import { NAMN, bt, tal, heltal, NUM, INT, valDel, svarDel } from "./u50-delat.js";

// 9. Felaktigt (eller riktigt) resonemang: har personen rätt? + rätt svar.
export const RESONEMANG = {
  addnamn: {
    gen: (rng) => { const n = rng.pick([3, 4, 5, 6, 8]); const a = rng.int(1, n - 2); return { n, a, b: rng.int(1, n - 1 - a) }; },
    text: ({ a, b, n }) => `${a}/${n} + ${b}/${n} = ${a + b}/${2 * n}`, ratt: false,
    svar: ({ a, b, n }) => q(a + b, n), pastar: ({ a, b, n }) => q(a + b, 2 * n), varfor: "Delarna har samma storlek – bara antalet delar läggs ihop, inte nämnarna.",
  },
  procentav: {
    gen: (rng) => { const p = rng.pick([10, 20, 25, 50]); return { p, N: (100 / gcd(p, 100)) * rng.int(3, 9) }; }, // N ≠ 100 (då vore p rätt)
    text: ({ p, N }) => `${p} % av ${N} = ${p}`, ratt: false,
    svar: ({ p, N }) => q((p * N) / 100), pastar: ({ p }) => q(p), varfor: "Procentsiffran är inte svaret – den säger hur stor del av hela antalet.",
  },
  multbada: {
    gen: (rng) => {
      for (;;) {
        const n = rng.pick([3, 4, 5, 6, 8]);
        const k = rng.int(2, 4);
        const a = rng.pick([1, 1, 2, 3].filter((x) => x < n));
        if ((k * a) % n !== 0) return { k, a, n }; // produkten är inget heltal (svarsfältet är ett bråk)
      }
    },
    text: ({ k, a, n }) => `${k} · ${a}/${n} = ${k * a}/${k * n}`, ratt: false,
    svar: ({ k, a, n }) => q(k * a, n), pastar: ({ k, a, n }) => q(k * a, k * n), varfor: `Gånger ett heltal: antalet delar blir fler, delarnas storlek är densamma.`,
  },
  delavdel: {
    gen: (rng) => ({ ...rng.pick([[1, 2, 3, 4], [1, 2, 2, 3], [1, 3, 3, 4], [2, 3, 3, 5], [1, 4, 2, 3], [1, 2, 4, 5]]).reduce((o, v, i) => ({ ...o, [["a", "n", "b", "m"][i]]: v }), {}) }),
    text: ({ a, n, b, m }) => `${a}/${n} av ${b}/${m} = ${a * b}/${n * m}`, ratt: true,
    svar: ({ a, n, b, m }) => q(a * b, n * m), varfor: "En del av en del: delarna blir mindre, och resultatet är mindre än båda bråken.",
  },
  laning: {
    gen: (rng) => { const n = rng.pick([4, 5, 6, 8]); const x = rng.int(1, n - 2); return { W: rng.int(2, 3), x, y: rng.int(x + 1, n - 1), n }; },
    text: ({ W, x, y, n }) => `${W} ${x}/${n} − ${y}/${n} = ${W} ${y - x}/${n}`, ratt: false,
    svar: ({ W, x, y, n }) => sub(add(q(W), q(x, n)), q(y, n)), pastar: ({ W, x, y, n }) => add(q(W), q(y - x, n)), varfor: "Det räcker inte att byta plats på delarna – en hel måste brytas upp i delar först.",
  },
  rabatt: {
    gen: (rng) => { const p = rng.pick([10, 20, 25]); return { p, P: (100 / gcd(p, 100)) * rng.int(4, 30) }; },
    text: ({ p, P }) => `${kr(P)} kr med ${p} % rabatt kostar ${kr((P * p) / 100)} kr`, ratt: false,
    svar: ({ p, P }) => q(P - (P * p) / 100), pastar: ({ p, P }) => q((P * p) / 100), varfor: "Det är rabatten – priset efter rabatt är det som är kvar.",
  },
  antalav: {
    gen: (rng) => { const [a, n] = rng.pick([[3, 4], [2, 3], [2, 5], [3, 8], [5, 6]]); return { a, n, N: n * rng.int(2, 5) }; },
    text: ({ a, n, N }) => `${a}/${n} av ${N} = ${(N * a) / n}`, ratt: true,
    svar: ({ a, n, N }) => q((N * a) / n), varfor: "En del av antalet: dela i lika grupper och ta så många grupper som täljaren säger.",
  },
};
export const felresonemang = {
  gen(rng) {
    const typ = rng.pick(Object.keys(RESONEMANG));
    return { typ, ...RESONEMANG[typ].gen(rng), vem: rng.int(0, 7) };
  },
  core: ({ typ, vem, ...p }) => `${typ}:${RESONEMANG[typ].text(p)}`,
  build({ typ, vem, ...p }) {
    const R = RESONEMANG[typ];
    const S = R.svar(p);
    const x = NAMN[vem];
    const r = R.ratt ? "ja" : "nej";
    const cards = [{ id: "ja", text: `Ja, ${x} har rätt` }, { id: "nej", text: `Nej, ${x} har fel` }];
    const helt = S.d === 1;
    const svarAv = (v) => (helt ? text(v.n) : blandatSvar(v));
    return {
      prompt: `${x} räknar: ${R.text(p)}. Har ${x} rätt? Skriv det rätta svaret.`,
      values: { svar: nd(S), ratt: R.ratt },
      delar: [valDel(cards, `Har ${x} rätt?`), svarDel([{ text: "Rätt svar:" }, { input: true }, ...(typ === "rabatt" ? [{ text: "kr" }] : [])])],
      answer: { type: "multi", parts: { val: { type: "choice", options: ["ja", "nej"] }, svar: helt ? INT : NUM } },
      key: { type: "multi", parts: { val: { type: "choice", correct: r }, svar: helt ? heltal(S.n) : tal(S) } },
      display: `${R.ratt ? "Rätt" : "Fel"}: ${R.ratt ? R.text(p) : `rätt svar är ${bt(S)}${typ === "rabatt" ? " kr" : ""}`}`,
      right: [{ parts: { val: { id: r }, svar: svarAv(S) } }],
      wrong: [
        { parts: { val: { id: R.ratt ? "nej" : "ja" }, svar: svarAv(S) } },
        // Rätt bedömning men personens felaktiga värde som svar.
        ...(R.ratt ? [] : [{ parts: { val: { id: r }, svar: svarAv(R.pastar(p)) } }]),
      ],
      steg: `${R.ratt ? `${x} har rätt: ${R.text(p)}.` : `${x} har fel. Rätt: ${bt(S)}${typ === "rabatt" ? " kr" : ""}.`} ${R.varfor}`,
      helhet: "Vad är helheten i räkningen – och stämmer svaret med en bild av den?",
      andras: "Pröva resonemanget med en bild eller en rimlighetskoll. Ibland stämmer det!",
    };
  },
};

