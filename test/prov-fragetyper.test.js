// ============================================================================
// Prov (#738, spec docs/UTVECKLINGSUPPDRAG_PROV.md §2 + testlistan):
// frågetypsregistret och varje typs validera (giltigt/ogiltigt), utanFacit
// (inget facit läcker), forslag med delpoäng, arBesvarad och rensaSvar.
// Ren Node: node --test test/prov-fragetyper.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAGETYPER, TYP_IDS, arFraga, fragetyp } from "../src/prov/prov-fragetyper.js";
import { typValjare } from "../src/prov/prov-validera.js";
import { delpoang } from "../src/prov/prov-rattning.js";
import { tolkaLucktext } from "../src/prov/typer/lucktext.js";
import { blanda } from "../src/prov/typer/delat.js";
import { EXEMPEL, elevFraga, forslag, giltig } from "./helpers/prov-exempel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("registret", () => {
  it("har Etapp 1:s nio typer, var och en i en egen fil i src/prov/typer/", () => {
    assert.deepEqual(TYP_IDS, ["flerval", "flerval-flera", "santfalskt", "kortsvar", "lucktext", "para", "ordna", "fritext", "text"]);
    const filer = readdirSync(join(SRC, "prov/typer")).filter((f) => f !== "delat.js").map((f) => f.replace(/\.js$/, ""));
    assert.deepEqual(filer.sort(), [...TYP_IDS].sort());
  });
  it("varje typ uppfyller kontraktet", () => {
    for (const t of FRAGETYPER) {
      for (const k of ["id", "namn", "ikon", "beskrivning"]) assert.equal(typeof t[k], "string", `${t.id}.${k}`);
      assert.equal(typeof t.autoratt, "boolean", t.id);
      for (const k of ["validera", "facit", "utanFacit", "tomtSvar", "arBesvarad", "rensaSvar", "forslag"]) {
        assert.equal(typeof t[k], "function", `${t.id}.${k}`);
      }
      assert.ok(EXEMPEL[t.id], `exempel saknas för ${t.id}`);
    }
    assert.equal(fragetyp("okand"), null);
    assert.equal(arFraga({ typ: "text" }), false);
    assert.equal(arFraga({ typ: "kortsvar" }), true);
    assert.deepEqual(typValjare().map((t) => t.id), TYP_IDS);
  });
  it("bara fritext och text saknar automatiska förslag", () => {
    assert.deepEqual(FRAGETYPER.filter((t) => !t.autoratt).map((t) => t.id), ["fritext", "text"]);
    assert.equal(forslag("fritext", "Ett långt svar"), null);
    assert.equal(forslag("text", null), null);
  });
});

describe("validera: giltigt och ogiltigt per typ", () => {
  const ogiltiga = {
    flerval: [[{ alternativ: ["bara ett"] }, /2–6 alternativ/], [{ ratt: 5 }, /pekar inte/], [{ ratt: undefined }, /"ratt"/],
      [{ alternativ: ["a", "A", "b"] }, /finns redan/]],
    "flerval-flera": [[{ ratt: [] }, /saknas eller är tom/], [{ ratt: [0, 9] }, /inte finns: 9/]],
    santfalskt: [[{ ratt: "kanske" }, /true \(sant\) eller false/]],
    kortsvar: [[{ godkanda: [] }, /minst ett godkänt svar krävs/], [{ godkanda: ["x".repeat(101)] }, /högst 100/],
      [{ exaktStavning: "ja" }, /exaktStavning/]],
    lucktext: [[{ lucktext: "Inga luckor här." }, /inga luckor/], [{ lucktext: "Tom [[ ]] lucka." }, /lucka 1 saknar svar/],
      [{ lucktext: "Halv [[lucka." }, /\[\[ eller \]\]/]],
    para: [[{ par: [{ vanster: "a", hoger: "1" }, { vanster: "b", hoger: "2" }] }, /3–10 par/],
      [{ par: [{ vanster: "a", hoger: "1" }, { vanster: "b", hoger: "1" }, { vanster: "c", hoger: "3" }] }, /höger led.*finns redan/]],
    ordna: [[{ saker: ["a", "b"] }, /3–10 saker/], [{ saker: ["a", "", "c"] }, /sak 2 är tomt/]],
    fritext: [[{ bedomningsstod: 7 }, /bedomningsstod/]],
    text: [[{ brodtext: "" }, /brodtext/], [{ brodtext: "x".repeat(6001) }, /högst 6000/]],
  };
  for (const id of TYP_IDS) {
    it(id, () => {
      giltig(id);
      for (const [over, fel] of ogiltiga[id]) {
        const r = fragetyp(id).validera({ ...structuredClone(EXEMPEL[id].f), ...over });
        assert.equal(r.ok, false, `${id} ${JSON.stringify(over)}`);
        assert.match(r.fel.join(" | "), fel);
      }
      if (id !== "text") {
        assert.match(fragetyp(id).validera({ ...EXEMPEL[id].f, fraga: " " }).fel.join(), /frågetexten/);
        assert.match(fragetyp(id).validera({ ...EXEMPEL[id].f, fraga: "x".repeat(1001) }).fel.join(), /högst 1000/);
        assert.match(fragetyp(id).validera({ ...EXEMPEL[id].f, poang: 1.5 }).fel.join(), /heltal/);
      }
    });
  }
  it("poäng är 1 som standard, kortsvar har exakt stavning på och skiftläge av", () => {
    const k = giltig("kortsvar");
    assert.equal(k.poang, 1);
    assert.equal(k.exaktStavning, true);
    assert.equal(k.skiftlage, false);
    assert.equal(fragetyp("santfalskt").validera({ ...EXEMPEL.santfalskt.f, ratt: "Sant" }).value.ratt, true);
  });
});

