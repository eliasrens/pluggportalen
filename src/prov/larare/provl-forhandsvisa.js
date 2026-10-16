// ============================================================================
// Prov (#739, spec §8.1): "Förhandsvisa som elev". Provet delas precis som när
// det öppnas (delaUppProv → elevens frågor UTAN facit) och ritas av ELEVSIDANS
// egen kod – renderaFragor ur src/prov/prov-elev-vy.js (#740, samma vy och
// samma renderElev per typ som provsidan). Läraren kan svara på prov och
// trycka "Lämna in" – men INGET sparas och inget skickas.
// ============================================================================

import { el, icon } from "../../teacher-shared.js";
import { delaUppProv } from "../prov-modell.js";
import { renderaFragor } from "../prov-elev-vy.js";

/**
 * Visa förhandsvisningen i en dialog.
 * @param {{ namn?: string, beskrivning?: string, fragor: object[], installningar?: object }} prov
 *   arbetskopian eller ett sparat prov (med facit – delas här precis som vid öppning)
 */
export function visaForhandsvisning(prov) {
  const { fragor } = delaUppProv(prov);
  const ins = prov.installningar || {};
  const dlg = el(`<dialog class="provl-dialog provl-fh-dialog teacher-dark" aria-label="Förhandsvisning som elev">
    <div class="provl-dialog-inre">
      <div class="provl-dialog-topp">
        <div><h2 class="subhead">${icon("eye", 20)} Förhandsvisning som elev</h2>
          <p class="hint">Så här ser eleven provet. Du kan svara för att prova – inget sparas.</p></div>
        <button type="button" class="btn small ghost" data-stang aria-label="Stäng">${icon("x", 16)}</button>
      </div>
      <div class="provl-fh-papper"></div>
    </div>
  </dialog>`);
  const papper = dlg.querySelector(".provl-fh-papper");
  if (!fragor.length) papper.appendChild(el(`<p class="hint">Provet har inga frågor än.</p>`));
  else {
    const vy = renderaFragor(papper, fragor, {
      namn: prov.namn || "Namnlöst prov",
      installningar: ins,
      onLamnaIn: () => vy.inlamningMisslyckades("Förhandsvisning – inget lämnades in. Eleven ser nu: \"Ditt prov är inlämnat!\""),
    });
    if (ins.tidsgransMin) vy.satTid(`${ins.tidsgransMin} min kvar`);
  }
  const stang = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.querySelector("[data-stang]").addEventListener("click", stang);
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}
