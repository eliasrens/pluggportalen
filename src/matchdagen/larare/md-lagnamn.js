// ============================================================================
// Matchdagen (#869): lärarens knapp "Återställ lagnamn" (spec §1.2, §6.4) – i
// panelen Anpassningar per elev och i Hur går det? → Matchdagen. EN skrivning:
// bara klubb.namn, tillbaka till standardnamnet (reglerna: mdBaraLagnamn).
// ============================================================================

import { esc, errText } from "../../teacher-shared.js";
import { STANDARD_LAGNAMN } from "../delat/md-namn.js";

/**
 * Koppla knappen. status = elementet för svaret. efter(namn) anropas när det gick.
 * @param {HTMLButtonElement} knapp
 */
export function kopplaAterstall(knapp, { uid, elevNamn, status, efter }) {
  knapp.disabled = false;
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    status.textContent = "Återställer…";
    try {
      await (await import("../md-data.js")).aterstallLagnamn(uid);
      status.innerHTML = `<span class="ok-inline">Lagnamnet är nu ${esc(STANDARD_LAGNAMN)} ✓</span>`;
      efter?.(STANDARD_LAGNAMN);
    } catch (err) {
      status.innerHTML = err?.code === "not-found"
        ? `<span class="err-inline">${esc(elevNamn)} har inte startat något lag än.</span>`
        : `<span class="err-inline">Kunde inte återställa: ${esc(errText(err))}</span>`;
    } finally {
      knapp.disabled = false;
    }
  });
}
