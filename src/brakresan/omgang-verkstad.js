// ============================================================================
// Bråkresan – verkstaden: arbetsytan för flerdelade uppgifter
// (src/brakresan/omgang-verkstad.js) · #711 F
// ----------------------------------------------------------------------------
// view.component "verkstad" (docs/BRAKRESAN.md §5c). En uppgift byggs av
// delar som var och en ritas ur uppgiftens data och – om den har ett id –
// lämnar ett delsvar (answer.type "multi") eller hela svaret (enkel svarstyp):
//
//   stavar   [{ id, parts, marked, monster?: "a"|"b", namn?: form, helhet?,
//               verktyg?: ["dela" | "ihop" | "bort" | "mala" | "flytta"],
//               maxDela?, ihop?: [g …], etiketter?: [{ fran, till, text }],
//               iHjalp? }]
//            dela   "Dela varje bit i k" – helhet och färgad längd oförändrade (25, 35)
//            ihop   "Slå ihop g bitar till en" – samma grupper av ALLA bitar;
//                   en delvis färgad grupp sägs ut i stället för en färdig
//                   förkortning (21)
//            bort   klicka bort färgade bitar – de tonas och får streckad kontur,
//                   ramen och delningen står kvar (32: delsvar `id`, 35: verktyg)
//            mala   markera delar (29: bandets grupper, delsvar `id`)
//            flytta flytta den färgade biten till mallen (31)
//            iHjalp staven syns bara medan hjälpen pekar på { stavar: true }
//   mall     { id, parts, kallor: [stavId …], helhet } – den tomma helhetsmallen
//            som bitarna flyttas till (31); delsvar paint med de fyllda delarna
//   mangd    { id, count, item, maxGrupper, label } – mängdbild med verktyget
//            "Dela i g lika grupper" och markering (29); delsvar paint
//   modell   en vanlig komponentvy (stav, cirkel …) som bild; modellIHjalp =
//            syns bara medan hjälpen pekar på { stavar: true } (28)
//   expr     uttrycksraden: form | { op, pilar? } | { text } | { input: id } |
//            { relation: id } | { brak: { n, d } } där n eller d är { input: id }
//            (22: talet i rutan inne i bråket); pilar "×"/"÷" visar pilar mellan
//            täljarna och nämnarna i hjälpen ({ pilar: true }), aldrig faktorn
//   fragor   [{ id, text, options: [{ id, text, etikett?, stavar? }], stil? }] –
//            val (choice); stil "rader" = en elevlösning där raderna väljs (33),
//            radernas före/efter-stavar syns bara i hjälpen
//   delsteg  { text, enhet } – frivilligt fält för ett mellansteg; bedöms aldrig (30)
//
// API som mountTask (docs §5): el, getAnswer, setAnswer, reset, setLocked,
// showResult, highlight, onChange, onSubmit, validate, focus, destroy.
// Inmatningshjälp (validate) låser aldrig: "Välj ett tecken", "Flytta båda
// bitarna …". Sidan bedömer; vyn vet ingenting om facit.
// ============================================================================

import { h, ensureCss, skapaBas } from "./komponenter/bas.js";
import { ensureRander, skapaStav, skapaMall } from "./verkstad-stav.js";
import { skapaMangd, skapaModell, skapaFraga, skapaUttryck, skapaDelsteg } from "./verkstad-delar.js";

