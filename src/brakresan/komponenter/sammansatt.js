// ============================================================================
// Bråkresan – sammansatt uppgift (komponenter/sammansatt.js) · #710 E
// ----------------------------------------------------------------------------
// En uppgift med FLERA delar på arbetsytan: en bild och svarskort (02, 10),
// en figur och ja/nej-kort (01), två bilder och en jämförelse (09), en
// mängd att markera och ett bråkfält (07), en jämförelse och en förklaring
// (16, 17), föremål att gruppera och ett tal (20). Varje del är en vanlig
// komponent ur biblioteket; den här komponenten sätter ihop dem till ETT API.
//
// view = { component: "sammansatt", rad?: true, delar: [{
//   view,                  delens egen vy (vilken komponent som helst, även notation)
//   svar?: true | "id",    true = delen tar uppgiftens svar (enkel svarstyp);
//                          "id" = delen tar answer.parts[id] (svarstypen multi)
//   verktyg?: true,        interaktiv men utan svar (t.ex. grupperingen i 20)
//   rubrik?: "A",          kort rubrik ovanför delen
// }] }
// Svar: delens svar (enkel), eller multi { parts: { id: svar } }.
// highlight(target) går till alla delar, eller bara target.del (index).
// Efter kontroll av multi visas varje del rätt/fel (sparade delsvar, ingen delpoäng).
// ============================================================================

import { h, skapaBas } from "./bas.js";

export async function createSammansatt(host, view, opts = {}) {
  const { createComponent } = await import("./index.js");
  const typ = opts.answer?.type || null;
  const multi = typ === "multi";
  const lista = h("div", { class: `br-sammansatt-delar${view.rad ? " br-sammansatt-delar--rad" : ""}` });
  const rot = h("div", { class: "br-sammansatt" }, lista);
  const bas = skapaBas(host, rot, view, opts);
  const interaktiv = opts.interactive !== false;
  const delar = [];
  for (const d of view.delar || []) {
    const spec = !typ ? null : multi ? (typeof d.svar === "string" ? opts.answer.parts?.[d.svar] ?? null : null)
      : d.svar === true ? opts.answer : null;
    const yta = h("div", { class: `br-sammansatt-del br-sammansatt-del--${d.view?.component}` });
    if (d.rubrik) yta.append(h("div", { class: "br-sammansatt-rubrik" }, d.rubrik));
    lista.append(yta);
    const k = await createComponent(yta, d.view, {
      ...opts, answer: spec, label: d.label, size: d.size || opts.size,
      interactive: interaktiv && (!!spec || !!d.verktyg),
    });
    k.el.classList.add("br-k--inbaddad");
    delar.push({ d, k, spec, id: multi ? d.svar : d.svar === true ? "svar" : null });
  }
  const svarsdelar = delar.filter((x) => x.spec);
  const yttreRam = bas.api.showResult;

  Object.assign(bas.api, {
    getAnswer() {
      if (!multi) return svarsdelar[0]?.k.getAnswer() ?? null;
      const parts = {};
      let nagot = false;
      for (const x of svarsdelar) {
        const a = x.k.getAnswer();
        if (a) nagot = true;
        parts[x.id] = a ?? null;
      }
      return nagot ? { parts } : null;
    },
    setAnswer(a) {
      if (!multi) svarsdelar[0]?.k.setAnswer(a);
      else for (const x of svarsdelar) x.k.setAnswer(a?.parts?.[x.id] ?? null);
    },
    reset() { for (const x of delar) x.k.reset(); bas.andrat(); },
    setLocked(l) {
      rot.classList.toggle("br-k--last", !!l);
      for (const x of delar) x.k.setLocked(l);
    },
    showResult(r) {
      yttreRam(r);
      for (const x of svarsdelar) {
        if (!multi || !r || r.status === "invalid") x.k.showResult(null);
        else if (r.parts && x.id in r.parts) x.k.showResult({ status: "graded", correct: r.parts[x.id] });
      }
    },
    highlight(target) {
      delar.forEach((x, i) => {
        if (target && Number.isInteger(target.del) && target.del !== i) return x.k.highlight(null);
        x.k.highlight(target ? { ...target, del: undefined } : null);
      });
    },
    onChange(cb) { const av = delar.map((x) => x.k.onChange(() => cb(bas.api.getAnswer()))); return () => av.forEach((f) => f()); },
    onSubmit(cb) { const av = svarsdelar.map((x) => x.k.onSubmit?.(() => cb(bas.api.getAnswer())) || (() => {})); return () => av.forEach((f) => f()); },
    validate() {
      for (const x of svarsdelar) {
        const v = x.k.validate?.();
        if (v && v.ok === false) return { ...v, part: x.id };
      }
      return { ok: true };
    },
    focus() { (svarsdelar[0]?.k.focus ? svarsdelar[0].k.focus() : svarsdelar[0]?.k.el.querySelector("button, input, [tabindex='0']")?.focus()); },
    destroy() { for (const x of delar) x.k.destroy(); rot.remove(); },
    /** Delarnas komponenter (hjälpen, testläget). */
    delar: () => delar.map((x) => x.k),
    ready: Promise.all(delar.map((x) => x.k.ready).filter(Boolean)).then(() => undefined),
  });
  return bas.api;
}
