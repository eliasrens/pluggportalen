// ============================================================================
// Hitta rätt! (#608): spelflödets rena delar – poäng per pack (Sverige- och
// världskarta), aktiv tid som pausas under feedbacken (test 4), coins = godkända
// svar (test 11), slumpad ordning, feedbacktexter och resultatskärmen.
// Spelvyn (hr-spel.js) verifieras i webbläsaren mot emulatorn.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blanda, skapaStoppur, skapaOmgang, serverMs, berom, omradeText, formatKm, snitt,
} from "../src/hitta-ratt/hr-omgang.js";
import { resultatHtml, sparFelHtml, coinsText, rubrik } from "../src/hitta-ratt/hr-resultat-vy.js";
import { raknaOmgang } from "../src/hitta-ratt/delat/omgang.js";
import { MIN_MS_PER_FRAGA } from "../src/hitta-ratt/delat/omgang.js";

const pack = (id) => JSON.parse(readFileSync(new URL(`../src/hitta-ratt/content/packs/${id}.json`, import.meta.url)));
const item = (p, id) => p.items.find((it) => it.id === id);
/** En punkt `km` rakt norr om (lon, lat) – 1° latitud ≈ 111,195 km. */
const norrOm = ({ lon, lat }, km) => ({ lon, lat: lat + km / 111.19508 });

// Facit på serverns form (som admin/sync-hitta-ratt-functions.mjs bygger det).
const serverPack = (p) => ({
  id: p.id, typ: p.type, cfg: p.scoringConfig,
  items: p.items.map((it) => (p.type === "area" ? { id: it.id, omrade: it.omrade } : { id: it.id, lat: it.lat, lon: it.lon })),
});

test("poäng: Sverigekartan – 0–100, normaliserat (5/90), monotont fallande", () => {
  const p = pack("sverige-stader");
  const gavle = item(p, "gavle");
  const exempel = [[0, 100], [3, 100], [10, 99], [34, 87], [40, 83], [90, 50], [150, 21], [300, 1], [400, 0]];
  for (const [km, vantat] of exempel) {
    const o = skapaOmgang(p, [gavle]);
    const u = o.lasPunkt(norrOm(gavle, km));
    assert.ok(Math.abs(u.km - km) < 0.05, `${km} km`);
    assert.equal(u.p, vantat, `${km} km fel på Sverigekartan`);
    assert.equal(u.godkand, vantat > 0);
  }
});

test("poäng: världskartan – samma fel ger fler poäng (25/600)", () => {
  const p = pack("varlden-huvudstader-30");
  const it = p.items[0];
  const exempel = [[0, 100], [40, 100], [100, 97], [300, 80], [600, 50], [1000, 22], [2000, 1], [2400, 0]];
  for (const [km, vantat] of exempel) {
    const u = skapaOmgang(p, [it]).lasPunkt(norrOm(it, km));
    assert.equal(u.p, vantat, `${km} km fel på världskartan`);
  }
  // Specens §7: 40 km fel är ett större fel i Sverige än på världskartan.
  const sv = pack("sverige-stader");
  const pSv = skapaOmgang(sv, [sv.items[0]]).lasPunkt(norrOm(sv.items[0], 40)).p;
  const pVa = skapaOmgang(p, [it]).lasPunkt(norrOm(it, 40)).p;
  assert.ok(pSv < pVa, `${pSv} < ${pVa}`);
});

test("alla punktpack har scoringConfig och ger 0–100 utan hopp", () => {
  const index = JSON.parse(readFileSync(new URL("../src/hitta-ratt/content/packs/index.json", import.meta.url)));
  for (const { id, type } of index.filter((x) => x.type === "point")) {
    const p = pack(id);
    assert.ok(p.scoringConfig?.fullKm > 0 && p.scoringConfig.halvKm > p.scoringConfig.fullKm, id);
    const it = p.items[0];
    // Steg = 5 % av halvKm: kurvan faller högst några poäng per steg (inga hopp).
    const steg = p.scoringConfig.halvKm / 20;
    let forra = 101;
    for (let km = 0; km < 6000; km += steg) {
      const v = skapaOmgang(p, [it]).lasPunkt(norrOm(it, km)).p;
      assert.ok(v >= 0 && v <= 100 && v <= forra, `${id} ${km} km (${type})`);
      assert.ok(forra === 101 || forra - v <= 5, `${id}: hopp vid ${km} km`);
      forra = v;
    }
  }
});

