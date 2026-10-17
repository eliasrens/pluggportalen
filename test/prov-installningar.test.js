// ============================================================================
// Prov 2F (#759): inställningar per prov – stavfel (auto halva poängen /
// rätta själv) och egna färggränser (standard 60 % gul, 85 % grön).
// Reglerna: firestore-rules-prov.test.js ("inställningarna #759").
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { delaUppProv } from "../src/prov/prov-modell.js";
import {
  STANDARD_INSTALLNINGAR, STAVFEL, granserOk, granserText, stavfelFor, tillfalleInstallningar, validateProv,
} from "../src/prov/prov-validera.js";
import { elevStatus, ELEV_STATUS, godkannAlla, kompletteraForslag, nyRattning } from "../src/prov/prov-rattning-logik.js";
import { fargFor, granserFor, klassOversikt } from "../src/prov/prov-statistik.js";
import { bild, nyttProv, provFranDok } from "../src/prov/prov-redigera-ops.js";
import { fragetyp } from "../src/prov/prov-fragetyper.js";

const FRAGOR = [
  { id: "q1", typ: "kortsvar", fraga: "Huvudstaden?", godkanda: ["Stockholm"], exaktStavning: false, poang: 2 },
  { id: "q2", typ: "kortsvar", fraga: "Handelsstaden?", godkanda: ["Birka"], poang: 2 }, // exakt stavning (standard)
  { id: "q3", typ: "lucktext", fraga: "Fyll i.", lucktext: "Tor var [[åskans]] gud och Oden [[visdomens]].", exaktStavning: false, poang: 2 },
  { id: "q4", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland"], ratt: 0 },
];
const prov = (installningar) => validateProv({ namn: "Stavning", installningar, fragor: structuredClone(FRAGOR) });

describe("stavfel – validateProv och standard", () => {
  it("standard är auto; gamla prov utan stavfel = auto", () => {
    assert.equal(STANDARD_INSTALLNINGAR.stavfel, "auto");
    assert.equal(prov(undefined).value.installningar.stavfel, "auto");
    assert.equal(prov({ poang: true }).value.installningar.stavfel, "auto");
    assert.equal(stavfelFor(undefined), "auto");
    assert.equal(stavfelFor({}), "auto", "gammalt prov utan fältet");
    assert.equal(stavfelFor({ stavfel: "sjalv" }), "sjalv");
    assert.equal(stavfelFor({ stavfel: "konstigt" }), "auto");
  });
  it('"sjalv" sparas; okänt värde är ett fel', () => {
    assert.equal(prov({ stavfel: STAVFEL.SJALV }).value.installningar.stavfel, "sjalv");
    const r = prov({ stavfel: "halva" });
    assert.equal(r.ok, false);
    assert.match(r.errors.join(), /stavfel/);
  });
});

describe("stavfel – förslagen i rättningen", () => {
  const forslag = (stavfel, svar) => {
    const p = prov({ stavfel }).value;
    const { fragor, facit } = delaUppProv(p);
    return { r: nyRattning({ elevId: "e", classId: "4a", provNamn: p.namn, fragor, svar, facit, stavfel: stavfelFor(p.installningar) }), fragor, facit };
  };
  const STAVFEL_SVAR = { q1: "Stokholm", q2: "Brika", q3: ["åskans", "visdomenz"], q4: 0 };

  it("auto: ett stavfel ger halva poängen som förslag (auto: true)", () => {
    const { r } = forslag("auto", STAVFEL_SVAR);
    assert.deepEqual(r.fragor.q1, { poang: 1, ratt: "delvis", auto: true });
    assert.deepEqual(r.fragor.q3, { poang: 1.5, ratt: "delvis", auto: true }, "en lucka rätt + en med stavfel = ¾");
    assert.deepEqual(r.fragor.q2, { poang: 0, ratt: false, auto: true }, "exakt stavning krävs → fel");
  });
  it("rätta själv: stavfelssvaren får inget förslag och väntar på läraren", () => {
    const { r, fragor } = forslag("sjalv", STAVFEL_SVAR);
    assert.ok(!("q1" in r.fragor), "kortsvaret med stavfel → ingen post = Inte rättad");
    assert.ok(!("q3" in r.fragor), "lucktexten med ett stavfel i en lucka → hela frågan till läraren");
    assert.deepEqual(r.fragor.q2, { poang: 0, ratt: false, auto: true }, "exakt stavning krävs → fortfarande fel");
    assert.deepEqual(r.fragor.q4, { poang: 1, ratt: true, auto: true }, "andra typer som förut");
    // Godkänn alla förslag räcker inte – stavfelen måste läraren bedöma.
    assert.equal(elevStatus(godkannAlla(r, fragor), fragor), ELEV_STATUS.DELVIS);
  });
  it("rätta själv: rätt stavat och helt fel får förslag som vanligt", () => {
    const { r } = forslag("sjalv", { q1: "stockholm", q2: "Birka", q3: ["åskans", "Tyr"], q4: 1 });
    assert.deepEqual(r.fragor.q1, { poang: 2, ratt: true, auto: true });
    assert.deepEqual(r.fragor.q3, { poang: 1, ratt: "delvis", auto: true }, "en lucka fel (inget stavfel) – förslag som förut");
    const fel = forslag("sjalv", { q1: "Göteborg" }).r;
    assert.deepEqual(fel.fragor.q1, { poang: 0, ratt: false, auto: true });
  });
  it("kompletteraForslag följer valet och rör aldrig lärarens bedömning", () => {
    const { fragor, facit } = forslag("sjalv", {});
    const tom = { elevId: "e", classId: "4a", fragor: {}, aterlamnad: false };
    const k = kompletteraForslag(tom, fragor, STAVFEL_SVAR, facit, "sjalv");
    assert.ok(!("q1" in k.r.fragor));
    const auto = kompletteraForslag(tom, fragor, STAVFEL_SVAR, facit, "auto");
    assert.equal(auto.r.fragor.q1.ratt, "delvis");
    assert.equal(kompletteraForslag(tom, fragor, STAVFEL_SVAR, facit).r.fragor.q1.ratt, "delvis", "utan val = auto (gamla tillfällen)");
  });
  it("kortsvarets forslag tar emot valet", () => {
    const ks = fragetyp("kortsvar");
    const fa = { godkanda: ["Stockholm"], exaktStavning: false, skiftlage: false };
    assert.equal(ks.forslag("Stokholm", fa, { poang: 2 }, { stavfel: "sjalv" }), null);
    assert.equal(ks.forslag("Stokholm", fa, { poang: 2 }).ratt, "delvis");
  });
  it("rättningssidan skickar tillfällets val till förslagen", () => {
    const src = readFileSync(new URL("../src/prov/prov-ratta-lager.js", import.meta.url), "utf8");
    assert.match(src, /stavfelFor\(tf\.installningar\)/);
    assert.match(src, /nyRattning\(\{[^}]*stavfel \}\)/);
    assert.match(src, /kompletteraForslag\([^)]*stavfel\)/);
  });
});

