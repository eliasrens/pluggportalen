// ============================================================================
// Prov (#740): små DOM-hjälpare för frågetypernas vyer (renderElev …).
// Typfilerna importerar den här – men anropar den bara när en vy ritas, så
// registret går fortfarande att ladda i Node (testerna) utan DOM.
//
// renderElev(elevFraga, svar, { onChange, lasLage, onLamna?, attr?, uid? }) – kontraktet
// för elevens svarsruta (§2, §5.5; signaturen låst av leaden för B och C):
//   svar        nuvarande svar (typens form, docs/PROV.md)
//   onChange(v) eleven ändrade svaret → nytt värde i samma form (sparas automatiskt)
//   lasLage     true = bara visning, inga kontroller som ändrar något
//   onLamna()   (valfri) eleven lämnade rutan / gjorde ett färdigt val → spara snart
//   attr        (valfri) stavningsattributen för textfält (stavAttr, standard: av)
//   uid         (valfri) unikt prefix för id/name när flera prov ritas på en sida
// → ett HTMLElement. Tangentbord och skärmläsare fungerar med vanliga kontroller.
// ============================================================================

let nastaUid = 0;
/** Typfilernas interna kontext ur den låsta signaturen (se ovan). */
export function elevKontext(svar, o = {}) {
  return {
    svar,
    andra: o.onChange || (() => {}),
    lamna: o.onLamna || (() => {}),
    las: o.lasLage === true,
    attr: o.attr || stavAttr(false),
    uid: o.uid || `provv-f${++nastaUid}`,
  };
}

/** Skapa ett element: h("div", { class: "x", text: "…", on: { click } }, ...barn). */
export function h(tag, attrs = {}, ...barn) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const b of barn.flat()) if (b != null && b !== false) e.append(b);
  return e;
}

/**
 * Webbläsarens hjälp i textfälten (§5.5): stavningskontroll, autokorrigering,
 * versalisering och autofyll följer provets inställning – AV som standard
 * (ett stavningsprov med stavningskontroll vore meningslöst).
 */
export function stavAttr(stavningskontroll) {
  const pa = stavningskontroll === true;
  return {
    spellcheck: pa ? "true" : "false",
    autocorrect: pa ? "on" : "off",
    autocapitalize: pa ? "sentences" : "off",
    autocomplete: "off",
  };
}

/** Text med radbrytningar → stycken (textblock, frågetexter). */
export function stycken(text, cls = "") {
  const wrap = h("div", { class: cls });
  for (const p of String(text || "").split(/\n\s*\n/)) {
    if (p.trim()) wrap.append(h("p", { text: p.trim() }));
  }
  return wrap;
}

/**
 * Alternativ som eleven väljer bland (flerval, flerval-flera, sant/falskt).
 * @param {string[]} texter
 * @param {{ flera?: boolean, valda: number[], namn: string, las?: boolean, andra: (valda: number[]) => void, lamna: () => void, etikett: string }} o
 */
export function valLista(texter, o) {
  const lista = h("div", { class: `provv-val-lista${o.flera ? " provv-val-flera" : ""}`, role: o.flera ? "group" : "radiogroup", "aria-label": o.etikett });
  const valda = new Set(o.valda);
  texter.forEach((t, i) => {
    const input = h("input", {
      type: o.flera ? "checkbox" : "radio", name: o.namn, value: String(i), checked: valda.has(i), disabled: !!o.las,
    });
    input.addEventListener("change", () => {
      const nu = [...lista.querySelectorAll("input")].map((x, j) => (x.checked ? j : -1)).filter((j) => j >= 0);
      o.andra(nu);
      o.lamna();
    });
    lista.append(h("label", { class: "provv-val" }, input, h("span", { class: "provv-val-text", text: t })));
  });
  return lista;
}

/** Ett textfält som rapporterar ändringar (input) och när eleven lämnar det (blur). */
export function textFalt(tag, { varde = "", max, k, ...attrs }) {
  const f = h(tag, { ...k.attr, ...attrs, maxlength: max ? String(max) : null, disabled: !!k.las });
  f.value = varde ?? "";
  f.addEventListener("input", () => k.andra(f.value));
  f.addEventListener("blur", () => k.lamna());
  return f;
}

/** Ladda en stilfil i src/prov/ en gång (lat, utanför styles.css – #271). */
export function laddaCss(fil) {
  if (document.querySelector(`link[data-prov-css="${fil}"]`)) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(`./${fil}`, import.meta.url).href;
  link.dataset.provCss = fil;
  const klar = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return klar;
}
