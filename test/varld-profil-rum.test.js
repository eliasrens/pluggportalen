// Rum-profilen för Pixi-rörelsen (#422, S4 i epic #396) + speglingens
// bild-nedskalning. DOM-delarna (spegling, sprites, handoff) verifieras i
// preview-pixi-rum.html.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import profil from "../src/varld-profil-rum.js";
import { trappsteg, bildData } from "../src/varld-spegel-ut.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const las = (f) => readFileSync(resolve(SRC, f), "utf8");
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

test("profilen: rum, fångst lager, bilder i visad storlek", () => {
  assert.equal(profil.id, "rum");
  assert.equal(profil.fangst, "lager", "rum-boxen = hela staget");
  assert.equal(profil.bildZoom, 1, "rummet visas aldrig förstorat (inre roll i T3)");
  assert.equal(profil.malSelektor, null);
});

test("husdjuren + det som ligger OVANPÅ dem i DOM:en är sprites; molnen är ambient", () => {
  assert.deepEqual(lista(profil.sprites), [".room-pet", ".rum-dorr", ".rum-lista"]);
  const amb = lista(profil.ambient);
  assert.ok(amb.includes(".rum-moln"), "molnen bakas in frusna (spröjsen ritas ovanpå dem)");
  assert.ok(amb.includes(".room-pet"), "promenadens left/top ska inte smutsa lagret");
  assert.ok(!lista(profil.sprites).includes(".rum-moln"));
  assert.ok(!lista(profil.sprites).includes(".room-apple"), "äpplena ligger under djuren → basen");
  assert.deepEqual(lista(profil.ignorera), [], "allt i lagret syns i vila");
});

test("profilens klasser finns i markupen som rummet faktiskt ritar", () => {
  const kalla = {
    "room-pet": ["pages-rum-pets.js", "varld-rum-djur.js"],
    "rum-dorr": ["varld-rum-vaxlare.js"],
    "rum-lista": ["varld-rum-vaxlare.js"],
    "rum-moln": ["art-room.js"],
  };
  for (const [klass, filer] of Object.entries(kalla)) {
    for (const f of filer) assert.match(las(f), new RegExp(`class="[^"]*\\b${klass}\\b`), `${klass} i ${f}`);
  }
  // Z-ordningen som sprite-valet bygger på: äpplen före djur, dörrar/lista sist.
  const rum = las("varld-rum.js");
  const i = (s) => rum.indexOf(s, rum.indexOf("function renderStage()"));
  assert.ok(i("appleNode(apple)") < i("petStageNode(pet"), "äpplen ritas före djuren");
  assert.ok(i("djur.stageNode(a") < i("vaxlare.listBar"), "dörrar/lista efter djuren");
});

test("profilen ligger utanför bootgrafen (laddas bara via import())", () => {
  for (const f of ["app.js", "pages-varld.js", "varld-rum.js", "varld-kamera.js"]) {
    assert.ok(!/varld-profil-rum/.test(las(f)), f);
  }
  assert.ok(!/^\s*import\s/m.test(las("varld-profil-rum.js")), "profilen importerar ingenting");
});

test("trappsteg: √2-trappa uppåt, golv 16 px, aldrig mindre än begärt", () => {
  assert.equal(trappsteg(1), 16);
  assert.equal(trappsteg(16), 16);
  assert.equal(trappsteg(17), 23);
  assert.equal(trappsteg(30), 32);
  assert.equal(trappsteg(33), 46);
  let forra = 0;
  for (let px = 1; px <= 2000; px++) {
    const t = trappsteg(px);
    assert.ok(t >= px, `${px} → ${t}`);
    assert.ok(t <= Math.max(16, px * Math.SQRT2) + 1, `${px} → ${t} högst √2 större`);
    assert.ok(t >= forra);
    forra = t;
  }
  // Andning/gupp (±3 %) mitt i ett steg ger samma steg → cache-träff.
  assert.equal(trappsteg(38 * 0.97), trappsteg(38 * 1.03));
});

test("bildData: utan <img>/storlek eller vid data-URL → oförändrad bild", async () => {
  const d = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(await bildData({ url: d }), d);
  assert.equal(await bildData({ url: d, bredd: 20, img: { naturalWidth: 400, naturalHeight: 300 } }), d);
});
