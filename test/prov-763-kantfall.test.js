// ============================================================================
// #763 (Prov 3B) – testarens kantfall: tryck-räkning för 3–10 saker, stabil
// blandning per elev (många elever, alla storlekar, manipulerade koder),
// "Flytta till…" som slumpad invariant över listor med avsnitt/textblock,
// para-tryck i alla ordningar och rättningen av en påbörjad ordning
// (förslagen vid inlämning ↔ "Rätta alla").
// Körs med: node --test test/prov-763-kantfall.test.js
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fragetyp } from "../src/prov/prov-fragetyper.js";
import { blanda, blandningar, elevBlandning } from "../src/prov/typer/delat.js";
import { paraTryck } from "../src/prov/prov-ordna-para.js";
import { flyttaTillIndex, flyttaTillPlats, indexForPlats, platsGrans } from "../src/prov/prov-flytta-ops.js";
import { delaUppProv, fragaNummer } from "../src/prov/prov-modell.js";
import { forslagFor } from "../src/prov/prov-rattning-logik.js";
import { autoBedom } from "../src/prov/prov-ratta-alla.js";
import { installeraDom } from "./helpers/prov-mini-dom.js";

const ordna = fragetyp("ordna");
const para = fragetyp("para");
const saker = (n) => Array.from({ length: n }, (_, i) => `Sak ${i + 1}`);
const ordnaF = (n, id = `o${n}`) => ({ id, typ: "ordna", fraga: "Ordna.", saker: saker(n), poang: n });
const paraF = (n, id = `p${n}`) => ({
  id, typ: "para", fraga: "Para.", poang: n,
  par: Array.from({ length: n }, (_, i) => ({ vanster: `B${i + 1}`, hoger: `Förklaring ${i + 1}` })),
});
const ELEVER = Array.from({ length: 30 }, (_, i) => `uid-${i}-${(i * 7919).toString(36)}`);

let dom;
before(() => { dom = installeraDom(); });
after(() => dom.avinstallera());

function rita(typ, f, svar, o = {}) {
  const e = typ.utanFacit(f);
  const sparat = { svar, antal: 0 };
  const el = typ.renderElev(e, svar, { onChange: (v) => { sparat.svar = v; sparat.antal++; }, ...o });
  return { el, e, sparat };
}
const kvar = (el) => el.querySelectorAll("[data-kvar-sak]");
const iSvar = (el) => el.querySelectorAll("[data-svar]");

