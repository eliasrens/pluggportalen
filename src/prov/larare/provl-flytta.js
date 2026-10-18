// ============================================================================
// Prov (#763, spec §2.3.1/§8.1): flytta frågekorten i redigeraren på tre sätt
// (i stället för upp/ned-pilarna):
//   - dra i handtaget ⋮⋮ (mus och finger, prov-dra.js)
//   - "Flytta till…" öppnar ett litet fält: skriv t.ex. 3 → kortet hamnar
//     där med ETT tryck (indexForPlats i prov-flytta-ops.js – frågenumren
//     räknar bara frågorna, avsnitt och textblock har inget nummer)
//   - Alt + pil upp/ned flyttar kortet ett steg (fokus var som helst i kortet)
// Själva flytten gör redigeraren: onFlytta(tillIndex, fokusNyckel).
// ============================================================================

import { el, esc } from "../../teacher-shared.js";
import { dragbar } from "../prov-dra.js";
import { indexForPlats, platsGrans } from "../prov-flytta-ops.js";

/** Handtaget först i kortets huvud. `namn` = "Fråga 3" / "Avsnittet" / "Textblocket". */
export const handtagHtml = (namn) => `<button type="button" class="provl-handtag" data-k="handtag"
  aria-label="Flytta ${esc(namn.toLowerCase())} – dra, eller Alt + pil upp/ned" title="Dra för att flytta (eller Alt + pil upp/ned)"><span aria-hidden="true">⋮⋮</span></button>`;

export const flyttaTillHtml = `<button type="button" class="btn small ghost" data-k="flytta-till" aria-expanded="false">Flytta till…</button>`;

/**
 * Koppla kortets tre sätt att flytta.
 * @param {HTMLElement} li   kortet (data-i)
 * @param {{ i: number, fragor: object[], lista: HTMLElement, onFlytta: (till: number, fokus: string) => void }} o
 */
export function kopplaFlytt(li, { i, fragor, lista, onFlytta }) {
  const handtag = li.querySelector('[data-k="handtag"]');
  const knapp = li.querySelector('[data-k="flytta-till"]');

  // --- Dra i handtaget: släppet hamnar mellan korten där pekaren är ----------
  const ovriga = () => [...lista.querySelectorAll(":scope > [data-i]")].filter((x) => x !== li);
  const tillIndex = (y) => ovriga().filter((x) => {
    const r = x.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
  const rensa = () => lista.querySelectorAll(".provl-slapp-fore, .provl-slapp-efter").forEach((x) => x.classList.remove("provl-slapp-fore", "provl-slapp-efter"));
  dragbar(handtag, {
    vantaMs: 0,
    kopiaAv: li,
    onRor: ({ y }) => {
      rensa();
      const andra = ovriga();
      const t = tillIndex(y);
      if (andra[t]) andra[t].classList.add("provl-slapp-fore");
      else andra[andra.length - 1]?.classList.add("provl-slapp-efter");
    },
    onSlut: rensa,
    onSlapp: ({ y }) => onFlytta(tillIndex(y), "handtag"),
  });

  // --- Alt + pil upp/ned: ett steg ------------------------------------------------
  li.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    if (e.target.closest("input, textarea, select")) return;
    e.preventDefault();
    const till = i + (e.key === "ArrowUp" ? -1 : 1);
    if (till >= 0 && till < fragor.length) onFlytta(till, "handtag");
  });

  // --- "Flytta till…": ett litet fält, en plats, ett tryck --------------------------
  knapp.addEventListener("click", () => {
    const oppen = li.querySelector(".provl-flytta-till");
    if (oppen) return stang(oppen);
    const { arFraga, max } = platsGrans(fragor, i);
    const hint = arFraga ? `fråga 1–${max}` : max > 1 ? `före fråga 1–${max - 1}, eller ${max} = sist` : "1 = sist";
    const ruta = el(`<div class="provl-flytta-till" role="group" aria-label="Flytta till plats">
      <label>Till plats <input type="number" inputmode="numeric" min="1" max="${max}" step="1" data-flytta-nr /></label>
      <span class="hint">(${hint})</span>
      <button type="button" class="btn small gron" data-flytta-ok>Flytta</button>
      <button type="button" class="btn small ghost" data-flytta-avbryt>Avbryt</button>
      <span class="provl-flytta-fel" role="alert"></span>
    </div>`);
    const nr = ruta.querySelector("[data-flytta-nr]");
    const ok = () => {
      const p = Number(String(nr.value).trim());
      const hogst = Number(nr.max);
      if (!Number.isInteger(p) || p < 1 || p > hogst) {
        ruta.querySelector(".provl-flytta-fel").textContent = `Skriv en plats från 1 till ${hogst}.`;
        nr.focus();
        return;
      }
      onFlytta(indexForPlats(fragor, i, p), "flytta-till");
    };
    ruta.querySelector("[data-flytta-ok]").addEventListener("click", ok);
    ruta.querySelector("[data-flytta-avbryt]").addEventListener("click", () => stang(ruta));
    nr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ok(); }
      if (e.key === "Escape") { e.preventDefault(); stang(ruta); }
    });
    li.querySelector(".provl-kort-huvud").after(ruta);
    knapp.setAttribute("aria-expanded", "true");
    nr.focus();
  });
  const stang = (ruta) => {
    ruta.remove();
    knapp.setAttribute("aria-expanded", "false");
    knapp.focus();
  };
}