let cssLaddad = null;
function ensureVerkstadCss() {
  if (cssLaddad) return cssLaddad;
  if (typeof document === "undefined" || document.querySelector("link[data-br-verkstad-css]")) {
    cssLaddad = Promise.resolve();
    return cssLaddad;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./verkstad.css", import.meta.url).href;
  link.dataset.brVerkstadCss = "";
  cssLaddad = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return cssLaddad;
}

export async function monteraVerkstad(host, task, opts = {}) {
  await Promise.all([ensureCss(), ensureVerkstadCss()]);
  ensureRander();
  const view = task.view;
  const answer = task.answer || null;
  const multi = answer?.type === "multi";
  const specFor = (id) => (multi ? answer.parts[id] : answer);
  const rot = h("div", { class: "bvk" });
  const bas = skapaBas(host, rot, view, opts);
  const interaktiv = bas.interaktiv && !!answer;
  const hjalpRad = h("div", { class: "br-inmatningshjalp", role: "status", "aria-live": "polite" });
  const skicka = new Set();
  const delar = []; // { id, el, svar, satt, rensa, las, highlight, validera, destroy }
  const ctx = { bas, interaktiv, opts, specFor, delar, andrat: () => { hjalpRad.textContent = ""; bas.andrat(); } };

  if (view.modell) delar.push(await skapaModell(rot, view, ctx));
  const stavDelar = [];
  for (const def of view.stavar || []) {
    const d = skapaStav(rot, def, ctx);
    stavDelar.push(d);
    delar.push(d);
  }
  if (view.mall) delar.push(skapaMall(rot, view.mall, stavDelar, ctx));
  if (view.mangd) delar.push(await skapaMangd(rot, view.mangd, ctx));
  for (const f of view.fragor || []) delar.push(await skapaFraga(rot, f, ctx));
  if (view.expr?.length) delar.push(...skapaUttryck(rot, view.expr, ctx));
  if (view.delsteg && interaktiv) rot.append(skapaDelsteg(view.delsteg));
  rot.append(hjalpRad);

  // Enter i ett fält kontrollerar när allt är giltigt (spec §4).
  rot.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || bas.last || !e.target.matches?.(".br-falt") || e.target.closest(".bvk-delsteg")) return;
    e.preventDefault();
    if (api.validate().ok) for (const cb of skicka) cb(api.getAnswer());
  });

  const svarsdelar = () => delar.filter((d) => d.id);
  const api = bas.api;
  // skapaBas äger låsflaggan och utfallsmarkören – dess egna setLocked/showResult används.
  const basLas = api.setLocked;
  const basVisa = api.showResult;
  Object.assign(api, {
    model: null,
    getAnswer() {
      if (!interaktiv) return null;
      if (!multi) return svarsdelar()[0]?.svar() ?? null;
      const parts = {};
      for (const d of svarsdelar()) {
        const v = d.svar();
        if (v) parts[d.id] = v;
      }
      return Object.keys(parts).length ? { parts } : null;
    },
    setAnswer(a) {
      if (!multi) svarsdelar()[0]?.satt(a);
      else for (const d of svarsdelar()) d.satt(a?.parts?.[d.id]);
      hjalpRad.textContent = "";
    },
    reset() {
      for (const d of delar) d.rensa();
      hjalpRad.textContent = "";
      bas.andrat();
    },
    setLocked(l) {
      basLas(l);
      for (const d of delar) d.las(!!l);
      for (const f of rot.querySelectorAll(".bvk-delsteg input")) f.readOnly = false; // mellansteget är alltid fritt
    },
    showResult(r) {
      basVisa(r);
      for (const d of delar) d.el?.classList.remove("br-del-ratt", "br-del-fel");
      if (!r || r.status === "invalid" || !multi) return;
      for (const d of svarsdelar()) if (r.parts && d.id in r.parts) d.el?.classList.add(r.parts[d.id] ? "br-del-ratt" : "br-del-fel");
    },
    highlight(target) {
      rot.classList.toggle("br-pekar-helhet", !!target?.whole);
      for (const d of delar) d.highlight?.(target || null);
    },
    onSubmit(cb) { skicka.add(cb); return () => skicka.delete(cb); },
    /** Inmatningshjälp före kontroll – låser aldrig. */
    validate() {
      for (const d of svarsdelar()) {
        const m = d.validera();
        if (m) {
          // Sidan visar meddelandet (omgång.js) – här bara fokus till delen som saknas.
          d.fokus?.();
          return { ok: false, message: m, part: d.id };
        }
      }
      return { ok: true };
    },
    focus() { (rot.querySelector(".br-falt") || rot.querySelector("button:not([disabled]), [tabindex='0']"))?.focus(); },
  });
  const destroy = api.destroy;
  api.destroy = () => { for (const d of delar) d.destroy?.(); destroy(); };
  return api;
}
