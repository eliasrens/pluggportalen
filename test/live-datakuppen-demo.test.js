// ============================================================================
// #655 – Datakuppens DEMOLÄGE (spec §5): projektordemon (dk-demo.js på
// kistspelsdemon) + den kopplade elevskärmen (preview/datakuppen-elev-sim.js
// med shared:true) – samma spelardokument. Sidan:
// preview/preview-datakuppen-demolage.html (guidad genomgång av allt i §5).
// Isoleringen: demo:true (live-rewards betalar aldrig), inga Firebase-/data-
// lagerimporter.
// ============================================================================

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDkDemo, DEMO_FILES } from "../src/live/formats/datakuppen/dk-demo.js";
import { DK_FILES } from "../src/live/formats/datakuppen/delat/files-config.js";
import { codeList } from "../src/live/formats/datakuppen/delat/datakuppen-regler.js";
import { createSim } from "../preview/datakuppen-elev-sim.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const CODES = codeList(JSON.parse(read("../src/live/formats/datakuppen/delat/koder.json")));
const demos = [];
const mk = (o = {}) => { const d = createDkDemo({ rng: mulberry(5), ...o }); demos.push(d); return d; };
after(() => demos.forEach((d) => d.destroy()));

describe("#655 projektordemon", () => {
  it("30 elever med 30 olika avatarer", async () => {
    const d = mk();
    d.join(30, 0);
    assert.equal(d.state().players.length, 30);
    const proj = await d.deps.loadProjection("4b");
    assert.equal(new Set(Object.values(proj.members).map((m) => m.avatarId)).size, 30);
  });
  it("varje filtyp går att trigga och ger sin händelse", () => {
    const d = mk();
    d.playHistory(120);
    assert.deepEqual(DEMO_FILES.map((f) => f.id), DK_FILES.map((f) => f.id));
    for (const f of DK_FILES) {
      d.chest(f.id);
      const e = d.state().events.find((x) => x.type !== "lead");
      if (f.id === "hack") assert.deepEqual([e.type, e.chest], ["steal", "hack"]);
      else assert.equal(e.chest === f.id || e.fallbackFrom === f.id, true, f.id);
    }
  });
  it("misslyckat hack: ingen händelse, bara statistiken; resultatet räknar hacken", async () => {
    const d = mk();
    d.playHistory(120);
    const n = d.state().events.length;
    const before = d.hackStats();
    d.hackFail("e3");
    assert.equal(d.state().events.length, n);
    assert.deepEqual(d.hackStats(), { attempts: before.attempts + 1, success: before.success });
    d.hack();
    d.jumpToFinal();
    await waitFor(() => d.session.result);
    assert.deepEqual(d.session.result.hacks, d.hackStats(), "pallen/historiken får hackstatistiken");
    assert.equal(d.session.demo, true);
  });
  it("skip: eleven som styrs från elevskärmen svarar aldrig automatiskt och slumpas aldrig som offer", () => {
    const d = mk();
    d.join(30, 0);
    d.skip.add("e1");
    d.playHistory(10);
    const g = d.state().grPlayers.find((x) => x.uid === "e1");
    g.gold = 9999;
    const before = g.correct + g.incorrect;
    for (let i = 0; i < 20; i++) d.chest("hack");
    assert.ok(!d.state().events.some((e) => e.type !== "lead" && (e.victimUid === "e1" || e.uid === "e1")));
    assert.equal(g.correct + g.incorrect, before);
  });
});