describe("ordna: tryck-räkning för alla storlekar (3–10)", () => {
  for (let n = 3; n <= 10; n++) {
    it(`${n} saker: exakt ${n} tryck i valfri ordning ger ett fullständigt svar`, () => {
      const { el, e, sparat } = rita(ordna, ordnaF(n), [], { elevId: ELEVER[n] });
      let tryck = 0;
      // Tryck sist i Kvar varje gång (inte bara först) – nästa lediga plats ändå.
      while (kvar(el).length) {
        const k = kvar(el);
        const valt = k[(tryck * 3) % k.length];
        const t = valt.textContent;
        valt.click();
        tryck++;
        assert.equal(sparat.svar.at(-1), t);
        assert.equal(sparat.svar.length, tryck);
      }
      assert.equal(tryck, n);
      assert.equal(ordna.arBesvarad(sparat.svar, e), true);
      assert.equal(new Set(sparat.svar).size, n);
      assert.deepEqual(ordna.rensaSvar(sparat.svar, e), sparat.svar);
    });
  }

  it("ta bort varje plats (första, mitten, sista) – resten flyttar upp, inga hål", () => {
    const n = 6;
    for (let ta = 0; ta < n; ta++) {
      const { el, sparat } = rita(ordna, ordnaF(n), [], { elevId: "e1" });
      for (let i = 0; i < n; i++) kvar(el)[0].click();
      const fore = [...sparat.svar];
      iSvar(el)[ta].click();
      assert.deepEqual(sparat.svar, fore.filter((_, j) => j !== ta), `tog bort plats ${ta + 1}`);
      assert.equal(el.querySelectorAll(".provv-ordna-ledig").length, 1, "en ledig plats, sist");
      assert.equal(el.querySelector('[data-plats="5"]').classList.contains("provv-ordna-ledig"), true);
      // ...och ett tryck på saken i Kvar lägger den sist igen (inte tillbaka på sin gamla plats)
      kvar(el)[0].click();
      assert.equal(sparat.svar.at(-1), fore[ta]);
    }
  });

  it("påbörjat svar efter omladdning: Kvar = resten, nästa tryck fortsätter på nästa lediga plats", () => {
    const f = ordnaF(5);
    const forst = rita(ordna, f, [], { elevId: "e1" });
    kvar(forst.el)[1].click();
    kvar(forst.el)[1].click();
    const sparat = forst.sparat.svar;
    const igen = rita(ordna, f, sparat, { elevId: "e1" });
    assert.deepEqual(iSvar(igen.el).map((b) => b.textContent), sparat);
    assert.equal(kvar(igen.el).length, 3);
    assert.equal(igen.el.querySelector(".provv-ordna-status").textContent, "2 av 5 placerade");
    kvar(igen.el)[0].click();
    assert.equal(igen.sparat.svar.length, 3);
    assert.deepEqual(igen.sparat.svar.slice(0, 2), sparat);
  });

  it('"Börja om" är avstängd utan placerade och saknas i låst läge; låst = alla knappar avstängda', () => {
    const { el } = rita(ordna, ordnaF(4), [], { elevId: "e1" });
    const borja = el.querySelectorAll("button").find((b) => b.textContent === "Börja om");
    assert.equal(borja.disabled, true);
    const last = rita(ordna, ordnaF(4), ["Sak 2"], { elevId: "e1", lasLage: true }).el;
    assert.equal(last.querySelectorAll("button").find((b) => b.textContent === "Börja om"), undefined);
    assert.ok(last.querySelectorAll("button").every((b) => b.disabled));
  });

  it("manipulerade/trasiga sparade svar → inte rörd (ingen krasch)", () => {
    const e = ordna.utanFacit(ordnaF(4));
    for (const v of [null, undefined, "Sak 1", 3, {}, [1, 2], ["Sak 1", null], ["sak 1"], ["Sak 1", "Sak 1"]]) {
      assert.deepEqual(ordna.rensaSvar(v, e), [], JSON.stringify(v));
      const { el } = rita(ordna, ordnaF(4), v, { elevId: "e1" });
      assert.equal(kvar(el).length, 4);
    }
  });
});

