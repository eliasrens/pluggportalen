// ============================================================================
// Bråkresan – 5. Hundraruta (komponenter/hundraruta.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 5: 10 × 10, hela rader och enskilda celler, synlig koppling
// 1 ruta = 1/100 = 0,01 = 1 %. Radsvep och klick fungerar båda. Cellerna är
// små, så de kompletteras av (spec §4 sista stycket):
//   * radknappar till vänster (hela raden på/av),
//   * tangentbord: pilar mellan rutor, mellanslag/Enter växlar, R växlar raden,
//   * antalsknappar "+1 rad", "−1 rad", "+1 ruta", "−1 ruta" (fyller i läsordning).
// Antalet markerade rutor visas bara i målningsläget (det är elevens eget val –
// i en läsuppgift skulle det vara facit).
//
// view = { component: "hundraruta", wholes?: 1 | 2, marked?: antal | [id], label? }
// Delarnas id: p0 … p99 (andra helheten p100 … p199), rad för rad.
// Svar: paint { selected }.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett } from "./bas.js";
import { hundraCeller, hundraRad, markeradeIds } from "./geometri.js";
import { formNod } from "./notation.js";
import { fraction, decimal, percent, q } from "../math/index.js";

const CELL = 30;
const RADKNAPP = 40;

export function createHundraruta(host, view, opts = {}) {
  const wholes = view.wholes === 2 ? 2 : 1;
  const koppling = h("div", { class: "br-koppling" }, "1 ruta = ", formNod(fraction(1, 100)), " = ",
    formNod(decimal(q(1, 100))), " = ", formNod(percent(1)));
  const ytor = h("div", { class: "br-hundra-ytor" });
  const rot = h("div", { class: "br-hundraruta" },
    helhetsEtikett(view.label || (wholes > 1 ? "Varje hundraruta = 1 hel = 100 rutor" : "Hela hundrarutan = 1 = 100 rutor")),
    ytor, koppling);
  const bas = skapaBas(host, rot, view, opts);
  const celler = hundraCeller(wholes);
  const delar = [];
  const radknappar = [];

  for (let w = 0; w < wholes; w++) {
    const x0 = bas.interaktiv ? RADKNAPP + 4 : 0;
    const svg = s("svg", {
      class: "br-hundra-svg", viewBox: `-4 -4 ${x0 + 10 * CELL + 8} ${10 * CELL + 8}`, role: "group",
      "aria-label": wholes > 1 ? `Hundraruta ${w + 1}` : "Hundraruta",
    });
    svg.append(s("rect", { class: "br-helhetsram", x: x0 - 3, y: -3, width: 10 * CELL + 6, height: 10 * CELL + 6, rx: 6 }));
    for (const c of celler.filter((x) => x.w === w)) {
      const r = s("rect", { x: x0 + c.c * CELL, y: c.r * CELL, width: CELL, height: CELL, class: "br-yta br-cell", "data-del": c.id });
      delar.push(r);
      svg.append(r);
    }
    // Var femte linje lite kraftigare – lättare att räkna tiotal och halvor.
    svg.append(s("line", { class: "br-grans br-grans--hjalp", x1: x0 + 5 * CELL, x2: x0 + 5 * CELL, y1: 0, y2: 10 * CELL }));
    svg.append(s("line", { class: "br-grans br-grans--hjalp", x1: x0, x2: x0 + 10 * CELL, y1: 5 * CELL, y2: 5 * CELL }));
    svg.append(s("rect", { class: "br-kontur", x: x0, y: 0, width: 10 * CELL, height: 10 * CELL, "pointer-events": "none" }));
    if (bas.interaktiv) {
      for (let r = 0; r < 10; r++) {
        const k = s("rect", {
          class: "br-radknapp", x: 0, y: r * CELL + 2, width: RADKNAPP, height: CELL - 4, rx: 6,
          role: "button", tabindex: "0", "data-rad": `${w}:${r}`, "aria-label": `Hela rad ${r + 1}${wholes > 1 ? ` i hundraruta ${w + 1}` : ""}`,
        });
        radknappar.push(k);
        svg.append(k, s("text", { class: "br-radknapp-text", x: RADKNAPP / 2, y: r * CELL + CELL / 2 + 5, "text-anchor": "middle", "pointer-events": "none", text: "rad" }));
      }
    }
    ytor.append(svg);
  }

  const mal = malning(bas, delar, { kolumner: 10, namn: wholes > 1 ? "Två hundrarutor med 100 rutor var" : "Hundraruta med 100 rutor", etikett: (i) => `Ruta rad ${Math.floor((i % 100) / 10) + 1}, kolumn ${(i % 10) + 1}${wholes > 1 ? `, hundraruta ${Math.floor(i / 100) + 1}` : ""}` });
  const start = markeradeIds(view.marked, delar.length);
  const raknare = h("div", { class: "br-raknare", "aria-live": "polite" });
  const visaAntal = () => { raknare.textContent = `Markerat: ${mal.valda.size} av ${delar.length} rutor`; };
  const satt = (ids) => { mal.satt(ids); visaAntal(); };
  const lasOrdning = celler.map((c) => c.id);

  if (bas.interaktiv && view.showCount !== false) {
    const knapp = (text, fn, etikett) => h("button", { type: "button", class: "br-antalknapp", "aria-label": etikett, onclick: () => {
      if (bas.last) return;
      fn();
      bas.andrat();
    } }, text);
    // Antal i läsordning: fyller nästa lediga ruta / tar bort den sista.
    const fyll = (antal) => {
      const valda = lasOrdning.filter((id) => mal.valda.has(id));
      const lediga = lasOrdning.filter((id) => !mal.valda.has(id));
      satt(antal > 0 ? [...valda, ...lediga.slice(0, antal)] : valda.slice(0, Math.max(0, valda.length + antal)));
    };
    rot.insertBefore(h("div", { class: "br-antalrad" }, raknare,
      h("span", { class: "br-antalknappar" },
        knapp("+1 rad", () => fyll(10), "Markera tio rutor till"),
        knapp("−1 rad", () => fyll(-10), "Ta bort tio rutor"),
        knapp("+1 ruta", () => fyll(1), "Markera en ruta till"),
        knapp("−1 ruta", () => fyll(-1), "Ta bort en ruta"))), koppling);
  }

  const vaxlaRad = (nyckel) => {
    if (bas.last) return;
    const [w, r] = nyckel.split(":").map(Number);
    const rad = hundraRad(w, r);
    const alla = rad.every((id) => mal.valda.has(id));
    const ny = new Set(mal.valda);
    for (const id of rad) if (alla) ny.delete(id); else ny.add(id);
    satt([...ny]);
    bas.andrat();
  };
  rot.addEventListener("click", (e) => {
    const k = e.target.closest?.(".br-radknapp");
    if (k) vaxlaRad(k.dataset.rad);
  });
  rot.addEventListener("keydown", (e) => {
    const k = e.target.closest?.(".br-radknapp");
    if (k && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); vaxlaRad(k.dataset.rad); return; }
    const cell = e.target.closest?.("[data-del]");
    if (cell && (e.key === "r" || e.key === "R")) {
      const i = Number(cell.dataset.del.slice(1));
      vaxlaRad(`${Math.floor(i / 100)}:${Math.floor((i % 100) / 10)}`);
    }
  });
  bas.api.onChange(visaAntal);
  satt(start);

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { satt(a?.selected); },
    reset() { satt(start); bas.andrat(); },
    highlight(target) {
      pekaPaDelar(bas, delar, target, null);
      rot.classList.toggle("br-pekar-koppling", !!target?.count);
    },
  });
  return bas.api;
}
