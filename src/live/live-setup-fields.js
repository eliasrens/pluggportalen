// ============================================================================
// Live – formatets inställningar som GENERISKT formulär (#548, epic #546)
// ----------------------------------------------------------------------------
// Lärarens "Skapa Live-match" (teacher-live-form.js) ritar varje formats
// `setupFields` härifrån – ett nytt format behöver ingen ny formulärkod.
// Här finns också formatväljaren (steg 1) och svarssättsvalet (steg 3).
// Ren modul (ingen DOM/Firebase; importerar bara det rena formatregistret) –
// HTML som strängar, så att
// den går att testa i node (test/live-setup-fields.test.js). live-core.js
// importerar härifrån, så den här filen får INTE importera live-core.
//
// FÄLTSORTER (setupFields[i].kind) – gemensamma nycklar: key (= nyckeln i
// formulärets input till validateSetup/buildSessionFields), label, hint?,
// cls? (extra klass på .field), validate? (false = formatets validateSetup
// kontrollerar fältet själv, generiska kontrollen hoppas över), required?
//   "choice"   options [{ value, label }], default?,  → radio-chips
//              defaultByAnswerKind? { free: v, choice: v } – förvalet följer
//              svarssättet tills läraren själv valt (Snilleblixtens frågetid)
//   "number"   min?, max?, placeholder?, id?, inputCls? → heltalsfält (värdet
//              lämnas som RÅ sträng – tomt = inget värde)
//   "text"     maxlength?, placeholder?, id?          → textfält
//   "toggle"   default? bool                           → kryssruta
//   "perClass" min?, max?, defaultFor(klass) → tal     → ett tal per vald klass
//              (dolt tills en klass valts). Värde = { classId: tal }
//   "custom"   load() → Promise<{ mount(box, inner, { className }) →
//              { sync(classIds), value() } }>          → formatets egen sektion
//              (laddas latt). box = .field (sätt box.hidden själv).
//
// API
//   LIVE_DURATIONS_MIN, durationField()   matchlängden (pacing "tid") som fält
//   fieldsFor(format)                     formatets fält + matchlängden om
//                                         pacing "tid" och formatet inte själv
//                                         placerat ett "durationMin"-fält
//   setupFieldsHtml(fields)               → HTML för alla fält
//   perClassRowsHtml(field, classes, values) → raderna för ett perClass-fält
//   coerceSetupValue(field, raw)          → typat värde ur formulärets råvärde
//   defaultSetupValues(fields)            → { key: standardvärde }
//   answerKindDefaults(fields, kind)      → { key: förval } för fält med
//                                         defaultByAnswerKind
//   validateSetupFields(fields, input)    → string[] generiska fel
//   formatPickerHtml(formats, selectedId) → "" om ≤ 1 format (dold/auto-vald)
//   answerKindHtml(kinds, selected)       → "" om ≤ 1 svarssätt; förval =
//                                         selected om giltigt, annars free
//   classHint(format)                     → "klass mot klass – välj minst två"
// ============================================================================

import { defaultAnswerKind } from "./live-formats.js";

export const LIVE_DURATIONS_MIN = [5, 10, 15, 20, 25, 30];
export const ANSWER_KIND_LABELS = { free: "✍️ Skriv själv", choice: "🔘 Flerval" };

