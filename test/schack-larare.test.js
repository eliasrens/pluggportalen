// ============================================================================
// Schack 2C (#781, spec §10): lärarens sektion "Schack". Rena delar
// (modulvalet, statistiken, topplistan, partilistan, dragsynken, slutet,
// vakten som stänger lyssnarna), att åskådarbrädet inte tar inmatning, att
// lyssnarna stängs, markupen och att allt laddas lat (bootgrafen).
// Körs med: node --test test/schack-larare.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASKADAR_OPT, MODUL, datorPartierUr, klockText, klockTyp, modulAndring, okandaId, partiRader, schackPa, skapaNamnFor, skapaVakt,
  slutInfo, statistikRader, statistikSumma, synkaDrag, topplista, turText,
} from "../src/schack/larare/schack-larare-delar.js";
import { bekraftaHtml, modulHtml, partiListaHtml, statistikHtml, topplistaHtml } from "../src/schack/larare/schack-larare-markup.js";
import { skapaSchackKontroll } from "../src/schack/schack-kontroll.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
/** Källkoden utan kommentarer. */
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const LARARE = "src/schack/larare";
const filer = readdirSync(join(ROOT, LARARE)).filter((f) => f.endsWith(".js")).map((f) => `${LARARE}/${f}`);

describe("modulen på/av (enabledModules)", () => {
  it("schackPa: bara i enabledModules och inte dold", () => {
    assert.equal(schackPa({}), false);
    assert.equal(schackPa({ enabledModules: ["schack"] }), true);
    assert.equal(schackPa({ enabledModules: ["schack"], hiddenModules: ["schack"] }), false);
    assert.equal(schackPa({ enabledModules: ["hittaratt"] }), false);
  });
  it("modulAndring rör bara schack – andra moduler står kvar", () => {
    const cls = { enabledModules: ["hittaratt"], hiddenModules: ["shop", "schack"] };
    assert.deepEqual(modulAndring(cls, true), { hidden: ["shop"], enabled: ["hittaratt", "schack"] });
    assert.deepEqual(modulAndring({ enabledModules: ["schack", "hittaratt"], hiddenModules: ["shop"] }, false), { hidden: ["shop"], enabled: ["hittaratt"] });
    assert.equal(MODUL, "schack");
  });
});

describe("statistiken per elev (§10)", () => {
  const namnFor = skapaNamnFor([{ id: "a", namn: "Alva" }, { id: "b", namn: "Bo" }, { id: "c", namn: "Cleo" }]);
  const tabell = { a: { poang: 1020, vinster: 2, forluster: 1, remier: 0, partier: 3 }, b: { poang: 990, vinster: 1, forluster: 2, remier: 0, partier: 3 } };
  it("mot kompisar ur tabell.partier, mot datorn null tills det hämtats, sorterat på namn", () => {
    const r = statistikRader(["c", "b", "a", "a"], { tabell, namnFor });
    assert.deepEqual(r.map((x) => [x.namn, x.kompis, x.dator]), [["Alva", 3, null], ["Bo", 3, null], ["Cleo", 0, null]]);
    assert.deepEqual(statistikSumma(r), { kompis: 3, dator: null }, "ett kompisparti räknas en gång, inte per spelare");
  });
  it("datorpartierna ur studentData.schack.datorPartier; nekad läsning = null, totalt = summan", () => {
    const dator = new Map([["a", 4], ["b", 0], ["c", null]]);
    const r = statistikRader(["a", "b", "c"], { tabell, dator, namnFor });
    assert.deepEqual(r.map((x) => [x.dator, x.totalt]), [[4, 7], [0, 3], [null, 0]]);
    assert.deepEqual(statistikSumma(r), { kompis: 3, dator: 4 });
  });
  it("datorPartierUr tål saknat/trasigt dokument", () => {
    assert.equal(datorPartierUr(null), 0);
    assert.equal(datorPartierUr({ schack: { datorPartier: 5, aktivtParti: "x" } }), 5);
    assert.equal(datorPartierUr({ schack: { datorPartier: "5" } }), 0);
    assert.equal(datorPartierUr({ schack: { datorPartier: -2 } }), 0);
  });
  it("namnen: elevlistan först, sedan projektionen, sist reserv; okandaId säger vilka som behöver projektionen", () => {
    const n = skapaNamnFor([{ id: "a", namn: "Alva" }], { s: { namn: "Saga" }, constructor: undefined });
    assert.deepEqual([n("a"), n("s"), n("x"), n("constructor")], ["Alva", "Saga", "Okänd elev", "Okänd elev"]);
    assert.deepEqual(okandaId(["a", "s", "s", ""], [{ id: "a" }]), ["s"]);
  });
  it("topplistan för läraren i samma ordning som elevernas", () => {
    assert.deepEqual(topplista(tabell, namnFor).map((r) => [r.plats, r.namn, r.poang]), [[1, "Alva", 1020], [2, "Bo", 990]]);
  });
});

