// Klasscentret gemensam layout (#489): validering, ringbuffert, återställning,
// samtidighet (fake-SDK), inredningsrätt, rules-synk och bootgrafen.
// Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KC_SHOP_ITEMS, kcShopItem } from "../src/klasscenter/kc-shop-items.js";
import {
  historikSlot, ladaAntal, validatePlacedItems, normaliseraLayout, normaliseraHistorik,
  planSave, planRestore, planSaveWrites, korSparning, korAterstallning, kanInredaFor,
  KC_HISTORIK, KC_LAYOUT_MAX, KC_POKAL_MAX,
} from "../src/klasscenter/kc-layout-plan.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const lada = [kcShopItem("guldstaty"), kcShopItem("fontan")];
const fv = { serverTimestamp: () => "TS" };

describe("validatePlacedItems", () => {
  it("normaliserar: x/y klamras 0–100, z avrundas, saknat z = 0", () => {
    const r = validatePlacedItems({ guldstaty: { x: 120, y: -3, z: 2.6 }, fontan: { x: "40", y: 50 } }, { lada });
    assert.equal(r.ok, true);
    assert.deepEqual(r.placedItems, { fontan: { x: 40, y: 50, z: 0 }, guldstaty: { x: 100, y: 0, z: 3 } });
  });
  it("tom layout är OK", () => {
    assert.deepEqual(validatePlacedItems({}, { lada }), { ok: true, placedItems: {} });
  });
  it("bara föremål i möbellådan", () => {
    const r = validatePlacedItems({ flygel: { x: 1, y: 1, z: 0 } }, { lada });
    assert.equal(r.kod, "ej-i-ladan");
    assert.equal(r.nyckel, "flygel");
    // utan lada kontrolleras bara katalogen
    assert.equal(validatePlacedItems({ flygel: { x: 1, y: 1, z: 0 } }).ok, true);
  });
  it("okänt föremål, trasig nyckel, #0/#1 nekas", () => {
    for (const k of ["soffa", "Guldstaty", "guldstaty#", "guldstaty#0", "guldstaty#1", "a/b"]) {
      assert.equal(validatePlacedItems({ [k]: { x: 1, y: 1 } }).kod, "okant-foremal", k);
    }
  });
  it("#n kräver n exemplar i lådan", () => {
    const pi = { guldstaty: { x: 1, y: 1 }, "guldstaty#2": { x: 2, y: 2 } };
    assert.equal(validatePlacedItems(pi, { lada }).kod, "ej-i-ladan");
    assert.equal(validatePlacedItems(pi, { lada: { guldstaty: 2 } }).ok, true);
  });
  it("ogiltig position och form", () => {
    assert.equal(validatePlacedItems({ guldstaty: { x: "a", y: 1 } }).kod, "ogiltig-position");
    assert.equal(validatePlacedItems({ guldstaty: null }).kod, "ogiltig-position");
    assert.equal(validatePlacedItems({ guldstaty: [1, 2] }).kod, "ogiltig-position");
    assert.equal(validatePlacedItems(null).kod, "ogiltig-form");
    assert.equal(validatePlacedItems([]).kod, "ogiltig-form");
  });
  it(`högst ${KC_LAYOUT_MAX} poster`, () => {
    const pi = {};
    for (let n = 2; n <= KC_LAYOUT_MAX + 2; n++) pi[`guldstaty#${n}`] = { x: 1, y: 1 };
    assert.equal(validatePlacedItems(pi).kod, "for-manga");
  });
});

describe("ladaAntal", () => {
  it("föremål, id-lista eller karta", () => {
    assert.deepEqual([...ladaAntal(lada)], [["guldstaty", 1], ["fontan", 1]]);
    assert.deepEqual([...ladaAntal(["a", "a"])], [["a", 2]]);
    assert.deepEqual([...ladaAntal({ a: 2, b: 0 })], [["a", 2]]);
    assert.equal(ladaAntal(null).size, 0);
  });
});

