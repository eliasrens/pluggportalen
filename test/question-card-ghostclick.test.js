// ============================================================================
// Enhetstest för ghost-click-skyddet i den DELADE fråge-renderingen
// (src/game-questions.js → renderQuestionCard, #262).
//
// Bakgrund: på mobil skickar webbläsaren ~300 ms efter öppnings-trycket en
// SYNTETISK `click` på samma koordinat. Låg en svarsknapp under fingret valdes
// annars ett svar automatiskt. Skyddet: hedra en `.quiz-opt`-click bara om den
// föregicks av ett äkta `pointerdown` PÅ knappen, ELLER är en tangentbords-
// aktivering (`event.detail === 0`). Övriga klick är ghost-clicks och ignoreras.
//
// Repo:t har ingen jsdom (och ui.js kan inte laddas i Node – den importerar
// firebase via https), så vi kör mot en pytteliten hand-rullad DOM här nedanför,
// i samma anda som adventure-input.test.js mockar DOM. game-questions.js
// har en egen lokal el() (medveten mini-duplicering, se #271), alltså utan firebase-kedjan.
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

// --- Pytteliten DOM ---------------------------------------------------------

const VOID = new Set(["br", "hr", "img", "input", "meta", "link"]);

function parseAttrs(node, attrStr) {
  const re = /([a-zA-Z_][\w-]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrStr || ""))) {
    if (!m[1]) continue;
    node.setAttribute(m[1], m[2] ?? "");
  }
}

function parseHTML(html) {
  const root = new El("#fragment");
  const stack = [root];
  const tagRe = /<(\/)?([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/)?>/g;
  let last = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    const text = html.slice(last, m.index);
    if (text.trim()) stack[stack.length - 1].appendText(text);
    last = tagRe.lastIndex;
    const [, closing, rawTag, attrStr, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      if (stack.length > 1) stack.pop();
    } else {
      const node = new El(tag);
      parseAttrs(node, attrStr);
      stack[stack.length - 1].appendChild(node);
      if (!selfClose && !VOID.has(tag)) stack.push(node);
    }
  }
  const tail = html.slice(last);
  if (tail.trim()) stack[stack.length - 1].appendText(tail);
  return root;
}

class El {
  constructor(tag) {
    this._tag = tag;
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parent = null;
    this._listeners = {};
    this._classes = new Set();
    this.dataset = {};
    this.id = "";
    this.disabled = false;
    this._text = "";
    this._attrs = {};
  }

