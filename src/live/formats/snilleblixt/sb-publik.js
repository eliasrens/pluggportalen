// ============================================================================
// Snilleblixten – TV-studion (#559): PUBLIKEN – elevernas avatarer längst ned
// (designspec §5.1–5.3). Varje elev får en plats EN gång (avatarelementet ur
// live-avatar-pool, ritat med avatarMarkup inkl. kläder) och flyttas aldrig
// om; nya elever läggs sist. Rutnätet (en–tre rader) och figurstorleken
// räknas ur antalet (audienceLayout) och sätts som CSS-variabler – ingen
// omritning av figurerna. "Har svarat" = bock + ljus (tillstånd ur datan,
// rätt även efter omladdning). Strålkastaren riktas kort mot en ny elev.
//
// API
//   createPublik(host, { pool }) → {
//     el                         publikens rot (.sbp)
//     update(players, { answered?: Set<uid> })  platser + bockar
//     spot(uid)                  strålkastare mot elevens plats (lobbyn)
//     seat(uid) → HTMLElement|null
//     destroy()
//   }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { setAvatarState } from "../../design/live-reactions.js";
import { audienceLayout } from "./sb-scen.js";

const SPOT_GAP_MS = 350;

export function createPublik(host, { pool }) {
  const root = document.createElement("div");
  root.className = "sbp";
  root.innerHTML = `<div class="sbp-rader"></div><span class="sbp-ljus" aria-hidden="true"></span>`;
  host.appendChild(root);
  const rows = root.querySelector(".sbp-rader");
  const light = root.querySelector(".sbp-ljus");
  const seats = new Map(); // uid → { el, name }
  let lastLayout = "";
  let lastSpot = 0;
  let answeredNow = new Set();

  function seatFor(p) {
    let s = seats.get(p.uid);
    if (s) {
      if (p.name && s.name !== p.name) {
        s.name = p.name;
        s.el.querySelector(".sbp-namn").textContent = p.name;
      }
      return s;
    }
    const el = document.createElement("div");
    el.className = "sbp-plats";
    el.dataset.uid = p.uid;
    const av = pool.el(p.uid);
    av.classList.add("vantar");
    el.append(av);
    el.insertAdjacentHTML("beforeend", `<span class="sbp-namn">${esc(p.name || "")}</span>`);
    rows.appendChild(el);
    s = { el, name: p.name || "" };
    seats.set(p.uid, s);
    return s;
  }

  return {
    el: root,
    update(players = [], { answered = null } = {}) {
      for (const p of players) if (p?.uid) seatFor(p);
      const lay = audienceLayout(seats.size);
      const key = `${lay.rows}|${lay.perRow}|${lay.scale}`;
      if (key !== lastLayout) {
        lastLayout = key;
        root.style.setProperty("--sbp-per-rad", lay.perRow);
        root.style.setProperty("--sbp-skala", lay.scale);
        root.dataset.rader = lay.rows;
      }
      const next = answered || new Set();
      for (const [uid] of seats) {
        const on = next.has(uid);
        if (on !== answeredNow.has(uid)) setAvatarState(pool.el(uid), "svarat", on);
      }
      answeredNow = new Set(next);
    },
    spot(uid) {
      const s = seats.get(uid);
      const t = performance.now();
      if (!s || t - lastSpot < SPOT_GAP_MS) return;
      lastSpot = t;
      const r = s.el.getBoundingClientRect();
      const base = root.getBoundingClientRect();
      light.style.setProperty("--x", `${Math.round(r.left + r.width / 2 - base.left)}px`);
      light.getAnimations().forEach((a) => a.cancel());
      light.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 1300, easing: "ease-out" });
    },
    seat: (uid) => seats.get(uid)?.el || null,
    destroy() { root.remove(); },
  };
}
