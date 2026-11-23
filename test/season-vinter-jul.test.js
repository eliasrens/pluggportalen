// ============================================================================
// Tester: säsongen Vinter, tillägget Jul och tilläggsregistret (#907, epic
// #906, UTVECKLINGSUPPDRAG_VINTER_JUL.md G.1) – ren logik i
// src/season-config.js, src/season-store.js och partikellagret i
// src/season-world.js.
//   • normalizeSeason med vinter, jul och julUntil; okänt faller tillbaka
//   • TILLAGG: tillaggAktivt, aktivaTillagg, nextSeasonBoundary med två
//     tillägg, standardTill för Jul (13 jan, även när det har passerat)
//   • bakåtkompatibelt: ett gammalt dokument utan jul = exakt samma läge
//   • themeFor: vinter, jul ovanpå vinter/sommar, båda tilläggen
//   • snön: ≤20 flingor, #F4F8FC med #9FB4CB-kontur, transform/opacity,
//     pausas i dold flik, av vid reducerad rörelse, inte i rummet
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HALLOWEEN_LOGIN_PALETTE,
  JUL_LOGIN_PALETTE,
  SEASONS,
  TILLAGG,
  aktivaTillagg,
  defaultHalloweenUntil,
  defaultTillaggUntil,
  describeSeason,
  halloweenActive,
  nextSeasonBoundary,
  normalizeSeason,
  themeFor,
  tillaggAktivt,
} from "../src/season-config.js";
import { createSeasonStore } from "../src/season-store.js";
import { samlingOppen } from "../src/butik-core.js";
import { PARTIKLAR, SNO_ANTAL, paletteCss, snoMarkup } from "../src/season-world.js";
import { snoSvg } from "../src/art-sasong.js";

const CSS = readFileSync(new URL("../src/styles/32-sasong.css", import.meta.url), "utf8");
const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

const NU = new Date(2026, 11, 1, 12, 0).getTime(); // 1 dec 2026 12.00 lokal tid
const JUL_SLUT = new Date(2027, 0, 13, 23, 59).getTime();
const HW_SLUT = new Date(2026, 11, 10, 23, 59).getTime();

/** Läget som season-store.js ger (med {id}Active) – för themeFor. */
const lage = (raw, now = NU) => {
  const st = createSeasonStore({ now: () => now, load: () => raw, setTimeout: () => 0, clearTimeout: () => {} });
  const s = st.get();
  st.stop();
  return s;
};

