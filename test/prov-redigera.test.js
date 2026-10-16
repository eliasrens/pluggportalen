// ============================================================================
// Prov (#739, spec §8): skapa och redigera – den DOM-fria logiken.
//   prov-redigera-ops.js: formulärets fält → fråga per typ, spara/flytta/
//     duplicera/ta bort, tillDokument (validateProv + ägarfälten), kopiera,
//     klistra in från AI (JSON med/utan staket, frågor sist, nya id vid krock)
//   prov-lista-ops.js: "Mina prov" per ägare (som områdena, #680)
//   prov-prompt.js: schema + exempel bara för valda typer, reglerna
//   lärarfliken i TEACHER_TABS (lazy) och radtaket för src/prov/larare/
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAGETYPER, TYP_IDS } from "../src/prov/prov-fragetyper.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import {
  dupliceraFraga, flyttaFraga, fragaFranFalt, fragaRubrik, fyllFranAi, kopieraProv, laggTillFragor, nyttId,
  nyttProv, plockaJson, provFranDok, sparaFraga, taBortFraga, tillDokument, tolkaAiJson, tomFraga,
} from "../src/prov/prov-redigera-ops.js";
import { datumText, delaProvlista, kanAndra, provRad, tidMs } from "../src/prov/prov-lista-ops.js";
import { EXEMPEL_TYP, SCHEMA_TYP, buildProvPrompt, tolkaAntal, valdaTyper } from "../src/prov/prov-prompt.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const ADMIN = { admin: true, uid: "admin1", name: "Admin", classIds: null };
const ANNA = { admin: false, uid: "anna", name: "Årskurs 4", classIds: new Set(["k4"]) };
const BO = { admin: false, uid: "bo", name: "Årskurs 5", classIds: new Set(["k5"]) };

// Formulärets fält per typ (som DOM:en samlar dem).
const FALT = {
  flerval: { fraga: "Var låg Birka?", poang: "1", alternativ: ["Björkö", "", "Gotland", "Öland"], ratt: 2 },
  "flerval-flera": { fraga: "Vilka är städer?", poang: "2", alternativ: ["Birka", "", "Hedeby", "Rom"], ratt: [0, 2] },
  santfalskt: { fraga: "Vikingar hade horn.", poang: "", ratt: "false" },
  kortsvar: { fraga: "Handelsstaden?", poang: "1", godkanda: " Birka \n\nBjörkö\n", exaktStavning: false, skiftlage: false },
  lucktext: { fraga: "Fyll i.", poang: "2", lucktext: "Till [[Miklagård|Konstantinopel]] och [[Bagdad]].", exaktStavning: true, skiftlage: true },
  para: { fraga: "Para ihop.", poang: "3", par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "", hoger: "" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }] },
  ordna: { fraga: "Ordna.", poang: "3", saker: ["Sten", "", "Brons", "Järn"] },
  fritext: { fraga: "Beskriv.", poang: "4", bedomningsstod: "  Djur och hus  " },
  text: { titel: "Birka", brodtext: "Birka låg på Björkö." },
};