describe("blandningen per elev – alla storlekar, många elever", () => {
  for (let n = 3; n <= 10; n++) {
    it(`${n} saker: giltiga koder, aldrig facit, stabil, flera olika ordningar bland 30 elever`, () => {
      const f = ordnaF(n);
      const e1 = ordna.utanFacit(f);
      const e2 = ordna.utanFacit(structuredClone(f));
      assert.deepEqual(e1.blandningar, e2.blandningar, "samma prov öppnat igen → samma koder");
      assert.ok(e1.blandningar.length >= 1 && e1.blandningar.length <= 12);
      for (const kod of e1.blandningar) {
        assert.equal(typeof kod, "string");
        assert.equal(kod.length, n);
        assert.equal(new Set(kod).size, n, `kod ${kod} är en permutation`);
      }
      const ordningar = new Set();
      for (const uid of ELEVER) {
        const a = elevBlandning(e1.saker, e1.blandningar, uid, f.id);
        const b = elevBlandning(e2.saker, e2.blandningar, uid, f.id);
        assert.deepEqual(a, b, "samma efter omladdning");
        assert.notDeepEqual(a, f.saker, `${uid} fick facit-ordningen`);
        assert.deepEqual([...a].sort(), [...f.saker].sort());
        ordningar.add(a.join("|"));
      }
      // 3 saker → högst 2 koder; annars borde 30 elever ge minst 4 olika ordningar.
      assert.ok(ordningar.size >= Math.min(4, e1.blandningar.length), `${ordningar.size} olika ordningar`);
    });
  }

  it("para: aldrig facit-ordningen för någon elev (3–10 par), vänsterleden i lärarens ordning", () => {
    for (let n = 3; n <= 10; n++) {
      const f = paraF(n);
      const e = para.utanFacit(f);
      assert.deepEqual(e.vanster, f.par.map((p) => p.vanster));
      for (const uid of ELEVER) {
        const h = elevBlandning(e.hoger, e.blandningar, uid, f.id);
        assert.notDeepEqual(h, f.par.map((p) => p.hoger), `${n} par, ${uid}`);
      }
    }
  });

  it("renderElev visar elevens ordning i Kvar (para: förklaringarna) – samma för samma elev, oberoende av svaret", () => {
    const f = ordnaF(7);
    const forsta = rita(ordna, f, [], { elevId: "elev-x" });
    const ordning = kvar(forsta.el).map((b) => b.textContent);
    const igen = rita(ordna, f, ["Sak 3"], { elevId: "elev-x" });
    assert.deepEqual(kvar(igen.el).map((b) => b.textContent), ordning.filter((s) => s !== "Sak 3"), "Kvar behåller elevens blandning");
    const pf = paraF(6);
    const ph = (el) => el.querySelectorAll("[data-h]").map((b) => b.querySelector(".provv-para-text").textContent);
    assert.deepEqual(ph(rita(para, pf, null, { elevId: "elev-x" }).el), ph(rita(para, pf, ["", "Förklaring 3"], { elevId: "elev-x" }).el));
  });

  it("samma elev får inte nödvändigtvis samma ordning på två olika frågor (fråge-id är med i fröet)", () => {
    const a = ordna.utanFacit(ordnaF(6, "fa"));
    const b = ordna.utanFacit(ordnaF(6, "fb"));
    let olika = 0;
    for (const uid of ELEVER) {
      if (elevBlandning(a.saker, a.blandningar, uid, "fa").join() !== elevBlandning(b.saker, b.blandningar, uid, "fb").join()) olika++;
    }
    assert.ok(olika > 20, `${olika}/30 olika`);
  });

  it("manipulerade koder (fel längd, dubbletter, utanför, inte text) → listan som den är, aldrig krasch/odefinierat", () => {
    const lista = ["a", "b", "c", "d"];
    for (const koder of [["012"], ["00123"], ["0012"], ["0129"], [1230], [null], ["abcd"], [["1", "0", "2", "3"]], "1032"]) {
      const ut = elevBlandning(lista, koder, "elev", "q");
      assert.deepEqual([...ut].sort(), lista, JSON.stringify(koder));
      assert.ok(!ut.includes(undefined));
    }
  });

  it("facit läcker inte: ingen kod i blandningar återger facit, och blandningar är ≤ hälften av ordningarna", () => {
    for (let n = 3; n <= 6; n++) {
      const lista = saker(n);
      const elev = blanda(lista, `ordna:x${n}`);
      const koder = blandningar(lista, `ordna:x${n}`);
      const fakt = [1, 1, 2, 6, 24, 120, 720][n];
      assert.ok(koder.length < fakt / 2, `${n}: ${koder.length} av ${fakt}`);
      for (const k of koder) assert.notDeepEqual([...k].map((i) => elev[Number(i)]), lista);
    }
  });

  it("tillfällets frågor (delaUppProv) bär blandningar men inget facit", () => {
    const { fragor, facit } = delaUppProv({ fragor: [ordnaF(5, "o"), paraF(4, "p")] });
    for (const f of fragor) {
      assert.ok(Array.isArray(f.blandningar) && f.blandningar.length);
      assert.equal(JSON.stringify(f).includes('"ordning"'), false);
      assert.equal(f.par, undefined);
    }
    assert.ok(facit.o && facit.p);
  });
});

