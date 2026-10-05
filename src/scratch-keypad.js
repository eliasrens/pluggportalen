// ============================================================================
// Pluggporten – kladdytans KNAPPSATS (scratch-keypad.js, issue #392)
// ----------------------------------------------------------------------------
// En knappsats (INTE miniräknare): 0–9, + − × ÷ =, decimalkomma och radera. Den
// SKRIVER bara tecken – den räknar ALDRIG ut något (det skulle ge eleven facit).
//
// Knappsatsen skriver där eleven SENAST tryckte: i den aktiva textlappen
// (scratch-text.js), uppställningsrutan (scratch-uppstallning.js) eller svarsrutan
// (.rakna-input). Lappar/rutor blir mål via focusin; svarsrutan BARA när eleven
// själv tryckt/skrivit i den (räkna-läget autofokuserar den, det räknas inte).
// Finns inget mål (eller har det försvunnit, t.ex. en tom lapp som städats bort)
// frågas onNoTarget() – kladdkortet lägger då en ny lapp på ytan, så knappsatsen
// skriver på rutnätet och aldrig oombedd i svaret.
// Före varje tecken skickas ett keydown till målet, så det kan styra tecknet
// självt (uppställningen: räknesätt → räknesättsrutan, ogiltigt tecken → bort).
//
// Knapptryck tar ALDRIG fokus från målet (preventDefault på pointerdown/mousedown)
// och tecknet infogas vid markören med setRangeText + ett input-event, så målets
// egna hanterare (autosize i lappen, en-siffra-per-ruta i uppställningen) körs.
// Medan panelen är öppen har målfälten inputmode="none" → mobilens skärm-
// tangentbord visas inte; det gamla värdet återställs när panelen stängs.
//
// Bara i HELSKÄRM (CSS döljer knappen i kortläget/modalen): där finns plats att
// docka panelen bredvid (desktop) eller under (mobil) ritytan utan att krympa den
// nämnvärt. I det trånga kortet skulle panelen äta ritytan – helskärm är ett tryck
// bort. Fälls kortet in stängs panelen (resize()-kroken nedan).
//
// Pad-gränssnittet ({setTool, clear, resize, destroy}) så createScratchCard kan
// lägga den i pads-listan och få förstora-växlingarna via resize().
//
// BOOT-SÄKERHET: import-fri, laddas bara via scratchpad.js som i sin tur bara nås
// dynamiskt (games-rakna.js / adventure/generator-modal.js). Får ALDRIG statiskt
// importeras av en bootfil (jfr #271/#290).
// ============================================================================

const svg = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_BACK = svg(`<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/>`);
const ICON_UPPST = svg(`<path d="M7 4h12M7 9h12M4 14h3M7 14h12"/><path d="M4 18h16"/>`);

// Knapparna i DOM-ordning; `area` = CSS grid-area (layouten per skärmbredd i games.css).
const KEYS = [
  ["7"], ["8"], ["9"], ["÷", "div", "Delat med"],
  ["4"], ["5"], ["6"], ["×", "times", "Gånger"],
  ["1"], ["2"], ["3"], ["−", "minus", "Minus"],
  [",", "comma", "Decimalkomma"], ["0"], ["back", "back", "Radera"], ["+", "plus", "Plus"],
  ["=", "eq", "Lika med"], ["uppst", "upp", "Uppställning"], ["done", "done", "Klar – stäng knappsatsen"],
].map(([key, area, label]) => ({ key, area: area || `k${key}`, label: label || key }));

const WRITABLE = ["scratch-note", "uppst-cell", "rakna-input"];
const isWritable = (t) => !!t && t.tagName === "INPUT" && WRITABLE.some((c) => t.classList.contains(c));

/**
 * @param {object} o
 * @param {HTMLElement} o.card     kladdkortet (panelen läggs sist i det)
 * @param {HTMLElement} o.button   verktygsradens Knappsats-knapp
 * @param {(open:boolean)=>void} [o.onBeforeToggle]  strax FÖRE layouten ändras (t.ex. frys ritarket)
 * @param {(open:boolean)=>void} [o.onToggle]  panelen öppnas/stängs (t.ex. lagrens inputmode)
 * @param {()=>void} [o.onUppstallning]        "Uppställning" tryckt
 * @param {()=>HTMLInputElement|null} [o.onNoTarget]  skapa ett mål (ny lapp) när inget finns
 * @param {Document} [o.document]
 */
