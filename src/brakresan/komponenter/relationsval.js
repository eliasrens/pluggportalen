// ============================================================================
// Bråkresan – jämförelse med ord (komponenter/relationsval.js) · #710 E
// ----------------------------------------------------------------------------
// Utmaning 09, 16, 17: välj <, = eller > mellan två värden. Spec §8 09:
// "Introducera relationstecknen med kort text 'är större än' och tillåt klick
// på textalternativ" – varje knapp har både tecknet och texten.
//
// view = { component: "relationsval", vanster: form | { text }, hoger: form | { text } }
// Svar: relation { value: "<" | "=" | ">" }.
// ============================================================================

import { h, skapaBas } from "./bas.js";
import { formNod } from "./notation.js";
import { RELATIONS } from "../math/index.js";

const TEXT = { "<": "är mindre än", "=": "är lika med", ">": "är större än" };

const sida = (x) => (x?.kind ? formNod(x, { klass: "br-tal--relation" }) : h("span", { class: "br-relsida-text" }, String(x?.text ?? "")));

export function createRelationsval(host, view, opts = {}) {
  const interaktiv = opts.interactive !== false && opts.answer?.type === "relation";
  let varde = null;
  const knappar = RELATIONS.map((r) => h(interaktiv ? "button" : "span", {
    type: interaktiv ? "button" : null, class: "br-relval", "data-rel": r, "aria-pressed": interaktiv ? "false" : null,
  }, h("span", { class: "br-relval-tecken", "aria-hidden": "true" }, r), h("span", { class: "br-relval-text" }, TEXT[r])));
  const val = h("div", { class: "br-relval-lista", role: "group", "aria-label": "Välj jämförelse" }, knappar);
  const rot = h("div", { class: "br-relationsval" },
    h("div", { class: "br-relsida" }, sida(view.vanster)), val, h("div", { class: "br-relsida" }, sida(view.hoger)));
  const bas = skapaBas(host, rot, view, { ...opts, interactive: interaktiv });
  const visa = () => knappar.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.rel === varde)));
  if (interaktiv) {
    val.addEventListener("click", (e) => {
      const k = e.target.closest(".br-relval");
      if (!k || bas.last) return;
      varde = varde === k.dataset.rel ? null : k.dataset.rel;
      visa();
      bas.andrat();
    });
  }
  Object.assign(bas.api, {
    getAnswer: () => (varde ? { value: varde } : null),
    setAnswer(a) { varde = RELATIONS.includes(a?.value) ? a.value : null; if (interaktiv) visa(); },
    reset() { varde = null; if (interaktiv) visa(); bas.andrat(); },
    validate: () => (varde ? { ok: true } : { ok: false, message: "Välj <, = eller > först." }),
    highlight(target) { rot.classList.toggle("br-pekar-uttryck", !!target?.whole); },
  });
  return bas.api;
}
