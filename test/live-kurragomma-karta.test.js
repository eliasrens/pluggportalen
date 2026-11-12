// ============================================================================
// Kurragömma (#836): kartan Ön och geometrin – skydd, kollision, giltigt
// gömställe, närmaste giltiga punkt och platsnamn (spec §13.1). Ren node.
// Reglerna (sökning, visslingar, poäng): live-kurragomma-regler.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ON, KARTOR, hamtaKarta } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import {
  skydd, skyddText, kollidera, innanforOn, giltigtGomstalle, narmasteGiltiga, platsNamn, gomstalleNaraForemal, avstand,
} from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { FIGUR_RADIE_M, SKYDD_BRA_M, SKYDD_OKEJ_M, SKYDD_TEXT, PLATS_ANGEN } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";

/** En liten testkarta: ett buskage i mitten och en sten till höger. */
const TEST = {
  id: "test", radie: 30, sokarStart: { x: -5, z: 0 }, gomStart: [],
  foremal: [
    { id: "b", typ: "buskage", namn: "buskaget", x: 0, z: 0, rot: 0, r: 2, fast: 0, lov: true },
    { id: "s", typ: "sten", namn: "stenen", x: 10, z: 0, rot: 0, r: 2, fast: 1.5, lov: false },
    { id: "d", typ: "blommor", namn: null, x: -10, z: 0, rot: 0, r: 0, fast: 0, lov: false },
  ],
};

const fast = ON.foremal.filter((f) => f.fast > 0);
const brunn = ON.foremal.find((f) => f.typ === "brunn");

