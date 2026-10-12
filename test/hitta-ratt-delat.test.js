// ============================================================================
// Hitta rätt! (#609): de DELADE rena modulerna – poäng, ranking, personbästa,
// omgångsräkning – och 🏆-vyns HTML. Samma kod körs på servern
// (functions/hitta-ratt/ = genererad kopia, drift fälls här).
//
//   test 3   punkt-topplista: lika poäng = delad plats, ingen tid
//   test 5   område: fler rätt först, sedan tid – 43/44 aldrig över 44/44
//   test 6   personbästa: ett sämre försök skriver aldrig över
//   test 10  Top 15 + egen rad, aldrig dubbelt
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { poang, nollKm, avstandKm } from "../src/hitta-ratt/delat/poang.js";
import { jamfor, battre, rangordna, topplista, ledare, matt, TOPP_N } from "../src/hitta-ratt/delat/rank.js";
import { raknaOmgang, HrFel } from "../src/hitta-ratt/delat/omgang.js";
import { avstandKm as kartansAvstand } from "../src/hitta-ratt/karta/projektion.js";
import { radText, topplistaHtml, topplistorVyHtml, egenSammanfattning } from "../src/hitta-ratt/hr-topplista-vy.js";
import { formatTid } from "../src/hitta-ratt/hr-start-vy.js";
import { driftedFiles, packFacit } from "../admin/sync-hitta-ratt-functions.mjs";

const SV = { fullKm: 5, halvKm: 90 };

test("poäng: arkitekturens tabell (§5) och monotont icke-växande", () => {
  const rad = [10, 20, 40, 75, 100, 150, 200, 300, 500].map((km) => poang(km, SV));
  assert.deepEqual(rad, [99, 95, 83, 60, 44, 21, 9, 1, 0]);
  assert.equal(poang(40, { fullKm: 25, halvKm: 600 }), 100, "40 km fel på världskartan = 100 p");
  assert.equal(poang(90, SV), 50);
  let forra = 100;
  for (let km = 0; km <= 5000; km += 0.5) {
    const p = poang(km, SV);
    assert.ok(p <= forra && p >= 0 && p <= 100);
    forra = p;
  }
  assert.equal(nollKm(SV), 335);
});

test("avstandKm är samma haversine som kartmotorns", () => {
  for (const [a, b] of [[[18.07, 59.33], [11.97, 57.71]], [[2.35, 48.86], [-0.13, 51.51]], [[179, 0], [-179, 0]]]) {
    assert.equal(avstandKm(a, b), kartansAvstand(a, b));
  }
});

test("test 3: punkt – lika poäng delar plats (tät 1, 1, 2), tiden används aldrig", () => {
  const e = {
    omar: { n: "Omar", k: "5E", s: 1943, t: 999 },
    clara: { n: "Clara", k: "5A", s: 1943, t: 1 },
    alma: { n: "Alma", k: "5E", s: 1928 },
  };
  const r = rangordna(e, "point");
  assert.deepEqual(r.map((x) => [x.n, x.plats]), [["Clara", 1], ["Omar", 1], ["Alma", 2]]);
  assert.equal(jamfor(e.omar, e.clara, "point"), 0, "tiden påverkar inte");
  assert.deepEqual(ledare(e, "point"), ["clara", "omar"], "delad etta = två ledare");
  assert.equal(radText(r[1], "point", 2000), "Omar, 5E – 1943 p");
  const html = topplistaHtml({ typ: "point", ...topplista(e, "point", "alma") }, 20);
  assert.doesNotMatch(html, /\d:\d\d/, "ingen tid visas på punktlistan");
  assert.match(html, /Omar, 5E/);
});

test("test 5: område – fler rätt först, sedan tid; 43/44 aldrig över 44/44", () => {
  const e = {
    a: { n: "Elev A", k: "5A", r: 44, t: 1050 }, // 1:45
    b: { n: "Elev B", k: "5B", r: 44, t: 990 }, // 1:39
    c: { n: "Elev C", k: "5C", r: 43, t: 600 }, // 1:00
  };
  const r = rangordna(e, "area");
  assert.deepEqual(r.map((x) => [x.uid, x.plats]), [["b", 1], ["a", 2], ["c", 3]]);
  assert.equal(radText(r[0], "area", 44), "Elev B, 5B – 44/44 rätt – 1:39");
  assert.equal(radText(r[2], "area", 44), "Elev C, 5C – 43/44 rätt – 1:00");
  // Exakt lika (rätt och tiondelar) = delad plats.
  const lika = rangordna({ x: { r: 10, t: 500 }, y: { r: 10, t: 500 }, z: { r: 10, t: 501 } }, "area");
  assert.deepEqual(lika.map((x) => x.plats), [1, 1, 2]);
});

