// ============================================================================
// 50. Mästarkluringarna – problemfamiljerna (utmaningar/u50-familjer.js) · #712 G
// ----------------------------------------------------------------------------
// Nio av de tio familjerna (felresonemang bor i u50-resonemang.js). Varje
// familj: gen(rng) → params, core(params), build(params) → { prompt, values,
// delar (sammansatt vy), answer, key, display, right, wrong, steg, helhet,
// andras }. u50.js sätter ihop uppgiften (hjälp, återkoppling, genomgång).
// ============================================================================

import { q, add, sub, mul, lcm, gcd, eq, cmp, formatForm, fractionWords } from "../math/index.js";
import { falt, text, blandatSvar, nd, br, formAv, kr } from "./delat-g.js";
import { NAMN, bt, tal, heltal, NUM, INT, valDel, svarDel, ettSvar } from "./u50-delat.js";

export const F = {};

// 1. Återstående bråkdel: a/n + b/m < 1, gemensam nämnare ≤ 12.
F.aterstaende = {
  gen(rng) {
    for (;;) {
      const n = rng.pick([2, 3, 4, 5, 6, 8]);
      const m = rng.pick([2, 3, 4, 6, 8, 10, 12].filter((x) => lcm(n, x) <= 12));
      const a = rng.int(1, n - 1);
      const b = rng.int(1, m - 1);
      if (gcd(a, n) !== 1 || gcd(b, m) !== 1) continue;
      if (cmp(add(q(a, n), q(b, m)), q(1)) >= 0) continue;
      return { a, n, b, m, vem: rng.int(0, 3), sak: rng.int(0, 2) };
    }
  },
  core: (p) => [`${p.a}/${p.n}`, `${p.b}/${p.m}`].sort().join("+"),
  build({ a, n, b, m, vem, sak }) {
    const S = ["pizza", "tårta", "chokladkaka"][sak];
    const x = NAMN[vem];
    const y = NAMN[vem + 4];
    const R = sub(q(1), add(q(a, n), q(b, m)));
    const L = lcm(n, m);
    return {
      prompt: `${x} äter ${a}/${n} av en ${S} och ${y} äter ${b}/${m} av samma ${S}. Hur stor del av ${S}n finns kvar?`,
      values: { R: nd(R) },
      delar: [{ view: { component: "stav", parts: L, label: `Hela ${S}n = 1 – du kan markera delar` }, verktyg: true }, svarDel([{ text: "Kvar:" }, { input: true }])],
      ...ettSvar(NUM, tal(R)),
      display: `1 − ${a}/${n} − ${b}/${m} = ${bt(R)}`,
      right: [{ parts: { svar: blandatSvar(R) } }, { parts: { svar: falt((R.n * L) / R.d, L) } }],
      wrong: [add(q(a, n), q(b, m)), sub(q(1), q(a, n)), sub(q(1), q(b, m))].filter((v, i, l) => !eq(v, R) && l.findIndex((w) => eq(w, v)) === i)
        .map((v) => ({ parts: { svar: blandatSvar(v) } })),
      steg: `Hela ${S}n är 1 = ${L}/${L}. Ätet: ${a}/${n} + ${b}/${m} = ${bt(add(q(a, n), q(b, m)))}. Kvar: 1 − ${bt(add(q(a, n), q(b, m)))} = ${bt(R)}.`,
      helhet: `Hela ${S}n är 1.`,
      andras: "Först äter två personer – sedan är frågan vad som INTE är ätet.",
    };
  },
};

