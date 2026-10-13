// ============================================================================
// Pluggporten – lärarsidan: Ämnesläsning, förhandsgranskning och textkort
// (teacher-amnes-preview.js, issue #673)
// ----------------------------------------------------------------------------
// Delas av panelen "Skapa ämnestexter" (teacher-amnes-create.js) och listan i
// underradens Ämnesläsning-flik (teacher-amnes-texts.js):
//   • openReaderPreview(text) – texten SOM ELEVEN SER DEN: Läsresans egen läsvy
//     (renderReader) i en modal. Inget sparas; efter sista frågan visas hur
//     många som blev rätt, med "Läs igen".
//   • textMetaHtml(text) – kort rad: ord · frågor · fakta/berättelse · kategorier.
// Laddas BARA via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import { renderReader } from "./lasresan/ui-reader.js";
import { countCorrect } from "./lasresan/reader-logic.js";
import { CATEGORY_LABELS } from "./lasresan/config.js";
import { wordCount } from "./amneslasning/content.js";
import { el, esc } from "./teacher-shared.js";

/** Ladda lasresan.css en gång (samma fil som Läsresan, utanför styles.css). */
function ensureReaderStyles() {
  if (document.querySelector("link[data-lasresan-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./lasresan/lasresan.css", import.meta.url).href;
  link.dataset.lasresanCss = "1";
  const ready = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return ready;
}

const TYPE_LABEL = { fact: "faktatext", story: "berättelse" };

/** "84 ord · 4 frågor · faktatext · Fakta 2, Mellan raderna 2". */
export function textMetaHtml(text) {
  const qs = Array.isArray(text?.questions) ? text.questions : [];
  const cats = {};
  for (const q of qs) if (q?.category) cats[q.category] = (cats[q.category] || 0) + 1;
  const catTxt = Object.entries(cats)
    .map(([k, n]) => `${CATEGORY_LABELS[k] || k} ${n}`)
    .join(", ");
  return [
    `${wordCount(text?.body)} ord`,
    `${qs.length} fråg${qs.length === 1 ? "a" : "or"}`,
    TYPE_LABEL[text?.textType] || text?.textType || "",
    catTxt,
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ");
}

/**
 * Öppna förhandsgranskningen i Läsresans läsvy. Stängs med ×, Esc eller klick
 * utanför. Fokus återgår till `returnFocus`.
 * @param {object} text – ämnestexten (Läsresans format, nivå 1–3).
 * @param {{returnFocus?:HTMLElement}} [opts]
 */
export async function openReaderPreview(text, { returnFocus } = {}) {
  await ensureReaderStyles();
  const overlay = el(`<div class="amn-preview-overlay" role="dialog" aria-modal="true"
      aria-label="Förhandsgranska ${esc(text.title)}">
    <div class="amn-preview-box">
      <header class="amn-preview-head">
        <span class="amn-preview-tag">👁 Förhandsgranskning · nivå ${esc(text.level)} · så här ser eleven texten</span>
        <button type="button" class="amn-preview-close" aria-label="Stäng förhandsgranskningen"><span aria-hidden="true">×</span></button>
      </header>
      <div class="lasresan amn-preview-reader"></div>
      <div class="amn-preview-done" hidden></div>
    </div>
  </div>`);
  const host = overlay.querySelector(".amn-preview-reader");
  const doneBox = overlay.querySelector(".amn-preview-done");
  let reader = null;

  const start = () => {
    reader?.destroy();
    doneBox.hidden = true;
    reader = renderReader(host, {
      text,
      onDone: ({ answers }) => {
        const n = text.questions.length;
        doneBox.innerHTML = `<span>✓ Klar: <b>${countCorrect(text, answers)} av ${n}</b> rätt. Inget sparas – det här var bara en förhandsgranskning.</span>
          <button type="button" class="btn small amn-preview-again">Läs igen</button>`;
        doneBox.hidden = false;
        doneBox.querySelector(".amn-preview-again").addEventListener("click", start);
      },
    });
  };

  const close = () => {
    reader?.destroy();
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    returnFocus?.focus?.({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".amn-preview-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  start();
  overlay.querySelector(".amn-preview-close").focus();
  return { close };
}
