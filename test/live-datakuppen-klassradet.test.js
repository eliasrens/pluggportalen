// ============================================================================
// Datakuppen – KLASSRÅDETS ÄNDRINGAR som ren logik (#832, uppdraget
// datakuppen-klassradet.md §12): filtabellen (test 1, 3), filernas värden
// (test 4, 6), tom mapp borta (test 7), virusets belopp (test 12),
// kodläckans gräns (test 24), texterna (§8), lärarens räknare (§10.2) och
// balansskriptet (test 40). Servern: functions-datakuppen-klassradet.test.mjs
// och functions-datakuppen-kodlacka.test.mjs. Synken (test 2):
// live-datakuppen.test.js "delat med servern".
// ============================================================================

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DK_FILES, DK_BALANS, DK_EVENT_TEXTS } from "../src/live/formats/datakuppen/delat/files-config.js";
import { fileTable, rollFile, applyFile, virusAllowed, leakLimit, hackFallbackId } from "../src/live/formats/datakuppen/delat/dk-filregler.js";
import { eventText, victimMessage } from "../src/live/formats/datakuppen/delat/datakuppen-regler.js";
import { buildResult } from "../src/live/formats/datakuppen/datakuppen-core.js";
import { mat, REGLER, spelaMatch } from "../admin/datakuppen-balans.mjs";

