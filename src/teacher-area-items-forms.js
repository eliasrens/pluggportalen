// ============================================================================
// Pluggporten – lärarsidan: inline-formulär för EN quizfråga / ett par / en text
// (teacher-area-items-forms.js, issue #454)
// ----------------------------------------------------------------------------
// Formulären som öppnas i Innehållsstudions utfällda underrad (teacher-area-
// items.js) när läraren redigerar eller lägger till en post. Rena byggare: de
// samlar fälten och anropar onSubmit(fields) → { ok, errors }; sparningen (färsk
// kopia + validateArea + saveArea) sköts av underraden. Fel visas inline under
// formuläret. Laddas BARA via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import { listPairImageKeys } from "./pair-images.js";
import { el, esc, icon } from "./teacher-shared.js";

let uid = 0;
const nextUid = () => `ai-f${++uid}`;

/** Ett etiketterat fält (input eller textarea). */
function field(label, name, value, { textarea = false, rows = 3, required = false, hint = "" } = {}) {
  const id = nextUid();
  const ctl = textarea
    ? `<textarea id="${id}" name="${name}" rows="${rows}"${required ? " required" : ""}>${esc(value)}</textarea>`
    : `<input id="${id}" name="${name}" type="text" autocomplete="off" value="${esc(value)}"${required ? " required" : ""} />`;
  return `<div class="ai-field ai-field-${name}">
    <label for="${id}">${esc(label)}${required ? ' <span class="ai-req" aria-hidden="true">*</span>' : ""}</label>
    ${ctl}${hint ? `<span class="ai-hint">${hint}</span>` : ""}
  </div>`;
}

/** Bildväljare för ett par (pair-images.js), "Ingen bild" först. */
function imageSelect(label, name, value) {
  const id = nextUid();
  const keys = listPairImageKeys();
  const known = keys.some((k) => k.key === value);
  const opts = [`<option value="">Ingen bild</option>`]
    .concat(value && !known ? [`<option value="${esc(value)}" selected>${esc(value)} (okänd)</option>`] : [])
    .concat(keys.map((k) => `<option value="${esc(k.key)}"${k.key === value ? " selected" : ""}>${esc(k.name)} (${esc(k.key)})</option>`))
    .join("");
  return `<div class="ai-field ai-field-${name}">
    <label for="${id}">${esc(label)}</label>
    <select id="${id}" name="${name}" class="select">${opts}</select>
  </div>`;
}

/**
 * Gemensamt skal: fält + Spara/Avbryt + felruta. submit-handlern kör collect()
 * och onSubmit; vid fel visas listan inline och formuläret står kvar.
 */
function shell(title, bodyHtml, { collect, precheck, onSubmit, onCancel }) {
  const f = el(`<form class="ai-form" novalidate>
    <div class="ai-form-title">${esc(title)}</div>
    <div class="ai-form-grid">${bodyHtml}</div>
    <div class="ai-form-errors" role="alert" aria-live="polite"></div>
    <div class="ai-form-actions">
      <button type="submit" class="btn gron small ai-save">${icon("save", 15)}<span>Spara</span></button>
      <button type="button" class="btn ghost small ai-cancel">Avbryt</button>
    </div>
  </form>`);
  const errBox = f.querySelector(".ai-form-errors");
  const saveBtn = f.querySelector(".ai-save");
  const showErrors = (errors) => {
    errBox.innerHTML = errors.length
      ? `<div class="msg error"><div>Kunde inte spara. Rätta det här:</div>
          <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`
      : "";
  };
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = collect(f);
    const pre = precheck ? precheck(fields) : [];
    if (pre.length) return showErrors(pre);
    showErrors([]);
    saveBtn.disabled = true;
    const old = saveBtn.innerHTML;
    saveBtn.textContent = "Sparar…";
    try {
      const res = await onSubmit(fields);
      if (!res?.ok) showErrors(res?.errors || ["Okänt fel."]);
    } finally {
      if (f.isConnected) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = old;
      }
    }
  });
  f.querySelector(".ai-cancel").addEventListener("click", onCancel);
  f.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  });
  // Fokusera första fältet när formuläret satts in i DOM:en.
  queueMicrotask(() => f.querySelector("input, textarea, select")?.focus());
  return f;
}

const val = (f, name) => f.elements[name]?.value ?? "";

