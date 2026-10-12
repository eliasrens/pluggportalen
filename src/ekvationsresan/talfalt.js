// ============================================================================
// Ekvationsresan – talfältet med ständigt fokus (src/ekvationsresan/talfalt.js)
// ----------------------------------------------------------------------------
// #618, spec E1.4. Samma flyt som Mattematchen (mult/fast-answer.js): fältet
// har fokus hela tiden, ENTER skickar, auto-repeat (e.repeat) ignoreras, och
// fokus tas tillbaka direkt om det tappas – utom när vyn pausat det (resultat,
// nivå upp, översikten). Eleven skriver "-4", "+5", "/2", ":2" eller "*3";
// knapparna + − · ÷ skriver bara tecknet först i fältet, så tangentbord och mus
// går genom SAMMA text (operand.js tolkar den).
//
//   const f = mountTalfalt(form, input, { onSubmit(text), onChange(op) })
//   f.setOp("-")   knappen: byt/sätt tecknet först i fältet
//   f.op()         tecknet som står först ("+", "-", "*", "/") eller null
//   f.clear()  f.select()  f.focus()  f.pauseFocus()  f.resumeFocus()
//   f.setEnabled(bool)  f.destroy()
// ============================================================================

import { normalizeOp, OP_SYMBOL } from "./operand.js";

const NON_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);
const isTextField = (a) =>
  a.tagName === "TEXTAREA" || a.isContentEditable || (a.tagName === "INPUT" && !NON_TEXT.has(String(a.type).toLowerCase()));

/** Bara tecken som talfältet kan tolka (siffror, + − · ÷ * / : x , .). */
export function cleanInput(text) {
  return String(text).replace(/[^0-9+\-−*·×/:÷xX,.]/g, "").slice(0, 8);
}

/** Byt (eller sätt) operationstecknet först i texten. */
export function withOp(text, op) {
  const t = String(text).replace(/\s+/g, "");
  const rest = normalizeOp(t[0]) ? t.slice(1) : t;
  return `${OP_SYMBOL[op] || ""}${rest}`;
}

export function mountTalfalt(form, input, { onSubmit = () => {}, onChange = () => {} } = {}) {
  let paused = false;
  let enabled = true;
  let destroyed = false;

  const op = () => normalizeOp(input.value.trim()[0]) || null;

  function focus() {
    if (destroyed || paused || !enabled) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }

  function onSubmitEv(e) {
    e.preventDefault();
    if (!enabled || destroyed) return;
    const text = input.value.trim();
    if (!text) return focus(); // tomt fält = inget drag
    onSubmit(text);
  }
  function onKeydown(e) {
    if (e.key === "Enter" && e.repeat) e.preventDefault();
  }
  function onInput() {
    const clean = cleanInput(input.value);
    if (clean !== input.value) input.value = clean;
    onChange(op());
  }
  function onBlur() {
    if (destroyed || paused || !enabled) return;
    setTimeout(() => {
      if (destroyed || paused || !enabled) return;
      const a = document.activeElement;
      if (a && a !== input && isTextField(a)) return;
      focus();
    }, 0);
  }
  function onVisible() {
    if (document.visibilityState === "visible") focus();
  }

  form.addEventListener("submit", onSubmitEv);
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisible);
  focus();

  return {
    op,
    setOp(o) {
      input.value = withOp(input.value, o);
      onChange(op());
      focus();
      const end = input.value.length;
      try {
        input.setSelectionRange(end, end);
      } catch {}
    },
    clear() {
      input.value = "";
      onChange(null);
    },
    select() {
      focus();
      try {
        input.select();
      } catch {}
    },
    focus,
    pauseFocus() {
      paused = true;
    },
    resumeFocus() {
      paused = false;
      focus();
    },
    setEnabled(on) {
      enabled = !!on;
      input.disabled = !enabled;
      if (enabled) focus();
    },
    destroy() {
      destroyed = true;
      form.removeEventListener("submit", onSubmitEv);
      input.removeEventListener("keydown", onKeydown);
      input.removeEventListener("input", onInput);
      input.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
