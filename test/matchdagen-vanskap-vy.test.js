// ============================================================================
// Matchdagen 4 (#874): vänskapsmatchernas vyer utan Firebase –
//   • lobbyn (md-vy-vanskap.js lobbyHtml): utmaningar, kompisar, pågående matcher och de inbördes
//     mötena; namnen kommer ur andras dokument (lobbyn, karriären) → alltid esc() (lagrad XSS)
//   • vakten (bevaka): kassan och de inbördes mötena räknas in i S.K EN gång, precis som servern
//     skrev dem – bara för en match som pågick när vakten startade
//   • frågekortet (md-svar.js) med serverns rättning: ett Promise, inga dubbelklick, fel → försök igen
//   • fliken finns bara med en klass (md-app.js) och bootgrafen rör den inte (matchdagen-modul.test.js)
// Ren node: node --test test/matchdagen-vanskap-vy.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bevaka, lobbyHtml } from "../src/matchdagen/vanskap/md-vy-vanskap.js";
import { dagNyckel } from "../src/matchdagen/delat/md-sasong.js";

const XSS = "<img src=x onerror=alert(1)>";
const NU = Date.UTC(2026, 10, 20, 10);

describe("lobbyn (§11.1–11.2, §11.4)", () => {
  const S = { uid: "u1", K: { klubb: { namn: `Blixtarna ${XSS}` }, inbordes: { u2: { v: 3, o: 1, f: 2, namn: `FC ${XSS}` }, trasig: "x" } } };
  const lob = {
    utmaningar: {
      in1: { fran: "u2", franNamn: `Omar ${XSS}`, franLag: `FC ${XSS}`, till: "u1", sedan: NU - 1000 },
      gammal: { fran: "u3", franNamn: "Gammal", franLag: "G", till: "u1", sedan: NU - 121_000 },
      ut1: { fran: "u1", franNamn: "Jag", franLag: "B", till: "u3", sedan: NU - 5000 },
    },
    matcher: { m1: { a: "u4", b: "u5", aNamn: `Ada ${XSS}`, bNamn: "Bo", aLag: `A ${XSS}`, bLag: "B" } },
  };
  const kompisar = [{ uid: "u2", namn: `Omar ${XSS}` }, { uid: "u3", namn: "Cia" }, { uid: "u4", namn: "Ada" }];
  const html = lobbyHtml(S, { lob, kompisar, elev: { dag: dagNyckel(NU), antal: 2 }, nu: NU });
  it("inget namn ur dokumenten hamnar oescapat i sidan", () => {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });
  it("utmaningen till mig syns (Anta/Nej tack), en äldre än 2 minuter inte", () => {
    assert.match(html, /data-anta="in1"/);
    assert.match(html, /data-nej="in1"/);
    assert.doesNotMatch(html, /gammal/);
  });
  it("kompisarna: Utmana, väntar på svar (Ta tillbaka) och spelar just nu", () => {
    assert.match(html, /data-utmana="u2"/);
    assert.match(html, /data-tillbaka="ut1"/);
    assert.doesNotMatch(html, /data-utmana="u3"/);
    assert.doesNotMatch(html, /data-utmana="u4"/, "Ada spelar redan");
    assert.match(html, /spelar just nu/);
  });
  it("de inbördes mötena som 'Blixtarna IF – FC Omar: 3–1–2' och dagens betalda matcher", () => {
    assert.match(html, /Blixtarna &lt;img[^<]*&gt; – FC &lt;img[^<]*&gt;: 3–1–2/);
    assert.match(html, /I dag: <b>2 av 3<\/b>/);
  });
  it("ingen kompis med Matchdagen: en förklaring i stället för listan", () => {
    assert.match(lobbyHtml({ uid: "u1", K: {} }, { lob: { utmaningar: {}, matcher: {} }, kompisar: [], elev: {}, nu: NU }), /Ingen annan i klassen/);
  });
});

