// ============================================================================
// Klasscentrets rum – pokalerna: hyllan, pokal-sakerna och hover-rutan
// (#497, epic #474). Sessionen (kc-rum-session.js) kopplar in den här delen.
// ----------------------------------------------------------------------------
// • Hyllan (kc-pokalhylla) är en FAST möbel i bakgrunden (aldrig dragbar).
// • Varje pokal är en vanlig rum-sak med nyckeln "pokal-<trophyId>" och går
//   att dra som övriga möbler. Pokaler som ingen flyttat auto-placeras
//   (kc-pokal-placering.js) – de ligger i tillståndet som "auto" och sparas
//   inte; flyttas en blir den en vanlig placering (Spara/Historik som allt).
// • Hover-rutan (mus) / tryck (finger, penna): titel, text, tävling + datum.
//   Den ligger i rummets UI-lager (inte i scenen) med pointer-events: none →
//   stör aldrig drag; döljs när en drag börjar.
// Laddas BARA dynamiskt (#271).
//
// API
//   skapaKcRumPokaler({ lager, ui, vidResize }) → {
//     satt(pokaler)            klassens pokaler (normaliseraPokaler)
//     finns() → bool
//     autoPlacera(lokal) → { nyckel: pos }   till skapaKcRumTillstand
//                            (räknar också om Troféhyllans pokaler, #528)
//     trofehyllaArt(animera) → <svg> Troféhyllan med klassens finaste pokaler
//     sak(id, { auto, animera }) → sak | null (pokal-nyckel men okänd pokal)
//                                | undefined (inte en pokal-nyckel)
//     hyllaHtml(animera) → markup (bakgrunden)
//     dolj()  stad() }
// ============================================================================

import { kcPokalSvg, kcTrofehyllaSvg } from "../art-klasscenter-pokaler.js";
import { pokalIdFranNyckel, pokalNyckel, pokalTooltip } from "./kc-pokal-typer.js";
import { KC_HYLLA, KC_POKAL_STORLEK, hedersPokaler, placeraPokaler } from "./kc-pokal-placering.js";

// Samma enhet som rumSakHtml (rum-promenad-golv.js).
const ENHET = "min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px))";
// En pokal-sak i rummet, eller en pokal inne i Troféhyllan (#528).
const POKAL_SEL = '.room-item[data-id^="pokal-"], .kc-pokal-plats[data-pokal-id]';
const TRYCK_MAX = 6; // px – längre rörelse = en drag, inte ett tryck

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Rutans innehåll (ren sträng – testas i Node). */
export function pokalTipsHtml(pokal) {
  const tt = pokalTooltip(pokal);
  const fot = [tt.detalj && `🏁 ${esc(tt.detalj)}`, tt.datum && `📅 ${esc(tt.datum)}`].filter(Boolean).join(" · ");
  return `<b class="kc-pokal-tips-rubrik">🏆 ${esc(tt.rubrik)}</b>` +
    (tt.text ? `<span class="kc-pokal-tips-text">${esc(tt.text)}</span>` : "") +
    (fot ? `<small class="kc-pokal-tips-fot">${fot}</small>` : "");
}