describe("formulärets fält → fråga (alla typer)", () => {
  it("varje typ i registret har ett formulärfall och blir en giltig fråga", () => {
    for (const id of TYP_IDS) {
      assert.ok(FALT[id], `fält saknas för ${id}`);
      const r = sparaFraga(nyttProv(), null, id, FALT[id]);
      assert.ok(r.ok, `${id}: ${r.errors.join("; ")}`);
      assert.equal(r.prov.fragor.length, 1);
      assert.equal(r.prov.fragor[0].typ, id);
      assert.equal(r.prov.fragor[0].id, "f1");
    }
  });
  it("tomma alternativrader tas bort och rätt-markeringen följer med", () => {
    const f = fragaFranFalt("flerval", FALT.flerval, "f1");
    assert.deepEqual(f.alternativ, ["Björkö", "Gotland", "Öland"]);
    assert.equal(f.ratt, 1, "Gotland – rad 2 → index 1");
    const ff = fragaFranFalt("flerval-flera", FALT["flerval-flera"], "f1");
    assert.deepEqual(ff.alternativ, ["Birka", "Hedeby", "Rom"]);
    assert.deepEqual(ff.ratt, [0, 1]);
  });
  it("rätt markerat på en tom rad → begripligt fel (inte JSON-felet)", () => {
    const r = sparaFraga(nyttProv(), null, "flerval", { ...FALT.flerval, ratt: 1 });
    assert.equal(r.ok, false);
    assert.deepEqual(r.errors, ["Markera vilket alternativ som är rätt (och att det inte är tomt)."]);
    const s = sparaFraga(nyttProv(), null, "santfalskt", { fraga: "X", ratt: undefined });
    assert.deepEqual(s.errors, ["Välj Sant eller Falskt."]);
  });
  it("kortsvar: en rad per godkänt svar, normaliseringsvalen", () => {
    const r = sparaFraga(nyttProv(), null, "kortsvar", FALT.kortsvar);
    const f = r.prov.fragor[0];
    assert.deepEqual(f.godkanda, ["Birka", "Björkö"]);
    assert.equal(f.exaktStavning, false);
    assert.equal(f.skiftlage, false);
    const l = sparaFraga(nyttProv(), null, "lucktext", FALT.lucktext).prov.fragor[0];
    assert.equal(l.exaktStavning, true);
    assert.equal(l.skiftlage, true);
  });
  it("tomma parrader bort, poäng tomt = 1, hjälptext bara när ifylld, bedömningsstöd trimmas", () => {
    assert.equal(fragaFranFalt("para", FALT.para).par.length, 3);
    assert.equal(sparaFraga(nyttProv(), null, "santfalskt", FALT.santfalskt).prov.fragor[0].poang, 1);
    assert.equal("hjalptext" in fragaFranFalt("kortsvar", { ...FALT.kortsvar, hjalptext: "  " }), false);
    assert.equal(fragaFranFalt("kortsvar", { ...FALT.kortsvar, hjalptext: " Svara med ett ord " }).hjalptext, "Svara med ett ord");
    assert.equal(sparaFraga(nyttProv(), null, "fritext", FALT.fritext).prov.fragor[0].bedomningsstod, "Djur och hus");
  });
  it("fel per fält med stor bokstav och punkt, provet oförändrat", () => {
    const p = nyttProv();
    const r = sparaFraga(p, null, "kortsvar", { fraga: "", godkanda: "" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.includes('Frågetexten ("fraga") saknas eller är tom.'), r.errors.join("|"));
    assert.ok(r.errors.some((e) => /^Minst ett godkänt svar krävs/.test(e)));
    assert.equal(r.prov, p);
    assert.equal(sparaFraga(p, null, "kortsvar", { ...FALT.kortsvar, poang: "1,5" }).errors[0], '"poang" måste vara ett heltal 0–100.');
  });
  it("redigera behåller frågans id och plats", () => {
    let p = sparaFraga(nyttProv(), null, "kortsvar", FALT.kortsvar).prov;
    p = sparaFraga(p, null, "flerval", FALT.flerval).prov;
    const r = sparaFraga(p, 0, "kortsvar", { ...FALT.kortsvar, fraga: "Ny text" });
    assert.equal(r.prov.fragor[0].id, "f1");
    assert.equal(r.prov.fragor[0].fraga, "Ny text");
    assert.equal(r.prov.fragor[1].id, "f2");
  });
  it("tomFraga: nästa lediga id och typens tomma fält", () => {
    const p = { fragor: [{ id: "f1" }, { id: "f3" }] };
    assert.equal(nyttId(p.fragor), "f2");
    for (const id of TYP_IDS) assert.equal(tomFraga(id, p.fragor).typ, id);
    assert.equal(tomFraga("flerval", p.fragor).alternativ.length, 4);
    assert.equal("fraga" in tomFraga("text"), false);
    assert.throws(() => tomFraga("glosor"));
  });
});

describe("ordna, duplicera, ta bort", () => {
  const p = { ...nyttProv(), fragor: [{ id: "f1", typ: "kortsvar" }, { id: "f2", typ: "flerval" }, { id: "f3", typ: "text" }] };
  it("flytta upp/ned, utanför listan = oförändrat", () => {
    assert.deepEqual(flyttaFraga(p, 1, -1).fragor.map((f) => f.id), ["f2", "f1", "f3"]);
    assert.deepEqual(flyttaFraga(p, 1, 1).fragor.map((f) => f.id), ["f1", "f3", "f2"]);
    assert.equal(flyttaFraga(p, 0, -1), p);
    assert.equal(flyttaFraga(p, 2, 1), p);
    assert.deepEqual(p.fragor.map((f) => f.id), ["f1", "f2", "f3"], "originalet orört");
  });
  it("duplicera lägger kopian direkt efter med nytt id; ta bort", () => {
    const d = dupliceraFraga(p, 0);
    assert.deepEqual(d.fragor.map((f) => f.id), ["f1", "f4", "f2", "f3"]);
    assert.notEqual(d.fragor[1], p.fragor[0], "djup kopia");
    assert.deepEqual(taBortFraga(p, 1).fragor.map((f) => f.id), ["f1", "f3"]);
  });
});

describe("spara: tillDokument (validateProv + ägarskap som områdena)", () => {
  const prov = () => ({ ...nyttProv(), namn: " Vikingaprov ", fragor: [structuredClone(EXEMPEL.kortsvar.f)] });
  it("nytt prov stämplas med kontot", () => {
    const r = tillDokument(prov(), null, ANNA);
    assert.ok(r.ok);
    assert.equal(r.value.namn, "Vikingaprov");
    assert.equal(r.value.createdBy, "anna");
    assert.equal(r.value.createdByName, "Årskurs 4");
    assert.equal(r.value.installningar.poang, true);
  });
  it("befintligt prov behåller ägaren även när admin sparar; fälten i arbetskopian litas inte på", () => {
    const r = tillDokument({ ...prov(), createdBy: "fusk" }, { createdBy: "anna", createdByName: "Årskurs 4" }, ADMIN);
    assert.equal(r.value.createdBy, "anna");
  });
  it("fel från validateProv stoppar sparningen", () => {
    const r = tillDokument({ ...prov(), namn: "" }, null, ANNA);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /namnet/);
    assert.equal(r.value, null);
  });
  it("provFranDok → tillDokument ger samma innehåll (rundtur)", () => {
    const dok = { ...tillDokument(prov(), null, ANNA).value, id: "x", skapad: { seconds: 1 } };
    const igen = tillDokument(provFranDok(dok), dok, ANNA).value;
    assert.deepEqual(igen.fragor, dok.fragor);
    assert.equal(igen.createdBy, "anna");
    assert.equal("skapad" in provFranDok(dok), false);
  });
  it("kopiera: (kopia), ingen ägare, namnet håller sig inom 80 tecken", () => {
    const k = kopieraProv({ namn: "Prov", createdBy: "bo", fragor: [EXEMPEL.flerval.f] });
    assert.equal(k.namn, "Prov (kopia)");
    assert.equal("createdBy" in k, false);
    assert.equal(tillDokument(k, null, ANNA).value.createdBy, "anna");
    assert.ok(Array.from(kopieraProv({ namn: "x".repeat(80), fragor: [] }).namn).length <= 80);
  });
});

