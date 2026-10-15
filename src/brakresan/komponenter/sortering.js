// ============================================================================
// Bråkresan – 9. Sorteringsyta (komponenter/sortering.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 9: ordning och kategorier med både dragning och klick/
// kontroller. Dragning kräver ingen precision (släpp var som helst över facket
// eller platsen) och har alltid ett klickalternativ. Facken visar aldrig rätt
// svar före kontroll – de är bara etiketter.
//
// view = { component: "sortering", cards: [{ id, face }],
//          bins?: [{ id, label, face? }],            kategorier (answer.type "categories");
//                                                    face = ankarkort i facket (E #710, 15)
//          order?: true, ends?: ["Minst", "Störst"] } ordning (answer.type "order")
// Ordning:    klick på ett kort i högen lägger det på första lediga plats; ett
//             lagt kort väljs med klick och flyttas med knapparna ◀ ▶ (eller
//             pilarna), "Tillbaka till högen" (eller Delete). Dra = lägg/byt plats.
// Kategorier: klick på ett kort väljer det, klick på ett fack lägger det där.
//             Dra till ett fack = samma sak.
// Svar: order { ids } (platserna i ordning) · categories { bins: { fack: [id] } }
// ============================================================================

import { h, skapaBas } from "./bas.js";
import { kortFramsida } from "./kort.js";

