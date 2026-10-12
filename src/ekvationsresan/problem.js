// ============================================================================
// Ekvationsresan – problemlösning och bildtexter (src/ekvationsresan/problem.js)
// ----------------------------------------------------------------------------
// #625, spec E2.3. Ren logik. Texterna byggs ur den GENERERADE ekvationen, så
// texten, ekvationen och svaret hänger alltid ihop (nivån styr matematiken,
// typen styr formen):
//
//   bildText(eq, theme)     D: "Två spargrisar och 3 mynt är lika mycket som 13 mynt."
//   buildProblem(task, rng) F: { mall, text, fraga, bild, val, ratt, svar }
//
// F-kedjan: VERKLIGHET → BILD → EKVATION → LÖSNING → SVAR. Frågan "Vad betyder
// x i uppgiften?" har tre meningar med SAMMA tal (x) men olika betydelse –
// eleven väljer den som stämmer. En felmening tas bort om den råkar vara sann
// (t.ex. "Det finns 3 påsar" när x = 3 och det verkligen är 3 påsar).
// ============================================================================

import { formatSv, eq as same, q, mul, add, isInteger } from "./rational.js";
import { fromJSON, coefOf } from "./equation.js";
import { themeFor } from "./vag-visning.js";

// --- svenska ---------------------------------------------------------------------

const ORD = ["noll", "en", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];

/** Ett antal saker: "en spargris", "ett mynt", "tre spargrisar", "13 mynt". `ord` = skriv 2–12 med bokstäver. */
export function antal(n, noun, { ord = false } = {}) {
  if (n === 1) return `${noun.ett ? "ett" : "en"} ${noun.sg}`;
  return `${ord && n <= 12 ? ORD[n] : n} ${noun.pl}`;
}

const stor = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const f = (r) => formatSv(r);

/** Behållare och föremål per vågtema (vag-visning.THEMES). */
export const NOUNS = Object.freeze({
  spargris: { box: { sg: "spargris", pl: "spargrisar" }, item: { sg: "mynt", pl: "mynt", ett: true } },
  sack: { box: { sg: "säck", pl: "säckar" }, item: { sg: "present", pl: "presenter" } },
  korg: { box: { sg: "korg", pl: "korgar" }, item: { sg: "äpple", pl: "äpplen", ett: true } },
  burk: { box: { sg: "burk", pl: "burkar" }, item: { sg: "kula", pl: "kulor" } },
  paket: { box: { sg: "paket", pl: "paket", ett: true }, item: { sg: "småsak", pl: "småsaker" } },
});

/** x-koefficient (a) och konstant (b) i ett led – som rationella tal. */
export function linjar(side) {
  let a = q(0);
  let b = q(0);
  for (const t of side) {
    if (t.x) a = add(a, coefOf(t));
    else b = add(b, coefOf(t));
  }
  return { a, b };
}

/** Ett led med bara positiva heltal som ord: "två spargrisar och 3 mynt". */
function ledText(side, nouns) {
  const { a, b } = linjar(side);
  const parts = [];
  if (a.n > 0) parts.push(antal(a.n, nouns.box, { ord: true }));
  if (b.n > 0) parts.push(antal(b.n, nouns.item));
  return parts.join(" och ");
}

/** Går ekvationen att beskriva med behållare och föremål? (bara positiva heltal) */
export function bildbar(eq) {
  return [...eq.left, ...eq.right].every((t) => t.n > 0 && t.d === 1);
}

/** D (bild → ekvation): vågens bild i ord + vad x står för. */
export function bildText(eq, theme) {
  const nouns = NOUNS[theme.id] || NOUNS.spargris;
  return {
    text: `${stor(ledText(eq.left, nouns))} är lika mycket som ${ledText(eq.right, nouns)}.`,
    x: `x = antalet ${nouns.item.pl} i ${nouns.box.ett ? "ett" : "en"} ${nouns.box.sg}`,
  };
}

// --- F: problemlösning -----------------------------------------------------------
//
// En mall per sammanhang: text(v) och fraga(v), ratt(v) = vad x betyder, fel =
// meningar med samma tal men annan betydelse; `q(v)` = den storhet meningen
// påstår, så att en sann felmening kan sorteras bort. v = { La, Lb, Ra, Rb, x }
// (rationella tal ur ekvationens led; Lb = konstanten i vänsterledet osv.).

const minus = (r) => q(-r.n, r.d);
const ggr = (a, x) => mul(a, x);