describe("kartan Ön (spec §2.1)", () => {
  it("är data: radie 30, minst 30 föremål med alla fält, unika id", () => {
    assert.equal(ON.radie, 30);
    assert.equal(hamtaKarta("on"), ON);
    assert.equal(hamtaKarta("finns-inte"), ON);
    assert.deepEqual(Object.keys(KARTOR), ["on"]);
    assert.ok(ON.foremal.length >= 30, `${ON.foremal.length} föremål`);
    assert.ok(ON.foremal.filter((f) => f.r > 0).length >= 30, "minst 30 föremål som ger skydd");
    assert.equal(new Set(ON.foremal.map((f) => f.id)).size, ON.foremal.length);
    for (const f of ON.foremal) {
      for (const k of ["id", "typ", "x", "z", "rot", "r", "fast"]) assert.ok(k in f, `${f.id}.${k}`);
      assert.equal(typeof f.lov, "boolean", f.id);
      assert.ok(f.namn === null || typeof f.namn === "string", f.id);
      assert.ok(f.fast <= f.r || f.r === 0, `${f.id}: fast ≤ r`);
    }
  });

  it("har föremålen i spec §2.1, och lov är buskage, höstack, granen och eken", () => {
    const typer = new Set(ON.foremal.map((f) => f.typ));
    for (const t of ["lada", "hostack", "sten", "gran", "ek", "trad", "buskage", "bro", "damm", "brunn",
      "vedtrave", "vagn", "tunnor", "talt", "staket", "blommor", "moln"]) assert.ok(typer.has(t), t);
    const lov = new Set(ON.foremal.filter((f) => f.lov).map((f) => f.typ));
    assert.deepEqual([...lov].sort(), ["buskage", "ek", "gran", "hostack"]);
  });

  it("alla föremål ligger inom ön", () => {
    for (const f of ON.foremal) {
      const ytter = Math.max(f.r, f.fast, f.yta ?? 0);
      assert.ok(Math.hypot(f.x, f.z) + ytter <= ON.radie, `${f.id} sticker ut`);
    }
  });

  it("fasta föremål överlappar inte: minst en figurbredd mellan dem och till strandkanten", () => {
    const passage = 2 * FIGUR_RADIE_M;
    for (let i = 0; i < fast.length; i++) {
      const a = fast[i];
      assert.ok(ON.radie - Math.hypot(a.x, a.z) - a.fast >= passage, `${a.id} för nära kanten`);
      for (const b of fast.slice(i + 1)) {
        assert.ok(avstand(a, b) - a.fast - b.fast >= passage, `${a.id} och ${b.id} för tätt`);
      }
    }
  });

  it("man kan inte fastna: varje fri punkt på ön nås till fots från brunnen", () => {
    const STEG = 0.25;
    const N = Math.round((2 * ON.radie) / STEG) + 1;
    const fri = (i, j) => {
      const x = -ON.radie + i * STEG;
      const z = -ON.radie + j * STEG;
      if (Math.hypot(x, z) > ON.radie - FIGUR_RADIE_M) return false;
      return fast.every((f) => Math.hypot(x - f.x, z - f.z) >= f.fast + FIGUR_RADIE_M);
    };
    const sedd = new Uint8Array(N * N);
    const i0 = Math.round((ON.sokarStart.x + ON.radie) / STEG);
    const j0 = Math.round((ON.sokarStart.z + ON.radie) / STEG);
    assert.ok(fri(i0, j0));
    const ko = [[i0, j0]];
    sedd[i0 * N + j0] = 1;
    while (ko.length) {
      const [i, j] = ko.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N || sedd[a * N + b] || !fri(a, b)) continue;
        sedd[a * N + b] = 1;
        ko.push([a, b]);
      }
    }
    let ejNadd = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (fri(i, j) && !sedd[i * N + j]) ejNadd++;
    assert.equal(ejNadd, 0, `${ejNadd} fria punkter går inte att nå`);
  });

  it("startplatserna: gömmarna i kanten vända inåt, sökarna vid brunnen – alla giltiga", () => {
    assert.ok(ON.gomStart.length >= 30, "en plats per elev i en stor klass");
    for (const p of ON.gomStart) {
      assert.ok(giltigtGomstalle(p.x, p.z), `${p.x},${p.z}`);
      assert.ok(Math.hypot(p.x, p.z) >= ON.radie - 5, "i kanten");
      const inat = (Math.sin(p.yaw) * -p.x + Math.cos(p.yaw) * -p.z) / Math.hypot(p.x, p.z);
      assert.ok(inat > 0.999, "vänd inåt");
    }
    assert.ok(giltigtGomstalle(ON.sokarStart.x, ON.sokarStart.z));
    assert.ok(avstand(ON.sokarStart, brunn) <= 5, "vid brunnen");
    assert.ok(Math.hypot(brunn.x, brunn.z) <= 6, "brunnen mitt på ön");
  });
});

describe("skydd (spec §2.3)", () => {
  it("inne i ett lov-föremål → 3, ända ut till kanten", () => {
    assert.equal(skydd(0, 0, TEST), 3);
    assert.equal(skydd(1.2, -0.5, TEST), 3);
    assert.equal(skydd(2, 0, TEST), 3);
  });
  it("nära kanten (≤ 0,6 m) → 2, ≤ 2 m → 1, längre bort → 0", () => {
    assert.equal(skydd(2 + SKYDD_BRA_M, 0, TEST), 2, "precis utanför buskaget");
    assert.equal(skydd(12 + 0.5, 0, TEST), 2, "vid stenen");
    assert.equal(skydd(12 + SKYDD_BRA_M + 0.01, 0, TEST), 1);
    assert.equal(skydd(12 + SKYDD_OKEJ_M, 0, TEST), 1);
    assert.equal(skydd(12 + SKYDD_OKEJ_M + 0.01, 0, TEST), 0);
    assert.equal(skydd(0, 20, TEST), 0, "långt från allt");
  });
  it("inne i ett föremål som inte är lov ger 2, inte 3", () => {
    assert.equal(skydd(11.8, 0, TEST), 2);
  });
  it("föremål med r = 0 (blommor, dammen, moln) ger inget skydd", () => {
    assert.equal(skydd(-10, 0, TEST), 0);
    const damm = ON.foremal.find((f) => f.typ === "damm");
    assert.equal(damm.r, 0);
  });
  it("på Ön: i buskaget 3, vid ladans vägg 2, ute på ängen 0", () => {
    const busk = ON.foremal.find((f) => f.id === "buske-1");
    const lada = ON.foremal.find((f) => f.id === "lada");
    assert.equal(skydd(busk.x, busk.z), 3);
    assert.equal(skydd(lada.x, lada.z + lada.fast + 0.1), 2);
    assert.equal(skydd(0, -27), 0);
  });
  it("texterna", () => {
    assert.deepEqual([0, 1, 2, 3].map(skyddText), SKYDD_TEXT);
    assert.equal(skyddText(0), "Syns lätt");
    assert.equal(skyddText(3), "Mycket bra gömställe");
    assert.equal(skyddText(9), "Mycket bra gömställe");
  });
});