describe("Mina prov: listan per ägare", () => {
  const doks = [
    { id: "a", namn: "Annas", createdBy: "anna", fragor: [EXEMPEL.flerval.f, EXEMPEL.text.f], uppdaterad: { seconds: 200 } },
    { id: "b", namn: "Bos", createdBy: "bo", createdByName: "Årskurs 5", fragor: [], uppdaterad: { seconds: 300 } },
    { id: "c", namn: "Gammalt", fragor: [] },
  ];
  it("årskurskontot: egna i Mina, resten hos kollegorna och går bara att kopiera", () => {
    const { mina, andras } = delaProvlista(doks, ANNA);
    assert.deepEqual(mina.map((r) => r.id), ["a"]);
    assert.deepEqual(andras.map((r) => r.id), ["b", "c"]);
    assert.equal(andras[0].kanAndra, false);
    assert.equal(andras[0].agare, "Årskurs 5");
    assert.equal(andras[1].agare, "Admin");
  });
  it("admin: prov utan ägare räknas som egna och allt går att ändra", () => {
    const { mina, andras } = delaProvlista(doks, ADMIN);
    assert.deepEqual(mina.map((r) => r.id), ["c"]);
    assert.ok(andras.every((r) => r.kanAndra));
    assert.equal(kanAndra(doks[1], BO), true);
    assert.equal(kanAndra(doks[1], ANNA), false);
  });
  it("antal frågor utan textblock, senast ändrat", () => {
    const r = provRad(doks[0], ANNA);
    assert.equal(r.antal, 1);
    assert.equal(r.textblock, 1);
    assert.equal(r.andrad, 200000);
    assert.equal(tidMs({ toMillis: () => 5 }), 5);
    assert.equal(tidMs(null), null);
    assert.equal(datumText(null), "–");
    assert.match(datumText(Date.UTC(2020, 9, 18, 12)), /2020/);
  });
});

