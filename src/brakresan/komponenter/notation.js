// ============================================================================
// Bråkresan – 1. Bråknotation och inmatning (komponenter/notation.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 1: vanligt bråk med VÅGRÄTT bråkstreck, blandad form,
// uttryck, jämförelsetecken och tillgänglig text ("tre fjärdedelar"). Bråk-
// inmatning har separata fält för täljare/nämnare, blandad form även ett
// heltalsfält. Enter kontrollerar när inmatningen är giltig; annars visas
// inmatningshjälpen ur math/input.js och uppgiften låses inte.
//
// view = { component: "notation", expr: [del …] } där en del är
//   en form (form.js)          { kind: "fraction", n: 3, d: 4 } …
//   { op: "+"|"−"|"·"|"÷"|"="|"<"|">" }
//   { text: "av 80 kr" }       vanlig text i uttrycket
//   { okand: true }            en ruta "?" (det som söks, utan svar)
//   { input: true }            här står svarsfälten (answer.type "number")
//   { relation: true }         här väljer eleven <, = eller > (answer.type "relation")
// opts.answer = uppgiftens offentliga svarsyta ({ type, input }).
// Saknar uttrycket en svarsplats läggs den sist.
// ============================================================================

import { formatForm, PARSERS, speakForm, RELATIONS } from "../math/index.js";
import { h, skapaBas } from "./bas.js";

const OP_TEXT = { "+": "+", "-": "−", "−": "−", "*": "·", "·": "·", "×": "·", "/": "÷", "÷": "÷", "=": "=", "<": "<", ">": ">" };
const OP_ORD = { "+": "plus", "−": "minus", "·": "gånger", "÷": "delat med", "=": "är lika med", "<": "är mindre än", ">": "är större än" };
const RELATION_ORD = { "<": "mindre än", "=": "lika med", ">": "större än" };

/** Ett tal i riktig notation (HTML). Skärmläsaren får texten ur speakForm. */
export function formNod(form, { klass = "" } = {}) {
  const ord = speakForm(form);
  const rot = h("span", { class: `br-tal ${klass}`.trim(), role: "img", "aria-label": ord });
  const brak = (n, d) => h("span", { class: "br-brak", "aria-hidden": "true" },
    h("span", { class: "br-taljare" }, String(n)), h("span", { class: "br-namnare" }, String(d)));
  if (form.kind === "fraction") rot.append(brak(form.n, form.d));
  else if (form.kind === "mixed") {
    rot.append(h("span", { class: "br-heltal", "aria-hidden": "true" }, String(form.whole)), brak(form.n, form.d));
  } else rot.append(h("span", { class: "br-texttal", "aria-hidden": "true" }, formatForm(form)));
  return rot;
}

/** En räkneoperation/ett relationstecken med uppläst namn. */
export function opNod(op) {
  const t = OP_TEXT[op] || op;
  return h("span", { class: "br-op", role: "img", "aria-label": OP_ORD[t] || t }, t);
}

/** Uppläsning av ett helt uttryck (för rotens aria-label). */
export function uttryckOrd(expr) {
  return expr.map((x) => {
    if (x?.kind) return speakForm(x);
    if (x?.op) return OP_ORD[OP_TEXT[x.op]] || x.op;
    if (x?.text) return x.text;
    if (x?.okand) return "vad";
    return "";
  }).filter(Boolean).join(" ");
}

const falt = (namn, etikett, mode = "numeric") => h("input", {
  class: `br-falt br-falt--${namn}`, type: "text", inputmode: mode, autocomplete: "off", spellcheck: "false",
  "aria-label": etikett, maxlength: 9, "data-falt": namn,
});

/**
 * Svarsfälten för en inmatningstyp: fraction | mixed | integer | decimal | percent.
 * Svarar { el, falt: { namn: input }, svar(), satt(answer), rensa(), tolka() }.
 */
export function skapaInmatning(input) {
  const f = {};
  let el;
  if (input === "fraction" || input === "mixed") {
    f.n = falt("n", "Täljare");
    f.d = falt("d", "Nämnare");
    const brak = h("span", { class: "br-inbrak" }, f.n, h("span", { class: "br-instreck", "aria-hidden": "true" }), f.d);
    el = h("span", { class: "br-inmatning", role: "group", "aria-label": input === "mixed" ? "Svar i blandad form" : "Svar som bråk" });
    if (input === "mixed") {
      f.whole = falt("whole", "Heltal");
      el.append(f.whole);
    }
    el.append(brak);
  } else {
    const mode = input === "integer" ? "numeric" : "decimal";
    f.text = falt("text", input === "percent" ? "Procent" : input === "decimal" ? "Decimaltal" : "Tal", mode);
    el = h("span", { class: `br-inmatning br-inmatning--${input}` }, f.text,
      input === "percent" ? h("span", { class: "br-procent", "aria-hidden": "true" }, " %") : null);
  }
  const brakfalt = input === "fraction" || input === "mixed";
  return {
    el,
    falt: f,
    svar() {
      if (Object.values(f).every((x) => x.value.trim() === "")) return null;
      if (!brakfalt) return { text: f.text.value };
      const fields = { n: f.n.value, d: f.d.value };
      if (f.whole) fields.whole = f.whole.value;
      return { fields };
    },
    satt(answer) {
      const src = brakfalt ? answer?.fields || {} : { text: answer?.text ?? "" };
      for (const [k, x] of Object.entries(f)) x.value = src[k] ?? "";
    },
    rensa() { for (const x of Object.values(f)) x.value = ""; },
    tolka() {
      const parse = PARSERS[input];
      return brakfalt ? parse({ n: f.n.value, d: f.d.value, whole: f.whole?.value }) : parse(f.text.value);
    },
  };
}

