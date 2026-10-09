// ============================================================================
// Klassmatchen – lärarformulärets trollkarlsval (#536, flyttat hit i #548).
// Laddas LATT som Klassmatchens custom-fält "wizards" (setupFields). Exakt två
// klasser → vem är Rasmus/Elias (byt-knapp, aldrig samma på båda; sparas i
// sessionen, kan bytas i lobbyn). Annars dold.
//
// API: mount(box, inner, { className }) → { sync(classIds), value() }
// ============================================================================

import { el, esc } from "../../../teacher-shared.js";
import { defaultWizards, swapWizards, validWizards, WIZARD_NAMES } from "../../trollkarl/trollkarl-val.js";

export function mount(box, inner, { className }) {
  let wizards = null;
  let ids = [];
  function sync(classIds) {
    ids = classIds;
    box.hidden = ids.length !== 2;
    if (ids.length !== 2) return;
    if (!validWizards(wizards, ids)) wizards = defaultWizards(ids);
    inner.replaceChildren(el(`<div class="live-wizard-row">${ids.map((id) =>
      `<span class="live-chip"><span>${esc(className(id))}: <b>${WIZARD_NAMES[wizards[id]]}</b></span></span>`).join("")}
      <button type="button" class="btn" data-swap>⇄ Byt</button></div>`));
    inner.querySelector("[data-swap]").addEventListener("click", () => {
      wizards = swapWizards(wizards);
      sync(ids);
    });
  }
  return { sync, value: () => (ids.length === 2 ? wizards : undefined) };
}
