// Klasscentret #494 – pokalregistret (src/klasscenter/kc-pokal-typer.js).
// Register, deterministiskt id, vilka klasser en källa ger pokal, skrivplan,
// idempotent utdelning mot en minnes-"Firestore", visning/tooltip, och att
// firestore.rules känner till exakt samma typer. Körs med: node --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  registreraPokaltyp, pokaltyp, harPokaltyp, listaPokaltyper, pokalId, giltigtKallaId,
  verifieraPokal, pokalerUrKalla, planPokal, korPokalUtdelning, normaliseraPokal,
  normaliseraPokaler, pokalTooltip, POKAL_TITEL_MAX, POKAL_DETALJ_MAX,
} from "../src/klasscenter/kc-pokal-typer.js";

const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const fv = { serverTimestamp: () => "SERVER_TS" };

const mm = (over = {}) => ({
  name: "Mattematchen oktober", status: "finished",
  participatingClassIds: ["6a", "6b"], result: { winnerClass: "6a" }, ...over,
});
const live = (over = {}) => ({
  name: "6A mot 6B", status: "finished", participatingClassIds: ["6a", "6b", "6c"],
  result: { winner: "6b", perClass: { "6a": { players: 3 }, "6b": { players: 2 }, "6c": { players: 0 } } },
  ...over,
});

describe("registret", () => {
  it("har de inbyggda typerna med titel, text, art och källa", () => {
    for (const [id, kalla] of [["mm-klasskamp", "mattematchen"], ["live-vinst", "live"], ["live-avklarat", "live"]]) {
      const t = pokaltyp(id);
      assert.ok(t, id);
      assert.equal(t.kalla, kalla);
      assert.ok(t.titel.length > 0 && t.titel.length <= POKAL_TITEL_MAX);
      assert.ok(t.text.length > 0);
      assert.ok(t.art);
    }
    assert.equal(pokaltyp("mm-klasskamp").text, "Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans.");
  });
  it("registreraPokaltyp validerar och kan lägga till en typ", () => {
    assert.throws(() => registreraPokaltyp({ id: "Ogiltig Id", titel: "x", kalla: "live", vinnare: () => [] }));
    assert.throws(() => registreraPokaltyp({ id: "utan-titel", kalla: "live", vinnare: () => [] }));
    assert.throws(() => registreraPokaltyp({ id: "fel-kalla", titel: "x", kalla: "quiz", vinnare: () => [] }));
    assert.throws(() => registreraPokaltyp({ id: "utan-vinnare", titel: "x", kalla: "live" }));
    assert.equal(harPokaltyp("test-typ"), false);
    // vinnare() → [] så test-typen inte påverkar källtesterna nedan.
    registreraPokaltyp({ id: "test-typ", titel: "Test", kalla: "live", vinnare: () => [], tooltip: (d) => `Test: ${d}` });
    assert.equal(harPokaltyp("test-typ"), true);
    assert.equal(pokaltyp("test-typ").art, "pokal");
    assert.equal(pokalTooltip({ typ: "test-typ", detalj: "abc" }).text, "Test: abc");
  });
});

describe("deterministiskt id", () => {
  it("<typ>-<kallaId>, samma källa = samma id", () => {
    assert.equal(pokalId("mm-klasskamp", "abc123"), "mm-klasskamp-abc123");
    assert.equal(pokalId("live-vinst", "Sess_1-x"), "live-vinst-Sess_1-x");
    assert.equal(pokalId("live-vinst", "s1"), pokalId("live-vinst", "s1"));
    assert.notEqual(pokalId("live-vinst", "s1"), pokalId("live-avklarat", "s1"));
  });
  it("ogiltig typ eller källa → null", () => {
    assert.equal(pokalId("okand", "s1"), null);
    for (const bad of ["", "a/b", "a b", "å", "x".repeat(101), null, 7]) {
      assert.equal(giltigtKallaId(bad), false, String(bad));
      assert.equal(pokalId("live-vinst", bad), null);
    }
    assert.equal(giltigtKallaId("x".repeat(100)), true);
  });
});

