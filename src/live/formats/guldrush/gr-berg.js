// ============================================================================
// Guldrushen – Skattkammaren (#565): KLASSENS GULDBERG mitt på grottgolvet.
// Ersätter specens "topp 10 vid guldhögar" (designspec §6.3): Elias regel
// (2026-10-10, ingen uthängning) + leaden #562 – inga avatarer i
// rangordning på projektorn. I stället ett gemensamt berg per klass som
// växer synligt med klassens guld (och krymper bara om guld faktiskt
// försvinner), med en guldkista högst upp när berget blivit stort och en
// krona när det är riktigt stort. Under berget: "Nästa skatt: 3 000 guld"
// – klassens gemensamma delmål. Nytt guld → några mynt faller ned på berget
// (få, högst MAX_MYNT samtidigt – §11). Bara transform/opacitet animeras;
// reducerad rörelse: inga fallande mynt, berget tonar till ny storlek.
// Flera klasser (§7.3): ett berg per klass med klassens namn och guld.
//
// API
//   createBerg(host) → {
//     update(classes [{ classId, name, gold }], { total, multi })
//     drop(classId, n)        n mynt faller ned (nytt guld)
//     el, destroy()
//   }
// ============================================================================

import { prefersReducedMotion } from "../../design/live-reactions.js";
import { bergLevel, milestone, tal } from "./gr-proj-scen.js";
import { esc } from "../../../teacher-shared.js";

const MAX_MYNT = 10;

function bergSvg(id) {
  const mynt = [];
  for (let r = 0; r < 7; r++) {
    const y = 300 - r * 36;
    const half = 230 - r * 30;
    for (let x = -half; x <= half; x += 34) {
      const jx = ((x * 7 + r * 13) % 11) - 5;
      mynt.push(`<ellipse cx="${200 + x + jx}" cy="${y + ((x + r) % 3) * 4}" rx="17" ry="9" fill="${(x + r * 3) % 4 ? "#ffd84a" : "#ffe680"}" stroke="#b07800" stroke-width="2.4"/>`);
    }
  }
  return `<svg class="grb-svg" viewBox="0 0 400 340" aria-hidden="true" focusable="false">
    <defs><linearGradient id="grb-g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".4" stop-color="#ffc928"/><stop offset="1" stop-color="#c88400"/></linearGradient></defs>
    <ellipse cx="200" cy="330" rx="200" ry="12" fill="#000" opacity=".35"/>
    <path d="M0 330 C30 240 110 70 200 40 C290 70 370 240 400 330Z" fill="url(#grb-g-${id})" stroke="#a86f00" stroke-width="4"/>
    <path d="M60 300 C90 220 140 110 200 70" fill="none" stroke="#fff3b0" stroke-width="10" stroke-linecap="round" opacity=".45"/>
    ${mynt.join("")}
    <g fill="#86d8e8" stroke="#2f7f94" stroke-width="2.5"><path d="M110 250 l14 -14 l14 14 l-14 18Z"/><path d="M262 180 l11 -11 l11 11 l-11 14Z"/></g>
    <g fill="#e88fa8" stroke="#a84a64" stroke-width="2.5"><path d="M290 280 l13 -13 l13 13 l-13 16Z"/><path d="M160 150 l10 -10 l10 10 l-10 13Z"/></g>
    <g fill="#c58cff" stroke="#6a3fa0" stroke-width="2.5"><path d="M210 230 l12 -12 l12 12 l-12 15Z"/></g>
    <path class="grb-glimt" d="M150 200 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5Z" fill="#fffbe0"/>
    <path class="grb-glimt grb-glimt-2" d="M250 110 l4 -11 l4 11 l11 4 l-11 4 l-4 11 l-4 -11 l-11 -4Z" fill="#fffbe0"/>
    <g class="grb-kista" transform="translate(162 4)">
      <rect x="4" y="30" width="68" height="34" rx="5" fill="#8a4b1f" stroke="#4a2409" stroke-width="3"/>
      <path d="M2 32 V20 Q2 4 38 4 Q74 4 74 20 V32Z" fill="#c47a3a" stroke="#4a2409" stroke-width="3"/>
      <rect x="31" y="30" width="14" height="16" rx="3" fill="#ffd84a" stroke="#a86f00" stroke-width="2"/>
      <path d="M12 28 Q38 -6 64 28" fill="#ffe680" opacity=".8"/>
    </g>
    <g class="grb-krona" transform="translate(170 -52)">
      <path d="M0 50 L6 12 L22 32 L30 0 L38 32 L54 12 L60 50Z" fill="#ffd23f" stroke="#a86f00" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="30" cy="40" r="5" fill="#e53935"/><circle cx="14" cy="42" r="4" fill="#1e88e5"/><circle cx="46" cy="42" r="4" fill="#43a047"/>
    </g>
  </svg>`;
}

