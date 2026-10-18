// ============================================================================
// #763 (Prov 3B, spec §2.3.1 + §16 "Ordna och para ihop"): ordna med få tryck,
// para med två tryck, blandning per elev och "Flytta till…" i redigeraren.
// Elevrutorna (renderElev) körs på riktigt i en minimal DOM
// (helpers/prov-mini-dom.js) – testerna trycker på samma knappar som eleven.
// Körs med: node --test test/prov-ordna-para.test.js
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fragetyp } from "../src/prov/prov-fragetyper.js";
import { blanda, blandningar, elevBlandning } from "../src/prov/typer/delat.js";
import { ordnaKvar, ordnaLagg, ordnaSlapp, ordnaStatus, ordnaTaBort, paraKoppla, paraStatus, paraTryck } from "../src/prov/prov-ordna-para.js";
import { flyttaTillIndex, flyttaTillPlats, indexForPlats, platsGrans } from "../src/prov/prov-flytta-ops.js";
import { fragaNummer, delaUppProv } from "../src/prov/prov-modell.js";
import { Handelse, installeraDom } from "./helpers/prov-mini-dom.js";
import { kopplaKlistra, tolkaKlistrat } from "../src/prov/larare/provl-klistra.js";

const ordna = fragetyp("ordna");
const para = fragetyp("para");
const SAKER = ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden", "Medeltiden"];
const ORDNA = { id: "q7", typ: "ordna", fraga: "Sätt i tidsordning.", saker: SAKER, poang: 5 };
const PAR = [
  { vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" },
  { vanster: "Loke", hoger: "List" }, { vanster: "Heimdal", hoger: "Vakt" },
];
const PARA = { id: "q6", typ: "para", fraga: "Para ihop.", par: PAR, poang: 5 };

let dom;
before(() => { dom = installeraDom(); });
after(() => dom.avinstallera());

/** Elevens ruta + det senast sparade svaret. */
function rita(typ, f, svar, o = {}) {
  const e = typ.utanFacit(f);
  const sparat = { svar, antal: 0 };
  const el = typ.renderElev(e, svar, { onChange: (v) => { sparat.svar = v; sparat.antal++; }, ...o });
  return { el, e, sparat };
}
const kvarKnappar = (el) => el.querySelectorAll("[data-kvar-sak]");
const svarKnappar = (el) => el.querySelectorAll("[data-svar]");
const texter = (lista) => lista.map((b) => b.textContent);

describe("ordna: tryck i tur och ordning (§2.3.1)", () => {
  it("n saker kräver exakt n tryck – varje tryck lägger EN sak på nästa lediga plats", () => {
    const { el, e, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    const n = SAKER.length;
    for (let tryck = 1; tryck <= n; tryck++) {
      const forsta = kvarKnappar(el)[0];
      const text = forsta.textContent;
      forsta.click();
      assert.equal(sparat.svar.length, tryck, `efter ${tryck} tryck`);
      assert.equal(sparat.svar[tryck - 1], text, "på nästa lediga plats");
      assert.equal(ordna.arBesvarad(sparat.svar, e), tryck === n, "besvarad först när alla platser är fyllda");
      assert.match(el.querySelector(".provv-ordna-status").textContent, tryck === n ? /Alla 5 placerade/ : new RegExp(`${tryck} av 5 placerade`));
    }
    assert.equal(sparat.antal, n, "ett sparat svar per tryck – inga extra tryck behövs");
    assert.equal(kvarKnappar(el).length, 0);
    assert.deepEqual(ordna.rensaSvar(sparat.svar, e), sparat.svar, "svaret är i samma form som förr");
  });

  it("ett tryck i svaret lägger tillbaka saken och sakerna under flyttar upp", () => {
    const { el, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    for (let i = 0; i < 4; i++) kvarKnappar(el)[0].click();
    const fore = [...sparat.svar];
    svarKnappar(el)[1].click();
    assert.deepEqual(sparat.svar, [fore[0], fore[2], fore[3]]);
    assert.deepEqual(texter(svarKnappar(el)), [fore[0], fore[2], fore[3]], "plats 2 och 3 flyttade upp");
    assert.ok(texter(kvarKnappar(el)).includes(fore[1]), "tillbaka i Kvar");
    assert.equal(el.querySelector(".provv-ordna-status").textContent, "3 av 5 placerade");
  });

  it('"Börja om" lägger tillbaka allt', () => {
    const { el, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    kvarKnappar(el)[0].click();
    kvarKnappar(el)[0].click();
    [...el.querySelectorAll("button")].find((b) => b.textContent === "Börja om").click();
    assert.deepEqual(sparat.svar, []);
    assert.equal(kvarKnappar(el).length, 5);
  });

  it("tangentbordet: fokus stannar på nästa sak i Kvar efter ett tryck (Tab + Enter = vanliga knappar)", () => {
    const { el } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    assert.ok(kvarKnappar(el).every((b) => b.tagName === "BUTTON"));
    kvarKnappar(el)[2].click();
    assert.equal(dom.doc.activeElement, kvarKnappar(el)[2], "samma plats i Kvar");
    svarKnappar(el)[0].click();
    assert.ok(el.contains(dom.doc.activeElement));
  });

  it("dra och släpp är ett extra sätt: från Kvar till plats 1, och tillbaka till Kvar", () => {
    const { el, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    kvarKnappar(el)[0].click();
    kvarKnappar(el)[0].click();
    const [a, b] = sparat.svar;
    const dra = (knapp, mal) => {
      knapp.dispatchEvent(new Handelse("pointerdown", { button: 0, pointerId: 1, pointerType: "mouse", clientX: 0, clientY: 0 }));
      dom.mal = mal;
      dom.doc.skicka("pointermove", { pointerId: 1, clientX: 40, clientY: 40 });
      dom.doc.skicka("pointerup", { pointerId: 1, clientX: 40, clientY: 40 });
    };
    const c = kvarKnappar(el)[0];
    const cText = c.textContent;
    dra(c, el.querySelector('[data-plats="0"]'));
    assert.deepEqual(sparat.svar, [cText, a, b], "insatt först, de andra flyttade ned");
    dra(svarKnappar(el)[2], el.querySelector("[data-kvar]"));
    assert.deepEqual(sparat.svar, [cText, a], "släppt i Kvar = borttagen");
    dra(svarKnappar(el)[0], el.querySelector('[data-plats="4"]'));
    assert.deepEqual(sparat.svar, [a, cText], "en plats efter de fyllda = sist (inga hål)");
  });

  it("gamla sparade svar (hel ordning) visas som förut och rättas som förut", () => {
    const e = ordna.utanFacit(ORDNA);
    const gammalt = [...e.saker];
    const { el, sparat } = rita(ordna, ORDNA, gammalt, { elevId: "elev-a" });
    assert.deepEqual(texter(svarKnappar(el)), gammalt);
    assert.equal(kvarKnappar(el).length, 0);
    assert.equal(sparat.antal, 0, "att visa ett svar sparar inget");
    assert.deepEqual(ordna.forslag(SAKER, ordna.facit(ORDNA), e), { poang: 5, maxPoang: 5, ratt: true });
    assert.deepEqual(ordna.forslag([], ordna.facit(ORDNA), e), { poang: 0, maxPoang: 5, ratt: false });
    const last = rita(ordna, ORDNA, gammalt, { lasLage: true }).el;
    assert.ok(svarKnappar(last).every((b) => b.disabled), "låst efter inlämning");
  });

  it("en påbörjad ordning sparas (sakerna i provet, högst en gång var) men räknas inte som besvarad", () => {
    const e = ordna.utanFacit(ORDNA);
    assert.deepEqual(ordna.rensaSvar([SAKER[1], SAKER[0]], e), [SAKER[1], SAKER[0]]);
    assert.deepEqual(ordna.rensaSvar([SAKER[1], SAKER[1]], e), []);
    assert.deepEqual(ordna.rensaSvar(["Okänd"], e), []);
    assert.deepEqual(ordna.rensaSvar([...SAKER, "x"], e), []);
    assert.equal(ordna.arBesvarad([SAKER[0]], e), false);
  });
});

describe("blandningen per elev (§2.3.1)", () => {
  const kvarOrdning = (elevId, f = ORDNA) => texter(kvarKnappar(rita(ordna, f, [], { elevId }).el));

  it("samma elev får samma ordning efter omladdning", () => {
    for (const elev of ["elev-a", "elev-b", "Kx81Lm"]) assert.deepEqual(kvarOrdning(elev), kvarOrdning(elev), elev);
  });

  it("olika elever får olika ordningar – och ingen får facit-ordningen", () => {
    const ordningar = new Set();
    for (let u = 0; u < 40; u++) {
      const o = kvarOrdning(`elev-${u}`);
      assert.notDeepEqual(o, SAKER, `elev-${u} fick facit-ordningen`);
      assert.deepEqual([...o].sort(), [...SAKER].sort());
      ordningar.add(o.join("|"));
    }
    assert.ok(ordningar.size >= 6, `bara ${ordningar.size} olika ordningar på 40 elever`);
  });

  it("para: förklaringarna blandas per elev, stabilt, aldrig i facit-ordning", () => {
    const hoger = (elevId) => rita(para, PARA, null, { elevId }).el.querySelectorAll("[data-h]").map((b) => b.textContent.replace(/^\d+/, ""));
    assert.deepEqual(hoger("elev-a"), hoger("elev-a"));
    const facit = PAR.map((p) => p.hoger);
    const sett = new Set();
    for (let u = 0; u < 40; u++) {
      const h = hoger(`elev-${u}`);
      assert.notDeepEqual(h, facit);
      sett.add(h.join("|"));
    }
    assert.ok(sett.size >= 6);
  });

  it("blandningar: inga facit-ordningar, ingen lista i lista (Firestore), 3 saker → bara 2 (pekar inte ut facit)", () => {
    for (let n = 3; n <= 10; n++) {
      const lista = Array.from({ length: n }, (_, i) => `sak ${i}`);
      const koder = blandningar(lista, `ordna:f${n}`);
      const elev = blanda(lista, `ordna:f${n}`);
      assert.ok(koder.length >= 2 && koder.length <= 12, `${n}: ${koder.length}`);
      for (const k of koder) {
        assert.equal(typeof k, "string");
        const ordning = [...k].map((c) => elev[Number(c)]);
        assert.deepEqual([...ordning].sort(), [...lista].sort());
        assert.notDeepEqual(ordning, lista);
      }
    }
    assert.equal(blandningar(["a", "b", "c"], "x").length, 2);
  });

  it("utan elev-id (förhandsvisningen) eller blandningar (tillfällen före #763) = listan som förr", () => {
    const e = ordna.utanFacit(ORDNA);
    assert.deepEqual(elevBlandning(e.saker, e.blandningar, "", "q7"), e.saker);
    assert.deepEqual(elevBlandning(e.saker, undefined, "elev-a", "q7"), e.saker);
    assert.deepEqual(elevBlandning(e.saker, ["9"], "elev-a", "q7"), e.saker, "trasig kod → listan");
    const gammal = { ...e };
    delete gammal.blandningar;
    const { el } = (() => ({ el: ordna.renderElev(gammal, [], { elevId: "elev-a" }) }))();
    assert.deepEqual(texter(kvarKnappar(el)), e.saker);
  });

  it("tillfällets frågor bär blandningarna utan facit", () => {
    const { fragor } = delaUppProv({ fragor: [ORDNA, PARA] });
    assert.ok(fragor[0].blandningar.length > 0 && fragor[1].blandningar.length > 0);
    assert.ok(!JSON.stringify(fragor[1]).includes('"par"'));
  });
});

describe("para: två tryck per par (§2.3.1)", () => {
  const vKn = (el) => el.querySelectorAll("[data-v]");
  const hKn = (el, text) => el.querySelectorAll("[data-h]").find((b) => b.querySelector(".provv-para-text").textContent === text);

  it("begrepp + förklaring = ett par med samma färg och samma siffra; n par på 2n tryck", () => {
    const { el, e, sparat } = rita(para, PARA, null, { elevId: "elev-a" });
    let tryck = 0;
    PAR.forEach((p, i) => {
      vKn(el)[i].click(); tryck++;
      assert.equal(vKn(el)[i].getAttribute("aria-pressed"), "true", "första trycket väljer");
      hKn(el, p.hoger).click(); tryck++;
      const v = vKn(el)[i];
      const h = hKn(el, p.hoger);
      assert.ok(v.classList.contains("provv-par") && h.classList.contains("provv-par"));
      assert.ok(v.classList.contains(`provv-par-f${i}`) && h.classList.contains(`provv-par-f${i}`), "samma färg");
      assert.equal(v.querySelector(".provv-para-nr").textContent, String(i + 1));
      assert.equal(h.querySelector(".provv-para-nr").textContent, String(i + 1), "samma siffra – färgen är inte ensam");
      assert.match(v.getAttribute("aria-label"), new RegExp(`par ${i + 1} med ${p.hoger}`));
    });
    assert.equal(tryck, 2 * PAR.length);
    assert.deepEqual(sparat.svar, PAR.map((p) => p.hoger));
    assert.deepEqual(para.forslag(sparat.svar, para.facit(PARA), e), { poang: 5, maxPoang: 5, ratt: true });
    assert.equal(el.querySelector(".provv-para-status").textContent, "5 av 5 par klara");
  });

  it("ett tryck på ett par tar isär det (från båda hållen)", () => {
    const { el, sparat } = rita(para, PARA, null, { elevId: "elev-a" });
    vKn(el)[0].click(); hKn(el, "Åska").click();
    vKn(el)[1].click(); hKn(el, "Visdom").click();
    vKn(el)[0].click();
    assert.deepEqual(sparat.svar, ["", "Visdom", "", "", ""]);
    assert.ok(!vKn(el)[0].classList.contains("provv-par"));
    hKn(el, "Visdom").click();
    assert.deepEqual(sparat.svar, ["", "", "", "", ""]);
  });

  it("förklaringen först fungerar också, och ett nytt par tar förklaringen från det gamla", () => {
    const { el, sparat } = rita(para, PARA, null, { elevId: "elev-a" });
    hKn(el, "Kärlek").click(); vKn(el)[2].click();
    assert.equal(sparat.svar[2], "Kärlek");
    vKn(el)[0].click(); hKn(el, "Kärlek").click();
    assert.deepEqual(sparat.svar, ["Kärlek", "", "", "", ""], "Freja släppte Kärlek");
  });

  it("dra ett begrepp till en förklaring", () => {
    const { el, sparat } = rita(para, PARA, null, { elevId: "elev-a" });
    vKn(el)[3].dispatchEvent(new Handelse("pointerdown", { button: 0, pointerId: 7, pointerType: "mouse", clientX: 0, clientY: 0 }));
    dom.mal = hKn(el, "List").querySelector(".provv-para-text");
    dom.doc.skicka("pointermove", { pointerId: 7, clientX: 50, clientY: 0 });
    dom.doc.skicka("pointerup", { pointerId: 7, clientX: 50, clientY: 0 });
    assert.equal(sparat.svar[3], "List");
  });

  it("gamla svar (listrutor) visas: dubbletter visar bara den första; rättningen är oförändrad", () => {
    const gammalt = ["Åska", "Åska", "Kärlek", "", ""];
    const { el, e, sparat } = rita(para, PARA, gammalt, { elevId: "elev-a" });
    assert.ok(vKn(el)[0].classList.contains("provv-par"));
    assert.ok(!vKn(el)[1].classList.contains("provv-par"));
    assert.ok(vKn(el)[2].classList.contains("provv-par"));
    assert.equal(sparat.antal, 0);
    assert.deepEqual(para.forslag(gammalt, para.facit(PARA), e), { poang: 2, maxPoang: 5, ratt: "delvis" });
    assert.deepEqual(para.rensaSvar(gammalt, e), gammalt, "sparformatet oförändrat");
  });

  it("låst: inga tryck", () => {
    const { el } = rita(para, PARA, ["Åska", "", "", "", ""], { lasLage: true });
    assert.ok(el.querySelectorAll("button").every((b) => b.disabled));
  });
});

describe("logiken (prov-ordna-para.js)", () => {
  it("ordna", () => {
    assert.deepEqual(ordnaKvar(["a", "b", "c"], ["b"]), ["a", "c"]);
    assert.deepEqual(ordnaLagg(["a"], "b", 3), ["a", "b"]);
    assert.deepEqual(ordnaLagg(["a"], "a", 3), ["a"], "redan placerad");
    assert.deepEqual(ordnaLagg(["a", "b", "c"], "d", 3), ["a", "b", "c"], "fullt");
    assert.deepEqual(ordnaTaBort(["a", "b", "c", "d"], 1), ["a", "c", "d"]);
    assert.deepEqual(ordnaSlapp(["a", "b", "c"], "c", 0), ["c", "a", "b"]);
    assert.deepEqual(ordnaSlapp(["a", "b"], "x", 9), ["a", "b", "x"]);
    assert.equal(ordnaStatus(3, 5), "3 av 5 placerade");
    assert.equal(ordnaStatus(5, 5), "Alla 5 placerade");
  });
  it("para", () => {
    let st = { svar: ["", "", ""], vald: null };
    st = paraTryck(st, "v", 1);
    assert.deepEqual(st.vald, { sida: "v", varde: 1 });
    st = paraTryck(st, "v", 1);
    assert.equal(st.vald, null, "samma igen avväljer");
    st = paraTryck(paraTryck(st, "v", 0), "h", "B");
    assert.deepEqual(st, { svar: ["B", "", ""], vald: null });
    st = paraTryck(paraTryck(st, "v", 2), "h", "B");
    assert.deepEqual(st.svar, ["", "", "B"], "B flyttar till det nya paret");
    st = paraTryck(st, "h", "B");
    assert.deepEqual(st.svar, ["", "", ""]);
    assert.deepEqual(paraKoppla(["A", "B", ""], 2, "A"), ["", "B", "A"]);
    assert.equal(paraStatus(["A", "", "C"]), "2 av 3 par klara");
  });
});

describe('redigeraren: "Flytta till…", dra ⋮⋮, Alt + pil (§8.1)', () => {
  const F = (id, typ = "flerval") => ({ id, typ });
  // A1 [q1 q2] T [q3] A2 [q4 q5]  – avsnitt och textblock har inga nummer
  const prov = { namn: "x", fragor: [F("A1", "avsnitt"), F("q1"), F("q2"), F("T", "text"), F("q3"), F("A2", "avsnitt"), F("q4"), F("q5")] };
  const ids = (p) => p.fragor.map((f) => f.id);
  const nr = (p) => fragaNummer(p.fragor);

  it('en fråga som flyttas till "3" blir fråga 3 – även med avsnitt i listan', () => {
    for (const [fran, plats] of [[1, 3], [7, 1], [4, 5], [6, 2], [2, 4], [1, 5]]) {
      const id = prov.fragor[fran].id;
      const ny = flyttaTillPlats(prov, fran, plats);
      assert.equal(nr(ny)[id], plats, `${id} → ${plats}: ${ids(ny).join(" ")}`);
      assert.equal(ny.fragor.length, prov.fragor.length);
    }
  });

  it("frågan hamnar bredvid frågan som har numret nu, i dess avsnitt (uppåt före, nedåt efter)", () => {
    assert.deepEqual(ids(flyttaTillPlats(prov, 1, 3)), ["A1", "q2", "T", "q3", "q1", "A2", "q4", "q5"], "q1 → 3: efter q3, kvar i avsnitt 1");
    assert.deepEqual(ids(flyttaTillPlats(prov, 1, 4)), ["A1", "q2", "T", "q3", "A2", "q4", "q1", "q5"], "q1 → 4: efter q4, i avsnitt 2");
    assert.deepEqual(ids(flyttaTillPlats(prov, 6, 3)), ["A1", "q1", "q2", "T", "q4", "q3", "A2", "q5"], "q4 → 3: före q3, i avsnitt 1");
    assert.deepEqual(ids(flyttaTillPlats(prov, 7, 1)), ["A1", "q5", "q1", "q2", "T", "q3", "A2", "q4"]);
  });

  it("ett avsnitt flyttat till N börjar vid fråga N; ett mer än antalet = sist", () => {
    assert.deepEqual(ids(flyttaTillPlats(prov, 5, 2)), ["A1", "q1", "A2", "q2", "T", "q3", "q4", "q5"]);
    assert.deepEqual(ids(flyttaTillPlats(prov, 0, 6)), ["q1", "q2", "T", "q3", "A2", "q4", "q5", "A1"]);
    assert.deepEqual(platsGrans(prov.fragor, 0), { arFraga: false, max: 6 });
    assert.deepEqual(platsGrans(prov.fragor, 1), { arFraga: true, max: 5 });
  });

  it("samma plats = oförändrat; utanför gränserna kläms in", () => {
    assert.equal(flyttaTillPlats(prov, 4, 3), prov);
    assert.equal(nr(flyttaTillPlats(prov, 1, 99)).q1, 5);
    assert.equal(nr(flyttaTillPlats(prov, 7, 0)).q5, 1);
    assert.equal(indexForPlats(prov.fragor, 1, 1), 1, "efter A1");
  });

  it("dra / Alt + pil: flyttaTillIndex", () => {
    assert.deepEqual(ids(flyttaTillIndex(prov, 1, 2)), ["A1", "q2", "q1", "T", "q3", "A2", "q4", "q5"], "Alt + pil ned");
    assert.deepEqual(ids(flyttaTillIndex(prov, 1, 0)), ["q1", "A1", "q2", "T", "q3", "A2", "q4", "q5"], "Alt + pil upp");
    assert.deepEqual(ids(flyttaTillIndex(prov, 0, 99)).at(-1), "A1");
    assert.equal(flyttaTillIndex(prov, 3, 3), prov);
    assert.equal(flyttaTillIndex(prov, 42, 0), prov);
  });
});

describe("fixrunda 1 (#763)", () => {
  const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
  const finger = (el, t, x = 10, y = 10, id = 21) => el.dispatchEvent(new Handelse(t, { button: 0, pointerId: id, pointerType: "touch", clientX: x, clientY: y }));
  const fingerDoc = (t, x = 10, y = 10, id = 21) => dom.doc.skicka(t, { pointerId: id, pointerType: "touch", clientX: x, clientY: y });

  it("F2: ett långsamt tryck med fingret (≥ 250 ms, släpp på stället) är ett tryck – exakt ett", async () => {
    const { el, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    const kn = kvarKnappar(el)[0];
    const text = kn.textContent;
    finger(kn, "pointerdown");
    await vanta(320); // långtrycket har startat en dragning
    dom.mal = kn;
    fingerDoc("pointermove", 12, 11); // darrar < 6 px
    fingerDoc("pointerup", 12, 11);
    assert.deepEqual(sparat.svar, [text], "lagd på plats 1");
    assert.equal(sparat.antal, 1, "bara ett tryck");
    // …och i svaret: ett långsamt tryck tar bort
    const sv = svarKnappar(el)[0];
    finger(sv, "pointerdown");
    await vanta(320);
    fingerDoc("pointerup");
    assert.deepEqual(sparat.svar, []);
  });

  it("F2: para – ett långt tryck på ett begrepp väljer det", async () => {
    const { el } = rita(para, PARA, null, { elevId: "elev-a" });
    const v = el.querySelectorAll("[data-v]")[1];
    finger(v, "pointerdown");
    await vanta(420);
    fingerDoc("pointerup");
    assert.equal(el.querySelectorAll("[data-v]")[1].getAttribute("aria-pressed"), "true");
  });

  it("F2: ett långtryck som flyttas ≥ 6 px och släpps är fortfarande en dragning, inget tryck", async () => {
    const { el, sparat } = rita(ordna, ORDNA, [], { elevId: "elev-a" });
    const kn = kvarKnappar(el)[1];
    finger(kn, "pointerdown");
    await vanta(320);
    dom.mal = el.querySelector("[data-kvar]");
    fingerDoc("pointermove", 40, 40);
    fingerDoc("pointerup", 40, 40);
    assert.equal(sparat.antal, 0, "släppt i Kvar – inget ändrat, inget tryck");
  });

  it("F4: numrerade listor tappar siffrorna; F3: para utan avskiljare = en kolumn", () => {
    assert.deepEqual(tolkaKlistrat("1) Plöja\n2) Så\n3. Skörda\n10. Äta").rader, ["Plöja", "Så", "Skörda", "Äta"]);
    assert.deepEqual(tolkaKlistrat("Bronsåldern\n1800-talet").rader, ["Bronsåldern", "1800-talet"], "bara siffror + . eller ) + mellanslag");
    assert.equal(tolkaKlistrat("en rad"), null);
    assert.deepEqual(tolkaKlistrat("Åska\nVisdom", { par: true }), { rader: ["Åska", "Visdom"], hela: false });
    assert.deepEqual(tolkaKlistrat("1. Tor – åska\n2. Oden: visdom", { par: true }), { rader: [["Tor", "åska"], ["Oden", "visdom"]], hela: true });
    // R1/R2: bara när VARJE rad är numrerad / har en avskiljare
    assert.deepEqual(tolkaKlistrat("Tor – åska\nOden\n3. Freja: kärlek", { par: true }), { rader: ["Tor – åska", "Oden", "3. Freja: kärlek"], hela: false });
  });

  // Formulärets radlista i mini-DOM:en: rader med [data-v]/[data-h] eller ett textfält.
  function radLista(varden, par) {
    const d = dom.doc;
    const lista = d.createElement("div");
    const nyRad = (v = ["", ""]) => {
      const r = d.createElement("div");
      r.className = "provl-rad";
      const falt = par ? [["data-v", v[0]], ["data-h", v[1]]] : [["data-sak", v[0]]];
      for (const [k, x] of falt) {
        const i = d.createElement("input");
        i.setAttribute("type", "text");
        i.setAttribute(k, "");
        i.value = x;
        r.appendChild(i);
      }
      return r;
    };
    varden.forEach((v) => lista.appendChild(nyRad(v)));
    const meddelande = d.createElement("p");
    kopplaKlistra(lista, { max: 10, namn: par ? "par" : "saker", par, nyRad: () => nyRad(), uppdatera() {}, meddelande });
    const klistra = (inp, text) => inp.dispatchEvent(new Handelse("paste", { clipboardData: { getData: () => text } }));
    const lasa = () => lista.children.map((r) => r.querySelectorAll("input[type=text]").map((i) => i.value));
    return { lista, meddelande, klistra, lasa };
  }

  it("F3: förklaringar inklistrade i förklaringskolumnen fyller den nedåt – begreppen står kvar", () => {
    const { lista, klistra, lasa } = radLista([["Tor", ""], ["Oden", ""], ["Freja", ""]], true);
    klistra(lista.children[0].querySelector("[data-h]"), "Åska och styrka\nVisdom och krig\nKärlek");
    assert.deepEqual(lasa(), [["Tor", "Åska och styrka"], ["Oden", "Visdom och krig"], ["Freja", "Kärlek"]]);
  });

  it("F3: begrepp i begreppskolumnen; hela par med avskiljare fyller nya rader", () => {
    const { lista, klistra, lasa } = radLista([["", "Åska"], ["", "Visdom"], ["", ""]], true);
    klistra(lista.children[0].querySelector("[data-v]"), "Tor\nOden");
    assert.deepEqual(lasa(), [["Tor", "Åska"], ["Oden", "Visdom"], ["", ""]]);
    klistra(lista.children[2].querySelector("[data-v]"), "Freja – kärlek\nLoke - list");
    assert.deepEqual(lasa().slice(2), [["Freja", "kärlek"], ["Loke", "list"]]);
  });

  it("F4: 12 rader i en lista med plats för 10 → 10 rader och ett meddelande om de 2", () => {
    const { lista, klistra, lasa, meddelande } = radLista([[""], [""], [""]], false);
    klistra(lista.children[0].querySelector("[data-sak]"), Array.from({ length: 12 }, (_, i) => `${i + 1}. Steg ${i + 1}`).join("\n"));
    assert.deepEqual(lasa().map((r) => r[0]), Array.from({ length: 10 }, (_, i) => `Steg ${i + 1}`));
    assert.equal(meddelande.textContent, "2 rader fick inte plats – högst 10 saker.");
    lista.children.slice(1).forEach((r) => { r.querySelector("[data-sak]").value = ""; });
    klistra(lista.children[0].querySelector("[data-sak]"), "a\nb");
    assert.equal(meddelande.textContent, "", "nästa inklistring som får plats tömmer meddelandet");
  });
});