// 2. Del av en del i en samling: a/n av N är röda, b/m av de röda ges bort – hur många finns kvar totalt?
F.delavdel = {
  gen(rng) {
    for (;;) {
      const N = rng.pick([12, 16, 18, 20, 24, 30, 32, 36]);
      const [a, n] = rng.pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]);
      const [b, m] = rng.pick([[1, 2], [1, 3], [2, 3], [1, 4]]);
      const rod = (N * a) / n;
      if (!Number.isInteger(rod) || !Number.isInteger((rod * b) / m)) continue;
      return { N, a, n, b, m, item: rng.pick(["kula", "knapp"]) };
    }
  },
  core: (p) => `${p.a}/${p.n}av${p.N}-${p.b}/${p.m}`,
  build({ N, a, n, b, m, item }) {
    const sak = item === "kula" ? "kulor" : "knappar";
    const rod = (N * a) / n;
    const bort = (rod * b) / m;
    const kvar = N - bort;
    return {
      prompt: `${a}/${n} av ${N} ${sak} är röda. ${b === 1 && m === 2 ? "Hälften" : `${b}/${m}`} av de röda ges bort. Hur många ${sak} finns kvar totalt?`,
      values: { rod, bort, kvar },
      delar: [{ view: { component: "mangd", count: N, item, label: `Hela samlingen = ${N} ${sak}` }, verktyg: true }, svarDel([{ text: "Kvar totalt:" }, { input: true }, { text: sak }])],
      ...ettSvar(INT, heltal(kvar)),
      display: `${a}/${n} av ${N} = ${rod} röda; ${b}/${m} av ${rod} = ${bort} ges bort; ${N} − ${bort} = ${kvar}`,
      right: [{ parts: { svar: text(kvar) } }],
      wrong: [...new Set([rod - bort, N - rod, bort])].filter((x) => x !== kvar).map((x) => ({ parts: { svar: text(x) } })),
      steg: `${a}/${n} av ${N} är ${rod} röda. ${b}/${m} av de röda är ${bort}. Kvar totalt: ${N} − ${bort} = ${kvar}.`,
      helhet: `I första steget är helheten alla ${N} ${sak}; i andra steget bara de röda.`,
      andras: "Vad händer med helheten mellan stegen? Och frågan gäller ALLA som är kvar, inte bara de röda.",
    };
  },
};

// 3. Helheten ur en del: a/n av klassen är k elever.
F.helhet = {
  gen(rng) {
    const n = rng.pick([3, 4, 5, 6, 8]);
    const a = rng.pick([...Array(n - 1).keys()].map((i) => i + 1).filter((x) => gcd(x, n) === 1));
    const N = n * rng.int(2, Math.floor(40 / n));
    return { a, n, N, sak: rng.int(0, 2) };
  },
  core: (p) => `${p.a}/${p.n}=${(p.N * p.a) / p.n}`,
  build({ a, n, N, sak }) {
    const S = [["klassen", "elever"], ["laget", "spelare"], ["kören", "sångare"]][sak];
    const k = (N * a) / n;
    const en = N / n;
    return {
      prompt: `${a}/${n} av ${S[0]} är ${k} ${S[1]}. Hur många ${S[1]} är det i hela ${S[0]}?`,
      values: { k, N },
      delar: [{ view: { component: "stav", parts: n, marked: a, label: `Hela ${S[0]} = ? ${S[1]}` } }, svarDel([{ text: `Hela ${S[0]}:` }, { input: true }, { text: S[1] }])],
      ...ettSvar(INT, heltal(N)),
      display: `${a}/${n} = ${k}, 1/${n} = ${en}, hela = ${n} · ${en} = ${N}`,
      right: [{ parts: { svar: text(N) } }],
      wrong: [...new Set([k * n, en, N - k, k + n])].filter((x) => x !== N && x > 0).map((x) => ({ parts: { svar: text(x) } })),
      steg: `${a}/${n} är ${k} ${S[1]}, så en ${fractionWords(1, n).replace("en ", "")} är ${k} ÷ ${a} = ${en}. Hela är ${n} sådana: ${n} · ${en} = ${N}.`,
      helhet: `Helheten är det som söks – bandet visar hela ${S[0]} i ${n} lika delar.`,
      andras: `Hur många är EN del av ${n}? Hur många sådana delar är hela?`,
    };
  },
};

