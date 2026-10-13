// ============================================================================
// Läsresan (#684, F3 i #668): ingen text i banken får likna en annan för
// mycket. Eleven flyttas ±1 nivå och seenTextIds känner bara igen samma id,
// så en nästan likadan text på en annan nivå skulle komma tillbaka.
// Samma logik som admin/qa-lasresan-varldar-overlapp.mjs (ord-trigram).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { laddaBank, hittaPar, GRANS } from "../admin/qa-lasresan-varldar-overlapp.mjs";

const alla = laddaBank();
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const visa = ({ andel, a, b }) => `${andel.toFixed(2)} ${a.id} (nivå ${a.level}) ↔ ${b.id} (nivå ${b.level})`;

test(`hela banken: inga två texter delar mer än ${GRANS} av ord-trigrammen`, () => {
  const par = hittaPar(alla).filter((p) => p.andel > GRANS);
  assert.deepEqual(par.map(visa), []);
});

test("hela banken: inga dubblerade titlar, på någon nivå", () => {
  const sett = new Map();
  const dubbletter = [];
  for (const t of alla) {
    const k = norm(t.title);
    if (sett.has(k)) dubbletter.push(`"${t.title}": ${sett.get(k)} ↔ ${t.id}`);
    else sett.set(k, t.id);
  }
  assert.deepEqual(dubbletter, []);
});

test("hela banken: 70 texter på nivå 1–3 och 80 på nivå 4–7", () => {
  const per = {};
  for (const t of alla) per[t.level] = (per[t.level] || 0) + 1;
  for (const n of [1, 2, 3]) assert.equal(per[n], 70, `nivå ${n}`);
  for (const n of [4, 5, 6, 7]) assert.equal(per[n], 80, `nivå ${n}`);
});
