// Enhetstester: lärarens formatväljare + generiska setupFields (#548) –
// src/live/live-setup-fields.js. Bevisar att ett formats setupFields ritas och
// valideras generiskt (med ett TEST-format, aldrig i produktion), att väljaren
// döljs med ett format och visas med två, och att Klassmatchens fält/validering
// ger samma input och samma fel som formuläret före #548.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireFormat, listFormats, answerKindsFor } from "../src/live/formats/index.js";
import { registerFormat } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { validateSessionInput, buildSessionDoc, LIVE_DURATIONS_MIN } from "../src/live/live-core.js";
import {
  fieldsFor, setupFieldsHtml, perClassRowsHtml, coerceSetupValue, defaultSetupValues, validateSetupFields,
  formatPickerHtml, answerKindHtml, classHint, durationField,
} from "../src/live/live-setup-fields.js";

const KM = requireFormat("klassmatch");
const MULT = requireGameMode("multiplication_0_10");

const TEST_FIELDS = [
  { key: "sek", label: "Tid per fråga", kind: "choice", options: [{ value: 10, label: "10 s" }, { value: 20, label: "20 s" }], default: 20, required: true },
  { key: "kistor", label: "Antal kistor", kind: "number", min: 1, max: 9 },
  { key: "tema", label: "Tema", kind: "text", maxlength: 5, required: true, placeholder: "<skatt>" },
  { key: "stjal", label: "Stöld på", kind: "toggle", default: true },
  { key: "start", label: "Startguld", kind: "perClass", min: 0, max: 50, defaultFor: () => 10 },
];

const testFormat = () => ({
  id: "test_rush", displayName: "Testrushen", icon: "💰", description: "Bara för test <b>",
  scope: "inom-klass", minClasses: 1, maxClasses: 1, answerKinds: ["free", "choice"], pacing: "lärarstyrd",
  setupFields: TEST_FIELDS,
  compatibleGameModes: () => true, validateSetup: () => [], buildSessionFields: () => ({}), sessionTitle: (s) => s.name,
  computeStandings: () => ({}), buildResult: () => ({}),
  projectorViews: async () => ({}), studentView: async () => ({}), historyRenderer: async () => ({}),
});

describe("generisk rendering av setupFields", () => {
  const html = setupFieldsHtml(TEST_FIELDS);

  it("ritar varje sort med data-field och rätt kontroll", () => {
    for (const f of TEST_FIELDS) assert.match(html, new RegExp(`data-field="${f.key}"`));
    assert.match(html, /type="radio" name="sf-sek" value="20" checked/);
    assert.doesNotMatch(html, /value="10" checked/);
    assert.match(html, /id="live-sf-kistor" type="number" min="1" max="9"/);
    assert.match(html, /id="live-sf-tema" maxlength="5" placeholder="&lt;skatt&gt;"/);
    assert.match(html, /type="checkbox" checked/);
    assert.match(html, /class="field live-perclass" data-field="start" hidden/);
  });

  it("okänd sort ritas inte; tom lista = inget", () => {
    assert.equal(setupFieldsHtml([{ key: "x", label: "X", kind: "hologram" }]), "");
    assert.equal(setupFieldsHtml([]), "");
  });

  it("perClass: en rad per vald klass, escapat namn", () => {
    const rows = perClassRowsHtml(TEST_FIELDS[4], [{ id: "a", name: "4<B>" }, { id: "b" }], { a: 7, b: 3 });
    assert.match(rows, /4&lt;B&gt;/);
    assert.match(rows, /value="7" data-id="a"/);
    assert.match(rows, /<span>b<\/span>/);
  });

  it("coerceSetupValue + defaultSetupValues", () => {
    assert.equal(coerceSetupValue(TEST_FIELDS[0], "10"), 10);
    assert.equal(coerceSetupValue(TEST_FIELDS[0], undefined), undefined);
    assert.equal(coerceSetupValue(TEST_FIELDS[1], "3"), "3");
    assert.equal(coerceSetupValue(TEST_FIELDS[3], "on"), true);
    assert.deepEqual(defaultSetupValues(TEST_FIELDS), { sek: 20, stjal: true });
  });
});

describe("validateSetupFields (generiska regler)", () => {
  const ok = { sek: 10, kistor: "4", tema: "hav", stjal: false, start: { k1: 5 }, classIds: ["k1"] };

  it("giltig input → inga fel; tomt valfritt nummer ok", () => {
    assert.deepEqual(validateSetupFields(TEST_FIELDS, ok), []);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, kistor: "" }), []);
  });

  it("required, options, min/max, heltal, maxlength, perClass", () => {
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, sek: undefined, tema: " " }), ["Välj tid per fråga.", "Fyll i tema."]);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, sek: 15 }), ["Välj tid per fråga."]);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, kistor: "10" }), ["Antal kistor måste vara ett heltal 1–9."]);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, kistor: "2.5" }), ["Antal kistor måste vara ett heltal 1–9."]);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, tema: "sjörövare" }), ["Tema får vara högst 5 tecken."]);
    assert.deepEqual(validateSetupFields(TEST_FIELDS, { ...ok, start: { k1: 99 }, classNames: { k1: "4B" } }),
      ["Startguld för 4B måste vara ett heltal 0–50."]);
  });

  it("validate:false och custom hoppas över", () => {
    const f = [{ key: "n", label: "N", kind: "number", min: 1, max: 2, validate: false }, { key: "c", label: "C", kind: "custom", required: true }];
    assert.deepEqual(validateSetupFields(f, { n: "99" }), []);
  });
});

