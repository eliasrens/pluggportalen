// ============================================================================
// #765 Prov 3D – testarens kantfall (komplement till prov-765-avsnitt-statistik.test.js).
//   - statistik per avsnitt: tomma avsnitt, avsnitt i följd, frågor före första
//     avsnittet, textblock i avsnitt, egna färggränser på halvpoäng, ej rättat
//   - decimalkomma: inga punkt-decimaler i avsnittstexter, CSV, resultatvyn,
//     pappersprovet och facit (riktig rendering med test/helpers/prov-mini-dom.js)
//   - poängkriterierna: rättningslagret kopierar dem vid tillbakalämningen BARA
//     när tillfällets visaKriterier är på (datalagret stubbat), resultatvyn
//     visar dem bara då
//   - "Delvis" på en fråga värd 0,5 p: rättningskortet renderat – ingen knapp,
//     bedom("delvis") gör inget; utan poäng finns Delvis kvar
//   - gamla prov: inga avsnittsrader/-kolumner, heltal
// Körs med: node --test
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { installeraDom } from "./helpers/prov-mini-dom.js";
import { delaUppProv, fragaNummer, poangAvsnitt } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";
import { avsnittsPoang, resultatModell } from "../src/prov/prov-resultat-modell.js";
import {
  avsnittFor, avsnittText, avsnittVarde, cellLage, granserFor, klassOversikt, snittTal,
} from "../src/prov/prov-statistik.js";
import { jamforKlasser, resultatCsv } from "../src/prov/prov-statistik-fordjupad.js";

// Datalagret i rättningslagret stubbas: skrivningarna hamnar i globalThis.__skrivet.
const DATA = `
const s = () => (globalThis.__skrivet ||= []);
export async function sparaRattningar(t, dok, st) { s().push({ op: "spara", dok: structuredClone(dok) }); }
export async function lamnaTillbaka(t, dok, st) { s().push({ op: "tillbaka", dok: structuredClone(dok) }); }
export async function angraTillbaka(t, uid) { s().push({ op: "angra", uid }); }
export async function sparaFacitTillagg() {}`;
const HOOK = `export async function resolve(spec, ctx, next) {
  if (spec === "./prov-rattning-data.js" && ctx.parentURL?.endsWith("/src/prov/prov-ratta-lager.js")) {
    return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(DATA)}) };
  }
  return next(spec, ctx);
}`;

let dom;
let vy;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  dom = installeraDom();
  document.querySelector = () => ({}); // laddaCss: "redan laddad"
  vy = {
    lager: await import("../src/prov/prov-ratta-lager.js"),
    res: await import("../src/prov/prov-resultat-vy.js"),
    kort: await import("../src/prov/prov-ratta-kort.js"),
    papper: await import("../src/prov/prov-utskrift-papper.js"),
  };
});
after(() => dom?.avinstallera?.());

const PUNKT = /\d\.\d/; // en punkt-decimal någonstans

// Två tomma avsnitt i följd, frågor före första avsnittet, ett textblock i Del 2, ett tomt avsnitt sist.
const PROV = validateProv({
  namn: "Medeltiden",
  installningar: { visaKriterier: true, granser: { gul: 70, gron: 90 } },
  fragor: [
    { id: "q0", typ: "santfalskt", fraga: "Hansan var ett förbund.", ratt: true, poang: 1.5 },
    { id: "a0", typ: "avsnitt", titel: "Tomt" },
    { id: "a1", typ: "avsnitt", titel: "Del 1; fakta" },
    { id: "q1", typ: "flerval", fraga: "F1", alternativ: ["a", "b"], ratt: 0, poang: 0.5 },
    { id: "q2", typ: "flerval", fraga: "F2", alternativ: ["a", "b"], ratt: 0, poang: 2.5 },
    { id: "a2", typ: "avsnitt", titel: "Del 2" },
    { id: "t1", typ: "text", titel: "Läs", brodtext: "En text om borgar." },
    { id: "q3", typ: "fritext", fraga: "Beskriv en borg.", poang: 7.5, kriterier: ["1 p: murar", "+1 p: varför"] },
    { id: "a3", typ: "avsnitt", titel: "Sist och tomt" },
  ],
}).value;
const { fragor, facit, bedomningsstod, kriterier } = delaUppProv(PROV);
const F = (id) => fragor.find((f) => f.id === id);
const SVAR = { q0: true, q1: 0, q2: 1, q3: "Murar." };