const ORDTAL = ["noll", "en", "två", "tre", "fyra", "fem", "sex", "sju", "åtta"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Matchlängden som ett vanligt choice-fält (kärnan validerar den vid pacing "tid"). */
export function durationField() {
  return {
    key: "durationMin", label: "Matchlängd", kind: "choice", cls: "", optionsCls: "live-durations",
    options: LIVE_DURATIONS_MIN.map((m) => ({ value: m, label: `${m} min` })), default: 20, validate: false,
  };
}

/** Fälten formuläret ritar för formatet (i ordning). */
export function fieldsFor(format) {
  const own = format?.setupFields || [];
  if (format?.pacing === "tid" && !own.some((f) => f.key === "durationMin")) return [durationField(), ...own];
  return own;
}

const inputId = (f) => f.id || `live-sf-${f.key}`;
const labelHtml = (f, forId) =>
  `<label${forId ? ` for="${esc(forId)}"` : ""}>${esc(f.label)}${f.hint ? ` <small class="hint">(${esc(f.hint)})</small>` : ""}</label>`;

function fieldHtml(f) {
  const cls = ["field", f.kind === "perClass" ? "live-perclass" : "", f.cls || ""].filter(Boolean).join(" ");
  const attrs = `class="${esc(cls)}" data-field="${esc(f.key)}"`;
  switch (f.kind) {
    case "choice":
      return `<div ${attrs}>${labelHtml(f)}
        <div class="${esc(f.optionsCls || "live-choices")}">${(f.options || []).map((o) => `<label class="live-chip">
          <input type="radio" name="sf-${esc(f.key)}" value="${esc(o.value)}" ${String(o.value) === String(f.default) ? "checked" : ""} /><span>${esc(o.label)}</span></label>`).join("")}</div></div>`;
    case "number":
      return `<div ${attrs}>${labelHtml(f, inputId(f))}
        <input id="${esc(inputId(f))}"${f.inputCls ? ` class="${esc(f.inputCls)}"` : ""} type="number"${f.min != null ? ` min="${f.min}"` : ""}${
          f.max != null ? ` max="${f.max}"` : ""} step="1" inputmode="numeric"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${
          f.default != null ? ` value="${esc(f.default)}"` : ""} /></div>`;
    case "text":
      return `<div ${attrs}>${labelHtml(f, inputId(f))}
        <input id="${esc(inputId(f))}"${f.inputCls ? ` class="${esc(f.inputCls)}"` : ""}${f.maxlength ? ` maxlength="${f.maxlength}"` : ""}${
          f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.default != null ? ` value="${esc(f.default)}"` : ""} /></div>`;
    case "toggle":
      return `<div ${attrs}><label class="live-toggle"><input id="${esc(inputId(f))}" type="checkbox"${f.default ? " checked" : ""} />
        <span>${esc(f.label)}</span>${f.hint ? ` <small class="hint">(${esc(f.hint)})</small>` : ""}</label></div>`;
    case "perClass":
      return `<div ${attrs} hidden>${labelHtml(f)}<div class="live-divisor-rows"></div></div>`;
    case "custom":
      return `<div ${attrs} hidden>${labelHtml(f)}<div class="live-setup-custom"></div></div>`;
    default:
      return "";
  }
}

/** HTML för formatets alla fält (okänd sort ritas inte). */
export function setupFieldsHtml(fields) {
  return (fields || []).map(fieldHtml).join("\n");
}

/**
 * Raderna i ett perClass-fält.
 * @param {object} f fältet
 * @param {{ id, name }[]} classes de valda klasserna
 * @param {object} values { classId: värde } (saknat → f.defaultFor)
 */
export function perClassRowsHtml(f, classes, values = {}) {
  return classes.map((c) => `<label class="live-divisor"><span>${esc(c.name || c.id)}</span>
        <input type="number"${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""} step="1" value="${esc(values[c.id])}" data-id="${esc(c.id)}" /></label>`).join("");
}

/** Typat värde ur formulärets råvärde (number lämnas rått – tomt = inget). */
export function coerceSetupValue(f, raw) {
  if (f.kind === "toggle") return !!raw;
  if (f.kind === "choice") {
    if (raw == null || raw === "") return undefined;
    return typeof f.options?.[0]?.value === "number" ? Number(raw) : String(raw);
  }
  if (f.kind === "text") return String(raw ?? "");
  if (f.kind === "number") return raw == null ? "" : String(raw);
  return raw;
}

/** Standardvärden (choice/toggle/number/text med default). */
export function defaultSetupValues(fields) {
  const out = {};
  for (const f of fields || []) if (f.default !== undefined) out[f.key] = f.default;
  return out;
}

/** Förval som beror på svarssättet (defaultByAnswerKind). */
export function answerKindDefaults(fields, kind) {
  const out = {};
  for (const f of fields || []) {
    const v = f.defaultByAnswerKind?.[kind];
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

/**
 * Generisk kontroll av fältens deklarerade regler (required, min/max,
 * options, maxlength). Fält med validate:false hoppas över – där
 * kontrollerar formatets validateSetup själv (Klassmatchen).
 * @returns {string[]}
 */
export function validateSetupFields(fields, input = {}) {
  const errs = [];
  for (const f of fields || []) {
    if (f.validate === false || f.kind === "custom") continue;
    const v = input?.[f.key];
    if (f.kind === "perClass") {
      for (const id of input?.classIds || []) {
        if (!intIn(v?.[id], f)) errs.push(`${f.label} för ${input?.classNames?.[id] || id} måste vara ett heltal ${range(f)}.`);
      }
      continue;
    }
    if (f.kind === "toggle") continue;
    const empty = v == null || String(v).trim() === "";
    if (empty) {
      if (f.required) errs.push(f.kind === "choice" ? `Välj ${lower(f.label)}.` : `Fyll i ${lower(f.label)}.`);
      continue;
    }
    if (f.kind === "choice" && f.options?.length && !f.options.some((o) => String(o.value) === String(v))) errs.push(`Välj ${lower(f.label)}.`);
    if (f.kind === "number" && !intIn(v, f)) errs.push(`${f.label} måste vara ett heltal ${range(f)}.`);
    if (f.kind === "text" && f.maxlength && String(v).trim().length > f.maxlength) {
      errs.push(`${f.label} får vara högst ${f.maxlength} tecken.`);
    }
  }
  return errs;
}

const lower = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);
const range = (f) => `${f.min ?? "…"}–${f.max ?? "…"}`;
function intIn(v, f) {
  if (v == null || String(v).trim() === "") return false;
  const n = Number(v);
  return Number.isInteger(n) && (f.min == null || n >= f.min) && (f.max == null || n <= f.max);
}

/** Steg 1: formatkorten. Ett enda format = inget val (auto-valt, inga platshållare). */
export function formatPickerHtml(formats, selectedId) {
  if (!formats || formats.length <= 1) return "";
  return `<div class="field live-format-field"><label>Format</label>
      <div class="live-formats">${formats.map((f) => `<label class="live-format-card">
        <input type="radio" name="format" value="${esc(f.id)}" ${f.id === selectedId ? "checked" : ""} />
        <span><span class="live-format-icon" aria-hidden="true">${esc(f.icon)}</span><b>${esc(f.displayName)}</b>${
          f.description ? `<small>${esc(f.description)}</small>` : ""}</span></label>`).join("")}</div></div>`;
}

/** Steg 3: svarssätt – bara om fler än ett gemensamt finns. */
export function answerKindHtml(kinds, selected) {
  if (!kinds || kinds.length <= 1) return "";
  const sel = kinds.includes(selected) ? selected : defaultAnswerKind(kinds);
  return `<label>Välj svarssätt</label>
      <div class="live-answerkinds">${kinds.map((k) => `<label class="live-chip">
        <input type="radio" name="answerKind" value="${esc(k)}" ${k === sel ? "checked" : ""} /><span>${esc(ANSWER_KIND_LABELS[k] || k)}</span></label>`).join("")}</div>`;
}

/** Klass-stegets ledtext ur formatets min/max och scope. */
export function classHint(format) {
  const { minClasses: min, maxClasses: max, scope } = format;
  const klass = (n) => (n === 1 ? "klass" : "klasser");
  const val = min === max ? `välj ${ORDTAL[min]} ${klass(min)}` : min <= 1 ? `välj upp till ${ORDTAL[max]}` : `välj minst ${ORDTAL[min]}`;
  return scope === "mellan-klasser" ? `klass mot klass – ${val}` : val;
}