  get className() {
    return [...this._classes].join(" ");
  }
  set className(v) {
    this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get classList() {
    const s = this._classes;
    return {
      add: (...c) => c.forEach((x) => s.add(x)),
      remove: (...c) => c.forEach((x) => s.delete(x)),
      contains: (x) => s.has(x),
      toggle: (x, force) => {
        const on = force ?? !s.has(x);
        if (on) s.add(x);
        else s.delete(x);
        return on;
      },
    };
  }

  setAttribute(name, value) {
    if (name === "class") this.className = value;
    else if (name === "id") this.id = value;
    else if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    } else this._attrs[name] = value;
  }
  getAttribute(name) {
    if (name === "class") return this.className;
    if (name === "id") return this.id;
    return this._attrs[name] ?? null;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  appendText(t) {
    this._text += t;
  }
  prepend(child) {
    child.parent = this;
    this.children.unshift(child);
  }
  replaceChildren(...nodes) {
    this.children = [];
    nodes.forEach((n) => this.appendChild(n));
  }

  set innerHTML(html) {
    const frag = parseHTML(html);
    this.children = [];
    this._text = frag._text;
    frag.children.forEach((c) => this.appendChild(c));
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  // Testhjälpare: skjut iväg en händelse mot denna nod.
  fire(type, ev = {}) {
    const event = { type, detail: 1, preventDefault() {}, ...ev };
    (this._listeners[type] || []).slice().forEach((fn) => fn(event));
    return event;
  }

  _matches(sel) {
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    if (sel.startsWith(".")) {
      return sel
        .split(".")
        .filter(Boolean)
        .every((c) => this._classes.has(c));
    }
    return this._tag === sel.toLowerCase();
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      node.children.forEach((c) => {
        if (c._matches(sel)) out.push(c);
        walk(c);
      });
    };
    walk(this);
    return out;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  focus() {}
  scrollIntoView() {}
}

// document-stub som game-questions.js lokala el() behöver: createElement("template").
globalThis.document = {
  createElement(tag) {
    if (tag === "template") {
      let frag = null;
      return {
        set innerHTML(html) {
          frag = parseHTML(html);
        },
        get content() {
          return { firstElementChild: frag ? frag.firstElementChild : null };
        },
      };
    }
    return new El(tag);
  },
};

// Importeras EFTER att document finns (game-questions.js rör dock inte document
// vid laddning – el() kallas först vid render – men vi är på den säkra sidan).
const { renderQuestionCard } = await import("../src/game-questions.js");

// --- Hjälpare ---------------------------------------------------------------

function makeCard() {
  let answered = null; // sätts till {correct} när onAnswer körs
  const q = {
    question: "Vad är 2 + 2?",
    explanation: "Fyra.",
    options: [
      { text: "3", correct: false },
      { text: "4", correct: true },
    ],
  };
  const wrap = renderQuestionCard({
    q,
    onAnswer: (correct) => {
      answered = { correct };
      return "Nästa fråga →";
    },
    onNext: () => {},
  });
  const opts = wrap.querySelectorAll(".quiz-opt");
  const nextWrap = wrap.querySelector("#nextwrap");
  return { wrap, opts, nextWrap, isAnswered: () => answered !== null, getAnswer: () => answered };
}

// --- Tester -----------------------------------------------------------------

test("ghost-click: click UTAN föregående pointerdown väljer INGET svar (buggen borta)", () => {
  const c = makeCard();
  // Syntetisk ghost-click (detail !== 0, inget pointerdown på knappen).
  c.opts[1].fire("click", { detail: 1 });
  assert.equal(c.isAnswered(), false, "onAnswer ska inte ha körts");
  assert.equal(c.opts[0].disabled, false, "knapparna ska inte ha låsts");
  assert.equal(c.opts[1].disabled, false);
  assert.equal(c.nextWrap.children.length, 0, "ingen Nästa-knapp");
});

test("äkta tryck: pointerdown → click på samma knapp väljer svaret precis som förr", () => {
  const c = makeCard();
  c.opts[1].fire("pointerdown");
  c.opts[1].fire("click", { detail: 1 });
  assert.equal(c.isAnswered(), true, "onAnswer ska ha körts");
  assert.equal(c.getAnswer().correct, true, "rätt svar registrerat");
  assert.equal(c.opts[0].disabled, true, "knapparna låses efter svar");
  assert.equal(c.opts[1].disabled, true);
  assert.equal(c.opts[1].classList.contains("chosen-correct"), true);
  assert.equal(c.nextWrap.children.length, 1, "Nästa-knapp visas");
});

test("tangentbord: click med event.detail === 0 väljer svaret (Enter/mellanslag)", () => {
  const c = makeCard();
  // Enter/mellanslag ger en click med detail 0 och inget föregående pointerdown.
  c.opts[0].fire("click", { detail: 0 });
  assert.equal(c.isAnswered(), true, "tangentbords-click ska hedras");
  assert.equal(c.getAnswer().correct, false, "fel alternativ valt");
  assert.equal(c.opts[0].classList.contains("chosen-wrong"), true);
});

test("ghost-click på EN knapp armerar inte en ANNAN knapp", () => {
  const c = makeCard();
  // Ett äkta pointerdown på knapp 0, men ghost-click landar på knapp 1.
  c.opts[0].fire("pointerdown");
  c.opts[1].fire("click", { detail: 1 });
  assert.equal(c.isAnswered(), false, "armering är per-knapp, inte delad");
});

test("efter ett äkta svar armeras inte knappen om av ghost-click (dubbelklick-skydd)", () => {
  const c = makeCard();
  c.opts[1].fire("pointerdown");
  c.opts[1].fire("click", { detail: 1 }); // äkta svar
  const first = c.getAnswer();
  // En fördröjd ghost-click efteråt ska inte köra onAnswer igen.
  c.opts[0].fire("click", { detail: 1 });
  assert.strictEqual(c.getAnswer(), first, "onAnswer körs inte om av ghost-click");
});
