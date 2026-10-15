// ============================================================================
// Bråkresan – gruppera i lika grupper (komponenter/gruppering.js) · #710 E
// ----------------------------------------------------------------------------
// Utmaning 20: N flyttbara föremål i en hög och n tomma gruppytor. Eleven
// lägger föremål i grupperna – klick på en grupps knapp ("Lägg en här"),
// "En till varje grupp", eller dra ett föremål till en grupp – och klickar på
// ett föremål i en grupp för att lägga tillbaka det. Inga förifyllda
// gruppstorlekar: grupperna börjar tomma och visar bara vad eleven lagt.
//
// view = { component: "gruppering", count: N, groups: n, item?: "kula" | … }
// Svar (answer.type "categories"): { bins: { g1: [id …], … } } – föremålens id
// p0 … i högen. Som verktyg (sammansatt verktyg: true) ger den inget svar.
// ============================================================================

import { h, s, skapaBas } from "./bas.js";
import { FOREMAL } from "./mangd.js";

function ikon(typ) {
  const svg = s("svg", { viewBox: "0 0 40 40", class: "br-grupp-ikon", "aria-hidden": "true" });
  if (typ === "stjarna") {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 ? 7 : 16;
      p.push(`${(20 + r * Math.cos(a)).toFixed(1)},${(21 + r * Math.sin(a)).toFixed(1)}`);
    }
    svg.append(s("polygon", { points: p.join(" "), class: "br-foremal-form" }));
  } else if (typ === "kloss") svg.append(s("rect", { x: 6, y: 6, width: 28, height: 28, rx: 5, class: "br-foremal-form" }));
  else if (typ === "knapp") {
    svg.append(s("circle", { cx: 20, cy: 20, r: 14, class: "br-foremal-form" }));
    for (const [x, y] of [[16, 16], [24, 16], [16, 24], [24, 24]]) svg.append(s("circle", { cx: x, cy: y, r: 1.8, class: "br-foremal-hal" }));
  } else svg.append(s("circle", { cx: 20, cy: 20, r: 14, class: "br-foremal-form" }), s("circle", { cx: 15, cy: 15, r: 3.5, class: "br-foremal-glans" }));
  return svg;
}

