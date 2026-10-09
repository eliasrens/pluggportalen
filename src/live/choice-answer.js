// ============================================================================
// Flervalskomponent (#552) – elevens fyra svarsknappar i Live (Snilleblixten,
// Guldrushen). Syskon till den snabba skriv-själv-komponenten
// src/mult/fast-answer.js. Ladda med dynamisk import (inte i bootkedjan).
// ----------------------------------------------------------------------------
// Fyra stora knappar i 2×2 som fyller värdelementet (Chromebook 1366×768 utan
// scroll). Färg OCH form, aldrig bara färg: röd ▲, blå ◆, gul ●, grön ■ –
// samma ordning som projektorns 2×2-rutnät (CHOICE_STYLES, återanvänd där).
// Tangenterna 1–4 väljer. Första valet LÅSER: dubbelklick/dubbeltangent
// registrerar bara det första. Låst = vald knapp lyser, övriga krymper.
// Styling: src/live/choice-answer.css – laddas av komponenten själv.
//
// API
//   CHOICE_STYLES  [{ key, name, shape, label }] – index 0–3 (röd/blå/gul/grön)
//   choiceShapeSvg(i) → inline-SVG för formen (projektorn kan återanvända)
//   mountChoiceAnswer(root, opts) → handle
//     opts.options    4 alternativ (tal/text) – kan sättas senare via setQuestion
//     opts.question   frågetext ovanför knapparna (valfri; "" = ingen rad)
//     opts.onChoose   (index, option) => void – EXAKT en gång per fråga
//     opts.sentText   statusrad efter val (default "⚡ Svar inskickat!")
//     opts.enabled    false → knapparna låsta (lobby/avslöjande)
//     opts.keyboard   false → ingen 1–4-lyssnare (t.ex. två komponenter samtidigt)
//   handle.setQuestion({ options, question? }) – ny fråga, olåst och påslagen
//   handle.reveal(correctIndex) – markera rätt (✓) / valt fel (✗), låser
//   handle.setEnabled(bool)     handle.chosen() → index|null
//   handle.destroy()
// ============================================================================

export const CHOICE_STYLES = Object.freeze([
  { key: "rod", name: "röd", shape: "triangel", label: "Röd triangel" },
  { key: "bla", name: "blå", shape: "romb", label: "Blå romb" },
  { key: "gul", name: "gul", shape: "cirkel", label: "Gul cirkel" },
  { key: "gron", name: "grön", shape: "kvadrat", label: "Grön kvadrat" },
]);

const SHAPES = {
  triangel: '<polygon points="12,2.5 22.5,21 1.5,21"/>',
  romb: '<polygon points="12,1.5 22.5,12 12,22.5 1.5,12"/>',
  cirkel: '<circle cx="12" cy="12" r="10"/>',
  kvadrat: '<rect x="2.5" y="2.5" width="19" height="19" rx="1.5"/>',
};

/** Formen för alternativ i (0–3) som inline-SVG (fyllning = currentColor). */
export function choiceShapeSvg(i) {
  const s = CHOICE_STYLES[i];
  return `<svg class="ca-form" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SHAPES[s.shape]}</svg>`;
}

const CSS_HREF = new URL("./choice-answer.css", import.meta.url).href;

