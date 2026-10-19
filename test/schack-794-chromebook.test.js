// ============================================================================
// Schack 3D (#794): brädet ryms på Chromebook i lektioner/pussel (QA F5), Helskärm i
// lektion/pussel och Tips-statusraden + "Fortsätt med"-numret (QA F6).
// ----------------------------------------------------------------------------
//   * F6 (logiken): texten vid Tips, startNummer/valHtml när det senast lösta pusslet
//     inte klickats vidare från
//   * källkoden: lektions- och pusselvyn monterar helskärmen (rot = .schack-rot, knappen i
//     knappraden) och anropar destroy(); lektion 12 har sin knapp i partivyn; guiden byter
//     lektion på stället i helskärm; bootgrafen 107
//   * CSS: höjdregeln för brädet och helskärmsreglerna finns och är byggda i styles.css
// Den visuella kontrollen (1366×657 m.fl.) görs i förhandsvisningarna (?app=1).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TEXT, tipsText, startNummer } from "../src/schack/schack-pussel.js";
import { valHtml } from "../src/schack/schack-pussel-delar.js";
import { LEKTIONER } from "../src/schack/schack-lektioner.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCDIR = join(ROOT, "src");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("F6: Tips i statusraden", () => {
  it("tipsText: första trycket pekar ut pjäsen, andra trycket säger draget", () => {
    assert.equal(tipsText(1, "Te8#"), TEXT.tips);
    assert.equal(tipsText(1, "Te8#"), "Tips: flytta den markerade pjäsen.");
    assert.equal(tipsText(2, "Te8#"), "Tips: Te8#");
    assert.equal(tipsText(3, "Dxh7#"), "Tips: Dxh7#");
    assert.notEqual(tipsText(1, "Te8#"), TEXT.fel, "aldrig 'Inte riktigt – prova igen!'");
  });

  it("pusselvyn skriver tipset i både panelen och statusraden (brädets setStatus)", () => {
    const k = kod("src/schack/schack-pussel-vy.js");
    const tips = k.slice(k.indexOf("function visaTips"), k.indexOf("/** Pusslet löst"));
    assert.match(tips, /const tips = tipsText\(tipsSteg, svenskSan\(t\.san\)\)/);
    assert.match(tips, /svar\(tips\);\s*brade\.setStatus\(tips\);/);
  });
});

