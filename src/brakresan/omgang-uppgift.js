// ============================================================================
// Bråkresan – en uppgift på arbetsytan (src/brakresan/omgang-uppgift.js) · #709 D
// ----------------------------------------------------------------------------
// monteraUppgift(host, publicTask, opts) → samma API som komponenternas
// mountTask (docs/BRAKRESAN.md §5) men för ALLA uppgifter i Bråkresan:
//   • vanliga uppgifter → mountTask (B:s bibliotek)
//   • "omdelning" (34, och fler flerstegsuppgifter med stavar + uttryck):
//     stavar med verktyget "Dela varje bit i k" och en uttrycksrad med flera
//     bråkfält – svaret är multi { parts: { id: { fields } } }
//   • kort med bråk (12): hjälpen kan visa en jämförelsestav under varje kort
//     (highlight { stavar: true }) – utan facitetikett
//   • tallinjen: skärmläsarens värdetext säger "streck 3 av 8", inte
//     bråknamnet, eftersom namnet skulle lösa placeringsuppgiften (§8 19)
// promptNod(text) skriver "3/5" i en text med vågrätt bråkstreck (§4).
// Används av omgångsvyn (omgang.js) och kan användas av lärarens testläge (K).
// ============================================================================

import { mountTask, createComponent } from "./komponenter/index.js";
import { h, ensureCss } from "./komponenter/bas.js";
import { formNod, opNod, skapaInmatning } from "./komponenter/notation.js";
import { fraction } from "./math/form.js";

const BRAK = /(\d+)\/(\d+)/g;

/** Text med bråk som riktig notation (vågrätt streck, uppläst "tre femtedelar"). */
export function promptNod(text, tag = "p", klass = "br-prompt") {
  const el = h(tag, { class: klass });
  let last = 0;
  for (const m of String(text).matchAll(BRAK)) {
    if (m.index > last) el.append(String(text).slice(last, m.index));
    const n = Number(m[1]);
    const d = Number(m[2]);
    el.append(d > 0 ? formNod(fraction(n, d), { klass: "br-tal--text" }) : m[0]);
    last = m.index + m[0].length;
  }
  if (last < String(text).length) el.append(String(text).slice(last));
  return el;
}

export async function monteraUppgift(host, task, opts = {}) {
  await ensureCss();
  if (task.view?.component === "omdelning") return monteraOmdelning(host, task, opts);
  const t = await mountTask(host, task, opts);
  if (task.view.component === "kort" && task.view.stavar) return medJamforelsestavar(t, task);
  if (task.view.component === "tallinje" && task.answer?.type === "point") doljVardenamn(t, task);
  return t;
}

/** 12: jämförelsestavar under korten när hjälpen ber om dem. */
function medJamforelsestavar(t, task) {
  const stavar = [];
  const visa = async () => {
    if (stavar.length) return;
    for (const c of task.view.cards) {
      const kort = t.el.querySelector(`[data-kort="${CSS.escape(String(c.id))}"]`);
      if (!kort || c.face?.kind !== "fraction") continue;
      const yta = h("span", { class: "br-jamforelsestav", "aria-hidden": "true" });
      kort.append(yta);
      stavar.push(yta);
      const k = await createComponent(yta, { component: "stav", parts: c.face.d, marked: c.face.n, label: " " },
        { interactive: false, size: "mini" });
      k.el.removeAttribute("role");
    }
  };
  const highlight = t.highlight;
  return {
    ...t,
    highlight(target) {
      if (target?.stavar) visa();
      highlight({ ...target, stavar: undefined });
    },
    destroy() { stavar.forEach((s) => s.remove()); t.destroy(); },
  };
}

/** 19: värdetexten för skärmläsare utan bråknamn ("Punkt på streck 3 av 8 från 0"). */
function doljVardenamn(t, task) {
  const svg = t.el.querySelector(".br-tallinje-svg");
  if (!svg) return;
  const ticks = task.view.ticks;
  const skriv = (a) => {
    const v = a?.value;
    svg.setAttribute("aria-valuetext", v ? `Punkt på streck ${(v.n * ticks) / v.d} av ${ticks} från 0` : "Ingen punkt placerad");
  };
  t.onChange(skriv);
  const set = t.setAnswer;
  t.setAnswer = (a) => { set(a); skriv(a); };
  svg.setAttribute("aria-label", `Tallinje från noll till ett, delad i ${ticks} lika mellanrum. Flytta punkten med piltangenterna.`);
}

/**
 * 34 m.fl.: view = { component: "omdelning", bars: [{ parts, marked, label, maxDela }], expr: [... { input: "id" } ...] }
 * answer = { type: "multi", parts: { id: { type: "number", input } } }
 */