describe("vilka klasser får pokal", () => {
  it("Mattematchen: winnerClass när tävlingen är avslutad", () => {
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", mm()), [
      { classId: "6a", typ: "mm-klasskamp", kallaId: "c1", id: "mm-klasskamp-c1", detalj: "Mattematchen oktober" },
    ]);
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", mm({ status: "active" })), []);
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", mm({ result: { winnerClass: null } })), []);
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", mm({ result: undefined })), []);
    assert.equal(verifieraPokal("mm-klasskamp", mm(), "6a"), true);
    assert.equal(verifieraPokal("mm-klasskamp", mm(), "6b"), false);
  });
  it("Mattematchen oavgjort (#495): ALLA delade vinnare får pokalen", () => {
    const lika = mm({ result: { winnerClass: "6a", winnerClasses: ["6a", "6b"] } });
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", lika).map((p) => p.classId), ["6a", "6b"]);
    assert.equal(verifieraPokal("mm-klasskamp", lika, "6b"), true);
    // Äldre result utan winnerClasses → bara winnerClass; ingen deltagare/svar → ingen.
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", mm()).map((p) => p.classId), ["6a"]);
    const ingen = mm({ participatingClassIds: [], result: { winnerClass: null, winnerClasses: [] } });
    assert.deepEqual(pokalerUrKalla("mattematchen", "c1", ingen), []);
  });
  it("Live tävlingsläge: bara vinnaren får pokal (live-vinst), ingen live-avklarat", () => {
    const ut = pokalerUrKalla("live", "s1", live()).map((p) => `${p.typ}:${p.classId}`).sort();
    assert.deepEqual(ut, ["live-vinst:6b"]);
    assert.deepEqual(pokalerUrKalla("live", "s1", live({ participatingClassIds: [], result: { perClass: {}, winner: null } })), []);
  });
  it("Live kooperativt läge (#495): målet nått → live-avklarat till klasser med spelare, aldrig vinst", () => {
    const koop = (goalReached) => live({ result: { ...live().result, cooperative: true, goalReached } });
    const ut = pokalerUrKalla("live", "s1", koop(true)).map((p) => `${p.typ}:${p.classId}`).sort();
    assert.deepEqual(ut, ["live-avklarat:6a", "live-avklarat:6b"]);
    assert.deepEqual(pokalerUrKalla("live", "s1", koop(false)), []);
    assert.equal(verifieraPokal("live-vinst", koop(true), "6b"), false);
  });
  it("Live: oavgjort, vinnare utan spelare, ej deltagande eller pågående → ingen vinst", () => {
    assert.equal(verifieraPokal("live-vinst", live({ result: { ...live().result, winner: "draw" } }), "6b"), false);
    assert.equal(verifieraPokal("live-vinst", live({ result: { ...live().result, winner: "6c" } }), "6c"), false);
    const nadd = { ...live().result, cooperative: true, goalReached: true };
    assert.equal(verifieraPokal("live-avklarat", live({ result: nadd }), "6a"), true);
    assert.equal(verifieraPokal("live-avklarat", live({ participatingClassIds: ["6b"], result: nadd }), "6a"), false);
    assert.deepEqual(pokalerUrKalla("live", "s1", live({ status: "live" })), []);
    assert.deepEqual(pokalerUrKalla("live", "a/b", live()), []);
    assert.deepEqual(pokalerUrKalla("live", "s1", null), []);
  });
  it("detaljen kapas till maxlängden", () => {
    const [p] = pokalerUrKalla("mattematchen", "c1", mm({ name: "x".repeat(300) }));
    assert.equal(p.detalj.length, POKAL_DETALJ_MAX);
  });
});

describe("skrivplan", () => {
  it("planPokal → id + exakt de fält reglerna godtar", () => {
    const p = planPokal({ typ: "live-vinst", kallaId: "s1", detalj: " 6A mot 6B ", uid: "larare1", fv });
    assert.equal(p.ok, true);
    assert.equal(p.id, "live-vinst-s1");
    assert.deepEqual(p.data, {
      typ: "live-vinst", kallaId: "s1", titel: pokaltyp("live-vinst").titel,
      wonAt: "SERVER_TS", awardedBy: "larare1", detalj: "6A mot 6B",
    });
    assert.equal("detalj" in planPokal({ typ: "live-vinst", kallaId: "s1", uid: "u", fv }).data, false);
  });
  it("fel: okänd typ, ogiltigt id, ingen uid", () => {
    assert.equal(planPokal({ typ: "x", kallaId: "s1", uid: "u", fv }).kod, "okand-typ");
    assert.equal(planPokal({ typ: "live-vinst", kallaId: "a/b", uid: "u", fv }).kod, "ogiltigt-id");
    assert.equal(planPokal({ typ: "live-vinst", kallaId: "s1", fv }).kod, "saknar-uid");
  });
});

/** Minnes-"Firestore" med runTransaction som SDK:n (get → set, inget skrivs vid return utan set). */
function minnesDb() {
  const docs = new Map();
  let skrivningar = 0;
  const sdk = {
    serverTimestamp: () => "SERVER_TS",
    doc: (_db, ...path) => ({ key: path.join("/") }),
    async runTransaction(_db, fn) {
      const satt = [];
      const tx = {
        get: async (ref) => ({ exists: () => docs.has(ref.key), data: () => docs.get(ref.key) }),
        set: (ref, data) => satt.push([ref.key, data]),
      };
      const r = await fn(tx);
      for (const [k, d] of satt) {
        skrivningar++;
        docs.set(k, d);
      }
      return r;
    },
  };
  return { sdk, docs, skrivningar: () => skrivningar };
}