describe("kollidera (spec §2.3)", () => {
  it("knuffar ut ur ett fast föremål, i samma riktning", () => {
    const p = kollidera(10.5, 0.2, TEST);
    assert.ok(Math.hypot(p.x - 10, p.z) >= 1.5);
    assert.ok(Math.hypot(p.x - 10, p.z) < 1.6);
    assert.ok(p.x > 10 && p.z > 0);
  });
  it("en punkt mitt i föremålet knuffas ut (åt +x)", () => {
    const p = kollidera(10, 0, TEST);
    assert.ok(p.x > 11.5 && Math.abs(p.z) < 1e-9);
  });
  it("går igenom lov-föremål och föremål utan fast", () => {
    assert.deepEqual(kollidera(0.3, 0.3, TEST), { x: 0.3, z: 0.3 });
    assert.deepEqual(kollidera(-10, 0, TEST), { x: -10, z: 0 });
  });
  it("håller platsen inom ön", () => {
    const p = kollidera(40, 30, TEST);
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - 30) < 1e-9);
    assert.ok(p.x / p.z - 40 / 30 < 1e-9, "samma riktning");
  });
  it("på Ön: 2000 slumpade punkter (även utanför) blir alltid giltiga", () => {
    const rng = skapaPrng("kollidera");
    for (let i = 0; i < 2000; i++) {
      const p = kollidera(rng.mellan(-36, 36), rng.mellan(-36, 36));
      assert.ok(giltigtGomstalle(p.x, p.z), `${p.x},${p.z}`);
    }
    for (const f of fast) {
      const p = kollidera(f.x + 0.01, f.z);
      assert.ok(giltigtGomstalle(p.x, p.z), f.id);
    }
  });
  it("tål trasig indata", () => {
    const p = kollidera(NaN, undefined);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  });
});

