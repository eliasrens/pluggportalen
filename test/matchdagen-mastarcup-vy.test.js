// ============================================================================
// Matchdagen 3 (#873): lärarens elevpanel och Tabell-fliken med Superligan och Mästarcupen.
//   • Testern F1: lasKarriarer ger dokumentets pokaler som RADER ("typ|namn|säsong|datum") –
//     toppRader räknar titlarna ur raderna (och ur objekten i appen)
//   • Testern F5: Superligans tabell säger inte "Ettan får kvala upp"
// Ren node: node --test test/matchdagen-mastarcup-vy.test.js
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { nyKarriar, nyLiga, pokalerFranDok } from "../src/matchdagen/delat/md-sasong.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let larare;
let tabell;
before(async () => {
  installeraFirebaseStubbe();
  larare = await import("../src/matchdagen/larare/md-larare-stat.js");
  tabell = await import("../src/matchdagen/vy/md-vy-tabell.js");
});

const rng = (f) => skapaPrng(f).tal;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#2f6fe8", rng: rng("vy") });
const RADER = ["superliga|Mästare i Superligan|12|2026-11-10", "superliga|Mästare i Superligan|13|2026-11-15",
  "mastarcup|Mästarcupen|13|2026-11-14", "liga|Vinnare Division 6|1|2026-11-01"];

describe("lärarens elevpanel: titlarna ur dokumentets pokalrader (Testern F1)", () => {
  it("rader som lasKarriarer ger dem: Superligan 2 gånger, Mästarcupen 1 gång", () => {
    const K = { ...K0, div: TOPP_DIV, sasong: 14, pokaler: RADER };
    const t = larare.toppRader(K);
    assert.ok(t.includes("Mästare i Superligan: 2 gånger"), t.join(" / "));
    assert.ok(t.includes("Mästarcupen vunnen: 1 gång"), t.join(" / "));
  });
  it("samma svar med objekten (elevens app) och ingenting utan titlar", () => {
    const K = { ...K0, div: TOPP_DIV, sasong: 14, pokaler: pokalerFranDok(RADER) };
    assert.deepEqual(larare.toppRader(K), larare.toppRader({ ...K, pokaler: RADER }));
    assert.deepEqual(larare.toppRader({ ...K0, pokaler: ["liga|Vinnare Division 6|1|2026-11-01"] }), []);
  });
});

describe("Tabell-fliken: Superligan kvalar inte (Testern F5)", () => {
  const knapp = { addEventListener: () => {} };
  const el = () => ({ innerHTML: "", querySelector: () => knapp, querySelectorAll: () => [] });
  it("Superligan: 'Ettan blir mästare …', inte 'Ettan får kvala upp'; Division 6 som förut", () => {
    const S = { K: { ...K0, div: TOPP_DIV, sasong: 12, liga: nyLiga(TOPP_DIV, K0.klubb.farg, rng("l")) }, uid: "u", visa: () => {} };
    const e = el();
    tabell.visaTabell(S, e);
    assert.match(e.innerHTML, /Ettan blir mästare och bjuds in till Mästarcupen/);
    assert.doesNotMatch(e.innerHTML, /kvala upp/);
    const e6 = el();
    tabell.visaTabell({ ...S, K: K0 }, e6);
    assert.match(e6.innerHTML, /Ettan får kvala upp/);
  });
});
