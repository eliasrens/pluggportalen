// #862: iOS sifferknappsats saknar Enter → fast-answer har en ➜-knapp som
// skickar samma väg som ENTER, aldrig tar fokus och följer på/av-läget.
// Stub-DOM (ingen jsdom i repot): bara det mountFastAnswer rör.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mountFastAnswer } from "../src/mult/fast-answer.js";

function stubEl(extra = {}) {
  const on = {};
  return {
    on,
    value: "",
    disabled: false,
    textContent: "",
    offsetWidth: 0,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: (t, f) => { (on[t] ||= []).push(f); },
    removeEventListener: (t, f) => { on[t] = (on[t] || []).filter((g) => g !== f); },
    fire(t, e = {}) {
      const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...e };
      for (const f of on[t] || []) f(ev);
      return ev;
    },
    ...extra,
  };
}

function rig() {
  let focused = 0;
  const els = {
    ".fa-form": stubEl(),
    ".fa-question": stubEl(),
    ".fa-input": stubEl({ focus() { focused++; } }),
    ".fa-skicka": stubEl(),
    ".fa-feedback": stubEl(),
  };
  const root = { classList: { add() {}, remove() {}, toggle() {} }, innerHTML: "", querySelector: (s) => els[s] };
  const answers = [];
  let n = 0;
  const fa = mountFastAnswer(root, {
    source: { next: () => ({ key: `q${++n}`, text: `6 × ${n}`, answer: 6 * n }) },
    check: (q, raw) => (raw === "" ? { valid: false } : { valid: true, correct: Number(raw) === q.answer, correctAnswer: q.answer }),
    onAnswer: (a) => answers.push(a.raw),
    feedbackMs: { correct: 1, wrong: 1 },
  });
  return { fa, root, els, answers, focused: () => focused };
}

describe("#862 fast-answer: skicka-knappen", () => {
  let doc;
  before(() => {
    doc = globalThis.document;
    globalThis.document = { activeElement: null, visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  });
  after(() => { globalThis.document = doc; });

  it("knappen ligger i formuläret som submit-knapp", () => {
    const { root, fa } = rig();
    assert.match(root.innerHTML, /<button class="fa-skicka" type="submit"[^>]*aria-label="Skicka svar"/);
    assert.ok(root.innerHTML.indexOf("fa-skicka") < root.innerHTML.indexOf("</form>"), "inne i <form> → Enter och knapp = samma submit");
    fa.destroy();
  });

  it("tryck på knappen tar inte fokus från fältet (pointerdown och mousedown avbryts)", () => {
    const { els, fa } = rig();
    assert.equal(els[".fa-skicka"].fire("pointerdown").defaultPrevented, true);
    assert.equal(els[".fa-skicka"].fire("mousedown").defaultPrevented, true);
    fa.destroy();
  });

  it("submit (knapp eller Enter) ger ETT svar och fokus tillbaka; dubbeltryck ignoreras", () => {
    const { els, answers, focused, fa } = rig();
    const f0 = focused();
    els[".fa-input"].value = "6";
    els[".fa-form"].fire("submit");
    els[".fa-form"].fire("submit"); // andra trycket: fältet är tömt → inget försök
    assert.deepEqual(answers, ["6"]);
    assert.equal(els[".fa-input"].value, "");
    assert.ok(focused() > f0, "fältet fokuseras igen så iOS-knappsatsen ligger kvar");
    fa.destroy();
  });

  it("knappen följer på/av-läget", () => {
    const { els, fa } = rig();
    assert.equal(els[".fa-skicka"].disabled, false);
    fa.setEnabled(false, "Väntar…");
    assert.equal(els[".fa-skicka"].disabled, true);
    fa.setEnabled(true);
    assert.equal(els[".fa-skicka"].disabled, false);
    fa.destroy();
    assert.equal((els[".fa-skicka"].on.pointerdown || []).length, 0, "lyssnarna tas bort");
  });
});
