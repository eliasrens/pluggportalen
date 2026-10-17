// ============================================================================
// Prov (#746, spec §11): redigerarens val "Pluggmynt" – Inga mynt (standard),
// fast summa för inlämnat prov eller mynt per poäng (bara när provet
// poängsätts). Ritas i inställningarna av provl-redigera.js; valet
// valideras när provet sparas (prov-mynt.js valideraMynt via validateProv).
//
//   const f = myntFalt({ mynt, poang, onAndra })   onAndra({ typ, antal? })
//   f.el                 fieldset att lägga in
//   f.sattPoang(pa)      poängsättningen slogs av/på (av → "per poäng" går inte;
//                        på igen → "per poäng" tillbaka om läraren inte valt annat, #749 F3)
// ============================================================================

import { el } from "../../teacher-shared.js";
import { MYNT_FAST_MAX, MYNT_PER_POANG_MAX, MYNT_TAK, tolkaMynt } from "../prov-mynt.js";

const FORVAL = { fast: 20, poang: 2 };

export function myntFalt({ mynt, poang, onAndra }) {
  const m = tolkaMynt(mynt);
  const antal = { ...FORVAL, ...(m.antal ? { [m.typ]: m.antal } : {}) };
  const vy = el(`<fieldset class="provl-grupp provl-mynt"><legend>Pluggmynt</legend>
    <label class="provl-check"><input type="radio" name="provl-mynt" value="inga" /><span><b>Inga mynt</b></span></label>
    <label class="provl-check"><input type="radio" name="provl-mynt" value="fast" /><span><b>Fast summa</b> för inlämnat prov:
      <input type="number" class="provl-mynt-antal" data-typ="fast" min="1" max="${MYNT_FAST_MAX}" step="1" aria-label="Mynt för inlämnat prov" /> mynt</span></label>
    <label class="provl-check"><input type="radio" name="provl-mynt" value="poang" /><span><b>Mynt per poäng:</b>
      <input type="number" class="provl-mynt-antal" data-typ="poang" min="1" max="${MYNT_PER_POANG_MAX}" step="1" aria-label="Mynt per poäng" /> mynt
      <span class="hint provl-mynt-krav">– kräver att frågorna poängsätts</span></span></label>
    <p class="hint">Mynten betalas ut när du lämnar tillbaka provet, högst ${MYNT_TAK} per elev. Ångrar du en tillbakalämning behåller eleven mynten, och lämnar du tillbaka igen betalas bara skillnaden ut om summan har ökat.</p>
  </fieldset>`);
  const radio = (typ) => vy.querySelector(`input[type="radio"][value="${typ}"]`);
  const falt = (typ) => vy.querySelector(`.provl-mynt-antal[data-typ="${typ}"]`);
  let typ = m.typ;
  // "Per poäng" byttes mot "Inga mynt" bara för att poängsättningen slogs av.
  let poangVilar = false;
  radio(typ).checked = true;
  for (const t of ["fast", "poang"]) falt(t).value = String(antal[t]);

  const skicka = () => onAndra(typ === "inga" ? { typ } : { typ, antal: falt(typ).value });
  vy.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener("change", () => {
    if (!r.checked) return;
    typ = r.value;
    poangVilar = false;
    skicka();
  }));
  for (const t of ["fast", "poang"]) {
    falt(t).addEventListener("input", () => {
      if (typ !== t) radio(t).click();
      else skicka();
    });
  }

  function sattPoang(pa) {
    radio("poang").disabled = !pa;
    falt("poang").disabled = !pa;
    vy.querySelector(".provl-mynt-krav").hidden = pa;
    if (!pa && typ === "poang") {
      radio("inga").click();
      poangVilar = true;
    } else if (pa && poangVilar && typ === "inga") {
      radio("poang").click();
    }
  }
  sattPoang(poang !== false);
  return { el: vy, sattPoang };
}