test("punktomgång: klientens summa = serverns omräkning, snitt och godkända", () => {
  const p = pack("sverige-stader");
  const ordning = blanda(p.items, () => 0.42);
  const o = skapaOmgang(p, ordning);
  ordning.forEach((it, i) => {
    o.lasPunkt(norrOm(it, i * 20)); // 0, 20, 40 … 380 km fel
    assert.equal(o.nasta(), i < ordning.length - 1);
  });
  assert.ok(o.klar);
  const s = o.summa();
  const server = raknaOmgang(serverPack(p), o.svar());
  assert.equal(s.s, server.s);
  assert.equal(s.godkanda, server.godkanda);
  assert.equal(s.max, 2000);
  assert.equal(s.snitt, Math.round(s.s / 20));
  assert.equal(s.godkanda, 17, "340 km fel och mer ger 0 p och inget coin");
});

test("test 4: aktiv tid går bara mellan att frågan blir aktiv och lås", () => {
  let nu = 1000;
  const ur = skapaStoppur(() => nu);
  ur.starta(); // fråga 1 aktiv
  nu += 4200;
  assert.equal(ur.nuMs(), 4200);
  assert.equal(ur.stoppa(), 4200); // lås
  assert.equal(ur.pagar, false);
  nu += 60_000; // eleven studerar feedbacken en minut
  assert.equal(ur.nuMs(), 4200, "tiden står still under feedbacken");
  assert.equal(ur.stoppa(), 0, "dubbelt lås räknar ingen tid");
  ur.starta(); // "Nästa" → fråga 2 aktiv
  ur.starta(); // en extra start nollställer inte
  nu += 2500;
  assert.equal(ur.stoppa(), 2500);
  assert.equal(ur.nuMs(), 6700);
});

test("områdesomgång: rätt/fel, ms per fråga med serverns golv, Σ inom verklig tid", () => {
  const p = pack("europa-lander-20");
  const ordning = blanda(p.items, () => 0.7);
  const o = skapaOmgang(p, ordning);
  let nu = 0;
  const ur = skapaStoppur(() => nu);
  const startMs = 0;
  ordning.forEach((it, i) => {
    ur.starta();
    nu += i === 0 ? 300 : 1800; // första låset snabbare än golvet
    const valt = i % 4 === 0 ? ordning[(i + 1) % ordning.length].omrade : it.omrade;
    const u = o.lasOmrade(valt, ur.stoppa());
    assert.equal(u.ratt, valt === it.omrade);
    if (!u.ratt) assert.equal(u.valtNamn, ordning[(i + 1) % ordning.length].name);
    nu += 3000; // feedback
    o.nasta();
  });
  const svar = o.svar();
  assert.equal(svar[0].ms, MIN_MS_PER_FRAGA);
  assert.ok(svar.every((x) => Number.isInteger(x.ms) && x.ms >= MIN_MS_PER_FRAGA));
  const server = raknaOmgang({ ...serverPack(p), omraden: null }, svar, { startMs, nuMs: nu });
  const s = o.summa();
  assert.equal(s.r, 15);
  assert.equal(s.r, server.r);
  assert.equal(s.t, server.t);
  assert.equal(s.godkanda, 15);
});

test("omgången: lås kräver aktiv fråga, Nästa kräver lås", () => {
  const p = pack("sverige-lan");
  const o = skapaOmgang(p, p.items.slice(0, 2));
  assert.throws(() => o.nasta(), /Lås/);
  o.lasOmrade(p.items[0].omrade, 1000);
  assert.throws(() => o.lasOmrade(p.items[0].omrade, 1000), /låst/);
  assert.equal(o.sista, false);
  assert.equal(o.nasta(), true);
  assert.equal(o.sista, true);
  o.lasOmrade("o999", 1000);
  assert.equal(o.nasta(), false);
  assert.deepEqual(o.summa(), { typ: "area", n: 2, besvarade: 2, max: 2, r: 1, t: 20, godkanda: 1 });
  assert.equal(serverMs(12.6), MIN_MS_PER_FRAGA);
  assert.equal(serverMs(1234.4), 1234);
});

test("blanda: alla frågor exakt en gång, ny ordning per försök", () => {
  const p = pack("europa-huvudstader-20");
  const a = blanda(p.items);
  assert.equal(a.length, p.items.length);
  assert.deepEqual(new Set(a.map((x) => x.id)), new Set(p.items.map((x) => x.id)));
  assert.notStrictEqual(a, p.items);
  const ordningar = new Set(Array.from({ length: 8 }, () => blanda(p.items).map((x) => x.id).join()));
  assert.ok(ordningar.size > 1, "slumpad per försök");
});

