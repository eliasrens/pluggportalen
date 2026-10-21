// ============================================================================
// Klassmatchen – lärarformulärets trollkarlsval (#536, flyttat hit i #548).
// Laddas LATT som Klassmatchens custom-fält "wizards" (setupFields). Exakt två
// klasser → varje klass väljer sin trollkarl ur registret (TROLLKARLAR, #818);
// väljer man den andra klassens trollkarl byter de (aldrig samma på båda).
// ⇄ Byt vänder på valet. Sparas i sessionen, kan ändras i lobbyn. Annars dold.
//
// API: mount(box, inner, { className }) → { sync(classIds), value() }
// ============================================================================

import { el, esc } from "../../../teacher-shared.js";
import { chooseWizard, defaultWizards, swapWizards, validWizards, TROLLKARLAR } from "../../trollkarl/trollkarl-val.js";

export function mount(box, inner, { className }) {
  let wizards = null;
  let ids = [];
  function sync(classIds) {
    ids = classIds;
    box.hidden = ids.length !== 2;
    if (ids.length !== 2) return;
    if (!validWizards(wizards, ids)) wizards = defaultWizards(ids);
    inner.replaceChildren(el(`<div class="live-wizard-row">${ids.map((id) =>
      `<label class="live-chip"><span>${esc(className(id))}:</span>
        <select data-wiz="${esc(id)}" aria-label="Trollkarl för ${esc(className(id))}">${TROLLKARLAR.map((t) =>
          `<option value="${t.id}"${wizards[id] === t.id ? " selected" : ""}>${esc(t.namn)}</option>`).join("")}</select></label>`).join("")}
      <button type="button" class="btn" data-swap>⇄ Byt</button></div>`));
    inner.querySelectorAll("[data-wiz]").forEach((sel) => sel.addEventListener("change", () => {
      wizards = chooseWizard(wizards, sel.dataset.wiz, sel.value);
      sync(ids);
    }));
    inner.querySelector("[data-swap]").addEventListener("click", () => {
      wizards = swapWizards(wizards);
      sync(ids);
    });
  }
  return { sync, value: () => (ids.length === 2 ? wizards : undefined) };
}