describe("#655 elevskärmen kopplad till projektorn (minnesmomentet, koden kvar)", () => {
  it("delar spelardokument, skriver händelser via onAction och visar en struken kod andra gången", async () => {
    const d = mk();
    d.join(30, 0);
    d.playHistory(150);
    d.state().grPlayers.forEach((g) => { g.protectedUntil = null; g.gold = Math.max(g.gold, 200); });
    const gp = (uid) => d.state().grPlayers.find((g) => g.uid === uid);
    const senaste = () => d.state().events.find((e) => e.type !== "lead");
    const me = gp("e1");
    let forced = null;
    const sim = createSim({
      codes: CODES, me, players: d.state().grPlayers.filter((g) => g.uid !== "e1"), latency: () => 0, shared: true,
      forced: () => forced,
      onAction(kind, x) {
        if (kind === "fil") d.logFile("e1", x.file, x.delta, x.gold);
        if (kind === "hack") d.logHack("e1", x.targetUid, x.amount);
        if (kind === "fel") d.logHackFail("e1");
        if (kind === "hackad") d.logHack(x.byUid, "e1", x.amount);
      },
    });
    assert.equal(sim.state.me, me, "samma objekt som projektorn visar");

    forced = "brandvagg";
    await sim.api.openFile();
    assert.ok(me.protectedUntil > Date.now());
    assert.equal(senaste().chest, "brandvagg");

    const hack = async (target, right) => {
      forced = "hack";
      await sim.api.openFile();
      const t = await sim.api.chooseTarget({ targetUid: target });
      const i = right ? t.options.indexOf(sim.secret[target]) : t.options.findIndex((c) => c !== sim.secret[target]);
      return { t, r: await sim.api.guessCode({ index: i }) };
    };
    const n = d.state().events.filter((e) => e.type !== "lead").length;
    const first = await hack("e5", false);
    assert.equal(first.t.options.length, 3);
    assert.equal(first.r.result, "wrong");
    assert.equal(d.state().events.filter((e) => e.type !== "lead").length, n, "fel kod = ingen händelse");
    const e7kod = sim.secret.e7;
    await hack("e7", true); // inte samma mål direkt efter
    assert.equal(sim.secret.e7, e7kod, "#719: målets kod ligger kvar efter ett lyckat hack");
    assert.deepEqual([senaste().type, senaste().victimUid], ["steal", "e7"]);
    assert.ok(gp("e7").protectedUntil > Date.now(), "målet skyddas");
    const again = await hack("e5", true);
    assert.equal(again.t.options.length, 2, "minnet: den strukna koden är borta");
    assert.ok(!again.t.options.includes(first.r.code));
    assert.equal(again.r.result, "hacked");

    // #719: koden behålls hela matchen – bli hackad = skydd, ingen ny kod.
    const kod = (await sim.api.pickCode({})).code;
    sim.hackMe("e9");
    assert.ok(!sim.state.self.offers?.length, "inga nya kodförslag efter hack");
    assert.ok(me.protectedUntil > Date.now(), "skyddad efter hacket");
    await assert.rejects(sim.api.pickCode({ index: 0 }), /hela matchen|kodförslag/);
    assert.equal(sim.state.self.code, kod, "samma kod");
    assert.equal(senaste().victimUid, "e1");
    assert.deepEqual(d.hackStats().attempts - d.hackStats().success >= 1, true);
  });
});

describe("#655 isolering", () => {
  it("inga Firebase-/datalagerimporter i demot, sidan blockerar och räknar Firebase-anrop", () => {
    for (const f of ["../src/live/formats/datakuppen/dk-demo.js", "../preview/datakuppen-elev-sim.js", "../src/live/kistspel/ks-demo.js"]) {
      const imports = (read(f).match(/^(?:import|export) .* from .*$/gm) || []).join("\n");
      assert.doesNotMatch(imports, /datakuppen-data|firebase|live-data|live-rewards-data|teacher-shared/, f);
    }
    const lage = read("../preview/preview-datakuppen-demolage.html");
    for (const steg of ["lobby", "kod", "filer", "fel", "ratt", "minne", "byt", "skydd", "milstolpe", "snart", "pall", "historik"]) {
      assert.match(lage, new RegExp(`id: "${steg}"`), steg);
    }
    assert.match(lage, /__dkDemoBlocked/);
    assert.match(read("../preview/preview-datakuppen-demo.html"), /cloudfunctions\\\.net/);
    assert.match(read("../preview/preview-datakuppen-historik.html"), /pluggmynt-stubs\/teacher-shared\.js/);
  });
});

async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 50));
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
