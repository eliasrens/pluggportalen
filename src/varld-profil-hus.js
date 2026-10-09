// ============================================================================
// Pluggporten – profil "hus" för Pixi-rörelsens spegling (#396, S1 #419)
// ----------------------------------------------------------------------------
// Gäller de tre hus-exteriörerna (data-spegel-profil="hus" i pages-varld.js):
//   #ute-lager         elevens eget hus (husScen + avatar + trädgård)
//   #kompis-lager      en kamrats hus (kompisHusHtml, id-prefix "kompis-")
//   #grannbyhus-lager  en grannby-elevs hus (kompisHusHtml, prefix "grannbyhus-")
// Övergångar: T2 (by↔hus, hus = INRE roll, z ∈ [1/5, 1]), T3 (hus↔rum, hus =
// YTTRE roll, z ∈ [1, 6] kring fönstret) och T7 (hus↔gård, YTTRE roll, z ∈
// [1, 5]) – plus T4/T6 (kompis-/grannbyhus som inre roll). Motorn förvärmer
// nivåns grannövergångar i idle efter landning; hus-målen är statiska (fast
// fokus i kamerorna), så ingen malSelektor behövs.
//
// Allt i lagret är DOM:en som redan står där (Firestore orört):
//   • konsten = en inline-SVG (viewBox 960×600, himmel/gräs övertecknade långt
//     utanför → fångst "stage": det inkommande huset syns nedkrympt i T2 med
//     himmel och gräs runt om), husskalet ur valfritt art-hus-*-register och
//     paletten via var(--hus-*) på staget (speglingen löser var() per nod);
//   • avataren = HTML i <foreignObject> (af-*-lagren, rygg före bas) → speglas
//     till nästlade <svg> (regel 2), så kläder bytta i rummet följer med när
//     #ute-avatar skrivs om (MutationObserver → ny spegling);
//   • trädgården = .garden-item-divar i .tradgard-lager (procent-positioner;
//     en släppt sak skriver om style → lagret smutsas → ny spegling).
//
// Ambient (levande, CSS-animerade): molnen driver, solstrålarna roterar och
// skorstensröken puffar. De ligger BAKOM annat innehåll (solstrålar bakom
// solen, moln bakom husens silhuetter, rök under takkant/torn) – därför bakas de in
// FRUSNA i basen i rätt z-ordning (WAAPI-paus vid handoff, F4b-semantiken),
// inte som sprites ovanpå. MutationObservern ignorerar dem.
//
// Objekt (fokus-överlägg): TOMT med flit. Husgruppen och klasskylten har
// hover/focus-transform (scale + rotate), men efter F4b (#428) ritas ett
// hovrat `objekt` som sprite OVANPÅ hela basen – och i hus-scenen ligger
// avataren (FO), gången och trädgårdssakerna FRAMFÖR huset/skylten. Ett
// hovrat-hus-överlägg täckte därför halva avataren de första bildrutorna i T3
// (verifierat i preview-pixi-hus.html). Hus-lagret speglas ändå om vid VARJE
// handoff (ambient körs alltid), så hover-skalan bakas in i basen i rätt
// z-ordning i stället. Trädgårdssakerna saknar hover-stil (bara .selected).
//
// Neutralisera (F6 #432): samma noder. Idle-förvärmningen speglar dem i vila-
// läge (neutral reserv); hover/fokus på dem ger en egen spegel under nyckeln
// roll + tillstånd (varld-motor-tillstand.js), så en reserv med huset i
// hover-skala spelas aldrig när DOM:en visar huset ohovrat – och tvärtom.
//
// Laddas bara via import() (varld-motor-textur.js laddaProfil) – aldrig i
// bootgrafen. Format: §2.4 i docs/pixi-arkitektur-396.md.
// ============================================================================

export default {
  id: "hus",
  ambient: [".hus-moln", ".hus-solstralar", ".hus-rok"],
  // Inga sprites: varje ambient-nod har något ritat OVANPÅ sig i minst ett
  // husskal (mätt över alla 38 skal i preview-pixi-hus.html): solstrålarna
  // ligger under solen, två av tre molnrader passerar bakom 22 resp. 37 skals
  // silhuetter (även översta raden bakom akvariehuset) och röken täcks av
  // takkant/torn i stuga och tidstorn. Som sprites ovanpå skulle de bryta
  // z-ordningen; molnraden bakom taket kräver omspegling ändå.
  sprites: [],
  objekt: [],
  // Husgruppen och klasskylten (även kompis-/grannbyhusets, prefixade id:n).
  neutralisera: ['[id$="husgrupp"]', '[id$="klasskylt"]'],
  // Ingenting i hus-lagret är tillfälligt UI: menyer, paneler och nav-skyltar
  // ("Till gården") ligger i .varld-ui ovanpå scenen och speglas aldrig.
  ignorera: [],
  malSelektor: null,
  fangst: "stage",
};
