// ============================================================================
// Hitta rätt! – klickringsregeln (#639). Ingen DOM.
// Körs med: node --test test/hitta-ratt-ringar.test.js
// Täcker ringregel.js (flagga ur verklig yta + px-tröskel) och att geodatan
// som byggskriptet skrev följer regeln: bara mikrostater och små önationer
// kan få ring, normalstora länder aldrig.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { RING_KM2, LITEN_PX, litenSida, visaRing } from "../src/hitta-ratt/karta/ringregel.js";

const geo = (id) => JSON.parse(readFileSync(new URL(`../src/hitta-ratt/content/geo/${id}.json`, import.meta.url), "utf8"));
const nycklar = (id) => JSON.parse(readFileSync(new URL(`../src/hitta-ratt/content/geo/${id}.nycklar.json`, import.meta.url), "utf8"));
/** Nycklarna (t.ex. "MLT") för områden som kan få ring. */
function ringbara(id) {
  const g = geo(id), n = nycklar(id);
  const namn = Object.fromEntries(Object.entries(n).map(([k, v]) => [v, k]));
  return new Set(g.omraden.filter((o) => o.liten != null).map((o) => namn[o.id]));
}

test("litenSida: under RING_KM2 → sida i kartenheter, annars null", () => {
  const s = 0.5; // kartenheter per km
  const yta = (km2) => km2 * s * s;
  assert.equal(litenSida(yta(RING_KM2), s), null);
  assert.equal(litenSida(yta(30000), s), null); // Belgien
  assert.equal(litenSida(yta(316), s), +Math.sqrt(yta(316)).toFixed(1)); // Malta
  assert.equal(litenSida(0, s), 0.1, "under en kartenhet (Vatikanen) får ändå ring");
  assert.equal(litenSida(NaN, s), null);
});

test("visaRing: bara med flagga, och bara när sidan är under LITEN_PX", () => {
  assert.equal(visaRing({}, 0.001), false, "utan flagga aldrig ring, hur utzoomat som helst");
  assert.equal(visaRing({ liten: 10 }, (LITEN_PX - 0.1) / 10), true);
  assert.equal(visaRing({ liten: 10 }, LITEN_PX / 10), false, "vid tröskeln är området stort nog");
  assert.equal(visaRing({ liten: 10 }, 5), false, "inzoomat: ingen ring");
  assert.equal(visaRing(null, 1), false);
});

test("geodata: mikrostater och små önationer kan få ring, normalstora länder aldrig", () => {
  const eu = ringbara("europa");
  for (const k of ["MLT", "LUX", "AND", "VAT", "SMR", "MCO", "LIE"]) assert.ok(eu.has(k), `Europa: ${k} ska kunna få ring`);
  for (const k of ["BEL", "NLD", "CHE", "DNK", "SVN", "ALB"]) assert.ok(!eu.has(k), `Europa: ${k} får aldrig ring`);
  const va = ringbara("varlden");
  for (const k of ["JAM", "BHS", "FJI", "VUT", "SLB", "BRN", "QAT"]) assert.ok(va.has(k), `Världen: ${k} ska kunna få ring`);
  for (const k of ["BEL", "NLD", "ISR", "RWA", "CHE", "DNK", "SVN"]) assert.ok(!va.has(k), `Världen: ${k} får aldrig ring`);
  assert.ok(va.size <= 15, `Världen: högst 15 ringbara områden (${va.size})`);
});

test("geodata: Sverige får högst en ring (Öland) även på en smal karta", () => {
  for (const id of ["sverige-landskap", "sverige-lan"]) {
    const g = geo(id);
    const k = 400 / g.proj.hojd; // helvy i en 400 px hög karta (spelvyns minsta ≈ 320)
    const n = g.omraden.filter((o) => visaRing(o, k)).length;
    assert.ok(n <= 1, `${id}: ${n} ringar`);
  }
});
