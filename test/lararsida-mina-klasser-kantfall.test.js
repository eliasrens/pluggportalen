// #804 tester: kantfall för Mina klasser (ren logik, utan webbläsare).
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import { MINA_BASE, filtreraKlasser, hittaKlass, minaHash, startVal } from "../src/teacher-mina-val.js";

const KL = [{ id: "a1", name: "4A" }, { id: "b2", name: "4B" }, { id: "c3" }, { id: "d4", name: null }];
const q = (s) => new URLSearchParams(s);
let shared, statsAv;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
  statsAv = await import("../src/teacher-stats-av.js");
});

describe("startVal – konstiga indata", () => {
  it("tom/blank/okänd ?klass= och sparad klass som inte finns → första klassen", () => {
    for (const k of ["", "%", "NOPE", "4"]) assert.equal(startVal(KL, { query: q(`klass=${k}`), saved: "borta" }).id, "a1", k);
  });
  // #804 F2: blankt ?klass=%20 matchade en klass utan namn – nu ignoreras det (sparad → första).
  it("blankt ?klass= ignoreras även när en klass saknar namn", () => {
    assert.equal(startVal(KL, { query: q("klass=%20") }).id, "a1");
    assert.equal(startVal(KL, { query: q("klass=%20%20"), saved: "b2" }).id, "b2");
    assert.equal(startVal(KL, { query: q("klass=%204B%20") }).id, "b2");
    assert.equal(hittaKlass(KL, "   "), null);
  });
  it("okänd ?flik= → hur; okänd ?sektion= ignoreras; sektion slår flik", () => {
    assert.equal(startVal(KL, { query: q("flik=__proto__") }).flik, "hur");
    assert.equal(startVal(KL, { query: q("flik=constructor") }).flik, "hur");
    assert.equal(startVal(KL, { query: q("sektion=toString") }).flik, "hur");
    assert.equal(startVal(KL, { query: q("flik=ser&sektion=fokus") }).flik, "fokus");
    assert.deepEqual(startVal(KL, { query: q("sektion=schack") }), { id: "a1", flik: "hur", del: "schack" });
  });
  it("del: URL slår sparad underflik; ingen klass → id null utan krasch", () => {
    assert.equal(startVal(KL, { query: q("del=live"), statsSaved: "prov" }).del, "live");
    assert.equal(startVal(KL, { statsSaved: "prov" }).del, "prov");
    assert.deepEqual(startVal([], { query: q("klass=x&flik=ser") }), { id: null, flik: "ser", del: null });
  });
  it("klass utan namn kan väljas på id och sökas", () => {
    assert.equal(hittaKlass(KL, "c3").id, "c3");
    assert.deepEqual(filtreraKlasser(KL, "c3").map((c) => c.id), ["c3"]);
    assert.equal(filtreraKlasser(KL, "  ").length, 4);
  });
});

describe("minaHash", () => {
  it("kodar id med specialtecken och tål tillbaka-tolkning", () => {
    const id = "klass å&=? 1";
    const h = minaHash(id, "hur", "live");
    assert.ok(h.startsWith(`${MINA_BASE}?`));
    assert.equal(new URLSearchParams(h.split("?")[1]).get("klass"), id);
    assert.equal(startVal([{ id, name: "x" }], { query: new URLSearchParams(h.split("?")[1]) }).id, id);
  });
  it("del bara under Hur går det?; utan klass bara basen", () => {
    assert.ok(!minaHash("a1", "ser", "live").includes("del="));
    assert.equal(minaHash(null, "hur", "live"), MINA_BASE);
  });
});

describe("modulAv", () => {
  it("opt-in (schack, Ekvationsresan) = av utan enabledModules; hidden slår enabled; skräp tolereras", () => {
    for (const id of ["schack", "ekvationsresan", "hittaratt"]) {
      assert.equal(statsAv.modulAv({}, id), true, id);
      assert.equal(statsAv.modulAv({ enabledModules: [id] }, id), false, id);
      assert.equal(statsAv.modulAv({ enabledModules: [id], hiddenModules: [id] }, id), true, id);
    }
    assert.equal(statsAv.modulAv({ hiddenModules: "x", enabledModules: null }, "plugga"), false);
    assert.equal(statsAv.modulAv({ hiddenModules: ["brakresan"] }, "brakresan"), true);
    assert.equal(statsAv.modulAv(undefined, "brakresan"), false);
    assert.equal(statsAv.modulAv({}, "finns-inte"), false);
    assert.equal(statsAv.modulAv({}, "prov"), false);
  });
});

describe("omdirigeringar", () => {
  it("gamla adresser landar i Mina klasser och tar med frågesträngen; ingen slinga", () => {
    const r = (p, qs) => shared.teacherRedirect(p, qs);
    assert.equal(r("/larare/klasser"), "#/larare/mina-klasser?flik=ser");
    assert.equal(r("/larare/statistik"), "#/larare/mina-klasser?flik=hur");
    assert.equal(new URLSearchParams(r("/larare/klasser", "klass=4B&sektion=fokus").split("?")[1]).get("sektion"), "fokus");
    assert.equal(r("/larare/klass"), "#/larare/mina-klasser?flik=hur");
    assert.equal(r("/larare/elever"), "#/larare/mina-klasser?flik=elever");
    assert.equal(r("/larare/mina-klasser"), null);
  });
});