describe("F6: 'Fortsätt med pussel N' pekar på nästa olösta", () => {
  it("läget på det senast lösta pusslet (löst men inte klickat vidare) → nästa", () => {
    assert.equal(startNummer({ ett: { losta: 5, senast: 5 } }, 5, "ett", 200), 6);
    assert.equal(startNummer({ ett: { losta: 1, senast: 1 } }, 1, "ett", 200), 2);
    assert.equal(startNummer({ tva: { losta: 9, senast: 9 } }, 9, "tva", 200), 10);
  });
  it("oförändrat: pågående pussel, tillbakabläddrat, tomt läge och slutet", () => {
    assert.equal(startNummer({ ett: { losta: 5, senast: 5 } }, 6, "ett", 200), 6, "på väg: nästa pussel visas");
    assert.equal(startNummer({ ett: { losta: 5, senast: 5 } }, 3, "ett", 200), 3, "gör om ett tidigare");
    assert.equal(startNummer({ ett: { losta: 5, senast: 5 } }, undefined, "ett", 200), 6, "ingen lokal lagring");
    assert.equal(startNummer({}, 1, "ett", 200), 1, "inget löst än");
    assert.equal(startNummer({ ett: { losta: 200, senast: 200 } }, 200, "ett", 200), 1, "slutet börjar om");
  });
  it("valet visar samma nummer som pusselvyn startar på", () => {
    const f = { ett: { losta: 5, senast: 5 }, tva: { losta: 3, senast: 4 } };
    const v = valHtml(f, { ett: 200, tva: 200 }, { ett: 5, tva: 4 });
    const nasta = [...v.matchAll(/Fortsätt med pussel (\d+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(nasta, [6, 5], "ett: 5 löst → 6; tva: senast 4 (läget 4) → 5");
    // Medan banken laddas (antal okänt) gäller samma regel.
    assert.match(valHtml(f, {}, { ett: 5 }), /Fortsätt med pussel 6/);
    assert.match(valHtml({ ett: { losta: 2, senast: 2 } }, {}, { ett: 7 }), /Fortsätt med pussel 7/);
  });
});

describe("F5: helskärm i lektion och pussel (källkod)", () => {
  it("lektionsvyn monterar knappen i panelens knappar med schacksidans rot och rensar i destroy", () => {
    const k = kod("src/schack/schack-lektion-vy.js");
    assert.match(k, /import \{ monteraHelskarm \} from "\.\/schack-helskarm\.js"/);
    assert.match(k, /monteraHelskarm\(host\.closest\?\.\("\.schack-rot"\) \|\| host, \{ knappPlats: \$\("\.schack-knappar"\) \}\)/);
    assert.match(k, /lektion\.typ === "parti" \? null : monteraHelskarm/, "lektion 12 har knappen i partivyn – bara en");
    const destroy = k.slice(k.indexOf("destroy() {"));
    assert.match(destroy, /helskarm\?\.destroy\(\)/);
  });

  it("pusselvyn monterar knappen i panelens knappar med schacksidans rot och rensar i destroy", () => {
    const k = kod("src/schack/schack-pussel-vy.js");
    assert.match(k, /import \{ monteraHelskarm \} from "\.\/schack-helskarm\.js"/);
    assert.match(k, /helskarm = monteraHelskarm\(host\.closest\?\.\("\.schack-rot"\) \|\| host, \{ knappPlats: \$\("\.schack-knappar"\) \}\)/);
    const destroy = k.slice(k.indexOf("destroy() {"));
    assert.match(destroy, /helskarm\?\.destroy\(\)/);
    // Valet (utan bräde) har ingen knapp: monteringen ligger efter valsgrenens return.
    assert.ok(k.indexOf("helskarm = monteraHelskarm") > k.indexOf("// --- Ett pussel"));
  });

  it("guiden byter lektion på stället i helskärm (hashbyte ritar om sidan och avslutar helskärmen)", () => {
    const k = kod("src/schack/schack-guide-vy.js");
    assert.match(k, /import \{ helskarmElement \} from "\.\.\/helskarm\.js"/);
    assert.match(k, /if \(!n \|\| !helskarmElement\(\)\) return tillGuide\(n\?\.nr \|\| null\)/);
    assert.match(k, /history\.replaceState\(null, "", ctx\.tillHash\(`vy=lar&lektion=\$\{n\.nr\}`\)\)/);
    assert.match(k, /onNasta: \(n\) => nastaLektionIPlats\(n\)/);
  });

  it("vyerna importerar bara schack-helskarm.js (lat modul) – bootgrafen är kvar på 107", () => {
    const g = staticBootGraph();
    assert.equal(g.size, 107);
    assert.ok(![...g].some((f) => f.startsWith(join(SRCDIR, "schack") + "/")), "inget i src/schack/ i bootgrafen");
    assert.ok(!g.has(join(SRCDIR, "helskarm.js")));
  });
});

describe("F5: statusraden ryms på två rader (höjdregeln räknar med två)", () => {
  it("uppgiftstexterna i ställningslektionerna (9–11) är högst 80 tecken (tre rader sprängde höjden, runda 1)", () => {
    for (const l of LEKTIONER.filter((x) => x.typ === "stallning")) {
      for (const u of l.uppgifter) assert.ok(u.text.length <= 80, `lektion ${l.nr}: ${u.text.length} tecken – ${u.text}`);
    }
  });
});

describe("F5: CSS (byggd i styles.css)", () => {
  it("helskärm: resultatrutan får en smal kolumn och panelen hoppar inte när svarsrutan fylls", () => {
    const h = las("src/styles/38-schack-helskarm.css");
    assert.match(h, /:has\(> \.schack-lektion-klar:not\(\[hidden\]\)\) \{ grid-template-columns: minmax\(0, 560px\); \}/);
    assert.match(h, /:is\(\.schack-lektion-svar, \.schack-pussel-svar\):empty \{ display: block; visibility: hidden; \}/);
  });
  const css = las("src/styles.css");
  it("brädet i lektion och pussel följer fönstrets höjd, med golvet 320 px", () => {
    assert.match(las("src/styles/39-schack-guide.css"), /\.schack-lektion-brade\.schack \{ --schack-storlek: max\(320px, min\(100%, 640px, calc\(100svh - 248px\)\)\); \}/);
    assert.match(las("src/styles/40-schack-pussel.css"), /\.schack-pussel-brade\.schack \{ --schack-storlek: max\(320px, min\(100%, 640px, calc\(100svh - 232px\)\)\); \}/);
    assert.match(css, /\.schack-lektion-brade\.schack \{ --schack-storlek/);
    assert.match(css, /\.schack-pussel-brade\.schack \{ --schack-storlek/);
  });
  it("introt står i panelens kolumn på bred skärm (spar höjd över brädet)", () => {
    const g = las("src/styles/39-schack-guide.css");
    assert.match(g, /@media \(min-width: 821px\) \{[\s\S]*?\.schack-lektion-intro \{ grid-column: 2; grid-row: 3;/);
  });
  it("helskärmen skalar brädet i lektion och pussel (egna --lp-variabler, partireglerna orörda)", () => {
    const h = las("src/styles/38-schack-helskarm.css");
    assert.match(h, /--lp-under:/);
    assert.match(h, /:is\(\.schack-lektion-brade, \.schack-pussel-brade\)\.schack \{/);
    assert.match(h, /\.schack-helskarm-pa :is\(\.schack-lektion, \.schack-pussel\) > :is\(\.schack-tillbaka, \.schack-rubrik, \.schack-lektion-huvud\)/);
    assert.match(css, /--lp-under:/);
    // Partiets formel är oförändrad.
    assert.match(h, /--hs-extra: calc\(var\(--hs-basis\) \+ var\(--hs-verktyg\) \+ var\(--hs-slutrad\) \+ var\(--hs-lage\)\);/);
  });
});

function staticBootGraph() {
  const start = join(SRCDIR, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