describe("planSave + ringbufferten", () => {
  it("första sparningen = version 1, slot 1", () => {
    const p = planSave({ current: null, placedItems: { guldstaty: { x: 10, y: 20, z: 1 } }, uid: "elev1", lada });
    assert.deepEqual(p, { ok: true, version: 1, slot: 1, placedItems: { guldstaty: { x: 10, y: 20, z: 1 } }, uid: "elev1" });
  });
  it("version + 1, slot = version % 10", () => {
    assert.equal(historikSlot(10), 0);
    assert.equal(historikSlot(11), 1);
    assert.equal(historikSlot(29), 9);
    const p = planSave({ current: { version: 9 }, placedItems: {}, uid: "u" });
    assert.equal(p.version, 10);
    assert.equal(p.slot, 0);
  });
  it("utan uid / ogiltig layout → Fel", () => {
    assert.equal(planSave({ placedItems: {} }).kod, "ingen-anvandare");
    assert.equal(planSave({ placedItems: { nej: {} }, uid: "u" }).kod, "okant-foremal");
  });
  it("forvantadVersion: inaktuell → krock, aktuell → OK", () => {
    assert.equal(planSave({ current: { version: 4 }, placedItems: {}, uid: "u", forvantadVersion: 3 }).kod, "krock");
    assert.equal(planSave({ current: { version: 4 }, placedItems: {}, uid: "u", forvantadVersion: 4 }).version, 5);
    assert.equal(planSave({ current: null, placedItems: {}, uid: "u", forvantadVersion: 0 }).version, 1);
  });
  it("planSaveWrites: current + historikslot, samma placedItems/version", () => {
    const plan = planSave({ current: { version: 12 }, placedItems: { fontan: { x: 1, y: 2, z: 3 } }, uid: "elev1" });
    const w = planSaveWrites({ classId: "6a", plan, fv });
    assert.deepEqual(w, [
      { path: ["classCenters", "6a", "layout", "current"], data: { placedItems: { fontan: { x: 1, y: 2, z: 3 } }, version: 13, updatedBy: "elev1", updatedAt: "TS" } },
      { path: ["classCenters", "6a", "layoutHistory", "3"], data: { placedItems: { fontan: { x: 1, y: 2, z: 3 } }, savedBy: "elev1", savedAt: "TS", version: 13 } },
    ]);
  });
});

// Minnes-"Firestore" för transaktionerna.
function fakeSdk(state = {}) {
  const sets = [];
  return {
    state,
    sets,
    sdk: {
      doc: (_db, ...p) => ({ path: p.join("/") }),
      serverTimestamp: () => "TS",
      runTransaction: async (_db, fn) => {
        const skriv = [];
        const r = await fn({
          get: async (ref) => ({ exists: () => ref.path in state, data: () => state[ref.path] }),
          set: (ref, data, opt) => skriv.push([ref.path, data, opt]),
        });
        for (const [path, data, opt] of skriv) {
          assert.equal(opt, undefined, "set utan merge");
          state[path] = structuredClone(data);
          sets.push(path);
        }
        return r;
      },
    },
  };
}

