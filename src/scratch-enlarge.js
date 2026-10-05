// ============================================================================
// Pluggporten – kladdytans FÖRSTORA-logik (scratch-enlarge.js, issue #312)
// ----------------------------------------------------------------------------
// Bruten ur scratchpad.js så den kan enhetstestas fristående: den här filen har
// INGA importer (bara ren DOM-manipulation) och kan därför köras direkt av
// node --test mot en liten fejk-DOM, utan att dra in ui.js/firebase-kedjan.
//
// wireEnlarge kopplar 📈 Förstora/Förminska-knappen: fäller ut kladdkortet till
// fullskärm (.scratch-fs) och in igen. NYTT i #312: svarsrutan (fråga syns i
// kortets rubrik, svarsfält + feedback + nästa-knapp) flyttas IN i det utfällda
// kortet som en egen rad längst ner (in-flow, inte flytande overlay → överlappar
// aldrig tal/verktyg, jfr #296-lärdomen) och tillbaka igen. Läget kan sättas
// programmatiskt med setFull() så räkna-läget kan BEHÅLLA förstorat mellan
// uppgifter, och svarsrutan registreras i efterhand med setAnswer() (den skapas
// ofta efter kortet).
//
// BOOT-SÄKERHET: laddas bara via scratchpad.js, som i sin tur bara nås dynamiskt
// (games-rakna.js / adventure/generator-modal.js). Får ALDRIG statiskt importeras
// av en bootfil (jfr #271/#290). Inga egna beroenden uppåt.
// ============================================================================

/**
 * Koppla FÖRSTORA-knappen: fäller ut `target` (kladdkortet) till fullskärm och in
 * igen. I fullskärm är kortet position:fixed över hela ytan (CSS .scratch-fs), så
 * verktygsknapparna som ligger INUTI kortet följer med och går att nå. Ritbufferten
 * skalas om (bevarad ritning) efter varje toggle.
 * @param {object} o
 * @param {HTMLElement} o.button   knappen (📈 Förstora/Förminska)
 * @param {HTMLElement} o.target   elementet som blir fullskärm (kladdkortet)
 * @param {{resize:()=>void}} o.pad  scratchpad-styrenheten (för resize)
 * @param {boolean} [o.handleEscape=true]  lyssna på Escape för att fälla in (av i
 *   modalen, där modalen själv äger Escape).
 * @param {HTMLElement} [o.answer]  svarsrutan (fråga + svarsfält) som INTE får döljas
 *   av den utfällda kladdytan (#312) – flyttas in i kortet i fullskärm. Kan även
 *   registreras i efterhand med setAnswer() (den skapas ofta efter kortet).
 * @returns {{isFull:()=>boolean, setFull:(v:boolean)=>void, setAnswer:(el:HTMLElement)=>void, exit:()=>void, destroy:()=>void}}
 */
// Ikoner för knappen (#392): linje-SVG (currentColor) – "fäll ut"-hörn resp.
// "fäll in"-hörn, samma stil som övriga verktyg i scratchpad.js. Etiketten ligger i
// .tool-label så den kan döljas på smala skärmar (aria-label bär namnet då).
const ICON_EXPAND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
const ICON_COLLAPSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

export function wireEnlarge({ button, target, pad, handleEscape = true, answer = null }) {
  let full = false;
  let answerEl = null;
  let answerHome = null; // { parent, next } – ursprungsplatsen så vi kan flytta tillbaka

  // Var svarsrutan bor i vanligt läge, för att kunna sätta tillbaka den efter fullskärm.
  function captureHome(elm) {
    return elm && elm.parentNode ? { parent: elm.parentNode, next: elm.nextSibling } : null;
  }
  // Flytta svarsrutan IN i det utfällda kortet (in-flow längst ner) resp. tillbaka.
  // In-flow – inte flytande overlay – så den aldrig överlappar tal/verktyg (#296-lärdom).
  function placeAnswer() {
    if (!answerEl) return;
    answerEl.classList.toggle("scratch-fs-answer", full);
    if (full) {
      if (answerEl.parentNode !== target) target.appendChild(answerEl);
    } else if (answerHome && answerHome.parent && answerEl.parentNode === target) {
      answerHome.parent.insertBefore(answerEl, answerHome.next);
    }
  }

  function renderButton() {
    const label = full ? "Förminska" : "Förstora";
    button.setAttribute("aria-pressed", full ? "true" : "false");
    button.setAttribute("aria-label", label);
    button.innerHTML = `${full ? ICON_COLLAPSE : ICON_EXPAND}<span class="tool-label">${label}</span>`;
    button.title = full ? "Fäll in kladdytan" : "Förstora kladdytan";
  }

  function apply() {
    target.classList.toggle("scratch-fs", full);
    document.body.classList.toggle("scratch-fs-lock", full);
    // Svarsrutan (fråga syns i kortets rubrik) får ALDRIG döljas av den utfällda
    // kladdytan (#312): i fullskärm flyttas den in i kortet som en egen rad längst ner.
    placeAnswer();
    renderButton();
    // Låt layouten sätta sig innan bufferten skalas om (behåller ritningen).
    if (pad && pad.resize) pad.resize();
  }
  function toggle() { full = !full; apply(); }
  function onKey(e) {
    if (e.key === "Escape" && full) {
      full = false;
      apply();
      e.preventDefault();
      e.stopImmediatePropagation(); // konsumera Escape så inget annat stänger
    }
  }

  renderButton();
  button.addEventListener("click", toggle);
  if (handleEscape) document.addEventListener("keydown", onKey, true);

  if (answer) { answerEl = answer; answerHome = captureHome(answer); placeAnswer(); }

  return {
    isFull: () => full,
    /** Sätt fullskärmsläget programmatiskt (t.ex. behåll förstorat mellan uppgifter #312). */
    setFull(v) { if (full !== !!v) { full = !!v; apply(); } },
    /** Registrera svarsrutan i efterhand (skapas ofta efter kortet); synkas mot nuläget. */
    setAnswer(elm) {
      if (answerEl && answerEl !== elm) answerEl.classList.remove("scratch-fs-answer");
      answerEl = elm || null;
      answerHome = captureHome(answerEl);
      placeAnswer();
    },
    exit() { if (full) { full = false; apply(); } },
    destroy() {
      button.removeEventListener("click", toggle);
      if (handleEscape) document.removeEventListener("keydown", onKey, true);
      document.body.classList.remove("scratch-fs-lock");
      // Lämna svarsrutan där den hörde hemma om vi rivs mitt i fullskärm.
      if (answerEl) {
        answerEl.classList.remove("scratch-fs-answer");
        if (answerHome && answerHome.parent && answerEl.parentNode === target) {
          answerHome.parent.insertBefore(answerEl, answerHome.next);
        }
      }
    },
  };
}