describe("partierna, klockan och slutet", () => {
  it("partiRader: äldst först, trasiga poster bort", () => {
    const r = partiRader({ p2: { vitNamn: "C", svartNamn: "D", klocka: null, start: 20 }, p1: { vitNamn: "A", svartNamn: "B", klocka: 10, start: 10 }, x: null });
    assert.deepEqual(r.map((x) => [x.id, x.klocka]), [["p1", 10], ["p2", null]]);
    assert.deepEqual([klockTyp(null), klockTyp(5)], ["Utan klocka", "5 min"]);
  });
  it("klockText", () => {
    assert.deepEqual([klockText(0), klockText(59_001), klockText(600_000), klockText(3_725_000), klockText(Infinity), klockText(null)],
      ["0:00", "1:00", "10:00", "1:02:05", "", ""]);
  });
  it("synkaDrag: nya drag spelas, allt annat laddas om", () => {
    assert.deepEqual(synkaDrag(["e4"], ["e4", "e5", "Nf3"]), { nya: ["e5", "Nf3"] });
    assert.deepEqual(synkaDrag(["e4"], ["e4"]), { nya: [] });
    assert.equal(synkaDrag(["e4", "e5"], ["e4"]), null);
    assert.equal(synkaDrag(["d4"], ["e4", "e5"]), null);
  });
  it("slutInfo: avbrutet = ingen vinnare, gav upp/tid namnger förloraren; pågående = null", () => {
    const p = { status: "slut", vitNamn: "Alva", svartNamn: "Bo" };
    assert.equal(slutInfo({ ...p, status: "pagar" }), null);
    const a = slutInfo({ ...p, resultat: null, orsak: "avbrutet" });
    assert.deepEqual([a.vinnare, a.titel, a.orsak, a.resultat], [null, "Partiet avbröts", "avbrutet", "½-½"]);
    const g = slutInfo({ ...p, resultat: "1-0", orsak: "gav-upp" });
    assert.deepEqual([g.vinnare, g.titel, g.text], ["w", "Alva vann!", "Bo gav upp."]);
    assert.equal(slutInfo({ ...p, resultat: "0-1", orsak: "tid" }).text, "Alvas tid tog slut.");
    assert.equal(slutInfo({ ...p, resultat: "½-½", orsak: "remi" }).titel, "Remi – ingen vann");
    assert.equal(turText({ status: "pagar", tur: "b", vitNamn: "Alva", svartNamn: "Bo" }), "Bo (svart) drar");
  });
});

