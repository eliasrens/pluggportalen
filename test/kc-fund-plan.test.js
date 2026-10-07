// Klasscentret crowdfunding (#486): katalog, cappning, skrivplan, möbellåda,
// rules-katalogen i synk och bootgrafen. Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KC_SHOP_ITEMS, KC_PRIS_MIN, KC_PRIS_MAX, KC_ZONER, kcShopItem,
} from "../src/klasscenter/kc-shop-items.js";
import {
  planDonation, planDonationWrites, korDonation, normaliseraFunds, unlockedItems,
} from "../src/klasscenter/kc-fund-plan.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const staty = kcShopItem("guldstaty");

describe("katalogen", () => {
  it("~8 föremål, unika id:n, pris 2000–10000 (heltal)", () => {
    assert.ok(KC_SHOP_ITEMS.length >= 8);
    assert.equal(new Set(KC_SHOP_ITEMS.map((i) => i.id)).size, KC_SHOP_ITEMS.length);
    for (const it of KC_SHOP_ITEMS) {
      assert.ok(Number.isInteger(it.targetPrice), it.id);
      assert.ok(it.targetPrice >= KC_PRIS_MIN && it.targetPrice <= KC_PRIS_MAX, it.id);
    }
    assert.equal(KC_PRIS_MIN, 2000);
    assert.equal(KC_PRIS_MAX, 10000);
  });

  it("varje föremål har id-format, namn, zon, storlek och art-nyckel", () => {
    for (const it of KC_SHOP_ITEMS) {
      assert.match(it.id, /^[a-z0-9-]{1,40}$/);
      assert.ok(it.namn && it.emoji, it.id);
      assert.ok(KC_ZONER.includes(it.zon), it.id);
      assert.ok(it.storlek.w > 0 && it.storlek.h > 0, it.id);
      assert.match(it.art, /^kc-/);
    }
    assert.equal(new Set(KC_SHOP_ITEMS.map((i) => i.art)).size, KC_SHOP_ITEMS.length);
  });

  it("guldstatyn kostar 5000; okänt id → null; katalogen är fryst", () => {
    assert.equal(staty.targetPrice, 5000);
    assert.equal(kcShopItem("finnsinte"), null);
    assert.throws(() => { KC_SHOP_ITEMS[0].targetPrice = 1; });
  });

  it("firestore.rules kcKatalog (kcPris) är exakt katalogen (id → pris)", () => {
    const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
    const block = rules.match(/function kcKatalog\(\)\s*\{\s*return\s*\{([\s\S]*?)\};/);
    assert.ok(block, "kcKatalog finns i firestore.rules");
    assert.match(rules, /function kcPris\(itemId\)\s*\{\s*return kcKatalog\(\)\.get\(itemId, 0\);/);
    const iRules = Object.fromEntries([...block[1].matchAll(/'([a-z0-9-]+)':\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    assert.deepEqual(iRules, Object.fromEntries(KC_SHOP_ITEMS.map((i) => [i.id, i.targetPrice])));
  });
});

describe("planDonation", () => {
  it("första donationen: 100 → 100/5000, inte köpt", () => {
    const p = planDonation({ fund: null, item: staty, amount: 100, coins: 300 });
    assert.equal(p.ok, true);
    assert.equal(p.amount, 100);
    assert.equal(p.fundedAmount, 100);
    assert.equal(p.targetPrice, 5000);
    assert.equal(p.isUnlocked, false);
    assert.equal(p.kvar, 4900);
    assert.equal(p.coins, 200);
    assert.equal(p.cappat, false);
  });

  it("donation som passerar målet cappas till exakt det som saknas → köpt", () => {
    const p = planDonation({ fund: { targetPrice: 5000, fundedAmount: 4950 }, item: staty, amount: 200, coins: 1000 });
    assert.equal(p.amount, 50);
    assert.equal(p.cappat, true);
    assert.equal(p.fundedAmount, 5000);
    assert.equal(p.isUnlocked, true);
    assert.equal(p.coins, 950); // överskottet dras aldrig
  });

  it("cappas till saldot; aldrig över saldot", () => {
    const p = planDonation({ fund: null, item: staty, amount: 500, coins: 120 });
    assert.equal(p.amount, 120);
    assert.equal(p.coins, 0);
    assert.equal(p.cappat, true);
  });

  it("beloppet blir heltal (nedåt) och ≥ 1", () => {
    assert.equal(planDonation({ item: staty, amount: 10.9, coins: 50 }).amount, 10);
    assert.equal(planDonation({ item: staty, amount: "25", coins: 50 }).amount, 25);
    assert.equal(planDonation({ item: staty, amount: 3, coins: 7.8 }).amount, 3);
  });

  it("fel: redan köpt, för lite mynt, ogiltigt belopp, okänt föremål", () => {
    const kopt = { targetPrice: 5000, fundedAmount: 5000, isUnlocked: true };
    assert.equal(planDonation({ fund: kopt, item: staty, amount: 1, coins: 9 }).kod, "redan-kopt");
    assert.equal(planDonation({ fund: { targetPrice: 5000, fundedAmount: 5000 }, item: staty, amount: 1, coins: 9 }).kod, "redan-kopt");
    assert.equal(planDonation({ item: staty, amount: 10, coins: 0 }).kod, "for-lite-mynt");
    assert.equal(planDonation({ item: staty, amount: 10, coins: 0.5 }).kod, "for-lite-mynt");
    for (const a of [0, -5, 0.5, NaN, "abc", undefined]) {
      assert.equal(planDonation({ item: staty, amount: a, coins: 99 }).kod, "ogiltigt-belopp", String(a));
    }
    assert.equal(planDonation({ item: { id: "x", targetPrice: 100 }, amount: 1, coins: 9 }).kod, "okant-foremal");
    assert.equal(planDonation({ amount: 1, coins: 9 }).kod, "okant-foremal");
  });

  it("fundens låsta pris gäller före katalogens", () => {
    const p = planDonation({ fund: { targetPrice: 4000, fundedAmount: 3990 }, item: staty, amount: 100, coins: 100 });
    assert.equal(p.amount, 10);
    assert.equal(p.isUnlocked, true);
  });
});

describe("planDonationWrites", () => {
  const fv = { serverTimestamp: () => "TS" };
  it("tre skrivningar: saldo − n, donationspost, fund med lastDonationId", () => {
    const plan = planDonation({ fund: null, item: staty, amount: 100, coins: 300 });
    const w = planDonationWrites({ classId: "6a", uid: "elev1", itemId: "guldstaty", plan, donationId: "d1", coinsFore: 300, fv });
    assert.deepEqual(w.map((x) => x.path.join("/")), [
      "studentData/elev1", "classCenters/6a/donations/d1", "classCenters/6a/fund/guldstaty",
    ]);
    assert.deepEqual(w[0].data, { coins: 200 });
    assert.deepEqual(w[1].data, { uid: "elev1", itemId: "guldstaty", amount: 100, at: "TS" });
    assert.deepEqual(w[2].data, { targetPrice: 5000, fundedAmount: 100, isUnlocked: false, lastDonationId: "d1" });
  });
  it("köpt → unlockedAt sätts", () => {
    const plan = planDonation({ fund: { targetPrice: 5000, fundedAmount: 4900 }, item: staty, amount: 100, coins: 100 });
    const w = planDonationWrites({ classId: "6a", uid: "u", itemId: "guldstaty", plan, donationId: "d", coinsFore: 100, fv });
    assert.equal(w[2].data.unlockedAt, "TS");
    assert.equal(w[2].data.isUnlocked, true);
  });
});

describe("korDonation (falskt SDK)", () => {
  // Batch-SDK: läser state, set med increment → relativa värden. avvisa(n)
  // låter commit nr n nekas (krock) och kan mutera state (någon hann före).
  function fakeSdk(state, { avvisa = () => null } = {}) {
    const sets = [];
    let commits = 0;
    const inc = (n) => ({ inc: n });
    return {
      sets,
      sdk: {
        doc: (...a) => (a.length === 1 ? { id: "auto1" } : { path: a.slice(1).join("/") }),
        collection: () => ({}),
        serverTimestamp: () => "TS",
        increment: inc,
        getDocFromServer: async (ref) => ({ exists: () => ref.path in state, data: () => state[ref.path] }),
        writeBatch: () => {
          const ops = [];
          return {
            set: (ref, data) => ops.push([ref.path, data]),
            commit: async () => {
              const err = avvisa(++commits);
              if (err) throw err;
              for (const [path, data] of ops) {
                const ny = { ...(state[path] || {}) };
                for (const [k, v] of Object.entries(data)) ny[k] = v && typeof v === "object" && "inc" in v ? (ny[k] || 0) + v.inc : v;
                state[path] = ny;
                sets.push([path, data]);
              }
            },
          };
        },
      },
    };
  }
  const nej = () => Object.assign(new Error("nej"), { code: "permission-denied" });

  it("läser fund + saldo och skriver tre dokument med auto-id, relativt (increment)", async () => {
    const state = { "studentData/elev1": { coins: 40 } };
    const { sdk, sets } = fakeSdk(state);
    const r = await korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "guldstaty", amount: 100 });
    assert.equal(r.ok, true);
    assert.equal(r.amount, 40);
    assert.equal(r.donationId, "auto1");
    assert.deepEqual(sets.map((s) => s[0]), ["studentData/elev1", "classCenters/6a/donations/auto1", "classCenters/6a/fund/guldstaty"]);
    assert.deepEqual(sets[0][1], { coins: { inc: -40 } });
    assert.deepEqual(sets[2][1].fundedAmount, { inc: 40 });
    assert.equal(state["studentData/elev1"].coins, 0);
  });
  it("fel skriver ingenting", async () => {
    const { sdk, sets } = fakeSdk({
      "studentData/elev1": { coins: 40 },
      "classCenters/6a/fund/guldstaty": { targetPrice: 5000, fundedAmount: 5000, isUnlocked: true },
    });
    const r = await korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "guldstaty", amount: 1 });
    assert.equal(r.kod, "redan-kopt");
    assert.equal(sets.length, 0);
    assert.equal((await korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "nej", amount: 1 })).kod, "okant-foremal");
  });
  it("krock: läser om och cappar om (målet nästan nått av någon annan) – samma donationId", async () => {
    const state = { "studentData/elev1": { coins: 900 }, "classCenters/6a/fund/guldstaty": { targetPrice: 5000, fundedAmount: 4000, lastDonationId: "a" } };
    const { sdk, sets } = fakeSdk(state, {
      avvisa: (n) => {
        if (n > 1) return null;
        state["classCenters/6a/fund/guldstaty"] = { targetPrice: 5000, fundedAmount: 4950, lastDonationId: "b" };
        return nej();
      },
    });
    const r = await korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "guldstaty", amount: 300 });
    assert.equal(r.ok, true);
    assert.equal(r.amount, 50);
    assert.equal(r.isUnlocked, true);
    assert.equal(r.donationId, "auto1");
    assert.equal(state["studentData/elev1"].coins, 850);
    assert.equal(sets.length, 3);
  });
  it("krock och målet nått under tiden → redan-kopt, inga mynt dras", async () => {
    const state = { "studentData/elev1": { coins: 900 }, "classCenters/6a/fund/guldstaty": { targetPrice: 5000, fundedAmount: 4000, lastDonationId: "a" } };
    const { sdk, sets } = fakeSdk(state, {
      avvisa: () => {
        state["classCenters/6a/fund/guldstaty"] = { targetPrice: 5000, fundedAmount: 5000, isUnlocked: true, lastDonationId: "b" };
        return nej();
      },
    });
    const r = await korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "guldstaty", amount: 300 });
    assert.equal(r.kod, "redan-kopt");
    assert.match(r.error, /Inga mynt drogs/);
    assert.equal(sets.length, 0);
    assert.equal(state["studentData/elev1"].coins, 900);
  });
  it("nekad utan att något ändrats (ej klassmedlem) → slutar efter 2 försök, krock=false", async () => {
    let n = 0;
    const { sdk } = fakeSdk({ "studentData/elev1": { coins: 900 } }, { avvisa: () => (++n, nej()) });
    await assert.rejects(korDonation(sdk, null, { classId: "6a", uid: "elev1", itemId: "guldstaty", amount: 10 }),
      (e) => e.code === "permission-denied" && e.krock === false);
    assert.equal(n, 1); // andra försöket läser samma läge → skickar inte ens
  });
});