const TEMA = (form) => ({
  id: `tema-${form}`,
  bild: true,
  text: (v, n) =>
    `${stor(ledText(v.eq.left, n))} är lika mycket som ${ledText(v.eq.right, n)}.` +
    (v.La.n > 1 ? ` Alla ${n.box.pl} innehåller lika många ${n.item.pl}.` : ""),
  fraga: (v, n) => `Hur många ${n.item.pl} finns i ${v.La.n > 1 ? "varje" : n.box.ett ? "ett" : "en"} ${n.box.sg}?`,
  ratt: (v, n) => `${v.La.n > 1 ? "Varje" : n.box.ett ? "Ett" : "En"} ${n.box.sg} innehåller ${f(v.x)} ${n.item.pl}.`,
  fel: [
    { text: (v, n) => `Det finns ${f(v.x)} ${n.box.pl}.`, q: (v) => v.La },
    { text: (v, n) => `Det finns ${f(v.x)} lösa ${n.item.pl}.`, q: (v) => v.Lb },
    { text: (v, n) => `Det finns ${f(v.x)} ${n.item.pl} tillsammans.`, q: (v) => v.Rb },
  ],
});

export const MALLAR = Object.freeze({
  "x+a=b": [
    TEMA("x+a=b"),
    {
      id: "klistermarken-fick",
      text: (v) => `Mira har några klistermärken. Hon får ${f(v.Lb)} till av sin kompis. Nu har hon ${f(v.Rb)} klistermärken.`,
      fraga: () => "Hur många klistermärken hade Mira från början?",
      ratt: (v) => `Mira hade ${f(v.x)} klistermärken från början.`,
      fel: [
        { text: (v) => `Mira fick ${f(v.x)} klistermärken av sin kompis.`, q: (v) => v.Lb },
        { text: (v) => `Mira har ${f(v.x)} klistermärken nu.`, q: (v) => v.Rb },
      ],
    },
  ],
  "x-a=b": [
    {
      id: "klistermarken-gav",
      text: (v) => `Leo hade några klistermärken. Han gav bort ${f(minus(v.Lb))} och har ${f(v.Rb)} kvar.`,
      fraga: () => "Hur många klistermärken hade Leo från början?",
      ratt: (v) => `Leo hade ${f(v.x)} klistermärken från början.`,
      fel: [
        { text: (v) => `Leo gav bort ${f(v.x)} klistermärken.`, q: (v) => minus(v.Lb) },
        { text: (v) => `Leo har ${f(v.x)} klistermärken kvar.`, q: (v) => v.Rb },
      ],
    },
  ],
  "ax=b": [
    TEMA("ax=b"),
    {
      id: "pasar",
      text: (v) => `${stor(ORD[v.La.n] || String(v.La.n))} likadana påsar innehåller tillsammans ${f(v.Rb)} kulor.`,
      fraga: () => "Hur många kulor finns i varje påse?",
      ratt: (v) => `Varje påse innehåller ${f(v.x)} kulor.`,
      fel: [
        { text: (v) => `Det finns ${f(v.x)} påsar.`, q: (v) => v.La },
        { text: (v) => `Det finns ${f(v.x)} kulor tillsammans.`, q: (v) => v.Rb },
      ],
    },
  ],
  "x/a=b": [
    {
      id: "godis-delas",
      text: (v) => `En påse godis delas lika mellan ${f(v.La.d === 1 ? v.La : q(v.La.d))} barn. Varje barn får ${f(v.Rb)} godisbitar.`,
      fraga: () => "Hur många godisbitar fanns i påsen?",
      ratt: (v) => `Det fanns ${f(v.x)} godisbitar i påsen.`,
      fel: [
        { text: (v) => `Varje barn får ${f(v.x)} godisbitar.`, q: (v) => v.Rb },
        { text: (v) => `Det var ${f(v.x)} barn.`, q: (v) => q(v.La.d) },
      ],
    },
  ],
  "ax+b=c": [
    TEMA("ax+b=c"),
    {
      id: "pasar-kulor",
      text: (v) => `${stor(ORD[v.La.n] || String(v.La.n))} likadana påsar och ${f(v.Lb)} lösa kulor är tillsammans ${f(v.Rb)} kulor.`,
      fraga: () => "Hur många kulor finns i varje påse?",
      ratt: (v) => `Varje påse innehåller ${f(v.x)} kulor.`,
      fel: [
        { text: (v) => `Det finns ${f(v.x)} påsar.`, q: (v) => v.La },
        { text: (v) => `Det finns ${f(v.x)} lösa kulor.`, q: (v) => v.Lb },
        { text: (v) => `Det finns ${f(v.x)} kulor tillsammans.`, q: (v) => v.Rb },
      ],
    },
    {
      id: "pennor",
      text: (v) => `Ella köper ${f(v.La)} likadana pennor och ett suddgummi för ${f(v.Lb)} kr. Hon betalar ${f(v.Rb)} kr för allt.`,
      fraga: () => "Vad kostar en penna?",
      ratt: (v) => `En penna kostar ${f(v.x)} kr.`,
      fel: [
        { text: (v) => `Ella köper ${f(v.x)} pennor.`, q: (v) => v.La },
        { text: (v) => `Suddgummit kostar ${f(v.x)} kr.`, q: (v) => v.Lb },
        { text: (v) => `Allt kostar ${f(v.x)} kr.`, q: (v) => v.Rb },
      ],
    },
    {
      id: "sidor",
      text: (v) => `Sam läser lika många sidor varje dag i ${f(v.La)} dagar. Sedan läser han ${f(v.Lb)} sidor till. Totalt har han läst ${f(v.Rb)} sidor.`,
      fraga: () => "Hur många sidor läste Sam varje dag?",
      ratt: (v) => `Sam läste ${f(v.x)} sidor varje dag.`,
      fel: [
        { text: (v) => `Sam läste i ${f(v.x)} dagar.`, q: (v) => v.La },
        { text: (v) => `Sam läste ${f(v.x)} sidor till på slutet.`, q: (v) => v.Lb },
        { text: (v) => `Sam läste ${f(v.x)} sidor totalt.`, q: (v) => v.Rb },
      ],
    },
  ],
  "ax+b=c:xdec": [
    {
      id: "paket-vikt",
      text: (v) => `${stor(ORD[v.La.n] || String(v.La.n))} lika tunga paket och en låda som väger ${f(v.Lb)} kg väger tillsammans ${f(v.Rb)} kg.`,
      fraga: () => "Hur mycket väger ett paket?",
      ratt: (v) => `Ett paket väger ${f(v.x)} kg.`,
      fel: [
        { text: (v) => `Det finns ${f(v.x)} paket.`, q: (v) => v.La },
        { text: (v) => `Lådan väger ${f(v.x)} kg.`, q: (v) => v.Lb },
        { text: (v) => `Allt väger ${f(v.x)} kg.`, q: (v) => v.Rb },
      ],
    },
  ],
  "ax-b=c": [
    {
      id: "askar-kort",
      text: (v) => `Noah hade ${f(v.La)} lika fulla askar med kort. Han gav bort ${f(minus(v.Lb))} kort och har nu ${f(v.Rb)} kort kvar.`,
      fraga: () => "Hur många kort fanns i varje ask?",
      ratt: (v) => `Varje ask innehöll ${f(v.x)} kort.`,
      fel: [
        { text: (v) => `Noah hade ${f(v.x)} askar.`, q: (v) => v.La },
        { text: (v) => `Noah gav bort ${f(v.x)} kort.`, q: (v) => minus(v.Lb) },
        { text: (v) => `Noah har ${f(v.x)} kort kvar.`, q: (v) => v.Rb },
      ],
    },
    {
      id: "biljetter-rabatt",
      text: (v) => `Ali köper ${f(v.La)} biljetter som kostar lika mycket. Med en rabatt på ${f(minus(v.Lb))} kr betalar han ${f(v.Rb)} kr.`,
      fraga: () => "Vad kostar en biljett utan rabatt?",
      ratt: (v) => `En biljett kostar ${f(v.x)} kr.`,
      fel: [
        { text: (v) => `Ali köper ${f(v.x)} biljetter.`, q: (v) => v.La },
        { text: (v) => `Rabatten är ${f(v.x)} kr.`, q: (v) => minus(v.Lb) },
        { text: (v) => `Ali betalar ${f(v.x)} kr.`, q: (v) => v.Rb },
      ],
    },
  ],
  "x/a+b=c": [
    {
      id: "parlor-burkar",
      text: (v) => `Klassen delar sina pärlor lika i ${f(q(v.La.d))} burkar. I en av burkarna lägger de ${f(v.Lb)} pärlor till. Då finns det ${f(v.Rb)} pärlor i den burken.`,
      fraga: () => "Hur många pärlor hade klassen från början?",
      ratt: (v) => `Klassen hade ${f(v.x)} pärlor från början.`,
      fel: [
        { text: (v) => `Det var ${f(v.x)} pärlor i varje burk från början.`, q: (v) => ggr(v.La, v.x) },
        { text: (v) => `Det var ${f(v.x)} burkar.`, q: (v) => q(v.La.d) },
        { text: (v) => `De lade till ${f(v.x)} pärlor.`, q: (v) => v.Lb },
      ],
    },
  ],
  "x/a-b=c": [
    {
      id: "kex-delas",
      text: (v) => `Ett paket kex delas lika mellan ${f(q(v.La.d))} vänner. Saga äter ${f(minus(v.Lb))} av sina kex och har ${f(v.Rb)} kvar.`,
      fraga: () => "Hur många kex fanns i paketet?",
      ratt: (v) => `Det fanns ${f(v.x)} kex i paketet.`,
      fel: [
        { text: (v) => `Saga fick ${f(v.x)} kex.`, q: (v) => ggr(v.La, v.x) },
        { text: (v) => `Det var ${f(v.x)} vänner.`, q: (v) => q(v.La.d) },
        { text: (v) => `Saga har ${f(v.x)} kex kvar.`, q: (v) => v.Rb },
      ],
    },
  ],
  "ax=cx+d": [
    {
      id: "burkar-lika",
      text: (v) => `Mira har ${antal(v.La.n, { sg: "burk", pl: "burkar" })} med lika många kulor i varje. Noah har ${antal(v.Ra.n, { sg: "likadan burk", pl: "likadana burkar" })} och ${f(v.Rb)} lösa kulor. De har lika många kulor.`,
      fraga: () => "Hur många kulor finns i en burk?",
      ratt: (v) => `Det finns ${f(v.x)} kulor i varje burk.`,
      fel: [
        { text: (v) => `Mira har ${f(v.x)} burkar.`, q: (v) => v.La },
        { text: (v) => `Noah har ${f(v.x)} lösa kulor.`, q: (v) => v.Rb },
        { text: (v) => `De har ${f(v.x)} kulor var.`, q: (v) => ggr(v.La, v.x) },
      ],
    },
  ],
  "ax+b=cx+d": [
    {
      id: "simhallar",
      text: (v) => `Simhall A kostar ${f(v.Lb)} kr i årsavgift och ${f(v.La)} kr per besök. Simhall B kostar ${f(v.Rb)} kr i årsavgift och ${f(v.Ra)} kr per besök.`,
      fraga: () => "Efter hur många besök kostar de lika mycket?",
      ratt: (v) => `Efter ${f(v.x)} besök kostar de lika mycket.`,
      fel: [
        { text: (v) => `Ett besök i simhall A kostar ${f(v.x)} kr.`, q: (v) => v.La },
        { text: (v) => `Årsavgiften i simhall B är ${f(v.x)} kr.`, q: (v) => v.Rb },
        { text: (v) => `Det kostar ${f(v.x)} kr totalt.`, q: (v) => add(ggr(v.La, v.x), v.Lb) },
      ],
    },
    {
      id: "spara",
      text: (v) => `Alva har ${f(v.Lb)} kr och sparar ${f(v.La)} kr i veckan. Leo har ${f(v.Rb)} kr och sparar ${f(v.Ra)} kr i veckan.`,
      fraga: () => "Efter hur många veckor har de lika mycket pengar?",
      ratt: (v) => `Efter ${f(v.x)} veckor har de lika mycket pengar.`,
      fel: [
        { text: (v) => `Alva sparar ${f(v.x)} kr i veckan.`, q: (v) => v.La },
        { text: (v) => `Leo har ${f(v.x)} kr från början.`, q: (v) => v.Rb },
        { text: (v) => `De har ${f(v.x)} kr var.`, q: (v) => add(ggr(v.La, v.x), v.Lb) },
      ],
    },
  ],
  "ax-b=cx+d": [
    {
      id: "karameller",
      text: (v) => `Alva har ${f(v.La)} fulla påsar karameller men har redan ätit ${f(minus(v.Lb))} karameller. Leo har ${antal(v.Ra.n, { sg: "full påse", pl: "fulla påsar" })} och ${f(v.Rb)} lösa karameller. De har lika många karameller. Alla påsar har lika många.`,
      fraga: () => "Hur många karameller finns i en full påse?",
      ratt: (v) => `En full påse innehåller ${f(v.x)} karameller.`,
      fel: [
        { text: (v) => `Alva har ${f(v.x)} påsar.`, q: (v) => v.La },
        { text: (v) => `Alva har ätit ${f(v.x)} karameller.`, q: (v) => minus(v.Lb) },
        { text: (v) => `Leo har ${f(v.x)} lösa karameller.`, q: (v) => v.Rb },
      ],
    },
  ],
  "b-ax=c": [
    {
      id: "bocker",
      text: (v) => `Saga har ${f(v.Lb)} kr. Hon köper ${f(minus(v.La))} böcker som kostar lika mycket och har ${f(v.Rb)} kr kvar.`,
      fraga: () => "Vad kostar en bok?",
      ratt: (v) => `En bok kostar ${f(v.x)} kr.`,
      fel: [
        { text: (v) => `Saga köper ${f(v.x)} böcker.`, q: (v) => minus(v.La) },
        { text: (v) => `Saga har ${f(v.x)} kr kvar.`, q: (v) => v.Rb },
        { text: (v) => `Saga hade ${f(v.x)} kr från början.`, q: (v) => v.Lb },
      ],
    },
  ],
  "dx=c": [
    {
      id: "applen-pris",
      text: (v) => `Äpplen kostar ${f(v.La)} kr styck. Sam köper några äpplen och betalar ${f(v.Rb)} kr.`,
      fraga: () => "Hur många äpplen köper Sam?",
      ratt: (v) => `Sam köper ${f(v.x)} äpplen.`,
      fel: [
        { text: (v) => `Ett äpple kostar ${f(v.x)} kr.`, q: (v) => v.La },
        { text: (v) => `Sam betalar ${f(v.x)} kr.`, q: (v) => v.Rb },
      ],
    },
  ],
  "dx+b=c": [
    {
      id: "bananer",
      text: (v) => `Bananer kostar ${f(v.La)} kr styck. Ella köper några bananer och en påse för ${f(v.Lb)} kr. Hon betalar ${f(v.Rb)} kr.`,
      fraga: () => "Hur många bananer köper Ella?",
      ratt: (v) => `Ella köper ${f(v.x)} bananer.`,
      fel: [
        { text: (v) => `En banan kostar ${f(v.x)} kr.`, q: (v) => v.La },
        { text: (v) => `Påsen kostar ${f(v.x)} kr.`, q: (v) => v.Lb },
        { text: (v) => `Ella betalar ${f(v.x)} kr.`, q: (v) => v.Rb },
      ],
    },
  ],
});