describe("para: tryck i alla ordningar (paraTryck)", () => {
  const tom = (n) => ({ svar: Array(n).fill(""), vald: null });

  it("2n tryck för n par i blandad ordning (vänster först, höger först, om vartannat)", () => {
    let st = tom(4);
    const H = ["A", "B", "C", "D"];
    let tryck = 0;
    const t = (s, v) => { st = paraTryck(st, s, v); tryck++; };
    t("v", 0); t("h", "A");
    t("h", "B"); t("v", 1);
    t("v", 3); t("h", "D");
    t("h", "C"); t("v", 2);
    assert.deepEqual(st.svar, ["A", "B", "C", "D"]);
    assert.equal(tryck, 8);
    assert.equal(st.vald, null);
    void H;
  });

  it("tryck på samma sak två gånger avväljer; att välja en annan på samma sida byter val", () => {
    let st = paraTryck(tom(3), "v", 0);
    st = paraTryck(st, "v", 0);
    assert.equal(st.vald, null);
    st = paraTryck(st, "v", 0);
    st = paraTryck(st, "v", 1);
    assert.deepEqual(st.vald, { sida: "v", varde: 1 });
  });

  it("valt begrepp + tryck på ett PARAT begrepp (samma sida): paret tas isär och valet släpps", () => {
    let st = { svar: ["", "B", ""], vald: null };
    st = paraTryck(st, "v", 0);
    st = paraTryck(st, "v", 1);
    // Dokumenterar beteendet: tap på paret vinner över att byta val.
    assert.deepEqual(st.svar, ["", "", ""]);
    assert.equal(st.vald, null);
  });

  it("vald förklaring + tryck på parat begrepp → kopplas om; förklaringens gamla begrepp släpper den", () => {
    let st = { svar: ["A", "B", ""], vald: null };
    st = paraTryck(st, "h", "A");      // A är parad → tas isär direkt (inget valt)
    assert.deepEqual(st.svar, ["", "B", ""]);
    st = paraTryck(st, "h", "C");
    st = paraTryck(st, "v", 1);        // B-begreppet har B → får C i stället
    assert.deepEqual(st.svar, ["", "C", ""]);
  });

  it("i webbläsarrutan: tryck på parad förklaring med valt begrepp på andra sidan flyttar förklaringen dit", () => {
    const f = paraF(3);
    const { el, sparat } = rita(para, f, ["Förklaring 1", "", ""], { elevId: "e" });
    const v = el.querySelectorAll("[data-v]");
    const h = (t) => el.querySelectorAll("[data-h]").find((b) => b.querySelector(".provv-para-text").textContent === t);
    v[2].click();
    h("Förklaring 1").click();
    assert.deepEqual(sparat.svar, ["", "", "Förklaring 1"]);
    assert.equal(v[2].getAttribute("aria-pressed"), "false");
  });
});

