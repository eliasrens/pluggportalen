// ============================================================================
// Veckoschema – lärarsidans sektion (#901, docs/VECKOSCHEMA.md Del C): den rena
// logiken (src/klass-schema-larare.js) – flera dagar på en gång, Ändra/Ta bort,
// nekad krock med ett tydligt besked, raden om läget – plus att sektionen sitter
// i fliken Fokusläge, laddas lat och inte använder tekniska ord.
// Ren Node: node --test test/klass-schema-larare.test.mjs
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  visaTid, lektionText, tidEfter, laggTillLektioner, taBortLektion, veckan, lageRad,
} from "../src/klass-schema-larare.js";
import { SCHEMA_MAX_LEKTIONER, normalizeSchema } from "../src/klass-schema.js";

const utc = (iso) => Date.parse(iso + "Z");
const MAN_0930 = utc("2026-11-23T08:30:00"); // måndag 23 nov 09:30 svensk tid (CET)
const LOR = utc("2026-11-28T09:00:00"); // lördag
const SUBJ = [{ id: "ma", name: "Matte" }, { id: "no", name: "NO" }];
const L = (over = {}) => ({ id: "l1", dag: 1, start: "09:00", slut: "10:00", amne: "no", ...over });
let n = 0;
const slump = () => ((n = (n + 0.137) % 1));
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

describe("texterna", () => {
  it("klockslag som man skriver dem: 8.20, 10.00", () => {
    assert.equal(visaTid("08:20"), "8.20");
    assert.equal(visaTid("10:00"), "10.00");
    assert.equal(lektionText(L(), SUBJ), "NO 9.00–10.00");
    assert.equal(lektionText(L({ amne: "borta" }), SUBJ), "borta 9.00–10.00");
  });
  it("tidEfter räknar fram nästa lektions slut och stannar vid 23.59", () => {
    assert.equal(tidEfter("08:20", 40), "09:00");
    assert.equal(tidEfter("23:30", 60), "23:59");
  });
});

describe("Lägg till lektion", () => {
  it("Matte 8.20–9.00 alla dagar på en gång: fem lektioner med var sitt id, giltiga för normalizeSchema", () => {
    const r = laggTillLektioner([], { amne: "ma", start: "08:20", slut: "09:00", dagar: [1, 2, 3, 4, 5] }, { slump });
    assert.equal(r.fel, undefined);
    assert.deepEqual(r.lektioner.map((l) => l.dag), [1, 2, 3, 4, 5]);
    assert.equal(new Set(r.lektioner.map((l) => l.id)).size, 5);
    const s = normalizeSchema({ pa: true, lektioner: r.lektioner });
    assert.equal(s.lektioner.length, 5, "alla överlever normaliseringen");
  });
  it("tydliga besked: ämne, tider, dagar", () => {
    assert.equal(laggTillLektioner([], { amne: "", start: "08:00", slut: "09:00", dagar: [1] }).fel, "Välj ett ämne.");
    assert.equal(laggTillLektioner([], { amne: "ma", start: "", slut: "09:00", dagar: [1] }).fel, "Skriv in både Från och Till.");
    assert.equal(laggTillLektioner([], { amne: "ma", start: "09:00", slut: "09:00", dagar: [1] }).fel, "Till måste vara senare än Från.");
    assert.equal(laggTillLektioner([], { amne: "ma", start: "09:00", slut: "08:00", dagar: [1] }).fel, "Till måste vara senare än Från.");
    assert.equal(laggTillLektioner([], { amne: "ma", start: "08:00", slut: "09:00", dagar: [] }).fel, "Välj minst en dag.");
    assert.equal(laggTillLektioner([], { amne: "ma", start: "08:00", slut: "09:00", dagar: [6, 7] }).fel, "Välj minst en dag.");
  });
  it("krock nekas med ämne, tid och dag på enkel svenska", () => {
    const r = laggTillLektioner([L()], { amne: "ma", start: "09:30", slut: "10:30", dagar: [1] }, { subjects: SUBJ });
    assert.equal(r.fel, "Lektionen krockar med NO 9.00–10.00 på måndag.");
    const flera = laggTillLektioner([L({ dag: 3 })], { amne: "ma", start: "08:00", slut: "09:30", dagar: [1, 2, 3, 4, 5] }, { subjects: SUBJ });
    assert.equal(flera.fel, "Lektionen krockar med NO 9.00–10.00 på onsdag.", "ingen dag läggs in när en krockar");
  });
  it("slut = nästa start krockar inte", () => {
    const r = laggTillLektioner([L()], { amne: "ma", start: "10:00", slut: "11:00", dagar: [1] }, { slump });
    assert.equal(r.lektioner.length, 2);
  });
  it("taket på lektioner", () => {
    const fulla = Array.from({ length: SCHEMA_MAX_LEKTIONER }, (_, i) =>
      L({ id: `x${i}`, dag: (i % 5) + 1, start: `${String(7 + Math.floor(i / 5)).padStart(2, "0")}:00`, slut: `${String(7 + Math.floor(i / 5)).padStart(2, "0")}:30` }));
    const r = laggTillLektioner(fulla, { amne: "ma", start: "20:00", slut: "21:00", dagar: [1] }, { slump });
    assert.equal(r.fel, `Schemat rymmer högst ${SCHEMA_MAX_LEKTIONER} lektioner.`);
  });
});

