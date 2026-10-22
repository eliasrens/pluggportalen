// Enhetstester: Meteorstormens PROJEKTOR (#822) – src/live/formats/meteorstorm/msp-*.js.
// Renderingsbufferten (klockan går aldrig bakåt), samma bild på två projektorer
// (loggindexet och ritanropen beror bara på loggen och t – aldrig på när
// projektorn startade, aldrig Math.random/Date.now), flödet (bara positivt,
// högst 4 rader), "fel"-länkar hoppas över, slutrutan (serverns result, ingen
// elevlista), formatobjektets projektordel och demot.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { requireFormat, formatOf } from "../src/live/formats/index.js";
import { validateFormat } from "../src/live/live-formats.js";
import { skapaMotor } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { RENDER_FORDROJNING_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import {
  motorIndata, slutVid, handlingarUr, namnUr, stegaKlocka, skapaLoggminne, flodeVid, flodeText, banderollVid,
  humor, gungVid, klassGenitiv, brus, platser, meteorPunkt, FORDROJNING_MS, FLODE_MAX,
} from "../src/live/formats/meteorstorm/msp-scen.js";
import { slutModell, slutHtml } from "../src/live/formats/meteorstorm/msp-slut.js";

const MS = requireFormat("meteorstorm");
const DIR = new URL("../src/live/formats/meteorstorm/", import.meta.url);
const T0 = 1_800_000_000_000;

function session(over = {}) {
  return {
    id: "s1", format: "meteorstorm", msSeed: 4711, participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" },
    startedAt: T0 - 4000, countdownSeconds: 4, durationSeconds: 600, status: "live",
    msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, msStationer: [{ classId: "4b", aktiva: 12 }, { classId: "4d", aktiva: 10 }],
    showNames: true, ...over,
  };
}

/** Påhittade msEvents: en handling per elev och ~7 s, plus en "fel"-länk. */
function events(n = 400) {
  const ut = [];
  for (let k = 0; k < n; k++) {
    const c = k % 2 ? "4d" : "4b";
    const uid = `${c}-e${k % 11}`;
    ut.push({ id: `${uid}_${k}`, uid, classId: c, namn: `Elev ${k % 11}`, t: T0 + 2000 + k * 700, typ: k % 23 === 5 ? "drag" : k % 3 ? "laser" : "skold", nr: k });
  }
  ut.push({ id: "4b-e1_x", uid: "4b-e1", classId: "4b", namn: "Elev 1", t: T0 + 9000, typ: "fel", nr: 999 });
  return ut;
}

describe("Meteorstormen projektorn: formatobjektet (C:s del)", () => {
  it("registrerat, giltigt interface, lata vyer, ingen musikfil än (E lägger in den – ingen 404)", () => {
    assert.deepEqual(validateFormat(MS), []);
    assert.equal(formatOf({ format: "meteorstorm" }), MS);
    assert.equal(typeof MS.projectorViews, "function");
    assert.equal(MS.music, undefined);
    assert.equal(MS.pacing, "tid");
  });
  it("slutet går genom D:s resultInputs (avslutaOchBetala: msAvsluta + pluggmynt); buildResult = serverns result", async () => {
    const avslut = await import("../src/live/formats/meteorstorm/ms-avslut.js");
    assert.equal(MS.resultInputs, avslut.resultInputs);
    assert.equal(MS.buildResult, avslut.buildResult);
    const r = { format: "meteorstorm", winner: "4b" };
    assert.equal(MS.buildResult(session(), [], [], null, { result: r }), r);
    assert.equal(MS.buildResult(session(), [], [], null, undefined).rewards, undefined, "utan servern: inga mynt");
  });
  it("computeStandings: klasserna och anslutna elever, ingen poäng", () => {
    const st = MS.computeStandings(session(), { players: [{ uid: "a", classId: "4b" }, { uid: "b", classId: "4b" }, { uid: "c", classId: "4d" }] });
    assert.deepEqual(st.classes.map((c) => [c.classId, c.joined]), [["4b", 2], ["4d", 1]]);
    assert.equal(st.winnerId, null);
  });
});

describe("Meteorstormen projektorn: indata och logg", () => {
  it("motorns indata ur sessionen; msStationer saknas → aktiva 1", () => {
    const c = motorIndata(session());
    assert.equal(c.startMs, T0);
    assert.deepEqual(c.stationer, [{ classId: "4b", aktiva: 12 }, { classId: "4d", aktiva: 10 }]);
    assert.deepEqual(motorIndata(session({ msStationer: undefined })).stationer.map((s) => s.aktiva), [1, 1]);
  });
  it("slutet: lärarens avslut före tiden, annars ordinarie slut", () => {
    assert.equal(slutVid(session()), T0 + 600_000);
    assert.equal(slutVid(session({ finishedAt: { seconds: (T0 + 120_000) / 1000, nanoseconds: 0 } })), T0 + 120_000);
    assert.equal(slutVid(session({ startedAt: undefined })), null);
  });
  it("typ \"fel\" (felbufferten) blir aldrig en handling; namnen följer med", () => {
    const h = handlingarUr(events(10));
    assert.equal(h.length, 10);
    assert.ok(h.every((x) => x.typ !== "fel" && !("namn" in x)));
    assert.equal(namnUr(events(10)).get("4b-e0"), "Elev 0");
  });
  it("renderingsfördröjningen kommer ur ms-balans.js", () => {
    assert.equal(FORDROJNING_MS, RENDER_FORDROJNING_MS);
  });
});

describe("Meteorstormen projektorn: renderingsklockan går aldrig bakåt", () => {
  it("följer målet, hoppar fram vid stor eftersläpning, aldrig bakåt", () => {
    let t = stegaKlocka(null, 1000, 16);
    assert.equal(t, 1000);
    let mal = 1000;
    const rng = (() => { let a = 7; return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    for (let i = 0; i < 2000; i++) {
      const dt = 10 + rng() * 30;
      mal += dt + (rng() - 0.5) * 120; // klockan skakar ±60 ms (ny klocksynk, nät)
      const ny = stegaKlocka(t, mal, dt);
      assert.ok(ny >= t, `steg ${i}: ${ny} < ${t}`);
      t = ny;
    }
    assert.ok(Math.abs(t - mal) < 400, `ikapp målet (${t - mal} ms)`);
    assert.equal(stegaKlocka(5000, 9000, 16), 9000, "stor eftersläpning → hopp framåt");
    assert.ok(stegaKlocka(5000, 4000, 16) >= 5000, "målet bakom → står still/saktar, aldrig bakåt");
  });
});

describe("Meteorstormen projektorn: anpassad renderingsbuffert (#822 F1)", () => {
  it("börjar på RENDER_FORDROJNING_MS (3 s), växer till ≈ p95 + marginal, aldrig över taket, krymper aldrig", async () => {
    const { skapaBuffert, BUFFERT_MAX_MS, BUFFERT_MARGINAL_MS } = await import("../src/live/formats/meteorstorm/msp-buffert.js");
    assert.equal(RENDER_FORDROJNING_MS, 3000);
    const b = skapaBuffert();
    assert.equal(b.varde(), 3000);
    for (let i = 0; i < 50; i++) b.matt(800 + (i % 10) * 50); // snabbt nät: ryms i basen
    assert.equal(b.varde(), 3000);
    for (let i = 0; i < 100; i++) b.matt(4000 + (i % 20) * 100); // long-poll 4–6 s
    const vuxen = b.varde();
    assert.ok(vuxen >= 5800 + BUFFERT_MARGINAL_MS - 1 && vuxen <= BUFFERT_MAX_MS, `buffert ${vuxen}`);
    for (let i = 0; i < 400; i++) b.matt(200); // nätet blir bra igen – bufferten står kvar
    assert.equal(b.varde(), vuxen);
    b.matt(60_000);
    for (let i = 0; i < 20; i++) b.matt(30_000);
    assert.equal(b.varde(), BUFFERT_MAX_MS);
    assert.deepEqual(Object.keys(b.stat()), ["buffertMs", "n", "median", "p95", "max"]);
  });
  it("när bufferten växer saktar klockan in (fart ≥ 0,8) – t går aldrig bakåt, inga ryck", async () => {
    const { skapaBuffert } = await import("../src/live/formats/meteorstorm/msp-buffert.js");
    const b = skapaBuffert();
    let nu = 1_000_000;
    let t = null;
    let minFart = Infinity;
    for (let i = 0; i < 6000; i++) {
      const dt = 16 + (i % 3);
      nu += dt;
      if (i % 40 === 0) b.matt(i < 2000 ? 2500 : 4000 + (i % 7) * 500); // leveranserna blir sämre efter en stund
      const ny = stegaKlocka(t, nu - b.varde(), dt);
      if (t != null) {
        assert.ok(ny >= t, `steg ${i}: t bakåt`);
        minFart = Math.min(minFart, (ny - t) / dt);
        assert.ok(ny - t <= dt * 1.0801, `steg ${i}: för snabbt`);
      }
      t = ny;
    }
    assert.ok(minFart >= 0.8 - 1e-9, `fart ${minFart}`);
    assert.ok(minFart < 0.95, "bufferten växte och klockan saktade in");
    assert.ok(Math.abs(nu - b.varde() - t) < 300, "ikapp den nya bufferten");
  });
});

describe("Meteorstormen projektorn: samma bild oavsett när projektorn startade", () => {
  const s = session();
  const handlingar = handlingarUr(events());
  const ny = () => { const m = skapaMotor(motorIndata(s)); m.satHandlingar(handlingar); return m; };
  const opts = () => ({ namn: namnUr(events()), klass: (id) => s.classNames[id], visaNamn: true });

  it("loggindexet: läst steg för steg (live) = läst en gång (sen projektor)", () => {
    const a = ny();
    const live = skapaLoggminne(opts());
    for (let t = T0; t <= T0 + 600_000; t += 1700) live.las(a.tillstand(t).logg);
    const sen = skapaLoggminne(opts()).las(ny().tillstand(T0 + 600_000).logg);
    assert.deepEqual(live.minne.poster, sen.poster);
    assert.ok(sen.poster.length > 10);
  });
  it("en sen händelse spolar tillbaka motorn → indexet byggs om, samma som utan omväg", () => {
    const m = ny();
    const mi = skapaLoggminne(opts());
    mi.las(m.tillstand(T0 + 300_000).logg);
    const sen = { id: "4b-sen_1", t: T0 + 200_000, classId: "4b", uid: "4b-e3", typ: "laser" };
    m.satHandlingar([...handlingar, sen]);
    mi.las(m.tillstand(T0 + 300_000).logg);
    const facit = skapaMotor(motorIndata(s));
    facit.satHandlingar([...handlingar, sen]);
    assert.deepEqual(mi.minne.poster, skapaLoggminne(opts()).las(facit.tillstand(T0 + 300_000).logg).poster);
  });
  it("flödet: bara det som är bra, högst 4 rader, aldrig fel svar eller skada", () => {
    const m = skapaLoggminne(opts()).las(ny().tillstand(T0 + 600_000).logg);
    const texter = m.poster.map((p) => p.text).join("\n");
    assert.doesNotMatch(texter, /fel|träff|förlor|skada|missade/i);
    for (const p of m.poster) assert.match(p.ikon, /🔫|🌀|🛡️|🚀|☄️/);
    for (let t = T0; t < T0 + 600_000; t += 997) assert.ok(flodeVid(m.poster, t).length <= FLODE_MAX);
    for (const typ of ["traff", "noll", "flyter", "handelse", "hjalp-slut"]) assert.equal(flodeText({ typ, classId: "4b" }, opts()), null);
  });
  it("flödestexter som i specen", () => {
    const o = opts();
    assert.equal(flodeText({ typ: "kast", classId: "4b", mot: "4d" }, o).text, "4B slungade en meteor mot 4D!");
    assert.equal(flodeText({ typ: "skold", classId: "4d" }, o).text, "4D:s sköld höll!");
    assert.equal(flodeText({ typ: "hjalp", classId: "4d" }, o).text, "4D får extra kraft!");
    assert.equal(flodeText({ typ: "nedskjuten", classId: "4b", uid: "4b-e2", storlek: "stor" }, o).text, "Elev 2 sköt ner en stor meteor!");
    assert.equal(flodeText({ typ: "nedskjuten", classId: "4b", uid: "4b-e2", storlek: "stor" }, { ...o, visaNamn: false }).text, "4B sköt ner en stor meteor!");
    assert.equal(klassGenitiv("Rymdlöss"), "Rymdlöss");
    assert.equal(klassGenitiv("Bläckfiskarna"), "Bläckfiskarnas");
  });
  it("banderollen, besättningen och gunget ur loggen", () => {
    assert.deepEqual(banderollVid({ typ: "solstorm", startMs: 0, slutMs: 20_000 }, 4_500), { typ: "solstorm", text: "☀️ SOLSTORM! Dubbel energi i 20 sekunder!", kvar: 16 });
    assert.match(banderollVid({ typ: "jattemeteor", slutMs: 9000 }, 0).text, /JÄTTEMETEOR – skjut ner den!/);
    assert.equal(banderollVid(null, 0), null);
    const m = skapaLoggminne().las([{ t: 1000, typ: "nedskjuten", classId: "4b" }, { t: 5000, typ: "traff", classId: "4d", skrov: 10 }]);
    assert.equal(humor(m, "4b", 1500, false), "jubel");
    assert.equal(humor(m, "4d", 5300, false), "ducka");
    assert.equal(humor(m, "4d", 9000, false), "lugn");
    assert.equal(humor(m, "4d", 9000, true), "drakt");
    assert.notDeepEqual(gungVid(m, "4d", 5100), { x: 0, y: 0 });
    assert.deepEqual(gungVid(m, "4d", 7000), { x: 0, y: 0 });
  });
  it("kosmetisk slump ur fröet: jämnt utspridd, samma varje gång", () => {
    const xs = Array.from({ length: 400 }, (_, i) => brus("stjarna", `x${i}`));
    assert.deepEqual(xs, Array.from({ length: 400 }, (_, i) => brus("stjarna", `x${i}`)));
    const fack = new Array(10).fill(0);
    for (const x of xs) fack[Math.floor(x * 10)]++;
    assert.ok(Math.min(...fack) > 20, `ojämn: ${fack}`);
  });
  it("meteorernas banor: från kanten (pos 0) till bubblan (pos 1), spegelvända mellan stationerna", () => {
    const pl = platser(2);
    const geo = (mal) => ({ mal, kastadAv: -1, bana: 0.3, spawnMs: 0, ankomstMs: 8000 });
    const a0 = meteorPunkt(geo(0), 0, pl);
    const b0 = meteorPunkt(geo(1), 0, pl);
    assert.ok(Math.abs((a0.x - pl[0].x) + (b0.x - pl[1].x)) < 1e-6, "spegelvänd i x");
    assert.ok(Math.abs(a0.y - b0.y) < 1e-6);
    const a1 = meteorPunkt(geo(0), 8000, pl);
    assert.ok(Math.abs(Math.hypot(a1.x - pl[0].x, a1.y - pl[0].y) - 158) < 1e-6);
  });
});

describe("Meteorstormen projektorn: ritningen är en ren funktion av (tillstånd, t, frö)", () => {
  // Inspelande låtsas-Canvas: varje anrop och varje tilldelning hamnar i loggen.
  function fakeCanvas(logg) {
    const grad = () => ({ addColorStop: (...a) => logg.push(["stop", ...a]) });
    const ctx = new Proxy({}, {
      get(_, k) {
        if (k === "createLinearGradient" || k === "createRadialGradient") return (...a) => { logg.push([k, ...a]); return grad(); };
        if (k === "getImageData") return () => ({ data: [] });
        return (...a) => logg.push([k, ...a.map((x) => (typeof x === "object" ? "obj" : x))]);
      },
      set(_, k, v) { logg.push(["=", k, typeof v === "object" ? "obj" : v]); return true; },
    });
    return { width: 1600, height: 900, getContext: () => ctx };
  }
  const realRandom = Math.random;
  const realNow = Date.now;
  after(() => { Math.random = realRandom; Date.now = realNow; delete globalThis.document; });

  it("två projektorer (en som följt matchen, en som öppnades nyss) ritar samma anrop vid samma t", async () => {
    globalThis.document = { createElement: () => fakeCanvas([]) };
    const { skapaBild } = await import("../src/live/formats/meteorstorm/msp-bild.js");
    const s = session();
    const h = handlingarUr(events());
    const rita = (motor, minne, t) => {
      const logg = [];
      const b = skapaBild(fakeCanvas(logg));
      b.storlek(1600, 900);
      logg.length = 0;
      const tillstand = motor.tillstand(t);
      b.rita({ s: tillstand, tMotor: t, tAnim: t, cfg: motor.cfg, plan: motor.plan, minne: minne.las(tillstand.logg),
        farger: ["#ff7a3d", "#3d9bff"], namn: (id) => s.classNames[id], seed: s.msSeed, rorelse: true, slut: null });
      return logg;
    };
    Math.random = () => { throw new Error("Math.random i ritningen"); };
    Date.now = () => { throw new Error("Date.now i ritningen"); };
    const a = skapaMotor(motorIndata(s));
    a.satHandlingar(h);
    const ma = skapaLoggminne();
    for (let t = T0; t < T0 + 240_000; t += 2300) rita(a, ma, t);
    for (const t of [T0 + 240_000, T0 + 241_234, T0 + 455_555, T0 + 599_000]) {
      const b = skapaMotor(motorIndata(s));
      b.satHandlingar([...h].reverse());
      const la = rita(a, ma, t);
      const lb = rita(b, skapaLoggminne(), t);
      assert.ok(la.length > 200);
      assert.deepEqual(la, lb, `samma ritanrop vid t = ${t - T0}`);
    }
    Math.random = realRandom;
    Date.now = realNow;
  });
});

describe("Meteorstormen projektorn: slutrutan bygger på serverns result", () => {
  const result = {
    format: "meteorstorm", lage: "klass-mot-klass", winner: "4b", draw: false,
    placering: [{ classId: "4b", skrov: 62.4, nedskjutna: 40, plats: 1 }, { classId: "4d", skrov: 21, nedskjutna: 33, plats: 2 }],
    perClass: {
      "4b": { name: "4B", ogonblick: [{ typ: "nedskjutna", namn: "Ahlaam", antal: 7 }, { typ: "sista", namn: "Omar" }, { typ: "skold", namn: "Ines", antal: 12 }, { typ: "kast", namn: "Leo", antal: 3 }] },
      "4d": { name: "4D", ogonblick: [] },
    },
    ranking: [{ uid: "x", name: "Ska inte synas", rank: 1 }],
  };
  it("Klass mot klass: vinnaren, skrov i procent, nedskjutna, tre ögonblick, snäll text, ingen elevlista", () => {
    const m = slutModell(result, session());
    assert.equal(m.rubrik, "4B vann Meteorstormen!");
    assert.deepEqual(m.klasser.map((k) => [k.namn, k.skrov, k.nedskjutna]), [["4B", 62, 40], ["4D", 21, 33]]);
    assert.equal(m.klasser[0].ogonblick.length, 3);
    assert.equal(m.klasser[0].ogonblick[0], "🔫 Flest nedskjutna: Ahlaam (7)");
    assert.equal(m.klasser[1].snall, "4D:s station klarade sig igenom stormen!");
    const html = slutHtml(m, { "4b": "#f00", "4d": "#00f" });
    assert.doesNotMatch(html, /Ska inte synas/);
    assert.match(html, /62 %/);
  });
  it("namn av → ögonblicken utan namn; oavgjort; En klass med stjärnor", () => {
    assert.doesNotMatch(slutModell(result, session({ showNames: false })).klasser[0].ogonblick.join(), /Ahlaam/);
    assert.equal(slutModell({ ...result, winner: null, draw: true }, session()).rubrik, "Oavgjort!");
    const en = slutModell({ lage: "en-klass", stjarnor: 2, overlevde: true, placering: [{ classId: "4b", skrov: 55, nedskjutna: 20, plats: 1 }], perClass: {} }, session());
    assert.equal(en.rubrik, "Stationen överlevde!");
    assert.equal(en.stjarnor, 2);
    assert.match(slutHtml(en, {}), /2 av 3 stjärnor/);
  });
});

describe("Meteorstormen projektorn: ramar", () => {
  const filer = readdirSync(DIR).filter((f) => /^(msp-|meteorstorm-projector|meteorstorm-projektor)/.test(f));
  const src = (f) => readFileSync(new URL(f, DIR), "utf8");
  it("högst 400 rader per fil", () => {
    for (const f of filer) assert.ok(src(f).split("\n").length <= 400, `${f} är för lång`);
  });
  it("ingen Math.random/Date.now i det som ritar (samma bild på två projektorer)", () => {
    for (const f of ["msp-scen.js", "msp-bild.js", "msp-rita.js", "msp-station.js", "msp-skold.js", "msp-besattning.js", "msp-slut.js", "msp-hud.js"]) {
      const kod = src(f).replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(kod, /Math\.random|Date\.now/, f);
    }
  });
  it("projektorn skriver inget: inga Firestore-skrivningar, EN lyssnare på msEvents", () => {
    for (const f of filer) assert.doesNotMatch(src(f), /setDoc|updateDoc|addDoc|writeBatch|runTransaction|firebase-firestore/, f);
    assert.equal(src("msp-rymd.js").match(/watchEvents\(/g).length, 1);
    assert.doesNotMatch(src("msp-rymd.js"), /avsluta/, "Avsluta går genom kärnans flöde (resultInputs)");
  });
  it("egna CSS-klasser (msp-)", () => {
    const css = src("meteorstorm-projektor.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const klasser = [...css.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
    assert.ok(klasser.length > 30);
    for (const k of klasser) assert.match(k, /^msp(-|$)/);
  });
});

describe("Meteorstormen projektorn: demot", () => {
  it("hel match i minnet: händelser som msEvents (med fel-länkar), resultat i msAvsluta-form", async () => {
    const { createMsDemo } = await import("../src/live/formats/meteorstorm/msp-demo.js");
    let nu = T0;
    const demo = createMsDemo({ now: () => nu });
    try {
      demo.jumpToFinal();
      await new Promise((r) => setTimeout(r, 700));
      const { session: s, events: ev } = demo.state();
      assert.equal(s.status, "finished");
      assert.ok(ev.length > 300);
      assert.ok(ev.some((e) => e.typ === "fel"), "felbufferten finns i loggen – projektorn ska hoppa över den");
      assert.ok(ev.every((e) => /^e\d+_/.test(e.id) && Number.isFinite(e.t)));
      assert.equal(s.result.format, "meteorstorm");
      assert.equal(s.result.placering.length, 2);
      assert.ok(Object.values(s.result.perClass).every((c) => Array.isArray(c.ogonblick)));
      assert.equal(s.demo, true);
      const r = await demo.deps.meteorstorm.avsluta(s.id);
      assert.equal(r.redan, true);
    } finally {
      demo.destroy();
    }
  });
});
