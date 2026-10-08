// ============================================================================
// Klasscentrets statistiktavla (#498): lösta uppgifter ur klass-projektionen,
// formattering, progress/max-nivå, panel- och tavla-markup. node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lostaUppgifter, statistikModell, talText, talKort, nivaRad, stapelText, panelHtml, tavlaVarden,
} from "../src/klasscenter/kc-statistik.js";
import { playsTotal } from "../src/leveling.js";
import { troskelFor, MAX_NIVA } from "../src/klasscenter/kc-niva.js";

const NB = " ";

test("playsTotal summerar plays, completed utan plays = 1, trasigt hoppas", () => {
  const progress = {
    a: { quiz: { completed: true, plays: 4 }, memory: { completed: true } },
    b: { para: { completed: false }, rakna: { completed: true, plays: 0 }, x: null, y: "trasig" },
    c: { quiz: { plays: -3 } },
  };
  assert.equal(playsTotal(progress), 5);
  assert.equal(playsTotal(), 0);
  assert.equal(playsTotal(null), 0);
});

test("lostaUppgifter: plays per elev, annars completed, bara nuvarande elever", () => {
  const members = {
    e1: { plays: 10, completed: 3 },
    e2: { completed: 4 }, // skriven före #498 → completed som golv
    e3: { plays: 7 }, // har lämnat klassen
    e4: null,
  };
  assert.equal(lostaUppgifter(members, ["e1", "e2", "e4", "saknas"]), 14);
  assert.equal(lostaUppgifter(members), 21); // ingen lista → alla entries
  assert.equal(lostaUppgifter(members, ["e1", "e1"]), 10); // dubbletter räknas en gång
  assert.equal(lostaUppgifter(null, ["e1"]), 0);
  assert.equal(lostaUppgifter({ e1: { plays: "x", completed: 2 } }, ["e1"]), 2); // trasigt plays → completed
});

test("talText/talKort: svensk tusentalsavgränsning och kort form", () => {
  assert.equal(talText(0), "0");
  assert.equal(talText(1234567), `1${NB}234${NB}567`);
  assert.equal(talText(-5), "0");
  assert.equal(talText("abc"), "0");
  assert.equal(talKort(99999), `99${NB}999`);
  assert.equal(talKort(123456), "123k");
  assert.equal(talKort(2345678), "2,3M");
  assert.equal(talKort(3000000), "3M");
});

test("statistikModell: inte laddat förrän både EXP och elevantal finns", () => {
  assert.equal(statistikModell().laddad, false);
  assert.equal(statistikModell({ exp: 5 }).laddad, false);
  const m = statistikModell({ exp: 10, antalElever: 2, losta: 30 });
  assert.equal(m.laddad, true);
  assert.equal(m.progress.niva, 1); // nivå 2 kräver 7 × 2 = 14
  assert.equal(m.progress.mal, 14);
  assert.equal(m.losta, 30);
});

test("statistikModell: progress mot nästa nivå räknas ur EXP och elevantal", () => {
  const antal = 20;
  const t2 = troskelFor(2, antal);
  const t3 = troskelFor(3, antal);
  const mitt = Math.floor((t2 + t3) / 2);
  const m = statistikModell({ exp: mitt, antalElever: antal, losta: 0 });
  assert.equal(m.progress.niva, 2);
  assert.equal(m.progress.nasta, 3);
  assert.equal(m.progress.mal, t3);
  assert.ok(m.progress.andel > 0.4 && m.progress.andel < 0.6);
  assert.match(nivaRad(m.progress), /^Nivå 2 .+ → Nivå 3 .+/);
  assert.equal(stapelText(m.progress), `${talText(mitt)} / ${talText(t3)} EXP · ${talText(t3 - mitt)} kvar`);
});

test("max-nivå: full stapel, ingen nästa nivå", () => {
  const exp = troskelFor(MAX_NIVA, 3) + 50;
  const m = statistikModell({ exp, antalElever: 3, losta: 1 });
  assert.equal(m.progress.max, true);
  assert.equal(m.progress.andel, 1);
  assert.match(nivaRad(m.progress), new RegExp(`högsta nivån \\(${MAX_NIVA}\\)`));
  assert.match(stapelText(m.progress), /alla nivåer klara/);
  const html = panelHtml(m);
  assert.match(html, /kc-stat-stapel max/);
  assert.match(html, /aria-valuenow="100"/);
  assert.match(tavlaVarden(m), /fill="#F2C14E"/);
});

test("panelHtml: värden, okänt lösta-antal och laddar-läge", () => {
  assert.match(panelHtml(statistikModell()), /Hämtar klassens statistik/);
  const m = statistikModell({ exp: 1234, antalElever: 1, losta: 56789 });
  const html = panelHtml(m, { klassNamn: "6<b>" });
  assert.match(html, new RegExp(`data-kc-stat="exp">1${NB}234<`));
  assert.match(html, new RegExp(`data-kc-stat="losta">56${NB}789<`));
  assert.match(html, /1 elev tillsammans/);
  assert.match(html, /6&lt;b&gt; har/);
  assert.doesNotMatch(html, /6<b>/);
  const okand = panelHtml(statistikModell({ exp: 3, antalElever: 4, losta: null }));
  assert.match(okand, /data-kc-stat="losta">–</);
});

test("tavlaVarden: '…' innan laddat, siffror + stapel efteråt", () => {
  const tom = tavlaVarden(statistikModell());
  assert.equal((tom.match(/>…</g) || []).length, 2);
  assert.doesNotMatch(tom, /<rect/);
  const t2 = troskelFor(2, 10);
  const m = statistikModell({ exp: t2 + 1, antalElever: 10, losta: 123456 });
  const svg = tavlaVarden(m);
  assert.match(svg, new RegExp(`>${t2 + 1}<`));
  assert.match(svg, />123k</);
  assert.match(svg, /<rect [^>]*fill="#7BD389"/);
});