describe("färggränser – standard, validering och färgerna", () => {
  it("standard 60 % gul, 85 % grön; gamla prov utan gränser får standarden", () => {
    assert.deepEqual(STANDARD_INSTALLNINGAR.granser, { gul: 60, gron: 85 });
    assert.deepEqual(prov(undefined).value.installningar.granser, { gul: 60, gron: 85 });
    assert.deepEqual(granserFor(undefined), { gul: 60, gron: 85 });
    assert.deepEqual(granserFor({ poang: true }), { gul: 60, gron: 85 });
    assert.equal(granserText({ gul: 60, gron: 85 }), "röd under 60 %, gul 60–84 %, grön 85 % eller mer");
    // Kantfallen (#749): gul ett steg, grön först vid 100.
    assert.equal(granserText({ gul: 99, gron: 100 }), "röd under 99 %, gul 99 %, grön 100 %");
    assert.equal(granserText({ gul: 50, gron: 51 }), "röd under 50 %, gul 50 %, grön 51 % eller mer");
    assert.equal(granserText({ gul: 1, gron: 100 }), "röd under 1 %, gul 1–99 %, grön 100 %");
  });
  it("egna gränser sparas som heltal (sifferfältens text tolkas)", () => {
    assert.deepEqual(prov({ granser: { gul: 50, gron: 75 } }).value.installningar.granser, { gul: 50, gron: 75 });
    assert.deepEqual(prov({ granser: { gul: "50", gron: "75" } }).value.installningar.granser, { gul: 50, gron: 75 });
    assert.deepEqual(prov({ granser: { gul: 1, gron: 100 } }).value.installningar.granser, { gul: 1, gron: 100 });
    assert.deepEqual(prov({ granser: { gul: 50 } }).value.installningar.granser, { gul: 50, gron: 85 }, "saknad grön = standard");
  });
  it("validering: 0 < gul < grön ≤ 100, hela procent", () => {
    for (const g of [{ gul: 0, gron: 50 }, { gul: 50, gron: 50 }, { gul: 70, gron: 60 }, { gul: 50, gron: 101 },
      { gul: 50.5, gron: 80 }, { gul: "", gron: 80 }, { gul: "abc", gron: 80 }, { gul: -5, gron: 80 }, { gul: 90 },
      { gul: true, gron: 80 }, { gul: [60], gron: 85 }, 5, [60, 85], "60/85"]) {
      const r = prov({ granser: g });
      assert.equal(r.ok, false, JSON.stringify(g));
      assert.match(r.errors.join(), /färggränserna/, JSON.stringify(g));
    }
    assert.equal(granserOk({ gul: 60, gron: 85 }), true);
    assert.equal(granserOk({ gul: 99, gron: 100 }), true);
    assert.equal(granserOk({ gul: 0, gron: 85 }), false);
    assert.equal(granserOk({ gul: "60", gron: 85 }), false, "bara tal (som reglerna: is int)");
    assert.equal(granserOk(null), false);
  });
  it("kopian till tillfället: standard för det som saknas, ogiltiga gränser (äldre tillfälle, omprov) → standard", () => {
    assert.deepEqual(tillfalleInstallningar(undefined), { ...STANDARD_INSTALLNINGAR, granser: { gul: 60, gron: 85 } });
    const egna = tillfalleInstallningar({ poang: false, stavfel: "sjalv", granser: { gron: 75, gul: 50 } });
    assert.equal(egna.poang, false);
    assert.equal(egna.stavfel, "sjalv");
    assert.deepEqual(egna.granser, { gul: 50, gron: 75 });
    assert.deepEqual(tillfalleInstallningar({ granser: { gul: 0, gron: 5 } }).granser, { gul: 60, gron: 85 });
    assert.equal(tillfalleInstallningar({ stavfel: "x" }).stavfel, "auto");
    const src = readFileSync(new URL("../src/prov/prov-tillfalle-data.js", import.meta.url), "utf8");
    assert.equal((src.match(/installningar: tillfalleInstallningar\(prov\.installningar\)/g) || []).length, 2, "skapa och öppna");
  });
  it("kedjan: tillfällets gränser (reglaget) → provets → 60/85", () => {
    const prov = { granser: { gul: 50, gron: 75 } };
    assert.deepEqual(granserFor({ granser: { gul: 40, gron: 90 } }, prov), { gul: 40, gron: 90 }, "reglaget på tillfället vinner");
    assert.deepEqual(granserFor({ poang: true }, prov), { gul: 50, gron: 75 }, "tillfället utan gränser → provets");
    assert.deepEqual(granserFor({ granser: { gul: 0, gron: 5 } }, prov), { gul: 50, gron: 75 }, "ogiltiga på tillfället → provets");
    assert.deepEqual(granserFor({}, {}), { gul: 60, gron: 85 });
    assert.deepEqual(granserFor(), { gul: 60, gron: 85 });
    // Kopian till ett nytt tillfälle bär provets gränser; reglaget ändrar bara tillfället.
    const tf = tillfalleInstallningar(prov);
    assert.deepEqual(granserFor(tf), { gul: 50, gron: 75 });
    assert.deepEqual(granserFor({ ...tf, granser: { gul: 30, gron: 60 } }, prov), { gul: 30, gron: 60 });
    assert.deepEqual(prov.granser, { gul: 50, gron: 75 }, "provet orört");
  });
  it("provInfo i rättningen bär tillfällets gränser; äldre provInfo.granser ritas som förut", () => {
    const src = readFileSync(new URL("../src/prov/prov-statistik.js", import.meta.url), "utf8");
    assert.match(src, /granser: granserFor\(tf\?\.installningar\)/, "provInfoDok");
    assert.match(src, /granserFor\(\{ granser: r\.provInfo\?\.granser \}\)/, "historiken");
  });
  it("granserFor: provets gränser, ogiltiga → standard", () => {
    assert.deepEqual(granserFor({ granser: { gul: 50, gron: 75 } }), { gul: 50, gron: 75 });
    assert.deepEqual(granserFor({ granser: { gul: 40, gron: 70 } }), { gul: 40, gron: 70 }, "ett äldre provs sparade gränser gäller");
    assert.deepEqual(granserFor({ granser: { gul: 0, gron: 70 } }), { gul: 60, gron: 85 });
    assert.deepEqual(granserFor({ granser: { gul: 90, gron: 70 } }), { gul: 60, gron: 85 });
  });
  it("färgerna följer provets gränser (50/75) och standarden (60/85)", () => {
    const g = granserFor({ granser: { gul: 50, gron: 75 } });
    assert.deepEqual([0.49, 0.5, 0.74, 0.75].map((a) => fargFor(a, g)), ["rod", "gul", "gul", "gron"]);
    const std = granserFor({});
    assert.deepEqual([0.49, 0.5, 0.74, 0.75, 0.85].map((a) => fargFor(a, std)), ["rod", "rod", "gul", "gul", "gron"]);
  });
  it("klassöversikten färgar med tillfällets gränser", () => {
    const p = prov({}).value;
    const { fragor, facit } = delaUppProv(p);
    // q4 rätt, q1 delvis (1/2), q2 fel, q3 ¾ → (1 + 1 + 0 + 1.5) / 7 = 50 %.
    const svar = { q1: "Stokholm", q2: "Brika", q3: ["åskans", "visdomenz"], q4: 0 };
    const r = godkannAlla(nyRattning({ elevId: "a", classId: "4a", provNamn: "P", fragor, svar, facit }), fragor);
    const farg = (installningar) => klassOversikt({
      fragor, med: ["a"], namn: { a: "Ada" }, svarAv: (uid, fid) => svar[fid], rattningar: { a: r }, installningar,
    }).rader[0].farg;
    assert.equal(farg({ poang: true }), "rod", "gammalt tillfälle utan gränser: 50 % < 60 %");
    assert.equal(farg({ poang: true, granser: { gul: 50, gron: 75 } }), "gul");
    assert.equal(farg({ poang: true, granser: { gul: 30, gron: 50 } }), "gron");
  });
});