describe("idempotent utdelning (korPokalUtdelning)", () => {
  it("första gången skapas pokalen, andra gången skrivs inget", async () => {
    const m = minnesDb();
    const arg = { classId: "6a", typ: "mm-klasskamp", kallaId: "c1", detalj: "MM okt", uid: "larare1" };
    assert.deepEqual(await korPokalUtdelning(m.sdk, null, arg), { ok: true, id: "mm-klasskamp-c1", ny: true });
    assert.deepEqual(await korPokalUtdelning(m.sdk, null, arg), { ok: true, id: "mm-klasskamp-c1", ny: false });
    assert.deepEqual(await korPokalUtdelning(m.sdk, null, { ...arg, detalj: "annan text" }), { ok: true, id: "mm-klasskamp-c1", ny: false });
    assert.equal(m.skrivningar(), 1);
    assert.equal(m.docs.get("classCenters/6a/trophies/mm-klasskamp-c1").detalj, "MM okt");
  });
  it("samma källa i två klasser = två pokaler; ogiltigt anrop skriver inget", async () => {
    const m = minnesDb();
    await korPokalUtdelning(m.sdk, null, { classId: "6a", typ: "live-avklarat", kallaId: "s1", uid: "l" });
    await korPokalUtdelning(m.sdk, null, { classId: "6b", typ: "live-avklarat", kallaId: "s1", uid: "l" });
    assert.equal((await korPokalUtdelning(m.sdk, null, { classId: "", typ: "live-avklarat", kallaId: "s1", uid: "l" })).ok, false);
    assert.equal((await korPokalUtdelning(m.sdk, null, { classId: "6a", typ: "nope", kallaId: "s1", uid: "l" })).kod, "okand-typ");
    assert.equal(m.skrivningar(), 2);
  });
});

describe("visning", () => {
  it("normaliseraPokaler: nyast först, Timestamp → ms, okänd typ behåller titel", () => {
    const ts = (n) => ({ toMillis: () => n });
    const lista = normaliseraPokaler([
      { id: "live-vinst-s1", data: () => ({ typ: "live-vinst", kallaId: "s1", titel: "Live-segrare", wonAt: ts(100), awardedBy: "l" }) },
      { id: "mm-klasskamp-c1", data: () => ({ typ: "mm-klasskamp", kallaId: "c1", titel: "MM", detalj: "Okt", wonAt: ts(300) }) },
      { id: "framtid-x", data: { typ: "framtid", titel: "Framtida pokal", wonAt: null } },
    ]);
    assert.deepEqual(lista.map((p) => p.id), ["mm-klasskamp-c1", "live-vinst-s1", "framtid-x"]);
    assert.equal(lista[0].wonAt, 300);
    assert.equal(lista[0].art, "pokal-mm");
    assert.equal(lista[2].kand, false);
    assert.equal(lista[2].titel, "Framtida pokal");
    assert.equal(normaliseraPokal("x", null).titel, "Pokal");
  });
  it("pokalTooltip: rubrik, typens text, detalj och svenskt datum", () => {
    const t = pokalTooltip({ typ: "mm-klasskamp", titel: "Mattematchens mästare", detalj: "MM okt", wonAt: Date.UTC(2026, 9, 8, 12) });
    assert.equal(t.rubrik, "Mattematchens mästare");
    assert.equal(t.text, "Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans.");
    assert.equal(t.detalj, "MM okt");
    assert.match(t.datum, /8 oktober 2026/);
    assert.equal(pokalTooltip({ typ: "okand" }).text, "");
  });
});

describe("firestore.rules i synk med registret", () => {
  const riktiga = ["mm-klasskamp", "mm-silver", "mm-brons", "live-vinst", "live-avklarat", "lasresan-milstolpe", "larare"];
  it("kcPokalTyper listar exakt registrets inbyggda typer", () => {
    const m = RULES.match(/function kcPokalTyper\(\) \{ return \[([^\]]*)\]; \}/);
    assert.ok(m, "kcPokalTyper saknas i firestore.rules");
    const iRegler = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.deepEqual(iRegler.sort(), [...riktiga].sort());
    for (const id of riktiga) assert.ok(listaPokaltyper().some((t) => t.id === id));
  });
  it("varje typ har en verifieringsgren i kcPokalVerifierad", () => {
    const fn = RULES.match(/function kcPokalVerifierad[\s\S]*?\n {6}\}/)[0];
    for (const id of riktiga) assert.match(fn, new RegExp(`typ == '${id}'`), id);
  });
  it("titel/detalj-gränserna är desamma som reglernas", () => {
    assert.match(RULES, new RegExp(`d\\.titel\\.size\\(\\) <= ${POKAL_TITEL_MAX}`));
    assert.match(RULES, new RegExp(`d\\.detalj\\.size\\(\\) <= ${POKAL_DETALJ_MAX}`));
  });
});