describe("utanFacit: inget facit läcker", () => {
  for (const id of TYP_IDS) {
    it(id, () => {
      const f = giltig(id);
      const ut = fragetyp(id).utanFacit(f);
      const json = JSON.stringify(ut);
      for (const k of ["ratt", "godkanda", "luckor", "par", "ordning", "bedomningsstod", "lucktext", "exaktStavning"]) {
        assert.ok(!(k in ut), `${id}: fältet ${k} finns kvar`);
      }
      for (const s of EXEMPEL[id].hemligt) assert.ok(!json.includes(s), `${id}: "${s}" syns för eleven`);
      assert.equal(ut.id, f.id);
      assert.equal(ut.typ, id);
    });
  }
  it("para: högerleden är blandade (aldrig i facit-ordning) och vänsterleden kvar", () => {
    const ut = elevFraga("para");
    assert.deepEqual(ut.vanster, ["Tor", "Oden", "Freja"]);
    assert.deepEqual([...ut.hoger].sort(), ["Kärlek", "Visdom", "Åska"]);
    assert.notDeepEqual(ut.hoger, ["Åska", "Visdom", "Kärlek"]);
    assert.deepEqual(elevFraga("para").hoger, ut.hoger, "stabil ordning – samma för eleven och rättningen");
  });
  it("ordna: sakerna är blandade, aldrig i rätt ordning", () => {
    const ut = elevFraga("ordna");
    assert.notDeepEqual(ut.saker, EXEMPEL.ordna.f.saker);
    assert.deepEqual([...ut.saker].sort(), [...EXEMPEL.ordna.f.saker].sort());
    for (let i = 0; i < 200; i++) {
      const l = ["a", "b", "c"];
      assert.notDeepEqual(blanda(l, `frö${i}`), l, `frö${i}`);
    }
  });
  it("lucktext: texten blir delar med numrerade luckor", () => {
    const ut = elevFraga("lucktext");
    assert.deepEqual(ut.delar, [{ t: "Vikingarna seglade till " }, { lucka: 0 }, { t: " och " }, { lucka: 1 }, { t: "." }]);
    assert.equal(ut.antalLuckor, 2);
    assert.deepEqual(tolkaLucktext("[[a| b |a]] x").luckor, [["a", "b"]]);
  });
});