describe("kortens sammanfattning", () => {
  it("en rad per typ", () => {
    for (const t of FRAGETYPER) assert.ok(fragaRubrik(validateProv({ namn: "x", fragor: [EXEMPEL.kortsvar.f, EXEMPEL[t.id].f] }).value.fragor[1]));
    assert.equal(fragaRubrik({ ...EXEMPEL.flerval.f, poang: 1 }), "3 alternativ · rätt: Björkö · 1 p");
    assert.match(fragaRubrik({ ...EXEMPEL.kortsvar.f, exaktStavning: false, poang: 2 }), /Birka \/ Björkö · ett stavfel = delvis · 2 p/);
  });
});

describe("klistra in från AI (§8.2)", () => {
  const json = JSON.stringify({ namn: "AI-prov", amne: "Historia", arskurs: "ak5", fragor: [EXEMPEL.flerval.f, EXEMPEL.kortsvar.f] });
  it("JSON med kodstaket och text runt om tolkas", () => {
    assert.equal(plockaJson(`Här är provet:\n\`\`\`json\n${json}\n\`\`\`\nLycka till!`), json);
    const r = tolkaAiJson(`Visst! ${json}`);
    assert.ok(r.ok, r.errors.join("; "));
    assert.equal(r.value.fragor.length, 2);
  });
  it("svenska fel med plats före något läggs till", () => {
    const r = tolkaAiJson(JSON.stringify({ namn: "x", fragor: [{ typ: "kortsvar", fraga: "Vad?" }] }));
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /^Fråga 1 \(Kort svar\): minst ett godkänt svar krävs/);
    assert.match(tolkaAiJson("{ namn: ").errors[0], /^Texten är inte giltig JSON/);
    assert.deepEqual(tolkaAiJson("  ").errors, ["Klistra in AI:ns svar först."]);
  });
  it("en ensam lista med frågor går också", () => {
    const r = tolkaAiJson(JSON.stringify([EXEMPEL.santfalskt.f]));
    assert.ok(r.ok);
    assert.equal(r.value.fragor[0].typ, "santfalskt");
  });
  it("i ett befintligt prov läggs frågorna sist; krockande id byts", () => {
    const fore = { ...nyttProv(), namn: "Mitt", fragor: [{ id: "q1", typ: "kortsvar", fraga: "a", godkanda: ["a"], poang: 1 }] };
    const ai = tolkaAiJson(json).value;
    const r = fyllFranAi(fore, ai);
    assert.ok(r.ok);
    assert.deepEqual(r.prov.fragor.map((f) => f.id), ["q1", "f1", "q4"]);
    assert.equal(r.prov.namn, "Mitt", "lärarens namn skrivs inte över");
    assert.equal(r.prov.amne, "Historia", "tomt ämne fylls i");
    assert.equal(r.prov.arskurs, "ak5");
    assert.equal(fore.fragor.length, 1, "originalet orört");
    assert.ok(tillDokument(r.prov, null, ANNA).ok);
  });
  it("taket 60 gäller även inklistrade frågor", () => {
    const fullt = { ...nyttProv(), fragor: Array.from({ length: 59 }, (_, i) => ({ id: `x${i}` })) };
    const r = laggTillFragor(fullt, [{ id: "a" }, { id: "b" }]);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /högst 60/);
  });
});