describe("redigeraren", () => {
  it("nytt prov: auto och 60/85; gammalt dokument utan fälten får standarden", () => {
    assert.equal(nyttProv().installningar.stavfel, "auto");
    assert.deepEqual(nyttProv().installningar.granser, { gul: 60, gron: 85 });
    const gammalt = provFranDok({ namn: "Gammalt", installningar: { poang: true, nivaer: false }, fragor: [] });
    assert.equal(gammalt.installningar.stavfel, "auto");
    assert.deepEqual(gammalt.installningar.granser, { gul: 60, gron: 85 });
    const eget = provFranDok({ namn: "Eget", installningar: { stavfel: "sjalv", granser: { gul: 50, gron: 75 } }, fragor: [] });
    assert.equal(eget.installningar.stavfel, "sjalv");
    assert.deepEqual(eget.installningar.granser, { gul: 50, gron: 75 });
  });
  it("ett sparat prov ser oförändrat ut efter att gränserna skrivits tillbaka (Firestore ordnar nycklarna gron, gul)", () => {
    const p = provFranDok({ namn: "P", installningar: { granser: { gron: 75, gul: 50 } }, fragor: [] });
    const fore = bild(p);
    const efter = { ...p, installningar: { ...p.installningar, granser: { gul: 50, gron: 75 } } };
    assert.equal(bild(efter), fore);
  });
  it("fältet i redigeraren och översikten utgår från samma hjälpare – inga hårdkodade gränser", () => {
    const filer = ["prov-stat-vy.js", "prov-klass-statistik.js", "prov-statistik-fordjupad.js", "prov-fordjupad-vy.js", "prov-utskrift.js", "larare/provl-bedomning.js"];
    for (const fil of filer) {
      const src = readFileSync(new URL(`../src/prov/${fil}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(src, /\b(40|70)\s*%/, `${fil}: gammal hårdkodad gräns`);
      assert.doesNotMatch(src, /gul:\s*\d+\s*,\s*gron:\s*\d+/, `${fil}: hårdkodade gränser`);
    }
  });
});
