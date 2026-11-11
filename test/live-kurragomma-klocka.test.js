// ============================================================================
// Kurragömma (#838): kärnans matchklocka täcker gömfasen + letfasen (spec §0.1,
// §13.2) – UTAN kärnändring. buildSessionDoc sätter durationSeconds ur
// durationMin och sprider sedan formatets buildSessionFields EFTER, så ett
// format med pacing "tid" kan sätta durationSeconds = matchSekunder(...) själv.
// Testet visar att det fungerar för ett Kurragömma-liknande format, och att
// Klassmatchens, Guldrushens och Meteorstormens klocka är oförändrad.
// Ren Node, ingen emulator.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireFormat } from "../src/live/formats/index.js";
import { registerFormat } from "../src/live/live-formats.js";
import { buildSessionDoc, sessionTimes, phaseAt } from "../src/live/live-core.js";
import { matchSekunder, normInstallningar, normSpeltidMin } from "../src/live/formats/kurragomma/delat/kg-regler.js";

const KG_LIKT = registerFormat({
  id: "test_kg_klocka",
  displayName: "Kurragömma (test)",
  icon: "🙈",
  scope: "inom-klass",
  minClasses: 1,
  maxClasses: 1,
  answerKinds: ["free", "choice"],
  pacing: "tid",
  setupFields: [],
  compatibleGameModes: () => true,
  validateSetup: () => [],
  buildSessionFields: (i) => {
    const inst = normInstallningar(i.kgInstallningar);
    return { kgInstallningar: inst, durationSeconds: matchSekunder({ gomtid: inst.gomtid, speltidMin: normSpeltidMin(i.durationMin) }) };
  },
  sessionTitle: (s) => s.name,
  computeStandings: () => ({ classes: [], totalCorrect: 0, leaderIds: [], winnerId: null, draw: false }),
  buildResult: () => ({}),
  projectorViews: async () => ({ views: [] }),
  studentView: async () => ({}),
  historyRenderer: async () => ({}),
});

const bas = { name: "Kurragömma 4B", gameMode: "multiplication_0_10", classIds: ["4b"], classNames: { "4b": "4B" } };

describe("matchklockan: formatet sätter durationSeconds = gömtid + speltid", () => {
  it("buildSessionDoc: 30 s + 8 min = 510 s; 60 s + 3 min = 240 s", () => {
    const d = buildSessionDoc({ ...bas, format: KG_LIKT.id, durationMin: 8, kgInstallningar: { gomtid: 30 } }, { uid: "larare1" });
    assert.equal(d.durationSeconds, 30 + 8 * 60);
    assert.equal(d.kgInstallningar.gomtid, 30);
    const e = buildSessionDoc({ ...bas, format: KG_LIKT.id, durationMin: 3, kgInstallningar: { gomtid: 60 } }, { uid: "larare1" });
    assert.equal(e.durationSeconds, 60 + 3 * 60);
  });

  it("kärnans tider räknar hela klockan: slutet = KÖR! + gömtid + speltid", () => {
    const d = buildSessionDoc({ ...bas, format: KG_LIKT.id, durationMin: 8, kgInstallningar: { gomtid: 30 } }, { uid: "larare1" });
    const startedAt = 1_000_000;
    const s = { ...d, status: "live", startedAt };
    const { t0Ms, endMs } = sessionTimes(s);
    assert.equal(t0Ms, startedAt + 4000);
    assert.equal(endMs, t0Ms + 510_000);
    assert.equal(phaseAt(s, t0Ms + 20_000).phase, "live", "gömfasen ligger inom matchen");
    assert.equal(phaseAt(s, t0Ms + 20_000).msLeft, 490_000);
    assert.equal(phaseAt(s, t0Ms + 510_000).phase, "ended");
  });
});

describe("matchklockan: andra format är oförändrade", () => {
  for (const [id, input, extra] of [
    ["klassmatch", { classIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, divisors: { "4b": 1, "4d": 1 } }, {}],
    ["guldrush", {}, {}],
    ["meteorstorm", { classIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, lage: "klass-mot-klass", attacker: "milda" }, {}],
  ]) {
    it(`${id}: durationSeconds = durationMin × 60`, () => {
      requireFormat(id);
      const d = buildSessionDoc({ ...bas, ...input, format: id, durationMin: 10, ...extra }, { uid: "larare1" });
      assert.equal(d.durationSeconds, 600);
      assert.ok(!("kgInstallningar" in d));
    });
  }
});
