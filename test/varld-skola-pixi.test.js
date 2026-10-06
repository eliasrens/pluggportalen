// Issue #421 (S3, epic #396): skolans by-mål bär kamerans EXAKTA fokus
// (data-fokus-x/y = fokusById) och #391-filtret håller dolda byar borta ur
// lagret som Pixi-speglingen läser. Ren sträng-koll – ingen DOM behövs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountOmradeScen, visibleVillageClasses } from "../src/varld-omrade.js";
import profil from "../src/varld-profil-skola.js";

const classes = [
  { id: "4a", name: "4A", by: "Björkby", order: 1, studentIds: ["alva", "bruno"] },
  { id: "4b", name: "4B", by: "Ekdal", order: 2, studentIds: ["gun"] },
  { id: "spec", name: "Specgrupp", by: "Lugna hörnet", order: 3, studentIds: ["pia"] },
  { id: "6a", name: "6A", order: 4, studentIds: ["sam", "tea", "ulf"] },
  { id: "7c", name: "7C", order: 5, studentIds: ["vera"] },
];

const fokusAttr = (html) =>
  Object.fromEntries(
    [...html.matchAll(/data-id="([^"]+)"[^>]*?data-fokus-x="([^"]+)" data-fokus-y="([^"]+)"/g)]
      .map(([, id, x, y]) => [id, { x: parseFloat(x), y: parseFloat(y) }])
  );

test("varje .omrade-by bär data-fokus-x/y som är EXAKT kamerans fokusById", () => {
  const lager = { innerHTML: "" };
  const { fokusById } = mountOmradeScen({ lager, meClassId: "4a", classes });
  const attr = fokusAttr(lager.innerHTML);
  assert.deepEqual(Object.keys(attr).sort(), classes.map((c) => c.id).sort());
  for (const c of classes) assert.deepEqual(attr[c.id], fokusById[c.id], c.id); // bit-exakt
});

test("#391: dold by finns varken som mål eller text i skol-lagret", () => {
  const alla = classes.map((c) => (c.id === "4a" ? { ...c, hiddenVillages: ["spec"] } : c));
  const synliga = visibleVillageClasses(alla, "alva");
  const lager = { innerHTML: "" };
  const { fokusById } = mountOmradeScen({ lager, meClassId: "4a", classes: synliga });
  assert.equal(fokusById.spec, undefined);
  assert.ok(!/data-id="spec"|Specgrupp|Lugna/.test(lager.innerHTML));
  assert.equal(Object.keys(fokusAttr(lager.innerHTML)).length, classes.length - 1);
});

test("profil skola: malSelektor pekar på by-målen med data-fokus, inga ambient", () => {
  assert.equal(profil.id, "skola");
  assert.equal(profil.malSelektor, ".omrade-by[data-fokus-x]");
  assert.equal(profil.objekt, ".omrade-by");
  assert.deepEqual(profil.ambient, []);
  assert.equal(profil.fangst, "stage");
});