/**
 * Quizfråga: fråga, (minst) 4 alternativ med radioknapp för rätt svar,
 * förklaring och – när området har läsförståelse – källtext (passage).
 * @param {object|null} item  befintlig fråga, eller null för ny.
 * @param {{ passageMode:boolean, passageRequired:boolean, onSubmit, onCancel }} o
 */
export function buildQuizForm(item, { passageMode, passageRequired, onSubmit, onCancel }) {
  const options = Array.isArray(item?.options) ? item.options.map(String) : [];
  while (options.length < 4) options.push("");
  const ai = Number.isInteger(item?.answerIndex) ? item.answerIndex : 0;
  const group = nextUid();
  const optRows = options
    .map((o, i) => `<div class="ai-opt">
        <input type="radio" name="answer" value="${i}" id="${group}-${i}"${i === ai ? " checked" : ""}
          aria-label="Alternativ ${i + 1} är rätt svar" />
        <label for="${group}-${i}" class="ai-opt-nr">${i + 1}</label>
        <input type="text" name="opt${i}" autocomplete="off" value="${esc(o)}"
          aria-label="Svarsalternativ ${i + 1}" placeholder="Alternativ ${i + 1}" />
      </div>`)
    .join("");
  const body = `
    ${passageMode ? field("Källtext (läsförståelse)", "passage", item?.passage || "", {
      textarea: true, rows: 4, required: passageRequired,
      hint: passageRequired ? "" : "Lämna tom för en vanlig quizfråga.",
    }) : ""}
    ${field("Fråga", "question", item?.question || "", { textarea: true, rows: 2, required: true })}
    <fieldset class="ai-field ai-opts">
      <legend>Svarsalternativ <span class="ai-hint">– markera rätt svar</span></legend>
      ${optRows}
    </fieldset>
    ${field("Förklaring (valfri)", "explanation", item?.explanation || "", { textarea: true, rows: 2 })}`;
  return shell(item ? "Redigera fråga" : "Ny fråga", body, {
    collect: (f) => ({
      question: val(f, "question"),
      options: options.map((_, i) => val(f, `opt${i}`)),
      answerIndex: Number(f.querySelector('input[name="answer"]:checked')?.value ?? -1),
      explanation: val(f, "explanation"),
      passage: passageMode ? val(f, "passage") : item?.passage || "",
    }),
    precheck: (x) => {
      const errs = [];
      if (passageRequired && !x.passage.trim())
        errs.push("Källtexten saknas – läsförståelse-frågor behöver en text att läsa.");
      if (!String(x.options[x.answerIndex] ?? "").trim())
        errs.push("Det markerade rätta svaret är tomt – skriv in det eller markera ett annat alternativ.");
      return errs;
    },
    onSubmit,
    onCancel,
  });
}

/** Par: begrepp ↔ förklaring, valfri grupp och bild på vardera sidan. */
export function buildPairForm(item, { onSubmit, onCancel }) {
  const body = `
    <div class="ai-form-2col">
      ${field("Begrepp", "term", item?.term || "", { hint: "Får vara tomt om du väljer en bild." })}
      ${field("Förklaring", "definition", item?.definition || "", { textarea: true, rows: 2 })}
      ${imageSelect("Bild på begreppet (valfri)", "termImage", item?.termImage || "")}
      ${imageSelect("Bild på förklaringen (valfri)", "defImage", item?.defImage || "")}
    </div>
    ${field("Grupp (valfri)", "group", item?.group || "", {
      hint: "Par med samma grupp visas aldrig i samma spelomgång.",
    })}`;
  return shell(item ? "Redigera par" : "Nytt par", body, {
    collect: (f) => ({
      term: val(f, "term"),
      definition: val(f, "definition"),
      termImage: val(f, "termImage"),
      defImage: val(f, "defImage"),
      group: val(f, "group"),
    }),
    onSubmit,
    onCancel,
  });
}

/** Lästext: rubrik + brödtext. */
export function buildTextForm(item, { onSubmit, onCancel }) {
  const body = `
    ${field("Rubrik", "title", item?.title || "", { required: true })}
    ${field("Brödtext", "body", item?.body || item?.passage || "", { textarea: true, rows: 6, required: true })}`;
  return shell(item ? "Redigera text" : "Ny text", body, {
    collect: (f) => ({ title: val(f, "title"), body: val(f, "body") }),
    onSubmit,
    onCancel,
  });
}