test("feedback: kort, positiv och varierad; rätt/fel i ord", () => {
  assert.equal(berom(100, 0), "Fullträff!");
  assert.notEqual(berom(100, 0), berom(100, 1));
  assert.match(berom(94), /nära|Snyggt/i);
  assert.ok(berom(0).length > 0 && !/fel|dåligt/i.test(berom(0)));
  assert.deepEqual(omradeText({ ratt: true }, "Portugal", 0), { rubrik: "Rätt!", text: "Det här är Portugal." });
  const fel = omradeText({ ratt: false, valtNamn: "Spanien" }, "Portugal");
  assert.equal(fel.rubrik, "Inte riktigt.");
  assert.match(fel.text, /Du valde Spanien\. Portugal är markerat i grönt\./);
  assert.equal(omradeText({ ratt: false, valtNamn: null }, "Portugal").text, "Portugal är markerat i grönt.");
  assert.equal(formatKm(34.4), "34 km");
  assert.equal(formatKm(1240), `${(1240).toLocaleString("sv-SE")} km`);
  assert.equal(formatKm(0.3), "under 1 km");
  assert.equal(snitt(1742, 20), 87);
  assert.equal(snitt(0, 0), 0);
});

const RAD = (plats, n, extra) => ({ plats, n, k: "5A", ...extra });

test("test 11: coins = godkända svar, visas efter omgången", () => {
  assert.equal(coinsText(16), "Du fick 16 coins!");
  assert.equal(coinsText(1), "Du fick 1 coin!");
  assert.match(coinsText(0), /Inga coins/);
  const html = resultatHtml({ title: "Sveriges städer" }, {
    result: { typ: "point", s: 1742, max: 2000, n: 20, godkanda: 20 },
    coins: 0, // ett omförsök efter tappat svar – krediteringen har redan skett
    nyttRekord: false, pb: { s: 1800 }, leaderboard: false,
  });
  assert.match(html, /Du fick 20 coins!/);
  assert.match(html, /20 av 20 godkända svar/);
});

test("resultatskärm punkt: total/max, snitt, nytt personbästa, plats och topplista", () => {
  const html = resultatHtml({ title: "Sveriges städer" }, {
    result: { typ: "point", s: 1742, max: 2000, n: 20, godkanda: 18 },
    pb: { typ: "point", s: 1742 }, nyttRekord: true, leaderboard: true,
    top: [RAD(1, "Omar", { s: 1943 }), RAD(1, "Clara", { s: 1943 }), RAD(2, "Du", { s: 1742, jag: true })],
    egen: null, plats: 2, antal: 3,
  });
  assert.match(html, /Superbra jobbat!|Bra jobbat!/);
  assert.match(html, /1742 \/ 2000/);
  assert.match(html, /Snitt: <b>87 p<\/b>\/plats/);
  assert.match(html, /Nytt personbästa!/);
  assert.match(html, /#2<\/b> på skolan/);
  assert.match(html, /Omar, 5A/);
  assert.match(html, /hr-tl-jag/);
  assert.match(html, /data-act="igen"/);
  assert.match(html, /data-act="tillbaka"/);
  assert.match(html, /<svg class="hr-res-bild"/);
  assert.doesNotMatch(html, /\d:\d\d/, "punkt visar aldrig tid");
});

test("test 6: sämre försök – personbästat ligger kvar och visas, inget nytt rekord", () => {
  const html = resultatHtml({ title: "Europas länder – 20" }, {
    result: { typ: "area", r: 15, t: 812, max: 20, n: 20, godkanda: 15 },
    pb: { typ: "area", r: 19, t: 990, max: 20 }, nyttRekord: false, leaderboard: true,
    top: [RAD(1, "Du", { r: 19, t: 990, jag: true })], egen: null, plats: 1, antal: 1,
  });
  assert.match(html, /15 \/ 20 <span>rätt/);
  assert.match(html, /Aktiv tid: <b>1:21<\/b>/);
  assert.doesNotMatch(html, /Nytt personbästa/);
  assert.match(html, /Ditt personbästa: <b>19\/20 rätt – 1:39<\/b>/);
  assert.match(html, /#1<\/b> på skolan <span class="hint">av 1 elev</);
});

test("resultatskärm utan topplista och fel vid sparande", () => {
  const html = resultatHtml({ title: "X" }, { result: { typ: "point", s: 2000, max: 2000, n: 20, godkanda: 20 }, leaderboard: false });
  assert.doesNotMatch(html, /topplista/i);
  assert.equal(rubrik({ typ: "point", s: 2000, max: 2000 }), "Perfekt omgång!");
  assert.equal(rubrik({ typ: "area", r: 3, max: 20 }), "Bra jobbat!");
  assert.match(resultatHtml({ title: "<b>" }, { result: { typ: "point", s: 0, max: 100, n: 1 } }), /&lt;b&gt;/);
  const fel = sparFelHtml({ title: "X" }, "Nätet <svajar>");
  assert.match(fel, /data-act="spara-igen"/);
  assert.match(fel, /Nätet &lt;svajar&gt;/);
});