// 4. Olika stora helheter: x får a/n av X kr, y får b/m av Y kr – den större andelen ger mindre.
F.jamfor = {
  gen(rng) {
    for (;;) {
      const [a, n] = rng.pick([[1, 4], [1, 5], [1, 3], [1, 10], [2, 5], [1, 2]]);
      const [b, m] = rng.pick([[1, 2], [3, 4], [2, 3], [1, 2], [3, 5]]);
      if (cmp(q(b, m), q(a, n)) <= 0) continue;
      const X = n * rng.int(4, 12) * (n <= 5 ? 2 : 1);
      const Y = m * rng.int(2, 8);
      const x = (X * a) / n;
      const y = (Y * b) / m;
      if (x === y || X <= Y || X > 120) continue;
      return { a, n, X, b, m, Y, vem: rng.int(0, 3) };
    }
  },
  core: (p) => `${p.a}/${p.n}av${p.X}|${p.b}/${p.m}av${p.Y}`,
  build({ a, n, X, b, m, Y, vem }) {
    const P1 = NAMN[vem];
    const P2 = NAMN[vem + 4];
    const x = (X * a) / n;
    const y = (Y * b) / m;
    const storst = x > y ? "a" : "b";
    const diff = Math.abs(x - y);
    const cards = [{ id: "a", text: `${P1} får flest` }, { id: "b", text: `${P2} får flest` }, { id: "lika", text: "De får lika mycket" }];
    const fel = storst === "a" ? "b" : "a";
    return {
      prompt: `${P1} får ${a}/${n} av ${X} kr. ${P2} får ${b}/${m} av ${Y} kr. Vem får flest kronor, och hur många kronor fler?`,
      values: { x, y, diff },
      delar: [
        { view: { component: "stav", parts: n, marked: a, label: `${P1}: hela = ${X} kr` } },
        { view: { component: "stav", parts: m, marked: b, label: `${P2}: hela = ${Y} kr` } },
        valDel(cards, "Vem får flest?"),
        svarDel([{ text: "Så många kronor fler:" }, { input: true }, { text: "kr" }]),
      ],
      answer: { type: "multi", parts: { val: { type: "choice", options: cards.map((c) => c.id) }, svar: INT } },
      key: { type: "multi", parts: { val: { type: "choice", correct: storst }, svar: heltal(diff) } },
      display: `${a}/${n} av ${X} = ${x} kr, ${b}/${m} av ${Y} = ${y} kr: ${storst === "a" ? P1 : P2} får ${diff} kr fler`,
      right: [{ parts: { val: { id: storst }, svar: text(diff) } }],
      wrong: [{ parts: { val: { id: fel }, svar: text(diff) } }, { parts: { val: { id: storst }, svar: text(diff + 1) } }, { parts: { val: { id: "lika" }, svar: text(0) } }],
      steg: `${a}/${n} av ${X} kr = ${x} kr och ${b}/${m} av ${Y} kr = ${y} kr. ${storst === "a" ? P1 : P2} får ${diff} kr fler – fast ${b}/${m} är en större andel, är ${Y} kr en mindre helhet.`,
      helhet: `Helheterna är olika stora: ${X} kr och ${Y} kr. Banden är lika långa i bilden, men de betyder olika mycket.`,
      andras: "En större andel av en mindre helhet kan bli mindre. Räkna ut båda beloppen.",
    };
  },
};

// 5. Procentdel + återstående antal.
F.procentkvar = {
  gen(rng) {
    const p = rng.pick([10, 20, 25, 50, 75]);
    const steg = 100 / gcd(p, 100);
    const N = steg * rng.int(Math.max(2, Math.ceil(12 / steg)), Math.floor(120 / steg));
    return { p, N, sak: rng.int(0, 2) };
  },
  core: (p) => `${p.p}%av${p.N}`,
  build({ p, N, sak }) {
    const S = [["påse", "godisbitar", "är röda", "röda"], ["klass", "elever", "har glasögon", "har glasögon"], ["låda", "äpplen", "är gröna", "gröna"]][sak];
    const del = (N * p) / 100;
    const kvar = N - del;
    const k = 100 / gcd(p, 100);
    return {
      prompt: `I en ${S[0]} finns ${N} ${S[1]}. ${p} % ${S[2]}. Hur många ${S[1]} är INTE ${S[3]}?`,
      values: { del, kvar },
      delar: [{ view: { component: "stav", parts: k, marked: (p * k) / 100, label: `Hela ${S[0]}n = ${N} ${S[1]} = 100 %` } }, svarDel([{ text: `Inte ${S[3]}:` }, { input: true }])],
      ...ettSvar(INT, heltal(kvar)),
      display: `${p} % av ${N} = ${del}; ${N} − ${del} = ${kvar}`,
      right: [{ parts: { svar: text(kvar) } }],
      wrong: [...new Set([del, 100 - p, N - p])].filter((x) => x !== kvar && x >= 0).map((x) => ({ parts: { svar: text(x) } })),
      steg: `${p} % av ${N} är ${del}. De som inte är det: ${N} − ${del} = ${kvar} (eller ${100 - p} % av ${N}).`,
      helhet: `Hela ${S[0]}n, ${N} ${S[1]}, är 100 %.`,
      andras: "Frågan gäller resten – inte procentdelen.",
    };
  },
};

