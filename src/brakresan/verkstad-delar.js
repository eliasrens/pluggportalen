// ============================================================================
// Bråkresan – verkstadens övriga delar (src/brakresan/verkstad-delar.js) · #711 F
// ----------------------------------------------------------------------------
// Delarna i view.component "verkstad" (omgang-verkstad.js) som inte är stavar:
// mängd med grupperingsverktyg (29), modell som bild (28), val (25, 33),
// uttrycksraden med svarsfält, relationsväljare och ruta inne i ett bråk (22),
// och det frivilliga mellansteget (30). Samma delgränssnitt som verkstad-stav.js.
// ============================================================================

import { createComponent } from "./komponenter/index.js";
import { h } from "./komponenter/bas.js";
import { formNod, opNod, skapaInmatning, skapaRelation } from "./komponenter/notation.js";
import { promptNod } from "./omgang-uppgift.js";

const delId = (i) => `p${i}`;

// ---------------------------------------------------------------------------
// Mängd med grupperingsverktyg (29)
// ---------------------------------------------------------------------------

export async function skapaMangd(rot, def, ctx) {
  const { interaktiv, opts } = ctx;
  const parts = Array.from({ length: def.count }, (_, i) => delId(i));
  let g = 1;
  let komp = null;
  const yta = h("div", { class: "bvk-mangd-yta" });
  const status = h("span", { class: "bvk-status", "aria-live": "polite" });
  const medd = h("p", { class: "bvk-ihop-medd", "aria-live": "polite" });
  const el = h("div", { class: "bvk-mangd" });
  rot.append(el);
  const knapp = (text, etikett, fn) => h("button", { type: "button", class: "br-knapp br-verktygknapp", "aria-label": etikett, onclick: () => { if (!ctx.bas.last) fn(); } }, text);
  const minus = knapp("−", "Färre grupper", () => { if (g > 1) { g--; bygg(); } });
  const plus = knapp("+", "Fler grupper", () => { if (g < (def.maxGrupper || 10)) { g++; bygg(); } });
  if (interaktiv) el.append(h("div", { class: "bvk-verktyg" }, h("div", { class: "bvk-verktyg-grupp", role: "group", "aria-label": "Dela i grupper" }, h("span", null, "Dela i"), minus, status, plus, h("span", null, "lika grupper")), medd));
  el.append(yta);
  async function bygg(svar = null) {
    const delbar = g > 1 && def.count % g === 0;
    status.textContent = String(g);
    medd.textContent = g === 1 ? "" : delbar ? `${def.count} delat i ${g} lika stora grupper.` : `${def.count} går inte att dela i ${g} lika stora grupper. Prova ett annat antal.`;
    minus.disabled = ctx.bas.last || g <= 1;
    plus.disabled = ctx.bas.last || g >= (def.maxGrupper || 10);
    komp?.destroy();
    komp = await createComponent(yta, { component: "mangd", count: def.count, item: def.item, groups: delbar ? g : 0, label: def.label },
      { answer: interaktiv ? { type: "paint", parts } : null, interactive: interaktiv, size: opts.size || "stor" });
    komp.onChange(() => ctx.andrat());
    if (svar) komp.setAnswer(svar);
    if (ctx.bas.last) komp.setLocked(true);
    ctx.andrat();
  }
  await bygg();
  return {
    id: def.id,
    el,
    svar: () => komp?.getAnswer() ?? null,
    satt(a) { komp?.setAnswer(a); },
    rensa() { g = 1; bygg(); },
    las(l) { komp?.setLocked(l); minus.disabled = l || g <= 1; plus.disabled = l || g >= (def.maxGrupper || 10); },
    validera: () => (komp?.getAnswer() ? null : "Markera föremålen i grupperna först."),
    highlight(t) { komp?.highlight(t?.whole ? { whole: true } : t?.groups ? { groups: true } : null); },
    destroy() { komp?.destroy(); },
  };
}

// ---------------------------------------------------------------------------
// Modell som bild (28): en vanlig komponent, ev. bara i hjälpen
// ---------------------------------------------------------------------------