async function monteraOmdelning(host, task, opts) {
  const view = task.view;
  const interaktiv = opts.interactive !== false;
  const lyssnare = new Set();
  const skicka = new Set();
  const andrat = () => { for (const cb of lyssnare) cb(api.getAnswer()); };
  const rot = h("div", { class: "br-omdelning" });
  host.append(rot);

  // Stavarna: en komponent per stav, ritas om med view.regroup = k när eleven delar om.
  const stavar = [];
  for (const [i, bar] of view.bars.entries()) {
    const rad = h("div", { class: "br-omdelning-rad" });
    const yta = h("div", { class: "br-omdelning-stav" });
    const status = h("span", { class: "br-omdelning-k", "aria-live": "polite" });
    const minus = h("button", { type: "button", class: "br-knapp br-verktygknapp", "aria-label": "Färre nya bitar" }, "−");
    const plus = h("button", { type: "button", class: "br-knapp br-verktygknapp", "aria-label": "Fler nya bitar" }, "+");
    const verktyg = h("div", { class: "br-omdelning-verktyg", role: "group", "aria-label": `Dela stav ${i + 1}` },
      h("span", null, "Dela varje bit i"), minus, status, plus);
    rad.append(h("div", { class: "br-omdelning-namn" }, formNod(fraction(bar.marked, bar.parts))), yta, interaktiv ? verktyg : null);
    rot.append(rad);
    const st = { bar, k: 1, yta, status, minus, plus, komp: null };
    stavar.push(st);
    const rita = async () => {
      st.komp?.destroy();
      st.komp = await createComponent(yta, { component: "stav", parts: bar.parts, marked: bar.marked, regroup: st.k > 1 ? st.k : undefined,
        label: "Hela staven = 1" }, { interactive: false, size: "stor" });
      status.textContent = st.k === 1 ? "1 (som nu)" : `${st.k} → ${bar.parts * st.k} bitar`;
      minus.disabled = st.k <= 1;
      plus.disabled = st.k >= (bar.maxDela || 1);
    };
    st.rita = rita;
    minus.addEventListener("click", () => { if (!last && st.k > 1) { st.k--; rita(); } });
    plus.addEventListener("click", () => { if (!last && st.k < (bar.maxDela || 1)) { st.k++; rita(); } });
    await rita();
  }

  // Uttrycksraden: givna bråk, tecken och elevens bråkfält.
  const falt = {};
  const rad = h("div", { class: "br-uttryck br-uttryck--multi" });
  const hjalp = h("div", { class: "br-inmatningshjalp", role: "status", "aria-live": "polite" });
  for (const x of view.expr || []) {
    if (x?.kind) rad.append(formNod(x));
    else if (x?.op) rad.append(opNod(x.op));
    else if (x?.input && interaktiv) {
      const spec = task.answer.parts[x.input];
      const f = skapaInmatning(spec?.input || "fraction");
      f.el.dataset.del = x.input;
      falt[x.input] = f;
      rad.append(f.el);
    } else if (x?.input) rad.append(h("span", { class: "br-okand", "aria-hidden": "true" }, "?"));
  }
  const notation = h("div", { class: "br-notation br-k br-k--stor" }, rad, hjalp);
  rot.append(notation);
  let last = false;
  rot.addEventListener("input", () => { hjalp.textContent = ""; andrat(); });
  rot.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || last || !e.target.matches?.(".br-falt")) return;
    e.preventDefault();
    const v = api.validate();
    if (v.ok) for (const cb of skicka) cb(api.getAnswer());
  });
  const markor = h("div", { class: "br-utfall", role: "status", "aria-live": "polite" });
  notation.append(markor);

  const api = {
    el: rot,
    model: null,
    getAnswer() {
      const parts = {};
      let nagot = false;
      for (const [id, f] of Object.entries(falt)) {
        const s = f.svar();
        if (s) nagot = true;
        parts[id] = s || { fields: { n: "", d: "" } };
      }
      return nagot ? { parts } : null;
    },
    setAnswer(a) { for (const [id, f] of Object.entries(falt)) f.satt(a?.parts?.[id]); },
    reset() {
      for (const f of Object.values(falt)) f.rensa();
      for (const st of stavar) { st.k = 1; st.rita(); }
      andrat();
    },
    setLocked(l) {
      last = !!l;
      rot.classList.toggle("br-k--last", last);
      for (const f of Object.values(falt)) for (const i of Object.values(f.falt)) i.readOnly = last;
      for (const st of stavar) { st.minus.disabled = last || st.k <= 1; st.plus.disabled = last || st.k >= (st.bar.maxDela || 1); }
    },
    showResult(r) {
      notation.classList.remove("br-k--ratt", "br-k--fel");
      markor.textContent = "";
      for (const f of Object.values(falt)) f.el.classList.remove("br-del-ratt", "br-del-fel");
      if (!r || r.status === "invalid") return;
      notation.classList.add(r.correct ? "br-k--ratt" : "br-k--fel");
      markor.append(h("span", { class: "br-utfall-ikon", "aria-hidden": "true" }, r.correct ? "✓" : "↻"), r.correct ? "Rätt!" : "Inte riktigt ännu");
      // Vilka fält som inte stämde (efter kontroll – sparade delsvar, ingen delpoäng).
      for (const [id, ok] of Object.entries(r.parts || {})) falt[id]?.el.classList.add(ok ? "br-del-ratt" : "br-del-fel");
    },
    highlight(target) {
      rot.classList.toggle("br-pekar-helhet", !!target?.whole);
      for (const st of stavar) st.komp?.highlight(target?.whole ? { whole: true } : target?.count ? { count: true } : null);
    },
    onChange(cb) { lyssnare.add(cb); return () => lyssnare.delete(cb); },
    onSubmit(cb) { skicka.add(cb); return () => skicka.delete(cb); },
    /** Inmatningshjälp före kontroll (tomt fält, nämnare 0 …) – låser aldrig. */
    validate() {
      for (const [id, f] of Object.entries(falt)) {
        const r = f.tolka();
        if (!r.ok) {
          hjalp.textContent = r.error === "tom" ? "Fyll i alla bråken." : r.message;
          f.falt.n?.focus();
          return { ok: false, message: hjalp.textContent, part: id };
        }
      }
      hjalp.textContent = "";
      return { ok: true };
    },
    focus() { Object.values(falt)[0]?.falt.n?.focus(); },
    destroy() { for (const st of stavar) st.komp?.destroy(); rot.remove(); },
  };
  return api;
}