export function attachKeypad({ card, button, onBeforeToggle, onToggle, onUppstallning, onNoTarget, document: d } = {}) {
  const doc = d || (typeof document !== "undefined" ? document : card.ownerDocument);
  let open = false;
  let last = null; // senast fokuserade skrivbara mål
  let answerForm = null;
  let answerIm = null; // svarsrutans inputmode före öppning (för återställning)

  // Fokus får aldrig lämna målet när en knapp trycks (inget blur, ingen lapp städas bort).
  const keepFocus = (e) => e.preventDefault();

  const panel = doc.createElement("div");
  panel.className = "scratch-keypad";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Knappsats");
  panel.hidden = true;
  panel.addEventListener("pointerdown", keepFocus);
  panel.addEventListener("mousedown", keepFocus);
  for (const k of KEYS) {
    const b = doc.createElement("button");
    b.type = "button";
    const kind = /^\d$/.test(k.key) ? "kp-digit" : k.key.length === 1 ? "kp-op" : "kp-act";
    b.className = `kp-btn ${kind} kp-${k.area}`;
    b.dataset.key = k.key;
    b.setAttribute("aria-label", k.label);
    b.title = k.label;
    if (k.key === "back") b.innerHTML = ICON_BACK;
    else if (k.key === "uppst") b.innerHTML = `${ICON_UPPST}<span>Uppställning</span>`;
    else b.textContent = k.key === "done" ? "Klar" : k.key;
    b.addEventListener("click", () => press(k.key));
    panel.appendChild(b);
  }
  card.appendChild(panel);

  const answerInput = () => (answerForm ? answerForm.querySelector(".rakna-input") : null);
  const inScope = (t) => card.contains(t) || (!!answerForm && answerForm.contains(t));
  const usable = (t) => isWritable(t) && inScope(t) && !t.readOnly && !t.disabled;

  /** Målet för nästa tecken: senast valda lapp/ruta/svarsruta (eller null). */
  const target = () => (usable(last) ? last : null);

  // Lappar och rutor blir mål när de får fokus; svarsrutan bara på elevens eget
  // tryck/tangent (onAnswerUse), inte när räkna-läget autofokuserar den.
  function onFocusIn(e) {
    if (isWritable(e.target) && !e.target.classList.contains("rakna-input")) last = e.target;
  }
  function onAnswerUse(e) {
    if (isWritable(e.target) && e.target.classList.contains("rakna-input")) last = e.target;
  }

  function fire(t, type, init) {
    const C = type === "keydown" && typeof KeyboardEvent === "function" ? KeyboardEvent : Event;
    const ev = new C(type, { bubbles: true, cancelable: true, ...init });
    if (init && init.key && ev.key === undefined) Object.defineProperty(ev, "key", { value: init.key });
    t.dispatchEvent(ev);
    return ev;
  }

  function replaceRange(t, str, s, e) {
    if (typeof t.setRangeText === "function") t.setRangeText(str, s, e, "end");
    else {
      t.value = t.value.slice(0, s) + str + t.value.slice(e);
      t.selectionStart = t.selectionEnd = s + str.length;
    }
    fire(t, "input"); // målets egna hanterare (autosize, en siffra per ruta) körs
  }

  function press(key) {
    if (key === "done") { setOpen(false); return; }
    if (key === "uppst") { if (onUppstallning) onUppstallning(); return; }
    let t = target();
    if (!t && key !== "back" && onNoTarget) t = onNoTarget(); // t.ex. ny lapp på ytan
    if (!t) return;
    if (doc.activeElement !== t) {
      try { t.focus({ preventScroll: true }); } catch { t.focus(); }
    }
    const v = String(t.value || "");
    const s = typeof t.selectionStart === "number" ? t.selectionStart : v.length;
    const e = typeof t.selectionEnd === "number" ? t.selectionEnd : s;
    if (key === "back") {
      // Låt målet själv hantera backsteg först (uppställningen: tom ruta → bakåt).
      if (fire(t, "keydown", { key: "Backspace" }).defaultPrevented) return;
      if (s !== e) replaceRange(t, "", s, e);
      else if (s > 0) replaceRange(t, "", s - 1, s);
      return;
    }
    // Svarsrutan rättas som tal → vanligt bindestreck (Number("−5") är NaN).
    const ch = key === "−" && t.classList.contains("rakna-input") ? "-" : key;
    if (fire(t, "keydown", { key: ch }).defaultPrevented) return; // målet tog hand om det
    replaceRange(t, ch, s, e);
  }

  // Svarsrutans skärmtangentbord av (on) resp. tillbaka till det ursprungliga.
  function answerKeyboardOff(on) {
    const a = answerInput();
    if (!a) return;
    if (on) {
      if (answerIm === null) answerIm = a.getAttribute("inputmode") || "";
      a.setAttribute("inputmode", "none");
    } else if (answerIm !== null) {
      if (answerIm) a.setAttribute("inputmode", answerIm);
      else a.removeAttribute("inputmode");
      answerIm = null;
    }
  }

  const isFull = () => card.classList.contains("scratch-fs");

  function setOpen(v) {
    const want = !!v && isFull();
    if (want === open) return;
    if (onBeforeToggle) onBeforeToggle(want); // innan panelen tar plats i griden
    open = want;
    panel.hidden = !open;
    card.classList.toggle("kp-open", open);
    button.classList.toggle("is-active", open);
    button.setAttribute("aria-pressed", open ? "true" : "false");
    answerKeyboardOff(open);
    if (onToggle) onToggle(open);
  }

  const toggle = () => setOpen(!open);
  button.addEventListener("pointerdown", keepFocus);
  button.addEventListener("mousedown", keepFocus);
  button.addEventListener("click", toggle);
  card.addEventListener("focusin", onFocusIn);

  return {
    panel,
    isOpen: () => open,
    setOpen,
    press,
    target,
    /** Registrera svarsformuläret (ligger utanför kortet i kortläget). */
    setAnswer(form) {
      if (answerForm === form) return;
      if (answerForm) {
        answerKeyboardOff(false); // den gamla rutan får tillbaka sitt tangentbord
        answerForm.removeEventListener("pointerdown", onAnswerUse);
        answerForm.removeEventListener("keydown", onAnswerUse);
      }
      answerForm = form || null;
      if (answerForm) {
        answerForm.addEventListener("pointerdown", onAnswerUse);
        answerForm.addEventListener("keydown", onAnswerUse);
        if (open) answerKeyboardOff(true);
      }
    },
    setTool() {},
    clear() {},
    // Förstora/förminska kör pads resize(): fälls kortet in stängs panelen.
    resize() { if (open && !isFull()) setOpen(false); },
    destroy() {
      setOpen(false);
      button.removeEventListener("pointerdown", keepFocus);
      button.removeEventListener("mousedown", keepFocus);
      button.removeEventListener("click", toggle);
      card.removeEventListener("focusin", onFocusIn);
      if (answerForm) {
        answerForm.removeEventListener("pointerdown", onAnswerUse);
        answerForm.removeEventListener("keydown", onAnswerUse);
      }
    },
  };
}
