// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6.3): HÄNDELSEFLÖDET längs
// högerkanten. De senaste (högst MAX) händelserna med små avatarer glider in
// överst och tonar ut efter en stund. Texten är kistkonfigens lekfulla mall
// (feedItem → eventText) – namn bara om läraren valt "Visa namn"; annars
// avatarer och händelser utan namn.
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

const MAX = 5;
const TTL_MS = 14_000;
const OUT_MS = 500;
const PACE_MS = 650;
const PENDING = 3;

/** Hur viktig en post är när kön måste gallras (högre = behålls). */
export function weight(item) {
  if (item.big) return 3;
  if (["steal", "swap", "shieldBlock"].includes(item.type)) return 2;
  return item.type === "chest" && ["lite_guld", "tom"].includes(item.chest) ? 0 : 1;
}

/** Gallra kön: behåll högst max – släpp lägst vikt, äldst först. */
export function trimPending(list, max = PENDING) {
  const out = [...list];
  while (out.length > max) {
    let ix = 0;
    for (let i = 1; i < out.length; i++) if (weight(out[i]) < weight(out[ix])) ix = i;
    out.splice(ix, 1);
  }
  return out;
}

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
    const a = avatar(item.uid, `${id}a`, "grf-av-1");
    if (a) { li.appendChild(a); slots.push([item.uid, `${id}a`]); }
    li.insertAdjacentHTML("beforeend", `<span class="grf-text">${esc(item.text)}</span>`);
    const b = item.victimUid && (item.type === "steal" || item.type === "swap" || item.type === "shieldBlock")
      ? avatar(item.victimUid, `${id}b`, "grf-av-2") : "";
    if (b) { li.appendChild(b); slots.push([item.victimUid, `${id}b`]); }
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