describe("vakten stänger lyssnarna när sektionen lämnas", () => {
  function fejk() {
    const t = { intervall: [], timeouts: [], rensad: 0 };
    t.timers = {
      setInterval: (fn) => (t.intervall.push(fn), 1),
      clearInterval: () => t.rensad++,
      setTimeout: (fn) => (t.timeouts.push(fn), 2),
    };
    t.lyssnare = new Map();
    t.fonster = {
      addEventListener: (typ, fn) => t.lyssnare.set(typ, fn),
      removeEventListener: (typ, fn) => t.lyssnare.get(typ) === fn && t.lyssnare.delete(typ),
    };
    return t;
  }
  it("värden borta → alla avstängningar körs en gång, intervallet och hashchange tas bort", () => {
    const t = fejk();
    let kvar = true;
    const v = skapaVakt(() => kvar, { timers: t.timers, fonster: t.fonster });
    let a = 0;
    let b = 0;
    v.lagg(() => a++);
    v.lagg(() => b++);
    t.intervall[0]();
    assert.deepEqual([a, b, v.stangd], [0, 0, false]);
    kvar = false;
    t.intervall[0]();
    t.intervall[0]();
    assert.deepEqual([a, b, v.stangd, v.antal, t.rensad, t.lyssnare.has("hashchange")], [1, 1, true, 0, 1, false]);
  });
  it("hashchange kollar direkt efter routerns omritning", () => {
    const t = fejk();
    let kvar = true;
    let a = 0;
    const v = skapaVakt(() => kvar, { timers: t.timers, fonster: t.fonster });
    v.lagg(() => a++);
    kvar = false;
    t.lyssnare.get("hashchange")();
    t.timeouts.shift()();
    assert.deepEqual([a, v.stangd], [1, true]);
  });
  it("en avstängning som läggs efter stängningen körs direkt; avregistrering stänger bara sin egen", () => {
    const t = fejk();
    const v = skapaVakt(() => true, { timers: t.timers, fonster: t.fonster });
    let a = 0;
    let b = 0;
    const avA = v.lagg(() => a++);
    v.lagg(() => b++);
    avA();
    avA();
    assert.deepEqual([a, b, v.antal], [1, 0, 1]);
    v.stang();
    let c = 0;
    v.lagg(() => c++);
    assert.deepEqual([a, b, c], [1, 1, 1]);
  });
});

