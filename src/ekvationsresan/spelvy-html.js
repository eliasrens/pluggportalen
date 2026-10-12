// ============================================================================
// Ekvationsresan – spelvyns HTML (src/ekvationsresan/spelvy-html.js) · #618
// ----------------------------------------------------------------------------
// Rena strängmallar för spelvyn (spelvy.js styr dem): skalet (vänster spel ca
// 64 %, höger MIN LÖSNING ca 36 %, spec E1.2), resultatet med stjärnor, nivå
// upp-skärmen och den frivilliga nivåöversikten (E1.9). Prefix ekv-.
// ============================================================================

import { coinIcon } from "../icons.js";
import { FEEDBACK, UI_TEXT, LEVEL_UP, levelConfig } from "./config.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const OP_KNAPPAR = [
  { op: "+", label: "+", namn: "Addera" },
  { op: "-", label: "−", namn: "Subtrahera" },
  { op: "*", label: "×", namn: "Multiplicera" },
  { op: "/", label: "÷", namn: "Dividera" },
];

export function shellHtml() {
  return `
  <div class="ekv-sida">
    <section class="ekv-spel" aria-label="Ekvationsresan">
      <header class="ekv-topp">
        <h1 class="ekv-niva"></h1>
        <div class="ekv-matare" role="progressbar" aria-label="Hur nära nästa nivå" aria-valuemin="0" aria-valuemax="100">
          <span class="ekv-matare-fyll"></span>
        </div>
        <button type="button" class="ekv-oversikt-knapp" aria-expanded="false" title="Nivåöversikt">Nivåer</button>
        <div class="ekv-oversikt" hidden></div>
      </header>
      <div class="ekv-uppgiftstext" hidden></div>
      <div class="ekv-vag-plats"></div>
      <p class="ekv-instruktion">${esc(UI_TEXT.instruction)}</p>
      <div class="ekv-fraga" hidden></div>
      <div class="ekv-styr">
        <form class="ekv-drag" autocomplete="off" novalidate>
          <div class="ekv-ops" role="group" aria-label="Välj räknesätt">
            ${OP_KNAPPAR.map((k) => `<button type="button" class="ekv-op" data-op="${k.op}" title="${k.namn}" aria-label="${k.namn}">${k.label}</button>`).join("")}
          </div>
          <input class="ekv-falt" type="text" inputmode="text" maxlength="8" enterkeyhint="send"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            aria-label="Skriv räknesätt och tal, till exempel −4 eller /2" placeholder="−4" />
          <button type="submit" class="ekv-gor">GÖR</button>
        </form>
        <div class="ekv-hjalp-rad">
          <button type="button" class="ekv-hjalp-knapp">💡 Hjälp mig</button>
          <button type="button" class="ekv-visa-knapp">Visa lösningen</button>
        </div>
      </div>
      <div class="ekv-resultat" hidden></div>
      <div class="ekv-prat" role="status" aria-live="polite"></div>
    </section>
    <aside class="ekv-hafte" aria-label="Min lösning">
      <h2 class="ekv-hafte-rubrik">MIN LÖSNING</h2>
      <ol class="ekv-rader"></ol>
    </aside>
    <div class="ekv-nivaupp" hidden role="dialog" aria-modal="true" aria-labelledby="ekv-nivaupp-rubrik"></div>
  </div>`;
}

export function levelTitle(level) {
  return `NIVÅ ${level} – ${levelConfig(level).name.toUpperCase()}`;
}

const stjarnor = (n) =>
  [1, 2, 3].map((i) => `<span class="ekv-stjarna${i <= n ? " is-pa" : ""}" aria-hidden="true">${i <= n ? "⭐" : "☆"}</span>`).join("");

/**
 * Resultatet efter en uppgift (E1.7). `coins` = null medan det sparas.
 * @param {{stars, feedback, offerRetry, solved}} result
 */
export function resultHtml(result, { coins = null, saving = false, error = false, retry = true } = {}) {
  const myntRad = !result.solved
    ? ""
    : `<p class="ekv-mynt${saving ? " is-sparar" : ""}">${saving ? "Sparar…" : `+${coins ?? result.coins} ${coinIcon("1.1em")}`}</p>`;
  return `
    <div class="ekv-stjarnor" aria-label="${result.stars} av 3 stjärnor">${result.solved ? stjarnor(result.stars) : '<span class="ekv-ej-lost">Ej löst</span>'}</div>
    <p class="ekv-feedback">${esc(result.feedback)}</p>
    ${myntRad}
    ${error ? `<p class="ekv-fel">${esc(UI_TEXT.saveError)}</p>` : ""}
    <div class="ekv-resultat-knappar">
      ${result.offerRetry && retry ? `<button type="button" class="ekv-igen">${esc(FEEDBACK.retryButton)}</button>` : ""}
      <button type="button" class="ekv-nasta"${saving ? " disabled" : ""}>${esc(UI_TEXT.next)}</button>
    </div>`;
}

/** Nivå upp (E1.9): kort och glad. Nivå ner har ingen skärm alls. */
export function levelUpHtml(level) {
  return `
    <div class="ekv-nivaupp-kort">
      <div class="ekv-nivaupp-fest" aria-hidden="true">🎉</div>
      <h2 id="ekv-nivaupp-rubrik">NY NIVÅ! NIVÅ ${level}</h2>
      <p class="ekv-nivaupp-namn">${esc(levelConfig(level).name)}</p>
      <p>${esc(LEVEL_UP[level] || "Bra jobbat! Nu blir ekvationerna lite klurigare…")}</p>
      <button type="button" class="ekv-fortsatt">${esc(UI_TEXT.levelUpContinue)}</button>
    </div>`;
}

/** Den frivilliga översikten: 1 ✓ 2 ✓ 3 ● 4 🔒 … (framsteg.levelOverview). */
export function overviewHtml(levels) {
  const tecken = { done: "✓", current: "●", locked: "🔒" };
  return `<ol class="ekv-oversikt-lista">${levels
    .map((l) => `<li class="is-${l.state}"><b>${l.level}</b> <span aria-hidden="true">${tecken[l.state]}</span> <span class="ekv-oversikt-namn">${esc(l.name)}</span></li>`)
    .join("")}</ol>`;
}

/** Hjälpbubblan (E1.6): stegets text + ev. förslagsraden (steg 3). */
export function hintHtml(hint, rowHtmlFn) {
  const row = hint.row ? `<div class="ekv-hjalp-forslag">${rowHtmlFn(hint.row)}</div>` : "";
  return `<span class="ekv-prat-etikett">💡 ${hint.step}/4</span> <span>${esc(hint.text)}</span>${row}`;
}
