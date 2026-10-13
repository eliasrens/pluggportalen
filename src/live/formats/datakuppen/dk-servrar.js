// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.2): TOPP 10 VID SINA SERVRAR. Samma
// plats- och läsordning som Guldrushens högar (pileSlot: 1–5 överst, 6–10
// underst, vänster → höger), samma glidning vid flytt och samma skylt
// (placering, namn, 🛡️ medan skyddet gäller, data i MB).
// I stället för en hög som växer står varje elev vid ett SERVERSKÅP med
// DK_LEDS lysdioder som tänds nedifrån och upp när datan växer (ledCount –
// samma skala som högarna: taket höjs bara, ett skåp släcks bara när DEN
// eleven tappar data). Skåpet har alltid samma storlek.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-hogar.js – här bara serverskåpet (SVG), lysdioderna, skyltens "MB" och
// prefixet dkns.
//
// API
//   rackSvg()                      serverskåpets markup (DK_LEDS lysdioder)
//   createServrar(host, { pool }) → {
//     update(top [{ uid, rank, name, gold, prot }], { ref, leader })
//     bump(uid), areas(), has(uid), el, destroy()      (ks-hogar)
//     rackPoint(uid, box) → { x, y } skåpets mitt relativt box (px) | null
//   }
// ============================================================================

import { createHogar } from "../../kistspel/ks-hogar.js";
import { tal, ledCount, DK_LEDS } from "./dk-proj-scen.js";

export function rackSvg() {
  const leds = Array.from({ length: DK_LEDS }, (_, i) => {
    const y = 104 - i * 9; // nedifrån och upp
    return `<rect class="dkns-led" x="48" y="${y}" width="22" height="5" rx="2.5"/>`;
  }).join("");
  const fack = Array.from({ length: DK_LEDS }, (_, i) =>
    `<rect class="dkns-fack" x="14" y="${102 - i * 9}" width="30" height="7" rx="1.5"/>`).join("");
  return `<svg class="dkns-svg" viewBox="0 0 84 124" aria-hidden="true" focusable="false">
    <ellipse cx="42" cy="121" rx="40" ry="3.5" class="dkns-skugga"/>
    <rect x="6" y="6" width="72" height="112" rx="8" class="dkns-skap"/>
    <rect x="6" y="6" width="72" height="10" rx="5" class="dkns-tak"/>
    ${fack}${leds}
  </svg>`;
}

export function createServrar(host, { pool }) {
  const ks = createHogar(host, {
    pool,
    cls: "dkns",
    pileHtml: rackSvg,
    amount: (n) => `${tal(n)} MB`,
    leaderMark: "👑",
  });
  const lit = new Map(); // uid → antal tända

  function leds(top, ref) {
    const keep = new Set();
    for (const p of top) {
      keep.add(p.uid);
      const n = ledCount(p.gold, ref);
      if (lit.get(p.uid) === n) continue;
      const rack = ks.el.querySelector(`.dkns-plats[data-uid="${CSS.escape(p.uid)}"]`);
      if (!rack) continue;
      lit.set(p.uid, n);
      rack.querySelectorAll(".dkns-led").forEach((el, i) => el.classList.toggle("dkns-pa", i < n));
    }
    for (const uid of [...lit.keys()]) if (!keep.has(uid)) lit.delete(uid);
  }

  return {
    ...ks,
    update(top = [], opts = {}) {
      ks.update(top, opts);
      leds(top, opts.ref);
    },
    rackPoint(uid, box) {
      if (!ks.has(uid)) return null;
      const plats = ks.el.querySelector(`.dkns-plats[data-uid="${CSS.escape(uid)}"]`);
      const r = plats?.querySelector(".dkns-svg")?.getBoundingClientRect();
      if (!r?.width) return null;
      const b = box.getBoundingClientRect();
      // Platsen kan glida dit just nu (ny placering) – linjen ska till dit den
      // är på väg: skillnaden mellan målets translate och det animerade läget.
      const mal = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(plats.style.transform);
      const nu = new DOMMatrixReadOnly(getComputedStyle(plats).transform);
      const dx = mal ? Number(mal[1]) - nu.e : 0;
      const dy = mal ? Number(mal[2]) - nu.f : 0;
      return { x: r.left + r.width / 2 - b.left + dx, y: r.top + r.height * 0.45 - b.top + dy };
    },
  };
}
