// ============================================================================
// Enhetstester: Datakuppens projektor "Nätverket" (#654, spec §0.2, §4.2,
// §4.4, §4.5) – den rena logiken (dk-proj-scen.js): terminalraderna (namn
// på/av), hack-linjens händelse och kretsbana, lysdioderna, milstolparna,
// finalens rubrik/totalrad, säkerhetstipsen, andel lyckade hack, musiken
// (format.music) och projektorns ljud. DOM-delarna provas i
// preview/preview-datakuppen-demo.html (skärmdumpar: docs/qa-datakuppen-654/).
// Emoji 13+ i hela src/live: test/mynt-ikon.test.js.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DK_SCEN, DK_TOP, DK_MILESTONES, DK_LEDS, feedItem, milestone, crossedMilestone, FINAL_TITLE, togetherHtml,
  ledCount, hackLink, circuitPath, tipAt, hackShare, weight, trimPending, topPiles, podiumGroups,
} from "../src/live/formats/datakuppen/dk-proj-scen.js";
import { DK_TIPS } from "../src/live/formats/datakuppen/delat/files-config.js";
import { CUES } from "../src/live/proj-sound.js";
import { requireFormat } from "../src/live/formats/index.js";
import { musicTarget } from "../src/live/proj-music.js";

const nb = (s) => String(s).replace(/[  ]/g, " ");
const ev = (o) => ({ id: "e1", uid: "u1", name: "Omar", ...o });

test("terminalen: en kort rad per händelse, som i specen (§4.2)", () => {
  const t = (o, names = true) => nb(feedItem(ev(o), { names }).short);
  assert.equal(t({ type: "steal", chest: "hack", victimUid: "u2", victimName: "Leo", amount: 45 }), "> Omar hackade Leo: +45 MB");
  assert.equal(t({ type: "chest", chest: "stor_fil", name: "Alma", amount: 50 }), "> Alma laddade ner 50 MB");
  assert.equal(t({ type: "chest", chest: "brandvagg", name: "Ines", amount: 0 }), "> Ines aktiverade brandvägg");
  assert.equal(t({ type: "chest", chest: "virus", name: "Clara", amount: -12 }), "> Clara fick ett virus: −12 MB");
  assert.equal(t({ type: "lead", name: "Alma" }), "> Alma leder!");
});

test("terminalen: Visa namn av → 'Någon'/'en klasskamrat' och inga avatarer", () => {
  const item = feedItem(ev({ type: "steal", chest: "hack", victimUid: "u2", victimName: "Leo", amount: 45 }), { names: false });
  assert.equal(nb(item.short), "> Någon hackade en klasskamrat: +45 MB");
  assert.deepEqual(item.avatars, []);
  const med = feedItem(ev({ type: "steal", chest: "hack", victimUid: "u2", victimName: "Leo", amount: 45 }), { names: true });
  assert.deepEqual(med.avatars, ["u1", "u2"]);
  assert.ok(!JSON.stringify(item).includes("Omar") && !JSON.stringify(item).includes("Leo"));
});

test("terminalraderna är korta (≤ 32 tecken med ett sexbokstavsnamn och 3-siffrigt belopp)", () => {
  for (const chest of ["liten_fil", "mapp", "stor_fil", "serverhall", "overklockning", "virus", "tom_mapp", "brandvagg"]) {
    const s = nb(feedItem(ev({ type: "chest", chest, name: "Selmaa", amount: 100 }), { names: true }).short);
    assert.ok(s.length <= 32, `${chest}: "${s}" (${s.length})`);
  }
});

test("ingen banderoll i Datakuppen – stora händelser har ljud men aldrig en notis (timern fredad)", () => {
  const all = [
    ev({ type: "lead" }),
    ev({ type: "steal", chest: "hack", victimUid: "u2", victimName: "Leo", amount: 10 }),
    ev({ type: "chest", chest: "serverhall", amount: 100 }),
    ev({ type: "chest", chest: "mapp", amount: 25 }),
  ].map((e) => feedItem(e, { names: true }));
  for (const it of all) assert.equal(it.banner, null);
  assert.equal(all[0].cue, "dkLedare");
  assert.equal(all[1].cue, "dkAccess");
  assert.equal(all[2].cue, "dkUpp");
  assert.ok(all[2].big && weight(all[2]) > weight(all[3]));
});