describe('"Flytta till…": slumpad invariant över listor med avsnitt och textblock', () => {
  let s = 12345;
  const slump = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const slumpProv = () => {
    const n = 2 + Math.floor(slump() * 12);
    let q = 0;
    const fragor = Array.from({ length: n }, (_, i) => {
      const r = slump();
      return r < 0.18 ? { id: `A${i}`, typ: "avsnitt" } : r < 0.28 ? { id: `T${i}`, typ: "text" } : { id: `q${++q}`, typ: "flerval" };
    });
    return { fragor };
  };

  it("en fråga till plats p blir fråga p, hamnar intill den som hade numret, inget tappas", () => {
    for (let k = 0; k < 400; k++) {
      const prov = slumpProv();
      prov.fragor.forEach((f, fran) => {
        if (f.typ !== "flerval") return;
        const { max } = platsGrans(prov.fragor, fran);
        const antal = prov.fragor.filter((x) => x.typ === "flerval").length;
        assert.equal(max, antal);
        const nr0 = fragaNummer(prov.fragor);
        for (let p = 1; p <= max; p++) {
          const ny = flyttaTillPlats(prov, fran, p);
          assert.equal(fragaNummer(ny.fragor)[f.id], p, `${prov.fragor.map((x) => x.id)} ${f.id}→${p}`);
          assert.deepEqual([...ny.fragor].sort((a, b) => (a.id < b.id ? -1 : 1)), [...prov.fragor].sort((a, b) => (a.id < b.id ? -1 : 1)));
          // Avsnitt/textblock behåller sin inbördes ordning
          const ickeFragor = (l) => l.filter((x) => x.typ !== "flerval").map((x) => x.id);
          assert.deepEqual(ickeFragor(ny.fragor), ickeFragor(prov.fragor));
          // Den som hade numret p står direkt bredvid (före när vi flyttade ned, efter när upp)
          const granne = Object.keys(nr0).find((id) => nr0[id] === p);
          if (granne !== f.id) {
            const i = ny.fragor.findIndex((x) => x.id === f.id);
            const g = ny.fragor.findIndex((x) => x.id === granne);
            assert.equal(Math.abs(i - g), 1, `${f.id}→${p} ska stå intill ${granne}: ${ny.fragor.map((x) => x.id)}`);
          }
        }
      });
    }
  });

  it("ett avsnitt/textblock till p ≤ antal hamnar direkt före fråga p; antal + 1 = efter sista frågan", () => {
    for (let k = 0; k < 400; k++) {
      const prov = slumpProv();
      prov.fragor.forEach((f, fran) => {
        if (f.typ === "flerval") return;
        const { max, arFraga } = platsGrans(prov.fragor, fran);
        assert.equal(arFraga, false);
        const nr0 = fragaNummer(prov.fragor);
        for (let p = 1; p <= max; p++) {
          const ny = flyttaTillPlats(prov, fran, p);
          const i = ny.fragor.findIndex((x) => x.id === f.id);
          assert.deepEqual(fragaNummer(ny.fragor), nr0, "numreringen av frågorna är oförändrad");
          const efter = ny.fragor.slice(i + 1).find((x) => x.typ === "flerval");
          if (p < max) {
            assert.equal(nr0[efter?.id], p, `${f.id}→${p}: ${ny.fragor.map((x) => x.id)}`);
          } else {
            assert.equal(efter, undefined, `${f.id}→sist: ${ny.fragor.map((x) => x.id)}`);
          }
        }
      });
    }
  });

  it("prov utan frågor (bara avsnitt/textblock): max = 1 och flytten krånglar inte", () => {
    const prov = { fragor: [{ id: "A", typ: "avsnitt" }, { id: "T", typ: "text" }] };
    assert.deepEqual(platsGrans(prov.fragor, 0), { arFraga: false, max: 1 });
    const ny = flyttaTillPlats(prov, 0, 1);
    assert.deepEqual(ny.fragor.map((x) => x.id), ["T", "A"]);
    assert.equal(indexForPlats([{ id: "A", typ: "avsnitt" }], 0, 1), 0);
  });

  it("flyttaTillIndex: gamla prov-objektet ändras inte (ny lista)", () => {
    const prov = { namn: "x", fragor: [{ id: "q1", typ: "flerval" }, { id: "q2", typ: "flerval" }] };
    const kopia = structuredClone(prov);
    const ny = flyttaTillIndex(prov, 0, 1);
    assert.deepEqual(prov, kopia);
    assert.notEqual(ny.fragor, prov.fragor);
    assert.equal(ny.namn, "x");
  });
});

describe("rättning av en påbörjad ordning: förslag vid inlämning ↔ Rätta alla", () => {
  const f = ordnaF(4, "o");
  const { fragor, facit } = delaUppProv({ fragor: [f] });

  it("gamla hela svar rättas lika i båda vägarna", () => {
    for (const svar of [saker(4), [...saker(4)].reverse(), ["Sak 1", "Sak 2", "Sak 4", "Sak 3"]]) {
      const a = forslagFor(fragor, { o: svar }, facit).o;
      const b = autoBedom(fragor[0], svar, facit.o).post;
      assert.equal(a.poang, b.poang, JSON.stringify(svar));
      assert.equal(a.ratt, b.ratt);
    }
  });

  it("påbörjad ordning (2 av 4 rätt placerade) ger samma poäng i förslagen som i Rätta alla – 0 p (F1)", () => {
    const svar = ["Sak 1", "Sak 2"];
    assert.equal(ordna.arBesvarad(svar, fragor[0]), false);
    const vidInlamning = forslagFor(fragor, { o: svar }, facit).o;
    const rattaAlla = autoBedom(fragor[0], svar, facit.o).post;
    assert.equal(vidInlamning.poang, rattaAlla.poang, `förslag ${vidInlamning.poang} p ≠ Rätta alla ${rattaAlla.poang} p`);
    assert.equal(vidInlamning.poang, 0);
    assert.equal(vidInlamning.ratt, false);
    assert.deepEqual(ordna.forslag(svar, facit.o, fragor[0]), { poang: 0, maxPoang: fragor[0].poang, ratt: false }, "typens forslag direkt (prov-ratta-lager)");
  });
});
