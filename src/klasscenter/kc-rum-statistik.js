// ============================================================================
// Klasscentrets rum – statistiktavlan (#498, epic #474 Klasscentret 3/4 E).
// Sessionen (kc-rum-session.js) kopplar in den här delen.
// ----------------------------------------------------------------------------
// • Tavlan (kc-statistiktavla) är en FAST möbel i bakgrunden, till höger om
//   portalen – som pokalhyllan: inte köpbar, inte flyttbar, finns i varje
//   klass rum (även gäst). Den är en <button>: klick/tryck/Enter/Space öppnar
//   panelen "Klassens statistik"; ✕ och Escape stänger (skalet, kc-rum-vy.js)
//   och fokus går tillbaka till tavlan.
// • Siffrorna står direkt på tavlan (EXP, lösta uppgifter, nivåstapel) och i
//   panelen i större format. Data (kc-statistik.js):
//     EXP     subscribeClassExp → realtid (≤ 5 shard-dokument)
//     lösta   hamtaLosta(classId) → ETT classProjections-dokument; läses när
//             rummet öppnas och på nytt varje gång panelen öppnas.
//   O(1) per klass – aldrig ett dokument per elev (incident #114).
// • Klick på tavlan når aldrig drag-kärnan (pointerdown stoppas i capture-
//   fasen) → ingen avmarkering/omritning mitt i klicket.
// Laddas BARA dynamiskt (#271).
//
// API
//   KC_TAVLA = { x, y, w, h }  tavlans mitt (% av scenen) + storlek (rums-enheter)
//   skapaKcRumStatistik({ lager, panel, oppnaPanel, klassNamn? }) → {
//     tavlaHtml(animera) → markup (bakgrunden)
//     exp({ exp, antalElever })   ny EXP från subscribeClassExp
//     losta(n | null)             lösta uppgifter (null = kunde inte läsas)
//     stad() }
// ============================================================================

import { KC_POKALER, kcPokalMarkup } from "../art-klasscenter-pokaler.js";
import { statistikModell, panelHtml, tavlaVarden, talText } from "./kc-statistik.js";

// Samma enhet som rumSakHtml (rum-promenad-golv.js).
const ENHET = "min(var(--rum-koeff, 2.5) * 1cqw, var(--rum-cap, 25px))";
const TAVLA_SEL = ".kc-statistiktavla";

const TAVLA_VB = KC_POKALER["kc-statistiktavla"].viewBox;
const [, , TVB_W, TVB_H] = TAVLA_VB.split(" ").map(Number);
const TAVLA_W = 10;
/** Tavlans mitt (% av scenen) och storlek (rums-enheter): fötterna på golvet, höger om portalen. */
export const KC_TAVLA = Object.freeze({
  x: 80,
  y: 52,
  w: TAVLA_W,
  h: +((TAVLA_W * TVB_H) / TVB_W).toFixed(2),
});

export function skapaKcRumStatistik({ lager, panel, oppnaPanel, klassNamn = "" }) {
  let exp = null;
  let antalElever = null;
  let losta = null;
  const innehall = panel.querySelector('[data-kc="statistik"]');
  const modell = () => statistikModell({ exp, antalElever, losta });

  function etikett(m) {
    if (!m.laddad) return "Klassens statistiktavla – öppna för att se klassens statistik";
    return `Klassens statistiktavla: ${talText(m.exp)} EXP, ` +
      `${m.losta == null ? "okänt antal" : talText(m.losta)} lösta uppgifter. Öppna för mer`;
  }

  // Bara tavlans värden ritas om när data kommer (inte hela scenen).
  function uppdatera() {
    const m = modell();
    const btn = lager.querySelector(TAVLA_SEL);
    if (btn) {
      btn.setAttribute("aria-label", etikett(m));
      const g = btn.querySelector(".kc-tavla-varden");
      if (g) g.innerHTML = tavlaVarden(m);
    }
    if (!panel.hidden) innehall.innerHTML = panelHtml(m, { klassNamn });
  }

  // Panelen öppnad (tavlan eller annan väg) → rita innehållet; stängd → fokus tillbaka.
  let varOppen = !panel.hidden;
  const mo = new MutationObserver(() => {
    if (panel.hidden === !varOppen) return;
    varOppen = !panel.hidden;
    if (varOppen) innehall.innerHTML = panelHtml(modell(), { klassNamn });
    else if (panel.contains(document.activeElement) || document.activeElement === document.body) {
      lager.querySelector(TAVLA_SEL)?.focus({ preventScroll: true });
    }
  });
  mo.observe(panel, { attributes: true, attributeFilter: ["hidden"] });

  const ned = (e) => {
    if (e.target.closest(TAVLA_SEL)) e.stopPropagation();
  };
  const klick = (e) => {
    if (!e.target.closest(TAVLA_SEL)) return;
    oppnaPanel("statistik");
    panel.querySelector(".varld-panel-stang")?.focus({ preventScroll: true });
  };
  lager.addEventListener("pointerdown", ned, true);
  lager.addEventListener("click", klick);

  return {
    tavlaHtml(animera) {
      const m = modell();
      return (
        `<button type="button" class="kc-statistiktavla" aria-haspopup="dialog" aria-label="${etikett(m)}" ` +
        `style="left:${KC_TAVLA.x}%;top:${KC_TAVLA.y}%;width:calc(${KC_TAVLA.w} * ${ENHET});` +
        `height:calc(${KC_TAVLA.h} * ${ENHET})">` +
        `<svg class="kc-pokal-svg" data-art="kc-statistiktavla" viewBox="${TAVLA_VB}" aria-hidden="true" ` +
        `focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
        `${kcPokalMarkup("kc-statistiktavla", { animera })}<g class="kc-tavla-varden">${tavlaVarden(m)}</g></svg>` +
        `</button>`
      );
    },
    exp(k) {
      exp = k?.exp ?? null;
      antalElever = k?.antalElever ?? null;
      uppdatera();
    },
    losta(n) {
      losta = n == null ? null : n;
      uppdatera();
    },
    stad() {
      mo.disconnect();
      lager.removeEventListener("pointerdown", ned, true);
      lager.removeEventListener("click", klick);
    },
  };
}