describe("Ändra och Ta bort", () => {
  it("Ändra behåller id:t, krockar inte med sig själv och kan flytta dagen", () => {
    const r = laggTillLektioner([L(), L({ id: "l2", start: "10:00", slut: "11:00" })],
      { id: "l1", amne: "ma", start: "09:15", slut: "10:00", dagar: [1] }, { slump });
    assert.deepEqual(r.lektioner[0], { id: "l1", dag: 1, start: "09:15", slut: "10:00", amne: "ma" });
    assert.equal(r.lektioner.length, 2);
    const flytt = laggTillLektioner([L()], { id: "l1", amne: "no", start: "09:00", slut: "10:00", dagar: [4] }, { slump });
    assert.deepEqual(flytt.lektioner.map((l) => [l.id, l.dag]), [["l1", 4]]);
  });
  it("Ändra med fler dagar: den ändrade får första dagen, övriga blir nya lektioner", () => {
    const r = laggTillLektioner([L()], { id: "l1", amne: "no", start: "09:00", slut: "10:00", dagar: [2, 1] }, { slump });
    assert.deepEqual(r.lektioner.map((l) => l.dag), [1, 2]);
    assert.equal(r.lektioner[0].id, "l1");
    assert.notEqual(r.lektioner[1].id, "l1");
  });
  it("Ändra som krockar nekas", () => {
    const r = laggTillLektioner([L(), L({ id: "l2", start: "10:00", slut: "11:00" })],
      { id: "l2", amne: "ma", start: "09:30", slut: "11:00", dagar: [1] }, { subjects: SUBJ });
    assert.equal(r.fel, "Lektionen krockar med NO 9.00–10.00 på måndag.");
  });
  it("Ta bort tar bara den lektionen", () => {
    assert.deepEqual(taBortLektion([L(), L({ id: "l2" })], "l1").map((l) => l.id), ["l2"]);
  });
  it("veckan: lektionerna per dag, sorterade på tid", () => {
    const v = veckan([L({ id: "b", start: "10:00", slut: "11:00" }), L({ id: "a", start: "08:00", slut: "09:00" }), L({ id: "c", dag: 5 })]);
    assert.deepEqual(v[1].map((l) => l.id), ["a", "b"]);
    assert.deepEqual(v[5].map((l) => l.id), ["c"]);
    assert.deepEqual(v[3], []);
  });
});

