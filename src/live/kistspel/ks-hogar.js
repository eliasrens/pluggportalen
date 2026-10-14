// ============================================================================
// Kistspel 🎁 – projektorns TOPP 10 (#651, utbrutet ur Guldrushens gr-hogar.js
// #565/#578/#579/#588/#591). Två lika stora rader i läsordning (pileSlot):
// plats 1–5 i översta raden och 6–10 i nedersta, vänster → höger. Varje plats
// är elevens avatar (avatarpoolens huvudelement) och temats "hög" (guldhög,
// serverskåp …) som växer/krymper med saldot (pileLevel, transform: scale).
// Flytt i listan = platsens transform glider dit (CSS-transition) – ordningen
// sätts alltid direkt ur ställningen.
// Under varje hög en skylt: placering (leaderMark för ensam ledare), namn och
// saldo. Skyddad = liten 🛡️ vid namnet och bubblan runt avataren – BARA medan
// skyddet gäller. Höjden räknas så att båda radernas skyltar får plats.
//
// API
//   createHogar(host, {
//     pool,           avatarpoolen
//     cls,            CSS-blockets prefix ("grh" → .grh, .grh-plats, --grh-fig;
//                     högens svg ska ha klassen <cls>-svg för studsen)
//     pileHtml(),     högens markup (ritas en gång per plats)
//     defs?,          delade SVG-defs (gradienter) – en gång i roten
//     amount(n),      skyltens saldotext ("120 guld")
//     leaderMark? = "👑"
//   }) → {
//     update(top [{ uid, rank, name, gold, prot }], { ref, leader })
//     bump(uid), areas(), has(uid), el, destroy()
//   }
// ============================================================================

import { setAvatarState, prefersReducedMotion } from "../design/live-reactions.js";
import { pileSlot, pileLevel, KS_TOP } from "./ks-proj-scen.js";

const OUT_MS = 650;
const GAP = 8; // px (minst) mellan översta radens skylt och nedersta radens figurer