export function createSortering(host, view, opts = {}) {
  const lage = opts.answer?.type === "categories" || (view.bins?.length && !view.order) ? "fack" : "ordning";
  const kortData = new Map(view.cards.map((c) => [String(c.id), c]));
  const hog = h("div", { class: "br-hog", role: "list", "aria-label": "Kort som inte är sorterade" });
  const yta = h("div", { class: lage === "fack" ? "br-fackrad" : "br-platsrad" });
  const verktyg = h("div", { class: "br-sortverktyg", hidden: true });
  const status = h("div", { class: "br-kortstatus", "aria-live": "polite" });
  const rot = h("div", { class: `br-sortering br-sortering--${lage}` }, yta, verktyg, hog, status);
  const bas = skapaBas(host, rot, view, opts);
  const vantan = [];
  const n = view.cards.length;
  let platser = Array(n).fill(null);                                    // ordning
  let fack = Object.fromEntries((view.bins || []).map((b) => [String(b.id), []])); // kategorier
  let vald = null;

  const kortEl = new Map();
  for (const [i, c] of view.cards.entries()) {
    const el = h("button", { type: "button", class: "br-kort br-kort--sort", "data-kort": String(c.id), "aria-pressed": "false" },
      h("span", { class: "br-kortbock", "aria-hidden": "true" }), kortFramsida(c.face, vantan),
      h("span", { class: "br-kortnamn" }, `Kort ${i + 1}`));
    kortEl.set(String(c.id), el);
  }
  const platsEl = lage === "ordning" ? platser.map((_, i) => h("div", {
    class: "br-plats", "data-plats": String(i), role: "listitem",
    "aria-label": `Plats ${i + 1}${i === 0 ? ` – ${view.ends?.[0] || "minst"}` : i === n - 1 ? ` – ${view.ends?.[1] || "störst"}` : ""}`,
  }, h("span", { class: "br-platsnr", "aria-hidden": "true" }, String(i + 1)))) : [];
  const fackEl = lage === "fack" ? (view.bins || []).map((b) => h("div", { class: "br-fack", "data-fack": String(b.id) },
    b.face ? h("div", { class: "br-fackankare" }, kortFramsida(b.face, vantan, "kort")) : null,
    h("button", { type: "button", class: "br-fackknapp", "data-fack": String(b.id) }, b.label),
    h("div", { class: "br-fackinnehall", role: "list", "aria-label": b.label }))) : [];
  if (lage === "ordning") {
    yta.append(h("div", { class: "br-andar", "aria-hidden": "true" },
      h("span", null, `← ${view.ends?.[0] || "Minst"}`), h("span", null, `${view.ends?.[1] || "Störst"} →`)),
    h("div", { class: "br-platser", role: "list", "aria-label": "Ordningen" }, platsEl));
  } else yta.append(...fackEl);

  const lagd = (id) => (lage === "ordning" ? platser.includes(id) : Object.values(fack).some((l) => l.includes(id)));

  function rita() {
    for (const [id, el] of kortEl) {
      el.classList.toggle("br-vald", vald === id);
      el.setAttribute("aria-pressed", String(vald === id));
      el.querySelector(".br-kortbock").textContent = vald === id ? "✓" : "";
      el.classList.toggle("br-kort--lagd", lagd(id));
    }
    hog.replaceChildren(...[...kortEl.keys()].filter((id) => !lagd(id)).map((id) => kortEl.get(id)));
    if (lage === "ordning") {
      platsEl.forEach((p, i) => {
        p.querySelector(".br-kort")?.remove();
        if (platser[i]) p.append(kortEl.get(platser[i]));
        p.classList.toggle("br-plats--tom", !platser[i]);
      });
      status.textContent = `Ordnade: ${platser.filter(Boolean).length} av ${n}`;
    } else {
      for (const f of fackEl) {
        const lista = fack[f.dataset.fack];
        f.querySelector(".br-fackinnehall").replaceChildren(...lista.map((id) => kortEl.get(id)));
        const knapp = f.querySelector(".br-fackknapp");
        const etikett = view.bins.find((b) => String(b.id) === f.dataset.fack).label;
        knapp.textContent = vald ? `Lägg i: ${etikett}` : etikett;
        knapp.classList.toggle("br-fackknapp--redo", !!vald);
      }
      status.textContent = `Sorterade: ${Object.values(fack).flat().length} av ${n}${vald ? " – välj ett fack" : ""}`;
    }
    verktyg.hidden = !(lage === "ordning" && vald && platser.includes(vald)) && !(lage === "fack" && vald && lagd(vald));
  }

  const taBort = (id) => {
    if (lage === "ordning") platser = platser.map((x) => (x === id ? null : x));
    else for (const k of Object.keys(fack)) fack[k] = fack[k].filter((x) => x !== id);
  };
  /** Lägg kortet på plats i (byter plats med ett kort som redan står där). */
  const laggPa = (id, i) => {
    const fran = platser.indexOf(id);
    const dar = platser[i];
    if (fran >= 0) platser[fran] = dar; else if (dar) platser[platser.indexOf(null)] = dar;
    platser[i] = id;
  };
  const laggIFack = (id, f) => { taBort(id); fack[f].push(id); };
  const klar = (fokus) => { rita(); bas.andrat(); fokus?.focus(); };

  function klickKort(id) {
    if (bas.last || !bas.interaktiv) return;
    if (lage === "ordning" && !platser.includes(id)) {
      const ledig = platser.indexOf(null);
      if (ledig >= 0) laggPa(id, ledig);
      vald = null;
    } else vald = vald === id ? null : id;
    klar(kortEl.get(id));
  }

  if (lage === "ordning") {
    verktyg.append(
      h("button", { type: "button", class: "br-verktygknapp", "data-gor": "-1" }, "◀ Flytta vänster"),
      h("button", { type: "button", class: "br-verktygknapp", "data-gor": "1" }, "Flytta höger ▶"),
      h("button", { type: "button", class: "br-verktygknapp", "data-gor": "hog" }, "Tillbaka till högen"));
  } else verktyg.append(h("button", { type: "button", class: "br-verktygknapp", "data-gor": "hog" }, "Tillbaka till högen"));
  const gor = (vad) => {
    if (!vald || bas.last) return;
    const id = vald;
    if (vad === "hog") { taBort(id); vald = null; return klar(kortEl.get(id)); }
    const i = platser.indexOf(id);
    const j = i + Number(vad);
    if (j < 0 || j >= n) return;
    [platser[i], platser[j]] = [platser[j], platser[i]];
    klar(kortEl.get(id));
  };
  verktyg.addEventListener("click", (e) => gor(e.target.closest("[data-gor]")?.dataset.gor));

  // --- Dra och släpp (pekare), annars klick ---------------------------------
  let drag = null;
  let svaljKlick = false;
  rot.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".br-kort--sort");
    if (!el || bas.last || !bas.interaktiv) return;
    drag = { id: el.dataset.kort, el, x: e.clientX, y: e.clientY, spok: null, pid: e.pointerId };
  });
  rot.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.spok && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      drag.el.setPointerCapture?.(e.pointerId);
      const r = drag.el.getBoundingClientRect();
      drag.spok = drag.el.cloneNode(true);
      drag.spok.classList.add("br-spok");
      Object.assign(drag.spok.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
      drag.dx = e.clientX - r.left;
      drag.dy = e.clientY - r.top;
      document.body.append(drag.spok);
      drag.el.classList.add("br-dras");
    }
    if (drag.spok) {
      drag.spok.style.left = `${e.clientX - drag.dx}px`;
      drag.spok.style.top = `${e.clientY - drag.dy}px`;
    }
  });
  const slapp = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.spok) return;
    d.spok.remove();
    d.el.classList.remove("br-dras");
    svaljKlick = true;
    setTimeout(() => { svaljKlick = false; }, 0);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const plats = under?.closest?.(".br-plats");
    const f = under?.closest?.(".br-fack");
    if (plats && lage === "ordning") laggPa(d.id, Number(plats.dataset.plats));
    else if (f && lage === "fack") laggIFack(d.id, f.dataset.fack);
    else if (under?.closest?.(".br-hog")) taBort(d.id);
    else return;
    vald = null;
    klar();
  };
  rot.addEventListener("pointerup", slapp);
  rot.addEventListener("pointercancel", () => { if (drag?.spok) drag.spok.remove(); drag?.el.classList.remove("br-dras"); drag = null; });
  bas.stad(() => drag?.spok?.remove());

  rot.addEventListener("click", (e) => {
    if (svaljKlick) return;
    const fk = e.target.closest(".br-fackknapp");
    if (fk && vald && !bas.last) { const id = vald; laggIFack(id, fk.dataset.fack); vald = null; return klar(kortEl.get(id)); }
    const el = e.target.closest(".br-kort--sort");
    if (el) klickKort(el.dataset.kort);
  });
  rot.addEventListener("keydown", (e) => {
    const el = e.target.closest(".br-kort--sort");
    if (!el || bas.last) return;
    const id = el.dataset.kort;
    if ((e.key === "Delete" || e.key === "Backspace") && lagd(id)) { e.preventDefault(); vald = id; gor("hog"); }
    else if (lage === "ordning" && platser.includes(id) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      vald = id;
      gor(e.key === "ArrowLeft" ? "-1" : "1");
    }
  });

  rita();
  Object.assign(bas.api, {
    getAnswer() {
      if (lage === "ordning") {
        const ids = platser.filter(Boolean);
        return ids.length ? { ids } : null;
      }
      return Object.values(fack).some((l) => l.length) ? { bins: Object.fromEntries(Object.entries(fack).map(([k, l]) => [k, [...l]])) } : null;
    },
    setAnswer(a) {
      vald = null;
      platser = Array(n).fill(null);
      fack = Object.fromEntries((view.bins || []).map((b) => [String(b.id), []]));
      if (lage === "ordning") (a?.ids || []).forEach((id, i) => { if (kortData.has(String(id)) && i < n) platser[i] = String(id); });
      else for (const [k, l] of Object.entries(a?.bins || {})) if (fack[k]) fack[k] = l.map(String).filter((id) => kortData.has(id));
      rita();
    },
    reset() { bas.api.setAnswer(null); bas.andrat(); },
    highlight(target) {
      const ids = new Set((target?.ids || []).map(String));
      for (const [id, el] of kortEl) el.classList.toggle("br-pekad", ids.has(id));
    },
    ready: Promise.all(vantan).then(() => undefined),
  });
  return bas.api;
}
