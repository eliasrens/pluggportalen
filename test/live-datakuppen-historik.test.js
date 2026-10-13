// ============================================================================
// #655 – Datakuppen: historiken och lärarstatistiken (spec §5). Vyn är den
// gemensamma kistspelsmallen (src/live/kistspel/ks-historik.js) – samma som
// Guldrushens – med Datakuppens tema och hackrutan (hela klassens hackförsök
// och andel lyckade). Lärarsidans esc/CSS-laddare drar in Firebase via
// https-importer, så de byts mot små stubbar med en loader-krok här.
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { buildResult, hackStatsByClass } from "../src/live/formats/datakuppen/datakuppen-core.js";
import MULT from "../src/live/modes/multiplication-0-10.js";
import { requireFormat } from "../src/live/formats/index.js";

const HOOK = `export async function resolve(spec, ctx, next) {
  if (spec.endsWith("/teacher-shared.js")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(
    "export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');") };
  if (spec.endsWith("/live-css.js")) return { shortCircuit: true, url: "data:text/javascript,export function ensureLiveCss(){}" };
  return next(spec, ctx);
}`;

const S = {
  id: "dk1", name: "Datakuppen 4A + 4B", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["a", "b"], classNames: { a: "4A", b: "4B" }, hacking: true,
};
const PLAYERS = [{ uid: "u1", name: "Alma", classId: "a" }, { uid: "u2", name: "Bo", classId: "a" }, { uid: "u3", name: "Cia", classId: "b" }];
const DK = [
  { uid: "u1", gold: 300, correct: 4, incorrect: 1, chests: 4, hackAttempts: 3, hackSuccess: 1 },
  { uid: "u2", gold: 300, correct: 3, incorrect: 0, chests: 3, hackAttempts: 0, hackSuccess: 0 },
  { uid: "u3", gold: 90, correct: 1, incorrect: 2, chests: 1, hackAttempts: 2, hackSuccess: 2 },
];
const m = (uid, classId, a, b, ok, at) => ({ uid, classId, mode: "multiplication_0_10", factorA: a, factorB: b, isCorrect: ok, at });
const ANSWERS = [m("u1", "a", 7, 8, true, 1), m("u1", "a", 8, 7, false, 2), m("u2", "a", 6, 6, true, 3), m("u3", "b", 9, 9, false, 4)];
const nb = (s) => String(s).replace(/[  ]/g, " ");

let H;
before(async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
  H = await import("../src/live/formats/datakuppen/datakuppen-history.js");
});

describe("#655 resultatet: hack för hela klassen och per klass", () => {
  it("hacks + hacksByClass (klass ur spelarlistan)", () => {
    const r = buildResult(S, [], PLAYERS, null, { dkPlayers: DK, answers: ANSWERS });
    assert.deepEqual(r.hacks, { attempts: 5, success: 3 });
    assert.deepEqual(r.hacksByClass, { a: { attempts: 3, success: 1 }, b: { attempts: 2, success: 2 } });
    assert.equal(r.perQuestion.length, 3);
    assert.deepEqual(hackStatsByClass([{ uid: "x", classId: "c", hackAttempts: "2", hackSuccess: -1 }]), { c: { attempts: 2, success: 0 } });
  });
  it("formatet pekar på historikvyn", () => {
    assert.equal(typeof requireFormat("datakuppen").historyRenderer, "function");
  });
});

describe("#655 historikvyn (lärarsidan)", () => {
  const r = { ...buildResult(S, [], PLAYERS, null, { dkPlayers: DK, answers: ANSWERS }), rewards: { u1: { total: 15 } } };

  it("vinnare med delad 1:a, pallplats, klassens data och hackrutan", async () => {
    assert.equal(H.winnerText(S, r), "💾 Alma & Bo");
    const html = nb(await H.detailHtml(S, r, { getAnswers: async () => ANSWERS }));
    assert.match(html, /delad 1:a · 💾 300 MB/);
    assert.match(html, /💾 600<\/b><small>MB data tillsammans/);
    assert.match(html, /💻 Hackförsök<\/span><b>5<\/b>/);
    assert.match(html, /🔓 Lyckade<\/span><b>60 %<\/b><small>3 av 5 hack/);
    assert.match(html, /🔒 Misslyckade<\/span><b>2<\/b>/);
    assert.doesNotMatch(html, /hackAttempts|Hackförsök<\/th>/, "inga hackförsök per elev");
  });
  it("topplista med pluggmynt och andel rätt per uppgift och per tabell (statKeys)", async () => {
    const html = nb(await H.detailHtml(S, r, { getAnswers: async () => ANSWERS }));
    assert.match(html, /Filer<\/th><th class="num">💾 Data \(MB\)<\/th>/);
    assert.match(html, /Pluggmynt/);
    assert.match(html, /<td class="num">15<\/td>/);
    assert.match(html, /Andel rätt per uppgift/);
    assert.match(html, /7 × 8/);
    assert.match(html, /Andel rätt per tabell/);
    assert.ok(MULT.statCategories, "multiplikation har statCategories");
  });
  it("hackning av: rutan säger det, statistiken visar 'av'", async () => {
    const off = { ...S, hacking: false };
    const html = await H.detailHtml(off, r, { getAnswers: async () => [] });
    assert.match(html, /Hackning var avstängd/);
    assert.equal(H.classStats.cells(off, r, "a").endsWith(`<td class="num">av</td>`), true);
  });
  it("Statistik → Live: Rätt · Data · Hack per klass", () => {
    assert.equal(H.classStats.cols, 3);
    assert.match(H.classStats.head, /Hack/);
    assert.equal(nb(H.classStats.cells(S, r, "a")), `<td class="num">7</td><td class="num">600</td><td class="num">1/3 (33 %)</td>`);
    assert.equal(H.classStats.cells(S, null, "a"), `<td class="num">–</td><td class="num">–</td><td class="num">–</td>`);
    assert.match(H.classSummaryHtml([{ s: S, result: r }], "a"), /💾 Datakuppen – /);
    assert.deepEqual(H.playerCounts(S, r).get("u1"), { correct: 4, incorrect: 1 });
    assert.equal(H.ownPlayerTable, true);
  });
  it("utan resultat och utan svar", async () => {
    assert.match(await H.detailHtml(S, null), /Inget resultat ännu/);
    assert.match(await H.detailHtml(S, { ...r, perQuestion: undefined }, { getAnswers: async () => { throw new Error("x"); } }), /Svaren kunde inte läsas/);
  });
});

describe("#655 Guldrushen på samma mall", () => {
  it("guldrush-history.js är ett tema på ks-historik.js", () => {
    const src = readFileSync(new URL("../src/live/formats/guldrush/guldrush-history.js", import.meta.url), "utf8");
    assert.match(src, /createKistHistory\(/);
    assert.match(src, /amount: \(n\) => `\$\{tal\(n\)\} guld`/);
  });
});