test("test 6: personbästa – sämre/lika ersätter aldrig, bättre gör det", () => {
  const p = { s: 1700 };
  assert.equal(battre({ s: 1699 }, p, "point"), false);
  assert.equal(battre({ s: 1700 }, p, "point"), false, "lika är inte bättre");
  assert.equal(battre({ s: 1701 }, p, "point"), true);
  assert.equal(battre({ s: 1 }, null, "point"), true, "första försöket");
  const o = { r: 24, t: 1180 };
  assert.equal(battre({ r: 23, t: 100 }, o, "area"), false, "snabbare men färre rätt");
  assert.equal(battre({ r: 24, t: 1180 }, o, "area"), false);
  assert.equal(battre({ r: 24, t: 1181 }, o, "area"), false);
  assert.equal(battre({ r: 24, t: 1179 }, o, "area"), true);
  assert.equal(battre({ r: 25, t: 9999 }, o, "area"), true);
  assert.deepEqual(matt({ s: 5, r: 3, t: 9 }, "point"), { s: 5 }, "punkt sparar ingen tid");
});

test("test 10: Top 15 + egen rad – aldrig dubbelt; delad plats på rad 15 följer med", () => {
  const e = {};
  for (let i = 0; i < 40; i++) e[`u${i}`] = { n: `Elev${String(i).padStart(2, "0")}`, k: "5A", s: 2000 - i * 10 };
  const ute = topplista(e, "point", "u36");
  assert.equal(ute.top.length, TOPP_N);
  assert.equal(ute.egen.uid, "u36");
  assert.equal(ute.plats, 37);
  assert.equal(radText(ute.egen, "point"), "Elev36, 5A – 1640 p");
  const inne = topplista(e, "point", "u3");
  assert.equal(inne.egen, null, "i Top 15 → ingen extra rad");
  assert.equal(inne.plats, 4);
  const html = topplistaHtml({ typ: "point", ...inne }, 20);
  assert.equal(html.match(/Elev03/g).length, 1, "eleven syns en gång");
  const htmlUte = topplistaHtml({ typ: "point", ...ute, egen: { ...ute.egen, jag: true } }, 20);
  assert.match(htmlUte, /hr-tl-egen[\s\S]*Elev36/);
  assert.match(egenSammanfattning({ typ: "point", ...ute, egen: { ...ute.egen, jag: true } }), /Plats <b>37<\/b> av 40/);
  // Delad plats mellan rad 15 och 16 → båda visas.
  e.u15.s = e.u14.s;
  assert.equal(topplista(e, "point", null).top.length, 16);
});

test("område: tiondelar bara när två rader annars ser lika ut", () => {
  assert.equal(formatTid(992), "1:39");
  assert.equal(formatTid(999), "1:39", "stoppur – avrundar inte uppåt");
  assert.equal(formatTid(992, true), "1:39,2");
  const lista = { typ: "area", top: [{ plats: 1, n: "A", k: "5A", r: 4, t: 992 }, { plats: 2, n: "B", k: "5A", r: 4, t: 995 }, { plats: 3, n: "C", k: "5A", r: 4, t: 1200 }], egen: null };
  const html = topplistaHtml(lista, 4);
  assert.match(html, /1:39,2/);
  assert.match(html, /1:39,5/);
  assert.match(html, /2:00</);
});

test("🏆-vyn: knappar per pack, vald markerad, ingen klassflik", () => {
  const grupper = [{ id: "sverige", namn: "Sverige", ikon: "🌲", pack: [{ id: "sverige-stader", title: "Sveriges städer", type: "point", antal: 20 }, { id: "sverige-lan", title: "Sveriges län", type: "area", antal: 21 }] }];
  const html = topplistorVyHtml(grupper, "sverige-lan", { typ: "area", top: [], egen: null, plats: null, antal: 0 });
  assert.match(html, /data-pack="sverige-lan" aria-pressed="true"/);
  assert.match(html, /data-pack="sverige-stader" aria-pressed="false"/);
  assert.match(html, /bli först/);
  assert.doesNotMatch(html, /[Kk]lasslista|[Kk]lass-topplista/);
  assert.match(topplistorVyHtml(grupper, null), /Välj en karta/);
});

