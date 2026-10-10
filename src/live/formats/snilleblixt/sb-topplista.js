// ============================================================================
// Snilleblixten – TV-studion (#559): TOPPLISTAN (designspec §5.6). Topp 5 som
// avatarer (egen plats "topp" i avatarpoolen – samma figur med kläder,
// mellanstorlek) med namn och poäng. Raderna ritas ALLTID direkt ur datan
// (rätt ordning och poäng direkt, även efter omladdning); klättringen är en
// FLIP-visualisering ovanpå: render({ flip: true }) lägger raderna på sina
// gamla platser (transform) och regins flyttjobb (play) låter dem glida dit
// de redan står. Hoppas jobbet över/avbryts → settle() och raderna står
// direkt rätt. 🔥 + antal = rätt i rad (bara en markering – ingen bonus).
//
// API
//   createTopplista(host, { pool }) → {
//     render(rows, { title?, streaks?, flip? })   rows: [{ uid, name, points, rank }]
//     enter()                         raderna glider in från sidan (scenbyte)
//     play(signal, { speed }) → Promise   regins flyttjobb
//     settle()                        alla rader direkt på plats
//     el, destroy()
//   }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const MEDALJ = ["🥇", "🥈", "🥉"];

export function createTopplista(host, { pool }) {
  const root = document.createElement("section");
  root.className = "sbt";
  root.innerHTML = `<h2 class="sbt-rubrik"></h2><ol class="sbt-lista"></ol><p class="sbt-tom" hidden>Ingen har poäng än – nästa fråga!</p>`;
  host.appendChild(root);
  const ol = root.querySelector(".sbt-lista");
  const rowsByUid = new Map();
  let pending = false;

  function rowFor(r) {
    let li = rowsByUid.get(r.uid);
    if (li) return li;
    li = document.createElement("li");
    li.className = "sbt-rad";
    li.dataset.uid = r.uid;
    li.innerHTML = `<span class="sbt-nr"></span><span class="sbt-av"></span><span class="sbt-namn"></span><span class="sbt-svit" hidden></span><b class="sbt-p"></b>`;
    const av = pool.el(r.uid, "topp");
    li.querySelector(".sbt-av").append(av);
    rowsByUid.set(r.uid, li);
    return li;
  }

  function render(rows = [], { title = "", streaks = {}, flip = false } = {}) {
    const before = new Map();
    if (flip) for (const [uid, li] of rowsByUid) if (li.isConnected) before.set(uid, li.getBoundingClientRect().top);
    root.querySelector(".sbt-rubrik").textContent = title;
    const list = rows.slice(0, 5).map((r) => {
      const li = rowFor(r);
      li.dataset.plats = r.rank;
      li.querySelector(".sbt-nr").textContent = r.rank <= 3 ? MEDALJ[r.rank - 1] : `${r.rank}`;
      li.querySelector(".sbt-namn").textContent = r.name || "?";
      li.querySelector(".sbt-p").textContent = tal(r.points);
      const sv = streaks[r.uid] || 0;
      const svEl = li.querySelector(".sbt-svit");
      svEl.hidden = sv < 3;
      if (sv >= 3) { svEl.textContent = `🔥${sv}`; svEl.title = `${sv} rätt i rad`; }
      return li;
    });
    ol.replaceChildren(...list);
    root.querySelector(".sbt-tom").hidden = list.length > 0;
    for (const [uid, li] of rowsByUid) if (!li.isConnected) { rowsByUid.delete(uid); pool.drop(uid, "topp"); }
    if (!flip) return;
    // FLIP: lägg raderna på sina gamla platser – flyttjobbet låter dem glida.
    pending = false;
    for (const li of list) {
      const from = before.get(li.dataset.uid);
      const to = li.getBoundingClientRect().top;
      const dy = from == null ? null : from - to;
      if (dy === 0) continue;
      pending = true;
      li.style.transform = dy == null ? "translateX(30%)" : `translateY(${dy.toFixed(1)}px)`;
      li.style.opacity = dy == null ? "0" : "";
      li.classList.toggle("sbt-klattrar", dy != null && dy > 0);
    }
  }

  function settle() {
    pending = false;
    for (const li of ol.children) {
      li.style.transform = "";
      li.style.opacity = "";
      li.classList.remove("sbt-klattrar");
    }
  }

  function play(signal, { speed = 1 } = {}) {
    if (!pending) return Promise.resolve();
    const reduced = prefersReducedMotion();
    const anims = [];
    for (const li of ol.children) {
      const from = li.style.transform;
      if (!from) continue;
      const op = li.style.opacity === "0" ? 0 : 1;
      li.style.transform = "";
      li.style.opacity = "";
      anims.push(li.animate(reduced ? [{ opacity: 0.2 }, { opacity: 1 }] : [{ transform: from, opacity: op }, { transform: "none", opacity: 1 }],
        { duration: (reduced ? 500 : 900) / Math.max(0.5, speed), easing: "cubic-bezier(.25,.9,.3,1.05)" }));
    }
    pending = false;
    signal?.addEventListener("abort", () => anims.forEach((a) => a.finish()), { once: true });
    return Promise.allSettled(anims.map((a) => a.finished)).then(() => {
      for (const li of ol.children) li.classList.remove("sbt-klattrar");
    });
  }

  function enter() {
    const reduced = prefersReducedMotion();
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    [...ol.children].forEach((li, i) => {
      li.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateX(45vw)" }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: 80 + i * 90, easing: "cubic-bezier(.2,.9,.3,1)", fill: "backwards" });
    });
  }

  return { el: root, render, enter, play, settle, destroy() { root.remove(); } };
}
