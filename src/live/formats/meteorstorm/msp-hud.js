// ============================================================================
// Meteorstormen – projektorns TEXTLAGER ovanpå rymden (#822, spec §4.2–4.3).
// Överst: matchens klocka + händelsebanderollen ("☀️ SOLSTORM! …" med
// nedräkning). Ovanför varje station: klassens namn i klassens färg, skrov-
// och sköldmätare (orange vid 25–1), laserladdning, dragstrålen och "🚀 4D får
// extra kraft!". Nederst: flödet (högst 4 rader, bara det som är bra). Allt
// sätts ur tillståndet vid renderingstiden t (flödets in-/uttoning räknas ur
// radens ålder), så två projektorer visar samma sak. Slutrutan: msp-slut.js.
//
// API
//   createHud(ram, { namn(classId), farger, pl, screen }) → {
//     klocka(text, slut),  banderoll(b | null),  stationer(lista, t, avslut),
//     flode(rader),  el, destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { SKOLD_TAK, LADDNING_TAK, skadeniva } from "./delat/ms-balans.js";
import { W, H } from "./msp-scen.js";

const pct = (v, max) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%`;

export function createHud(ram, { namn, farger, pl }) {
  const el = document.createElement("div");
  el.className = "msp-hud";
  el.innerHTML = `
    <div class="msp-topp">
      <div class="msp-klocka"><b data-klocka>--:--</b><span>kvar</span></div>
      <div class="msp-band" data-band hidden><span data-bandtext></span><b data-bandkvar></b></div>
    </div>
    ${pl.map((p, i) => `
      <div class="msp-stn" data-i="${i}" style="left:${(p.x / W) * 100}%;top:${((p.y - 285 * p.skala) / H) * 100}%;--msp-k:${farger[i]}">
        <div class="msp-stn-namn"></div>
        <div class="msp-mat msp-mat-skrov"><i></i><span></span></div>
        <div class="msp-mat msp-mat-skold"><i></i><span></span></div>
        <div class="msp-stn-rad"><span data-laser></span><span data-drag></span></div>
        <div class="msp-hjalp" hidden></div>
      </div>`).join("")}
    <ol class="msp-flode" aria-live="polite"></ol>`;
  ram.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const stn = [...el.querySelectorAll(".msp-stn")];
  const flodeEl = $(".msp-flode");
  const senast = new Map();
  /** Skriv bara när något ändrats (projektorn ritar 60 ggr/s). */
  const satt = (nod, nyckel, varde, fn) => {
    const k = `${nyckel}`;
    if (senast.get(nod)?.[k] === varde) return;
    const m = senast.get(nod) || {};
    m[k] = varde;
    senast.set(nod, m);
    fn(varde);
  };

  function klocka(text, slut) {
    const b = $("[data-klocka]");
    satt(b, "t", text, (v) => { b.textContent = v; });
    satt(b, "s", !!slut, (v) => b.parentElement.classList.toggle("msp-slutet", v));
  }

  function banderoll(b) {
    const band = $("[data-band]");
    satt(band, "h", !b, (v) => { band.hidden = v; });
    if (!b) return;
    satt(band, "typ", b.typ, (v) => { band.dataset.typ = v; $("[data-bandtext]").textContent = b.text; });
    satt(band, "kvar", b.kvar, (v) => { $("[data-bandkvar]").textContent = v > 0 ? `${v} s` : ""; });
  }

  function stationer(lista, t) {
    lista.forEach((s, i) => {
      const box = stn[i];
      if (!box) return;
      const varning = skadeniva(s.skrov).id === "rok" || s.skrov === 0;
      satt(box, "namn", s.classId, () => { box.querySelector(".msp-stn-namn").textContent = namn(s.classId); });
      satt(box, "v", varning, (v) => box.classList.toggle("msp-varning", v));
      const skrov = box.querySelector(".msp-mat-skrov");
      satt(skrov, "w", Math.round(s.skrov * 10), () => {
        skrov.querySelector("i").style.width = pct(s.skrov, 100);
        skrov.querySelector("span").textContent = s.skrov > 0 ? `Skrov ${Math.ceil(s.skrov)} %` : "Flyter i rymden";
      });
      const skold = box.querySelector(".msp-mat-skold");
      satt(skold, "w", Math.round(s.skold * 10), () => {
        skold.querySelector("i").style.width = pct(s.skold, SKOLD_TAK);
        skold.querySelector("span").textContent = s.skold >= 0.5 ? `Sköld ${Math.round(s.skold)}/${SKOLD_TAK}` : "Sköld 0";
        skold.classList.toggle("msp-full", s.skold >= SKOLD_TAK - 0.5);
      });
      satt(box, "laser", s.skott, (v) => { box.querySelector("[data-laser]").textContent = `🔫 ${v}/${LADDNING_TAK} skott`; });
      const drag = !s.drag?.tillaten ? "" : s.drag.armerad ? "🌀 fångar …" : t >= s.drag.redoMs ? `🌀 redo (${s.drag.kostnad} ⚡)` : `🌀 ${Math.ceil((s.drag.redoMs - t) / 1000)} s`;
      satt(box, "drag", drag, (v) => { box.querySelector("[data-drag]").textContent = v; });
      const hj = box.querySelector(".msp-hjalp");
      satt(hj, "h", !!s.hjalp, (v) => {
        hj.hidden = !v;
        hj.textContent = `🚀 ${namn(s.classId)} får extra kraft!`;
      });
    });
  }

  const rader = new Map(); // key → li
  function flode(lista) {
    const sedda = new Set();
    lista.forEach((r, ordning) => {
      sedda.add(r.key);
      let li = rader.get(r.key);
      if (!li) {
        li = document.createElement("li");
        li.className = `msp-rad${r.stor ? " msp-rad-stor" : ""}`;
        li.innerHTML = `<span class="msp-rad-ikon">${esc(r.ikon)}</span><span class="msp-rad-text">${esc(r.text)}</span>`;
        flodeEl.appendChild(li);
        rader.set(r.key, li);
      }
      // ålder → in (0,4 s) och ut (sista 0,6 s); ordningen nyast överst
      const inn = Math.min(1, r.alder / 400);
      const ut = Math.min(1, (14_000 - r.alder) / 600);
      const op = Math.max(0, Math.min(inn, ut)).toFixed(2);
      const x = ((1 - inn) * 30).toFixed(1);
      satt(li, "s", `${op}|${x}|${ordning}`, () => {
        li.style.opacity = op;
        li.style.transform = `translateX(${x}%)`;
        li.style.order = String(ordning);
      });
    });
    for (const [k, li] of rader) {
      if (sedda.has(k)) continue;
      li.remove();
      rader.delete(k);
    }
  }

  return { el, klocka, banderoll, stationer, flode, destroy: () => el.remove() };
}
