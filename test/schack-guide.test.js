// ============================================================================
// Guiden "Lär dig schack" (#790, spec §12 + §14): att varje lektion går att
// klara med minsta lösningen och att stjärnorna räknas rätt, bedömningen av
// dragen i lektion 9–11, framstegen (EN skrivning per förbättring, kvar efter
// omladdning), markupen och källkodskraven (allt i src/schack/, bara import()).
// Stjärnjaktens draggenerering och BFS: test/schack-guide-jakt.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";
import { minstaDrag, skapaJaktKontroll } from "../src/schack/schack-stjarnjakt.js";
import { spela } from "./helpers/schack-guide-hjalp.js";
import {
  LEKTIONER, ANTAL_LEKTIONER, lektionFor, minFor, stjarnorEfterDrag, stjarnorEfterParti, tolerans, bedomDrag,
  normaliseraLektioner, arForbattring, summa, skapaLopp,
} from "../src/schack/schack-lektioner.js";
import { skapaSchackKontroll } from "../src/schack/schack-kontroll.js";
import { sparaOmBattre } from "../src/schack/schack-guide-vy.js";
import { oversiktHtml, lektionHtml, klarHtml, nastaLektion } from "../src/schack/schack-guide-delar.js";
import { startHtml } from "../src/schack/schack-sida-delar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (f) => readFileSync(join(ROOT, f), "utf8");
const kod = (f) => las(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FILER = "abcdefgh";
const ALLA = [...FILER].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => f + r));

describe("stjärnregeln", () => {
  it("3 = minsta möjliga, 2 = högst min + tolerans (≥ 2, ~25 %), annars 1", () => {
    assert.equal(tolerans(1), 2);
    assert.equal(tolerans(7), 2);
    assert.equal(tolerans(10), 3);
    assert.deepEqual([7, 8, 9, 10, 20].map((d) => stjarnorEfterDrag(d, 7)), [3, 2, 2, 1, 1]);
    assert.deepEqual([3, 4, 5, 6].map((d) => stjarnorEfterDrag(d, 3)), [3, 2, 2, 1]);
  });
  it("partiet: vinst 3, remi 2, förlust 1, gav upp 0 (inte klarad)", () => {
    assert.equal(stjarnorEfterParti({ resultat: "1-0", orsak: "matt", vinnare: "w" }, "w"), 3);
    assert.equal(stjarnorEfterParti({ resultat: "½-½", orsak: "patt", vinnare: null }, "w"), 2);
    assert.equal(stjarnorEfterParti({ resultat: "0-1", orsak: "matt", vinnare: "b" }, "w"), 1);
    assert.equal(stjarnorEfterParti({ resultat: "0-1", orsak: "gav-upp", vinnare: "b" }, "w"), 0);
    assert.equal(stjarnorEfterParti(null, "w"), 0);
  });
});

/** Alla elevens lagliga drag i ställningen som brädets dragobjekt. */
function allaDrag(k) {
  return k.getState().pjaser.filter((p) => p.color === "w").flatMap((p) => k.lagligaDrag(p.ruta));
}

/** Spela en ställningsuppgift genom brädets kontroll med loppet som beforeMove. */
function gorDrag(lopp, fen, drag) {
  const k = skapaSchackKontroll({ fen, egenFarg: "w", interaktiv: "w", beforeMove: (d) => lopp.drag(d).ok });
  k.tryck(drag.from);
  const r = k.tryck(drag.to);
  if (r.typ === "forvandling") k.valjForvandling(drag.promotion || "q");
  return k.getFen() !== new Chess(fen).fen();
}

