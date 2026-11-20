// ============================================================================
// Matchdagen 1c (#869): lärarens Hur går det? → Matchdagen visar bara TAL ur
// elevens dokument. Eleven skriver matchdagen/{uid}, så text i summan får aldrig
// hamna som HTML i lärarens session (granskningen, HÖG: lagrad XSS). Reglerna
// (mdSummaOk) nekar text – testat i test/firestore-rules-matchdagen.test.js –
// och vyn tvättar talen ändå.
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";

const XSS = "<img src=x onerror=alert(1)>";
let elevRad;
before(async () => {
  installeraFirebaseStubbe();
  ({ elevRad } = await import("../src/matchdagen/larare/md-larare-stat.js"));
});

describe("lärarens tabell (#869): bara tal ur elevens dokument", () => {
  it("text i summan blir 0 – aldrig HTML", () => {
    const K = {
      klubb: { namn: "Lag" }, div: 0, sasong: XSS, dagar: {},
      summa: { matcher: XSS, ratt: XSS, fragor: "1<b>", spelminuter: XSS, perKalla: { "tabell:7": { ratt: XSS, fragor: XSS, namn: "7:ans" } } },
    };
    const r = elevRad({ id: "e1", namn: "Alva" }, K);
    for (const k of ["matcher", "ratt", "fragor", "minTotalt", "sasong", "sek7"]) assert.equal(r[k], 0, k);
    assert.deepEqual(r.kallor[0][1], { namn: "7:ans", ratt: 0, fragor: 0 });
  });
  it("vanliga tal går igenom", () => {
    const r = elevRad({ id: "e1" }, { klubb: { namn: "Lag" }, div: 0, sasong: 2, dagar: {},
      summa: { matcher: 7, ratt: 140, fragor: 196, spelminuter: 49.5, perKalla: {} } });
    assert.deepEqual([r.matcher, r.ratt, r.fragor, r.minTotalt, r.sasong], [7, 140, 196, 49.5, 2]);
  });
  it("mallen skriver inga råa fält ur dokumentet (bara tal via tal() eller esc())", () => {
    const src = readFileSync(new URL("../src/matchdagen/larare/md-larare-stat.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /\$\{m\.(oss|dem|ratt|fragor)\}/, "matchraderna");
    assert.match(src, /\$\{tal\(m\.oss\)\}–\$\{tal\(m\.dem\)\}/);
  });
});
