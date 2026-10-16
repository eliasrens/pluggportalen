// ============================================================================
// Bråkresan – 7. Mängdbild (komponenter/mangd.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 7: räkningsbara föremål, urval, gruppering i lika stora
// grupper och tydlig helhet ("Hela samlingen = 12 kulor"). Föremålen är
// IDENTISKA (samma form, storlek och färg) – olikheter får inte antyda olika
// vikt när bara antalet avses. Varje föremål ritas exakt en gång
// (geometri.mangdLayout).
//
// view = { component: "mangd", count, marked?: antal | [id], groups?: antal grupper,
//          item?: "kula" | "stjarna" | "knapp" | "kloss", label? }
// Svar: paint { selected } (föremålens id p0 … i läsordning, grupp för grupp).
// Med grupper finns även en knapp per grupp som markerar/avmarkerar hela gruppen.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett } from "./bas.js";
import { mangdLayout, markeradeIds } from "./geometri.js";
import { numberWords } from "../math/index.js";

const U = 48; // ett föremåls ruta i viewBox-enheter

export const FOREMAL = Object.freeze({
  kula: { en: "kula", flera: "kulor" },
  stjarna: { en: "stjärna", flera: "stjärnor" },
  knapp: { en: "knapp", flera: "knappar" },
  kloss: { en: "kloss", flera: "klossar" },
});

function foremal(typ, cx, cy) {
  const r = U * 0.36;
  switch (typ) {
    case "stjarna": {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r * 1.05;
        p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
      }
      return [s("polygon", { points: p.join(" "), class: "br-foremal-form" })];
    }
    case "knapp":
      return [s("circle", { cx, cy, r, class: "br-foremal-form" }),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => s("circle", { cx: cx + dx * 4.5, cy: cy + dy * 4.5, r: 2.2, class: "br-foremal-hal" }))];
    case "kloss":
      return [s("rect", { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 6, class: "br-foremal-form" })];
    default:
      return [s("circle", { cx, cy, r, class: "br-foremal-form" }), s("circle", { cx: cx - r * 0.35, cy: cy - r * 0.35, r: r * 0.25, class: "br-foremal-glans" })];
  }
}

export function createMangd(host, view, opts = {}) {
  const typ = FOREMAL[view.item] ? view.item : "kula";
  const count = view.count;
  const layout = mangdLayout(count, view.groups || 0);
  const pad = 8;
  const svg = s("svg", {
    class: "br-mangd-svg", viewBox: `${-pad} ${-pad} ${layout.b * U + 2 * pad} ${layout.h * U + 2 * pad}`, role: "group",
    "aria-label": opts.label || `${numberWords(count)} likadana ${FOREMAL[typ].flera}${layout.grupper.length ? ` i ${numberWords(layout.grupper.length)} lika stora grupper` : ""}`,
  });
  svg.style.setProperty("--br-mangd-kol", layout.b);
  const rot = h("div", { class: "br-mangd" },
    helhetsEtikett(view.label || `Hela samlingen = ${count} ${count === 1 ? FOREMAL[typ].en : FOREMAL[typ].flera}`), svg);
  const bas = skapaBas(host, rot, view, opts);

  svg.append(s("rect", { class: "br-helhetsram", x: -pad + 2, y: -pad + 2, width: layout.b * U + 2 * pad - 4, height: layout.h * U + 2 * pad - 4, rx: 12 }));
  for (const g of layout.grupper) {
    svg.append(s("rect", { class: "br-gruppram", x: g.x * U + 2, y: g.y * U + 2, width: g.w * U - 4, height: g.h * U - 4, rx: 12 }));
  }
  const delar = layout.items.map((it) => {
    const g = s("g", { class: "br-yta br-foremal", "data-del": it.id });
    g.append(s("rect", { class: "br-traffyta", x: it.x * U, y: it.y * U, width: U, height: U, rx: 10 }),
      ...foremal(typ, it.x * U + U / 2, it.y * U + U / 2));
    svg.append(g);
    return g;
  });
  const mal = malning(bas, delar, {
    namn: svg.getAttribute("aria-label"),
    kolumner: layout.grupper.length ? 0 : layout.b,
    etikett: (i, n) => `${FOREMAL[typ].en[0].toUpperCase()}${FOREMAL[typ].en.slice(1)} ${i + 1} av ${n}`,
  });
  const start = markeradeIds(view.marked, count);
  mal.satt(start);

  if (layout.grupper.length && bas.interaktiv) {
    const knappar = layout.grupper.map((g) => h("button", {
      type: "button", class: "br-gruppknapp", "aria-label": `Markera hela grupp ${g.g + 1}`,
      onclick: () => {
        if (bas.last) return;
        const ids = layout.items.filter((it) => it.g === g.g).map((it) => it.id);
        const alla = ids.every((id) => mal.valda.has(id));
        const ny = new Set(mal.valda);
        for (const id of ids) if (alla) ny.delete(id); else ny.add(id);
        mal.satt([...ny]);
        bas.andrat();
      },
    }, `Grupp ${g.g + 1}`));
    rot.append(h("div", { class: "br-gruppknappar" }, knappar));
  }

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { mal.satt(a?.selected); },
    reset() { mal.satt(start); bas.andrat(); },
    highlight(target) {
      pekaPaDelar(bas, delar, target, (d, i) => {
        const it = layout.items[i];
        svg.append(s("text", { class: "br-nummer br-nummer--liten", x: it.x * U + U - 6, y: it.y * U + 14, "text-anchor": "end", text: String(i + 1) }));
      });
      rot.classList.toggle("br-pekar-grupper", !!target?.groups);
    },
  });
  return bas.api;
}