export function skapaKcRumPokaler({ lager, ui, vidResize }) {
  let karta = new Map(); // trophyId → Pokal
  let lista = [];
  let heders = []; // pokalerna i Troféhyllan (#528), senaste autoPlacera

  // Scenens mått (px) + rums-enheten – hyllplatsernas procent beror på dem.
  function matt() {
    const W = lager.clientWidth;
    const H = lager.clientHeight;
    const cs = getComputedStyle(lager);
    const koeff = parseFloat(cs.getPropertyValue("--rum-koeff")) || 2.5;
    const cap = parseFloat(cs.getPropertyValue("--rum-cap")) || 25;
    return { W, H, enhet: Math.min((koeff * W) / 100, cap) };
  }

  // --- Hover-/tryck-rutan ---------------------------------------------------
  const tips = document.createElement("div");
  tips.className = "kc-pokal-tips";
  tips.setAttribute("role", "tooltip");
  tips.hidden = true;
  ui.appendChild(tips);
  let visas = null; // nyckeln rutan visar
  let tryck = null; // { nyckel, node, x, y } från pointerdown

  function dolj() {
    tips.hidden = true;
    visas = null;
  }

  // Rutans nyckel: rum-sakens data-id, eller "pokal-<id>" i Troféhyllan.
  const nyckelAv = (node) => (node.dataset.pokalId ? pokalNyckel(node.dataset.pokalId) : node.dataset.id);

  function visa(node) {
    const nyckel = nyckelAv(node);
    const p = karta.get(pokalIdFranNyckel(nyckel));
    if (!p) return dolj();
    tips.innerHTML = pokalTipsHtml(p);
    tips.hidden = false;
    visas = nyckel;
    // Ovanför pokalen (under om det inte får plats under knappraden), inom scenen.
    const u = ui.getBoundingClientRect();
    const r = (node.querySelector(".ri-emoji") || node).getBoundingClientRect();
    const topp = ui.querySelector(".varld-ui-topp")?.getBoundingClientRect().bottom ?? u.top;
    const w = tips.offsetWidth;
    const h = tips.offsetHeight;
    const x = Math.min(u.width - w / 2 - 8, Math.max(w / 2 + 8, r.left + r.width / 2 - u.left));
    const under = r.top - h - 12 < topp;
    tips.classList.toggle("under", under);
    tips.style.left = `${x}px`;
    tips.style.top = `${under ? r.bottom - u.top + 12 : r.top - u.top - h - 12}px`;
  }

  const over = (e) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    const node = e.target.closest(POKAL_SEL);
    if (node && nyckelAv(node) !== visas) visa(node);
  };
  const ut = (e) => {
    if (e.pointerType !== "mouse" || !visas) return;
    const node = e.target.closest(POKAL_SEL);
    if (node && !node.contains(e.relatedTarget)) dolj();
  };
  // Capture-fas: körs FÖRE drag-kärnans lyssnare (som ritar om scenen).
  const ned = (e) => {
    const node = e.target.closest(POKAL_SEL);
    tryck = node && e.pointerType !== "mouse" ? { nyckel: nyckelAv(node), node, x: e.clientX, y: e.clientY } : null;
    if (e.pointerType === "mouse" || !node || nyckelAv(node) !== visas) dolj();
  };
  const upp = (e) => {
    const tr = tryck;
    tryck = null;
    if (!tr || Math.hypot(e.clientX - tr.x, e.clientY - tr.y) > TRYCK_MAX || !tr.node.isConnected) return;
    if (visas === tr.nyckel) dolj();
    else visa(tr.node);
  };
  lager.addEventListener("pointerover", over);
  lager.addEventListener("pointerout", ut);
  lager.addEventListener("pointerdown", ned, true);
  lager.addEventListener("pointerup", upp, true);

  // Scenen bytte storlek → hyllplatsernas procent räknas om.
  let ro = null;
  if (typeof ResizeObserver === "function") {
    let forra = "";
    ro = new ResizeObserver(() => {
      const m = matt();
      const nu = `${m.W}x${m.H}`;
      if (nu === forra || !m.W) return;
      forra = nu;
      dolj();
      if (lista.length) vidResize?.();
    });
    ro.observe(lager);
  }

  return {
    satt(pokaler) {
      lista = Array.isArray(pokaler) ? pokaler : [];
      karta = new Map(lista.map((p) => [p.id, p]));
      if (visas && !karta.has(pokalIdFranNyckel(visas))) dolj();
    },
    finns: () => lista.length > 0,
    autoPlacera(lokal) {
      heders = hedersPokaler(lista, lokal);
      return lista.length ? placeraPokaler(lista, lokal, matt()) : {};
    },
    trofehyllaArt: (animera) => kcTrofehyllaSvg(heders, { animera, aria: "Klassens Troféhylla – hedershyllan" }),
    sak(id, { auto = false, animera = false } = {}) {
      const tid = pokalIdFranNyckel(id);
      if (!tid) return undefined;
      const p = karta.get(tid);
      if (!p) return null;
      return {
        namn: "", // ingen inbyggd title – hover-rutan visar texten
        w: KC_POKAL_STORLEK.w,
        h: KC_POKAL_STORLEK.h,
        golv: false,
        art: kcPokalSvg(p.art, { animera, aria: p.titel }) || "🏆",
        taBort: !auto, // 🗑️ på en flyttad pokal = tillbaka till hyllan
      };
    },
    hyllaHtml: (animera) =>
      `<div class="kc-pokalhylla" style="left:${KC_HYLLA.x}%;top:${KC_HYLLA.y}%;` +
      `width:calc(${KC_HYLLA.w} * ${ENHET});height:calc(${KC_HYLLA.h} * ${ENHET})">` +
      `${kcPokalSvg("kc-pokalhylla", { animera, aria: "Klassens pokalhylla" })}</div>`,
    dolj,
    stad() {
      dolj();
      ro?.disconnect();
      lager.removeEventListener("pointerover", over);
      lager.removeEventListener("pointerout", ut);
      lager.removeEventListener("pointerdown", ned, true);
      lager.removeEventListener("pointerup", upp, true);
      tips.remove();
    },
  };
}