test("gallringen vid trängsel släpper småfiler före hack", () => {
  const hack = feedItem(ev({ id: "h", type: "steal", chest: "hack", victimUid: "u2", victimName: "Leo", amount: 5 }));
  const sma = ["a", "b", "c"].map((id) => feedItem(ev({ id, type: "chest", chest: "liten_fil", amount: 10 })));
  const kvar = trimPending([...sma, hack], 2);
  assert.ok(kvar.includes(hack));
  assert.equal(kvar.length, 2);
});

test("hack-linjen: bara ett lyckat hack mellan två olika elever", () => {
  assert.deepEqual(hackLink(ev({ type: "steal", chest: "hack", victimUid: "u2" })), { from: "u1", to: "u2" });
  assert.equal(hackLink(ev({ type: "chest", chest: "hack", victimUid: "u2" })), null);
  assert.equal(hackLink(ev({ type: "steal", chest: "stold", victimUid: "u2" })), null);
  assert.equal(hackLink(ev({ type: "steal", chest: "hack", victimUid: "u1" })), null);
  assert.equal(hackLink(ev({ type: "steal", chest: "hack" })), null);
});

test("hack-linjens kretsbana: från hackarens skåp, tvärs ovanför, ned till målet", () => {
  const d = circuitPath({ x: 100, y: 300 }, { x: 500, y: 200 }, { lift: 60, radius: 10 });
  assert.match(d, /^M100 300 V150 Q100 140 110 140 H490 Q500 140 500 150 V200$/);
  // Åt vänster: hörnen vänder.
  const v = circuitPath({ x: 500, y: 200 }, { x: 100, y: 200 }, { lift: 40, radius: 10 });
  assert.match(v, /^M500 200 V170 Q500 160 490 160 H110 Q100 160 100 170 V200$/);
  // Rakt ovanför varandra: inga hörn större än halva avståndet.
  assert.match(circuitPath({ x: 50, y: 300 }, { x: 50, y: 100 }, { lift: 30 }), /^M50 300 V70 Q50 70 50 70 H50 Q50 70 50 70 V100$/);
});

test("serverskåpets lysdioder: 2–10, växer med datan och följer skalan", () => {
  assert.equal(DK_LEDS, 10);
  assert.equal(ledCount(0, 200), 2);
  assert.equal(ledCount(200, 200), 10);
  assert.equal(ledCount(5000, 200), 10);
  let prev = 0;
  for (const mb of [1, 10, 25, 50, 100, 150, 200]) {
    const n = ledCount(mb, 200);
    assert.ok(n >= prev && n >= 2 && n <= 10);
    prev = n;
  }
});

test("topp 10 vid servrarna – samma ordning och regler som Guldrushens högar", () => {
  const ps = Array.from({ length: 14 }, (_, i) => ({ uid: `u${i}`, gold: i === 13 ? 0 : 500 - i * 10, rank: i + 1 }));
  const top = topPiles(ps);
  assert.equal(top.length, DK_TOP);
  assert.deepEqual(top.map((p) => p.uid), ps.slice(0, 10).map((p) => p.uid));
});

test("milstolparna (MB) firas en gång när totalen passerar, mätaren mot nästa", () => {
  assert.deepEqual(DK_MILESTONES.slice(0, 4), [250, 500, 1000, 2000]);
  assert.deepEqual(milestone(375), { prev: 250, next: 500, frac: 0.5 });
  assert.equal(crossedMilestone(240, 260), 250);
  assert.equal(crossedMilestone(260, 240), null);
  assert.equal(crossedMilestone(400, 2100), 2000);
});