describe("formatväljaren + svarssätt + klassledtext", () => {
  it("ett format → ingen väljare (auto-vald Klassmatchen)", () => {
    assert.equal(listFormats().length, 1);
    assert.equal(formatPickerHtml(listFormats(), "klassmatch"), "");
  });

  it("svarssätt: Klassmatchen + multiplikation har bara free → inget val", () => {
    assert.deepEqual(answerKindsFor(KM, MULT), ["free"]);
    assert.equal(answerKindHtml(answerKindsFor(KM, MULT), "free"), "");
  });

  it("klassledtext ur min/max/scope", () => {
    assert.equal(classHint(KM), "klass mot klass – välj minst två");
    assert.equal(classHint({ minClasses: 1, maxClasses: 1, scope: "inom-klass" }), "välj en klass");
    assert.equal(classHint({ minClasses: 1, maxClasses: 4, scope: "inom-klass" }), "välj upp till fyra");
  });

  it("med ett test-format registrerat visas väljaren: kort per format, förvalt markerat", () => {
    registerFormat(testFormat());
    const html = formatPickerHtml(listFormats(), "klassmatch");
    assert.match(html, /value="klassmatch" checked/);
    assert.match(html, /value="test_rush" {2}\/>/);
    assert.match(html, /🏁/);
    assert.match(html, /<b>Testrushen<\/b><small>Bara för test &lt;b&gt;<\/small>/);
    // två svarssätt gemensamma → val visas, ogiltigt förval → första
    const kinds = answerKindsFor(requireFormat("test_rush"), { answerKinds: ["free", "choice"] });
    assert.match(answerKindHtml(kinds, "nope"), /value="free" checked/);
    assert.match(answerKindHtml(kinds, "choice"), /value="choice" checked/);
  });

  it("test-formatet: pacing lärarstyrd → ingen matchlängd; kärnan kör dess generiska regler", () => {
    const fmt = requireFormat("test_rush");
    assert.deepEqual(fieldsFor(fmt).map((f) => f.key), TEST_FIELDS.map((f) => f.key));
    const base = { name: "Rush", format: "test_rush", gameMode: "multiplication_0_10", classIds: ["k1"], sek: 10, tema: "hav", start: { k1: 1 } };
    assert.deepEqual(validateSessionInput(base), []);
    assert.deepEqual(validateSessionInput({ ...base, tema: "", classIds: [] }), ["Välj minst en klass.", "Fyll i tema."]);
  });
});

describe("Klassmatchen som setupFields (oförändrat beteende)", () => {
  it("samma fält i samma ordning som formuläret före #548", () => {
    assert.deepEqual(fieldsFor(KM).map((f) => `${f.key}:${f.kind}`),
      ["divisors:perClass", "wizards:custom", "durationMin:choice", "coinPrize:number"]);
    const html = setupFieldsHtml(fieldsFor(KM));
    assert.match(html, /class="field live-perclass live-divisors" data-field="divisors" hidden/);
    assert.match(html, /class="field live-wizards" data-field="wizards" hidden/);
    assert.match(html, /<div class="live-durations">/);
    for (const m of LIVE_DURATIONS_MIN) assert.match(html, new RegExp(`value="${m}" ${m === 20 ? "checked" : ""}`));
    assert.match(html, /id="live-prize" class="live-prize-input" type="number" min="0" max="100000"/);
    assert.equal(KM.setupFields[0].defaultFor({ studentIds: ["a", "b", "c"] }), 3);
    assert.equal(KM.setupFields[0].defaultFor({}), 1);
  });

  it("kärnan lägger inte till en extra matchlängd när formatet har durationMin", () => {
    assert.equal(fieldsFor(KM).filter((f) => f.key === "durationMin").length, 1);
    assert.equal(fieldsFor({ pacing: "tid", setupFields: [] })[0].key, durationField().key);
  });

  const input = {
    name: "4B mot 5E", format: "klassmatch", gameMode: "multiplication_0_10", classIds: ["a", "b"],
    classNames: { a: "4B", b: "5E" }, divisors: { a: 20, b: 22 }, wizards: { a: "elias", b: "rasmus" },
    durationMin: coerceSetupValue(durationField(), "15"), coinPrize: "", answerKind: "free",
  };

  it("samma fel som förut (inga dubbletter från den generiska kontrollen)", () => {
    assert.deepEqual(validateSessionInput(input, { knownModes: ["multiplication_0_10"] }), []);
    const errs = validateSessionInput({ ...input, durationMin: undefined, coinPrize: "x", divisors: { a: 0, b: 22 } });
    assert.equal(errs.length, 3);
    assert.equal(errs[0], "Välj matchlängd.");
    assert.match(errs[1], /^Mynt-priset måste vara ett heltal 0–100.000 \(tomt = inget pris\)\.$/);
    assert.equal(errs[2], "Nämnaren för 4B måste vara ett heltal 1–999.");
  });

  it("sessionsdokumentet som förut (answerKind sparas inte än)", () => {
    const doc = buildSessionDoc(input, { uid: "t" });
    assert.equal(doc.durationSeconds, 900);
    assert.deepEqual(doc.classDivisors, { a: 20, b: 22 });
    assert.deepEqual(doc.wizards, { a: "elias", b: "rasmus" });
    assert.equal(doc.coinPrize, undefined);
    assert.equal(doc.answerKind, undefined);
    assert.equal(doc.format, "klassmatch");
  });
});