describe("prompten (§8.2)", () => {
  it("varje typ har schema och ett giltigt exempel", () => {
    for (const id of TYP_IDS) {
      assert.ok(SCHEMA_TYP[id], `schema ${id}`);
      const r = validateProv({ namn: "x", fragor: [EXEMPEL_TYP.flerval, EXEMPEL_TYP[id]] });
      assert.ok(r.ok, `${id}: ${r.errors.join("; ")}`);
    }
  });
  it("bara valda typer; inget val = alla; okända bort", () => {
    const p = buildProvPrompt({ typer: ["kortsvar", "fritext", "glosor"], antal: 8, amne: "Historia", arskurs: "ak6" });
    assert.match(p, /"kortsvar" \(Kort svar\)/);
    assert.match(p, /"fritext" \(Fritext\)/);
    assert.doesNotMatch(p, /"flerval" \(Flerval\)/);
    assert.doesNotMatch(p, /"typ": "flerval"/);
    assert.match(p, /årskurs 6 \(ca 12 år\)/);
    assert.match(p, /8 frågor/);
    assert.deepEqual(valdaTyper([]), TYP_IDS);
  });
  it("exemplet i prompten går genom validateProv", () => {
    const p = buildProvPrompt({ typer: TYP_IDS });
    const start = p.indexOf("Exempel på formatet");
    const exempel = JSON.parse(p.slice(p.indexOf("{", start), p.indexOf("\n}", start) + 2));
    assert.ok(validateProv(exempel).ok);
  });
  it("reglerna: svensk text, lika långa alternativ, inget facit i frågan, kortsvarsvarianter, bedömningsstöd", () => {
    const p = buildProvPrompt({});
    for (const re of [/svenska/, /LIKA LÅNGA/, /aldrig facit/, /"godkanda"/, /"bedomningsstod"/, /ENBART giltig JSON/]) assert.match(p, re);
  });
  it("utan poängsättning: inga poang i exemplet; material och önskemål kommer med", () => {
    const p = buildProvPrompt({ poang: false, material: "Birka låg på Björkö.", onskemal: "Svåra frågor" });
    assert.match(p, /"poang": false/);
    assert.doesNotMatch(p, /"poang": \d/);
    assert.match(p, /<<<\nBirka låg på Björkö\.\n>>>/);
    assert.match(p, /Svåra frågor/);
    assert.equal(tolkaAntal("abc"), 10);
    assert.equal(tolkaAntal(500), 40);
  });
});

describe("förhandsvisningen delar provet som när det öppnas", () => {
  it("inget facit i elevens frågor (samma delaUppProv)", () => {
    const value = validateProv({ namn: "x", fragor: Object.values(EXEMPEL).map((e) => e.f) }).value;
    const elev = delaUppProv(value).fragor;
    for (const [id, { f, hemligt }] of Object.entries(EXEMPEL)) {
      const vy = JSON.stringify(elev.find((x) => x.id === f.id));
      for (const h of hemligt) assert.ok(!vy.includes(h), `${id}: ${h}`);
    }
    const src = readFileSync(join(SRC, "prov/larare/provl-forhandsvisa.js"), "utf8");
    assert.match(src, /delaUppProv\(prov\)/);
    assert.doesNotMatch(src, /setDoc|updateDoc|addDoc/, "förhandsvisningen sparar inget");
  });
});

describe("lärarfliken och bootgrafen", () => {
  it("gruppen Prov och en rad i TEACHER_TABS med lazy import", () => {
    const src = readFileSync(join(SRC, "teacher-shared.js"), "utf8");
    assert.match(src, /\{ key: "prov", label: "Prov"/);
    assert.match(src, /tab\("prov", "#\/larare\/prov", "prov", "Mina prov"[^\n]*import\("\.\/prov\/larare\/page-larare-prov\.js"\), "pageLarareProv"\)/);
    assert.doesNotMatch(src, /^import .*prov\//m, "ingen statisk import");
  });
  it("modulerna i src/prov/ är max 400 rader", () => {
    for (const dir of ["prov", "prov/larare"]) {
      for (const f of readdirSync(join(SRC, dir)).filter((x) => /\.(js|css)$/.test(x))) {
        const n = readFileSync(join(SRC, dir, f), "utf8").split("\n").length;
        assert.ok(n <= 400, `${dir}/${f}: ${n}`);
      }
    }
  });
});