function ensureCss() {
  if (document.querySelector('link[data-choice-answer-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.choiceAnswerCss = "";
  document.head.appendChild(link);
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function isTextField(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return true;
  return el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "reset"].includes(String(el.type).toLowerCase());
}

/**
 * @param {HTMLElement} root
 * @param {object} [opts] se API ovan
 */
export function mountChoiceAnswer(root, opts = {}) {
  ensureCss();
  const onChoose = opts.onChoose || (() => {});
  const sentText = opts.sentText ?? "⚡ Svar inskickat!";

  root.classList.add("ca-root");
  root.innerHTML = `
    <div class="ca-fraga" aria-live="polite"></div>
    <div class="ca-grid" role="group" aria-label="Svarsalternativ">
      ${CHOICE_STYLES.map((s, i) => `
        <button type="button" class="ca-knapp ca-${s.key}" data-i="${i}" aria-keyshortcuts="${i + 1}">
          ${choiceShapeSvg(i)}
          <span class="ca-text"></span>
          <span class="ca-tangent" aria-hidden="true">${i + 1}</span>
          <span class="ca-markor" aria-hidden="true"></span>
        </button>`).join("")}
    </div>
    <div class="ca-status" role="status" aria-live="polite"></div>`;
  const qEl = root.querySelector(".ca-fraga");
  const grid = root.querySelector(".ca-grid");
  const buttons = [...root.querySelectorAll(".ca-knapp")];
  const statusEl = root.querySelector(".ca-status");

  let options = [];
  let chosen = null;
  let enabled = opts.enabled !== false;
  let destroyed = false;

  function render() {
    buttons.forEach((b, i) => {
      const has = i < options.length;
      b.hidden = !has;
      b.querySelector(".ca-text").textContent = has ? String(options[i]) : "";
      b.setAttribute("aria-label", has ? `${i + 1}: ${options[i]} (${CHOICE_STYLES[i].label})` : "");
    });
    grid.dataset.antal = String(options.length);
    syncState();
  }

  function syncState() {
    const locked = chosen !== null || !enabled;
    root.classList.toggle("ca-last", locked);
    root.classList.toggle("ca-har-valt", chosen !== null);
    buttons.forEach((b, i) => {
      b.classList.toggle("ca-vald", chosen === i);
      b.classList.toggle("ca-krympt", chosen !== null && chosen !== i);
      b.setAttribute("aria-pressed", chosen === i ? "true" : "false");
      b.setAttribute("aria-disabled", locked ? "true" : "false");
    });
  }

  function choose(i) {
    if (destroyed || !enabled || chosen !== null) return;
    if (!(i >= 0 && i < options.length)) return;
    chosen = i; // låses synkront → ett andra klick/tangent hinner aldrig in
    syncState();
    statusEl.textContent = sentText;
    onChoose(i, options[i]);
  }

  function onClick(e) {
    const b = e.target.closest(".ca-knapp");
    if (b) choose(Number(b.dataset.i));
  }

  function onKey(e) {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTextField(document.activeElement)) return;
    const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || "")?.[1] ?? (/^[1-4]$/.test(e.key) ? e.key : null);
    if (!n) return;
    e.preventDefault();
    choose(Number(n) - 1);
  }

  grid.addEventListener("click", onClick);
  if (opts.keyboard !== false) document.addEventListener("keydown", onKey);

  function setQuestion({ options: opt = [], question = "" } = {}) {
    options = opt.slice(0, 4);
    chosen = null;
    enabled = true;
    qEl.textContent = question;
    qEl.hidden = !question;
    statusEl.textContent = "";
    buttons.forEach((b) => {
      b.classList.remove("ca-ratt", "ca-fel");
      b.querySelector(".ca-markor").textContent = "";
    });
    root.classList.remove("ca-avslojad");
    render();
  }

  setQuestion({ options: opts.options || [], question: opts.question || "" });
  enabled = opts.enabled !== false;
  syncState();

  return {
    setQuestion,
    reveal(correctIndex) {
      enabled = false;
      root.classList.add("ca-avslojad");
      buttons.forEach((b, i) => {
        b.classList.toggle("ca-ratt", i === correctIndex);
        b.classList.toggle("ca-fel", i === chosen && i !== correctIndex);
        b.querySelector(".ca-markor").textContent = i === correctIndex ? "✓" : i === chosen ? "✗" : "";
      });
      syncState();
    },
    setEnabled(on) {
      enabled = !!on;
      syncState();
    },
    chosen: () => chosen,
    destroy() {
      destroyed = true;
      grid.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      root.classList.remove("ca-root", "ca-last", "ca-har-valt", "ca-avslojad");
      root.innerHTML = "";
    },
  };
}
