// ============================================================================
// Minimal DOM för provtypernas renderElev (#763) – ingen jsdom i projektet.
// Bara det h() (prov-vy.js), ordna/para och prov-dra.js rör: attribut,
// dataset, classList, träd, enkla väljare ("button", "[data-x]", "[data-x="v"]", "input[type=text]",
// ".klass", kommaseparerade), händelser med bubbling, click() (inte på
// disabled), fokus och document.elementFromPoint (testet sätter målet).
//   const dom = installeraDom();  … dom.mal = element;  dom.avinstallera();
// ============================================================================

class Nod {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
    this._ls = {};
  }
  get children() { return this.childNodes.filter((n) => n instanceof El); }
  get parentElement() { return this.parentNode; }
  get nextElementSibling() {
    const s = this.parentNode?.children || [];
    return s[s.indexOf(this) + 1] || null;
  }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.replaceChildren(...(v === "" || v == null ? [] : [String(v)])); }
  _ta(n) { return typeof n === "string" ? new Text(this.ownerDocument, n) : n; }
  append(...ns) { for (const n of ns) this.appendChild(this._ta(n)); }
  appendChild(n) {
    n = this._ta(n);
    n.parentNode?.removeChild(n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  removeChild(n) { this.childNodes = this.childNodes.filter((x) => x !== n); n.parentNode = null; return n; }
  replaceChildren(...ns) { for (const n of [...this.childNodes]) this.removeChild(n); this.append(...ns); }
  after(...ns) {
    const p = this.parentNode;
    const i = p.childNodes.indexOf(this);
    const nya = ns.map((n) => this._ta(n));
    for (const n of nya) { n.parentNode?.removeChild(n); n.parentNode = p; }
    p.childNodes.splice(i + 1, 0, ...nya);
  }
  remove() { this.parentNode?.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  addEventListener(t, fn) { (this._ls[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this._ls[t] = (this._ls[t] || []).filter((x) => x !== fn); }
  dispatchEvent(e) {
    e.target ||= this;
    for (let x = this; x && !e._stopp; x = x.parentNode) {
      e.currentTarget = x;
      for (const fn of [...(x._ls[e.type] || [])]) fn.call(x, e);
    }
    return !e.defaultPrevented;
  }
}

class Text extends Nod {
  constructor(doc, t) { super(doc); this._t = t; }
  get textContent() { return this._t; }
}

/** En väljare (utan kombinatorer): tag, .klass, [attr], [attr="v"]. */
function matchar(el, sel) {
  return sel.split(",").map((s) => s.trim()).some((s) => {
    const m = /^([a-z]*)((?:\.[\w-]+)*)((?:\[[\w-]+(?:="?[^"\]]*"?)?\])*)$/i.exec(s);
    if (!m) throw new Error(`mini-dom: väljaren stöds inte: ${s}`);
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    for (const c of m[2].split(".").filter(Boolean)) if (!el.classList.contains(c)) return false;
    for (const a of m[3].match(/\[[^\]]+\]/g) || []) {
      const [, k, v] = /^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/.exec(a);
      if (!el.hasAttribute(k) || (v !== undefined && el.getAttribute(k) !== v)) return false;
    }
    return true;
  });
}

class El extends Nod {
  constructor(doc, tag) {
    super(doc);
    this.tagName = tag.toUpperCase();
    this._attrs = new Map();
    this._klass = new Set();
    this.style = {};
    this.disabled = false;
    this.hidden = false;
    this.type = "";
    this.value = "";
    const self = this;
    this.classList = {
      add: (...c) => c.forEach((x) => self._klass.add(x)),
      remove: (...c) => c.forEach((x) => self._klass.delete(x)),
      contains: (c) => self._klass.has(c),
      toggle: (c, on) => { const vill = on === undefined ? !self._klass.has(c) : !!on; vill ? self._klass.add(c) : self._klass.delete(c); return vill; },
    };
    this.dataset = new Proxy({}, {
      get: (_, k) => self.getAttribute(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`) ?? undefined,
    });
  }
  get className() { return [...this._klass].join(" "); }
  set className(v) { this._klass = new Set(String(v).split(/\s+/).filter(Boolean)); }
  setAttribute(k, v) { if (k === "class") this.className = v; else this._attrs.set(k, String(v)); }
  getAttribute(k) { return k === "class" ? this.className : this._attrs.has(k) ? this._attrs.get(k) : null; }
  hasAttribute(k) { return this._attrs.has(k); }
  removeAttribute(k) { this._attrs.delete(k); }
  querySelectorAll(sel) {
    const ut = [];
    const gå = (n) => { for (const c of n.children) { if (matchar(c, sel)) ut.push(c); gå(c); } };
    gå(this);
    return ut;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  matches(sel) { return matchar(this, sel); }
  closest(sel) { for (let x = this; x instanceof El; x = x.parentNode) if (matchar(x, sel)) return x; return null; }
  cloneNode() { const c = new El(this.ownerDocument, this.tagName); c.className = this.className; return c; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Handelse("click")); }
}

export class Handelse {
  constructor(type, o = {}) { Object.assign(this, { type, bubbles: true, cancelable: true, defaultPrevented: false, ...o }); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopp = true; }
}

export function installeraDom() {
  const doc = {
    activeElement: null,
    mal: null,
    _ls: {},
    createElement: (t) => new El(doc, t),
    createElementNS: (_, t) => new El(doc, t),
    elementFromPoint: () => doc.mal,
    addEventListener: (t, fn) => { (doc._ls[t] ||= []).push(fn); },
    removeEventListener: (t, fn) => { doc._ls[t] = (doc._ls[t] || []).filter((x) => x !== fn); },
    /** Händelser som prov-dra.js lyssnar på i document. */
    skicka(t, o) { const e = new Handelse(t, o); for (const fn of [...(doc._ls[t] || [])]) fn(e); return e; },
  };
  doc.body = new El(doc, "body");
  const forr = { document: globalThis.document, window: globalThis.window };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  return {
    doc,
    set mal(m) { doc.mal = m; },
    avinstallera() { globalThis.document = forr.document; globalThis.window = forr.window; },
  };
}