describe("forslag med delpoäng", () => {
  it("flerval och sant/falskt: rätt eller fel", () => {
    assert.deepEqual(forslag("flerval", 0), { poang: 1, maxPoang: 1, ratt: true });
    assert.deepEqual(forslag("flerval", 2), { poang: 0, maxPoang: 1, ratt: false });
    assert.deepEqual(forslag("flerval", null), { poang: 0, maxPoang: 1, ratt: false });
    assert.equal(forslag("santfalskt", false).ratt, true);
    assert.equal(forslag("santfalskt", true).ratt, false);
    assert.equal(forslag("santfalskt", null).ratt, false);
  });
  it("flerval-flera: rätt kryss minus fel kryss, aldrig under 0", () => {
    assert.deepEqual(forslag("flerval-flera", [0, 1]), { poang: 2, maxPoang: 2, ratt: true });
    assert.deepEqual(forslag("flerval-flera", [0]), { poang: 1, maxPoang: 2, ratt: "delvis" });
    assert.deepEqual(forslag("flerval-flera", [0, 1, 2]), { poang: 1, maxPoang: 2, ratt: "delvis" });
    assert.deepEqual(forslag("flerval-flera", [0, 2, 3]), { poang: 0, maxPoang: 2, ratt: false });
    assert.deepEqual(forslag("flerval-flera", [0, 1, 2, 3]), { poang: 0, maxPoang: 2, ratt: false });
    assert.deepEqual(forslag("flerval-flera", [0, 0, 1]), { poang: 2, maxPoang: 2, ratt: true }, "dubbletter räknas en gång");
  });
  it("kortsvar: normaliserat rätt, ett stavfel = delvis bara utan exakt stavning", () => {
    assert.equal(forslag("kortsvar", "  birka. ").ratt, true);
    assert.equal(forslag("kortsvar", "Birk").ratt, false, "exakt stavning är standard");
    const f = giltig("kortsvar");
    const t = fragetyp("kortsvar");
    const fa = { ...t.facit(f), exaktStavning: false };
    assert.deepEqual(t.forslag("Birk", fa, t.utanFacit(f)), { poang: 0.5, maxPoang: 1, ratt: "delvis" });
    assert.equal(t.forslag("Bir", fa, t.utanFacit(f)).ratt, false, "två bokstäver fel");
  });
  it("lucktext: delpoäng per lucka, alla varianter godkänns", () => {
    assert.deepEqual(forslag("lucktext", ["Konstantinopel", "bagdad"]), { poang: 2, maxPoang: 2, ratt: true });
    assert.deepEqual(forslag("lucktext", ["Miklagård", "Rom"]), { poang: 1, maxPoang: 2, ratt: "delvis" });
    assert.deepEqual(forslag("lucktext", ["", ""]), { poang: 0, maxPoang: 2, ratt: false });
    const t = fragetyp("lucktext");
    const f = giltig("lucktext");
    assert.deepEqual(t.luckResultat(["miklagård", "x"], t.facit(f)), [true, false]);
  });
  it("para: delpoäng per rätt par", () => {
    assert.deepEqual(forslag("para", ["Åska", "Visdom", "Kärlek"]), { poang: 3, maxPoang: 3, ratt: true });
    assert.deepEqual(forslag("para", ["Åska", "Kärlek", "Visdom"]), { poang: 1, maxPoang: 3, ratt: "delvis" });
    assert.deepEqual(forslag("para", ["", "", ""]), { poang: 0, maxPoang: 3, ratt: false });
  });
  it("ordna: delpoäng per sak på rätt plats", () => {
    const [a, b, c, d] = EXEMPEL.ordna.f.saker;
    assert.deepEqual(forslag("ordna", [a, b, c, d]), { poang: 4, maxPoang: 4, ratt: true });
    assert.deepEqual(forslag("ordna", [a, b, d, c]), { poang: 2, maxPoang: 4, ratt: "delvis" });
    assert.deepEqual(forslag("ordna", []), { poang: 0, maxPoang: 4, ratt: false });
  });
  it("delpoängen avrundas till halva poäng", () => {
    assert.equal(delpoang(1 / 3, 1), 0.5);
    assert.equal(delpoang(1 / 3, 2), 0.5);
    assert.equal(delpoang(2 / 3, 3), 2);
    assert.equal(delpoang(1.4, 2), 2);
    assert.equal(delpoang(-1, 2), 0);
  });
});

describe("arBesvarad och rensaSvar", () => {
  const fall = {
    flerval: [[null, false], [0, true]],
    "flerval-flera": [[[], false], [[1], true]],
    santfalskt: [[null, false], [false, true]],
    kortsvar: [["", false], ["  ", false], ["Birka", true]],
    lucktext: [[["", ""], false], [["", "Bagdad"], true]],
    para: [[["", "", ""], false], [["Åska", "", ""], true]],
    ordna: [[[], false], [["a", "b", "c"], true]],
    fritext: [["", false], ["Svar", true]],
  };
  for (const [id, lista] of Object.entries(fall)) {
    it(id, () => {
      const f = elevFraga(id);
      const t = fragetyp(id);
      assert.equal(t.arBesvarad(t.tomtSvar(f), f), false, "tomtSvar räknas som obesvarat");
      for (const [svar, vantat] of lista) assert.equal(t.arBesvarad(svar, f), vantat, JSON.stringify(svar));
    });
  }
  it("rensaSvar klipper och tar bort okända val", () => {
    assert.equal(fragetyp("kortsvar").rensaSvar("x".repeat(150)).length, 100);
    assert.equal(fragetyp("fritext").rensaSvar("x".repeat(5000)).length, 4000);
    assert.equal(fragetyp("flerval").rensaSvar(9, elevFraga("flerval")), null);
    assert.deepEqual(fragetyp("flerval-flera").rensaSvar([3, 3, 1, 7, "x"], elevFraga("flerval-flera")), [1, 3]);
    assert.deepEqual(fragetyp("para").rensaSvar(["Åska", "Hitta på"], elevFraga("para")), ["Åska", "", ""]);
    assert.deepEqual(fragetyp("ordna").rensaSvar(["a"], elevFraga("ordna")), []);
    const o = elevFraga("ordna");
    assert.deepEqual(fragetyp("ordna").rensaSvar([...o.saker].reverse(), o), [...o.saker].reverse());
    assert.deepEqual(fragetyp("lucktext").rensaSvar(["a", 5, "c"], elevFraga("lucktext")), ["a", ""]);
  });
});
