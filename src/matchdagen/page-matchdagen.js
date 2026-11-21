// ============================================================================
// Matchdagen – elevens sida (src/matchdagen/page-matchdagen.js) · #867 (1a), #869 (1c)
// ----------------------------------------------------------------------------
//   #/elev/matchdagen   klubben, säsongen i Division 6, matchen i 3D (2D-reserv),
//                       tabellen, truppen och statistiken (md-app.js).
//                       ?2d=1 tvingar 2D-reserven, ?fps=1 visar bilder per sekund.
//
// Routen ligger i app.js med DYNAMISK import (dynSida) – inget i src/matchdagen/
// hamnar i bootgrafen (#271). Grinden i app.js/ui.js släpper bara in elever som
// läraren slagit på Matchdagen för (classes/{id}.enabledModules för hela klassen, #876,
// eller .elevModuler per elev) och fokusläget stänger sidan (learning). Inställningarna:
// egna, annars klassens (klassdokumentet, ingen läsning), annars tabellerna 0–10
// (md-inst.js effektivInst). Kvoten (§13): matchdagenInst/{uid} och
// matchdagen/{uid} läses EN gång var när sidan öppnas, inga lyssnare. Avataren
// kommer ur getStudentData (sidomenyns cache – ingen ny läsning).
// Vänskapsmatcher (#874): elevens klass med Matchdagen ur getClasses() (klasslistans
// cache) och kompisarnas namn ur classProjections – EN läsning, först när fliken öppnas.
// #878: sidan klarar en gammal cachad md-inst.js (versionsglapp precis efter en deploy).
// ============================================================================

import { app, renderTopbar } from "../ui.js";
import { currentStudentId, ensureClassProjection, getArea, getClasses, getStudentData } from "../data.js";

let aktiv = null; // sidans AbortController – avbryts när eleven lämnar sidan

/** Klassen där eleven har Matchdagen och kompisarna som också har den (§11.1); null utan klass. */
function vanskapFor(klasser, uid, harMatchdagen) {
  const k = (klasser || []).find((c) => Array.isArray(c.studentIds) && c.studentIds.includes(uid) && harMatchdagen(c, uid));
  if (!k) return null;
  const ids = k.studentIds.filter((x) => x !== uid && harMatchdagen(k, x));
  let namn = null;
  return {
    classId: k.id,
    kompisar: () => (namn ||= ensureClassProjection(k.id, ids).then(({ members }) => ids
      .map((x) => ({ uid: x, namn: String(members?.[x]?.namn || "Okänd") }))
      .sort((a, b) => a.namn.localeCompare(b.namn, "sv")))),
    moln: () => import("./vanskap/md-vanskap-moln.js"),
  };
}

export async function pageMatchdagen() {
  aktiv?.abort();
  const ac = new AbortController();
  aktiv = ac;
  const route = location.hash.split("?")[0];
  const lamna = () => { if (location.hash.split("?")[0] !== route) { ac.abort(); window.removeEventListener("hashchange", lamna); } };
  window.addEventListener("hashchange", lamna);

  const uid = currentStudentId();
  let instFel = false;
  const [, egenInst, sd, data, { startaMatchdagen }, klasser, mdInst] = await Promise.all([
    renderTopbar(),
    import("./md-inst-data.js").then((m) => m.lasInst(uid)).catch((err) => {
      console.warn("Matchdagen: inställningarna kunde inte läsas", err);
      instFel = true;
      return null;
    }),
    getStudentData().catch(() => null),
    import("./md-data.js"),
    import("./md-app.js"),
    getClasses().catch(() => []),
    import("./md-inst.js"),
  ]);
  if (ac.signal.aborted) return;
  // Egna inställningar, annars klassens, annars tabellerna 0–10 (#876). Gick de egna inte
  // att läsa vet vi inte om de finns – då inga frågor och ett meddelande, som förr.
  // #878: precis efter en deploy kan webbläsaren (eller Pages-cachen, max-age 600) ge en
  // GAMMAL md-inst.js utan effektivInst bredvid den nya sidan – då de egna, som före #876,
  // i stället för "Matchdagen kunde inte laddas" (utan egna: be eleven ladda om).
  const { harMatchdagen, effektivInst } = mdInst;
  const glapp = typeof effektivInst !== "function";
  const inst = instFel ? null : glapp ? egenInst : effektivInst(egenInst, klasser, uid).inst;
  const host = document.createElement("section");
  host.setAttribute("aria-label", "Matchdagen");
  app.replaceChildren(host);
  const sok = new URLSearchParams(location.search || location.hash.split("?")[1] || "");
  await startaMatchdagen(host, {
    uid, inst,
    meddelande: instFel ? "Inställningarna kunde inte läsas just nu. Prova igen om en stund."
      : glapp ? "Pluggporten uppdaterades nyss. Vänta någon minut och ladda om sidan." : undefined,
    data,
    hamtaOmrade: (s, a) => getArea(s, a),
    avatar: sd ? { avatarId: sd.avatarId, avatarItems: sd.avatarItems || [] } : null,
    tvinga2d: sok.get("2d") === "1",
    vanskap: vanskapFor(klasser, uid, harMatchdagen),
    signal: ac.signal,
  });
}