describe("giltigtGomstalle och narmasteGiltiga (spec §1.2, §2.3)", () => {
  it("nekar utanför ön, inuti fasta föremål och trasiga tal", () => {
    assert.equal(giltigtGomstalle(31, 0, TEST), false);
    assert.equal(giltigtGomstalle(30, 0, TEST), true, "precis vid strandkanten");
    assert.equal(giltigtGomstalle(10.5, 0, TEST), false);
    assert.equal(giltigtGomstalle(10, 1.49, TEST), false);
    assert.equal(giltigtGomstalle(NaN, 0, TEST), false);
    assert.equal(giltigtGomstalle(0, 0, TEST), true, "inne i buskaget är okej");
    assert.equal(innanforOn(0, -30.1), false);
  });
  it("närmaste giltiga punkten är själv giltig – och en giltig punkt flyttas inte", () => {
    for (const [x, z] of [[10.2, 0.1], [10, 0], [50, -50], [-30.5, 0], [NaN, 3]]) {
      const p = narmasteGiltiga(x, z, TEST);
      assert.ok(giltigtGomstalle(p.x, p.z, TEST), `${x},${z} → ${p.x},${p.z}`);
    }
    assert.deepEqual(narmasteGiltiga(3, 4, TEST), { x: 3, z: 4 });
    const p = narmasteGiltiga(10.2, 0, TEST);
    assert.ok(Math.abs(Math.hypot(p.x - 10, p.z) - 1.5) < 0.05, "den närmaste, inte vilken som helst");
  });
  it("på Ön: inuti varje fast föremål → giltig punkt strax utanför", () => {
    for (const f of fast) {
      const p = narmasteGiltiga(f.x + 0.2, f.z - 0.1);
      assert.ok(giltigtGomstalle(p.x, p.z), f.id);
      assert.ok(Math.hypot(p.x - f.x, p.z - f.z) - f.fast < 0.05, `${f.id}: precis utanför`);
    }
  });
  it("hittar en punkt även när fasta föremål överlappar (spiralen)", () => {
    const tat = { ...TEST, foremal: [
      { id: "a", x: 0, z: 0, r: 3, fast: 3 }, { id: "b", x: 3.5, z: 0, r: 3, fast: 3 }, { id: "c", x: -3.5, z: 0, r: 3, fast: 3 },
    ] };
    const p = narmasteGiltiga(1.7, 0, tat);
    assert.ok(giltigtGomstalle(p.x, p.z, tat));
  });
  it("gomstalleNaraForemal: giltigt och nära ett föremål som ger skydd", () => {
    const rng = skapaPrng("auto");
    for (let i = 0; i < 300; i++) {
      const p = gomstalleNaraForemal(ON, rng.tal);
      assert.ok(giltigtGomstalle(p.x, p.z));
      assert.ok(ON.foremal.some((f) => f.r > 0 && Math.hypot(p.x - f.x, p.z - f.z) <= f.r * 1.2 + 0.05));
    }
  });
});

describe("platsNamn (spec §2.2)", () => {
  const f = (id) => ON.foremal.find((q) => q.id === id);
  it("i buskaget, vid ladan, vid ett träd, ute på ängen", () => {
    assert.equal(platsNamn(f("buske-1").x + 0.5, f("buske-1").z), "i buskaget");
    assert.equal(platsNamn(f("lada").x, f("lada").z + 4), "vid ladan");
    assert.equal(platsNamn(f("trad-5").x, f("trad-5").z + 1.6), "vid ett träd");
    assert.equal(platsNamn(0, -27), PLATS_ANGEN);
    assert.equal(PLATS_ANGEN, "ute på ängen");
  });
  it("i granen och i eken (lov), i höstacken", () => {
    assert.equal(platsNamn(f("gran").x + 1, f("gran").z), "i granen");
    assert.equal(platsNamn(f("ek").x - 1.5, f("ek").z), "i eken");
    assert.equal(platsNamn(f("hostack").x, f("hostack").z + 1), "i höstacken");
  });
  it("bron slår dammen mitt på bron, dammen gäller runt om", () => {
    assert.equal(platsNamn(f("bro").x + 1, f("bro").z), "vid bron");
    assert.equal(platsNamn(f("damm").x, f("damm").z + 5), "vid dammen");
  });
  it("brunnen mitt på ön, och dekor utan namn används aldrig", () => {
    assert.equal(platsNamn(ON.sokarStart.x, ON.sokarStart.z), "vid brunnen");
    const blommor = f("blommor-2");
    assert.doesNotMatch(platsNamn(blommor.x, blommor.z), /null|undefined/);
  });
  it('alla platsnamn på ön är "i …", "vid …" eller ängen', () => {
    for (let x = -30; x <= 30; x += 1.5) {
      for (let z = -30; z <= 30; z += 1.5) {
        if (Math.hypot(x, z) > 30) continue;
        assert.match(platsNamn(x, z), /^(i|vid) [a-zåäö ]+$|^ute på ängen$/);
      }
    }
  });
});
