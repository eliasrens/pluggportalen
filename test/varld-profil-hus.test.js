// Profil "hus" (#419, S1 i epic #396): selektorerna måste träffa det husScen/
// kompisHusHtml faktiskt ritar – annars tappar Pixi-speglingen tyst ambient-
// noderna (invalidering) eller hover-överlägget. Vakt mot namnbyten i konsten.
import { test } from "node:test";
import assert from "node:assert/strict";
import profil from "../src/varld-profil-hus.js";
import { husScen, listHusSkal } from "../src/art-hus-ute.js";

const klass = (sel) => sel.match(/^\.([\w-]+)$/)?.[1];
const harKlass = (markup, k) => new RegExp(`class="(?:[^"]* )?${k}(?: [^"]*)?"`).test(markup);

test("formatet följer §2.4 (id, fångst stage, inga sprites)", () => {
  assert.equal(profil.id, "hus");
  assert.equal(profil.fangst, "stage");
  assert.deepEqual(profil.sprites, []);
  for (const f of ["ambient", "objekt", "ignorera"]) assert.ok(Array.isArray(profil[f]), f);
});

test("ambient = moln, solstrålar och rök – och de finns i husScen", () => {
  assert.deepEqual([...profil.ambient].sort(), [".hus-moln", ".hus-rok", ".hus-solstralar"]);
  const ute = husScen("", { skylt: { rad1: "4B" } });
  for (const s of [".hus-moln", ".hus-solstralar"]) assert.ok(harKlass(ute, klass(s)), s);
  assert.ok(harKlass(ute, "hus-rok"), "stugan har skorstensrök");
});

test("inga objekt-överlägg: hover bakas in i den omspeglade basen (avataren ligger framför huset)", () => {
  assert.deepEqual(profil.objekt, []);
  // Förutsättningen för beslutet: avataren (FO) ritas EFTER husgruppen i husScen.
  const ute = husScen("", { skylt: { rad1: "4B" } });
  assert.ok(ute.indexOf('id="husgrupp"') < ute.indexOf('id="ute-avatar"'));
});

test("varje husskal ur alla register ritar #husgrupp och rör inte ambient-klasserna", () => {
  const skal = listHusSkal();
  assert.ok(skal.length >= 30, `${skal.length} skal`);
  for (const { id: skalId } of skal) {
    const m = husScen("", { skalId });
    assert.ok(m.includes('id="husgrupp"'), skalId);
    assert.ok(harKlass(m, "hus-moln") && harKlass(m, "hus-solstralar"), skalId);
  }
});

test("F6 #432: neutralisera = husgruppen + klasskylten (även kompis-/grannbyhusets prefix)", () => {
  const sel = profil.neutralisera.join(",");
  const slutar = (id) => profil.neutralisera.some((s) => id.endsWith(s.match(/\$="(.+)"/)[1]));
  for (const id of ["husgrupp", "kompis-husgrupp", "grannbyhus-husgrupp", "klasskylt"]) assert.ok(slutar(id), id);
  assert.ok(!/garden|tradgard/.test(sel), "trädgårdssakerna saknar hover-stil");
});