/** Mulberry32 – samma frö ger samma följd. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const p = (rows, id) => rows.find((r) => r.chest.id === id)?.weight ?? 0;
const COMBOS = [true, false].flatMap((hacking) => [0, 2, 3, 7].map((felIRad) => ({ hacking, felIRad })));

describe("filtabellen (test 1, 3)", () => {
  it("test 1: summan är 1 för alla lärarinställningar och felIRad under/över 3", () => {
    for (const { hacking, felIRad } of COMBOS) {
      const rows = fileTable({ hacking, virus: virusAllowed(felIRad) });
      const sum = rows.reduce((n, r) => n + r.weight, 0);
      assert.ok(Math.abs(sum - 1) < 1e-12, `${hacking}/${felIRad}: ${sum}`);
      assert.ok(rows.every((r) => r.weight >= 0));
      assert.equal(p(rows, "superserver"), 0.01, "Superservern alltid exakt 1 %");
      assert.equal(rows.some((r) => r.chest.id === "virus"), felIRad >= 3);
      assert.equal(rows.some((r) => r.chest.id === "hack"), hacking);
    }
  });

  it("tomma mappens och virusets andelar går proportionellt till liten och vanlig mapp; 1 % från vanlig mapp", () => {
    const med = fileTable({ virus: true });
    // 22 + 13·22/42 och 20 + 13·20/42 av 97; vanlig mapp lämnar 1 procentenhet.
    assert.ok(Math.abs(p(med, "liten_fil") - (22 + (13 * 22) / 42) / 97) < 1e-12);
    assert.ok(Math.abs(p(med, "mapp") - ((20 + (13 * 20) / 42) / 97 - 0.01)) < 1e-12);
    assert.ok(Math.abs(p(med, "virus") - 8 / 97) < 1e-12, "viruset har samma sannolikhet som förut");
    const utan = fileTable({ virus: false });
    const flytt = p(utan, "liten_fil") - p(med, "liten_fil");
    const flytt2 = p(utan, "mapp") - p(med, "mapp");
    assert.ok(Math.abs(flytt + flytt2 - 8 / 97) < 1e-12);
    assert.ok(Math.abs(flytt / flytt2 - p(med, "liten_fil") / (p(med, "mapp") + 0.01)) < 1e-9, "i proportion");
  });

  it("test 3: 10 000 filer – ingen tom mapp, Superserver 1 % ± 0,3, övriga enligt tabellen", () => {
    const rng = seeded(832);
    const n = 10_000;
    const count = {};
    for (let i = 0; i < n; i++) {
      const f = rollFile({ hacking: true, virus: false }, rng);
      count[f.id] = (count[f.id] || 0) + 1;
    }
    assert.equal(count.tom_mapp, undefined);
    assert.equal(count.virus, undefined, "utan felsvit inget virus (test 8)");
    assert.ok(Math.abs(count.superserver / n - 0.01) <= 0.003, `Superserver ${count.superserver / n}`);
    for (const r of fileTable({ hacking: true, virus: false })) {
      assert.ok(Math.abs((count[r.chest.id] || 0) / n - r.weight) < 0.015, r.chest.id);
    }
  });
});

describe("filernas värden (test 4–6)", () => {
  const f = (id) => DK_FILES.find((x) => x.id === id);
  it("test 4: liten mapp 50 MB, vanlig mapp 25 MB som förut", () => {
    assert.equal(applyFile(f(DK_BALANS.filer.litenMapp.id), 100).delta, 50);
    assert.equal(applyFile(f(DK_BALANS.filer.vanligMapp.id), 100).delta, 25);
    assert.ok(DK_BALANS.filer.vanligMapp.mb === 25);
  });

  it("test 5: Superserver ger 1000 MB oavsett saldo; overklockas false i konfigurationen", () => {
    for (const g of [0, 300, 5000]) assert.equal(applyFile(f("superserver"), g).delta, 1000);
    assert.equal(DK_BALANS.filer.superserver.overklockas, false);
  });

  it("test 6: Överklockningen ett steg högre – ×3, högst +300", () => {
    assert.equal(DK_BALANS.overklockning.multiplikator, 3);
    for (const [g, d] of [[0, 0], [50, 100], [150, 300], [1000, 300]]) assert.equal(applyFile(f("overklockning"), g).delta, d, String(g));
  });

  it("hackets ersättning när ingen går att hacka = liten mapp", () => {
    assert.equal(hackFallbackId(), "liten_fil");
    assert.equal(f("hack").fallback, "liten_fil");
  });
});

describe("tom mapp finns inte kvar (test 7)", () => {
  it("inga ikoner, texter, ljud eller demosteg för tom mapp", () => {
    const dirs = ["src/live/formats/datakuppen", "src/live/formats/datakuppen/delat", "functions/datakuppen", "preview"];
    for (const dir of dirs) {
      for (const name of readdirSync(new URL(`../${dir}/`, import.meta.url))) {
        if (!/\.(js|css|html)$/.test(name) || (dir === "preview" && !name.includes("datakuppen"))) continue;
        const src = readFileSync(new URL(`../${dir}/${name}`, import.meta.url), "utf8");
        assert.doesNotMatch(src, /tom_mapp|tom-mapp|label: "Tom mapp"|Tom mapp …|"puff"/, `${dir}/${name}`);
      }
    }
    assert.ok(!DK_FILES.some((x) => x.effect.kind === "empty"));
  });
});

describe("viruset (test 12–14)", () => {
  const virus = DK_FILES.find((x) => x.id === "virus");
  it("test 12: 1 000 virus – heltal 10–20, både 10 och 20 förekommer", () => {
    const rng = seeded(12);
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      const e = applyFile(virus, 500, rng);
      assert.ok(Number.isInteger(e.virusMb) && e.virusMb >= 10 && e.virusMb <= 20, String(e.virusMb));
      assert.equal(e.delta, -e.virusMb);
      seen.add(e.virusMb);
    }
    assert.ok(seen.has(10) && seen.has(20));
  });

  it("test 13–14: 8 MB → 0 (texten visar 8), 0 MB → ingen förlust; felsvitens gräns 3", () => {
    assert.deepEqual([applyFile(virus, 8, () => 0.9).gold, applyFile(virus, 8, () => 0.9).delta], [0, -8]);
    assert.equal(applyFile(virus, 0, () => 0.5).delta, 0);
    assert.deepEqual([virusAllowed(2), virusAllowed(3), virusAllowed(9)], [false, true, true]);
  });
});

describe("kodläckans gräns (test 24) och texterna (§8)", () => {
  it("5 från 12 elever, 3 under 12", () => {
    assert.deepEqual([leakLimit(25), leakLimit(12), leakLimit(11), leakLimit(10)], [5, 5, 3, 3]);
  });

  it("uppdragets exakta texter", () => {
    assert.equal(DK_EVENT_TEXTS.superserver, "🚀 Superserver! +{belopp} MB");
    assert.equal(DK_EVENT_TEXTS.kodlacka, "🔓 Din kod har läckt! Välj en ny.");
    assert.equal(DK_EVENT_TEXTS.ingetMal, "Ingen gick att hacka just nu, du fick {belopp} MB i stället.");
    assert.equal(victimMessage("brandvagg-under-hack", { name: "Omar Ali" }), "🛡️ Omar fick en brandvägg! Välj någon annan.");
    assert.equal(victimMessage("bytte-kod", { name: "Omar" }), "Omar bytte kod precis! Välj igen.");
    const ev = { type: "chest", chest: "superserver", name: "Alma", amount: 1000 };
    assert.equal(eventText(ev).replace(/\s/g, " "), "🚀 Alma hittade en Superserver: +1 000 MB!");
    assert.equal(eventText(ev, { names: false }).replace(/\s/g, " "), "🚀 Någon hittade en Superserver: +1 000 MB!");
    assert.equal(eventText({ type: "chest", chest: "virus", name: "Alma", amount: -12 }), "", "viruset aldrig på projektorn");
  });
});

describe("lärarens räknare (§10.2) och balansskriptet (test 40)", () => {
  it("buildResult får klassens räknare – aldrig per elev", () => {
    const s = { id: "s", format: "datakuppen", participatingClassIds: ["4b"], gameMode: "multiplication_0_10" };
    const r = buildResult(s, [], [], null, { dkPlayers: [], stats: { superservrar: 2, virus: 5, avbrutnaHack: 1, kodlackor: 3 } });
    assert.deepEqual(r.klassrad, { superservrar: 2, virus: 5, avbrutnaHack: 1, kodlackor: 3 });
    assert.deepEqual(buildResult(s, [], [], null, {}).klassrad, { superservrar: 0, virus: 0, avbrutnaHack: 0, kodlackor: 0 });
  });

  it("test 40: skriptet kör båda regeluppsättningarna utan fel", () => {
    for (const regel of [REGLER.fore, REGLER.efter]) {
      const res = mat(regel, 3);
      assert.ok(res.mbPerRatt > 0 && Number.isFinite(res.superVinnare));
      assert.equal(res.virus.length, 3);
    }
    const { stats } = spelaMatch(REGLER.efter, 1, { elever: 5, minuter: 2 });
    assert.ok(stats.ratt > 0);
    assert.match(readFileSync(new URL("../package.json", import.meta.url), "utf8"), /"balans:datakuppen": "node admin\/datakuppen-balans\.mjs"/);
  });
});