export async function skapaModell(rot, view, ctx) {
  const el = h("div", { class: `bvk-modell${view.modellIHjalp ? " bvk-ihjalp" : ""}` });
  if (view.modellIHjalp) el.hidden = true;
  rot.append(el);
  const komp = await createComponent(el, view.modell, { interactive: false, size: ctx.opts.size === "kort" ? "kort" : "stor" });
  return {
    id: null, el, svar: () => null, satt() {}, rensa() {}, las() {}, validera: () => null,
    highlight(t) { if (view.modellIHjalp) el.hidden = !t?.stavar; komp.highlight?.(t?.whole ? { whole: true } : null); },
    destroy() { komp.destroy(); },
  };
}

// ---------------------------------------------------------------------------
// Val (25 resonemang, 33 elevlösning + förklaring)
// ---------------------------------------------------------------------------

export async function skapaFraga(rot, f, ctx) {
  const { interaktiv } = ctx;
  let vald = null;
  const rader = f.stil === "rader";
  const lista = h("div", { class: `bvk-val${rader ? " bvk-val--rader" : ""}`, role: "group", "aria-label": f.text });
  const el = h("div", { class: `bvk-fraga${rader ? " bvk-losning" : ""}` }, h("p", { class: "bvk-fragetext" }, f.text), lista);
  rot.append(el);
  const knappar = [];
  const stavYtor = [];
  for (const o of f.options) {
    const innehall = h("span", { class: "bvk-valtext" });
    if (o.etikett) innehall.append(h("strong", { class: "bvk-radnamn" }, `${o.etikett}: `));
    innehall.append(promptNod(o.text, "span", "bvk-valrad"));
    const k = h(interaktiv ? "button" : "div", { class: `bvk-valknapp${o.etikett ? " bvk-valknapp--rad" : ""}`, type: interaktiv ? "button" : null, "aria-pressed": interaktiv ? "false" : null, "data-val": o.id },
      h("span", { class: "bvk-valbock", "aria-hidden": "true" }), innehall);
    if (o.stavar?.length) {
      const yta = h("div", { class: "bvk-radstavar", "aria-hidden": "true", hidden: "" });
      k.append(yta);
      stavYtor.push({ yta, bars: o.stavar, komp: null });
    }
    if (interaktiv) k.addEventListener("click", () => { if (ctx.bas.last) return; vald = vald === o.id ? null : o.id; visa(); ctx.andrat(); });
    lista.append(k);
    knappar.push(k);
  }
  const visa = () => {
    for (const k of knappar) {
      const pa = k.dataset.val === vald;
      k.classList.toggle("bvk-vald", pa);
      if (interaktiv) k.setAttribute("aria-pressed", String(pa));
      k.querySelector(".bvk-valbock").textContent = pa ? "✓" : "";
    }
  };
  return {
    id: f.id,
    el,
    svar: () => (vald ? { id: vald } : null),
    satt(a) { vald = f.options.some((o) => o.id === a?.id) ? a.id : null; visa(); },
    rensa() { vald = null; visa(); },
    las() {},
    validera: () => (vald ? null : rader ? "Välj raden med felet – eller Inget fel." : "Välj också varför."),
    fokus() { knappar[0]?.focus(); },
    async highlight(t) {
      for (const x of stavYtor) {
        x.yta.hidden = !t?.stavar;
        if (t?.stavar && !x.komp) {
          x.komp = await createComponent(x.yta, { component: "stav", bars: x.bars, label: "Före (överst) och efter – samma helhet" },
            { interactive: false, size: "kort" });
          x.komp.el.removeAttribute("role");
        }
      }
    },
    destroy() { for (const x of stavYtor) x.komp?.destroy(); },
  };
}

// ---------------------------------------------------------------------------
// Uttrycksraden: bråk, tecken, svarsfält, relationsväljare, ruta inne i ett bråk
// ---------------------------------------------------------------------------

