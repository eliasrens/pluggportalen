// ============================================================================
// Live-design (#571): AVATARELEMENTEN (designspec §4.1, §4.4, §11). Varje
// avatar ritas EN gång med befintliga avatarMarkup (inkl. rygg-plagg bakom
// figuren och mustaschens förankring) och elementet återanvänds – vyerna
// flyttar det mellan publik, topplista och pall i stället för att rita om.
// Poänguppdateringar rör aldrig figuren. Bara om elevens utseende faktiskt
// ändras (projektionen kom fram, eller en omläsning) byts figurens markup –
// i samma element.
//
// Elementet:
//   <span class="lav" data-uid>          ← vyn placerar/flyttar DETTA (FLIP m.m.)
//     <span class="lav-glow">            ← "Har svarat"-ljus (opacitet)
//     <span class="avatar-figure">…      ← reaktionerna animerar HELA figuren
//     <span class="lav-bubbla">          ← "Skyddad"
//     <span class="lav-bock">✓           ← "Har svarat"
//     <span class="lav-fx">              ← tillfälliga partiklar (damm, stjärnor, mynt)
// Storlek = font-size (figuren är 1em × 1.2em): lav-liten (publik), lav-mellan
// (topplista), lav-stor (pall) i live-design.css – eller vyns egen font-size.
//
// API
//   ensureDesignCss()
//   createAvatarPool({ roster }) → {
//     el(uid, slot = "main") → HTMLElement   (samma element varje gång)
//     has(uid, slot?), drop(uid, slot?), destroy()
//   }
// ============================================================================

import { avatarMarkup } from "../../avatars.js";
import { ensureLiveCss } from "../live-css.js";

export function ensureDesignCss() {
  ensureLiveCss(["src/live/design/live-design.css"]);
}

const looksKey = (i) => `${i.avatarId}|${(i.avatarItems || []).join(",")}`;

// Liten deterministisk spridning så 30 figurer inte andas i takt.
function phase(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return h;
}

export function createAvatarPool({ roster }) {
  ensureDesignCss();
  const els = new Map(); // `${slot}\u0000${uid}` → { el, uid, key }

  function draw(rec) {
    const info = roster.info(rec.uid);
    const key = looksKey(info);
    rec.el.classList.toggle("lav-laddar", !info.resolved);
    if (key === rec.key) return;
    rec.key = key;
    const tmp = document.createElement("span");
    tmp.innerHTML = avatarMarkup(info.avatarId, info.avatarItems);
    const fig = rec.el.querySelector(".avatar-figure");
    if (fig) fig.replaceWith(tmp.firstElementChild);
    else rec.el.querySelector(".lav-glow").after(tmp.firstElementChild);
  }

  const off = roster.onChange((uids) => {
    const set = new Set(uids);
    for (const rec of els.values()) if (set.has(rec.uid)) draw(rec);
  });

  function el(uid, slot = "main") {
    const k = `${slot}\u0000${uid}`;
    let rec = els.get(k);
    if (rec) return rec.el;
    const node = document.createElement("span");
    node.className = "lav";
    node.dataset.uid = uid;
    const h = phase(uid);
    node.style.setProperty("--lav-d", `${-((h % 3400) / 1000).toFixed(2)}s`);
    node.style.setProperty("--lav-vick", `${(h % 2 ? 1 : -1) * (0.8 + (h % 7) / 10)}deg`);
    node.innerHTML = `<span class="lav-glow" aria-hidden="true"></span><span class="lav-bubbla" aria-hidden="true"></span><span class="lav-bock" aria-hidden="true">✓</span><span class="lav-fx" aria-hidden="true"></span>`;
    rec = { el: node, uid, key: null };
    els.set(k, rec);
    draw(rec);
    return node;
  }

  return {
    el,
    has: (uid, slot = "main") => els.has(`${slot}\u0000${uid}`),
    drop(uid, slot = "main") {
      const k = `${slot}\u0000${uid}`;
      els.get(k)?.el.remove();
      els.delete(k);
    },
    destroy() {
      off();
      for (const rec of els.values()) rec.el.remove();
      els.clear();
    },
  };
}