describe("korSparning + korAterstallning (fake-SDK)", () => {
  it("11 sparningar → slot 0..9 fylls, version 11 skriver över slot 1", async () => {
    const { sdk, state } = fakeSdk();
    for (let i = 1; i <= 11; i++) {
      const r = await korSparning(sdk, null, { classId: "6a", uid: "elev1", placedItems: { guldstaty: { x: i, y: i, z: 0 } }, lada });
      assert.equal(r.version, i);
    }
    const hist = Object.keys(state).filter((k) => k.startsWith("classCenters/6a/layoutHistory/"));
    assert.equal(hist.length, KC_HISTORIK);
    assert.equal(state["classCenters/6a/layout/current"].version, 11);
    assert.equal(state["classCenters/6a/layoutHistory/1"].version, 11); // version 1 är borta
    assert.equal(state["classCenters/6a/layoutHistory/0"].version, 10);
    assert.equal(state["classCenters/6a/layoutHistory/2"].version, 2);
    // ytterligare en → version 12 skriver över slot 2; vid 20 skrivs slot 0 över
    for (let i = 12; i <= 20; i++) {
      await korSparning(sdk, null, { classId: "6a", uid: "elev1", placedItems: { guldstaty: { x: i, y: 1, z: 0 } } });
    }
    assert.equal(state["classCenters/6a/layoutHistory/0"].version, 20);
    assert.equal(state["classCenters/6a/layoutHistory/0"].placedItems.guldstaty.x, 20);
    const lista = normaliseraHistorik(Object.entries(state)
      .filter(([k]) => k.includes("/layoutHistory/"))
      .map(([k, data]) => ({ id: k.split("/").pop(), data })));
    assert.deepEqual(lista.map((h) => h.version), [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  });

  it("återställning blir en NY version (och hamnar själv i historiken)", async () => {
    const { sdk, state } = fakeSdk();
    await korSparning(sdk, null, { classId: "6a", uid: "elev1", placedItems: { guldstaty: { x: 10, y: 10, z: 0 } } });
    await korSparning(sdk, null, { classId: "6a", uid: "elev2", placedItems: {} }); // "förstört"
    const r = await korAterstallning(sdk, null, { classId: "6a", uid: "larare1", slot: 1, lada });
    assert.equal(r.ok, true);
    assert.equal(r.version, 3);
    assert.equal(r.aterstalldFran, 1);
    assert.deepEqual(state["classCenters/6a/layout/current"].placedItems, { guldstaty: { x: 10, y: 10, z: 0 } });
    assert.equal(state["classCenters/6a/layoutHistory/3"].savedBy, "larare1");
    assert.equal(state["classCenters/6a/layoutHistory/2"].version, 2); // det förstörda finns kvar
  });

  it("tom/ogiltig slot och krock skriver ingenting", async () => {
    const { sdk, sets } = fakeSdk({ "classCenters/6a/layout/current": { version: 4, placedItems: {} } });
    assert.equal((await korAterstallning(sdk, null, { classId: "6a", uid: "u", slot: 7 })).kod, "tom-slot");
    assert.equal((await korAterstallning(sdk, null, { classId: "6a", uid: "u", slot: 10 })).kod, "ogiltig-slot");
    assert.equal((await korSparning(sdk, null, { classId: "6a", uid: "u", placedItems: {}, forvantadVersion: 3 })).kod, "krock");
    assert.equal(sets.length, 0);
  });

  it("permission-denied (samtidig sparning hann före) körs om; annat fel kastas", async () => {
    const { sdk, state } = fakeSdk();
    const riktig = sdk.runTransaction;
    let n = 0;
    sdk.runTransaction = async (db, fn) => {
      if (++n === 1) throw Object.assign(new Error("nej"), { code: "permission-denied" });
      return riktig(db, fn);
    };
    const r = await korSparning(sdk, null, { classId: "6a", uid: "u", placedItems: {} });
    assert.equal(r.version, 1);
    assert.equal(n, 2);
    assert.equal(state["classCenters/6a/layout/current"].version, 1);
    sdk.runTransaction = async () => { throw Object.assign(new Error("x"), { code: "unavailable" }); };
    await assert.rejects(korSparning(sdk, null, { classId: "6a", uid: "u", placedItems: {} }));
  });

  it("nekad med oförändrad version (spärrad elev) → slutar direkt, krock=false (#493)", async () => {
    const { sdk } = fakeSdk({ "classCenters/6a/layout/current": { version: 4, placedItems: {} } });
    const riktig = sdk.runTransaction;
    let commits = 0;
    sdk.runTransaction = async (db, fn) => {
      const r = await riktig(db, async (tx) => fn({ ...tx, set: () => {} }));
      if (r && r.ok) { commits++; throw Object.assign(new Error("nej"), { code: "permission-denied" }); }
      return r;
    };
    await assert.rejects(korSparning(sdk, null, { classId: "6a", uid: "u", placedItems: {} }),
      (e) => e.code === "permission-denied" && e.krock === false);
    assert.equal(commits, 1);
  });

  it("O1: Återställ med inaktuell lista (slotten överskriven) → historik-andrad, inget skrivs (#493)", async () => {
    const { sdk, state, sets } = fakeSdk();
    for (let i = 1; i <= 3; i++) {
      await korSparning(sdk, null, { classId: "6a", uid: "elev1", placedItems: { guldstaty: { x: i, y: i, z: 0 } } });
    }
    // listan visade version 2 i slot 2 …
    const visad = { slot: 2, version: 2 };
    // … men 10 sparningar till hann skriva över slotten med version 12.
    for (let i = 4; i <= 13; i++) {
      await korSparning(sdk, null, { classId: "6a", uid: "elev2", placedItems: {} });
    }
    assert.equal(state["classCenters/6a/layoutHistory/2"].version, 12);
    const fore = sets.length;
    const r = await korAterstallning(sdk, null, { classId: "6a", uid: "larare1", slot: visad.slot, historikVersion: visad.version });
    assert.equal(r.kod, "historik-andrad");
    assert.match(r.error, /Historiken har ändrats/);
    assert.equal(sets.length, fore);
    assert.equal(state["classCenters/6a/layout/current"].version, 13);
    // rätt version i slotten → går igenom
    const ok = await korAterstallning(sdk, null, { classId: "6a", uid: "larare1", slot: 2, historikVersion: 12 });
    assert.equal(ok.ok, true);
    assert.equal(ok.aterstalldFran, 12);
  });
});

describe("planRestore + normalisering", () => {
  it("planRestore tar bort föremål som inte finns i lådan", () => {
    const r = planRestore({ version: 5, placedItems: { guldstaty: { x: 1, y: 1, z: 0 }, flygel: { x: 2, y: 2, z: 0 } } }, { lada });
    assert.deepEqual(r, { ok: true, placedItems: { guldstaty: { x: 1, y: 1, z: 0 } }, version: 5 });
    assert.equal(planRestore(null).kod, "tom-slot");
  });
  it("normaliseraLayout: saknat dokument = tom layout version 0, trasiga poster hoppas över", () => {
    assert.deepEqual(normaliseraLayout(null), { placedItems: {}, version: 0, updatedBy: null, updatedAt: null });
    const l = normaliseraLayout({ version: 3, updatedBy: "u", placedItems: { guldstaty: { x: 5, y: 6, z: 1 }, skrap: { x: 1, y: 1 }, fontan: "x" } });
    assert.deepEqual(l.placedItems, { guldstaty: { x: 5, y: 6, z: 1 } });
    assert.equal(l.version, 3);
  });
  it("normaliseraHistorik: okända dok-id:n ignoreras", () => {
    const h = normaliseraHistorik([{ id: "x", data: {} }, { id: "12", data: {} }, { id: "4", data: () => ({ version: 4, savedBy: "u" }) }]);
    assert.deepEqual(h.map((p) => [p.slot, p.version, p.savedBy]), [[4, 4, "u"]]);
  });
});

describe("kanInredaFor", () => {
  it("klassmedlem ja, bockad nej, annan klass nej, lärare alltid", () => {
    const k = { studentIds: ["elev1", "elev3"], inredningSparr: ["elev3"] };
    assert.equal(kanInredaFor({ uid: "elev1", ...k }), true);
    assert.equal(kanInredaFor({ uid: "elev3", ...k }), false);
    assert.equal(kanInredaFor({ uid: "elev2", ...k }), false);
    assert.equal(kanInredaFor({ uid: "larare1", arLarare: true, ...k }), true);
    assert.equal(kanInredaFor({ uid: null, studentIds: [null] }), false);
  });
});

it("firestore.rules: kcPlaced har tak KC_LAYOUT_MAX och en kcPosOk-rad per index", () => {
  const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
  const block = rules.match(/function kcPlaced\(pi\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(block, "kcPlaced finns i firestore.rules");
  assert.match(block[1], new RegExp(`n <= ${KC_LAYOUT_MAX}\\b`));
  const idx = [...block[1].matchAll(/\(n <= (\d+) \|\| kcPosOk\(v\[(\d+)\]\)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(idx, Array.from({ length: KC_LAYOUT_MAX }, (_, i) => [i, i]));
  // Alla katalogföremål + taket för pokaler ryms (katalogen i reglerna = kcKatalog).
  assert.equal(KC_LAYOUT_MAX, KC_SHOP_ITEMS.length + KC_POKAL_MAX);
  const kat = rules.match(/function kcKatalog\(\)\s*\{[\s\S]*?\{([\s\S]*?)\}/)[1];
  assert.deepEqual([...kat.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort(), KC_SHOP_ITEMS.map((i) => i.id).sort());
});

it("bootgrafen: layout-modulerna bara dynamiskt (#271)", () => {
  const g = staticBootGraph();
  for (const f of ["kc-layout-plan.js", "kc-layout-data.js", "kc-omforsok.js"]) {
    assert.equal(g.has(join(SRC, "klasscenter", f)), false, `${f} får inte ligga i bootgrafen`);
  }
  assert.ok(g.size > 50, "BFS hittade bootgrafen");
});

function staticBootGraph() {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