test("Vinter är en rad i SEASONS (A.1) och en nyckel i reglerna", () => {
  assert.equal(SEASONS.vinter.label, "Vinter");
  assert.equal(SEASONS.vinter.dekor.sno, true);
  assert.ok(SEASONS.vinter.preview.sky && SEASONS.vinter.preview.grass && SEASONS.vinter.preview.tree.length === 3);
  for (const [k, v] of Object.entries(SEASONS.vinter.palette)) assert.match(v, /^#[0-9A-F]{6}$/i, k);
  // B.2: ingen ljusare snö än #EEF3F8 – aldrig #FFFFFF.
  assert.ok(!Object.values(SEASONS.vinter.palette).some((v) => /^#F{6}$/i.test(v)));
  // Varje nyckel i SEASONS finns i validSeasonDoc.
  const m = /d\.season in \[([^\]]*)\]/.exec(RULES);
  const regel = m[1].split(",").map((x) => x.trim().replace(/'/g, ""));
  assert.deepEqual(regel.sort(), Object.keys(SEASONS).sort());
  // Och varje tilläggs fält får skrivas.
  for (const t of TILLAGG) assert.ok(RULES.includes(`'${t.falt}', '${t.tillFalt}'`) || RULES.includes(`'${t.falt}'`), t.id);
});

test("normalizeSeason: vinter, jul och julUntil; okänt faller tillbaka", () => {
  assert.deepEqual(normalizeSeason({ season: "vinter", jul: true, julUntil: { seconds: JUL_SLUT / 1000 } }), {
    season: "vinter", halloween: false, halloweenUntil: null, jul: true, julUntil: JUL_SLUT,
  });
  assert.deepEqual(normalizeSeason({ season: "jul", jul: "ja", julUntil: "2027-01-13" }), {
    season: "sommar", halloween: false, halloweenUntil: null, jul: false, julUntil: null,
  });
  assert.equal(normalizeSeason({ jul: 1 }).jul, false);
  assert.equal(normalizeSeason({ jul: true, julUntil: { toMillis: () => JUL_SLUT } }).julUntil, JUL_SLUT);
});

test("registret: en rad per tillägg med fälten A.2 beskriver", () => {
  assert.deepEqual(TILLAGG.map((t) => t.id), ["halloween", "jul"]);
  const [hw, jul] = TILLAGG;
  assert.equal(hw.falt, "halloween");
  assert.equal(hw.tillFalt, "halloweenUntil");
  assert.equal(hw.loginPalett, HALLOWEEN_LOGIN_PALETTE);
  assert.equal(hw.samling, "halloween");
  assert.equal(jul.falt, "jul");
  assert.equal(jul.tillFalt, "julUntil");
  assert.equal(jul.loginPalett, JUL_LOGIN_PALETTE);
  assert.equal(jul.samling, "jul");
  for (const t of TILLAGG) assert.ok(t.label && t.emoji && typeof t.standardTill === "function", t.id);
});

test("tillaggAktivt och aktivaTillagg", () => {
  const d = { season: "vinter", jul: true, julUntil: JUL_SLUT, halloween: true, halloweenUntil: HW_SLUT };
  assert.equal(tillaggAktivt(d, "jul", NU), true);
  assert.equal(tillaggAktivt(d, "halloween", NU), true);
  assert.deepEqual(aktivaTillagg(d, NU), ["halloween", "jul"]);
  assert.deepEqual(aktivaTillagg(d, HW_SLUT), ["jul"], "Halloween av på slutdatumet");
  assert.deepEqual(aktivaTillagg(d, JUL_SLUT + 1), []);
  assert.equal(tillaggAktivt({ jul: true }, "jul", NU), true, "inget slutdatum");
  assert.equal(tillaggAktivt({ jul: false, julUntil: JUL_SLUT }, "jul", NU), false);
  assert.equal(tillaggAktivt(d, "pask", NU), false, "okänt tillägg");
  assert.equal(tillaggAktivt(null, "jul", NU), false);
  // halloweenActive är ett omslag kring registret.
  assert.equal(halloweenActive(d, NU), tillaggAktivt(d, "halloween", NU));
});

test("nextSeasonBoundary räknar alla tillägg – närmaste kommande slutdatum", () => {
  const d = { jul: true, julUntil: JUL_SLUT, halloween: true, halloweenUntil: HW_SLUT };
  assert.equal(nextSeasonBoundary(d, NU), HW_SLUT);
  assert.equal(nextSeasonBoundary(d, HW_SLUT), JUL_SLUT, "Halloween passerat → Jul nästa");
  assert.equal(nextSeasonBoundary(d, JUL_SLUT), null);
  assert.equal(nextSeasonBoundary({ jul: true, julUntil: JUL_SLUT }, NU), JUL_SLUT);
  assert.equal(nextSeasonBoundary({ jul: true }, NU), null);
  assert.equal(nextSeasonBoundary({ jul: false, julUntil: JUL_SLUT }, NU), null);
  assert.equal(nextSeasonBoundary({ jul: true, halloween: true, halloweenUntil: HW_SLUT }, NU), HW_SLUT);
});

test("standardTill för Jul: 13 jan 23.59 (tjugondag Knut), nästa år om det har passerat", () => {
  assert.equal(defaultTillaggUntil("jul", NU), JUL_SLUT, "i december → januari nästa år");
  assert.equal(defaultTillaggUntil("jul", new Date(2027, 0, 5).getTime()), JUL_SLUT, "i början av januari → samma januari");
  assert.equal(defaultTillaggUntil("jul", JUL_SLUT - 1), JUL_SLUT);
  assert.equal(defaultTillaggUntil("jul", JUL_SLUT), new Date(2028, 0, 13, 23, 59).getTime(), "precis passerat → nästa år");
  assert.equal(defaultTillaggUntil("jul", new Date(2027, 5, 1).getTime()), new Date(2028, 0, 13, 23, 59).getTime());
  // Halloween oförändrat.
  assert.equal(defaultTillaggUntil("halloween", NU), defaultHalloweenUntil(NU));
  assert.equal(defaultHalloweenUntil(new Date(2026, 9, 30).getTime()), new Date(2026, 10, 2, 23, 59).getTime());
});

test("bakåtkompatibelt: ett gammalt dokument utan jul ger samma läge som i dag", () => {
  const gamla = [
    null,
    { season: "sommar", halloween: false, halloweenUntil: null },
    { season: "host", halloween: true, halloweenUntil: HW_SLUT },
    { season: "host", halloween: true },
  ];
  for (const g of gamla) {
    const s = normalizeSeason(g);
    assert.equal(s.jul, false);
    assert.equal(s.julUntil, null);
    const l = lage(g);
    assert.equal(l.julActive, false);
    assert.equal(l.halloweenActive, halloweenActive(g, NU));
    assert.deepEqual(l.tillagg, l.halloweenActive ? ["halloween"] : []);
    const t = themeFor(l);
    assert.equal(t.jul, false);
    assert.equal(t.sno, false);
    // Samma tema som före registret: världen = säsongen, inloggningen = Halloween om på.
    const world = { ...SEASONS[s.season].palette };
    assert.deepEqual(t.world, world);
    assert.deepEqual(t.login, l.halloweenActive ? { ...world, ...HALLOWEEN_LOGIN_PALETTE } : world);
    assert.equal(t.halloween, l.halloweenActive);
    assert.equal(t.leaves, s.season === "host");
  }
  assert.equal(describeSeason(null, NU), "Sommar · Halloween av");
  assert.equal(describeSeason({ season: "host", halloween: true, halloweenUntil: HW_SLUT }, NU), "Höst · Halloween på till 10 dec 23.59");
  // Butiken: Halloween-samlingen öppen precis som förut; Jul öppnar bara jul.
  assert.equal(samlingOppen("halloween", { halloween: true }, NU), true);
  assert.equal(samlingOppen("halloween", { halloween: false, jul: true }, NU), false);
  assert.equal(samlingOppen("jul", { jul: true }, NU), true);
  assert.equal(samlingOppen("jul", { halloween: true }, NU), false);
  assert.equal(samlingOppen("annat", { halloween: true, jul: true }, NU), false);
});

test("store: Jul slår av vid julUntil utan omladdning, Halloween påverkas inte", () => {
  let now = JUL_SLUT - 1000;
  const timers = [];
  const st = createSeasonStore({
    now: () => now,
    load: () => null,
    setTimeout: (fn, ms) => (timers.push({ fn, at: now + ms }), timers.length),
    clearTimeout: () => {},
  });
  const handelser = [];
  st.subscribe((n, f) => handelser.push([f.julActive, n.julActive]));
  st.snapshot({ season: "vinter", jul: true, julUntil: JUL_SLUT, halloween: true });
  assert.equal(st.get().julActive, true);
  assert.deepEqual(st.get().tillagg, ["halloween", "jul"]);
  now += 1500;
  timers.at(-1).fn();
  assert.equal(st.get().julActive, false);
  assert.equal(st.get().halloweenActive, true);
  assert.deepEqual(handelser, [[false, true], [true, false]]);
  st.stop();
});

test("describeSeason: Vinter · Jul på till 13 jan 23.59", () => {
  assert.equal(describeSeason({ season: "vinter", jul: true, julUntil: JUL_SLUT }, NU), "Vinter · Jul på till 13 jan 2027 23.59");
  assert.equal(
    describeSeason({ season: "vinter", jul: true, julUntil: JUL_SLUT }, new Date(2027, 0, 2).getTime()),
    "Vinter · Jul på till 13 jan 23.59"
  );
  assert.equal(describeSeason({ season: "vinter", jul: true }, NU), "Vinter · Jul på (inget slutdatum)");
  assert.equal(describeSeason({ season: "vinter" }, NU), "Vinter · Halloween av");
  assert.match(describeSeason({ season: "vinter", jul: true, julUntil: JUL_SLUT }, JUL_SLUT + 1), /^Vinter · Jul av \(slutdatumet .* har passerat\)$/);
  assert.equal(
    describeSeason({ season: "host", halloween: true, jul: true }, NU),
    "Höst · Halloween på (inget slutdatum) · Jul på (inget slutdatum)"
  );
});

test("themeFor: vinter, jul ovanpå vinter, jul ovanpå sommar, båda tilläggen", () => {
  const v = themeFor(lage({ season: "vinter" }));
  assert.equal(v.season, "vinter");
  assert.equal(v.sno, true);
  assert.equal(v.leaves, false);
  assert.equal(v.jul, false);
  assert.deepEqual(v.world, SEASONS.vinter.palette);
  assert.deepEqual(v.login, SEASONS.vinter.palette);

  const vj = themeFor(lage({ season: "vinter", jul: true }));
  assert.equal(vj.jul, true);
  assert.equal(vj.sno, true);
  assert.deepEqual(vj.tillagg, ["jul"]);
  assert.deepEqual(vj.world, SEASONS.vinter.palette, "världen behåller säsongens dagsljus");
  assert.deepEqual(vj.login, { ...SEASONS.vinter.palette, ...JUL_LOGIN_PALETTE });

  const sj = themeFor(lage({ season: "sommar", jul: true }));
  assert.equal(sj.season, "sommar");
  assert.equal(sj.jul, true);
  assert.equal(sj.sno, false, "Jul kräver inte vinter – ingen snö på sommaren");
  assert.deepEqual(sj.world, {});
  assert.deepEqual(sj.login, JUL_LOGIN_PALETTE);

  const bada = themeFor(lage({ season: "vinter", jul: true, halloween: true }));
  assert.equal(bada.halloween, true);
  assert.equal(bada.jul, true);
  assert.deepEqual(bada.tillagg, ["halloween", "jul"]);
  // Inloggningen: den senare raden (Jul) vinner; nycklar bara Halloween har behålls.
  assert.deepEqual(bada.login, { ...SEASONS.vinter.palette, ...HALLOWEEN_LOGIN_PALETTE, ...JUL_LOGIN_PALETTE });

  // Jul med passerat slutdatum = av.
  assert.equal(themeFor(lage({ season: "vinter", jul: true, julUntil: NU - 1 })).jul, false);
  // Palett-CSS: vinter sätter världen; Jul bara inloggningen.
  const css = paletteCss(vj);
  assert.ok(css.includes(`--sz-grass:${SEASONS.vinter.palette.grass};`));
  assert.ok(css.includes(`--sz-port-sky1:${JUL_LOGIN_PALETTE["port-sky1"]};`));
});

test("snön: ≤20 flingor, 4–10 px, 0,7–0,9, deterministisk (A.4)", () => {
  assert.ok(SNO_ANTAL <= 20);
  const m = snoMarkup();
  assert.equal((m.match(/class="sz-sno"/g) || []).length, SNO_ANTAL);
  assert.equal(snoMarkup(), m);
  for (const [, w] of m.matchAll(/--w:(\d+)px/g)) assert.ok(+w >= 4 && +w <= 10, w);
  for (const [, o] of m.matchAll(/--o:([\d.]+)/g)) assert.ok(+o >= 0.7 && +o <= 0.9, o);
  for (const i of [0, 1]) {
    const svg = snoSvg(i);
    assert.ok(svg.includes('fill="#F4F8FC"'));
    assert.ok(svg.includes('stroke="#9FB4CB"'));
    assert.ok(svg.includes('stroke-width="1"'));
    assert.ok(!/#fff(fff)?\b/i.test(svg), "aldrig knallvitt");
  }
  assert.ok(snoSvg(0).includes("<circle"), "rund");
  assert.ok(snoSvg(1).includes("<path"), "sexuddig stjärna");
  // Partikellagret: samma kod för löv och snö.
  assert.deepEqual(Object.keys(PARTIKLAR), ["lov", "sno"]);
  assert.equal(PARTIKLAR.sno.pa({ sno: true }), true);
  assert.equal(PARTIKLAR.lov.pa({ sno: true }), false);
});

test("snön i CSS: bara transform/opacity, ingen snurr, pausas, av vid reducerad rörelse, inte i rummet", () => {
  const kf = /@keyframes sz-snoa\s*\{([\s\S]*?)\n\}/.exec(CSS)[1];
  const egenskaper = new Set([...kf.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]));
  assert.deepEqual([...egenskaper].sort(), ["opacity", "transform"]);
  assert.ok(!/rotate/.test(kf), "ingen snurr");
  assert.match(CSS, /html\[data-sno\] \.sz-sno-lager/);
  assert.match(CSS, /html\.sz-paus \.sz-sno,/);
  assert.match(CSS, /\.sz-lov-lager, \.sz-sno-lager, \.sz-fladder-lager \{ display: none; \}/);
  // Gemensamt för alla partikellager (.sz-lager): klick går igenom, av vid
  // reducerad rörelse, dolt i rummet.
  assert.match(CSS, /\.sz-lager \{[^}]*pointer-events: none;/);
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.sz-lager \{ display: none !important; \}/);
  assert.match(CSS, /\.varld-stage\[data-niva="rum"\] \.sz-lager/);
  // En animation per flinga.
  assert.equal((/\.sz-sno \{[^}]*\}/.exec(CSS)[0].match(/animation:/g) || []).length, 1);
});