describe("vakten räknar in slutet som servern (§11.4)", () => {
  function rigg() {
    let cb = null;
    let av = 0;
    const moln = { lyssnaMatch: (_id, f) => { cb = f; return () => { av++; }; } };
    const S = { uid: "u2", K: { kassa: 500, inbordes: { u1: { v: 1, o: 0, f: 0, namn: "Gamla" } } }, kassa() { this.ritad = true; } };
    return { S, moln, skicka: (m) => cb(m), av: () => av };
  }
  const slut = { a: "u1", b: "u2", status: "slut", V: { lag: { a: { namn: `FC ${XSS}` }, b: { namn: "B" } } },
    resultat: { vinnare: "a", walkover: null, stallning: { a: 2, b: 1 }, kassa: { a: 200, b: 100 } } };
  it("pågick → slut: kassan och mötet (förlust) räknas in en gång, och vakten slutar lyssna", () => {
    const r = rigg();
    const vakt = bevaka(r.S, r.moln, "m1");
    assert.equal(r.S.vanskapVakt, vakt);
    r.skicka({ ...slut, status: "pagar", resultat: null });
    r.skicka(slut);
    r.skicka(slut);
    assert.equal(r.S.K.kassa, 600);
    assert.deepEqual(r.S.K.inbordes.u1, { v: 1, o: 0, f: 1, namn: `FC ${XSS}`.slice(0, 24) }); // som servern
    assert.ok(r.S.ritad, "klubbkassan i sidhuvudet ritas om");
    assert.ok(r.av() >= 1);
    assert.equal(r.S.vanskapVakt, null);
  });
  it("redan slut när vakten startade (karriären har pengarna): ingenting räknas in", () => {
    const r = rigg();
    bevaka(r.S, r.moln, "m1");
    r.skicka(slut);
    assert.equal(r.S.K.kassa, 500);
    assert.equal(r.S.K.inbordes.u1.f, 0);
  });
  it("avbruten (båda borta): inget resultat, ingen kassa", () => {
    const r = rigg();
    bevaka(r.S, r.moln, "m1");
    r.skicka({ ...slut, status: "pagar", resultat: null });
    r.skicka({ ...slut, status: "avbruten", resultat: null });
    assert.equal(r.S.K.kassa, 500);
  });
  it("samma match igen ger samma vakt (en lyssnare per match)", () => {
    const r = rigg();
    assert.equal(bevaka(r.S, r.moln, "m1"), bevaka(r.S, r.moln, "m1"));
  });
});

describe("frågekortet med serverns rättning (md-svar.js)", () => {
  it("ett Promise: kortet väntar, ett andra klick räknas inte, ett fel låter eleven svara igen", async () => {
    const { visaFraga } = await import("../src/matchdagen/md-svar.js");
    const el = (extra = {}) => ({ dataset: {}, classList: { add() {} }, setAttribute() {}, focus() {}, addEventListener(t, f) { (this.on ||= {})[t] = f; }, ...extra });
    const knappar = [0, 1, 2].map((i) => el({ dataset: { i: String(i) }, disabled: false }));
    const facit = el({ innerHTML: "", textContent: "" });
    const kort = el({ querySelector: (q) => (q === ".md-fraga-facit" ? facit : null), querySelectorAll: (q) => (q === ".md-alt" ? knappar : []) });
    const host = { set innerHTML(_) {}, querySelector: (q) => (q === ".md-fraga" ? kort : null) };
    const gamla = globalThis.document;
    globalThis.document = { addEventListener() {}, removeEventListener() {} };
    try {
      const anrop = [];
      let svara = null;
      const ratta = (_f, i) => { anrop.push(i); return new Promise((ok, nej) => { svara = { ok, nej }; }); };
      const fraga = { typ: "flerval", text: "7 × 8", alternativ: ["54", "56", "58"] }; // inget facit – servern rättar
      const p = visaFraga(host, fraga, { ratta });
      knappar[0].on.click();
      knappar[1].on.click(); // medan servern rättar
      assert.deepEqual(anrop, [0]);
      assert.ok("rattar" in kort.dataset);
      svara.nej(new Error("offline"));
      await new Promise((r) => setTimeout(r, 0));
      assert.match(facit.textContent, /försök igen/);
      knappar[1].on.click();
      assert.deepEqual(anrop, [0, 1]);
      svara.ok({ giltig: true, ratt: false, facit: "56" });
      const r = await p;
      assert.equal(r.ratt, false);
      assert.match(facit.innerHTML, /Rätt svar: <b>56<\/b>/);
    } finally {
      globalThis.document = gamla;
    }
  });
});

describe("appen", () => {
  it("fliken Vänskap finns bara när sidan hittat elevens klass (deps.vanskap)", () => {
    const src = readFileSync(new URL("../src/matchdagen/md-app.js", import.meta.url), "utf8");
    assert.match(src, /const flikar = deps\.vanskap \? \[\.\.\.FLIKAR, \["vanskap", "Vänskap"\]\] : FLIKAR;/);
    assert.match(src, /import\("\.\/vanskap\/md-vy-vanskap\.js"\)/, "lat – aldrig i bootgrafen");
  });
  it("klienten skriver aldrig i duellsamlingarna – bara callables, två lyssnare och två läsningar", () => {
    const src = readFileSync(new URL("../src/matchdagen/vanskap/md-vanskap-moln.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction/);
  });
});