describe("normaliseraFunds + möbellådan", () => {
  it("hela katalogen, saknat = 0, okända id:n ignoreras", () => {
    const f = normaliseraFunds([
      { id: "guldstaty", data: () => ({ targetPrice: 5000, fundedAmount: 150, isUnlocked: false }) },
      { id: "klassfana", data: { targetPrice: 2000, fundedAmount: 2000, isUnlocked: true, unlockedAt: "T" } },
      { id: "skrap", data: { targetPrice: 1, fundedAmount: 1, isUnlocked: true } },
    ]);
    assert.equal(Object.keys(f).length, KC_SHOP_ITEMS.length);
    assert.equal(f.skrap, undefined);
    assert.deepEqual(f.guldstaty, { itemId: "guldstaty", targetPrice: 5000, fundedAmount: 150, isUnlocked: false, unlockedAt: null });
    assert.equal(f.fontan.fundedAmount, 0);
    assert.equal(f.fontan.targetPrice, 8000);
    assert.deepEqual(unlockedItems(f).map((i) => i.id), ["klassfana"]);
    assert.deepEqual(unlockedItems({}), []);
  });
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

it("bootgrafen: crowdfunding-modulerna bara dynamiskt (#271)", () => {
  const g = staticBootGraph();
  for (const f of ["kc-shop-items.js", "kc-fund-plan.js", "kc-fund-data.js"]) {
    assert.equal(g.has(join(SRC, "klasscenter", f)), false, `${f} får inte ligga i bootgrafen`);
  }
});