test("finalen (§0.2, test 24): exakt rubrik, lugn totalrad i MB, pall utan tomma platser", () => {
  assert.equal(FINAL_TITLE, "🏆 Datakuppen – Prispall");
  assert.equal(nb(togetherHtml(12400)), "Tillsammans: <strong>12 400 MB</strong>");
  const groups = podiumGroups([
    { uid: "a", gold: 300, rank: 1 }, { uid: "b", gold: 200, rank: 2 }, { uid: "c", gold: 200, rank: 2 }, { uid: "d", gold: 50, rank: 4 },
  ]);
  assert.deepEqual(groups.map((g) => [g.rank, g.players.length]), [[1, 1], [2, 2]]);
  assert.deepEqual(podiumGroups([{ uid: "a", gold: 10, rank: 1 }]).map((g) => g.rank), [1]);
});

test("säkerhetstipsen roterar (lobby + final) och är samma i alla fönster", () => {
  const p = 9000;
  const seen = new Set(Array.from({ length: DK_TIPS.length }, (_, i) => tipAt(i * p + 10)));
  assert.equal(seen.size, DK_TIPS.length);
  assert.equal(tipAt(5), tipAt(8999));
  assert.notEqual(tipAt(8999), tipAt(9000));
  assert.equal(tipAt(1, { tips: [] }), "");
});

test("statistiken: andel lyckade hack för hela klassen", () => {
  assert.equal(hackShare({ attempts: 0, success: 0 }), null);
  assert.equal(hackShare({ attempts: 24, success: 15 }), 63);
  assert.equal(hackShare(null), null);
});

test("musiken (§4.5, test 18): hackerlaget-dark-loop.ogg, tyst lobby, ≈ 30 % under matchen", () => {
  const f = requireFormat("datakuppen");
  assert.match(f.music.src, /\/datakuppen\/assets\/hackerlaget-dark-loop\.ogg$/);
  assert.ok(existsSync(fileURLToPath(f.music.src)));
  assert.equal(readFileSync(fileURLToPath(f.music.src)).subarray(0, 4).toString("latin1"), "OggS");
  assert.equal(f.music.level, 0.3);
  assert.equal(f.music.lobby, 0);
  const on = { on: true, level: f.music.level, lobby: f.music.lobby };
  assert.equal(musicTarget({ ...on, phase: "lobby" }).gain, 0);
  assert.equal(musicTarget({ ...on, phase: "live", msLeft: 90_000 }).gain, 0.3);
});

test("projektorns vyer laddas latt och finns", () => {
  const src = readFileSync(new URL("../src/live/formats/datakuppen/datakuppen-projector.js", import.meta.url), "utf8");
  assert.match(src, /id: "natverket".*finale: true/);
  assert.match(src, /id: "dk-statistik".*finale: true/);
  assert.match(src, /export const ownTimer = true/);
  const idx = readFileSync(new URL("../src/live/formats/datakuppen/index.js", import.meta.url), "utf8");
  assert.match(idx, /projectorViews: \(\) => import\("\.\/datakuppen-projector\.js"\)/);
});

test("Datakuppens ljud: korta, dämpade och utan gälla toner (§4.5)", () => {
  for (const name of ["dkAccess", "dkLedare", "dkUpp", "dkMilstolpe", "dkStart", "dkRegn"]) {
    const c = CUES[name];
    assert.ok(c, name);
    assert.ok(c.dur <= 1400, `${name}: ${c.dur} ms`);
    const tones = [];
    c.play((f, start, len, type, vol) => tones.push({ f, start, len, vol }));
    assert.ok(tones.length > 0);
    for (const t of tones) {
      assert.ok(t.vol <= 0.2, `${name}: volym ${t.vol}`);
      assert.ok(t.f <= 1600, `${name}: ${t.f} Hz`);
      assert.ok(t.start + t.len <= 1.6, `${name}: ringer kvar`);
    }
  }
});

test("temat bär kistspelsmotorns API (samma som Guldrushen)", () => {
  for (const k of ["milestone", "crossedMilestone", "feedItem", "weight", "trimPending", "togetherHtml"]) {
    assert.equal(typeof DK_SCEN[k], "function", k);
  }
});
