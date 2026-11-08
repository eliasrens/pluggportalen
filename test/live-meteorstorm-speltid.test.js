// ============================================================================
// Meteorstormen G (#828): slutstormen har FAST längd i ms oavsett speltid, så
// 15 och 20 min går att klara lika bra som 10 min (förr en andel av speltiden:
// 72 s på 20 min och stationen dog nästan alltid). Plus två småfynd: avslut
// under nedräkningen ger ingen ⭐⭐⭐/"överlevde", och "1 träff" i historiken.
// Ren node, ingen emulator.
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { intensitetVid, slutstormStartMs, skapaPlan, handelsePlan } from "../src/live/formats/meteorstorm/delat/ms-storm.js";
import { SLUTSTORM, HANDELSE_PAUS_MS, SPELTID_MIN_MS, SPELTID_MAX_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import { stoppadForeStormen } from "../src/live/formats/meteorstorm/delat/ms-resultat.js";
import { slutModell, slutHtml, FORE_STORMEN } from "../src/live/formats/meteorstorm/msp-slut.js";
import { slutet } from "../src/live/formats/meteorstorm/ms-elev.js";
import { korEnKlass, SCENARIER } from "../admin/ms-balans-sim.mjs";

const MIN = 60_000;
const SPELTIDER = [5, 10, 12, 15, 20].map((m) => m * MIN);

describe("Meteorstormen – slutstormen har fast längd (#828)", () => {
  it("full styrka de sista langdMs och upptrappning före, vid alla speltider 5–20 min", () => {
    assert.equal(SLUTSTORM.langdMs, 36_000);
    assert.equal(SLUTSTORM.upptrappningMs, 24_000);
    for (const D of SPELTIDER) {
      const start = slutstormStartMs(D);
      assert.equal(D - start, SLUTSTORM.langdMs + SLUTSTORM.upptrappningMs, `${D / MIN} min`);
      for (const kvar of [0, 100, 20_000, SLUTSTORM.langdMs]) assert.equal(intensitetVid(D - kvar, D), SLUTSTORM.intensitet);
      assert.ok(intensitetVid(start, D) < 0.1, "lugnt precis före upptrappningen");
      const mitt = intensitetVid(start + SLUTSTORM.upptrappningMs / 2, D);
      assert.ok(mitt > 0.3 && mitt < 0.45, `halvvägs i upptrappningen: ${mitt}`);
    }
  });

  it("10 min är oförändrad mot den gamla andelskurvan (0,90 → 0,94 → 1,0)", () => {
    const gammal = [[0, 0.05], [0.45, 0.062], [0.55, 0.055], [0.9, 0.055], [0.94, 0.72], [1, 0.72]];
    const kurva = (a) => {
      for (let i = 1; i < gammal.length; i++) {
        const [x0, y0] = gammal[i - 1];
        const [x1, y1] = gammal[i];
        if (a <= x1) return y0 + ((y1 - y0) * (a - x0)) / (x1 - x0);
      }
      return 0.72;
    };
    for (let t = 0; t <= 10 * MIN; t += 1000) assert.ok(Math.abs(intensitetVid(t, 10 * MIN) - kurva(t / (10 * MIN))) < 1e-9, `${t} ms`);
  });

  it("lika många meteorer i slutstormen vid 5, 10, 15 och 20 min (förr dubbelt så många på 20 min)", () => {
    const iSlutet = (seed, D) => skapaPlan(seed, D).meteorer.filter((m) => !m.jatte && m.spawnMs >= slutstormStartMs(D)).length;
    for (let s = 0; s < 10; s++) {
      const n = SPELTIDER.map((D) => iSlutet(`sl-${s}`, D));
      assert.ok(Math.max(...n) - Math.min(...n) <= 6, `frö ${s}: ${n.join(", ")}`);
      assert.ok(n.every((x) => x >= 25 && x <= 34), n.join(", "));
    }
  });

  it("inga händelser i (eller strax före) slutstormen vid någon speltid", () => {
    for (const D of [SPELTID_MIN_MS, 7 * MIN, 10 * MIN, 15 * MIN, SPELTID_MAX_MS]) {
      for (let s = 0; s < 20; s++) {
        for (const h of handelsePlan(`hs-${s}`, D)) assert.ok(h.slutMs <= slutstormStartMs(D) - HANDELSE_PAUS_MS, `${D / MIN} min: ${h.typ} slutar ${h.slutMs}`);
      }
    }
  });
});

describe("Meteorstormen – balansen per speltid (#828, admin/ms-balans-sim.mjs)", () => {
  const sc = (andel) => SCENARIER.find((x) => x.namn.startsWith(`${andel} % rätt, blandar`));
  const N = 6;

  it("80 % rätt: stationen överlever och får 2–3 stjärnor även på 15 och 20 min", () => {
    for (const min of [15, 20]) {
      const r = korEnKlass(sc(80), N, min * MIN);
      assert.equal(r.stjarnor[0] + r.stjarnor[1], 0, `${min} min: ${r.stjarnor.join("/")}`);
      assert.ok(r.skrov >= 65, `${min} min: skrov ${r.skrov}`);
    }
  });

  it("40 % rätt: inga gratis tre stjärnor vid någon speltid", () => {
    for (const min of [5, 10, 15, 20]) {
      const r = korEnKlass(sc(40), N, min * MIN);
      assert.equal(r.stjarnor[3], 0, `${min} min: ${r.stjarnor.join("/")}`);
      assert.ok(r.skrov < 50, `${min} min: skrov ${r.skrov}`);
    }
  });
});

describe("Meteorstormen – avslut under nedräkningen (#828)", () => {
  const enKlass = { lage: "en-klass", winner: null, draw: false, placering: [{ classId: "4b", skrov: 100, nedskjutna: 0, plats: 1 }], stjarnor: 3, overlevde: true, startMs: 5000, slutMs: 3000 };
  const kmk = { lage: "klass-mot-klass", winner: null, draw: true, startMs: 5000, slutMs: 5000,
    placering: [{ classId: "4b", skrov: 100, nedskjutna: 0, plats: 1 }, { classId: "4d", skrov: 100, nedskjutna: 0, plats: 1 }] };
  const S = { classNames: { "4b": "4B", "4d": "4D" }, participatingClassIds: ["4b", "4d"] };

  it("stoppadForeStormen: slutMs ≤ startMs (inte efter ordinarie start eller utan tider)", () => {
    assert.equal(stoppadForeStormen(enKlass), true);
    assert.equal(stoppadForeStormen(kmk), true);
    assert.equal(stoppadForeStormen({ ...enKlass, slutMs: 5100 }), false);
    assert.equal(stoppadForeStormen({ lage: "en-klass" }), false);
    assert.equal(stoppadForeStormen(null), false);
  });

  it("projektorn: ingen ⭐⭐⭐, ingen 'överlevde', ingen 'Fantastiskt försvar'", () => {
    for (const r of [enKlass, kmk]) {
      const m = slutModell(r, S);
      assert.equal(m.stjarnor, 0);
      assert.equal(m.rubrik, "Stormen är över!");
      assert.equal(m.under, FORE_STORMEN);
      assert.doesNotMatch(`${m.rubrik} ${m.under}`, /överlevde|Fantastiskt|klarade/);
      assert.doesNotMatch(slutHtml(m, {}), /msp-stjarnor/, "ingen stjärnrad alls");
    }
    assert.match(slutModell({ ...enKlass, slutMs: 605_000 }, S).under, /Fantastiskt/, "vanligt slut oförändrat");
  });

  it("elevskärmen: neutral rubrik, inga stjärnor", () => {
    const t = slutet(enKlass, "4b", S);
    assert.equal(t.vann, false);
    assert.equal(t.stjarnor, undefined);
    assert.doesNotMatch(`${t.titel} ${t.rad}`, /överlevde|⭐/);
    assert.doesNotMatch(slutet(kmk, "4b", S).titel, /Oavgjort/);
  });
});

describe("Meteorstormen – historiken (#828)", () => {
  const HOOK = `export async function resolve(spec, ctx, next) {
    if (spec.endsWith("/teacher-shared.js")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(
      "export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');") };
    if (spec.endsWith("/live-css.js")) return { shortCircuit: true, url: "data:text/javascript,export function ensureLiveCss(){}" };
    return next(spec, ctx);
  }`;
  let H;
  before(async () => {
    register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
    H = await import("../src/live/formats/meteorstorm/meteorstorm-history.js");
  });
  const S = { classNames: { "4b": "4B" }, participatingClassIds: ["4b"] };
  const res = (over = {}) => ({
    lage: "en-klass", placering: [{ classId: "4b", skrov: 100, nedskjutna: 0, plats: 1 }], stjarnor: 3, overlevde: true,
    startMs: 5000, slutMs: 3000, perClass: { "4b": { traffar: 1, kastade: 0, players: 1 } }, ...over,
  });

  it("avslutad under nedräkningen: ingen ⭐⭐⭐ och ingen 'Stationen överlevde!'", () => {
    assert.equal(H.winnerText(S, res()), "⏹️ Avslutad före stormen");
    assert.equal(H.utfallText(S, res(), "4b"), "–");
    assert.equal(H.winnerText(S, res({ slutMs: 605_000 })), "⭐⭐⭐ 4B", "vanligt slut oförändrat");
  });

  it("'1 träff' och '1 elev' – plural från 2", () => {
    assert.match(H.stationerHtml(S, res()), /💥 1 träff · .* · 1 elev</);
    assert.match(H.stationerHtml(S, res({ perClass: { "4b": { traffar: 2, kastade: 0, players: 3 } } })), /💥 2 träffar · .* · 3 elever</);
  });
});