export function createBerg(host) {
  const root = document.createElement("div");
  root.className = "grb";
  host.appendChild(root);
  const berg = new Map(); // classId → { el, mount, level, label }
  let live = 0;

  function bergFor(c) {
    let b = berg.get(c.classId);
    if (b) return b;
    const el = document.createElement("div");
    el.className = "grb-berg";
    el.innerHTML = `<div class="grb-rymd"><div class="grb-mount">${bergSvg(esc(c.classId))}</div><div class="grb-regn"></div></div>
      <div class="grb-skylt"><b class="grb-klass"></b><span class="grb-guld"></span></div>
      <div class="grb-mal"><span class="grb-mal-text"></span><span class="grb-bar"><i></i></span></div>`;
    root.appendChild(el);
    b = { el, mount: el.querySelector(".grb-mount"), level: -1, key: "" };
    berg.set(c.classId, b);
    return b;
  }

  function update(classes = [], { total = 0, multi = false } = {}) {
    root.classList.toggle("grb-flera", multi);
    root.style.setProperty("--grb-n", Math.max(1, classes.length));
    for (const c of classes) {
      const b = bergFor(c);
      const level = Math.round(bergLevel(c.gold) * 100) / 100;
      if (level !== b.level) {
        b.level = level;
        b.mount.style.transform = `scale(${(0.45 + 0.55 * level).toFixed(3)}, ${level.toFixed(3)})`;
        b.el.classList.toggle("grb-med-kista", level >= 0.55);
        b.el.classList.toggle("grb-med-krona", level >= 0.85);
      }
      // Delmålet: klassens eget guld (flera klasser) eller allas tillsammans.
      const goal = milestone(multi ? c.gold : total);
      const key = `${c.name}|${c.gold}|${goal.next}|${goal.frac.toFixed(3)}|${multi}`;
      if (key === b.key) continue;
      b.key = key;
      b.el.querySelector(".grb-klass").textContent = multi ? c.name : "";
      b.el.querySelector(".grb-guld").textContent = multi ? `${tal(c.gold)} guld` : "";
      b.el.querySelector(".grb-mal-text").textContent = goal.next ? `Nästa skatt: ${tal(goal.next)} guld` : "Alla skatter hittade! 🎉";
      b.el.querySelector(".grb-bar i").style.transform = `scaleX(${goal.frac.toFixed(3)})`;
    }
  }

  function drop(classId, n = 2) {
    const b = berg.get(classId) || berg.values().next().value;
    if (!b || prefersReducedMotion()) return;
    const regn = b.el.querySelector(".grb-regn");
    // Landa på sluttningen (berget är skalat från botten, toppen vid ~12 %).
    const land = Math.round(regn.clientHeight * (1 - Math.max(0.18, b.level) * 0.72));
    for (let i = 0; i < Math.min(3, n) && live < MAX_MYNT; i++) {
      const c = document.createElement("i");
      c.className = "grb-mynt";
      c.style.left = `${40 + Math.random() * 20}%`;
      regn.appendChild(c);
      live++;
      c.animate([
        { transform: "translateY(-20vh) rotate(0)", opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translateY(${land}px) rotate(${i % 2 ? 300 : -300}deg)`, opacity: 1, offset: 0.85 },
        { transform: `translateY(${land + 10}px) rotate(${i % 2 ? 320 : -320}deg)`, opacity: 0 },
      ], { duration: 900 + i * 120, delay: i * 110, easing: "cubic-bezier(.5,0,.8,.6)", fill: "backwards" })
        .finished.catch(() => {}).finally(() => { c.remove(); live--; });
    }
  }

  return {
    el: root,
    update,
    drop,
    destroy() { root.remove(); },
  };
}