const PUNKT = { id: "p", typ: "point", cfg: SV, items: [{ id: "gavle", lat: 60.6749, lon: 17.1413 }, { id: "kiruna", lat: 67.8558, lon: 20.2253 }] };
const OMR = { id: "o", typ: "area", cfg: { minMsPerFraga: 700 }, items: [{ id: "skane", omrade: "o9" }, { id: "blekinge", omrade: "o16" }], omraden: ["o9", "o16", "o3"] };
const fel = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof HrFel, String(e));
    return e.code;
  }
  return "ok";
};

test("omgång punkt: räknas om ur svaren; godkända = > 0 p", () => {
  const r = raknaOmgang(PUNKT, [{ itemId: "kiruna", lon: 15, lat: 56 }, { itemId: "gavle", lon: 17.1413, lat: 60.6749 }]);
  assert.equal(r.s, 100);
  assert.equal(r.max, 200);
  assert.equal(r.godkanda, 1);
  assert.equal(r.fragor.find((f) => f.id === "gavle").p, 100);
});

test("omgång: halva packen, dubbletter, okända frågor, trasiga koordinater nekas", () => {
  assert.equal(fel(() => raknaOmgang(PUNKT, [{ itemId: "gavle", lon: 17, lat: 60 }])), "invalid-argument");
  assert.equal(fel(() => raknaOmgang(PUNKT, [{ itemId: "gavle", lon: 17, lat: 60 }, { itemId: "gavle", lon: 17, lat: 60 }])), "invalid-argument");
  assert.equal(fel(() => raknaOmgang(PUNKT, [{ itemId: "gavle", lon: 17, lat: 60 }, { itemId: "malmo", lon: 17, lat: 60 }])), "invalid-argument");
  assert.equal(fel(() => raknaOmgang(PUNKT, [{ itemId: "gavle", lon: 17, lat: 91 }, { itemId: "kiruna", lon: 17, lat: 60 }])), "invalid-argument");
  assert.equal(fel(() => raknaOmgang(PUNKT, [{ itemId: "gavle", lon: NaN, lat: 1 }, { itemId: "kiruna", lon: "17", lat: 60 }])), "invalid-argument");
  assert.equal(fel(() => raknaOmgang(PUNKT, "alla rätt")), "invalid-argument");
});

test("omgång område: rätt/fel, tid i tiondelar, tidsfusk nekas", () => {
  const start = 1_000_000;
  const svar = [{ itemId: "skane", omrade: "o9", ms: 4000 }, { itemId: "blekinge", omrade: "o3", ms: 3050 }];
  const r = raknaOmgang(OMR, svar, { startMs: start, nuMs: start + 60_000 });
  assert.deepEqual([r.r, r.t, r.max, r.godkanda], [1, 71, 2, 1]);
  assert.equal(fel(() => raknaOmgang(OMR, [svar[0], { ...svar[1], ms: 300 }], { startMs: start, nuMs: start + 60_000 })), "failed-precondition", "under 700 ms");
  assert.equal(fel(() => raknaOmgang(OMR, svar, { startMs: start, nuMs: start + 3000 })), "failed-precondition", "Σms > verklig tid");
  assert.equal(fel(() => raknaOmgang(OMR, [svar[0], { ...svar[1], omrade: "o99" }], { startMs: start, nuMs: start + 60_000 })), "invalid-argument", "okänt område");
  assert.equal(fel(() => raknaOmgang(OMR, [svar[0], { ...svar[1], ms: 1000.5 }], { startMs: start, nuMs: start + 60_000 })), "invalid-argument");
});

test("functions/hitta-ratt/ är synkad med src (kör npm run sync:hitta-ratt)", () => {
  assert.deepEqual(driftedFiles(), []);
  const f = packFacit();
  assert.equal(Object.keys(f).length, 12);
  assert.ok(Object.values(f).every((p) => p.leaderboard && p.items.length >= 20));
  assert.ok(f["sverige-landskap"].items.every((it) => f["sverige-landskap"].omraden.includes(it.omrade)));
  assert.ok(!JSON.stringify(f["sverige-stader"]).includes("Gävle"), "facit bär inga namn");
});
