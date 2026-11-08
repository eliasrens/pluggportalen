// ============================================================================
// Slut-QA Meteorstormen (#825, TESTAREN): msAvsluta försöks igen.
// I webbläsaren (emulatorerna under last) misslyckades projektorns enda
// msAvsluta-anrop vid 00:00 och elevernas enda reservanrop efter 20–35 s –
// slutrutan stod kvar på "Stormen är över! Räknar ihop stationerna …" och
// eleverna på "Stationerna räknas ihop …", inga pluggmynt, tills någon laddade
// om sidan. Nu: avslutaOchBetala försöker två gånger till (2 s, 5 s) vid
// tillfälliga fel, och elevskärmen försöker igen var 15:e s (högst 3 anrop).
// ============================================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avslutaOchBetala, avslutaMedForsok, AVSLUTA_FORSOK_MS } from "../src/live/formats/meteorstorm/ms-avslut.js";

const RES = { format: "meteorstorm", winner: "4b", rewards: { u1: { rank: 1, correct: 3, prize: 300, correctCoins: 15, total: 315 } } };
const fel = (code) => Object.assign(new Error(code || "nät"), code ? { code } : {});

describe("msAvsluta försöks igen (testaren #825)", () => {
  it("två tillfälliga fel, sedan svar → resultatet, väntan 2 s och 5 s", async () => {
    const vantat = [];
    let n = 0;
    const svar = await avslutaMedForsok(async (sid) => { n++; if (n < 3) throw fel(n === 1 ? "internal" : "unavailable"); return { result: RES, sid }; }, "s1", async (ms) => vantat.push(ms));
    assert.equal(n, 3);
    assert.deepEqual(vantat, AVSLUTA_FORSOK_MS);
    assert.deepEqual(vantat, [2000, 5000]);
    assert.equal(svar.sid, "s1");
  });

  it("slutgiltiga fel (nekad, fel indata) försöks inte igen", async () => {
    for (const code of ["permission-denied", "unauthenticated", "invalid-argument", "not-found", "failed-precondition"]) {
      let n = 0;
      await assert.rejects(avslutaMedForsok(async () => { n++; throw fel(code); }, "s1", async () => {}), (e) => e.code === code);
      assert.equal(n, 1, code);
    }
  });

  it("tre misslyckade anrop → felet kastas vidare (kärnan loggar det, historiken frågar igen)", async () => {
    let n = 0;
    await assert.rejects(avslutaMedForsok(async () => { n++; throw fel(); }, "s1", async () => {}), /nät/);
    assert.equal(n, 3);
  });

  it("avslutaOchBetala: första anropet misslyckas → mynten betalas ändå, en gång, med serverns result", async () => {
    const anrop = [];
    let n = 0;
    const deps = {
      avsluta: async (sid) => { anrop.push(["avsluta", sid]); if (++n === 1) throw fel("internal"); return { result: RES, redan: false }; },
      settle: async (sid, s) => anrop.push(["settle", sid, s.status, s.result]),
      vanta: async () => {},
    };
    assert.equal(await avslutaOchBetala({ id: "s1", status: "live" }, deps), RES);
    assert.deepEqual(anrop, [["avsluta", "s1"], ["avsluta", "s1"], ["settle", "s1", "finished", RES]]);
  });

  it("elevskärmen försöker igen (högst 3 anrop, var 15:e s, bara medan result saknas)", () => {
    const vy = readFileSync(new URL("../src/live/formats/meteorstorm/ms-elev-vy.js", import.meta.url), "utf8");
    assert.match(vy, /const AVSLUTA_IGEN_MS = 15_000;/);
    assert.match(vy, /if \(destroyed \|\| st\?\.result \|\| !player\) return;\s*\n\s*api\.avsluta\(sid\)\.catch\(\(\) => \{ if \(kvar > 0\) avslutaT = setTimeout\(\(\) => forsok\(kvar - 1\), AVSLUTA_IGEN_MS\); \}\);/);
    assert.match(vy, /avslutaT = setTimeout\(\(\) => forsok\(2\), a \+ Math\.random\(\) \* \(b - a\)\);/);
  });
});