/** Relationsväljaren: tre knappar <, =, > (aria-pressed, inte bara färg). */
export function skapaRelation(onVal) {
  let varde = null;
  const knappar = RELATIONS.map((r) => h("button", {
    type: "button", class: "br-relknapp", "aria-pressed": "false", "aria-label": RELATION_ORD[r], "data-rel": r,
  }, r));
  const el = h("span", { class: "br-relation", role: "group", "aria-label": "Välj jämförelsetecken" }, knappar);
  const visa = () => knappar.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.rel === varde)));
  el.addEventListener("click", (e) => {
    const k = e.target.closest(".br-relknapp");
    if (!k || k.getAttribute("aria-disabled") === "true") return;
    varde = varde === k.dataset.rel ? null : k.dataset.rel;
    visa();
    onVal?.();
  });
  return {
    el,
    svar: () => (varde ? { value: varde } : null),
    satt(a) { varde = RELATIONS.includes(a?.value) ? a.value : null; visa(); },
    rensa() { varde = null; visa(); },
  };
}

export function createNotation(host, view, opts = {}) {
  const typ = opts.answer?.type;
  const expr = [...(view.expr || [])];
  if (typ === "number" && !expr.some((x) => x?.input)) expr.push({ input: true });
  if (typ === "relation" && !expr.some((x) => x?.relation)) expr.splice(Math.min(1, expr.length), 0, { relation: true });
  const rad = h("div", { class: "br-uttryck" });
  const hjalp = h("div", { class: "br-inmatningshjalp", role: "status", "aria-live": "polite" });
  const rot = h("div", { class: "br-notation" }, rad, hjalp);
  const bas = skapaBas(host, rot, view, opts);
  const skicka = new Set();
  let inmatning = null;
  let relation = null;

  for (const x of expr) {
    if (x?.kind) rad.append(formNod(x));
    else if (x?.op) rad.append(opNod(x.op));
    else if (x?.text) rad.append(h("span", { class: "br-uttext" }, x.text));
    else if (x?.okand) rad.append(h("span", { class: "br-okand", role: "img", "aria-label": "det som söks" }, "?"));
    else if (x?.input && bas.interaktiv && typ === "number") {
      inmatning = skapaInmatning(opts.answer.input || "fraction");
      rad.append(inmatning.el);
    } else if (x?.relation && bas.interaktiv && typ === "relation") {
      relation = skapaRelation(() => bas.andrat());
      rad.append(relation.el);
    } else if (x?.relation || x?.input) rad.append(h("span", { class: "br-okand", "aria-hidden": "true" }, "?"));
  }
  rad.setAttribute("aria-label", uttryckOrd(expr));
  if (!inmatning && !relation) rad.setAttribute("role", "img");

  if (inmatning) {
    rot.addEventListener("input", () => { hjalp.textContent = ""; bas.andrat(); });
    rot.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || bas.last || !e.target.matches?.(".br-falt")) return;
      e.preventDefault();
      const r = inmatning.tolka();
      hjalp.textContent = r.ok ? "" : r.message;
      if (!r.ok) return;
      for (const cb of skicka) cb(bas.api.getAnswer());
    });
  }

  Object.assign(bas.api, {
    getAnswer: () => inmatning?.svar() ?? relation?.svar() ?? null,
    setAnswer(a) { inmatning?.satt(a); relation?.satt(a); hjalp.textContent = ""; },
    reset() { inmatning?.rensa(); relation?.rensa(); hjalp.textContent = ""; bas.andrat(); },
    /** Inmatningshjälpen före kontroll: { ok, message } (låser aldrig). */
    validate() {
      if (relation) return relation.svar() ? { ok: true } : { ok: false, message: "Välj <, = eller > först." };
      if (!inmatning) return { ok: true };
      const r = inmatning.tolka();
      hjalp.textContent = r.ok ? "" : r.message;
      return r;
    },
    /** Enter i ett giltigt fält (spec §4: "Enter får kontrollera"). */
    onSubmit(cb) { skicka.add(cb); return () => skicka.delete(cb); },
    focus() {
      const f = inmatning?.falt;
      (f ? f.whole || f.n || f.text : relation?.el.querySelector("button"))?.focus();
    },
    highlight(target) {
      rot.classList.toggle("br-pekar-uttryck", !!target);
    },
  });
  return bas.api;
}
