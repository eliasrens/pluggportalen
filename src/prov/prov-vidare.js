// ============================================================================
// Prov (#788): vägen vidare på kvittensen "Provet är inlämnat".
// ----------------------------------------------------------------------------
// Enligt lärarens efter-val på provets lås (src/class-lock.js EFTER):
//   klassens vanliga läge (eller inget lås)  → "Till startsidan"
//   bara övning / välj själv                 → de öppna modulerna
//   stanna på provsidan                      → en lugn rad
// Inget ljud, inga belöningar – klasskamraterna skriver kanske fortfarande.
// Ren HTML-logik (Node-testbar); kopplaVidare får ui.js-funktionerna inskickade.
// Laddas bara av prov-elev-sida.js (dynamiskt, aldrig i bootgrafen #271).
// ============================================================================

import { STUDENT_MODULES } from "../gamemode-visibility.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * HTML för vägen vidare.
 * @param {object|null} gate  fokus-grinden (ui.getLockGate), null = inget lås
 * @param {string} t          provtillfällets id
 * @param {string[]} [dolda]  klassens dolda moduler (ui.getHiddenModules)
 */
export function vidareHtml(gate, t, dolda = []) {
  if (!gate) return `<a href="#/elev/hus" class="provv-vidare-knapp">Till startsidan</a>`;
  if (gate.lock.mal.typ !== "prov" || gate.lock.mal.id !== t) return "";
  // Villkorade moduler (Mattematchen) syns i menyn när de är aktuella – inte här.
  const moduler = gate.fri
    ? STUDENT_MODULES.filter((m) => gate.lock.moduler.includes(m.id) && !m.villkor && !dolda.includes(m.id))
    : [];
  if (!moduler.length) return `<p class="provv-vidare-text">Stanna kvar här tills din lärare avslutar provet.</p>`;
  return `<p class="provv-vidare-text">${gate.fri === "ovning" ? "Fortsätt öva:" : "Du kan fortsätta med:"}</p>
    <div class="provv-vidare-lankar">${moduler.map((m) =>
      `<a href="#${m.routes[0]}" class="provv-vidare-knapp"><span aria-hidden="true">${m.ikon}</span> ${esc(m.label)}</a>`).join("")}</div>`;
}

/**
 * Rita vägen vidare i `plats` och rita om när låset ändras (svaret blir
 * inlämnat, läraren stänger provet), tills eleven lämnar routen. Egen städning
 * – skrivvyns (vidByte) ska stå kvar tills eleven går.
 */
export function kopplaVidare(plats, t, { getLockGate, getHiddenModules, onLockChange }) {
  const route = location.hash;
  const rita = async () => {
    const [gate, dolda] = await Promise.all([getLockGate(), getHiddenModules().catch(() => [])]);
    if (location.hash === route && plats.isConnected) plats.innerHTML = vidareHtml(gate, t, dolda);
  };
  rita();
  const av = onLockChange(rita);
  const koll = () => {
    if (location.hash === route) return;
    av();
    window.removeEventListener("hashchange", koll);
  };
  window.addEventListener("hashchange", koll);
}
