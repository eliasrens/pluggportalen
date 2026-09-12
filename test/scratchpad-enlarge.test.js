// ============================================================================
// Enhetstest för kladdytans FÖRSTORA-logik (issue #312, scratchpad.js:wireEnlarge)
//   • Svarsrutan (fråga + svarsfält) flyttas IN i det utfällda kortet i fullskärm
//     och tillbaka igen – den får aldrig döljas av kladdytan (#312 bugg 1 & 3).
//   • setFull() sätter fullskärmsläget programmatiskt så räkna-läget kan BEHÅLLA
//     förstorat mellan uppgifter (#312 bugg 2).
//   • destroy() lämnar svarsrutan på sin ursprungsplats även mitt i fullskärm.
//
// wireEnlarge bor i en import-fri modul (scratch-enlarge.js) just för att kunna
// köras mot en minimal fejk-DOM (ingen jsdom i projektet) med Node:s inbyggda
// testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

// --- Minimal fejk-DOM -------------------------------------------------------
// Bara det wireEnlarge (och dess import-kedja ui.js) faktiskt rör: classList,
// appendChild/insertBefore med parentNode/nextSibling, attribut och (no-op)
// event-lyssnare. Globala document/window sätts INNAN den dynamiska importen.

class FakeEl {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.parentNode = null;
    this.nextSibling = null;
    this.innerHTML = "";
    this.title = "";
    this._attrs = {};
    const set = new Set();
    this.classList = {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c, on) => {
        const want = on === undefined ? !set.has(c) : !!on;
        if (want) set.add(c); else set.delete(c);
        return want;
      },
    };
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener() {}
  removeEventListener() {}
  _detach(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    this._reindex();
  }
  _reindex() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].nextSibling = this.children[i + 1] || null;
    }
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode._detach(child);
    child.parentNode = this;
    this.children.push(child);
    this._reindex();
    return child;
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode._detach(child);
    child.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(child);
    else this.children.splice(i, 0, child);
    this._reindex();
    return child;
  }
}

globalThis.document = {
  body: new FakeEl("body"),
  getElementById: () => new FakeEl(),
  createElement: (t) => new FakeEl(t),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb) => cb && cb(),
  devicePixelRatio: 1,
};
globalThis.requestAnimationFrame = (cb) => cb && cb();

const { wireEnlarge } = await import("../src/scratch-enlarge.js");

// Bygg en typisk uppställning: ett kort (fullskärms-target) + en svarsruta som
// bor bredvid kortet i en förälder (så vi kan verifiera att den flyttas tillbaka).
function setup() {
  const parent = new FakeEl("div");   // t.ex. .rakna-wrap
  const stage = new FakeEl("div");    // .rakna-stage
  const card = new FakeEl("div");     // kladdkortet (fullskärms-target)
  const answer = new FakeEl("form");  // .rakna-answer / .adv-gen-answer
  const button = new FakeEl("button");
  stage.appendChild(card);
  parent.appendChild(stage);
  parent.appendChild(answer);         // svarsrutan efter stage, direkt i parent
  let resizes = 0;
  const pad = { resize: () => { resizes++; } };
  const enlarge = wireEnlarge({ button, target: card, pad, handleEscape: false });
  return { parent, stage, card, answer, button, enlarge, pad, resizes: () => resizes };
}

// --- Tester -----------------------------------------------------------------

test("setAnswer + setFull flyttar svarsrutan IN i kortet och märker den (#312)", () => {
  const s = setup();
  s.enlarge.setAnswer(s.answer);
  assert.equal(s.answer.parentNode, s.parent, "svarsrutan bor kvar i parent i vanligt läge");
  assert.equal(s.answer.classList.contains("scratch-fs-answer"), false);

  s.enlarge.setFull(true);
  assert.equal(s.enlarge.isFull(), true);
  assert.equal(s.card.classList.contains("scratch-fs"), true, "kortet fälls ut");
  assert.equal(s.answer.parentNode, s.card, "svarsrutan flyttas in i det utfällda kortet");
  assert.equal(s.answer.classList.contains("scratch-fs-answer"), true, "svarsrutan märks för fullskärms-CSS");
  assert.equal(document.body.classList.contains("scratch-fs-lock"), true);
});

test("förminska flyttar svarsrutan tillbaka till sin ursprungsplats", () => {
  const s = setup();
  s.enlarge.setAnswer(s.answer);
  s.enlarge.setFull(true);
  s.enlarge.setFull(false);
  assert.equal(s.enlarge.isFull(), false);
  assert.equal(s.answer.parentNode, s.parent, "svarsrutan tillbaka i parent");
  // ...och på rätt plats: efter stage (nextSibling-ordningen bevarad).
  assert.equal(s.stage.nextSibling, s.answer, "återställd direkt efter stage");
  assert.equal(s.answer.classList.contains("scratch-fs-answer"), false);
  assert.equal(s.card.classList.contains("scratch-fs"), false);
});

test("setAnswer när kortet REDAN är förstorat flyttar in svarsrutan direkt (#312 behåll förstorat)", () => {
  // Motsvarar räkna-lägets flöde: nytt kort byggs, sätts i fullskärm, sedan
  // registreras nästa uppgifts svarsruta – den ska hamna i kortet på en gång.
  const s = setup();
  s.enlarge.setFull(true);
  s.enlarge.setAnswer(s.answer);
  assert.equal(s.answer.parentNode, s.card, "svarsrutan hamnar i det redan utfällda kortet");
  assert.equal(s.answer.classList.contains("scratch-fs-answer"), true);
});

test("isFull speglar läget och setFull är idempotent", () => {
  const s = setup();
  assert.equal(s.enlarge.isFull(), false);
  s.enlarge.setFull(true);
  s.enlarge.setFull(true); // ingen effekt, ingen dubbel-apply
  assert.equal(s.enlarge.isFull(), true);
  s.enlarge.exit();
  assert.equal(s.enlarge.isFull(), false);
});

test("destroy lämnar svarsrutan på ursprungsplatsen även mitt i fullskärm", () => {
  const s = setup();
  s.enlarge.setAnswer(s.answer);
  s.enlarge.setFull(true);
  assert.equal(s.answer.parentNode, s.card);
  s.enlarge.destroy();
  assert.equal(s.answer.parentNode, s.parent, "svarsrutan städas tillbaka vid rivning");
  assert.equal(s.answer.classList.contains("scratch-fs-answer"), false);
  assert.equal(document.body.classList.contains("scratch-fs-lock"), false, "body-låset släpps");
});

test("resize() anropas vid varje lägesbyte (bevarar ritningen)", () => {
  const s = setup();
  s.enlarge.setFull(true);
  s.enlarge.setFull(false);
  assert.ok(s.resizes() >= 2, "pad.resize kallas när kortet fälls ut/in");
});
