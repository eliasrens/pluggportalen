// ============================================================================
// Pluggportalen – rums-växlaren (dörrar inne + rumslista) för flerrums-huset
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear/mat/fonster): äger UI:t för
// att BYTA rum i ett uppgraderat hus (issue #34). Två sätt att navigera, exakt
// som uppgiften kräver:
//   * DÖRRAR inne i scenen: en dörr på vänster vägg (föregående rum) och en på
//     höger vägg (nästa rum). Dörren visas bara när det finns ett rum åt det
//     hållet.
//   * RUMSLISTA: en liten pill-rad högst upp i rummet ("Rum 1 · Rum 2 …") där
//     det aktiva rummet är markerat.
// Modulen bygger DOM-noderna EN gång och exponerar render() som uppdaterar
// markering + dörrsynlighet efter det aktiva rummet. varld-rum.js äger själva
// rums-bytet (goToRoom) och kallar hit via onPick. Noderna läggs in i scenen på
// nytt vid varje renderStage() (som annars nollställer lagret) – samma
// nod-objekt, så lyssnarna sitter kvar. Visas bara när huset har >1 rum.
// ============================================================================

import { el, clamp } from "./ui.js";
import { O, LINE, THIN } from "./art-style.js";
import { FLOOR_TOP } from "./art-room.js";

// Dörrarnas snygga default-lägen på VÄGGEN (procent, centrum via translate).
// Sitter uppe på väggen (ovanför golvlinjen FLOOR_TOP=62 %), inte på golvet
// framför spelaren (issue #59). Kan sedan dras fritt och sparas per rum.
const DOOR_DEFAULTS = {
  prev: { x: 8, y: 38 },
  next: { x: 92, y: 38 },
};