/** Har formen någon problemmall? (typ F väljer bara sådana former) */
export const harMall = (formId) => Object.hasOwn(MALLAR, formId);

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * F: problemet till en genererad uppgift (x i vänsterledet, inte bytt).
 * Bildmallen (behållare + föremål ur vågens tema) väljs bara när vågen visar
 * föremål – då är bilden "verkligheten". → payload eller null (för få giltiga
 * felmeningar – generatorn försöker igen).
 */
export function buildProblem(task, rng) {
  const mallar = (MALLAR[task.form] || []).filter((m) => !m.bild || task.display === "foremal");
  if (!mallar.length || task.swapped) return null;
  const eq = fromJSON(task.equation);
  const L = linjar(eq.left);
  const R = linjar(eq.right);
  const x = q(task.solution.n, task.solution.d);
  const v = { eq, La: L.a, Lb: L.b, Ra: R.a, Rb: R.b, x };
  if (mallar.some((m) => m.bild) && !bildbar(eq)) return null;
  const mall = mallar[Math.floor(rng() * mallar.length)];
  const n = NOUNS[themeFor(task).id];
  const ratt = mall.ratt(v, n);
  const fel = mall.fel.filter((d) => !same(d.q(v), x)).map((d) => d.text(v, n)).filter((t) => t !== ratt);
  if (fel.length < 2) return null;
  const val = shuffle([ratt, ...shuffle(fel, rng).slice(0, 2)], rng);
  return {
    mall: mall.id,
    bild: !!mall.bild,
    text: mall.text(v, n),
    fraga: mall.fraga(v, n),
    val,
    ratt: val.indexOf(ratt),
    svar: ratt,
    heltal: isInteger(x),
  };
}