describe("åskådarbrädet tar ingen inmatning", () => {
  it("ASKADAR_OPT: interaktiv false, vit nederst, ingen egen färg, ingen beforeMove", () => {
    assert.deepEqual({ ...ASKADAR_OPT }, { egenFarg: null, motstandare: "kompis", interaktiv: false, orientering: "w" });
    assert.ok(Object.isFrozen(ASKADAR_OPT));
  });
  it("brädets kontroll med ASKADAR_OPT: tryck, dra och släpp gör inget – bara move() från servern", () => {
    const k = skapaSchackKontroll({ ...ASKADAR_OPT });
    for (const ruta of ["e2", "g1", "e7"]) assert.equal(k.tryck(ruta).typ, "ingen");
    assert.equal(k.slapp("e2", "e4").typ, "ingen");
    assert.equal(k.valj("e2").typ, "ingen");
    assert.equal(k.getState().vald, null);
    assert.equal(k.getHistory().length, 0);
    assert.ok(k.move("e4"), "serverns drag spelas");
    assert.equal(k.tryck("e7").typ, "ingen");
    assert.equal(k.getState().orientering, "w");
  });
  it("källkoden: åskådarläget skapar brädet med ASKADAR_OPT och kopplar aldrig in inmatning", () => {
    const s = kod(`${LARARE}/schack-larare-askadare.js`);
    assert.match(s, /skapaSchackbrade\(bradeEl, \{\s*\.\.\.ASKADAR_OPT,/);
    assert.doesNotMatch(s, /beforeMove|setInteractive|interaktiv:\s*true|onMove/);
    assert.doesNotMatch(s, /moln\.parti\.|moln\.lobby\./, "läraren gör inga drag");
    assert.doesNotMatch(s, /\.tryck\(|\.slapp\(|\.valjForvandling\(/);
  });
});

describe("lyssnarna: en per vy, och de stängs", () => {
  it("sektionen: EN lyssnaKlass, avregistreringen ligger i vakten, vakten kollar värden och routen", () => {
    const s = kod(`${LARARE}/schack-larare.js`);
    assert.equal((s.match(/moln\.lyssnaKlass\(/g) || []).length, 1);
    assert.match(s, /const stopp = moln\.lyssnaKlass\(/);
    assert.match(s, /vakt\.lagg\(stopp\)/);
    assert.match(s, /skapaVakt\(\(\) => host\.isConnected && location\.hash\.split\("\?"\)\[0\] === route\)/);
    assert.doesNotMatch(s, /lyssnaParti/, "partiet lyssnas bara i åskådarläget");
  });
  it("åskådarläget: EN lyssnaParti; stang() stänger lyssnaren, intervallet och brädet och ligger i vakten", () => {
    const s = kod(`${LARARE}/schack-larare-askadare.js`);
    assert.equal((s.match(/moln\.lyssnaParti\(/g) || []).length, 1);
    assert.match(s, /const stoppLyssna = moln\.lyssnaParti\(/);
    const stang = s.slice(s.indexOf("function stang()"));
    for (const r of [/clearInterval\(tick\)/, /stoppLyssna\(\)/, /brade\.destroy\(\)/, /return vakt\.lagg\(stang\)/]) assert.match(stang, r);
    const main = kod(`${LARARE}/schack-larare.js`);
    assert.match(main, /function tillbaka\(\) \{\s*ui\.askadare\?\.stang\?\.\(\);/, "Tillbaka stänger partiets lyssnare");
    // Klicklyssnaren sitter på vyns eget element: en gammal åskådarvy kan aldrig avsluta fel parti.
    assert.doesNotMatch(s, /\brot\.addEventListener\(/);
    assert.match(s, /\$\("\.sl-ask"\)\.addEventListener\("click", async \(e\) => \{\s*if \(stangd\) return;/);
  });
  it("lyssnaKlass/lyssnaParti är fortfarande EN onSnapshot var i schack-moln.js", () => {
    const m = kod("src/schack/schack-moln.js");
    assert.equal((m.match(/onSnapshot\(/g) || []).length, 2);
  });
});

describe("markupen", () => {
  it("bekräftelserutan är på sidan – inget confirm() någonstans i lärarsektionen", () => {
    for (const f of filer) assert.doesNotMatch(kod(f), /\bconfirm\(|\balert\(|\bprompt\(/, f);
    const b = bekraftaHtml({ fraga: "Avsluta <b>?", text: "t", ja: "Ja", id: "p1" });
    assert.match(b, /data-ja="p1"/);
    assert.match(b, /data-nej="1"/);
    assert.match(b, /Avsluta &lt;b&gt;\?/);
  });
  it("partilistan: Titta + Avsluta per parti, bekräftelse bara för det valda, namn escapade", () => {
    const rader = partiRader({ p1: { vitNamn: "<Alva>", svartNamn: "Bo", klocka: 10, start: 1 }, p2: { vitNamn: "C", svartNamn: "D", start: 2 } });
    const h = partiListaHtml(rader, { bekrafta: "p2", vantar: 2 });
    assert.equal((h.match(/data-titta=/g) || []).length, 2);
    assert.equal((h.match(/sl-bekrafta/g) || []).length, 1);
    assert.match(h, /Avsluta partiet mellan C och D\?/);
    assert.match(h, /&lt;Alva&gt;/);
    assert.match(h, /2 elever väntar/);
    assert.match(partiListaHtml([]), /Inga partier pågår/);
    assert.match(partiListaHtml([], { fel: "Partiet var redan slut." }), /role="alert">Partiet var redan slut\./);
  });
  it("topplistan: dold/visa, nollställ med bekräftelse, tom lista", () => {
    const lista = topplista({ a: { poang: 1010, vinster: 1, forluster: 0, remier: 0, partier: 1 } }, () => "Alva");
    assert.match(topplistaHtml(lista, { dold: false }), /data-dold="dolj"[^>]*>Dölj för eleverna/);
    assert.match(topplistaHtml(lista, { dold: true }), /data-dold="visa"[^>]*>Visa för eleverna/);
    assert.match(topplistaHtml(lista, { dold: false, bekrafta: true }), /Nollställa topplistan\?/);
    assert.match(topplistaHtml([], { dold: false }), /data-nollstall="1" disabled/);
    assert.match(topplistaHtml(lista, { dold: false, resultat: { ok: true, text: "Klart" } }), /✓ Klart/);
  });
  it("statistiken visar kostnaden för datorläsningen och – för ej hämtat", () => {
    const rader = statistikRader(["a"], { namnFor: () => "Alva" });
    const h = statistikHtml(rader, { datorHamtad: false });
    assert.match(h, /1 läsningar\) – bara när du trycker/);
    assert.match(h, /aria-label="inte hämtat"/);
    assert.match(modulHtml({ pa: false, klassNamn: "5E", antalPartier: 2 }), /2 partier pågår fortfarande/);
    assert.match(modulHtml({ pa: true, klassNamn: "5E" }), /data-modul="av"/);
  });
});

describe("laddningen (#271)", () => {
  it("sektionen finns i Klasser-läget och laddas bara med import()", () => {
    const s = kod("src/teacher-classes-sections.js");
    assert.match(s, /klasser: \{[^\n]*sections: \[[^\]]*"schack"/);
    assert.match(s, /key: "schack",/);
    assert.match(s, /await import\("\.\/schack\/larare\/schack-larare\.js"\)\)\.renderSchackSektion/);
    for (const f of readdirSync(join(ROOT, "src")).filter((x) => x.endsWith(".js"))) {
      assert.doesNotMatch(kod(`src/${f}`), /^\s*(?:import|export)\s[^;]*?from\s+["']\.\/schack\//m, `src/${f} importerar schack statiskt`);
    }
  });
  it("lärarfilerna importerar bara rena delar statiskt; moln, data och brädet med import()", () => {
    for (const f of filer) {
      const statiska = [...kod(f).matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
      for (const imp of statiska) {
        assert.ok(/schack-larare-(delar|markup)\.js$|gamemode-visibility\.js$|schack-server-delat\.js$|firebase-config\.js$|firebase-firestore\.js$/.test(imp), `${f}: ${imp}`);
      }
    }
    assert.match(kod(`${LARARE}/schack-larare.js`), /import\("\.\.\/schack-moln\.js"\)/);
    assert.match(kod(`${LARARE}/schack-larare-askadare.js`), /import\("\.\.\/schack-bradet\.js"\)/);
  });
  it("inga pluggmynt i lärarsektionen", () => {
    for (const f of filer) assert.doesNotMatch(kod(f), /addCoins|coins|pluggmynt\(/i, f);
  });
});

describe("rättningsrunda 1 (F1–F4)", () => {
  const css = las(`${LARARE}/schack-larare.css`);
  const s = kod(`${LARARE}/schack-larare.js`);
  it("F1: tabellerna har inte .tbl:s min-width 640 – alla kolumner syns på mobil", () => {
    assert.match(css, /\.teacher-dark \.sl-tbl \{ min-width: 0; \}/);
  });
  it("F2: åskådarbrädet blir aldrig bredare än kortet (320 px utan sidscroll)", () => {
    assert.match(css, /--schack-storlek: min\(100%, max\(300px,/);
    assert.match(css, /min-width: min\(300px, 100%\);/);
  });
  it("F3: listan och topplistan ritas inte om medan en bekräftelseruta är öppen; fokus följer med omritningen", () => {
    assert.match(s, /function ritaPartier\(\) \{[\s\S]*?if \(ui\.bekrafta\) return;[\s\S]*?satt\(partierEl,/);
    assert.match(s, /function ritaTopp\(\{ tvinga = false \} = \{\}\) \{\s*if \(!klass \|\| \(ui\.toppBekrafta && !tvinga\)\) return;/);
    assert.match(s, /function satt\(el, html, reserv = null\) \{[\s\S]*?igen\.focus\([\s\S]*?reserv\?\.focus\(/);
  });
  it("F4: efter Avsluta → Ja får nästa parti (eller rubriken) fokus, aldrig <body>", () => {
    assert.match(s, /<h3 id="sl-h-partier" class="sl-h" tabindex="-1">/);
    assert.match(s, /const mal = r\.ok \? nasta && partierEl\.querySelector\(`\[data-titta=/);
    assert.match(s, /\(mal \|\| rubrikPartier\)\.focus\(/);
  });
});
