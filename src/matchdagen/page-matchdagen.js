// ============================================================================
// Matchdagen – elevens sida (src/matchdagen/page-matchdagen.js) · #867 (1a), #869 (1c)
// ----------------------------------------------------------------------------
//   #/elev/matchdagen   klubben, säsongen i Division 6, matchen i 3D (2D-reserv),
//                       tabellen, truppen och statistiken (md-app.js).
//                       ?2d=1 tvingar 2D-reserven, ?fps=1 visar bilder per sekund.
//
// Routen ligger i app.js med DYNAMISK import (dynSida) – inget i src/matchdagen/
// hamnar i bootgrafen (#271). Grinden i app.js/ui.js släpper bara in elever som
// läraren slagit på Matchdagen för (classes/{id}.elevModuler) och fokusläget
// stänger sidan (learning). Kvoten (§13): matchdagenInst/{uid} och
// matchdagen/{uid} läses EN gång var när sidan öppnas, inga lyssnare. Avataren
// kommer ur getStudentData (sidomenyns cache – ingen ny läsning).
// ============================================================================

import { app, renderTopbar } from "../ui.js";
import { currentStudentId, getArea, getStudentData } from "../data.js";

let aktiv = null; // sidans AbortController – avbryts när eleven lämnar sidan

export async function pageMatchdagen() {
  aktiv?.abort();
  const ac = new AbortController();
  aktiv = ac;
  const route = location.hash.split("?")[0];
  const lamna = () => { if (location.hash.split("?")[0] !== route) { ac.abort(); window.removeEventListener("hashchange", lamna); } };
  window.addEventListener("hashchange", lamna);

  const uid = currentStudentId();
  let instFel = false;
  const [, inst, sd, data, { startaMatchdagen }] = await Promise.all([
    renderTopbar(),
    import("./md-inst-data.js").then((m) => m.lasInst(uid)).catch((err) => {
      console.warn("Matchdagen: inställningarna kunde inte läsas", err);
      instFel = true;
      return null;
    }),
    getStudentData().catch(() => null),
    import("./md-data.js"),
    import("./md-app.js"),
  ]);
  if (ac.signal.aborted) return;
  const host = document.createElement("section");
  host.setAttribute("aria-label", "Matchdagen");
  app.replaceChildren(host);
  const sok = new URLSearchParams(location.search || location.hash.split("?")[1] || "");
  await startaMatchdagen(host, {
    uid, inst,
    meddelande: instFel ? "Inställningarna kunde inte läsas just nu. Prova igen om en stund." : undefined,
    data,
    hamtaOmrade: (s, a) => getArea(s, a),
    avatar: sd ? { avatarId: sd.avatarId, avatarItems: sd.avatarItems || [] } : null,
    tvinga2d: sok.get("2d") === "1",
    signal: ac.signal,
  });
}
