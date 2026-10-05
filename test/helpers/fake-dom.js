// ============================================================================
// Minimal fejk-DOM för kladdytans import-fria moduler (knappsats/uppställning,
// #392). Ingen jsdom i projektet – bara det modulerna faktiskt rör: classList,
// dataset, style, attribut, träd (append/remove/contains/querySelector på klass),
// händelser med bubbling, fokus (focus/blur/focusin + activeElement) och
// input-fältens value/selection/setRangeText/select.
// ============================================================================

export class FakeEl {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = { setProperty: (k, v) => { this.style[k] = v; } };
    this.dataset = {};
    this.hidden = false;
    this.readOnly = false;
    this.disabled = false;
    this.title = "";
    this.type = "";
    this._attrs = {};
    this._ls = {};
    this._value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
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
  set className(v) { String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get value() { return this._value; }
  set value(v) { this._value = String(v); this.selectionStart = this.selectionEnd = this._value.length; }
  set innerHTML(v) { this._html = v; }
  set textContent(v) { this._text = v; }
  get textContent() { return this._text; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
  removeAttribute(k) { delete this._attrs[k]; }
  appendChild(c) {
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  querySelectorAll(sel) {
    const cls = sel.replace(/^\./, "");
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.classList.contains(cls)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getBoundingClientRect() { return this.rect; }
  addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); }
  removeEventListener(t, fn) { this._ls[t] = (this._ls[t] || []).filter((f) => f !== fn); }
  /** Riktiga Event-objekt (keypad.fire) → bubblar upp genom föräldrarna. */
  dispatchEvent(ev) {
    for (let n = this; n; n = n.parentNode) (n._ls[ev.type] || []).forEach((fn) => fn(ev));
    return !ev.defaultPrevented;
  }
  /** Testhjälp: enkel händelse med target, bubblar. */
  dispatch(type, init = {}) {
    const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (let n = this; n; n = n.parentNode) (n._ls[type] || []).forEach((fn) => fn(e));
    return e;
  }
  /** Testhjälp: ett klick (som en riktig knapp). */
  click() { return this.dispatch("click"); }
  focus() {
    const doc = this.ownerDocument;
    if (doc.activeElement === this) return;
    if (doc.activeElement) doc.activeElement.blur();
    doc.activeElement = this;
    (this._ls.focus || []).forEach((fn) => fn({ type: "focus", target: this }));
    this.dispatch("focusin");
  }
  blur() {
    const doc = this.ownerDocument;
    if (doc.activeElement !== this) return;
    doc.activeElement = null;
    (this._ls.blur || []).forEach((fn) => fn({ type: "blur", target: this }));
  }
  select() { this.selectionStart = 0; this.selectionEnd = this._value.length; }
  setRangeText(str, s, e) {
    this._value = this._value.slice(0, s) + str + this._value.slice(e);
    this.selectionStart = this.selectionEnd = s + str.length;
  }
}

export function makeDoc() {
  const doc = {
    activeElement: null,
    defaultView: null,
    createElement: (tag) => new FakeEl(doc, tag),
  };
  return doc;
}