export function createGruppering(host, view, opts = {}) {
  const N = view.count;
  const n = view.groups;
  const typ = FOREMAL[view.item] ? view.item : "kula";
  const svar = opts.answer?.type === "categories";
  const plats = Object.fromEntries(Array.from({ length: N }, (_, i) => [`p${i}`, null])); // id → grupp-id | null
  const gid = (g) => `g${g + 1}`;

  const knappar = Array.from({ length: N }, (_, i) => h("button", {
    type: "button", class: "br-foremal-knapp br-foremal", "data-id": `p${i}`, "aria-label": `${FOREMAL[typ].en} ${i + 1}`,
  }, ikon(typ)));
  const hog = h("div", { class: "br-grupp-hog", role: "list", "aria-label": `Högen: alla ${N} ${FOREMAL[typ].flera}` });
  const grupper = Array.from({ length: n }, (_, g) => {
    const innehall = h("div", { class: "br-grupp-innehall" });
    const knapp = h("button", { type: "button", class: "br-knapp br-verktygknapp br-grupp-lagg", "data-grupp": gid(g) }, "Lägg en här");
    const rubrik = h("div", { class: "br-grupp-rubrik" }, `Grupp ${g + 1}`);
    const el = h("div", { class: "br-grupp", "data-grupp": gid(g), role: "group", "aria-label": `Grupp ${g + 1}` }, rubrik, innehall, knapp);
    return { el, innehall, knapp, rubrik };
  });
  const dela = h("button", { type: "button", class: "br-knapp br-verktygknapp" }, "En till varje grupp");
  const tom = h("button", { type: "button", class: "br-knapp br-verktygknapp" }, "Tillbaka till högen");
  const status = h("div", { class: "br-kortstatus", "aria-live": "polite" });
  const rot = h("div", { class: "br-gruppering" },
    h("div", { class: "br-grupp-hogram" }, h("div", { class: "br-bygge-ytarubrik" }, `Alla ${FOREMAL[typ].flera}`), hog),
    h("div", { class: "br-grupp-knappar" }, dela, tom),
    h("div", { class: "br-grupp-rad" }, grupper.map((g) => g.el)), status);
  const bas = skapaBas(host, rot, view, opts);

  function rita() {
    hog.replaceChildren(...knappar.filter((k) => plats[k.dataset.id] === null));
    grupper.forEach((g, i) => {
      const lista = knappar.filter((k) => plats[k.dataset.id] === gid(i));
      g.innehall.replaceChildren(...lista);
      g.rubrik.textContent = `Grupp ${i + 1}: ${lista.length}`;
    });
    const kvar = knappar.filter((k) => plats[k.dataset.id] === null).length;
    status.textContent = `I högen: ${kvar}. ${grupper.map((_, i) => `Grupp ${i + 1}: ${knappar.filter((k) => plats[k.dataset.id] === gid(i)).length}`).join(", ")}.`;
    dela.disabled = kvar < n;
    tom.disabled = kvar === N;
    for (const g of grupper) g.knapp.disabled = kvar === 0;
  }
  const lagg = (id, g) => {
    if (bas.last || !bas.interaktiv) return;
    plats[id] = g;
    rita();
    bas.andrat();
  };
  const forsta = () => knappar.find((k) => plats[k.dataset.id] === null)?.dataset.id;

  rot.addEventListener("click", (e) => {
    if (bas.last || !bas.interaktiv || svaljKlick) return;
    const lb = e.target.closest(".br-grupp-lagg");
    if (lb) { const id = forsta(); if (id) lagg(id, lb.dataset.grupp); return; }
    const f = e.target.closest(".br-foremal-knapp");
    if (f) {
      if (plats[f.dataset.id] !== null) lagg(f.dataset.id, null);
      else { // ett föremål i högen: till gruppen med minst (eleven kan flytta om)
        const minst = grupper.map((_, i) => gid(i)).sort((a, b) => antal(a) - antal(b))[0];
        lagg(f.dataset.id, minst);
      }
    }
  });
  const antal = (g) => Object.values(plats).filter((x) => x === g).length;
  dela.addEventListener("click", () => {
    if (bas.last) return;
    for (let i = 0; i < n; i++) { const id = forsta(); if (id) plats[id] = gid(i); }
    rita();
    bas.andrat();
  });
  tom.addEventListener("click", () => {
    if (bas.last) return;
    for (const id of Object.keys(plats)) plats[id] = null;
    rita();
    bas.andrat();
  });

  // Dra ett föremål till en grupp (eller tillbaka till högen).
  let drag = null;
  let svaljKlick = false;
  rot.addEventListener("pointerdown", (e) => {
    const f = e.target.closest(".br-foremal-knapp");
    if (f && !bas.last && bas.interaktiv) drag = { id: f.dataset.id, el: f, x: e.clientX, y: e.clientY, pid: e.pointerId, spok: null };
  });
  rot.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.spok && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      drag.el.setPointerCapture?.(e.pointerId);
      drag.spok = drag.el.cloneNode(true);
      drag.spok.classList.add("br-spok");
      document.body.append(drag.spok);
    }
    if (drag.spok) Object.assign(drag.spok.style, { left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px` });
  });
  rot.addEventListener("pointerup", (e) => {
    const d = drag;
    drag = null;
    if (!d?.spok) return;
    d.spok.remove();
    svaljKlick = true;
    setTimeout(() => { svaljKlick = false; }, 0);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const g = under?.closest?.(".br-grupp");
    if (g) lagg(d.id, g.dataset.grupp);
    else if (under?.closest?.(".br-grupp-hogram")) lagg(d.id, null);
  });
  bas.stad(() => drag?.spok?.remove());
  rita();

  Object.assign(bas.api, {
    getAnswer() {
      if (!svar || Object.values(plats).every((x) => x === null)) return null;
      return { bins: Object.fromEntries(grupper.map((_, i) => [gid(i), knappar.map((k) => k.dataset.id).filter((id) => plats[id] === gid(i))])) };
    },
    setAnswer(a) {
      for (const id of Object.keys(plats)) plats[id] = null;
      for (const [g, lista] of Object.entries(a?.bins || {})) for (const id of lista || []) if (id in plats) plats[id] = g;
      rita();
    },
    reset() { for (const id of Object.keys(plats)) plats[id] = null; rita(); bas.andrat(); },
    validate: () => (!svar || Object.values(plats).every((x) => x !== null) ? { ok: true } : { ok: false, message: "Lägg alla föremål i grupperna först." }),
    highlight(target) {
      rot.classList.toggle("br-pekar-helhet", !!target?.whole);
      rot.classList.toggle("br-pekar-grupper", !!target?.groups);
    },
  });
  return bas.api;
}
