// ============================================================================
// Pluggporten – profil "skola" för Pixi-rörelsens spegling (#396, S3 #421)
// ----------------------------------------------------------------------------
// Gäller #skola-lager (data-spegel-profil="skola" i pages-varld.js): skolans
// översikt med en liten by per SYNLIG klass (varld-omrade.js). Lagret deltar i
//   T1  skola ↔ egna byn      (huvudkameran, fokus = egna byns plats)
//   T5  skola ↔ en grannby    (grannby-kameran, fokus = klickade klassens plats)
// och är då alltid YTTRE lagret (z ∈ [1, OMRADE_ZOOM] kring byns fokus).
//
//   ambient     inga – skolan har inga levande animationer (bara hover-scale)
//   objekt      .omrade-by – hovrad/fokuserad by står i scale(1.06) (+ fokus-
//               ring) och blir fokus-överlägg vid handoff, så klicket inte "poppar"
//   malSelektor .omrade-by[data-fokus-x] – byarna bär kamerans exakta fokus;
//               varld-grannby.js förvärmer T1/T5 vid pointerenter/focusin
//   fangst      "stage" – gräset/himlen (.omrade-mark) är övertecknade runt lagret
//
// INTEGRITET (#391): lagret ritas ur den REDAN filtrerade klasslistan
// (visibleVillageClasses före mountOmradeScen). Speglingen läser bara DOM:en →
// en dold by kan aldrig hamna i en textur. Profilen filtrerar inget själv.
// Laddas bara via import() (varld-motor-textur.js) – aldrig i bootgrafen.
// ============================================================================

export default {
  id: "skola",
  ambient: [],
  objekt: ".omrade-by",
  ignorera: [],
  malSelektor: ".omrade-by[data-fokus-x]",
  fangst: "stage",
};
