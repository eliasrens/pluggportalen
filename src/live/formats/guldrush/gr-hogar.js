// ============================================================================
// Guldrushen – Skattkammaren (#565/#578/#579, designspec §6.3): TOPP 10 VID
// SINA GULDHÖGAR. Två lika stora rader i läsordning (pileSlot): plats 1–5 i
// översta raden och 6–10 i nedersta, vänster → höger. Varje plats är elevens
// avatar (avatarpoolens huvudelement – ritad EN gång med kläder) och en
// guldhög som växer/krymper med elevens guld (pileLevel, transform: scale).
// Flytt i listan = platsens transform glider dit (CSS-transition) – ordningen
// sätts alltid direkt ur ställningen, så ingen avatar kan stanna på fel plats
// (designtest 5: 4:an → 1:an glider mjukt längst till vänster överst; en
// plats som byter rad glider också dit).
// Under varje hög en skylt: placering (👑 för ensam ledare), namn och guld
// (Elias 2026-10-10, #578: enligt specen). Sköld/stöldskydd = liten 🛡️ vid
// namnet (§6.5); sköld från kista = dessutom bubblan runt avataren.
// Höjden räknas så att båda radernas skyltar får plats: översta radens
// skylt ligger i glappet ovanför nedersta radens figurer – ingen rad skymmer
// den andra.
//
// API
//   createHogar(host, { pool }) → {
//     update(top [{ uid, rank, name, gold, shield, prot }], { ref, leader })
//                                  ritar om bara det som ändrats
//     bump(uid)                    liten studs på högen (nytt guld)
//     has(uid), el, destroy()
//   }
// ============================================================================

import { setAvatarState, prefersReducedMotion } from "../../design/live-reactions.js";
import { pileSlot, pileLevel, tal } from "./gr-proj-scen.js";

const OUT_MS = 650;
const GAP = 8; // px (minst) mellan översta radens skylt och nedersta radens figurer

// Guldhögen (ritas en gång per plats; höjden = transform).
export function pileSvg() {
  const mynt = [[30, 74], [52, 62], [76, 58], [100, 64], [118, 76], [44, 86], [66, 78], [90, 80], [110, 90], [60, 46], [84, 42], [72, 30]]
    .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="7" fill="${i % 3 ? "#ffd84a" : "#ffe680"}" stroke="#b07800" stroke-width="2"/>`).join("");
  return `<svg class="grh-svg" viewBox="0 0 150 112" aria-hidden="true" focusable="false">
    <ellipse cx="75" cy="106" rx="70" ry="6" fill="#000" opacity=".3"/>
    <path d="M6 106 C14 70 40 30 75 22 C110 30 136 70 144 106Z" fill="url(#grh-g)" stroke="#a86f00" stroke-width="3"/>
    <path d="M30 96 C40 70 56 46 75 38" fill="none" stroke="#fff3b0" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    ${mynt}
    <path d="M100 48 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4Z" class="grh-glimt" fill="#fffbe0"/>
    <path d="M38 64 l8 -8 l8 8 l-8 10Z" fill="#86d8e8" stroke="#2f7f94" stroke-width="2"/>
    <path d="M112 92 l7 -7 l7 7 l-7 9Z" fill="#e88fa8" stroke="#a84a64" stroke-width="2"/>
  </svg>`;
}

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="grh-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#ffc928"/><stop offset="1" stop-color="#d48f00"/></linearGradient>
</defs></svg>`;

export function createHogar(host, { pool }) {
  const root = document.createElement("div");
  root.className = "grh";
  root.innerHTML = `${DEFS}<div class="grh-skylt grh-matt" aria-hidden="true"><b class="grh-namn">Å</b><span class="grh-guld">0</span></div>`;
  host.appendChild(root);
  const matt = root.querySelector(".grh-matt");
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
        s.el.classList.remove("grh-ut");
      }
      return s;
    }
    const el = document.createElement("div");
    el.className = "grh-plats grh-ny";
    el.dataset.uid = uid;
    el.innerHTML = `<div class="grh-hog">${pileSvg()}</div>
      <div class="grh-skylt"><b class="grh-namn"><i class="grh-nr"></i><span class="grh-text"></span><i class="grh-skold" hidden>🛡️</i></b><span class="grh-guld"></span></div>`;
    const av = pool.el(uid);
    av.classList.add("vantar");
    el.prepend(av);
    root.appendChild(el);
    s = { el, hog: el.querySelector(".grh-hog"), level: -1, i: -1, key: "", out: 0 };
    slots.set(uid, s);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("grh-ny")));
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
    s.el.querySelector(".grh-nr").textContent = lead ? "👑" : `${p.rank}.`;
    s.el.querySelector(".grh-text").textContent = p.name || "";
    s.el.querySelector(".grh-skold").hidden = !p.prot;
    s.el.querySelector(".grh-guld").textContent = `${tal(p.gold)} guld`;
    s.el.classList.toggle("grh-ledare", lead);
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
      setAvatarState(pool.el(p.uid), "skyddad", !!p.shield);
      label(s, p, leader);
    });
    for (const [uid, s] of slots) {
      if (keep.has(uid) || s.out) continue;
      s.el.classList.add("grh-ut");
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
    root.style.setProperty("--grh-fig", `${fig}px`);
    for (const s of slots.values()) s.needsPos = true;
    update(last);
  });
  ro.observe(root);

  return {
    el: root,
    update,
    has: (uid) => slots.has(uid) && !slots.get(uid).out,
    bump(uid) {
      const s = slots.get(uid);
      if (!s || s.out || prefersReducedMotion()) return;
      s.hog.querySelector(".grh-svg")?.animate(
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