// En enkel, barnvänlig dörr i husvärldens SVG-stil (kontur + panel + handtag).
const dorrSvg =
  `<svg viewBox="0 0 40 64" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
  `<rect x="4" y="4" width="32" height="58" rx="4" fill="#C58C55" ${LINE}/>` +
  `<rect x="9" y="10" width="22" height="20" rx="3" fill="#B0805A" ${THIN}/>` +
  `<rect x="9" y="34" width="22" height="22" rx="3" fill="#B0805A" ${THIN}/>` +
  `<circle cx="29" cy="40" r="2.6" fill="#F7C948" stroke="${O}" stroke-width="1.6"/>` +
  `</svg>`;

/**
 * Montera rums-växlaren.
 * @param {object} o
 * @param {number} o.count       antal rum (>1 för att växlaren ska vara meningsfull)
 * @param {() => number} o.getCurrent  nuvarande rum-index
 * @param {(index: number) => void} o.onPick  byt till rum `index`
 * @param {(side: "prev"|"next") => {x:number,y:number}|null} [o.getDoorPos]
 *        rummets sparade dörrläge för sidan (eller null → default-plats)
 * @param {(side: "prev"|"next", pos: {x:number,y:number}) => void} [o.saveDoorPos]
 *        spara ett nytt dörrläge för sidan i det aktiva rummet (debounce sköts där)
 * @returns {{ listBar: HTMLElement, doorsWrap: HTMLElement, render: () => void }}
 */
export function mountRumVaxlare({ count, getCurrent, onPick, getDoorPos, saveDoorPos }) {
  // --- Rumslistan (pill-rad högst upp) --------------------------------------
  const listBar = el(`<div class="rum-lista" role="tablist" aria-label="Byt rum"></div>`);
  for (let i = 0; i < count; i++) {
    listBar.appendChild(el(
      `<button class="rum-flik" role="tab" type="button" data-room="${i}"
        aria-selected="false" title="Gå till Rum ${i + 1}">Rum ${i + 1}</button>`
    ));
  }
  listBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-room]");
    if (btn) onPick(Number(btn.dataset.room));
  });

  // --- Dörrarna (vänster = föregående rum, höger = nästa rum) ----------------
  const doorsWrap = el(`<div class="rum-dorrar" aria-hidden="false">
    <button class="rum-dorr rum-dorr-vanster" type="button" data-door="prev">
      <span class="rum-dorr-svg">${dorrSvg}</span>
      <span class="rum-dorr-nr"></span>
    </button>
    <button class="rum-dorr rum-dorr-hoger" type="button" data-door="next">
      <span class="rum-dorr-svg">${dorrSvg}</span>
      <span class="rum-dorr-nr"></span>
    </button>
  </div>`);
  const doorPrev = doorsWrap.querySelector(".rum-dorr-vanster");
  const doorNext = doorsWrap.querySelector(".rum-dorr-hoger");

  // Placera EN dörr efter det aktiva rummets sparade läge (eller default-plats).
  // Centrum-koordinater (dörren centreras med translate(-50%,-50%) i CSS).
  function sideOf(btn) { return btn.dataset.door === "next" ? "next" : "prev"; }
  function applyDoorPos(btn) {
    const side = sideOf(btn);
    const saved = getDoorPos && getDoorPos(side);
    const pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? saved : DOOR_DEFAULTS[side];
    btn.style.left = pos.x + "%";
    btn.style.top = pos.y + "%";
  }

  // --- Dra dörrarna på väggen (pointer events, procentbaserat) --------------
  // En dörr är både en NAVIGERINGS-knapp (klick → byt rum) och ett flyttbart
  // väggobjekt (dra → flytta + spara per rum). Vi skiljer klick från drag med
  // samma 3px-tröskel som möbeldraget i varld-rum.js. Efter ett faktiskt drag
  // undertrycks den efterföljande click:en så man inte råkar byta rum.
  const stageOf = (node) => node.closest(".varld-lager") || node.parentElement;
  let drag = null;
  function onDown(e) {
    const btn = e.currentTarget;
    delete btn.dataset.justDragged; // färsk gest → ev. kvarhängande flagga bort
    const stage = stageOf(btn);
    const rect = stage.getBoundingClientRect();
    drag = {
      btn, side: sideOf(btn), rect, moved: false,
      startX: e.clientX, startY: e.clientY,
      halfW: ((btn.offsetWidth / rect.width) * 100) / 2,
      halfH: ((btn.offsetHeight / rect.height) * 100) / 2,
    };
    btn.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
      drag.moved = true;
      drag.btn.classList.add("dragging");
    }
    if (!drag.moved) return;
    const x = clamp(((e.clientX - drag.rect.left) / drag.rect.width) * 100, drag.halfW, 100 - drag.halfW);
    // Dörren hålls uppe på väggen: centrum aldrig nedanför golvlinjen.
    const y = clamp(((e.clientY - drag.rect.top) / drag.rect.height) * 100, drag.halfH, FLOOR_TOP);
    drag.pos = { x, y };
    drag.btn.style.left = x + "%";
    drag.btn.style.top = y + "%";
  }
  function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.btn.classList.remove("dragging");
    if (d.moved && d.pos && saveDoorPos) {
      saveDoorPos(d.side, d.pos);
      d.btn.dataset.justDragged = "1"; // undertryck den påföljande click:en
    }
  }
  for (const btn of [doorPrev, doorNext]) {
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
  }
  doorsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-door]");
    if (!btn) return;
    if (btn.dataset.justDragged) { delete btn.dataset.justDragged; return; }
    const cur = getCurrent();
    onPick(btn.dataset.door === "next" ? cur + 1 : cur - 1);
  });

  function render() {
    const cur = getCurrent();
    applyDoorPos(doorPrev);
    applyDoorPos(doorNext);
    for (const btn of listBar.querySelectorAll(".rum-flik")) {
      const active = Number(btn.dataset.room) === cur;
      btn.classList.toggle("aktiv", active);
      btn.setAttribute("aria-selected", String(active));
    }
    // Vänsterdörr → rummet innan; döljs i första rummet.
    const hasPrev = cur > 0;
    doorPrev.hidden = !hasPrev;
    if (hasPrev) {
      doorPrev.querySelector(".rum-dorr-nr").textContent = `Rum ${cur}`;
      doorPrev.title = `Gå till Rum ${cur}`;
    }
    // Högerdörr → nästa rum; döljs i sista rummet.
    const hasNext = cur < count - 1;
    doorNext.hidden = !hasNext;
    if (hasNext) {
      doorNext.querySelector(".rum-dorr-nr").textContent = `Rum ${cur + 2}`;
      doorNext.title = `Gå till Rum ${cur + 2}`;
    }
  }
  render();

  return { listBar, doorsWrap, render };
}