// 6. Rabatt + budget: räcker pengarna, och hur mycket blir över eller saknas?
F.budget = {
  gen(rng) {
    const p = rng.pick([10, 20, 25, 50]);
    const steg = 100 / gcd(p, 100);
    const P = steg * rng.int(Math.ceil(60 / steg), Math.floor(600 / steg));
    const nytt = P - (P * p) / 100;
    // Budgeten: mellan nya och gamla priset (räcker tack vare rabatten), under nya priset, eller över gamla.
    const typ = rng.pick(["mellan", "under", "over"]);
    const B = typ === "mellan" ? nytt + Math.max(5, Math.round(((P - nytt) / 2) / 5) * 5) : typ === "under" ? nytt - 5 * rng.int(1, 6) : P + 5 * rng.int(1, 6);
    if (B <= 0 || B === nytt || B === P) return F.budget.gen(rng);
    return { P, p, B, vara: rng.int(0, 2), vem: rng.int(0, 7) };
  },
  core: (p) => `${p.p}%av${p.P}|${p.B}`,
  build({ P, p, B, vara, vem }) {
    const V = ["En jacka", "En skateboard", "En gitarr"][vara];
    const x = NAMN[vem];
    const rab = (P * p) / 100;
    const nytt = P - rab;
    const racker = B >= nytt;
    const belopp = Math.abs(B - nytt);
    const cards = [{ id: "ja", text: `Ja, pengarna räcker – så mycket blir över:` }, { id: "nej", text: `Nej, pengarna räcker inte – så mycket saknas:` }];
    const r = racker ? "ja" : "nej";
    const felBelopp = Math.abs(B - P);
    return {
      prompt: `${V} kostar ${kr(P)} kr men säljs med ${p} % rabatt. ${x} har ${kr(B)} kr. Räcker pengarna? Hur många kronor blir över, eller hur många saknas?`,
      values: { rab, nytt, B },
      delar: [
        { view: { component: "stav", parts: 100 / gcd(p, 100), marked: (p * (100 / gcd(p, 100))) / 100, label: `Hela priset = ${kr(P)} kr = 100 % (randigt = rabatten)` } },
        valDel(cards, "Räcker pengarna?"),
        svarDel([{ text: "Belopp:" }, { input: true }, { text: "kr" }]),
      ],
      answer: { type: "multi", parts: { val: { type: "choice", options: ["ja", "nej"] }, svar: INT } },
      key: { type: "multi", parts: { val: { type: "choice", correct: r }, svar: heltal(belopp) } },
      display: `Pris efter rabatt: ${kr(P)} − ${kr(rab)} = ${kr(nytt)} kr; ${racker ? `${kr(belopp)} kr blir över` : `${kr(belopp)} kr saknas`}`,
      right: [{ parts: { val: { id: r }, svar: text(belopp) } }],
      wrong: [{ parts: { val: { id: racker ? "nej" : "ja" }, svar: text(belopp) } }, ...(felBelopp !== belopp ? [{ parts: { val: { id: r }, svar: text(felBelopp) } }] : []), { parts: { val: { id: r }, svar: text(belopp + rab) } }]
        .filter((w, i, l) => l.findIndex((z) => JSON.stringify(z) === JSON.stringify(w)) === i && !(w.parts.val.id === r && w.parts.svar.text === String(belopp))),
      steg: `Rabatten är ${p} % av ${kr(P)} kr = ${kr(rab)} kr. Priset blir ${kr(nytt)} kr. ${x} har ${kr(B)} kr: ${racker ? `${kr(B)} − ${kr(nytt)} = ${kr(belopp)} kr över` : `${kr(nytt)} − ${kr(B)} = ${kr(belopp)} kr saknas`}.`,
      helhet: `100 % är det gamla priset, ${kr(P)} kr. Jämför pengarna med priset EFTER rabatten.`,
      andras: "Räkna ut det nya priset först, jämför sedan med pengarna.",
    };
  },
};