describe("raden om läget", () => {
  const schema = (over = {}) => ({ pa: true, lektioner: [L()], koppling: {}, ...over });
  it("inte aktiverat / utan lektioner / ingen lektion just nu", () => {
    assert.equal(lageRad(schema({ pa: false }), MAN_0930).text, "Schemat är inte aktiverat – eleverna ser allt som vanligt.");
    assert.equal(lageRad(schema({ lektioner: [] }), MAN_0930).text, "Lägg till lektioner så börjar schemat gälla.");
    assert.equal(lageRad(schema(), LOR).text, "Ingen lektion just nu – eleverna ser allt som vanligt.");
  });
  it("under en lektion: ämnet och sluttiden", () => {
    const r = lageRad(schema(), MAN_0930, { subjects: SUBJ });
    assert.equal(r.text, "Nu: NO till 10.00 – eleverna ser NO.");
    assert.deepEqual(r.delar, { fore: "Nu: ", amne: "NO", efter: " till 10.00 – eleverna ser NO." });
    assert.equal(r.aktiv.id, "l1");
  });
  it("ämne utan valda områden: allt syns, och fokusläget går före", () => {
    assert.equal(lageRad(schema(), MAN_0930, { subjects: SUBJ, filtrerarInget: () => true }).text,
      "Nu: NO till 10.00 – inga områden valda, så eleverna ser allt.");
    assert.equal(lageRad(schema(), MAN_0930, { fokus: true }).text, "Fokusläget är på – det gäller före schemat just nu.");
  });
});

describe("sektionen på lärarsidan", () => {
  it("ligger längst ned i fliken Fokusläge, under låset, och laddas med import()", () => {
    const sek = src("teacher-classes-sections.js");
    const fokus = sek.slice(sek.indexOf('key: "fokus"'), sek.indexOf('key: "klasscenter"'));
    assert.match(fokus, /host\.replaceChildren\(lockEl, schemaEl\)/);
    assert.match(fokus, /import\("\.\/teacher-class-schema\.js"\)/);
    assert.doesNotMatch(sek, /^import .*(teacher-class-schema|klass-schema)/m);
  });
  it("ingen ny flik: Mina klasser har samma fyra flikar", () => {
    assert.equal((src("teacher-mina-val.js").match(/key: "fokus", label: "Fokusläge"/g) || []).length, 1);
    assert.doesNotMatch(src("teacher-mina-val.js"), /Veckoschema/);
  });
  it("texterna har inga tekniska ord (filter, grind, koppling)", () => {
    const ui = src("teacher-class-schema.js");
    const synligt = [...ui.matchAll(/>([^<>{}$`]+)</g), ...ui.matchAll(/"([A-ZÅÄÖ][^"]{6,})"/g)].map((m) => m[1]).join(" | ");
    assert.doesNotMatch(synligt, /\b(filter|grind|koppling)/i, synligt);
    assert.doesNotMatch(src("klass-schema-larare.js").match(/(fel|text): `[^`]*`|"[^"]*"/g).join(" "), /\b(filter|grind|koppling)/i);
  });
  it("klassväljaren visar 📅 efter 🔒 utan att ladda schemats moduler", () => {
    const mk = src("teacher-mina-klasser.js");
    assert.match(mk, /"🔒 " : ""\}\$\{schemaPa\(c\) \? "📅 " : ""\}/);
    assert.match(mk, /\$\{lasIkon\(c, now\)\}\$\{schemaIkon\(c\)\}/);
    assert.doesNotMatch(mk, /import[^\n]*klass-schema/);
  });
  it("ingen ny fil i den statiska bootgrafen (#271)", () => {
    const graf = execFileSync(process.execPath, ["admin/qa-bootgraf-bfs.mjs"], { encoding: "utf8" }).split("\n").filter(Boolean);
    assert.ok(graf.length > 50, "bootgrafen hittades");
    for (const f of ["klass-schema", "teacher-class-schema", "data-class-schema"])
      assert.ok(!graf.some((g) => g.includes(f)), `${f} nås bara med import()`);
  });
});
