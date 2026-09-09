// ============================================================================
// Pluggportalen – lärarsidan: "Nytt ämne"-formuläret (teacher-subject-form.js)
// ----------------------------------------------------------------------------
// Det utfällbara formuläret bakom "➕ Nytt ämne" på #/larare/innehall: fyll i
// id/namn/ikon/beskrivning och skapa ett nytt ämne (subjects/{id}). Utbrutet ur
// teacher-content.js för att hålla den filen under radtaket (samma mönster som
// merge-/granska-/läsförståelse-modulerna).
// ============================================================================

import * as data from "./data.js";
import { slugify } from "./validate.js";
import { el, esc } from "./teacher-shared.js";

/**
 * Koppla "Nytt ämne"-knappen till sitt formulär.
 * @param {{
 *   toggleBtn: HTMLElement,   // knappen som visar/döljer formuläret
 *   formEl: HTMLElement,      // behållaren formuläret ritas i
 *   subjects: Array,          // ämneslistan (muteras med det nya ämnet)
 *   onCreated: (id: string) => void  // körs efter lyckad skapning (välj + ladda om)
 * }} deps
 */
export function wireNewSubjectForm({ toggleBtn, formEl, subjects, onCreated }) {
  toggleBtn.addEventListener("click", () => {
    if (formEl.firstChild) {
      formEl.innerHTML = "";
      return;
    }
    const f = el(`<div class="subpanel">
      <div class="grid-2">
        <div class="field"><label>Id (kort, t.ex. "ma")</label><input id="ns-id" placeholder="ma" /></div>
        <div class="field"><label>Namn</label><input id="ns-name" placeholder="Matematik" /></div>
        <div class="field"><label>Ikon (emoji)</label><input id="ns-icon" placeholder="➗" /></div>
        <div class="field"><label>Beskrivning</label><input id="ns-desc" placeholder="Kort beskrivning" /></div>
      </div>
      <div id="ns-msg"></div>
      <button class="btn gron" id="ns-save">Skapa ämne</button>
    </div>`);
    f.querySelector("#ns-name").addEventListener("input", (e) => {
      const idInput = f.querySelector("#ns-id");
      if (!idInput.dataset.touched) idInput.value = slugify(e.target.value);
    });
    f.querySelector("#ns-id").addEventListener("input", (e) => {
      e.target.dataset.touched = "1";
    });
    f.querySelector("#ns-save").addEventListener("click", async () => {
      const id = slugify(f.querySelector("#ns-id").value || f.querySelector("#ns-name").value);
      const name = f.querySelector("#ns-name").value.trim();
      const msg = f.querySelector("#ns-msg");
      if (!id || !name) {
        msg.innerHTML = `<div class="msg error">Fyll i både id och namn.</div>`;
        return;
      }
      if (subjects.some((s) => s.id === id)) {
        msg.innerHTML = `<div class="msg error">Det finns redan ett ämne med id "${esc(id)}".</div>`;
        return;
      }
      try {
        const order = subjects.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0) + 1;
        await data.upsertSubject(id, {
          name,
          order,
          icon: f.querySelector("#ns-icon").value.trim() || "📘",
          description: f.querySelector("#ns-desc").value.trim() || "",
        });
        subjects.push({ id, name, order });
        formEl.innerHTML = "";
        onCreated(id);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">Kunde inte spara: ${esc(err.message)}</div>`;
      }
    });
    formEl.replaceChildren(f);
  });
}
