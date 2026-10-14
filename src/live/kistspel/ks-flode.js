// ============================================================================
// Kistspel 🎁 – projektorns HÄNDELSEFLÖDE (#651, utbrutet ur Guldrushens
// gr-flode.js #565/#578/#591). De senaste (högst max = 4) händelserna glider
// in överst och tonar ut efter en stund. EN rad per händelse, aldrig
// radbrytning: den korta texten (feedItem.short) med den som gjorde det som
// liten avatar först; blir raden ändå för lång kortas den med "…" (hela
// texten ligger i title). Namn av → inga avatarer (feedItem.avatars tom).
// Listan har en fast höjd för max rader – flödet växer aldrig ut över något.
// TEMPO: högst en ny post per PACE_MS så att texten hinner läsas. Väntande
// poster gallras av temats trim (ks-proj-scen trimPending). Bara transform/
// opacitet animeras (de andra posterna glider ned med FLIP). Avatarerna är
// avatarpoolens element (plats per post) och släpps när posten försvinner.
//
// API
//   createFlode(host, {
//     pool,                avatarpoolen
//     cls,                 CSS-blockets prefix ("grf" → .grf, .grf-post, …,
//                          --grf-max)
//     label, heading, empty  aria-etikett, rubrik (betrodd HTML), tom-text
//     icons(html),         ikoner i den escapade texten (withGrIcons)
//     trim(list),          köns gallring (temats trimPending)
//     max? = 4, ttlMs? = 14000
//   }) → { add(items), el, size(), pending(), destroy() }
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { prefersReducedMotion } from "../design/live-reactions.js";

const MAX = 4;
const TTL_MS = 14_000;
const OUT_MS = 500;
const PACE_MS = 650;
export function createFlode(host, { pool, cls, label, heading, empty, icons, trim, max = MAX, ttlMs = TTL_MS }) {
  const root = document.createElement("aside");
  root.className = cls;
  root.setAttribute("aria-label", label);
  root.innerHTML = `<h2 class="${cls}-h">${heading}</h2><ol class="${cls}-lista" aria-live="polite"></ol><p class="${cls}-tom">${empty}</p>`;
  root.style.setProperty(`--${cls}-max`, String(max));
  host.appendChild(root);
  const list = root.querySelector(`.${cls}-lista`);
  const posts = []; // { li, slots: [[uid, slot]], t }
  let n = 0;
  let dead = false;

  function avatar(uid, slot, extra) {
    if (!uid) return "";
    const holder = document.createElement("span");
    holder.className = `${cls}-av ${extra}`;
    holder.appendChild(pool.el(uid, slot));
    return holder;
  }

  function remove(post, { fade = true } = {}) {
    const ix = posts.indexOf(post);
    if (ix >= 0) posts.splice(ix, 1);
    clearTimeout(post.t);
    const done = () => {
      post.li.remove();
      for (const [uid, slot] of post.slots) pool.drop(uid, slot);
      root.classList.toggle(`${cls}-tomt`, !posts.length);
    };
    if (!fade) return done();
    post.li.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: "ease-in", fill: "forwards" })
      .finished.catch(() => {}).finally(done);
  }

  function build(item) {
    const id = `f${n++}`;
    const li = document.createElement("li");
    li.className = `${cls}-post${item.big ? ` ${cls}-stor` : ""}${item.tone ? ` ${cls}-${item.tone}` : ""}`;
    li.dataset.typ = item.type;
    const slots = [];
    // Bara den som gjorde det får en avatar (och bara när namn visas –
    // feedItem.avatars är då tom). Klasskamraten står i texten.
    const [first] = item.avatars || [];
    const a = avatar(first, `${id}a`, `${cls}-av-1`);
    if (a) { li.appendChild(a); slots.push([first, `${id}a`]); }
    li.insertAdjacentHTML("beforeend", `<span class="${cls}-text">${icons(esc(item.short || item.text))}</span>`);
    li.title = String(item.text || "").replaceAll("{mynt}", "").replace(/\s+/g, " ").trim();
    return { li, slots, t: 0 };
  }

  let pending = [];
  let paceT = 0;
  let lastShown = 0;

  function add(items = []) {
    if (dead || !items.length) return;
    pending = trim([...pending, ...items]);
    pump();
  }

  function pump() {
    if (dead || paceT || !pending.length) return;
    const wait = Math.max(0, lastShown + PACE_MS - performance.now());
    if (wait > 0) { paceT = setTimeout(() => { paceT = 0; pump(); }, wait); return; }
    lastShown = performance.now();
    show([pending.shift()]);
    if (pending.length) pump();
  }

  function show(fresh) {
    const reduced = prefersReducedMotion();
    // FLIP: kvarvarande posters läge före.
    const before = new Map(posts.map((p) => [p, p.li.getBoundingClientRect().top]));
    for (const item of fresh) {
      const post = build(item);
      list.prepend(post.li);
      posts.unshift(post);
      post.t = setTimeout(() => remove(post), ttlMs);
      post.li.animate(reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: "translateX(40%) scale(.92)" }, { opacity: 1, transform: "none" }],
      { duration: reduced ? 300 : 420, easing: "cubic-bezier(.2,.8,.3,1)" });
    }
    while (posts.length > max) remove(posts[posts.length - 1], { fade: false });
    if (!reduced) {
      for (const [post, top] of before) {
        if (!posts.includes(post)) continue;
        const dy = top - post.li.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) post.li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 380, easing: "ease-out" });
      }
    }
    root.classList.toggle(`${cls}-tomt`, !posts.length);
  }

  root.classList.add(`${cls}-tomt`);
  return {
    el: root,
    add,
    size: () => posts.length,
    pending: () => pending.length,
    destroy() {
      dead = true;
      clearTimeout(paceT);
      for (const p of [...posts]) remove(p, { fade: false });
      root.remove();
    },
  };
}