export function createHogar(host, { pool, cls, pileHtml, defs = "", amount, leaderMark = "👑" }) {
  const root = document.createElement("div");
  root.className = cls;
  root.innerHTML = `${defs}<div class="${cls}-skylt ${cls}-matt" aria-hidden="true"><b class="${cls}-namn">Å</b><span class="${cls}-guld">0</span></div>`;
  host.appendChild(root);
  const matt = root.querySelector(`.${cls}-matt`);
  const slots = new Map(); // uid → { el, hog, level, i, key, out: timer|0 }
  let size = { w: 0, h: 0, fig: 0, lab: 0 };
  let last = [];
  let lastRef = 1;
  let lastLeader = null;

  // Platsens fotpunkt i px (rad 0 överst, rad 1 underst, samma storlek).
  // Skylten hänger under figuren: nedersta radens fot ligger en skylthöjd
  // ovanför golvets kant, översta radens skylt slutar minst GAP ovanför
  // nedersta radens figurer.
  function place(i) {
    const { row, col } = pileSlot(i);
    const x = size.w * (0.02 + 0.96 * ((col + 0.5) / 5));
    const bottom = size.h - size.lab;
    // Ledig höjd (figuren begränsas av bredden): en tredjedel ovanför
    // översta raden, resten mellan raderna.
    const free = Math.max(0, size.h - 2 * size.lab - GAP - 2 * size.fig * 1.3);
    const y = row === 0 ? size.fig * 1.3 + free / 3 : bottom;
    return { x, y };
  }

  function slotFor(uid) {
    let s = slots.get(uid);
    if (s) {
      if (s.out) {
        clearTimeout(s.out);
        s.out = 0;
        s.el.classList.remove(`${cls}-ut`);
      }
      return s;
    }
    const el = document.createElement("div");
    el.className = `${cls}-plats ${cls}-ny`;
    el.dataset.uid = uid;
    el.innerHTML = `<div class="${cls}-hog">${pileHtml()}</div>
      <div class="${cls}-skylt"><b class="${cls}-namn"><i class="${cls}-nr"></i><span class="${cls}-text"></span><i class="${cls}-skold" hidden>🛡️</i></b><span class="${cls}-guld"></span></div>`;
    const av = pool.el(uid);
    av.classList.add("vantar");
    el.prepend(av);
    root.appendChild(el);
    s = { el, hog: el.querySelector(`.${cls}-hog`), level: -1, i: -1, key: "", out: 0 };
    slots.set(uid, s);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove(`${cls}-ny`)));
    return s;
  }

  function position(s, i) {
    const p = place(i);
    s.i = i;
    s.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  }

  function label(s, p, leader) {
    const lead = p.uid === leader;
    const key = `${p.rank}|${p.name}|${p.gold}|${!!p.prot}|${lead}`;
    if (key === s.key) return;
    s.key = key;
    s.el.querySelector(`.${cls}-nr`).textContent = lead ? leaderMark : `${p.rank}.`;
    s.el.querySelector(`.${cls}-text`).textContent = p.name || "";
    s.el.querySelector(`.${cls}-skold`).hidden = !p.prot;
    s.el.querySelector(`.${cls}-guld`).textContent = amount(p.gold);
    s.el.classList.toggle(`${cls}-ledare`, lead);
  }

  function update(top = [], { ref = lastRef, leader = lastLeader } = {}) {
    last = top;
    lastRef = ref;
    lastLeader = leader;
    const keep = new Set();
    top.forEach((p, i) => {
      keep.add(p.uid);
      const s = slotFor(p.uid);
      if (s.i !== i || s.needsPos) { position(s, i); s.needsPos = false; }
      const level = Math.round(pileLevel(p.gold, ref) * 100) / 100;
      if (level !== s.level) {
        s.level = level;
        s.hog.style.transform = `scale(${(0.55 + 0.45 * level).toFixed(3)}, ${level.toFixed(3)})`;
      }
      setAvatarState(pool.el(p.uid), "skyddad", !!p.prot);
      label(s, p, leader);
    });
    for (const [uid, s] of slots) {
      if (keep.has(uid) || s.out) continue;
      s.el.classList.add(`${cls}-ut`);
      s.i = -1;
      s.out = setTimeout(() => {
        s.el.remove();
        pool.drop(uid);
        slots.delete(uid);
      }, OUT_MS);
    }
  }

  const ro = new ResizeObserver(() => {
    const r = root.getBoundingClientRect();
    if (!r.width || (r.width === size.w && r.height === size.h)) return;
    // Figurens storlek: fem platser i bredd, och i höjd två rader figurer
    // (1.3 em) + två skyltar + glappet.
    const lab = Math.ceil(matt.getBoundingClientRect().height) || 64;
    const fig = Math.max(24, Math.floor(Math.min(r.width / 5 / 2.3, (r.height - 2 * lab - GAP) / 2.6)));
    size = { w: r.width, h: r.height, fig, lab };
    root.style.setProperty(`--${cls}-fig`, `${fig}px`);
    for (const s of slots.values()) s.needsPos = true;
    update(last);
  });
  ro.observe(root);

  return {
    el: root,
    update,
    has: (uid) => slots.has(uid) && !slots.get(uid).out,
    areas() {
      if (!size.fig) return [];
      const r = root.getBoundingClientRect();
      const f = size.fig;
      return Array.from({ length: KS_TOP }, (_, i) => {
        const p = place(i);
        // Figuren (1.3 em hög, 2.3 em bred + hatt/bubbla) och skylten under.
        return { left: r.left + p.x - 1.25 * f, right: r.left + p.x + 1.25 * f, top: r.top + p.y - 1.5 * f, bottom: r.top + p.y + size.lab };
      });
    },
    bump(uid) {
      const s = slots.get(uid);
      if (!s || s.out || prefersReducedMotion()) return;
      s.hog.querySelector(`.${cls}-svg`)?.animate(
        [{ transform: "none" }, { transform: "translateY(-6%) scale(1.06)", offset: 0.35 }, { transform: "none" }],
        { duration: 420, easing: "ease-out" });
    },
    destroy() {
      ro.disconnect();
      for (const [uid, s] of slots) { clearTimeout(s.out); pool.drop(uid); }
      slots.clear();
      root.remove();
    },
  };
}
