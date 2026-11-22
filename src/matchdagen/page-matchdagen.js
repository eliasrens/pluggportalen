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
// #880: elevens årskurs för Topplistan ur klassnamnet (klasserna med Matchdagen, ingen läsning).
// #899: källorna som används = de valda ∩ det eleven ser i Plugga, och "Samma som Plugga"
// räknas fram ur synligheten (md-synlig.js) – Plugga-listans cachade läsningar, en gång här.
// #903 (Veckoschema E): under en lektion bara lektionens ämne (grindens schemaläge, ur minnet –
// ingen läsning). Börjar eller slutar en lektion medan sidan är öppen räknas källorna om och
// gäller från NÄSTA match – en pågående match spelas klart med sina frågor (S.bytKallor).
// ============================================================================

import { app, renderTopbar, getLockGate, onLockChange } from "../ui.js";
import { currentStudentId, ensureClassProjection, getArea, getAreas, getClasses, getStudentData, getSubjects } from "../data.js";
import { elevArskurs } from "./delat/md-topplista.js";

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
  let glapp = false; // #878: en ny modul bredvid en gammal cachad (se nedan)
  let klassFel = false; // #899: utan klasslistan vet vi inte vad eleven ser – då inga områden alls
  const [, egenInst, sd, data, { startaMatchdagen }, klasser, mdInst, grind] = await Promise.all([
    renderTopbar(),
    import("./md-inst-data.js").then((m) => m.lasInst(uid)).catch((err) => {
      console.warn("Matchdagen: inställningarna kunde inte läsas", err);
      // Ny md-inst-data.js mot en gammal md-inst.js: länkningen ger SyntaxError (saknat export).
      if (err instanceof SyntaxError) glapp = true;
      else instFel = true;
      return null;
    }),
    getStudentData().catch(() => null),
    import("./md-data.js"),
    import("./md-app.js"),
    getClasses().catch(() => { klassFel = true; return []; }),
    import("./md-inst.js"),
    getLockGate().catch(() => null),
  ]);
  if (ac.signal.aborted) return;
  // Egna inställningar, annars klassens, annars tabellerna 0–10 (#876). Gick de egna inte
  // att läsa vet vi inte om de finns – då inga frågor och ett meddelande, som förr.
  // #878: precis efter en deploy kan webbläsaren (eller Pages-cachen, max-age 600) ge en
  // GAMMAL md-inst.js utan effektivInst bredvid den nya sidan – då de egna, som före #876,
  // i stället för "Matchdagen kunde inte laddas" (utan egna: be eleven ladda om).
  const { harMatchdagen, effektivInst } = mdInst;
  if (typeof effektivInst !== "function") glapp = true;
  const eff = instFel || glapp ? null : effektivInst(egenInst, klasser, uid);
  const valda = instFel ? null : glapp ? egenInst : eff.inst;
  // #899: aldrig frågor ur ett område eleven inte ser. De lästa områdena återanvänds av frågeströmmen.
  // #903: under en lektion bara lektionens ämne – eller spärrad med ett vänligt besked.
  const losa = async (lektion) => {
    const synlig = await import("./md-synlig.js");
    const r = await synlig.losKallor({
      inst: valda, kalla: eff?.kalla || "egen", klasser, uid, hamta: { getSubjects, getAreas, getArea },
      ...(klassFel ? { synliga: [] } : {}), lektion,
    });
    const lasta = r.omraden;
    return {
      inst: r.inst, lasta,
      sparrad: r.sparrad ? (await import("./delat/md-synlighet.js")).lektionsBesked(lektion) : null,
      hamtaOmrade: (s, a) => (lasta.has(`${s}/${a}`) ? Promise.resolve(lasta.get(`${s}/${a}`)) : getArea(s, a)),
    };
  };
  let lektion = grind?.schema || null;
  let k = { inst: null, sparrad: null, hamtaOmrade: getArea };
  if (valda) {
    try {
      k = await losa(lektion);
    } catch (err) {
      console.warn("Matchdagen: områdena eleven ser kunde inte läsas", err);
      instFel = true;
    }
    if (ac.signal.aborted) return;
  }
  const host = document.createElement("section");
  host.setAttribute("aria-label", "Matchdagen");
  app.replaceChildren(host);
  const sok = new URLSearchParams(location.search || location.hash.split("?")[1] || "");
  const S = await startaMatchdagen(host, {
    uid, inst: k.inst,
    meddelande: instFel ? "Inställningarna kunde inte läsas just nu. Prova igen om en stund."
      : glapp ? "Pluggporten uppdaterades nyss. Vänta någon minut och ladda om sidan." : k.sparrad || undefined,
    data,
    hamtaOmrade: k.hamtaOmrade,
    avatar: sd ? { avatarId: sd.avatarId, avatarItems: sd.avatarItems || [] } : null,
    tvinga2d: sok.get("2d") === "1",
    vanskap: vanskapFor(klasser, uid, harMatchdagen),
    arskurs: typeof harMatchdagen === "function" ? elevArskurs(klasser, uid, harMatchdagen) : null,
    signal: ac.signal,
  });
  if (!valda || instFel || ac.signal.aborted) return;
  // #903: en lektion börjar, slutar eller byter ämne medan sidan är öppen → nästa match följer den.
  // app.js lämnar sidan orörd medan en match pågår (__ppMatchdagenPagar), även om Matchdagen spärras.
  const amnesNyckel = (l) => JSON.stringify(l ? [l.amnen, l.tabeller, l.matchdagen] : null);
  let raknar = 0;
  const av = onLockChange(async (g) => {
    const ny = g?.schema || null;
    if (amnesNyckel(ny) === amnesNyckel(lektion)) return;
    lektion = ny;
    const nr = ++raknar;
    try {
      const r = await losa(ny);
      if (nr !== raknar || ac.signal.aborted) return;
      // Sidan visar "Ingen match än" (spärrad när den öppnades): rita om den när det finns frågor igen.
      if (typeof S?.bytKallor === "function") S.bytKallor(r);
      else if (!r.sparrad && mdInst.harKallor?.(r.inst)) pageMatchdagen();
    } catch (err) { console.warn("Matchdagen: källorna kunde inte räknas om", err); }
  });
  window.__ppMatchdagenPagar = () => !!S?.spel?.pagar;
  ac.signal.addEventListener("abort", () => { av(); delete window.__ppMatchdagenPagar; }, { once: true });
}
