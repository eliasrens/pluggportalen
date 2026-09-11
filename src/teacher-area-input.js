// ============================================================================
// Pluggportalen – lärarsidan: samla ihop områdes-inmatningen (teacher-area-input.js)
// ----------------------------------------------------------------------------
// Innehållssidan matar in ett arbetsområde från FLERA ställen: JSON-rutan
// (texter/quiz/par) plus fristående kontroller vid sidan om – årskurs och (issue
// #279) räknegeneratorn. De sistnämnda ligger MEDVETET utanför JSON:en, men måste
// vävas in FÖRE validering: ett rent generator-område har inget quiz/par i JSON:en
// och skulle annars fastna på "inget innehåll".
//
// Den här lilla fabriken äger den sömmen så teacher-content.js slipper bära den:
//   • validateCurrent()   – parsa JSON-rutan, väv in generator-konfigen, validera.
//   • syncModeVisibility() – rita synliga-lägen-listan ur JSON + generator, så
//                            räkna-läget dyker upp/försvinner direkt (utan Kontrollera).
// Grötskydd: rör bara ihop indata – ingen egen datamodell, all validering går via
// validateArea (src/validate.js).
// ============================================================================

import { validateArea } from "./validate.js";

/**
 * @param {object} deps
 * @param {HTMLTextAreaElement} deps.jsonEl      redigeringsrutan.
 * @param {object} deps.generatorCtl             createGeneratorControl(...)-instansen.
 * @param {() => (string|null)} deps.getSelectedGrade  områdets valda årskurs.
 * @param {object} deps.modeVis                  createModeVisibility(...)-instansen.
 */
export function createAreaInput({ jsonEl, generatorCtl, getSelectedGrade, modeVis }) {
  /**
   * Bygg objektet som ska valideras/sparas ur JSON-rutan + generator-kontrollen.
   * Tom ruta → {} (namn-kravet fångas av validate). Trasig JSON → vänligt fel.
   * @returns {{ok:boolean, errors:string[], value:object|null}}
   */
  function validateCurrent() {
    const raw = jsonEl.value.trim();
    let obj = {};
    if (raw) {
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        return {
          ok: false,
          errors: [
            "Texten är inte giltig JSON: " +
              e.message +
              ". Tips: kontrollera att alla { } och [ ] hör ihop och att det inte finns extra kommatecken.",
          ],
          value: null,
        };
      }
    }
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const gen = generatorCtl.getGenerator(getSelectedGrade());
      if (gen) obj = { ...obj, generator: gen };
      else if ("generator" in obj) {
        obj = { ...obj };
        delete obj.generator;
      }
    }
    return validateArea(obj);
  }

  /**
   * Rita synliga-lägen-listan ur JSON-rutan PLUS generator-kontrollen, så att
   * räkna-läget syns så fort en generator valts (utan att klicka Kontrollera).
   * Trasig JSON mitt i skrivandet → låt listan stå kvar orörd (som autoFromJson).
   */
  function syncModeVisibility() {
    const raw = jsonEl.value.trim();
    const gen = generatorCtl.getGenerator(getSelectedGrade());
    if (!raw && !gen) {
      modeVis.autoFromJson("");
      return;
    }
    let obj = {};
    if (raw) {
      try {
        obj = JSON.parse(raw);
      } catch {
        return; // ofullständig JSON – behåll det som redan visas
      }
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        modeVis.autoFromJson(raw);
        return;
      }
    }
    if (gen) obj = { ...obj, generator: gen };
    modeVis.autoFromJson(JSON.stringify(obj));
  }

  return { validateCurrent, syncModeVisibility };
}
