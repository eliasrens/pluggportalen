// ============================================================================
// Prov (#759): redigerarens val "Stavfel och färggränser" – per prov.
//   Stavfel: "Ett stavfel ger halva poängen" (auto, standard) eller "Rätta
//   stavfel själv" (inget förslag, svaret väntar på läraren i rättningen).
//   Gäller frågor där "Exakt stavning krävs" är av.
//   Färggränser: gul från X %, grön från Y % (standard 60/85, under gul =
//   röd) – används i översikten, elevvyn, statistiken och utskriften.
// Ritas under inställningarna av provl-redigera.js; valen valideras när provet
// sparas (validateProv). Fältet visar felet direkt medan läraren skriver.
//
//   const f = bedomningFalt({ installningar, onAndra })  onAndra({ stavfel } | { granser })
//   f.el   fieldset att lägga in
// ============================================================================

import { el } from "../../teacher-shared.js";
import { STANDARD_INSTALLNINGAR, STAVFEL, granserOk, granserText, stavfelFor } from "../prov-validera.js";

// Sifferfältens värde: ett tal när det går, annars texten (validateProv säger vad som är fel).
const tal = (v) => (String(v).trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v);

export function bedomningFalt({ installningar, onAndra }) {
  const std = STANDARD_INSTALLNINGAR.granser;
  const g = { gul: installningar?.granser?.gul ?? std.gul, gron: installningar?.granser?.gron ?? std.gron };
  const vy = el(`<fieldset class="provl-grupp provl-bedomning"><legend>Stavfel och färggränser</legend>
    <div class="provl-val" role="radiogroup" aria-label="Stavfel">
      <label class="provl-check"><input type="radio" name="provl-stavfel" value="${STAVFEL.AUTO}" /><span><b>Ett stavfel ger halva poängen</b> <span class="hint">– automatiskt förslag</span></span></label>
      <label class="provl-check"><input type="radio" name="provl-stavfel" value="${STAVFEL.SJALV}" /><span><b>Rätta stavfel själv</b> <span class="hint">– svaret väntar på dig i rättningen</span></span></label>
    </div>
    <p class="hint">Gäller frågor där ”Exakt stavning krävs” är av. Ett stavfel = en bokstav fel i ett ord med minst fyra bokstäver.</p>
    <div class="provl-granser">
      <label class="provl-falt provl-grans"><span><span class="provl-prick provl-prick-gul" aria-hidden="true"></span> Gul från</span> <span class="provl-grans-in"><input type="number" data-g="gul" min="1" max="99" step="1" inputmode="numeric" /> %</span></label>
      <label class="provl-falt provl-grans"><span><span class="provl-prick provl-prick-gron" aria-hidden="true"></span> Grön från</span> <span class="provl-grans-in"><input type="number" data-g="gron" min="2" max="100" step="1" inputmode="numeric" /> %</span></label>
    </div>
    <p class="hint provl-grans-text" aria-live="polite"></p>
  </fieldset>`);
  const radio = (v) => vy.querySelector(`input[name="provl-stavfel"][value="${v}"]`);
  radio(stavfelFor(installningar)).checked = true;
  vy.querySelectorAll('input[name="provl-stavfel"]').forEach((r) => r.addEventListener("change", () => {
    if (r.checked) onAndra({ stavfel: r.value });
  }));

  const falt = (k) => vy.querySelector(`[data-g="${k}"]`);
  const text = vy.querySelector(".provl-grans-text");
  const visa = () => {
    const nu = { gul: tal(falt("gul").value), gron: tal(falt("gron").value) };
    const ok = granserOk(nu);
    text.textContent = ok
      ? `Färgen på elevens resultat: ${granserText(nu)} – räknat på de bedömda frågorna.`
      : "Gränserna ska vara hela procent där gul (1–99) är lägre än grön (högst 100).";
    text.classList.toggle("provl-grans-fel", !ok);
    for (const k of ["gul", "gron"]) falt(k).setAttribute("aria-invalid", ok ? "false" : "true");
    return nu;
  };
  for (const k of ["gul", "gron"]) {
    falt(k).value = String(g[k]);
    falt(k).addEventListener("input", () => onAndra({ granser: visa() }));
  }
  visa();
  return { el: vy };
}