describe("varje lektion går att klara – minsta lösningen ger 3 stjärnor", () => {
  it("12 lektioner i ordning 1–12 med titel, text och ikon; typerna enligt §12", () => {
    assert.equal(LEKTIONER.length, ANTAL_LEKTIONER);
    assert.deepEqual(LEKTIONER.map((l) => l.nr), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(LEKTIONER.map((l) => l.titel), ["Brädet", "Tornet", "Löparen", "Damen", "Kungen", "Springaren", "Bonden",
      "Ta pjäser", "Schack", "Schack matt och patt", "Specialdragen", "Ditt första parti"]);
    assert.deepEqual(LEKTIONER.map((l) => l.typ), ["fragor", ...Array(7).fill("jakt"), "stallning", "stallning", "stallning", "parti"]);
    for (const l of LEKTIONER) assert.ok(l.intro.length > 40 && l.ikon.length === 2, `lektion ${l.nr}`);
    for (const nr of [2, 3, 4, 5, 6, 7]) {
      const typ = { 2: "r", 3: "b", 4: "q", 5: "k", 6: "n", 7: "p" }[nr];
      assert.ok(lektionFor(nr).uppgifter.every((u) => u.pjas === typ && u.stjarnor.length + (u.fiender || []).length >= 2), `lektion ${nr}: bara den pjäsen`);
    }
  });
  it("lektion 1 (frågor): rätt svar direkt = 3 stjärnor; fel tryck räknas", () => {
    const l = lektionFor(1);
    const perfekt = skapaLopp(l);
    for (const u of l.uppgifter) assert.equal(perfekt.tryck(u.svar[0]).ratt, true);
    assert.equal(perfekt.klar, true);
    assert.deepEqual(perfekt.resultat(), { stjarnor: 3, drag: l.uppgifter.length, min: l.uppgifter.length });
    const slarvig = skapaLopp(l);
    assert.equal(slarvig.tryck("h1").ratt, false);
    assert.equal(slarvig.steg, 0, "fel svar = samma fråga");
    for (const u of l.uppgifter) slarvig.tryck(u.svar[u.svar.length - 1]);
    assert.equal(slarvig.resultat().stjarnor, 2);
    assert.equal(slarvig.tryck("e4").ratt, false, "efter klar räknas inget");
    assert.equal(slarvig.antal, l.uppgifter.length + 1);
  });
  it("lektion 1: facit stämmer med utgångsställningen (damen, kungen, springarna)", () => {
    const c = new Chess();
    const [, , , , dam, kung, spr] = lektionFor(1).uppgifter;
    assert.deepEqual(dam.svar.map((r) => c.get(r)), [{ type: "q", color: "w" }]);
    assert.deepEqual(kung.svar.map((r) => c.get(r)), [{ type: "k", color: "b" }]);
    assert.ok(spr.svar.every((r) => c.get(r)?.type === "n" && c.get(r).color === "w"));
  });
  it("lektion 2–8 (jakt): minsta lösningen ger 3 stjärnor, två extra drag 2, många 1", () => {
    for (const l of LEKTIONER.filter((x) => x.typ === "jakt")) {
      const lopp = skapaLopp(l);
      for (let i = 0; i < l.uppgifter.length; i++) {
        const k = skapaJaktKontroll(l.uppgifter[i], { onKlar: (s) => lopp.jaktKlar(s.jakt.antal) });
        spela(k, minstaDrag(l.uppgifter[i]).vag);
        if (i < l.uppgifter.length - 1) assert.equal(lopp.nasta(), true);
      }
      assert.deepEqual(lopp.resultat(), { stjarnor: 3, drag: minFor(l), min: minFor(l) }, `lektion ${l.nr}`);
      const extra = skapaLopp(l);
      for (let i = 0; i < l.uppgifter.length; i++) {
        extra.jaktKlar(l.uppgifter[i].min + (i === 0 ? 2 : 0));
        extra.nasta();
      }
      assert.equal(extra.resultat().stjarnor, 2, `lektion ${l.nr}: +2`);
    }
  });
  it("lektion 9–11 (ställningar): varje uppgift har ett drag som klarar kravet och gjort genom brädet ger 3 stjärnor", () => {
    for (const l of LEKTIONER.filter((x) => x.typ === "stallning")) {
      const lopp = skapaLopp(l);
      for (const [i, u] of l.uppgifter.entries()) {
        const k = skapaSchackKontroll({ fen: u.fen });
        assert.equal(k.getFen(), new Chess(u.fen).fen(), `lektion ${l.nr}.${i + 1}: giltig FEN`);
        const c = new Chess(u.fen);
        const svartKung = ALLA.find((r) => c.get(r)?.type === "k" && c.get(r).color === "b");
        assert.equal(c.isAttacked(svartKung, "w"), false, `lektion ${l.nr}.${i + 1}: svart står inte i schack när vit drar`);
        const ratt = allaDrag(k).filter((d) => bedomDrag(u, d).ok);
        assert.ok(ratt.length >= 1, `lektion ${l.nr}.${i + 1}: minst ett rätt drag`);
        assert.ok(gorDrag(lopp, u.fen, ratt[0]), `lektion ${l.nr}.${i + 1}: draget gjordes`);
        if (i < l.uppgifter.length - 1) assert.equal(lopp.nasta(), true);
      }
      assert.deepEqual(lopp.resultat(), { stjarnor: 3, drag: l.uppgifter.length, min: l.uppgifter.length }, `lektion ${l.nr}`);
    }
  });
  it("lektion 9: ett drag som räddar kungen på fel sätt hoppar tillbaka och räknas", () => {
    const l = lektionFor(9);
    const lopp = skapaLopp(l);
    const u = l.uppgifter[1]; // ta tornet med löparen
    const kungDrag = allaDrag(skapaSchackKontroll({ fen: u.fen })).find((d) => d.piece === "k");
    lopp.drag(allaDrag(skapaSchackKontroll({ fen: l.uppgifter[0].fen })).find((d) => d.piece === "k"));
    lopp.nasta();
    assert.equal(gorDrag(lopp, u.fen, kungDrag), false, "kungsdraget görs inte");
    assert.match(bedomDrag(u, kungDrag).text, /TA tornet/);
    assert.equal(lopp.antal, 2);
    assert.equal(lopp.steg, 1);
  });
  it("lektion 10: patt-fällorna (Df7, Dc7) ger patt-texten och räknas som fel", () => {
    const l = lektionFor(10);
    for (const [i, from, to] of [[1, "f1", "f7"], [2, "c1", "c7"]]) {
      const d = skapaSchackKontroll({ fen: l.uppgifter[i].fen }).lagligaDrag(from).find((x) => x.to === to);
      assert.ok(new Chess(d.efter).isStalemate(), `${to} är patt`);
      const b = bedomDrag(l.uppgifter[i], d);
      assert.equal(b.ok, false);
      assert.match(b.text, /patt/);
    }
    const matt = (fen) => allaDrag(skapaSchackKontroll({ fen })).filter((d) => d.san.includes("#")).map((d) => d.san);
    assert.deepEqual(matt(l.uppgifter[0].fen), ["Ra8#"]);
    assert.deepEqual(matt(l.uppgifter[1].fen), ["Qf8#"]);
    assert.deepEqual(matt(l.uppgifter[2].fen), ["Qc8#"]);
  });
  it("lektion 11: rockad, en passant (d6 – den svarta bonden försvinner) och förvandling via väljaren", () => {
    const [rock, ep, forv] = lektionFor(11).uppgifter;
    const k = skapaSchackKontroll({ fen: ep.fen });
    const d = k.lagligaDrag("e5").find((x) => x.to === "d6");
    assert.ok(d.flags.includes("e"));
    assert.equal(new Chess(d.efter).get("d5"), undefined);
    assert.equal(bedomDrag(ep, k.lagligaDrag("e5").find((x) => x.to === "e6")).ok, false);
    const rockad = skapaSchackKontroll({ fen: rock.fen }).lagligaDrag("e1").filter((x) => bedomDrag(rock, x).ok).map((x) => x.san).sort();
    assert.deepEqual(rockad, ["O-O", "O-O-O"]);
    const lopp = skapaLopp({ ...lektionFor(11), uppgifter: [forv] });
    const k2 = skapaSchackKontroll({ fen: forv.fen, egenFarg: "w", interaktiv: "w", beforeMove: (x) => lopp.drag(x).ok });
    k2.tryck("b7");
    assert.equal(k2.tryck("b8").typ, "forvandling");
    k2.valjForvandling("n");
    assert.equal(new Chess(k2.getFen()).get("b8")?.type, "n");
    assert.equal(lopp.resultat().stjarnor, 3);
  });
  it("lektion 12: partiet mot Bonden (lägsta nivån) – källkoden använder datorvyn och nivån bonden", () => {
    const vy = kod("src/schack/schack-lektion-vy.js");
    assert.match(vy, /import\("\.\/schack-dator-vy\.js"\)/);
    assert.match(vy, /nyttParti\(\{ niva: "bonden", farg: "w" \}\)/);
    assert.match(vy, /stjarnorEfterParti\(slut, parti\.egenFarg\)/);
  });
});

describe("framstegen – studentData.schack.lektioner", () => {
  /** En låtsas-lagring som överlever "omladdning" (ny guide-stub på samma Map). */
  function stub(lagring) {
    const skrivningar = [];
    return {
      skrivningar,
      lektioner: () => JSON.parse(lagring.get("lektioner") || "{}"),
      spara: async (nr, st) => {
        skrivningar.push([nr, st]);
        lagring.set("lektioner", JSON.stringify({ ...JSON.parse(lagring.get("lektioner") || "{}"), [String(nr)]: st }));
      },
    };
  }
  it("EN skrivning per avklarad lektion, bara vid förbättring – och kvar efter omladdning", async () => {
    const lagring = new Map();
    const g = stub(lagring);
    assert.equal(sparaOmBattre(g, 3, 2), true);
    await Promise.resolve();
    assert.equal(sparaOmBattre(g, 3, 2), false, "samma = ingen skrivning");
    assert.equal(sparaOmBattre(g, 3, 1), false, "sämre = ingen skrivning");
    assert.equal(sparaOmBattre(g, 3, 3), true);
    assert.equal(sparaOmBattre(g, 12, 1), true);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(g.skrivningar, [[3, 2], [3, 3], [12, 1]]);
    const omladdad = stub(lagring);
    assert.deepEqual(normaliseraLektioner(omladdad.lektioner()), { 3: 3, 12: 1 });
    assert.equal(sparaOmBattre(omladdad, 3, 3), false);
  });
  it("ett fel vid sparningen stoppar inget", async () => {
    const fel = { lektioner: () => ({}), spara: async () => { throw new Error("offline"); } };
    const varn = console.warn;
    console.warn = () => {};
    try {
      assert.equal(sparaOmBattre(fel, 1, 3), true);
      await new Promise((r) => setTimeout(r, 0));
    } finally { console.warn = varn; }
  });
  it("normalisering och summa: bara lektion 1–12 med heltal 1–3", () => {
    assert.deepEqual(normaliseraLektioner({ 1: 3, 2: 0, 3: 4, 4: 2.5, 5: "3", 13: 3, x: 1, 12: 1 }), { 1: 3, 12: 1 });
    assert.deepEqual(normaliseraLektioner(null), {});
    assert.deepEqual(summa({ 1: 3, 2: 2 }), { stjarnor: 5, klara: 2, max: 36 });
    assert.equal(arForbattring({ 1: 2 }, 1, 3), true);
    assert.equal(arForbattring({ 1: 2 }, 1, 2), false);
    assert.equal(arForbattring({}, 1, 0), false);
  });
  it("klienten skriver EN fältväg per lektion (schack-moln.js) och sidan läser bara den cachade studentData", () => {
    const moln = kod("src/schack/schack-moln.js");
    assert.match(moln, /updateDoc\(doc\(db, "studentData", uid\), \{ \[`schack\.lektioner\.\$\{n\}`\]: stjarnor \}\)/);
    const sida = kod("src/schack/page-schack.js");
    assert.match(sida, /lektioner: \(\) => sd\?\.schack\?\.lektioner \|\| \{\}/);
    assert.match(sida, /\(await moln\(\)\)\.lektionKlar\(nr, stjarnor\)/);
    for (const f of ["schack-guide-vy.js", "schack-lektion-vy.js", "schack-lektioner.js", "schack-stjarnjakt.js", "schack-guide-delar.js"]) {
      assert.doesNotMatch(kod(`src/schack/${f}`), /getDoc|getStudentData|onSnapshot|firebase/i, f);
    }
  });
});

describe("översikten och markupen", () => {
  it("startsidan: kortet 'Lär dig schack' är öppet, bara Pussel kommer snart", () => {
    const html = startHtml(null);
    assert.doesNotMatch(html, /data-act="lar"[^>]*aria-disabled/);
    assert.match(html, /12 korta lektioner/);
    assert.match(html, /data-act="pussel"[^>]*aria-disabled="true"/);
  });
  it("12 öppna lektionskort i ordning med stjärnorna, summan och förslaget", () => {
    const html = oversiktHtml({ 1: 3, 2: 1 });
    assert.equal((html.match(/data-lektion="/g) || []).length, 12);
    assert.deepEqual([...html.matchAll(/data-lektion="(\d+)"/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.doesNotMatch(html, /disabled|låst/i, "alla öppna");
    assert.match(html, /aria-label="3 av 3 stjärnor"/);
    assert.match(html, /aria-label="1 av 3 stjärnor"/);
    assert.equal((html.match(/aria-label="inte klarad än"/g) || []).length, 10);
    assert.match(html, /<b>4 av 36<\/b> stjärnor · 2 av 12 lektioner klara/);
    assert.match(html, /class="schack-lektion-kort nasta" data-lektion="3"/);
    assert.equal(nastaLektion({}), 1);
    assert.equal(nastaLektion(Object.fromEntries(LEKTIONER.map((l) => [l.nr, 1]))), null);
  });
  it("lektionsramen och resultatrutan", () => {
    assert.match(lektionHtml(lektionFor(2), 2), /Lektion 2 av 12 · ditt bästa: 2 stjärnor/);
    assert.match(lektionHtml(lektionFor(2), 0), /data-act="om"/);
    assert.doesNotMatch(lektionHtml(lektionFor(12), 0), /schack-lektion-brade/);
    const r = klarHtml(lektionFor(2), { stjarnor: 2, drag: 10, min: 8, forbattring: true, nasta: lektionFor(3) });
    assert.match(r, /Du klarade det på 10 drag\. Det går på 8/);
    assert.match(r, /Nytt rekord!/);
    assert.match(r, /Nästa: Löparen/);
    assert.doesNotMatch(klarHtml(lektionFor(12), { stjarnor: 3, parti: true, text: "x", nasta: null }), /nasta-lektion/);
  });
});

describe("rättningsrunda 1 (#790 F1–F3)", () => {
  const css = las("src/styles/39-schack-guide.css");
  it("F1: lektionskorten är minst 300 px breda och namnet bryts hellre än krockar med stjärnorna", () => {
    assert.match(css, /\.schack-lektion-lista \{[^}]*minmax\(min\(100%, 300px\), 1fr\)/);
    assert.match(css, /\.schack-lektion-namn \{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere/);
  });
  it("F2: Börja om döljs när jaktuppgiften är klar och visas igen vid nästa uppgift", () => {
    const vy = kod("src/schack/schack-lektion-vy.js");
    assert.match(vy, /function uppgiftKlar\(svar\) \{[^}]*omKnapp\.hidden = true/);
    assert.match(vy, /function visaSteg\(\) \{[\s\S]*?omKnapp\.hidden = false/);
  });
  it("F3: lektion 12 visar bara guidens resultatruta – brädets slutruta döljs", () => {
    assert.match(css, /\.schack-lektion-parti \.schack-slut \{ display: none; \}/);
    assert.match(lektionHtml(lektionFor(12), 0), /schack-lektion-parti/);
  });
});

describe("källkoden (#271)", () => {
  const NYA = ["schack-guide-vy.js", "schack-lektion-vy.js", "schack-lektioner.js", "schack-stjarnjakt.js", "schack-guide-delar.js"];
  it("allt nytt ligger i src/schack/ och guiden laddas bara med import() från flödet", () => {
    const filer = readdirSync(join(ROOT, "src/schack"));
    for (const f of NYA) assert.ok(filer.includes(f), f);
    const flode = las("src/schack/schack-flode.js");
    assert.match(flode, /import\("\.\/schack-guide-vy\.js"\)/);
    assert.doesNotMatch(flode, /^import[^;]*schack-(guide|lektion|stjarnjakt)/m);
    assert.doesNotMatch(las("src/schack/page-schack.js"), /^import[^;]*schack-(guide|lektion|stjarnjakt)/m);
    for (const f of readdirSync(join(ROOT, "src")).filter((x) => x.endsWith(".js"))) {
      assert.doesNotMatch(las(`src/${f}`), /schack-(guide|lektion|stjarnjakt)/, `src/${f}`);
    }
  });
  it("vy=lar och vy=lar&lektion=N i flödet; inga mynt och ingen klocka/timer i guiden", () => {
    assert.match(las("src/schack/schack-flode.js"), /params\.vy === "lar"/);
    assert.match(las("src/schack/schack-flode.js"), /visaGuide\(params\.lektion \|\| null\)/);
    for (const f of NYA) {
      assert.doesNotMatch(kod(`src/schack/${f}`), /coins|mynt|setInterval|setTimeout|Date\.now/i, f);
    }
  });
});