// 7. Blandad längdberäkning: A m och B m (plus eller minus), nämnare 2, 4, 8 eller 3, 6.
F.langd = {
  gen(rng) {
    for (;;) {
      const fam = rng.pick([[2, 4, 8], [3, 6], [2, 4], [5, 10]]);
      const n = rng.pick(fam);
      const m = rng.pick(fam);
      const A = { W: rng.int(1, 3), x: rng.int(1, n - 1), n };
      const B = { W: rng.int(0, 1), x: rng.int(1, m - 1), n: m };
      if (gcd(A.x, n) !== 1 || gcd(B.x, m) !== 1) continue;
      const op = rng.pick(["+", "−"]);
      const a = add(q(A.W), q(A.x, n));
      const b = add(q(B.W), q(B.x, m));
      const R = op === "+" ? add(a, b) : sub(a, b);
      if (R.n <= 0 || R.d === 1 || cmp(R, q(5)) > 0) continue;
      return { op, A, B };
    }
  },
  core: (p) => `${p.op}${p.A.W} ${p.A.x}/${p.A.n}|${p.B.W} ${p.B.x}/${p.B.n}`,
  build({ op, A, B }) {
    const a = add(q(A.W), q(A.x, A.n));
    const b = add(q(B.W), q(B.x, B.n));
    const R = op === "+" ? add(a, b) : sub(a, b);
    const ta = formatForm(formAv(A.W, A.x, A.n));
    const tb = formatForm(formAv(B.W, B.x, B.n));
    const L = lcm(A.n, B.n);
    const felHela = op === "+" ? add(q(A.W + B.W), q(A.x + B.x, A.n + B.n)) : sub(q(A.W), q(B.W));
    return {
      prompt: op === "+"
        ? `En bräda är ${ta} m och en annan är ${tb} m. De läggs efter varandra. Hur lång blir sträckan?`
        : `Ett rep är ${ta} m. ${NAMN[(A.x + B.x) % 8]} klipper av ${tb} m. Hur långt är repet nu?`,
      values: { R: nd(R) },
      delar: [{ view: { component: "stav", wholes: Math.min(5, Math.ceil(Math.max(a.n / a.d, R.n / R.d))), parts: L, label: "Varje stav = 1 m – du kan markera delar" }, verktyg: true }, svarDel([{ text: `${ta} ${op} ${tb} =` }, { input: true }, { text: "m" }])],
      ...ettSvar(NUM, tal(R)),
      display: `${ta} ${op} ${tb} = ${bt(R)} m`,
      right: [{ parts: { svar: blandatSvar(R) } }, { parts: { svar: falt((R.n * L) / R.d, L) } }],
      wrong: [felHela, op === "+" ? sub(a, b) : add(a, b)].filter((v) => v.n > 0 && !eq(v, R)).map((v) => ({ parts: { svar: blandatSvar(v) } })),
      steg: `Skriv delarna med samma nämnare (${L}-delar), räkna hela för sig och delar för sig, växla ${L}/${L} = 1 hel vid behov: ${ta} ${op} ${tb} = ${bt(R)} m.`,
      helhet: "Varje stav är 1 meter.",
      andras: "Räkna hela meter för sig och bråkdelarna för sig. Behöver du växla en hel?",
    };
  },
};

// 8. Måttdivision: hur många B ur A? A ≤ 3, B = b/m, A/B heltal 2–8.
F.matt = {
  gen(rng) {
    for (;;) {
      const m = rng.pick([2, 3, 4, 5, 8, 10]);
      const b = rng.pick([1, 1, 2, 3].filter((x) => x < m && gcd(x, m) === 1));
      const c = rng.int(2, 8);
      const A = mul(q(c), q(b, m));
      if (cmp(A, q(3)) > 0) continue;
      return { b, m, c, sak: rng.int(0, 2) };
    }
  },
  core: (p) => `${p.c * p.b}/${p.m}÷${p.b}/${p.m}`,
  build({ b, m, c, sak }) {
    const A = mul(q(c), q(b, m));
    const S = [["liter saft", "glas", "liter"], ["meter band", "bitar", "meter"], ["kilo mjöl", "påsar", "kilo"]][sak];
    const ta = bt(A);
    return {
      prompt: `Det finns ${ta} ${S[0]}. Hur många ${S[1]} om ${b}/${m} ${S[2]} vardera blir det?`,
      values: { A: nd(A), antal: c },
      delar: [{ view: { component: "stav", wholes: Math.ceil(A.n / A.d), parts: m, label: `Varje stav = 1 ${S[2]} – du kan markera delar` }, verktyg: true }, svarDel([br(A.n, A.d), { op: "÷" }, br(b, m), { op: "=" }, { input: true }, { text: S[1] }])],
      ...ettSvar(INT, heltal(c)),
      display: `${ta} ÷ ${b}/${m} = ${c} ${S[1]}`,
      right: [{ parts: { svar: text(c) } }],
      wrong: [...new Set([m, c * b, c + 1])].filter((x) => x !== c).map((x) => ({ parts: { svar: text(x) } })),
      steg: `${ta} = ${c * b}/${m}. Varje ${S[1].replace(/ar$|$/, "")} tar ${b}/${m}: ${c * b} ÷ ${b} = ${c}.`,
      helhet: `Varje stav är 1 ${S[2]}. Delarna är ${m}-delar.`,
      andras: `Frågan är HUR MÅNGA ${b}/${m} som ryms – inte hur stor en del blir.`,
    };
  },
};


