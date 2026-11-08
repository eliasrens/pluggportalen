// Meteorstormen ☄️ E (#824): musiken (format.music), det kopplade demoläget
// (ms-demolage.js: projektorn ritar elevdemots match) och delningen av motorn
// (ms-motor.js → ms-steg.js + ms-utdata.js). Ingen emulator.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { requireFormat } from "../src/live/formats/index.js";
import { musicTarget } from "../src/live/proj-music.js";
import { createMsElevDemo } from "../src/live/formats/meteorstorm/ms-elev-demo.js";
import { projektorDeps, eventsUr, sessionUr } from "../src/live/formats/meteorstorm/ms-demolage.js";
import { handlingarUr, motorIndata } from "../src/live/formats/meteorstorm/msp-scen.js";
import { simulera } from "../src/live/formats/meteorstorm/delat/ms-motor.js";

const MS = requireFormat("meteorstorm");
const rad = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Meteorstormen E: musiken", () => {
  const fil = () => fileURLToPath(MS.music.src);
  it("format.music pekar på loopen i formatets assets/, som Guldrushen (level 0,3, tyst lobby)", () => {
    assert.match(MS.music.src, /\/meteorstorm\/assets\/meteorstormen-loop\.ogg$/);
    assert.ok(existsSync(fil()));
    assert.equal(MS.music.level, 0.3);
    assert.equal(MS.music.lobby, 0);
    const on = { on: true, level: MS.music.level, lobby: MS.music.lobby };
    assert.equal(musicTarget({ ...on, phase: "lobby" }).gain, 0);
    assert.equal(musicTarget({ ...on, phase: "countdown", msLeft: 600_000 }).gain, 0);
    assert.equal(musicTarget({ ...on, phase: "live", msLeft: 90_000 }).gain, 0.3);
    assert.equal(musicTarget({ ...on, phase: "ended", msLeft: 0 }).gain, 0, "tonas ut vid 00:00");
    assert.equal(musicTarget({ ...on, on: false, phase: "live", msLeft: 90_000 }).gain, 0, "lärarens 🎵 av");
  });
  it("filen: Ogg Vorbis 44,1 kHz stereo, exakt 80,0 s (3 528 000 sampel – skarven går jämnt upp)", () => {
    const b = readFileSync(fil());
    assert.equal(b.subarray(0, 4).toString("latin1"), "OggS");
    assert.equal(b.subarray(29, 35).toString("latin1"), "vorbis");
    assert.equal(b[39], 2);
    assert.equal(b.readUInt32LE(40), 44100);
    const sista = b.lastIndexOf(Buffer.from("OggS"));
    assert.equal(Number(b.readBigInt64LE(sista + 6)), 80 * 44100);
  });
  it("laddas latt: ingen src-fil importerar ljudfilen, bara en URL i formatobjektet", () => {
    const idx = rad("src/live/formats/meteorstorm/index.js");
    assert.match(idx, /new URL\("\.\/assets\/meteorstormen-loop\.ogg", import\.meta\.url\)\.href/);
    assert.doesNotMatch(idx, /import\s[^;]*\.ogg/);
  });
});

describe("Meteorstormen E: motorn delad (ingen beteendeändring)", () => {
  it("ms-motor.js under 400 rader; stegen i ms-steg.js, utdata i ms-utdata.js, synkade till functions/", () => {
    for (const f of ["ms-motor.js", "ms-steg.js", "ms-utdata.js"]) {
      const src = rad(`src/live/formats/meteorstorm/delat/${f}`);
      assert.ok(src.split("\n").length <= 400, f);
      assert.equal(rad(`functions/meteorstorm/${f}`), src, `functions/meteorstorm/${f}`);
    }
    assert.match(rad("src/live/formats/meteorstorm/delat/ms-motor.js"), /from "\.\/ms-steg\.js"/);
  });
});

describe("Meteorstormen E: kopplat demoläge (projektorn + elevskärmen i samma match)", () => {
  const nyDemo = () => {
    let t = 1_800_000_000_000;
    const E = createMsElevDemo({ seed: 99, latens: () => 0, klocka: () => t });
    return { E, steg: (ms) => { t += ms; E.tick(); } };
  };
  it("projektorns händelser = låtsasserverns logg (msEvents-form, namn, nr), sessionen live med stationerna", () => {
    const { E, steg } = nyDemo();
    steg(90_000);
    const ev = eventsUr(E);
    assert.ok(ev.length > 10);
    assert.deepEqual(handlingarUr(ev), E.handlingar().map((h) => ({ id: h.id, t: h.t, classId: h.classId, uid: h.uid, typ: h.typ })));
    assert.ok(ev.every((e) => e.namn && e.nr >= 1 && e.id === `${e.uid}_${e.nr}`));
    const s = sessionUr(E);
    assert.equal(s.status, "live");
    assert.deepEqual(s.msStationer.map((x) => x.classId), ["4b", "4d"]);
    // Projektorn räknar samma storm som låtsasservern.
    const cfg = motorIndata(s);
    const proj = simulera({ ...cfg, handlingar: handlingarUr(ev) }, E.now());
    const elev = simulera({ ...cfg, handlingar: E.handlingar() }, E.now());
    assert.deepEqual(proj.stationer, elev.stationer);
  });
  it("elevens eget tryck syns som projektorhändelse; 00:00 → finished och ETT resultat för båda skärmarna", async () => {
    const { E, steg } = nyDemo();
    steg(5000);
    const { deps, stop } = projektorDeps(E);
    const sett = [];
    const av = deps.meteorstorm.watchEvents(E.session.id, (ev) => sett.push(ev));
    // "Jag" svarar rätt och väljer laser – precis som elevvyn gör.
    const k = E.api.skapaKlient({ sid: E.session.id, uid: "jag", seed: E.session.msSeed, gameMode: E.session.gameMode });
    await k.lage();
    const q = k.kalla().next();
    assert.equal((await k.svara({ attemptId: "a1", factorA: q.a, factorB: q.b, answer: String(q.answer) })).correct, true);
    await k.agera("laser");
    const mitt = eventsUr(E).find((e) => e.uid === "jag");
    assert.deepEqual([mitt.typ, mitt.namn, mitt.classId, mitt.id], ["laser", "Jag", "4b", "jag_1"]);
    await new Promise((r) => setTimeout(r, 400)); // projektorns lyssnare (watchEvents) får den
    assert.ok(sett.at(-1).some((e) => e.id === "jag_1"));
    const st = [];
    deps.subscribe(E.session.id, (x) => st.push(x));
    assert.equal(st.at(-1).status, "live");
    assert.equal(st.at(-1).players.length, 48);
    E.snartSlut(0);
    steg(1000);
    const { result, redan } = await deps.meteorstorm.avsluta();
    assert.equal(redan, false);
    assert.equal(result, E.result(), "samma resultat som elevens slutskärm");
    assert.equal(st.at(-1).status, "finished");
    assert.equal(st.at(-1).result, result);
    assert.equal((await deps.finish()).redan, true, "idempotent");
    av();
    stop();
  });
});
