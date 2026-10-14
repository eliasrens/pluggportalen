// ============================================================================
// Bråkresan – 3. Bråkcirkel (komponenter/cirkel.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 3: exakta sektorer (360°/n, geometri.cirkelSektorer),
// klickval, avmarkering och flera helheter. Högst 12 delar. Bråk större än 1
// visas med flera lika stora cirklar – aldrig genom att fylla mer än en cirkel.
//
// view = { component: "cirkel", parts (1–12), wholes?: 1, marked?: antal | [id], label? }
// Delarnas id: helhet för helhet, medurs från klockan 12.
// Svar: paint { selected }.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett } from "./bas.js";
import { cirkelSektorer, markeradeIds, delId, MAX_CIRKEL_DELAR } from "./geometri.js";

const R = 110;
const SIDA = 2 * R + 20; // en helhets ruta i viewBox-enheter

export function createCirkel(host, view, opts = {}) {
  const n = view.parts;
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CIRKEL_DELAR) throw new RangeError(`Bråkresan: cirkel med ${n} delar`);
  const wholes = Math.max(1, view.wholes || 1);
  const ytor = h("div", { class: "br-cirkel-ytor", role: "group", "aria-label": opts.label || (wholes > 1 ? `${wholes} bråkcirklar` : "Bråkcirkel") });
  const rot = h("div", { class: "br-cirkel" },
    helhetsEtikett(view.label || (wholes > 1 ? "Varje cirkel = 1 hel" : "Hela cirkeln = 1")), ytor);
  const bas = skapaBas(host, rot, view, opts);

  // En SVG per helhet – de radbryts på smal skärm så att sektorerna aldrig krymper under klickstorlek.
  const delar = [];
  const mitter = [];
  const cx = SIDA / 2;
  const cy = SIDA / 2;
  for (let w = 0; w < wholes; w++) {
    const svg = s("svg", { class: "br-cirkel-svg", viewBox: `0 0 ${SIDA} ${SIDA}` });
    const g = s("g", { class: "br-cirkel-hel" });
    for (const sek of cirkelSektorer(n, cx, cy, R)) {
      const p = s("path", { d: sek.path, class: "br-yta", "data-del": delId(w * n + sek.i) });
      delar.push(p);
      mitter.push(sek.mitt);
      g.append(p);
    }
    g.append(s("circle", { class: "br-kontur", cx, cy, r: R }));
    if (n > 1) g.append(s("circle", { class: "br-mittpunkt", cx, cy, r: 3 }));
    svg.append(s("circle", { class: "br-helhetsram", cx, cy, r: R + 6 }), g);
    ytor.append(svg);
  }
  const mal = malning(bas, delar, {
    namn: wholes > 1 ? `${wholes} cirklar, var och en delad i ${n} lika delar` : `Cirkel delad i ${n} lika delar`,
    etikett: (i) => (wholes > 1 ? `Cirkel ${Math.floor(i / n) + 1}, del ${(i % n) + 1} av ${n}` : `Del ${i + 1} av ${n}`),
  });
  const start = markeradeIds(view.marked, wholes * n);
  mal.satt(start);

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { mal.satt(a?.selected); },
    reset() { mal.satt(start); bas.andrat(); },
    highlight(target) {
      pekaPaDelar(bas, delar, target, (d, i) => {
        const [x, y] = mitter[i];
        d.parentNode.append(s("text", { class: "br-nummer", x, y: y + 6, "text-anchor": "middle", text: String((i % n) + 1) }));
      });
    },
  });
  return bas.api;
}