// 10. Proportionalitet genom dubblering/halvering.
F.proportion = {
  gen(rng) {
    if (rng.chance(0.5)) {
      const st = rng.pick([2, 3, 4, 5]);
      const pris = st * rng.int(3, 15) * (rng.chance(0.5) ? 1 : 2);
      const ny = rng.pick([st * 2, st * 3].concat(st % 2 === 0 ? [st / 2] : []));
      return { typ: "pris", st, pris, ny };
    }
    const pers = rng.pick([2, 4, 6, 8]);
    const [a, n] = rng.pick([[3, 4], [1, 2], [2, 3], [1, 4], [3, 8], [5, 8], [1, 3]]);
    const ny = rng.pick([pers * 2, pers / 2]);
    return { typ: "recept", pers, a, n, ny };
  },
  core: (p) => (p.typ === "pris" ? `pris:${p.st}=${p.pris}→${p.ny}` : `recept:${p.pers}=${p.a}/${p.n}→${p.ny}`),
  build(p) {
    if (p.typ === "pris") {
      const { st, pris, ny } = p;
      const svar = (pris / st) * ny;
      const enkel = ny === 2 * st ? "dubbelt så många" : ny === 3 * st ? "tre gånger så många" : "hälften så många";
      return {
        prompt: `${st} paket kostar ${pris} kr. Hur mycket kostar ${ny} paket?`,
        values: { svar },
        delar: [{ view: { component: "stav", parts: st, label: `${st} paket = ${pris} kr` } }, svarDel([{ text: `${ny} paket:` }, { input: true }, { text: "kr" }])],
        ...ettSvar(INT, heltal(svar)),
        display: `${ny} paket är ${enkel}: ${svar} kr`,
        right: [{ parts: { svar: text(svar) } }],
        wrong: [...new Set([pris + ny, pris * ny, pris + (ny - st)])].filter((x) => x !== svar).map((x) => ({ parts: { svar: text(x) } })),
        steg: `${ny} paket är ${enkel} som ${st} paket – så priset blir ${enkel.replace("många", "mycket")}: ${svar} kr.`,
        helhet: `${st} paket kostar tillsammans ${pris} kr.`,
        andras: "Hur många gånger fler (eller färre) paket är det? Priset ändras lika många gånger.",
      };
    }
    const { pers, a, n, ny } = p;
    const S = mul(q(a, n), q(ny, pers));
    const enkel = ny === 2 * pers ? "dubbelt så mycket" : "hälften så mycket";
    return {
      prompt: `Till ${pers} personer behövs ${a}/${n} liter mjölk. Hur mycket mjölk behövs till ${ny} personer?`,
      values: { svar: nd(S) },
      delar: [{ view: { component: "stav", parts: n, marked: a, label: `Hela staven = 1 liter (${pers} personer)` } }, svarDel([{ text: `${ny} personer:` }, { input: true }, { text: "liter" }])],
      ...ettSvar(NUM, tal(S)),
      display: `${ny} personer: ${enkel} = ${bt(S)} liter`,
      right: [{ parts: { svar: blandatSvar(S) } }, ...(ny === pers / 2 ? [{ parts: { svar: falt(a, 2 * n) } }] : [{ parts: { svar: falt(2 * a, n) } }])],
      wrong: [ny === pers / 2 ? q(a, n / 2 >= 1 && n % 2 === 0 ? n / 2 : n) : q(a, 2 * n), add(q(a, n), q(1))].filter((v) => !eq(v, S)).map((v) => ({ parts: { svar: blandatSvar(v) } })),
      steg: `${ny} personer är ${ny > pers ? "dubbelt så många" : "hälften så många"} som ${pers}, så det behövs ${enkel}: ${bt(S)} liter.`,
      helhet: `${a}/${n} liter räcker till ${pers} personer.`,
      andras: "Dubbelt så många personer – dubbelt så mycket. Hälften så många – hälften så mycket. Hälften av ett bråk: fler, mindre delar.",
    };
  },
};