export function skapaUttryck(rot, expr, ctx) {
  const { interaktiv, specFor } = ctx;
  const rad = h("div", { class: "br-uttryck br-uttryck--multi bvk-uttryck" });
  const notation = h("div", { class: "br-notation bvk-notation" }, rad);
  rot.append(notation);
  const ut = [];
  const pilar = [];
  for (const x of expr) {
    if (x?.kind) rad.append(formNod(x));
    else if (x?.op) {
      if (x.pilar) {
        const upp = h("span", { class: "bvk-pil bvk-pil--upp", hidden: "" }, `↷ ${x.pilar} ?`);
        const ner = h("span", { class: "bvk-pil bvk-pil--ner", hidden: "" }, `↷ ${x.pilar} ?`);
        pilar.push(upp, ner);
        rad.append(h("span", { class: "bvk-pilop" }, upp, opNod(x.op), ner));
      } else rad.append(opNod(x.op));
    } else if (x?.text) rad.append(h("span", { class: "br-uttext" }, x.text));
    else if (x?.input) {
      if (!interaktiv) { rad.append(h("span", { class: "br-okand", "aria-hidden": "true" }, "?")); continue; }
      const spec = specFor(x.input);
      const f = skapaInmatning(spec?.input || "fraction");
      f.el.dataset.del = x.input;
      rad.append(f.el);
      ut.push(faltDel(x.input, f, f.el, ctx));
    } else if (x?.relation) {
      if (!interaktiv) { rad.append(h("span", { class: "br-okand", "aria-hidden": "true" }, "?")); continue; }
      const r = skapaRelation(() => ctx.andrat());
      rad.append(r.el);
      ut.push({
        id: x.relation, el: r.el, svar: r.svar, satt: r.satt, rensa: r.rensa, las() {},
        validera: () => (r.svar() ? null : "Välj <, = eller > först."),
        fokus() { r.el.querySelector("button")?.focus(); },
        highlight() {},
      });
    } else if (x?.brak) {
      const plats = (v, klass) => {
        if (!v?.input) return h("span", { class: klass }, String(v));
        if (!interaktiv) return h("span", { class: klass }, h("span", { class: "br-okand bvk-ruta", "aria-hidden": "true" }, "?"));
        const f = skapaInmatning("integer");
        f.falt.text.classList.add("bvk-ruta-falt");
        f.falt.text.setAttribute("aria-label", v === x.brak.n ? "Täljaren som saknas" : "Nämnaren som saknas");
        ut.push(faltDel(v.input, f, f.falt.text, ctx));
        return h("span", { class: klass }, f.falt.text);
      };
      const ord = x.brak.n?.input ? `vad delat med ${x.brak.d}` : `${x.brak.n} delat med vad`;
      rad.append(h("span", { class: "br-tal bvk-brakruta", role: "group", "aria-label": `Bråket ${ord}` },
        h("span", { class: "br-brak" }, plats(x.brak.n, "br-taljare"), plats(x.brak.d, "br-namnare"))));
    }
  }
  rad.addEventListener("input", () => ctx.andrat());
  // Pilarna och uttrycket lyfts av hjälpen ({ pilar: true }); det är en egen del utan svar.
  ut.push({
    id: null, el: notation, svar: () => null, satt() {}, rensa() {}, las() {}, validera: () => null,
    highlight(t) {
      for (const p of pilar) p.hidden = !t?.pilar;
      notation.classList.toggle("br-pekar-uttryck", !!t?.pilar);
    },
  });
  return ut;
}

function faltDel(id, f, el, ctx) {
  void ctx;
  return {
    id, el,
    svar: () => f.svar(),
    satt: (a) => f.satt(a),
    rensa: () => f.rensa(),
    las() {},
    validera() {
      const r = f.tolka();
      return r.ok ? null : r.error === "tom" ? "Fyll i alla rutor." : r.message;
    },
    fokus() { (f.falt.whole || f.falt.n || f.falt.text)?.focus(); },
    highlight() {},
  };
}

/** 30: frivilligt mellansteg – sparas inte och bedöms aldrig. */
export function skapaDelsteg(def) {
  const falt = h("input", { class: "br-falt br-falt--text bvk-delsteg-falt", type: "text", inputmode: "numeric", autocomplete: "off", maxlength: 6, "aria-label": `${def.text} (frivilligt)` });
  return h("div", { class: "bvk-delsteg" },
    h("span", { class: "bvk-delsteg-text" }, promptNod(def.text, "span", "")), falt, h("span", null, def.enhet),
    h("span", { class: "bvk-svag" }, "(frivilligt mellansteg – räknas inte)"));
}