function elev(uid, poang) {
  let r = godkannAlla(nyRattning({ elevId: uid, classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit }), fragor);
  for (const [id, p] of Object.entries(poang)) r = bedom(r, F(id), { poang: p }, fragor);
  return sparDok(r, fragor);
}
// A: q0 1,5 · q1 0,5 · q2 0 · q3 6,5 → Inledning 1,5/1,5 · Del 1 0,5/3 · Del 2 6,5/7,5
const A = elev("e1", { q3: 6.5 });
// B: q0 0 · q1 0,5 · q2 2,5 · q3 7 → Inledning 0/1,5 · Del 1 3/3 · Del 2 7/7,5
const B = elev("e2", { q0: 0, q2: 2.5, q3: 7 });

describe("statistik per avsnitt – kantfall", () => {
  it("tomma avsnitt (i följd och sist) hoppas över, frågor före första avsnittet blir Inledning, textblock räknas inte", () => {
    const a = poangAvsnitt(fragor);
    assert.deepEqual(a.map((x) => [x.id, x.titel, x.fragor.map((f) => f.id), x.maxPoang]),
      [["", "Inledning", ["q0"], 1.5], ["a1", "Del 1; fakta", ["q1", "q2"], 3], ["a2", "Del 2", ["q3"], 7.5]]);
    assert.deepEqual(fragaNummer(fragor), { q0: 1, q1: 2, q2: 3, q3: 4 }, "löpande över avsnitten, inga nummer på avsnitt/textblock");
  });

  it("en elev per avsnitt exakt med halvpoäng; summan av avsnitten = totalen", () => {
    const g = granserFor(PROV.installningar);
    const a = avsnittFor(A, poangAvsnitt(fragor), true, g);
    assert.deepEqual(a.map((x) => avsnittText(x, true)), ["Inledning: 1,5 av 1,5", "Del 1; fakta: 0,5 av 3", "Del 2: 6,5 av 7,5"]);
    assert.equal(a.reduce((s, x) => s + x.poang, 0), A.totalPoang);
    assert.equal(A.totalPoang, 8.5);
  });

  it("egna färggränser 70/90 på halvpoäng: 6,5/7,5 = 86,7 % gul, 7/7,5 = 93,3 % grön, 0,5/3 röd, 3/3 grön", () => {
    const g = granserFor(PROV.installningar);
    assert.deepEqual(g, { gul: 70, gron: 90 });
    const fa = (r) => avsnittFor(r, poangAvsnitt(fragor), true, g).map((x) => x.farg);
    assert.deepEqual(fa(A), ["gron", "rod", "gul"]);
    assert.deepEqual(fa(B), ["rod", "gron", "gron"]);
  });

  it("klassens snitt per avsnitt = elevernas medelpoäng när alla är rättade, med decimalkomma", () => {
    const m = klassOversikt({ fragor, med: ["e1", "e2"], svarAv: () => undefined, rattningar: { e1: A, e2: B }, installningar: PROV.installningar });
    // Inledning (1,5 + 0)/2 = 0,75 → "0,8"; Del 1 (0,5 + 3)/2 = 1,75 → "1,8"; Del 2 (6,5 + 7)/2 = 6,75 → "6,8"
    assert.deepEqual(m.avsnitt.map((x) => avsnittVarde(x, true)), ["0,8 av 1,5", "1,8 av 3", "6,8 av 7,5"]);
    for (const x of m.avsnitt) assert.doesNotMatch(avsnittText(x, true), PUNKT);
    // Rutnätet har fortfarande bara frågorna (Σ-kolumnerna ritas av vyn).
    assert.deepEqual(m.rader[0].celler.map((c) => c.fid), ["q0", "q1", "q2", "q3"]);
  });

  it("snittTal: en decimal, decimalkomma, aldrig punkt (0–24 i steg om 0,05)", () => {
    for (let i = 0; i <= 480; i++) assert.doesNotMatch(snittTal(i * 0.05), /\./, String(i * 0.05));
    assert.equal(snittTal(7), "7");
    assert.equal(snittTal(7.25), "7,3");
  });

  it("ett avsnitt utan bedömda frågor: \"ej rättat\" och ingen färg; klassen räknar bara bedömda elever", () => {
    const ny = sparDok(nyRattning({ elevId: "e3", classId: "4a", provNamn: "x", fragor, svar: SVAR, facit }), fragor);
    const a = avsnittFor(ny, poangAvsnitt(fragor), true, granserFor());
    assert.deepEqual(a.map((x) => [avsnittVarde(x, true), x.farg]), [["ej rättat", null], ["ej rättat", null], ["ej rättat", null]]);
    const m = klassOversikt({ fragor, med: ["e1", "e3"], svarAv: () => undefined, rattningar: { e1: A, e3: ny }, installningar: {} });
    assert.deepEqual(m.avsnitt.map((x) => x.bedomda), [1, 1, 1]);
    assert.equal(avsnittVarde(m.avsnitt[2], true), "6,5 av 7,5");
  });

  it("jämför: en annan klass med ett gammalt prov (inga avsnitt) får null i avsnittsraden, inte 0", () => {
    const tf = { id: "t1", classId: "4a", fragor, installningar: {} };
    const gammalt = fragor.filter((f) => f.typ !== "avsnitt");
    const j = jamforKlasser({ tf, klassNamn: "4A", rattningar: { e1: A }, med: ["e1"] },
      [{ tf: { ...tf, id: "t2", classId: "4b", fragor: gammalt }, klassNamn: "4B", rattningar: { e2: B } }]);
    assert.deepEqual(j.avsnitt.map((a) => a.andelar[1]), [null, null, null]);
    assert.equal(j.avsnitt[0].andelar[0], 1);
  });

  it("CSV: avsnittstitel med semikolon citeras, halvpoäng med komma, inga punkt-decimaler", () => {
    const csv = resultatCsv({ fragor, med: ["e1", "e2"], namn: { e1: "Alva", e2: "Bo" }, rattningar: { e1: A, e2: B }, installningar: {} });
    const [huvud, ...rader] = csv.replace(/^﻿/, "").trim().split("\r\n");
    assert.match(huvud, /;"Del 1; fakta \(3 p\)";Del 2 \(7,5 p\);/);
    assert.match(rader[0], /^Alva;1,5;0,5;0;6,5;1,5;0,5;6,5;8,5;12;/);
    for (const r of [huvud, ...rader]) assert.doesNotMatch(r, PUNKT, r);
  });

  it("CSV: en avsnittstitel som börjar med = blir inte en formel", () => {
    const p = validateProv({ namn: "x", fragor: [{ id: "a", typ: "avsnitt", titel: "=SUMMA(A1)" }, { id: "q", typ: "flerval", fraga: "F", alternativ: ["a", "b"], ratt: 0, poang: 1 }] }).value;
    const csv = resultatCsv({ fragor: p.fragor, med: [], rattningar: {}, installningar: {} });
    assert.match(csv, /;'=SUMMA\(A1\) \(1 p\);/);
  });
});

describe("full poäng = rätt och Delvis vid max 0,5 – rättningskortet renderat", () => {
  const kortFor = (max, poangsatt, post = null) => {
    const f = { id: "q", typ: "flerval", fraga: "F", alternativ: ["a", "b"], poang: max };
    const andringar = [];
    const k = vy.kort.rattaKort({ titel: "Alva", fraga: f, svar: 0, facit: 0, poangsatt, lage: () => ({ post, blandat: false, last: false }), onAndring: (a) => andringar.push(a) });
    return { k, andringar, knappar: k.el.querySelectorAll("button").map((b) => b.textContent) };
  };

  it("max 0,5 poängsatt: ingen Delvis-knapp och bedom(\"delvis\") gör inget", () => {
    const { k, andringar, knappar } = kortFor(0.5, true);
    assert.ok(knappar.some((t) => t.startsWith("✓")) && knappar.some((t) => t.startsWith("✗")), knappar.join("|"));
    assert.equal(knappar.some((t) => /Delvis/.test(t)), false, knappar.join("|"));
    k.bedom("delvis");
    assert.deepEqual(andringar, []);
    k.bedom(true);
    assert.deepEqual(andringar, [{ ratt: true }]);
  });

  it("max 1 poängsatt och max 0,5 utan poäng: Delvis finns", () => {
    assert.ok(kortFor(1, true).knappar.some((t) => /Delvis/.test(t)));
    assert.ok(kortFor(0.5, false).knappar.some((t) => /Delvis/.test(t)));
  });

  it("en gammal delvis 0,5 av 0,5 p visas som Rätt i kortet, cellen och elevens resultat", () => {
    const post = { ratt: "delvis", poang: 0.5 };
    const { k } = kortFor(0.5, true, post);
    const tryckt = k.el.querySelectorAll("button").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
    assert.equal(tryckt.length, 1);
    assert.match(tryckt[0], /Rätt/);
    assert.equal(cellLage(post, 0, { typ: "flerval", poang: 0.5 }, true), "ratt");
    assert.equal(cellLage(post, 0, { typ: "flerval", poang: 0.5 }, false), "delvis", "utan poäng betyder delvis ½");
    const et = vy.res.bedomningsEtikett("delvis", { poang: 0.5, max: 0.5, poangsatt: true });
    assert.match(et.textContent, /^✓Rätt · 0,5 av 0,5 p$/);
  });
});

describe("poängkriterierna följer visaKriterier (klienten)", () => {
  const lagerMed = (installningar, kr = kriterier) => {
    const tf = { id: "t1", classId: "4a", provNamn: PROV.namn, fragor, installningar };
    const data = { tf, facit, bedomningsstod, kriterier: kr, svar: { e1: { svar: SVAR } }, rattningar: { e1: structuredClone(A) } };
    return vy.lager.skapaRattningsLager({ data, med: ["e1"] });
  };
  const tillbaka = async (installningar, kr) => {
    globalThis.__skrivet = [];
    await lagerMed(installningar, kr).lamnaTillbaka(["e1"], false);
    return globalThis.__skrivet.find((s) => s.op === "tillbaka").dok.e1;
  };

  it("flaggan på: tillbakalämningen kopierar kriterierna", async () => {
    const d = await tillbaka({ visaKriterier: true });
    assert.deepEqual(d.kriterier, { q3: ["1 p: murar", "+1 p: varför"] });
    assert.equal(d.aterlamnad, true);
  });

  it("flaggan av / saknas / inga installningar / inga kriterier: inget kriterier-fält", async () => {
    for (const ins of [{ visaKriterier: false }, {}, undefined, { visaKriterier: "true" }]) {
      const d = await tillbaka(ins);
      assert.equal("kriterier" in d, false, JSON.stringify(ins));
    }
    assert.equal("kriterier" in (await tillbaka({ visaKriterier: true }, {})), false, "tom karta skrivs inte");
  });

  it("resultatvyn: kriterier bara med flaggan på OCH kopierade, aldrig före tillbakalämningen", () => {
    const tf = { fragor, installningar: { visaKriterier: true } };
    const r = { ...A, aterlamnad: true, kriterier };
    const kr = (m) => m.poster.filter((p) => p.kriterier).map((p) => p.fraga.id);
    assert.deepEqual(kr(resultatModell(tf, { svar: SVAR }, r)), ["q3"]);
    assert.deepEqual(kr(resultatModell({ ...tf, installningar: { visaKriterier: false } }, { svar: SVAR }, r)), [], "flaggan av: kvarglömda kriterier visas inte");
    assert.deepEqual(kr(resultatModell(tf, { svar: SVAR }, { ...A, aterlamnad: true })), [], "flaggan på men inte kopierade");
    assert.equal(resultatModell(tf, { svar: SVAR }, { ...A, kriterier }), null, "före tillbakalämningen: ingen modell alls");
  });

  it("resultatvyn renderad: \"Poängkriterier\" syns bara med flaggan", () => {
    const r = { ...A, aterlamnad: true, kriterier };
    const med = vy.res.renderaResultat(resultatModell({ fragor, installningar: { visaKriterier: true } }, { svar: SVAR }, r)).textContent;
    const utan = vy.res.renderaResultat(resultatModell({ fragor, installningar: {} }, { svar: SVAR }, r)).textContent;
    assert.match(med, /Poängkriterier1 p: murar\+1 p: varför/);
    assert.doesNotMatch(utan, /Poängkriterier|murar/);
  });
});

describe("decimalkomma och avsnitt i resultatvyn och utskriften (renderat)", () => {
  it("resultatvyn: totalen, avsnittsraden, avsnittsrubrikerna och frågorna med decimalkomma", () => {
    const m = resultatModell({ fragor, installningar: { visaKriterier: true } }, { svar: SVAR }, { ...A, aterlamnad: true });
    assert.deepEqual(avsnittsPoang(A, fragor).map((a) => [a.titel, a.poang, a.max]), [["Inledning", 1.5, 1.5], ["Del 1; fakta", 0.5, 3], ["Del 2", 6.5, 7.5]]);
    const text = vy.res.renderaResultat(m).textContent;
    assert.match(text, /8,5 av 12 poäng/);
    assert.match(text, /Inledning: 1,5 av 1,5 · Del 1; fakta: 0,5 av 3 · Del 2: 6,5 av 7,5/);
    assert.match(text, /Del 1; fakta0,5 av 3 poäng/);
    assert.match(text, /Rätt · 0,5 av 0,5 p/);
    assert.match(text, /Delvis rätt · 6,5 av 7,5 p/);
    assert.doesNotMatch(text, /TomtSist|Sist och tomt\d/, "tomma avsnitt får ingen poängrad");
    assert.doesNotMatch(text, PUNKT);
  });

  it("pappersprovet och facit: avsnittsrubrik med poäng, löpande nummer, decimalkomma", () => {
    const sida = vy.papper.provSidor({ namn: PROV.namn, fragor, poangsatt: true })[0].textContent;
    assert.match(sida, /Provet ger högst 12 p\./);
    assert.match(sida, /Del 1; fakta \(3 p\)/);
    assert.match(sida, /Del 2 \(7,5 p\)/);
    assert.doesNotMatch(sida, PUNKT);
    const fs = vy.papper.facitSida({ namn: PROV.namn, fragor, facit, bedomningsstod, kriterier, poangsatt: true });
    const t = fs.textContent;
    assert.match(t, /Del 1; fakta \(3 p\)/);
    assert.deepEqual(fs.querySelectorAll("li").map((li) => li.getAttribute("value")), ["1", "2", "3", "4"]);
    assert.doesNotMatch(t, PUNKT);
  });
});

describe("gamla prov (inga avsnitt, heltal) – som förut", () => {
  const G = validateProv({
    namn: "Gammalt", fragor: [
      { id: "g1", typ: "flerval", fraga: "F1", alternativ: ["a", "b"], ratt: 0, poang: 2 },
      { id: "g2", typ: "fritext", fraga: "F2", poang: 3 },
    ],
  }).value;
  const g = delaUppProv(G);
  const r = sparDok(bedom(godkannAlla(nyRattning({ elevId: "e1", classId: "4a", provNamn: "G", fragor: g.fragor, svar: { g1: 0, g2: "x" }, facit: g.facit }), g.fragor), g.fragor[1], { poang: 2 }, g.fragor), g.fragor);

  it("statistik: inga avsnitt i översikten, elevvyn, CSV:n eller resultatet", () => {
    const m = klassOversikt({ fragor: g.fragor, med: ["e1"], svarAv: () => undefined, rattningar: { e1: r }, installningar: {} });
    assert.deepEqual(m.avsnitt, []);
    assert.deepEqual(m.rader[0].avsnitt, []);
    const csv = resultatCsv({ fragor: g.fragor, med: ["e1"], namn: { e1: "A" }, rattningar: { e1: r }, installningar: {} });
    assert.equal(csv.replace(/^﻿/, "").split("\r\n")[0], "Elev;Fråga 1 (2 p);Fråga 2 (3 p);Poäng;Av (rättade);Procent;Färg;Nivå;Status");
    const res = resultatModell({ fragor: g.fragor, installningar: {} }, null, { ...r, aterlamnad: true });
    assert.deepEqual(res.avsnitt, []);
    const text = vy.res.renderaResultat(res).textContent;
    assert.match(text, /4 av 5 poäng/);
    assert.doesNotMatch(text, /Inledning|avsnitt/i);
  });

  it("utskrift: inga avsnittsrubriker, facit som en lista", () => {
    const fs = vy.papper.facitSida({ namn: "Gammalt", fragor: g.fragor, facit: g.facit, poangsatt: true });
    assert.equal(fs.querySelectorAll(".provl-ut-avsnitt-titel").length, 0);
    assert.equal(fs.querySelectorAll(".provl-ut-facit").length, 1);
  });
});
