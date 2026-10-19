// ============================================================================
// Pluggporten – lärarsidan: bekräftelseruta på sidan (teacher-bekrafta.js)
// ----------------------------------------------------------------------------
// #805 (epic #802 §3.4/3.5): destruktiva val (Ta ur klassen, Ta bort konto, Ta
// bort klass) bekräftas i en ruta på sidan, aldrig med confirm(). Delas av
// elevtabellen (teacher-elever-atgarder.js) och Admin-sidan (teacher-admin.js).
// Laddas bara med import() via dem (#271).
// ============================================================================

import { el, errText, esc } from "./teacher-shared.js";

/**
 * Rita rutan i `host` (ersätter innehållet). onJa(ruta) ska kasta vid fel –
 * felet visas då i rutan och knapparna går att trycka igen. onAvbryt() stänger.
 * farlig = röd knapp (destruktivt); annars grön (t.ex. Ge hela klassen mynt).
 */
export function bekrafta(host, { text, knapp, farlig = true, onJa, onAvbryt }) {
  const ruta = el(`<div class="et-bekrafta${farlig ? " farlig" : ""}" role="alertdialog" aria-label="${esc(knapp)}">
    <p class="et-bekrafta-text">${text}</p>
    <div class="row-inline">
      <button type="button" class="btn small ${farlig ? "danger" : "gron"} et-ja">${esc(knapp)}</button>
      <button type="button" class="btn ghost small et-avbryt">Avbryt</button>
      <span class="et-bekrafta-msg" aria-live="polite"></span>
    </div>
  </div>`);
  const ja = ruta.querySelector(".et-ja");
  const msg = ruta.querySelector(".et-bekrafta-msg");
  ja.addEventListener("click", async () => {
    ja.disabled = true;
    msg.innerHTML = `<span class="hint">Vänta…</span>`;
    try {
      await onJa(ruta);
    } catch (err) {
      msg.innerHTML = `<span class="gc-err">${esc(errText(err))}</span>`;
      ja.disabled = false;
    }
  });
  ruta.querySelector(".et-avbryt").addEventListener("click", () => onAvbryt());
  host.replaceChildren(ruta);
  host.hidden = false;
  ja.focus();
  return ruta;
}
