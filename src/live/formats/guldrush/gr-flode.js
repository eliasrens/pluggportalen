// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6.3): HÄNDELSEFLÖDET längs
// högerkanten. De senaste (högst MAX) händelserna med små avatarer glider in
// överst och tonar ut efter en stund. Texten är kistkonfigens lekfulla mall
// (feedItem → eventText, "🦝 Alma knyckte 30 guld från Omar!") med den som
// gjorde det först och ev. klasskamraten sist. Lärarens "Visa namn" av →
// "Någon"/"en klasskamrat" och inga avatarer (#578).
// TEMPO: högst en ny post per PACE_MS så att texten hinner läsas. Väntande
// poster är högst PENDING; fler → de minst viktiga (småguld först, stora
// händelser sist) och äldsta hoppas över. Storm (designtest 7): 30 kistor i
// samma ögonblick → flödet visar de viktigaste/senaste inom ~2 s och ligger
// aldrig efter. Bara transform/opacitet animeras (de andra posterna glider
// ned med FLIP).
// Avatarerna är avatarpoolens element (plats per post) och släpps när posten
// försvinner.
//
// API
//   createFlode(host, { pool, max? = 5, ttlMs? = 14000 }) → {
//     add(items)       feedItem-poster, äldst först (köas i tempot)
//     el, size(), pending(), destroy()
//   }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";
import { trimPending } from "./gr-proj-scen.js";

const MAX = 5;
const TTL_MS = 14_000;
const OUT_MS = 500;
const PACE_MS = 650;
export function createFlode(host, { pool, max = MAX, ttlMs = TTL_MS }) {
  const root = document.createElement("aside");
  root.className = "grf";
  root.setAttribute("aria-label", "Händelser i grottan");
  root.innerHTML = `<h2 class="grf-h">📜 I grottan</h2><ol class="grf-lista" aria-live="polite"></ol><p class="grf-tom">Grottan väntar på första kistan …</p>`;
  host.appendChild(root);
  const list = root.querySelector(".grf-lista");
  const posts = []; // { li, slots: [[uid, slot]], t }
  let n = 0;
  let dead = false;

  function avatar(uid, slot, cls) {
    if (!uid) return "";
    const holder = document.createElement("span");
    holder.className = `grf-av ${cls}`;
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
      root.classList.toggle("grf-tomt", !posts.length);
    };
    if (!fade) return done();
    post.li.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: "ease-in", fill: "forwards" })
      .finished.catch(() => {}).finally(done);
  }

  function build(item) {
    const id = `f${n++}`;
    const li = document.createElement("li");
    li.className = `grf-post${item.big ? " grf-stor" : ""}${item.tone ? ` grf-${item.tone}` : ""}`;
    li.dataset.typ = item.type;
    const slots = [];
    // Avatarer bara när namn visas (feedItem.avatars är då tom).
    const [first, second] = item.avatars || [];
    const a = avatar(first, `${id}a`, "grf-av-1");
    if (a) { li.appendChild(a); slots.push([first, `${id}a`]); }
    li.insertAdjacentHTML("beforeend", `<span class="grf-text">${esc(item.text)}</span>`);
    const b = avatar(second, `${id}b`, "grf-av-2");
    if (b) { li.appendChild(b); slots.push([second, `${id}b`]); }
    return { li, slots, t: 0 };
  }

  let pending = [];
  let paceT = 0;
  let lastShown = 0;

  function add(items = []) {
    if (dead || !items.length) return;
    pending = trimPending([...pending, ...items]);
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
    root.classList.toggle("grf-tomt", !posts.length);
  }

  root.classList.add("grf-tomt");
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
